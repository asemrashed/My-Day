"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, CheckSquare, CreditCard, HandCoins, Home, User } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Schedule", href: "/schedule", icon: Calendar },
  { label: "Expenses", href: "/expenses", icon: CreditCard },
  { label: "Profile", href: "/profile", icon: User },
];

export default function MobileNav() {
  const pathname = usePathname() || "/";

  return (
    <nav className="glass fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border px-4 py-2 backdrop-blur-xl md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl p-2 text-muted-foreground transition-colors active:scale-90 ${
              active ? "text-primary" : "hover:text-primary"
            }`}
          >
            <span
              className={`absolute -top-2 h-1 w-8 rounded-b-full bg-primary transition-opacity ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
