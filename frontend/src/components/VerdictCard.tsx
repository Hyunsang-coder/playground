import { useEffect, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import type { VerdictResult } from "../types";

interface Props {
  data: VerdictResult;
  idea?: string;
  onReanalyze?: (idea: string) => void;
}

const VERDICT_CONFIG = {
  GO: { label: "GO", color: "text-go", border: "border-go", bg: "bg-go/20", glowColor: "rgba(34,197,94,0.4)", emoji: "🔥", desc: "당장 코딩 시작하세요!" },
  PIVOT: { label: "PIVOT", color: "text-pivot", border: "border-pivot", bg: "bg-pivot/20", glowColor: "rgba(234,179,8,0.4)", emoji: "🔄", desc: "방향 수정이 필요합니다." },
  KILL: { label: "KILL", color: "text-kill", border: "border-kill", bg: "bg-kill/20", glowColor: "rgba(239,68,68,0.4)", emoji: "💀", desc: "다른 아이디어를 찾아보세요." },
};

function AnimatedScore({ value, color }: { value: number; color: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * value);
      if (el) el.textContent = String(start);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [value]);

  return <div ref={ref} className={`text-6xl font-black ${color} animate-score-count`}>0</div>;
}

function ScoreBar({ label, score, delay }: { label: string; score: number; delay: number }) {
  const color = score >= 70 ? "bg-go" : score >= 40 ? "bg-pivot" : "bg-kill";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono font-bold">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{
            width: `${score}%`,
            transition: `width 1s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

export default function VerdictCard({ data, idea, onReanalyze }: Props) {
  const config = VERDICT_CONFIG[data.verdict] || VERDICT_CONFIG.KILL;
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleCopy = async () => {
    const text = [
      `${config.emoji} Valid8 판정: ${data.verdict} (${data.overall_score}/100)`,
      idea ? `\n아이디어: ${idea}` : "",
      `\n${data.one_liner}`,
      `\n점수 상세:`,
      `  경쟁 현황: ${data.scores.competition}/100`,
      `  기술 실현성: ${data.scores.feasibility}/100`,
      `  차별화: ${data.scores.differentiation}/100`,
      `  타이밍: ${data.scores.timing}/100`,
      `\n추천: ${data.recommendation}`,
      data.alternative_ideas.length > 0 ? `\n대안: ${data.alternative_ideas.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6" ref={cardRef}>
      {/* Big verdict */}
      <div className="flex flex-col items-center gap-4 py-4">
        <div
          className={`verdict-badge ${config.bg} ${config.border} border-2 animate-verdict-reveal animate-verdict-glow`}
          style={{ "--verdict-glow-color": config.glowColor } as React.CSSProperties}
        >
          <span className="text-4xl">{config.emoji}</span>
          <span className={`text-4xl ${config.color}`}>{config.label}</span>
        </div>
        <p className={`text-sm font-semibold ${config.color}`}>{config.desc}</p>
        <div className="text-center">
          <AnimatedScore value={data.overall_score} color={config.color} />
          <div className="text-sm text-gray-400">/ 100</div>
        </div>
        <div className="text-center text-gray-300 animate-fade-in" style={{ animationDelay: "0.5s", animationFillMode: "both" }}>
          {data.one_liner}
        </div>
        <div className="text-sm text-gray-500">
          신뢰도: <span className="font-mono">{data.confidence}%</span>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="space-y-3 rounded-xl border border-gray-800 p-4 animate-fade-in" style={{ animationDelay: "0.6s", animationFillMode: "both" }}>
        <h4 className="text-sm font-semibold text-gray-300">점수 상세</h4>
        <ScoreBar label="경쟁 현황" score={data.scores.competition} delay={700} />
        <ScoreBar label="기술 실현성" score={data.scores.feasibility} delay={900} />
        <ScoreBar label="차별화" score={data.scores.differentiation} delay={1100} />
        <ScoreBar label="타이밍" score={data.scores.timing} delay={1300} />
      </div>

      {/* Recommendation */}
      <div className={`rounded-xl border ${config.border}/30 ${config.bg} p-4 animate-fade-in`} style={{ animationDelay: "0.8s", animationFillMode: "both" }}>
        <h4 className={`font-semibold ${config.color}`}>추천</h4>
        <p className="mt-1 text-sm text-gray-300">{data.recommendation}</p>
      </div>

      {/* Alternative ideas */}
      {data.alternative_ideas.length > 0 && (
        <div className="space-y-2 animate-fade-in" style={{ animationDelay: "1s", animationFillMode: "both" }}>
          <h4 className="text-sm font-semibold text-gray-300">대안 아이디어</h4>
          <div className="flex flex-wrap gap-2">
            {data.alternative_ideas.map((altIdea, i) => (
              <button
                key={i}
                onClick={() => onReanalyze?.(altIdea)}
                className="rounded-full border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-300 transition-all hover:border-kill/50 hover:bg-kill/10 hover:text-kill"
                title="클릭하여 이 아이디어로 재분석"
              >
                {altIdea}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Share / Copy */}
      <div className="flex justify-center animate-fade-in" style={{ animationDelay: "1.2s", animationFillMode: "both" }}>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-xl border border-gray-700 px-5 py-2.5 text-sm text-gray-400 transition-all hover:border-gray-500 hover:text-gray-200"
        >
          {copied ? <Check className="h-4 w-4 text-go" /> : <Copy className="h-4 w-4" />}
          {copied ? "복사 완료!" : "결과 복사하기"}
        </button>
      </div>
    </div>
  );
}
