"use client";

import { useState } from "react";
import { ShieldCheck, Search, Loader2, CheckCircle2, Globe, Brain, Gavel, Flame, ArrowLeftRight, GitFork, Skull, Waves } from "lucide-react";

// ── 팔레트 정의 ──────────────────────────────────────────────────

const PALETTES = [
  {
    id: "current",
    name: "현재 (인디고)",
    description: "기본 · 흔함",
    brand: "#6366f1",
    brandHover: "#4f46e5",
    brandLight: "rgba(99,102,241,0.08)",
    brandRing: "rgba(99,102,241,0.15)",
    brandShadow: "rgba(99,102,241,0.25)",
    bgGradient: "radial-gradient(at 15% 0%, rgba(99,102,241,0.06) 0%, transparent 50%), radial-gradient(at 85% 100%, rgba(16,185,129,0.04) 0%, transparent 50%)",
    stepLoadingBg: "#eef2ff",
    tag: "🟣",
  },
  {
    id: "cyber",
    name: "사이버 블루",
    description: "날카롭고 기술적",
    brand: "#0ea5e9",
    brandHover: "#0284c7",
    brandLight: "rgba(14,165,233,0.08)",
    brandRing: "rgba(14,165,233,0.15)",
    brandShadow: "rgba(14,165,233,0.25)",
    bgGradient: "radial-gradient(at 15% 0%, rgba(14,165,233,0.06) 0%, transparent 50%), radial-gradient(at 85% 100%, rgba(16,185,129,0.04) 0%, transparent 50%)",
    stepLoadingBg: "#f0f9ff",
    tag: "🔵",
  },
  {
    id: "hacker",
    name: "해커 그린",
    description: "터미널 · 개발자",
    brand: "#22c55e",
    brandHover: "#16a34a",
    brandLight: "rgba(34,197,94,0.08)",
    brandRing: "rgba(34,197,94,0.15)",
    brandShadow: "rgba(34,197,94,0.25)",
    bgGradient: "radial-gradient(at 15% 0%, rgba(34,197,94,0.05) 0%, transparent 50%), radial-gradient(at 85% 100%, rgba(34,197,94,0.03) 0%, transparent 50%)",
    stepLoadingBg: "#f0fdf4",
    tag: "🟢",
  },
  {
    id: "hackathon",
    name: "핵 오렌지",
    description: "에너지 · 해커톤",
    brand: "#f97316",
    brandHover: "#ea580c",
    brandLight: "rgba(249,115,22,0.08)",
    brandRing: "rgba(249,115,22,0.15)",
    brandShadow: "rgba(249,115,22,0.25)",
    bgGradient: "radial-gradient(at 15% 0%, rgba(249,115,22,0.05) 0%, transparent 50%), radial-gradient(at 85% 100%, rgba(16,185,129,0.04) 0%, transparent 50%)",
    stepLoadingBg: "#fff7ed",
    tag: "🟠",
  },
  {
    id: "dark",
    name: "다크 슬레이트",
    description: "미니멀 · 판정 강조",
    brand: "#334155",
    brandHover: "#1e293b",
    brandLight: "rgba(51,65,85,0.06)",
    brandRing: "rgba(51,65,85,0.12)",
    brandShadow: "rgba(51,65,85,0.2)",
    bgGradient: "radial-gradient(at 15% 0%, rgba(51,65,85,0.05) 0%, transparent 50%), radial-gradient(at 85% 100%, rgba(16,185,129,0.03) 0%, transparent 50%)",
    stepLoadingBg: "#f8fafc",
    tag: "⚫",
  },
] as const;

type Palette = typeof PALETTES[number];

// ── 미니 컴포넌트들 ──────────────────────────────────────────────

function MiniHeader({ p }: { p: Palette }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-5 px-6 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-7 w-7" style={{ color: p.brand }} />
        <span className="text-2xl font-black tracking-tight text-slate-900">
          Valid<span style={{ color: p.brand }}>8</span>
        </span>
      </div>
      <p className="text-xs text-slate-400 text-center">바이브코딩 실현성을 냉정하게 분석합니다</p>
    </div>
  );
}

function MiniInput({ p }: { p: Palette }) {
  return (
    <div className="px-5 py-4 space-y-3">
      <div
        className="w-full rounded-xl border-2 px-4 py-3 text-sm text-slate-400 bg-white"
        style={{ borderColor: p.brand + "60" }}
      >
        아이디어를 입력하세요...
        <div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: `0 0 0 3px ${p.brandRing}` }}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        {["마크다운 이력서", "PR 리뷰 봇"].map((ex) => (
          <span
            key={ex}
            className="rounded-full border px-2.5 py-0.5 text-xs text-slate-500"
            style={{ borderColor: p.brand + "40", color: p.brand }}
          >
            {ex}
          </span>
        ))}
      </div>
      <button
        className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all"
        style={{ backgroundColor: p.brand, boxShadow: `0 4px 14px ${p.brandShadow}` }}
      >
        <Search className="h-4 w-4" />
        당장 구현 가능한가요?
      </button>
    </div>
  );
}

function MiniStepCard({ p, step, icon: Icon, title, status }: {
  p: Palette;
  step: number;
  icon: typeof Globe;
  title: string;
  status: "done" | "loading" | "pending";
}) {
  return (
    <div className="mx-5 mb-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
          style={{
            backgroundColor: status === "done" ? "#f0fdf4" : status === "loading" ? p.brandLight : "#f8fafc",
            color: status === "done" ? "#22c55e" : status === "loading" ? p.brand : "#94a3b8",
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-800 truncate">{title}</span>
            {status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
            {status === "loading" && <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" style={{ color: p.brand }} />}
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400">{step}/3</span>
      </div>
      {status === "loading" && (
        <div className="mt-2.5 space-y-1.5">
          <div className="h-2.5 w-3/4 rounded-full shimmer-skeleton" />
          <div className="h-2.5 w-1/2 rounded-full shimmer-skeleton" />
        </div>
      )}
    </div>
  );
}

function MiniVerdictBadge({ verdict }: { verdict: "GO" | "PIVOT" | "FORK" | "KILL" }) {
  const configs = {
    GO:    { color: "#22c55e", bg: "#f0fdf4", border: "#86efac", Icon: Flame,          label: "GO",   glow: "rgba(34,197,94,0.2)" },
    PIVOT: { color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", Icon: ArrowLeftRight, label: "PIVOT", glow: "rgba(245,158,11,0.2)" },
    FORK:  { color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd", Icon: GitFork,        label: "FORK",  glow: "rgba(59,130,246,0.2)" },
    KILL:  { color: "#ef4444", bg: "#fef2f2", border: "#fca5a5", Icon: Skull,          label: "KILL",  glow: "rgba(239,68,68,0.2)" },
  };
  const c = configs[verdict];
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5"
      style={{ backgroundColor: c.bg, borderColor: c.border, boxShadow: `0 0 16px ${c.glow}` }}
    >
      <c.Icon className="h-5 w-5" style={{ color: c.color }} strokeWidth={2.5} />
      <span className="text-xl font-black" style={{ color: c.color }}>{c.label}</span>
    </div>
  );
}

function MiniScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function MiniDiffCard() {
  return (
    <div className="mx-5 mb-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Waves className="h-4 w-4" style={{ color: "#22c55e" }} />
        <span className="text-xs font-bold text-emerald-600">블루오션</span>
        <span className="ml-auto text-2xl font-black text-emerald-500">72</span>
      </div>
      <div className="text-xs text-slate-400">GitHub 유사 저장소 0개 — 선점 기회 존재</div>
    </div>
  );
}

function MiniVerdictCard() {
  return (
    <div className="mx-5 mb-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex flex-col items-center gap-2 mb-3">
        <MiniVerdictBadge verdict="GO" />
        <div className="text-3xl font-black text-slate-900">83</div>
      </div>
      <div className="space-y-1.5">
        <MiniScoreBar label="경쟁도" score={78} color="#22c55e" />
        <MiniScoreBar label="실현성" score={85} color="#22c55e" />
        <MiniScoreBar label="차별화" score={72} color="#22c55e" />
        <MiniScoreBar label="타이밍" score={90} color="#22c55e" />
      </div>
    </div>
  );
}

// ── 팔레트 카드 전체 프리뷰 ──────────────────────────────────────

function PalettePreview({ p, isSelected, onClick }: { p: Palette; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg"
      style={{
        borderColor: isSelected ? p.brand : "transparent",
        boxShadow: isSelected ? `0 0 0 4px ${p.brandRing}, 0 8px 24px ${p.brandShadow}` : undefined,
      }}
    >
      {/* 미니 앱 시뮬레이션 */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "#fafaf9", backgroundImage: p.bgGradient }}
      >
        <MiniHeader p={p} />
        <MiniInput p={p} />
        <MiniStepCard p={p} step={1} icon={Globe} title="시장 및 차별화 분석" status="done" />
        <MiniDiffCard />
        <MiniStepCard p={p} step={2} icon={Brain} title="기술 실현성 분석" status="loading" />
        <MiniStepCard p={p} step={3} icon={Gavel} title="종합 판정" status="pending" />
        <MiniVerdictCard />
      </div>

      {/* 팔레트 정보 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-t"
        style={{ borderColor: p.brand + "20", backgroundColor: p.brandLight }}
      >
        <div>
          <div className="font-bold text-slate-800 text-sm">{p.tag} {p.name}</div>
          <div className="text-xs text-slate-400">{p.description}</div>
        </div>
        <div
          className="h-6 w-6 rounded-full border-2 border-white shadow"
          style={{ backgroundColor: p.brand }}
        />
      </div>
    </button>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────

export default function ColorsPage() {
  const [selected, setSelected] = useState<string>("current");
  const selectedPalette = PALETTES.find((p) => p.id === selected)!;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-slate-900 mb-1">🎨 컬러 시연</h1>
          <p className="text-slate-500 text-sm">클릭해서 선택하면 아래에 적용 코드가 표시됩니다</p>
        </div>

        {/* 팔레트 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
          {PALETTES.map((p) => (
            <PalettePreview
              key={p.id}
              p={p}
              isSelected={selected === p.id}
              onClick={() => setSelected(p.id)}
            />
          ))}
        </div>

        {/* 선택된 팔레트 코드 */}
        <div
          className="rounded-2xl border p-6"
          style={{ borderColor: selectedPalette.brand + "40", backgroundColor: selectedPalette.brandLight }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: selectedPalette.brand }} />
            <h2 className="font-bold text-slate-800">{selectedPalette.name} — 적용 코드</h2>
          </div>
          <pre className="rounded-xl bg-slate-900 text-slate-100 text-xs p-4 overflow-x-auto leading-relaxed">
{`/* globals.css */
@theme inline {
  --color-brand: ${selectedPalette.brand};
}

/* body background gradient */
background-image:
  ${selectedPalette.bgGradient.split("),").join("),\n  ")};

/* IdeaInput.tsx — hover colors */
hover:border-brand/30 hover:text-brand
focus:border-brand/50 focus:ring-brand/10

/* button */
bg-brand hover:bg-[${selectedPalette.brandHover}]
shadow-brand/20 hover:shadow-brand/25`}
          </pre>
          <p className="mt-3 text-xs text-slate-400">
            globals.css의 <code className="bg-white/60 px-1 rounded">--color-brand</code> 값만 바꾸면 전체 적용됩니다.
            {selectedPalette.id === "current" && " (현재 적용 중)"}
          </p>
        </div>
      </div>
    </div>
  );
}
