import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Applies the resolved theme (light/dark) to <html>.
 * Respects the user's Appearance > Theme selection (light | dark | system).
 */
export function useTheme() {
  const theme = useStore((s) => s.theme);
  const themeMode = useStore((s) => s.settings.themeMode);

  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: "light" | "dark") => {
      if (mode === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };
    if (themeMode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mq.matches ? "dark" : "light");
      const on = (e: MediaQueryListEvent) => apply(e.matches ? "dark" : "light");
      mq.addEventListener?.("change", on);
      return () => mq.removeEventListener?.("change", on);
    }
    apply(themeMode === "dark" ? "dark" : themeMode === "light" ? "light" : theme);
  }, [theme, themeMode]);
}
