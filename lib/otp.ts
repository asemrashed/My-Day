import crypto from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";

export type OtpPurpose =
  | "LOGIN_2FA"
  | "ENABLE_2FA"
  | "DISABLE_2FA"
  | "CHANGE_PASSWORD"
  | "DELETE_ACCOUNT";

const PURPOSE_LABELS: Record<OtpPurpose, string> = {
  LOGIN_2FA: "complete your sign-in",
  ENABLE_2FA: "enable two-factor authentication",
  DISABLE_2FA: "disable two-factor authentication",
  CHANGE_PASSWORD: "confirm your password change",
  DELETE_ACCOUNT: "confirm account deletion",
};

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeCode(code: string) {
  return code.replace(/\s+/g, "").trim();
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

/** Prefer the host the user is actually on (fixes localhost:3002 vs NEXTAUTH_URL:3000). */
function appBaseUrl() {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (host) {
      const proto =
        h.get("x-forwarded-proto") ||
        (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable outside a request
  }
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function createAndSendOtp({
  userId,
  email,
  purpose,
}: {
  userId: string;
  email: string;
  purpose: OtpPurpose;
}) {
  // Invalidate prior unused challenges for this purpose
  await prisma.otpChallenge.updateMany({
    where: {
      userId,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date() },
  });

  const code = generateCode();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const challenge = await prisma.otpChallenge.create({
    data: {
      userId,
      email,
      purpose,
      codeHash: hashValue(code),
      tokenHash: hashValue(token),
      expiresAt,
    },
  });

  const verifyUrl = `${appBaseUrl()}/verify-otp?token=${token}&purpose=${purpose}`;

  await sendOtpEmail({
    to: email,
    code,
    verifyUrl,
    purposeLabel: PURPOSE_LABELS[purpose],
  });

  return {
    challengeId: challenge.id,
    expiresAt,
  };
}

export async function verifyOtpCode({
  userId,
  purpose,
  code,
}: {
  userId: string;
  purpose: OtpPurpose;
  code: string;
}) {
  const normalized = normalizeCode(code);
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false as const, error: "Enter the 6-digit code from your email." };
  }

  const codeHash = hashValue(normalized);

  // Match by exact code hash first (more reliable than "latest unused")
  const byCode = await prisma.otpChallenge.findFirst({
    where: {
      userId,
      purpose,
      codeHash,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (byCode) {
    if (byCode.consumedAt) {
      return {
        ok: false as const,
        error: "This code was already used. Request a new one.",
      };
    }
    if (byCode.attempts >= MAX_ATTEMPTS) {
      await prisma.otpChallenge.update({
        where: { id: byCode.id },
        data: { consumedAt: new Date() },
      });
      return { ok: false as const, error: "Too many attempts. Request a new code." };
    }

    await prisma.otpChallenge.update({
      where: { id: byCode.id },
      data: { consumedAt: new Date() },
    });

    return { ok: true as const, challenge: byCode };
  }

  // Wrong code — bump attempts on latest open challenge if any
  const latest = await prisma.otpChallenge.findFirst({
    where: {
      userId,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return {
      ok: false as const,
      error: "No valid verification code found. Request a new one.",
    };
  }

  await prisma.otpChallenge.update({
    where: { id: latest.id },
    data: { attempts: { increment: 1 } },
  });

  return { ok: false as const, error: "Invalid verification code." };
}

/**
 * Resolve a magic-link token without consuming it.
 * Consumption happens only after the action succeeds (and only on explicit confirm).
 */
export async function peekOtpToken({
  token,
  purpose,
}: {
  token: string;
  purpose: OtpPurpose;
}) {
  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      tokenHash: hashValue(token),
      purpose,
      expiresAt: { gt: new Date() },
    },
  });

  if (!challenge) {
    return { ok: false as const, error: "This verification link is invalid or expired." };
  }
  if (challenge.consumedAt) {
    return { ok: false as const, error: "This verification link was already used." };
  }

  return { ok: true as const, challenge };
}

export async function consumeOtpChallenge(challengeId: string) {
  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { consumedAt: new Date() },
  });
}

export async function verifyOtpToken({
  token,
  purpose,
}: {
  token: string;
  purpose: OtpPurpose;
}) {
  const peeked = await peekOtpToken({ token, purpose });
  if (!peeked.ok) return peeked;

  await consumeOtpChallenge(peeked.challenge.id);
  return peeked;
}
