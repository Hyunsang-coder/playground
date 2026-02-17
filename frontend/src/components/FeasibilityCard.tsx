import { CheckCircle2, XCircle, AlertTriangle, Clock, Cpu, Shield } from "lucide-react";
import type { FeasibilityResult } from "../types";

interface Props {
  data: FeasibilityResult;
}

const FEASIBILITY_CONFIG = {
  possible: { label: "구현 가능", color: "text-go", bg: "bg-go/10" },
  partial: { label: "부분 가능", color: "text-pivot", bg: "bg-pivot/10" },
  difficult: { label: "구현 어려움", color: "text-kill", bg: "bg-kill/10" },
};

const DIFFICULTY_COLORS = {
  easy: "text-go",
  medium: "text-pivot",
  hard: "text-kill",
};

const COMPLEXITY_LABELS: Record<string, string> = {
  frontend: "프론트엔드",
  backend: "백엔드",
  ai_ml: "AI/ML",
  data: "데이터",
  infra: "인프라",
};

const COMPLEXITY_COLORS: Record<string, string> = {
  none: "bg-gray-700",
  low: "bg-go",
  medium: "bg-pivot",
  high: "bg-kill",
};

const SKILL_LABELS: Record<string, string> = {
  junior: "주니어",
  mid: "미드레벨",
  senior: "시니어",
  expert: "전문가",
};

export default function FeasibilityCard({ data }: Props) {
  const config = FEASIBILITY_CONFIG[data.overall_feasibility] || FEASIBILITY_CONFIG.partial;

  return (
    <div className="space-y-4">
      {/* Score & summary */}
      <div className="flex items-center gap-4">
        <div className={`text-5xl font-black ${config.color}`}>{data.score}</div>
        <div>
          <div className="flex items-center gap-2">
            <div className={`inline-block rounded-lg px-3 py-1 text-sm font-bold ${config.bg} ${config.color}`}>
              {config.label}
            </div>
            {data.time_feasible !== undefined && (
              <div className={`inline-block rounded-lg px-3 py-1 text-sm font-bold ${data.time_feasible ? "bg-go/10 text-go" : "bg-kill/10 text-kill"}`}>
                <Clock className="mr-1 inline h-3 w-3" />
                {data.time_feasible ? "시간 내 가능" : "시간 초과 우려"}
              </div>
            )}
          </div>
          <div className="mt-1 text-sm text-gray-400">{data.summary}</div>
        </div>
      </div>

      {/* Skill level + time estimate */}
      <div className="flex gap-3">
        {data.skill_level && (
          <div className="rounded-lg border border-gray-800 px-3 py-2 text-sm">
            <span className="text-gray-500">필요 스킬: </span>
            <span className="font-medium text-gray-300">{SKILL_LABELS[data.skill_level] || data.skill_level}</span>
          </div>
        )}
        {data.time_estimate && (
          <div className="rounded-lg border border-gray-800 px-3 py-2 text-sm">
            <span className="text-gray-500">예상 시간: </span>
            <span className="font-medium text-gray-300">{data.time_estimate}</span>
          </div>
        )}
      </div>

      {/* Complexity breakdown */}
      {data.complexity_breakdown && Object.keys(data.complexity_breakdown).length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Cpu className="h-4 w-4" /> 복잡도 분석
          </h4>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(data.complexity_breakdown).map(([key, level]) => (
              <div key={key} className="text-center">
                <div className={`mx-auto h-2 rounded-full ${COMPLEXITY_COLORS[level || "none"] || "bg-gray-700"}`} />
                <div className="mt-1 text-xs text-gray-500">{COMPLEXITY_LABELS[key] || key}</div>
                <div className="text-xs font-medium text-gray-400">{level || "none"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tech requirements */}
      {data.tech_requirements.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300">필요 기술</h4>
          {data.tech_requirements.map((t, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
              {t.available ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-go" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-kill" />
              )}
              <div className="flex-1">
                <span className="font-medium">{t.name}</span>
                <span className="ml-2 text-sm text-gray-500">{t.note}</span>
                {t.alternatives && (
                  <div className="mt-0.5 text-xs text-gray-600">
                    대안: {t.alternatives}
                  </div>
                )}
              </div>
              <span className={`text-xs font-mono ${DIFFICULTY_COLORS[t.difficulty] || "text-gray-400"}`}>
                {t.difficulty}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Implementation steps */}
      {data.implementation_steps && data.implementation_steps.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Clock className="h-4 w-4" /> 구현 단계
          </h4>
          {data.implementation_steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-800 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-gray-400">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.step}</span>
                  <span className={`text-xs font-mono ${
                    s.complexity === "low" ? "text-go" : s.complexity === "medium" ? "text-pivot" : "text-kill"
                  }`}>
                    {s.complexity}
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-gray-500">{s.description}</div>
              </div>
              <span className="shrink-0 text-xs text-gray-500">{s.estimated_hours}h</span>
            </div>
          ))}
        </div>
      )}

      {/* Required APIs */}
      {data.required_apis && data.required_apis.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <Shield className="h-4 w-4" /> 외부 API 의존성
          </h4>
          {data.required_apis.map((api, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{api.name}</span>
                  {api.free_tier && (
                    <span className="rounded bg-go/10 px-1.5 py-0.5 text-xs text-go">무료</span>
                  )}
                  {api.rate_limit_concern && (
                    <span className="rounded bg-kill/10 px-1.5 py-0.5 text-xs text-kill">Rate Limit 우려</span>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-gray-500">{api.purpose}</div>
                {api.alternative && (
                  <div className="mt-0.5 text-xs text-gray-600">대안: {api.alternative}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Risks */}
      {data.key_risks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300">핵심 리스크</h4>
          {data.key_risks.map((risk, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pivot" />
              <span className="text-gray-400">{risk}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
