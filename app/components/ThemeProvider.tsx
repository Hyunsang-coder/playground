"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type ThemeId = "hackathon" | "indigo" | "cyber" | "hacker" | "slate";

export const THEMES: { id: ThemeId; name: string; color: string }[] = [
  { id: "hackathon", name: "오렌지", color: "#f97316" },
  { id: "indigo",    name: "인디고", color: "#6366f1" },
  { id: "cyber",     name: "블루",   color: "#0ea5e9" },
  { id: "hacker",    name: "그린",   color: "#22c55e" },
  { id: "slate",     name: "슬레이트", color: "#334155" },
];

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}>({ theme: "hackathon", setTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("hackathon");

  useEffect(() => {
    const saved = localStorage.getItem("v8-theme") as ThemeId | null;
    if (saved && THEMES.some((t) => t.id === saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    localStorage.setItem("v8-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
