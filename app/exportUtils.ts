import type {
  AnalysisStep,
  MarketAndDifferentiationResult,
  FeasibilityResult,
  VerdictResult,
  Bottleneck,
} from "./types";

function isBottleneckObject(b: unknown): b is Bottleneck {
  return typeof b === "object" && b !== null && "type" in b && "description" in b;
}

function verdictEmoji(verdict: string) {
  if (verdict === "GO") return "🟢";
  if (verdict === "PIVOT") return "🟡";
  if (verdict === "KILL") return "🔴";
  return "";
}

export function exportAsMarkdown(idea: string, steps: AnalysisStep[]): string {
  const lines: string[] = [];
  const now = new Date().toLocaleString("ko-KR");

  lines.push(`# Valid8 분석 리포트`);
  lines.push("");
  lines.push(`> **아이디어:** ${idea}`);
  lines.push(`> **생성일:** ${now}`);
  lines.push("");

  for (const step of steps) {
    if (step.status !== "done" || !step.result) continue;

    lines.push(`---`);
    lines.push("");

    if (step.step === 1) {
      lines.push(`## 1단계: ${step.title}`);
      lines.push("");
      const data = step.result as MarketAndDifferentiationResult;

      // Web
      lines.push(`### 시장 조사 (웹)`);
      lines.push(`${data.web.summary} (유의미 ${data.web.raw_count}개)`);
      lines.push("");
      if (data.web.competitors.length > 0) {
        for (const c of data.web.competitors.slice(0, 5)) {
          lines.push(`- **[${c.title}](${c.url})**`);
          lines.push(`  ${c.snippet}`);
        }
      } else {
        lines.push(`경쟁 제품을 찾지 못했습니다 — 블루오션 가능성!`);
      }
      lines.push("");

      // GitHub
      lines.push(`### 오픈소스 조사 (GitHub)`);
      lines.push(`${data.github.summary} (유의미 ${data.github.repos.length}개)`);
      lines.push("");
      if (data.github.repos.length > 0) {
        for (const r of data.github.repos.slice(0, 5)) {
          lines.push(`- **[${r.name}](${r.url})** ⭐ ${r.stars.toLocaleString()}${r.language ? ` \`${r.language}\`` : ""}`);
          lines.push(`  ${r.description || "설명 없음"}`);
        }
      } else {
        lines.push(`유사한 오픈소스 프로젝트가 없습니다!`);
      }
      lines.push("");

      // Differentiation
      lines.push(`### 차별화 분석`);
      const levelLabel =
        data.differentiation.competition_level === "blue_ocean" ? "🌊 블루오션" :
          data.differentiation.competition_level === "moderate" ? "⚔️ 보통 경쟁" : "🔴 레드오션";
      lines.push(`**경쟁 점수: ${data.differentiation.competition_score}/100** — ${levelLabel}`);
      lines.push("");
      lines.push(data.differentiation.summary);
      lines.push("");

      if (data.differentiation.existing_solutions.length > 0) {
        lines.push(`#### 기존 솔루션`);
        for (const s of data.differentiation.existing_solutions) {
          lines.push(`- **${s.name}** (유사도 ${s.similarity}%) — ${s.weakness}`);
        }
        lines.push("");
      }

      if (data.differentiation.unique_angles.length > 0) {
        lines.push(`#### 차별화 가능 포인트`);
        for (const angle of data.differentiation.unique_angles) {
          lines.push(`- 💡 ${angle}`);
        }
        lines.push("");
      }
    }

    if (step.step === 2) {
      lines.push(`## 2단계: ${step.title}`);
      lines.push("");
      const data = step.result as FeasibilityResult;
      const feasLabel =
        data.overall_feasibility === "possible" ? "구현 가능" :
          data.overall_feasibility === "partial" ? "부분 가능" : "구현 어려움";
      lines.push(`**점수: ${data.score}/100** — ${feasLabel}`);
      lines.push("");
      lines.push(data.summary);
      lines.push("");

      if (data.vibe_coding_difficulty) {
        const vd = data.vibe_coding_difficulty === "easy" ? "쉬움" : data.vibe_coding_difficulty === "medium" ? "보통" : "어려움";
        lines.push(`**바이브코딩 난이도:** ${vd}`);
        lines.push("");
      }

      if (data.bottlenecks && data.bottlenecks.length > 0) {
        lines.push(`### 병목 지점`);
        for (const b of data.bottlenecks) {
          if (isBottleneckObject(b)) {
            lines.push(`- **[${b.severity.toUpperCase()}]** ${b.description}${b.suggestion ? ` → ${b.suggestion}` : ""}`);
          } else {
            lines.push(`- ${String(b)}`);
          }
        }
        lines.push("");
      }

      if (data.data_availability) {
        const da = data.data_availability;
        if (da.data_sources.length > 0 || da.libraries.length > 0) {
          lines.push(`### 데이터/API 가용성`);
          for (const s of da.data_sources) {
            const status = s.has_official_api ? "✅ 공식 API" : s.crawlable ? "🔄 크롤링 가능" : "❌ 불가";
            lines.push(`- ${s.name}: ${status}${s.blocking ? " ⚠️ 블로커" : ""}${s.note ? ` — ${s.note}` : ""}`);
          }
          for (const l of da.libraries) {
            const status = l.available_on_npm ? "✅" : "❌";
            lines.push(`- ${l.name}: ${status}${l.package_name ? ` (npm/${l.package_name})` : ""}${l.note ? ` — ${l.note}` : ""}`);
          }
          lines.push("");
        }
      }

      if (data.tech_requirements.length > 0) {
        lines.push(`### 필요 기술`);
        for (const t of data.tech_requirements) {
          lines.push(`- ${t.available ? "✅" : "❌"} ${t.name} (${t.difficulty}) — ${t.note}`);
        }
        lines.push("");
      }

      if (data.key_risks.length > 0) {
        lines.push(`### 리스크`);
        for (const risk of data.key_risks) {
          lines.push(`- ⚠️ ${risk}`);
        }
        lines.push("");
      }

      if (data.time_estimate) {
        lines.push(`**예상 개발 시간:** ${data.time_estimate}`);
        lines.push("");
      }
    }

    if (step.step === 3) {
      lines.push(`## 3단계: ${step.title}`);
      lines.push("");
      const data = step.result as VerdictResult;
      lines.push(`# ${verdictEmoji(data.verdict)} ${data.verdict} — ${data.overall_score}/100`);
      lines.push("");
      lines.push(`> ${data.one_liner}`);
      lines.push("");

      lines.push(`### 점수 상세`);
      lines.push(`| 항목 | 점수 |`);
      lines.push(`|------|------|`);
      lines.push(`| 경쟁 현황 | ${data.scores.competition}/100 |`);
      lines.push(`| 기술 실현성 | ${data.scores.feasibility}/100 |`);
      lines.push(`| 차별화 | ${data.scores.differentiation}/100 |`);
      lines.push(`| 타이밍 | ${data.scores.timing}/100 |`);
      lines.push("");

      lines.push(`### 추천`);
      lines.push(data.recommendation);
      lines.push("");

      if (data.alternative_ideas.length > 0) {
        lines.push(`### 대안 아이디어`);
        for (const alt of data.alternative_ideas) {
          lines.push(`- ${alt}`);
        }
        lines.push("");
      }
    }
  }

  lines.push(`---`);
  lines.push(`*Valid8에서 생성됨*`);

  return lines.join("\n");
}

export function exportAsJson(idea: string, steps: AnalysisStep[]): string {
  const data: Record<string, unknown> = {
    idea,
    exported_at: new Date().toISOString(),
    steps: steps
      .filter((s) => s.status === "done" && s.result)
      .map((s) => ({
        step: s.step,
        title: s.title,
        result: s.result,
      })),
  };

  return JSON.stringify(data, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
