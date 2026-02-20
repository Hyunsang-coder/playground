"use client";

import { useState, useMemo, useRef, useEffect, type CSSProperties } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, MessageCircle, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AnalysisStep } from "../types";

interface Props {
  analysisResults: AnalysisStep[];
  idea: string;
}

const SUGGESTED_QUESTIONS = [
  "MVP를 4시간 안에 만들 수 있는 최소 기능은?",
  "가장 큰 기술적 리스크를 어떻게 해결할까?",
  "경쟁사와 차별화할 킬러 기능은?",
  "심사위원에게 어필할 데모 시나리오는?",
];

export default function ChatPanel({ analysisResults, idea }: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const resultsContext = useMemo(
    () =>
      analysisResults
        .filter((s) => s.status === "done" && s.result)
        .map((s) => ({ step: s.step, title: s.title, result: s.result })),
    [analysisResults]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { analysisResults: resultsContext, idea },
      }),
    [resultsContext, idea]
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setInput("");
    await sendMessage({ text });
  };

  const handleSuggestedClick = async (question: string) => {
    if (isLoading) return;
    setInput("");
    await sendMessage({ text: question });
  };

  return (
    <div
      className="mt-8 rounded-2xl border bg-white p-6 shadow-sm animate-fade-in"
      style={{ borderColor: "var(--brand-ring)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--brand-light)", color: "var(--brand)" }}
        >
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg" style={{ color: "var(--brand)" }}>
            AI 후속 상담
          </h3>
          <p className="text-sm text-slate-500">분석 결과를 바탕으로 추가 질문하세요</p>
        </div>
      </div>

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSuggestedClick(q)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all hover:opacity-90 hover:shadow-sm"
              style={{
                borderColor: "var(--brand-ring)",
                backgroundColor: "var(--brand-light)",
                color: "var(--brand)",
              }}
            >
              <Sparkles className="h-3 w-3" />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="mb-4 max-h-96 overflow-y-auto space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-3 text-sm ${
                m.role === "user"
                  ? "ml-8 border"
                  : "mr-8 bg-slate-50 text-slate-700 border border-slate-100"
              }`}
              style={
                m.role === "user"
                  ? {
                      backgroundColor: "var(--brand-light)",
                      color: "var(--brand-hover)",
                      borderColor: "var(--brand-ring)",
                    }
                  : undefined
              }
            >
              <div className="mb-1 text-xs font-semibold text-slate-400">
                {m.role === "user" ? "나" : "Valid8 AI"}
              </div>
              <div className="markdown-body">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    code: ({ children, className }) =>
                      className ? (
                        <code className="block rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 overflow-x-auto">{children}</code>
                      ) : (
                        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-slate-700">{children}</code>
                      ),
                    pre: ({ children }) => <pre className="mb-2 overflow-x-auto">{children}</pre>,
                    h1: ({ children }) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-2 text-sm font-bold">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="mb-2 border-l-2 border-slate-300 pl-3 text-slate-500 italic">{children}</blockquote>,
                    hr: () => <hr className="my-2 border-slate-200" />,
                  }}
                >
                  {m.parts
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join("")}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="mr-8 rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-400 animate-pulse">
              답변 생성 중...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="분석 결과에 대해 질문하세요..."
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:ring-2"
          style={
            {
              "--tw-ring-color": "var(--brand-ring)",
              borderColor: "var(--brand-ring)",
            } as CSSProperties
          }
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex items-center justify-center rounded-xl px-4 py-2.5 text-white shadow-sm transition-all hover:opacity-90 hover:shadow disabled:opacity-40"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
