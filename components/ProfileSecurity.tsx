"use client";

import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { useRouter, useSearchParams } from "next/navigation";
import FormModal from "@/components/FormModal";
import {
  requestPasswordChangeOtpAction,
  verifyPasswordChangeOtpAction,
  setNewPasswordAction,
  confirmDisable2FAAction,
  confirmEnable2FAAction,
  deleteAccountAction,
  getConnectedDevicesAction,
  revokeDeviceAction,
  sendSecurityOtpAction,
} from "@/app/actions/security";
import { friendlyError } from "@/lib/errors";
import { signOut } from "next-auth/react";
import { Monitor, Shield, ShieldOff, Trash2, KeyRound, LogOut } from "lucide-react";

type Modal = null | "password" | "2fa" | "devices" | "delete";
type PasswordStep = "send" | "otp" | "password";

type Device = {
  id: string;
  sessionId: string;
  label: string;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
};

export default function ProfileSecurity({
  twoFactorEnabled,
  email,
}: {
  hasPassword?: boolean;
  twoFactorEnabled: boolean;
  email: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<Modal>(null);
  const [pending, startTransition] = useTransition();
  const [otpSent, setOtpSent] = useState(false);
  const [passwordStep, setPasswordStep] = useState<PasswordStep>("send");
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesHint, setDevicesHint] = useState<string | undefined>();
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    if (searchParams.get("setPassword") === "1") {
      setModal("password");
      setPasswordStep("password");
      toast.success("Email verified. Set your new password.");
      router.replace("/profile");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (modal !== "devices") return;
    setLoadingDevices(true);
    setDevicesError(null);
    getConnectedDevicesAction()
      .then((res) => {
        if (res.error) {
          setDevicesError(res.error);
          toast.error(res.error);
        }
        setDevices(res.devices || []);
        setDevicesHint(res.hint);
      })
      .catch((err) => {
        const msg = friendlyError(err, "Could not load connected devices.");
        setDevicesError(msg);
        toast.error(msg);
      })
      .finally(() => setLoadingDevices(false));
  }, [modal]);

  useEffect(() => {
    if (!modal) {
      setOtpSent(false);
      setPasswordStep("send");
    }
  }, [modal]);

  function close() {
    setModal(null);
  }

  function showActionError(err: unknown, fallback: string) {
    toast.error(friendlyError(err, fallback));
  }

  function onSendPasswordOtp() {
    startTransition(async () => {
      try {
        const res = await requestPasswordChangeOtpAction();
        if (res.error) {
          toast.error(res.error);
          return;
        }
        setPasswordStep("otp");
        toast.success(res.success || "Verification code sent");
      } catch (err) {
        showActionError(err, "Could not send verification email.");
      }
    });
  }

  function onVerifyPasswordOtp(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await verifyPasswordChangeOtpAction(formData);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        setPasswordStep("password");
        toast.success(res.success || "Code verified");
      } catch (err) {
        showActionError(err, "Could not verify the code.");
      }
    });
  }

  function onSetNewPassword(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await setNewPasswordAction(formData);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(res.success || "Password updated");
        close();
        router.refresh();
      } catch (err) {
        showActionError(err, "Could not update password.");
      }
    });
  }

  function sendOtp(purpose: "ENABLE_2FA" | "DISABLE_2FA" | "DELETE_ACCOUNT") {
    startTransition(async () => {
      try {
        const res = await sendSecurityOtpAction(purpose);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        setOtpSent(true);
        toast.success(res.success || "Code sent");
      } catch (err) {
        showActionError(err, "Could not send verification email.");
      }
    });
  }

  function onEnable2FA(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await confirmEnable2FAAction(formData);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(res.success || "2FA enabled");
        close();
        router.refresh();
      } catch (err) {
        showActionError(err, "Could not enable two-factor authentication.");
      }
    });
  }

  function onDisable2FA(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await confirmDisable2FAAction(formData);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(res.success || "2FA disabled");
        close();
        router.refresh();
      } catch (err) {
        showActionError(err, "Could not disable two-factor authentication.");
      }
    });
  }

  function onDeleteAccount(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await deleteAccountAction(formData);
        if (res?.error) {
          toast.error(res.error);
        }
      } catch (err) {
        showActionError(err, "Could not delete account.");
      }
    });
  }

  function onRevoke(sessionId: string) {
    startTransition(async () => {
      try {
        const res = await revokeDeviceAction(sessionId);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(res.success || "Device signed out");
        const refreshed = await getConnectedDevicesAction();
        setDevices(refreshed.devices || []);
        setDevicesHint(refreshed.hint);
      } catch (err) {
        showActionError(err, "Could not revoke that device.");
      }
    });
  }

  return (
    <>
      <div className="app-card p-8">
        <h3 className="font-semibold text-card-foreground flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          Security & Preferences
        </h3>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setModal("password")}
            className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all active:scale-[0.98] flex items-center justify-between group"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Change Password
            </span>
            <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
          </button>

          <button
            type="button"
            onClick={() => setModal("2fa")}
            className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all active:scale-[0.98] flex items-center justify-between group"
          >
            <span className="flex items-center gap-2">
              {twoFactorEnabled ? (
                <Shield className="h-4 w-4 text-emerald-500" />
              ) : (
                <ShieldOff className="h-4 w-4 text-muted-foreground" />
              )}
              Two-Factor Authentication
              <span
                className={`text-xs px-2 py-0.5 rounded-md ${
                  twoFactorEnabled
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {twoFactorEnabled ? "On" : "Off"}
              </span>
            </span>
            <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
          </button>

          <button
            type="button"
            onClick={() => setModal("devices")}
            className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all active:scale-[0.98] flex items-center justify-between group"
          >
            <span className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              Connected Devices
            </span>
            <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
          </button>
        </div>
      </div>

      <div className="app-card p-8 border-destructive/30">
        <h3 className="font-semibold text-rose-400 flex items-center gap-2 mb-6">
          <LogOut className="h-5 w-5" />
          Danger Zone
        </h3>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all active:scale-[0.98] flex items-center justify-between group"
          >
            <span>Sign Out</span>
            <LogOut className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => setModal("delete")}
            className="w-full px-4 py-3 rounded-xl border border-rose-700/50 hover:bg-rose-950/30 text-rose-400 font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Deleting your account is permanent and cannot be undone. All your data will be erased.
        </p>
      </div>

      <FormModal open={modal === "password"} onClose={close} title="Change Password" maxWidth="md">
        {passwordStep === "send" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We’ll send a one-time code (and a link) to{" "}
              <span className="font-medium text-foreground">{email}</span>. After you verify it, you can
              set a new password — no current password needed.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={onSendPasswordOtp}
              className="app-button-primary w-full py-3"
            >
              {pending ? "Sending code..." : "Send verification code"}
            </button>
          </div>
        )}

        {passwordStep === "otp" && (
          <form action={onVerifyPasswordOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>.
              Prefer the code over the email link if both are available.
            </p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Verification Code
              </label>
              <input
                type="text"
                name="code"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                className="app-input py-3 tracking-[0.35em] text-center text-lg"
                placeholder="000000"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="app-button-primary flex-1 py-3">
                {pending ? "Verifying..." : "Verify code"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onSendPasswordOtp}
                className="px-4 py-3 rounded-xl border border-border hover:bg-muted text-sm font-medium"
              >
                Resend
              </button>
            </div>
          </form>
        )}

        {passwordStep === "password" && (
          <form action={onSetNewPassword} className="space-y-4">
            <p className="text-sm text-muted-foreground">Email verified. Create your new password.</p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                required
                minLength={6}
                className="app-input py-3"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={6}
                className="app-input py-3"
                placeholder="Repeat new password"
              />
            </div>
            <button type="submit" disabled={pending} className="app-button-primary w-full py-3">
              {pending ? "Saving..." : "Update password"}
            </button>
          </form>
        )}
      </FormModal>

      <FormModal
        open={modal === "2fa"}
        onClose={close}
        title="Two-Factor Authentication"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {twoFactorEnabled
              ? "Email OTP confirmation is on for sensitive security actions (like turning this off). Sign-in still only needs your password."
              : "Use email OTP when changing security settings. This does not ask for a code every time you sign in."}
          </p>
          <p className="text-sm text-foreground">
            Email: <span className="font-medium">{email}</span>
          </p>

          {!otpSent ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => sendOtp(twoFactorEnabled ? "DISABLE_2FA" : "ENABLE_2FA")}
              className="app-button-primary w-full py-3"
            >
              {pending
                ? "Sending..."
                : twoFactorEnabled
                  ? "Send disable code"
                  : "Send enable code"}
            </button>
          ) : (
            <form
              action={twoFactorEnabled ? onDisable2FA : onEnable2FA}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Verification Code
                </label>
                <input
                  type="text"
                  name="code"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="app-input py-3 tracking-[0.35em] text-center text-lg"
                  placeholder="000000"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the latest 6-digit code from your email. If you opened the email link already,
                request a new code.
              </p>
              <div className="flex gap-2">
                <button type="submit" disabled={pending} className="app-button-primary flex-1 py-3">
                  {pending ? "Verifying..." : twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => sendOtp(twoFactorEnabled ? "DISABLE_2FA" : "ENABLE_2FA")}
                  className="px-4 py-3 rounded-xl border border-border hover:bg-muted text-sm font-medium"
                >
                  Resend
                </button>
              </div>
            </form>
          )}
        </div>
      </FormModal>

      <FormModal open={modal === "devices"} onClose={close} title="Connected Devices" maxWidth="md">
        <div className="space-y-3">
          {loadingDevices ? (
            <p className="text-sm text-muted-foreground">Loading devices...</p>
          ) : devicesError ? (
            <p className="text-sm text-rose-400">{devicesError}</p>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active devices yet. Sign out and sign back in on each device to list them here.
            </p>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="font-medium text-foreground flex items-center gap-2">
                    {device.label}
                    {device.isCurrent && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-primary/15 text-primary">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last active {new Date(device.lastSeenAt).toLocaleString()}
                    {device.ipAddress ? ` · ${device.ipAddress}` : ""}
                  </p>
                </div>
                {!device.isCurrent && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onRevoke(device.sessionId)}
                    className="text-sm text-rose-400 hover:text-rose-300 font-medium shrink-0"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          )}
          {devicesHint && !devicesError && (
            <p className="text-xs text-muted-foreground pt-1">{devicesHint}</p>
          )}
        </div>
      </FormModal>

      <FormModal open={modal === "delete"} onClose={close} title="Delete Account" maxWidth="md">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This permanently deletes your ThryveUp account and all data. We’ll email a verification
            code and link to <span className="font-medium text-foreground">{email}</span>.
          </p>

          {!otpSent ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => sendOtp("DELETE_ACCOUNT")}
              className="w-full py-3 rounded-xl border border-rose-700/50 hover:bg-rose-950/30 text-rose-400 font-medium"
            >
              {pending ? "Sending..." : "Send verification code"}
            </button>
          ) : (
            <form action={onDeleteAccount} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Verification Code
                </label>
                <input
                  type="text"
                  name="code"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="app-input py-3 tracking-[0.35em] text-center text-lg"
                  placeholder="000000"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  name="confirmText"
                  required
                  className="app-input py-3"
                  placeholder="DELETE"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium"
              >
                {pending ? "Deleting..." : "Permanently delete account"}
              </button>
            </form>
          )}
        </div>
      </FormModal>
    </>
  );
}
