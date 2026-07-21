"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof Monitor;
}[] = [
  { value: "system", label: "Use device theme", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export default function ThemePreferenceSelect() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    setPreference(getThemePreference());
  }, []);

  return (
    <div className="app-panel p-4 sm:col-span-2">
      <label
        htmlFor="theme-preference"
        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2"
      >
        Appearance
      </label>
      <div className="relative">
        <select
          id="theme-preference"
          className="app-input appearance-none pr-10"
          value={preference}
          onChange={(e) => {
            const next = e.target.value as ThemePreference;
            setPreference(next);
            setThemePreference(next);
          }}
        >
          {OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {preference === "light" ? (
            <Sun className="h-4 w-4" />
          ) : preference === "dark" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Default follows your device. Choose Light or Dark to override.
      </p>
    </div>
  );
}
