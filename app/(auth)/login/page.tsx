"use client";

import { useFormState, useFormStatus } from "react-dom";
import { beginLoginAction } from "@/app/actions/security";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, ArrowRight } from "lucide-react";
import thryveLogo from "@/app/thryve.png";
import { friendlyError } from "@/lib/errors";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="app-button-primary w-full flex items-center justify-center gap-2 py-3 px-4"
    >
      {pending ? (
        <span className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
      ) : (
        <>
          {label}
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}

export default function LoginPage() {
  const [callbackUrl, setCallbackUrl] = useState("/");
  const [errorParam, setErrorParam] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(params.get("callbackUrl") || "/");
    setErrorParam(params.get("error"));
  }, []);

  const [loginState, loginAction] = useFormState(beginLoginAction, null);

  useEffect(() => {
    if (errorParam) {
      if (errorParam === "OAuthAccountNotLinked") {
        toast.error("This email is already linked to a different sign-in method.");
      } else if (errorParam === "Callback" || errorParam === "CallbackRouteError") {
        toast.error("Sign-in could not be completed. Please try again.");
      } else {
        toast.error(friendlyError(errorParam, "Authentication failed. Please try again."));
      }
    }
  }, [errorParam]);

  useEffect(() => {
    if (loginState?.error) {
      toast.error(friendlyError(loginState.error, "Sign-in failed. Please try again."));
    }
    if (loginState?.success) {
      toast.success("Successfully logged in!");
      router.push(callbackUrl);
    }
  }, [loginState, router, callbackUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="app-card w-full max-w-md p-8 relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center mb-8 relative">
          <div className="mx-auto mb-4 h-14 w-14 overflow-hidden rounded-2xl bg-primary/10 shadow-lg shadow-primary/25">
            <Image src={thryveLogo} alt="ThryveUp logo" className="h-full w-full object-cover" priority />
          </div>
          <h1 className="app-page-title">Welcome to ThryveUp</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sign in to access your planner and dashboard
          </p>
        </div>

        <form action={loginAction} className="space-y-5 relative">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="email"
                name="email"
                required
                placeholder="rahim@gmail.com"
                className="app-input pl-11 pr-4 py-3"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Password
              </label>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="app-input pl-11 pr-4 py-3"
              />
            </div>
          </div>

          <SubmitButton label="Sign In" />
        </form>

        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-border w-full"></div>
          <span className="bg-card px-3 text-xs text-muted-foreground uppercase tracking-wider absolute">
            Or continue with
          </span>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-muted/60 border border-border hover:bg-muted text-foreground font-medium active:scale-[0.98] transition-all"
        >
          <span className="text-lg">🔵</span>
          Google OAuth
        </button>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          New to ThryveUp?{" "}
          <Link href="/register" className="app-link-primary">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
