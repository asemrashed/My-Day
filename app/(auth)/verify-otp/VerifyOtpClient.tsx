"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyOtpLinkAction } from "@/app/actions/security";
import type { OtpPurpose } from "@/lib/otp";
import { friendlyError } from "@/lib/errors";
import toast from "react-hot-toast";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const VALID_PURPOSES: OtpPurpose[] = [
  "LOGIN_2FA",
  "ENABLE_2FA",
  "DISABLE_2FA",
  "CHANGE_PASSWORD",
  "DELETE_ACCOUNT",
];

export default function VerifyOtpClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"ready" | "working" | "error" | "done">("ready");
  const [message, setMessage] = useState(
    "Click confirm to finish verification. This protects your code from email link scanners."
  );
  const [pending, startTransition] = useTransition();

  const token = searchParams.get("token");
  const purpose = searchParams.get("purpose") as OtpPurpose | null;
  const valid = !!(token && purpose && VALID_PURPOSES.includes(purpose));

  function onConfirm() {
    if (!token || !purpose || !valid) {
      setStatus("error");
      setMessage("This verification link is invalid.");
      return;
    }

    startTransition(async () => {
      setStatus("working");
      setMessage("Verifying…");
      try {
        const res = await verifyOtpLinkAction(token, purpose);
        if (res.error) {
          setStatus("error");
          setMessage(res.error);
          toast.error(res.error);
          return;
        }

        setStatus("done");
        const successMsg =
          typeof res.success === "string" ? res.success : "Verified successfully.";
        setMessage(successMsg);
        toast.success(successMsg);

        const redirectTo =
          (res as { redirectTo?: string }).redirectTo ||
          (purpose === "LOGIN_2FA" ? "/" : "/profile");
        setTimeout(() => router.push(redirectTo), 800);
      } catch (err: any) {
        if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith?.("NEXT_REDIRECT")) {
          return;
        }
        setStatus("error");
        const msg = friendlyError(err, "Verification failed. Please try again.");
        setMessage(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="app-card w-full max-w-md p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold">ThryveUp Verification</h1>
        <p className="text-sm text-muted-foreground">{message}</p>

        {!valid && status === "ready" && (
          <>
            <p className="text-sm text-rose-400">This verification link is invalid.</p>
            <Link href="/login" className="app-link-primary inline-block mt-2">
              Back to sign in
            </Link>
          </>
        )}

        {valid && status === "ready" && (
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="app-button-primary w-full py-3"
          >
            Confirm verification
          </button>
        )}

        {status === "working" && (
          <div className="mx-auto h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}

        {status === "error" && (
          <div className="space-y-2">
            <Link href="/profile" className="app-link-primary inline-block">
              Back to profile
            </Link>
            <div>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
                Or sign in again
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
