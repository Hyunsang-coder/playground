import { useState, useCallback } from "react";
import type { AnalysisStep } from "./types";

export function useAnalysis() {
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (idea: string, mode: string) => {
    setSteps([]);
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, mode }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            const eventType = line.slice(6).trim();
            // Next line should be data
            continue;
          }
          if (line.startsWith("data:")) {
            const dataStr = line.slice(5).trim();
            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);
              const eventLine = lines.find((l) => l.startsWith("event:"));

              // Determine event type from the data or previous event line
              if (data.step !== undefined && data.title) {
                // step_start event
                setSteps((prev) => [
                  ...prev,
                  {
                    step: data.step,
                    title: data.title,
                    description: data.description || "",
                    status: "loading",
                  },
                ]);
              } else if (data.step !== undefined && data.text && !data.result) {
                // step_progress event
                setSteps((prev) =>
                  prev.map((s) =>
                    s.step === data.step
                      ? { ...s, progressText: data.text }
                      : s
                  )
                );
              } else if (data.step !== undefined && data.result) {
                // step_result event
                setSteps((prev) =>
                  prev.map((s) =>
                    s.step === data.step
                      ? { ...s, status: "done" as const, result: data.result, progressText: undefined }
                      : s
                  )
                );
              } else if (data.message === "분석 완료") {
                // done
                setIsAnalyzing(false);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSteps([]);
    setIsAnalyzing(false);
    setError(null);
  }, []);

  return { steps, isAnalyzing, error, analyze, reset };
}
