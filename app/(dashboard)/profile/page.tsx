import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, User, Calendar, LogOut, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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

  return (
    <div className="space-y-8 pb-10 max-w-4xl">
      {/* Back Button & Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="app-icon-button"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="app-page-title">
            Account Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your profile and preferences</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="app-card p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8">
          {/* Avatar */}
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

          {/* User Basic Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-card-foreground">{user.name || "Anonymous User"}</h2>
            <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Member since {joinDate}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-6"></div>

        {/* Account Details */}
        <div className="space-y-4">
          <h3 className="font-semibold text-card-foreground flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            Account Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="app-panel p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Full Name
              </label>
              <p className="text-foreground font-medium">{user.name || "Not set"}</p>
            </div>

            {/* Email */}
            <div className="app-panel p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Address
              </label>
              <p className="text-foreground font-medium break-all">{user.email}</p>
            </div>

            {/* Account Type */}
            <div className="app-panel p-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Account Type
              </label>
              <p className="text-foreground font-medium">Email & Password</p>
            </div>

            {/* Joined Date */}
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

      {/* Security & Preferences Card */}
      <div className="app-card p-8">
        <h3 className="font-semibold text-card-foreground flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-primary" />
          Security & Preferences
        </h3>

        <div className="space-y-3">
          {/* Change Password */}
          <button className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all active:scale-[0.98] flex items-center justify-between group">
            <span>Change Password</span>
            <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
          </button>

          {/* Two-Factor Authentication */}
          <button className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all active:scale-[0.98] flex items-center justify-between group">
            <span>Two-Factor Authentication</span>
            <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
          </button>

          {/* Connected Devices */}
          <button className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all active:scale-[0.98] flex items-center justify-between group">
            <span>Connected Devices</span>
            <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>
          </button>
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className="app-card p-8 border-destructive/30">
        <h3 className="font-semibold text-rose-400 flex items-center gap-2 mb-6">
          <LogOut className="h-5 w-5" />
          Danger Zone
        </h3>

        <div className="space-y-3">
          {/* Sign Out */}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full px-4 py-3 rounded-xl border border-border hover:bg-muted text-foreground font-medium transition-all active:scale-[0.98] flex items-center justify-between group"
            >
              <span>Sign Out</span>
              <LogOut className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          </form>

          {/* Delete Account */}
          <button className="w-full px-4 py-3 rounded-xl border border-rose-700/50 hover:bg-rose-950/30 text-rose-400 font-medium transition-all active:scale-[0.98]">
            Delete Account
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          ⚠️ Deleting your account is permanent and cannot be undone. All your data will be erased.
        </p>
      </div>
    </div>
  );
}
