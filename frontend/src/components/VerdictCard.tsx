import type { VerdictResult } from "../types";

interface Props {
  data: VerdictResult;
}

const VERDICT_CONFIG = {
  GO: { label: "GO", color: "text-go", border: "border-go", bg: "bg-go/20", emoji: "🟢", desc: "진행하세요!" },
  PIVOT: { label: "PIVOT", color: "text-pivot", border: "border-pivot", bg: "bg-pivot/20", emoji: "🟡", desc: "방향 전환 권장" },
  KILL: { label: "KILL", color: "text-kill", border: "border-kill", bg: "bg-kill/20", emoji: "🔴", desc: "포기를 권합니다" },
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "bg-go" : score >= 40 ? "bg-pivot" : "bg-kill";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono font-bold">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800">
        <div
          className={`h-2 rounded-full ${color} transition-all duration-1000`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function VerdictCard({ data }: Props) {
  const config = VERDICT_CONFIG[data.verdict] || VERDICT_CONFIG.KILL;

  return (
    <div className="space-y-6">
      {/* Big verdict */}
      <div className="flex flex-col items-center gap-4 py-4">
        <div className={`verdict-badge ${config.bg} ${config.border} border-2`}>
          <span className="text-4xl">{config.emoji}</span>
          <span className={`text-4xl ${config.color}`}>{config.label}</span>
        </div>
        <div className="text-center">
          <div className={`text-6xl font-black ${config.color}`}>{data.overall_score}</div>
          <div className="text-sm text-gray-400">/ 100</div>
        </div>
        <div className="text-center text-gray-300">{data.one_liner}</div>
        <div className="text-sm text-gray-500">
          신뢰도: <span className="font-mono">{data.confidence}%</span>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="space-y-3 rounded-xl border border-gray-800 p-4">
        <h4 className="text-sm font-semibold text-gray-300">점수 상세</h4>
        <ScoreBar label="경쟁 현황" score={data.scores.competition} />
        <ScoreBar label="기술 실현성" score={data.scores.feasibility} />
        <ScoreBar label="차별화" score={data.scores.differentiation} />
        <ScoreBar label="타이밍" score={data.scores.timing} />
      </div>

      {/* Recommendation */}
      <div className={`rounded-xl border ${config.border}/30 ${config.bg} p-4`}>
        <h4 className={`font-semibold ${config.color}`}>추천</h4>
        <p className="mt-1 text-sm text-gray-300">{data.recommendation}</p>
      </div>

      {/* Alternative ideas */}
      {data.alternative_ideas.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-300">대안 아이디어</h4>
          <div className="flex flex-wrap gap-2">
            {data.alternative_ideas.map((idea, i) => (
              <span
                key={i}
                className="rounded-full border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300"
              >
                {idea}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
