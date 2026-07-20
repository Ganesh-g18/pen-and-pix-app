import { useEffect } from "react";
import { useStore } from "@/lib/store";

/**
 * Applies live UI settings (accent color, density, corner radius, toolbar size,
 * font size, animations, glass) to the document root via CSS variables and
 * data attributes so they take effect instantly across the app without reload.
 */
export function useLiveSettings() {
  const settings = useStore((s) => s.settings);
  const theme = useStore((s) => s.theme);
  const themeMode = settings.themeMode;

  // Theme (light / dark / system)
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
    apply(themeMode === "dark" ? "dark" : (themeMode === "light" ? "light" : theme));
  }, [themeMode, theme]);

  // Live style tokens
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-user", settings.accentColor);

    // Density → density scale multiplier used by paper templates and spacing.
    const densityScale = settings.density === "compact" ? 0.85 : settings.density === "spacious" ? 1.15 : 1;
    root.style.setProperty("--density-scale", String(densityScale));

    // Font size baseline
    const fs = settings.fontSize === "sm" ? "14px" : settings.fontSize === "lg" ? "17px" : "15px";
    root.style.setProperty("--app-font-size", fs);

    // Corner radius (optional new setting; falls back to 1rem).
    const radius = (settings as unknown as { cornerRadius?: number }).cornerRadius ?? 16;
    root.style.setProperty("--radius", `${radius}px`);

    // Toolbar scale (optional new setting; 1 = default).
    const toolbarScale = (settings as unknown as { toolbarSize?: number }).toolbarSize ?? 1;
    root.style.setProperty("--toolbar-scale", String(toolbarScale));

    root.dataset.density = settings.density;
    root.dataset.animations = String(settings.animations);
    root.dataset.glass = String(settings.glassmorphism);
    root.dataset.fontSize = settings.fontSize;
  }, [
    settings.accentColor,
    settings.density,
    settings.fontSize,
    settings.animations,
    settings.glassmorphism,
    // Safely re-run if user later adds these fields.
    (settings as unknown as { cornerRadius?: number }).cornerRadius,
    (settings as unknown as { toolbarSize?: number }).toolbarSize,
  ]);
}
