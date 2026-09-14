import { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  darkMode: boolean;
  reducedMotion: boolean;
  toggleDarkMode: () => void;
  toggleReducedMotion: () => void;
  setDarkMode: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    return localStorage.getItem("fitsync-dark") === "true";
  });
  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
    return localStorage.getItem("fitsync-reduced-motion") === "true";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("fitsync-dark", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) root.classList.add("reduce-motion");
    else root.classList.remove("reduce-motion");
    localStorage.setItem("fitsync-reduced-motion", String(reducedMotion));
  }, [reducedMotion]);

  const value: ThemeContextValue = {
    darkMode,
    reducedMotion,
    toggleDarkMode: () => setDarkModeState((p) => !p),
    toggleReducedMotion: () => setReducedMotionState((p) => !p),
    setDarkMode: setDarkModeState,
    setReducedMotion: setReducedMotionState,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
