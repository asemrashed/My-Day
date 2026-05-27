"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckSquare,
  Calendar,
  CreditCard,
  User,
  HandCoins,
  Target,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import thryveLogo from "@/app/thryve.png";

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved) setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
    document.documentElement.classList.toggle("sidebar-collapsed", collapsed);
  }, [collapsed]);

  useEffect(() => {
    return () => document.documentElement.classList.remove("sidebar-collapsed");
  }, []);

  const navItems = [
    { label: "Dashboard", href: "/", icon: Home },
    { label: "Tasks", href: "/tasks", icon: CheckSquare },
    { label: "Schedule", href: "/schedule", icon: Calendar },
    { label: "Expenses", href: "/expenses", icon: CreditCard },
    { label: "Profile", href: "/profile", icon: User },
    { label: "Goals", href: "/goals", icon: Target },
    { label: "Notes", href: "/notes", icon: FileText },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 bg-slate-900 border-r border-slate-800 p-4 text-slate-300 transition-all duration-200 flex flex-col ${
        collapsed ? "w-20" : "w-64"
      }`}
      style={{ background: "rgba(6, 11, 18, 0.94)" }}
    >
      <div className="flex items-center gap-3 mb-6 px-2">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center overflow-hidden bg-primary/10 shadow-lg shadow-primary/25">
          <Image src={thryveLogo} alt="ThryveUp logo" className="h-full w-full object-cover" priority />
        </div>
        {!collapsed && <span className="text-xl font-bold tracking-tight text-white">ThryveUp</span>}
        <button
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded hover:bg-white/5 text-slate-400 hover:text-primary"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all group ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-primary/10 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.22)]"
                  : "hover:bg-slate-800/60 hover:text-slate-100"
              }`}
            >
              <span
                className={`absolute left-0 h-6 w-1 rounded-r-full bg-primary transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <div className="flex items-center justify-center">
                <Icon className="h-5 w-5" />
              </div>
              {!collapsed && <span className="font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={`mt-auto pt-4 border-t border-slate-800/60 flex items-center gap-3 ${collapsed ? "flex-col" : ""}`}>
        <div className={`flex items-center gap-3 min-w-0 ${collapsed ? "justify-center" : "flex-1"}`}>
          {user.image ? (
            <img src={user.image} alt={user.name || "User Avatar"} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white uppercase">
              {user.name ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "US"}
            </div>
          )}

          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-slate-100 truncate">{user.name || "Anonymous"}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-rose-950/30 hover:text-rose-400"
          title="Log out"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
