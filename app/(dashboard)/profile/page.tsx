import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Mail, User, Calendar, Shield, Palette } from "lucide-react";
import ProfileSecurity from "@/components/ProfileSecurity";
import ThemePreferenceSelect from "@/components/ThemePreferenceSelect";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { accounts: { select: { provider: true } } },
  });

  if (!user) {
    redirect("/login");
  }

  const userInitials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "US";

  const joinDate = user.createdAt?.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const providers = user.accounts.map((a) => a.provider);
  const accountType = user.passwordHash
    ? providers.includes("google")
      ? "Email & Google"
      : "Email & Password"
    : providers.includes("google")
      ? "Google"
      : "Email & Password";

  return (
    <div className="space-y-8 pb-10 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/" className="app-icon-button">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="app-page-title">Account Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>
      </div>

      <div className="app-card p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
          <div className="flex-shrink-0">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name || "User Avatar"}
                className="h-20 w-20 rounded-2xl border-2 border-primary/30 object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground border-2 border-primary/30">
                {userInitials}
              </div>
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-card-foreground">{user.name || "Anonymous User"}</h2>
            <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Member since {joinDate}
            </div>
          </div>
        </div>

        <div className="border-t border-border my-6"></div>

        <div className="space-y-4 mb-8">
          <h3 className="font-semibold text-card-foreground flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-primary" />
            Preferences
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ThemePreferenceSelect />
          </div>
        </div>

        <div className="border-t border-border my-6"></div>

        <div className="space-y-4">
          <h3 className="font-semibold text-card-foreground flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            Account Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="app-panel p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Full Name
              </label>
              <p className="text-foreground font-medium">{user.name || "Not set"}</p>
            </div>

            <div className="app-panel p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </label>
              <p className="text-foreground font-medium break-all">{user.email}</p>
            </div>

            <div className="app-panel p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Account Type
              </label>
              <p className="text-foreground font-medium">{accountType}</p>
            </div>

            <div className="app-panel p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Member Since
              </label>
              <p className="text-foreground font-medium">{joinDate}</p>
            </div>
          </div>
        </div>
      </div>

      <Suspense fallback={<div className="app-card p-8 text-sm text-muted-foreground">Loading security settings…</div>}>
        <ProfileSecurity
          twoFactorEnabled={user.twoFactorEnabled}
          email={user.email || ""}
        />
      </Suspense>
    </div>
  );
}
