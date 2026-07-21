"use server";

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAndSendOtp, verifyOtpCode, peekOtpToken, consumeOtpChallenge, type OtpPurpose } from "@/lib/otp";
import {
  ensureDeviceSession,
  listDeviceSessions,
  revokeDeviceSession,
  revokeAllOtherDeviceSessions,
} from "@/lib/devices";
import { friendlyError } from "@/lib/errors";

const PENDING_2FA_COOKIE = "thryve_pending_2fa";
const PASSWORD_OTP_VERIFIED_COOKIE = "thryve_pw_otp_ok";

function getPendingCookie() {
  const raw = cookies().get(PENDING_2FA_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId: string; email: string; expiresAt: string };
    if (new Date(parsed.expiresAt).getTime() < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setPendingCookie(userId: string, email: string) {
  cookies().set(
    PENDING_2FA_COOKIE,
    JSON.stringify({
      userId,
      email,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    }
  );
}

function clearPendingCookie() {
  cookies().set(PENDING_2FA_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function setPasswordOtpVerified(userId: string) {
  cookies().set(PASSWORD_OTP_VERIFIED_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
}

function isPasswordOtpVerified(userId: string) {
  return cookies().get(PASSWORD_OTP_VERIFIED_COOKIE)?.value === userId;
}

function clearPasswordOtpVerified() {
  cookies().set(PASSWORD_OTP_VERIFIED_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function isRedirectError(error: any) {
  return (
    error?.message === "NEXT_REDIRECT" ||
    error?.name === "RedirectError" ||
    error?.digest?.startsWith("NEXT_REDIRECT")
  );
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

/** Step 1: send OTP only (no current password) */
export async function requestPasswordChangeOtpAction() {
  try {
    const user = await requireUser();
    if (!user?.email) return { error: "Please sign in again to continue." };

    clearPasswordOtpVerified();

    await createAndSendOtp({
      userId: user.id,
      email: user.email,
      purpose: "CHANGE_PASSWORD",
    });

    return { success: `Verification code sent to ${user.email}`, otpSent: true };
  } catch (err) {
    return {
      error: friendlyError(err, "Could not send verification email. Please try again."),
    };
  }
}

/** Step 2: verify OTP, unlock password form */
export async function verifyPasswordChangeOtpAction(formData: FormData) {
  try {
    const user = await requireUser();
    if (!user) return { error: "Please sign in again to continue." };

    const code = String(formData.get("code") || "");
    const result = await verifyOtpCode({
      userId: user.id,
      purpose: "CHANGE_PASSWORD",
      code,
    });
    if (!result.ok) return { error: result.error };

    setPasswordOtpVerified(user.id);
    return { success: "Code verified. Set your new password.", verified: true };
  } catch (err) {
    return {
      error: friendlyError(err, "Could not verify the code. Please try again."),
    };
  }
}

/** Step 3: set new password after OTP verified */
export async function setNewPasswordAction(formData: FormData) {
  try {
    const user = await requireUser();
    if (!user) return { error: "Please sign in again to continue." };

    if (!isPasswordOtpVerified(user.id)) {
      return { error: "Verify the email code first, then set a new password." };
    }

    const newPassword = String(formData.get("newPassword") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!newPassword || newPassword.length < 6) {
      return { error: "New password must be at least 6 characters." };
    }
    if (newPassword !== confirmPassword) {
      return { error: "New passwords do not match." };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    const session = await auth();
    const currentSessionId = (session as any)?.sessionId as string | undefined;
    await revokeAllOtherDeviceSessions(user.id, currentSessionId);
    clearPasswordOtpVerified();

    return { success: "Password updated successfully." };
  } catch (err) {
    return {
      error: friendlyError(err, "Could not update password. Please try again."),
    };
  }
}

export async function sendSecurityOtpAction(purpose: OtpPurpose) {
  try {
    const user = await requireUser();
    if (!user?.email) return { error: "Please sign in again to continue." };

    if (purpose === "ENABLE_2FA" && user.twoFactorEnabled) {
      return { error: "Two-factor authentication is already enabled." };
    }
    if (purpose === "DISABLE_2FA" && !user.twoFactorEnabled) {
      return { error: "Two-factor authentication is already disabled." };
    }
    if (purpose === "CHANGE_PASSWORD") {
      return { error: "Use the password form to request a verification code." };
    }

    await createAndSendOtp({
      userId: user.id,
      email: user.email,
      purpose,
    });
    return { success: `Verification code sent to ${user.email}` };
  } catch (err) {
    return {
      error: friendlyError(err, "Could not send verification email. Please try again."),
    };
  }
}

export async function confirmEnable2FAAction(formData: FormData) {
  try {
    const user = await requireUser();
    if (!user) return { error: "Please sign in again to continue." };

    const code = String(formData.get("code") || "");
    const result = await verifyOtpCode({ userId: user.id, purpose: "ENABLE_2FA", code });
    if (!result.ok) return { error: result.error };

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });

    return { success: "Two-factor authentication enabled." };
  } catch (err) {
    return { error: friendlyError(err, "Could not enable two-factor authentication.") };
  }
}

export async function confirmDisable2FAAction(formData: FormData) {
  try {
    const user = await requireUser();
    if (!user) return { error: "Please sign in again to continue." };

    const code = String(formData.get("code") || "");
    const result = await verifyOtpCode({ userId: user.id, purpose: "DISABLE_2FA", code });
    if (!result.ok) return { error: result.error };

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false },
    });

    return { success: "Two-factor authentication disabled." };
  } catch (err) {
    return { error: friendlyError(err, "Could not disable two-factor authentication.") };
  }
}

export async function getConnectedDevicesAction() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Please sign in again to continue.", devices: [] as any[] };
    }

    const currentSessionId = (session as any).sessionId as string | undefined;
    if (currentSessionId) {
      try {
        await ensureDeviceSession(session.user.id, currentSessionId);
      } catch {
        // non-blocking
      }
    }

    const devices = await listDeviceSessions(session.user.id);

    return {
      devices: devices.map((d) => ({
        id: d.id,
        sessionId: d.sessionId,
        label: d.label || "Unknown device",
        ipAddress: d.ipAddress,
        createdAt: d.createdAt.toISOString(),
        lastSeenAt: d.lastSeenAt.toISOString(),
        isCurrent: currentSessionId ? d.sessionId === currentSessionId : false,
      })),
      hint:
        devices.length <= 1
          ? "Only sessions created after device tracking was enabled appear here. Sign in again on other devices to list them."
          : undefined,
    };
  } catch (err) {
    return {
      error: friendlyError(err, "Could not load connected devices. Please try again."),
      devices: [] as any[],
    };
  }
}

export async function revokeDeviceAction(sessionId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: "Please sign in again to continue." };

    const currentSessionId = (session as any).sessionId as string | undefined;
    if (currentSessionId && currentSessionId === sessionId) {
      return { error: "You can't revoke this device. Use Sign Out instead." };
    }

    await revokeDeviceSession(session.user.id, sessionId);
    return { success: "That device has been signed out." };
  } catch (err) {
    return { error: friendlyError(err, "Could not revoke that device. Please try again.") };
  }
}

export async function deleteAccountAction(formData: FormData) {
  try {
    const user = await requireUser();
    if (!user?.email) return { error: "Please sign in again to continue." };

    const code = String(formData.get("code") || "");
    const confirmText = String(formData.get("confirmText") || "");

    if (confirmText.trim().toUpperCase() !== "DELETE") {
      return { error: 'Type DELETE to confirm account deletion.' };
    }

    const result = await verifyOtpCode({
      userId: user.id,
      purpose: "DELETE_ACCOUNT",
      code,
    });
    if (!result.ok) return { error: result.error };

    await prisma.user.delete({ where: { id: user.id } });
    await signOut({ redirectTo: "/login" });
    return { success: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: friendlyError(err, "Could not delete account. Please try again.") };
  }
}

export async function beginLoginAction(prevState: any, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Please enter both email and password." };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      return { error: "Invalid email or password." };
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return { error: "Invalid email or password." };
    }

    await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
    });
    return { success: true };
  } catch (error: any) {
    if (isRedirectError(error)) throw error;
    if (error.type === "CredentialsSignin" || error.code === "CredentialsSignin") {
      return { error: "Invalid email or password." };
    }
    return {
      error: friendlyError(error, "Sign-in failed. Please try again."),
    };
  }
}

export async function verifyLoginOtpAction(prevState: any, formData: FormData) {
  const code = String(formData.get("code") || "");
  const pending = getPendingCookie();
  if (!pending) {
    return { error: "Your verification session expired. Please sign in again." };
  }

  try {
    const result = await verifyOtpCode({
      userId: pending.userId,
      purpose: "LOGIN_2FA",
      code,
    });
    if (!result.ok) return { error: result.error };

    clearPendingCookie();

    await signIn("otp-verified", {
      userId: pending.userId,
      challengeId: result.challenge.id,
      redirectTo: "/",
    });
    return { success: true };
  } catch (error: any) {
    if (isRedirectError(error)) throw error;
    return {
      error: friendlyError(error, "Could not complete sign-in. Please try again."),
    };
  }
}

export async function resendLoginOtpAction() {
  const pending = getPendingCookie();
  if (!pending) {
    return { error: "Your verification session expired. Please sign in again." };
  }

  try {
    await createAndSendOtp({
      userId: pending.userId,
      email: pending.email,
      purpose: "LOGIN_2FA",
    });
    setPendingCookie(pending.userId, pending.email);
    return { success: `A new code was sent to ${pending.email}` };
  } catch (err) {
    return {
      error: friendlyError(err, "Could not resend the code. Please try again."),
    };
  }
}

export async function verifyOtpLinkAction(token: string, purpose: OtpPurpose) {
  try {
    const peeked = await peekOtpToken({ token, purpose });
    if (!peeked.ok) {
      return { error: peeked.error };
    }

    const { challenge } = peeked;

    if (purpose === "LOGIN_2FA") {
      await consumeOtpChallenge(challenge.id);
      clearPendingCookie();
      try {
        await signIn("otp-verified", {
          userId: challenge.userId,
          challengeId: challenge.id,
          redirectTo: "/",
        });
      } catch (error: any) {
        if (isRedirectError(error)) throw error;
        return {
          error: friendlyError(error, "Could not complete sign-in. Please try again."),
        };
      }
      return { success: true };
    }

    const session = await auth();
    if (!session?.user?.id || session.user.id !== challenge.userId) {
      return { error: "Please sign in first, then open the verification link again." };
    }

    if (purpose === "ENABLE_2FA") {
      await prisma.user.update({
        where: { id: challenge.userId },
        data: { twoFactorEnabled: true },
      });
      await consumeOtpChallenge(challenge.id);
      return { success: "Two-factor authentication enabled.", redirectTo: "/profile" };
    }

    if (purpose === "DISABLE_2FA") {
      await prisma.user.update({
        where: { id: challenge.userId },
        data: { twoFactorEnabled: false },
      });
      await consumeOtpChallenge(challenge.id);
      return { success: "Two-factor authentication disabled.", redirectTo: "/profile" };
    }

    if (purpose === "CHANGE_PASSWORD") {
      await consumeOtpChallenge(challenge.id);
      setPasswordOtpVerified(challenge.userId);
      return {
        success: "Email verified. Set your new password on the profile page.",
        redirectTo: "/profile?setPassword=1",
      };
    }

    if (purpose === "DELETE_ACCOUNT") {
      await consumeOtpChallenge(challenge.id);
      await prisma.user.delete({ where: { id: challenge.userId } });
      await signOut({ redirectTo: "/login" });
      return { success: true };
    }

    await consumeOtpChallenge(challenge.id);
    return { success: "Verified successfully.", redirectTo: "/profile" };
  } catch (err: any) {
    if (isRedirectError(err)) throw err;
    return {
      error: friendlyError(err, "This verification link is invalid or expired."),
    };
  }
}

export async function getPending2FAEmail() {
  return getPendingCookie()?.email ?? null;
}
