"use client";

import { useEffect } from "react";
import {
  applyResolvedTheme,
  clearLegacyThemeOverride,
  getThemePreference,
  getSystemTheme,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";

/** Applies theme everywhere (dashboard, login, register). Default: device. */
export default function ThemeSync() {
  useEffect(() => {
    clearLegacyThemeOverride();
    applyResolvedTheme(resolveTheme());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (getThemePreference() === "system") {
        applyResolvedTheme(getSystemTheme());
      }
    };
    const onPrefChange = (event: Event) => {
      const preference = (event as CustomEvent<ThemePreference>).detail;
      applyResolvedTheme(resolveTheme(preference ?? getThemePreference()));
    };

    media.addEventListener("change", onSystemChange);
    window.addEventListener("thryveup-theme-change", onPrefChange);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("thryveup-theme-change", onPrefChange);
    };
  }, []);

  return null;
}
