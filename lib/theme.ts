export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCE_KEY = "theme-preference";
/** Legacy key from the header toggle — blocked device theme when set. */
export const LEGACY_THEME_KEY = "theme";

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function clearLegacyThemeOverride() {
  try {
    localStorage.removeItem(LEGACY_THEME_KEY);
  } catch {
    /* ignore */
  }
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "system";
}

export function resolveTheme(preference: ThemePreference = getThemePreference()): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  return getSystemTheme();
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function setThemePreference(preference: ThemePreference) {
  clearLegacyThemeOverride();
  localStorage.setItem(THEME_PREFERENCE_KEY, preference);
  applyResolvedTheme(resolveTheme(preference));
  window.dispatchEvent(new CustomEvent("thryveup-theme-change", { detail: preference }));
}
