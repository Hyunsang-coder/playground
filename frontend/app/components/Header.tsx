"use client";

import { ShieldCheck } from "lucide-react";

export default function Header() {
  return (
    <header className="flex flex-col items-center gap-2 sm:gap-3 pt-8 sm:pt-12 pb-4 sm:pb-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <ShieldCheck className="h-8 w-8 sm:h-10 sm:w-10 text-brand" />
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
          Valid<span className="text-brand">8</span>
        </h1>
      </div>
      <p className="text-base sm:text-lg text-slate-500 text-center">
        바이브코딩 실현성을 냉정하게 분석합니다
      </p>
    </header>
  );
}
