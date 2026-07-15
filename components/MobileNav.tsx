"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Calendar,
  CheckSquare,
  CreditCard,
  FileText,
  Home,
  LogOut,
  Menu,
  Target,
  User,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: Home },
  { label: "Expenses", href: "/expenses", icon: CreditCard },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Notes", href: "/notes", icon: FileText },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Schedule", href: "/schedule", icon: Calendar },
  { label: "Profile", href: "/profile", icon: User },
];

export default function MobileNav() {
  const pathname = usePathname() || "/";
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [menuTop, setMenuTop] = useState(72);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateMenuTop = () => {
      const header = document.querySelector(".app-header");
      if (header instanceof HTMLElement) {
        setMenuTop(header.getBoundingClientRect().bottom);
      }
    };

    updateMenuTop();
    window.addEventListener("resize", updateMenuTop);
    window.addEventListener("scroll", updateMenuTop, { passive: true });

    return () => {
      window.removeEventListener("resize", updateMenuTop);
      window.removeEventListener("scroll", updateMenuTop);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      return;
    }

    if (!isRendered) return;

    const timeout = window.setTimeout(() => setIsRendered(false), 220);
    return () => window.clearTimeout(timeout);
  }, [isOpen, isRendered]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="md:hidden" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="app-icon-button"
        title={isOpen ? "Close menu" : "Open menu"}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isRendered && (
        <div
          id="mobile-nav-menu"
          style={{ top: menuTop }}
          className={`fixed inset-x-0 z-50 origin-top overflow-hidden border-b border-border bg-background shadow-xl will-change-transform transition-[transform,opacity,max-height] duration-200 ease-out ${
            isOpen
              ? "pointer-events-auto max-h-[55vh] translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-3 opacity-0"
          }`}
        >
          <nav className="flex h-[55vh] flex-col justify-center gap-1 overflow-y-auto px-4 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted hover:text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center justify-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-rose-300"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign out</span>
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
