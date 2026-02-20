"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Link,
  Ban,
  Lock,
  HelpCircle,
  Wifi,
  Package,
  Cpu,
  FileCode,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  Circle,
} from "lucide-react";
import type {
  FeasibilityResult,
  Bottleneck,
  BottleneckType,
  DataAvailabilityResult,
  DataSource,
} from "../types";

interface Props {
  data: FeasibilityResult;
}

const FEASIBILITY_CONFIG = {
  possible: { label: "구현 가능", color: "text-go", bg: "bg-emerald-50", border: "border-emerald-200" },
  partial: { label: "부분 가능", color: "text-pivot", bg: "bg-amber-50", border: "border-amber-200" },
  difficult: { label: "구현 어려움", color: "text-kill", bg: "bg-rose-50", border: "border-rose-200" },
};

const DIFFICULTY_COLORS = {
  easy: "text-go",
  medium: "text-pivot",
  hard: "text-kill",
};

const VIBE_DIFFICULTY_CONFIG = {
  easy: { label: "쉬움", color: "text-go", bg: "bg-emerald-50", border: "border-emerald-200" },
  medium: { label: "보통", color: "text-pivot", bg: "bg-amber-50", border: "border-amber-200" },
  hard: { label: "어려움", color: "text-kill", bg: "bg-rose-50", border: "border-rose-200" },
};

const BOTTLENECK_CONFIG: Record<
  BottleneckType,
  {
    icon: typeof Ban;
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  api_unavailable: {
    icon: Ban,
    label: "API 없음",
    color: "text-kill",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  auth_complexity: {
    icon: Lock,
    label: "인증 복잡",
    color: "text-pivot",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  data_structure_unknown: {
    icon: HelpCircle,
    label: "스키마 불명",
    color: "text-pivot",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  realtime_required: {
    icon: Wifi,
    label: "실시간 필요",
    color: "text-pivot",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  no_library: {
    icon: Package,
    label: "패키지 없음",
    color: "text-kill",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
  },
  complex_algorithm: {
    icon: Cpu,
    label: "복잡한 로직",
    color: "text-pivot",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  binary_processing: {
    icon: FileCode,
    label: "바이너리 처리",
    color: "text-pivot",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  existing_open_source: {
    icon: Package,
    label: "동일 오픈소스 존재",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
};

function isBottleneckObject(b: unknown): b is Bottleneck {
  return typeof b === "object" && b !== null && "type" in b && "description" in b;
}

function BlockingWarningBanner({ sources }: { sources: DataSource[] }) {
  const blocking = sources.filter((s) => s.blocking);
  if (blocking.length === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4">
      <AlertTriangle className="h-5 w-5 shrink-0 text-kill mt-0.5" />
      <div>
        <div className="font-semibold text-kill text-sm">구현 블로커 감지</div>
        <ul className="mt-1 space-y-0.5 text-sm text-rose-700">
          {blocking.map((s, i) => (
            <li key={i}>• {s.name} — {s.note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DataAvailabilitySection({ data }: { data: DataAvailabilityResult }) {
  if (data.data_sources.length === 0 && data.libraries.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-600">데이터/API 가용성</h4>

      {data.data_sources.map((source, i) => (
        <div key={`${source.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
          {source.has_official_api ? (
            <CheckCircle2 className="h-4 w-4 text-go" />
          ) : source.crawlable ? (
            <RefreshCw className="h-4 w-4 text-amber-500" />
          ) : (
            <XCircle className="h-4 w-4 text-kill" />
          )}

          <span className="flex-1 text-slate-700">{source.name}</span>

          {source.blocking && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-kill">
              블로커
            </span>
          )}

          {source.crawlable && !source.has_official_api && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              크롤링 가능
            </span>
          )}

          {source.evidence_url && (
            <a
              href={source.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
              title="근거 링크"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      ))}

      {data.libraries.map((library, i) => (
        <div key={`${library.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
          {library.available_on_npm ? (
            <CheckCircle2 className="h-4 w-4 text-go" />
          ) : (
            <XCircle className="h-4 w-4 text-kill" />
          )}

          <span className="flex-1 text-slate-700">{library.name}</span>

          {library.package_name && (
            <a
              href={`https://npmjs.com/package/${library.package_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand hover:underline font-mono"
            >
              npm/{library.package_name}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function StructuredBottleneckCard({ bottleneck }: { bottleneck: Bottleneck }) {
  const config = BOTTLENECK_CONFIG[bottleneck.type] || BOTTLENECK_CONFIG.complex_algorithm;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-3`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
        <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
        {bottleneck.severity === "high" && (
          <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-kill">HIGH</span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-700">{bottleneck.description}</p>
      {bottleneck.suggestion && <p className="mt-1 text-xs text-slate-500">{bottleneck.suggestion}</p>}
    </div>
  );
}

export default function FeasibilityCard({ data }: Props) {
  const config = FEASIBILITY_CONFIG[data.overall_feasibility] || FEASIBILITY_CONFIG.partial;
  const vibeDifficulty = data.vibe_coding_difficulty || "medium";
  const vibeConfig = VIBE_DIFFICULTY_CONFIG[vibeDifficulty];

  return (
    <div className="space-y-4">
      {/* 1. Blocking warning */}
      <BlockingWarningBanner sources={data.data_availability?.data_sources || []} />

      {/* 2. Score & summary */}
      <div className="flex items-center gap-4">
        <div className={`text-5xl font-black ${config.color}`}>{data.score}</div>
        <div>
          <div className={`inline-block rounded-lg px-3 py-1 text-sm font-bold ${config.bg} ${config.color} ${config.border} border`}>
            {config.label}
          </div>
          <div className="mt-1 text-sm text-slate-500">{data.summary}</div>
        </div>
      </div>

      {/* 3. Vibe coding difficulty badge */}
      {data.vibe_coding_difficulty && (
        <div className={`flex items-center gap-3 rounded-xl border ${vibeConfig.border} ${vibeConfig.bg} p-4`}>
          <Zap className={`h-5 w-5 shrink-0 ${vibeConfig.color}`} />
          <div>
            <div className="text-sm text-slate-500">바이브코딩 난이도</div>
            <div className={`flex items-center gap-1.5 text-lg font-bold ${vibeConfig.color}`}>
              {vibeDifficulty === "easy" ? (
                <CheckCircle className="h-5 w-5" />
              ) : vibeDifficulty === "medium" ? (
                <Circle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              {vibeConfig.label}
            </div>
          </div>
        </div>
      )}

      {/* 4. Bottlenecks */}
      {data.bottlenecks && data.bottlenecks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-600">병목 지점</h4>
          {data.bottlenecks.map((item, i) =>
            isBottleneckObject(item) ? (
              <StructuredBottleneckCard key={i} bottleneck={item} />
            ) : (
              <div key={i} className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-kill" />
                <span className="text-slate-600">{String(item)}</span>
              </div>
            )
          )}
        </div>
      )}

      {/* 5. Data availability */}
      {data.data_availability && <DataAvailabilitySection data={data.data_availability} />}

      {/* 6. Tech requirements */}
      {data.tech_requirements.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-600">필요 기술</h4>
          {data.tech_requirements.map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              {t.available ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-go" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-kill" />
              )}
              <div className="flex-1">
                <span className="font-medium text-slate-700">{t.name}</span>
                <span className="ml-2 text-sm text-slate-400">{t.note}</span>
              </div>
              <span className={`text-xs font-mono ${DIFFICULTY_COLORS[t.difficulty] || "text-slate-400"}`}>
                {t.difficulty}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 7. Risks */}
      {data.key_risks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-600">외부 의존성 리스크</h4>
          {data.key_risks.map((risk, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Link className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span className="text-slate-500">{risk}</span>
            </div>
          ))}
        </div>
      )}

      {/* 8. Time estimate */}
      {data.time_estimate && (
        <div className="text-sm text-slate-400">
          예상 개발 시간: <span className="font-medium text-slate-600">{data.time_estimate}</span>
        </div>
      )}
    </div>
  );
}
