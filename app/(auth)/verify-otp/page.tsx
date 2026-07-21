import { Suspense } from "react";
import VerifyOtpPage from "./VerifyOtpClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
          <div className="app-card w-full max-w-md p-8 text-center text-sm text-muted-foreground">
            Verifying your secure link...
          </div>
        </div>
      }
    >
      <VerifyOtpPage />
    </Suspense>
  );
}
