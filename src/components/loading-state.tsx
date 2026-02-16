"use client";

import { useEffect, useState } from "react";
import { Database, Brain, FileCheck } from "lucide-react";

const STEPS = [
  { icon: Database, label: "데이터 수집 중", desc: "메타데이터 · 자막 · 댓글 가져오는 중..." },
  { icon: Brain, label: "AI 분석 중", desc: "제목 약속과 실제 내용 대조 중..." },
  { icon: FileCheck, label: "결과 생성 중", desc: "종합 점수 계산 · 리포트 생성 중..." },
];

export default function LoadingState() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 3000);
    const t2 = setTimeout(() => setStep(2), 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto py-16">
      <div className="space-y-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;

          return (
            <div
              key={i}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-500 ${
                isActive
                  ? "bg-[var(--color-surface)] border-red-500/50 shadow-lg shadow-red-500/5"
                  : isDone
                  ? "bg-[var(--color-surface)] border-green-500/30"
                  : "border-[var(--color-border)] opacity-40"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isActive
                    ? "bg-red-500/20 text-red-400"
                    : isDone
                    ? "bg-green-500/20 text-green-400"
                    : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{s.label}</p>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                  {s.desc}
                </p>
              </div>
              {isActive && (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-dot" />
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-dot" style={{ animationDelay: "0.3s" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-dot" style={{ animationDelay: "0.6s" }} />
                </div>
              )}
              {isDone && (
                <span className="text-green-400 text-sm font-medium">완료</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
