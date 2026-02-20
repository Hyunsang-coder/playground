"use client";

import { useState } from "react";
import { ShieldCheck, Palette } from "lucide-react";
import { useTheme, THEMES } from "./ThemeProvider";

export default function Header() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = THEMES.find((t) => t.id === theme)!;

  return (
    <header className="flex flex-col items-center gap-2 sm:gap-3 pt-8 sm:pt-12 pb-4 sm:pb-6 relative">
      {/* 팔레트 버튼 — 우상단 */}
      <div className="absolute right-0 top-8 sm:top-12">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:shadow"
          title="컬러 테마 변경"
        >
          <Palette className="h-3.5 w-3.5" />
          <span
            className="h-3 w-3 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: current.color }}
          />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-20 mt-1.5 w-36 rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                >
                  <span
                    className="h-4 w-4 rounded-full border-2 border-white shadow"
                    style={{
                      backgroundColor: t.color,
                      outline: theme === t.id ? `2px solid ${t.color}` : "none",
                      outlineOffset: "1px",
                    }}
                  />
                  <span className={theme === t.id ? "font-bold text-slate-800" : "text-slate-500"}>
                    {t.name}
                  </span>
                  {theme === t.id && (
                    <span className="ml-auto text-[10px] font-bold" style={{ color: t.color }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 로고 */}
      <div className="flex items-center gap-2 sm:gap-3">
        <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10 text-brand" />
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
          Valid<span className="text-brand">8</span>
        </h1>
      </div>
      <p className="text-base sm:text-lg text-slate-500 text-center">
        바닥부터 짜지 마세요. 바이브코딩 실현성과 동일 오픈 소스를 냉정하게 찾아냅니다.
      </p>
    </header>
  );
}
