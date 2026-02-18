"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Send, MessageCircle, Sparkles } from "lucide-react";
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
      new TextStreamChatTransport({
        api: "/api/chat",
        body: { analysisResults: resultsContext },
      }),
    [resultsContext]
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
    <div className="mt-8 rounded-2xl border border-violet-200 bg-white p-6 shadow-sm animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-violet-700">AI 후속 상담</h3>
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
              className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm text-violet-600 transition-all hover:border-violet-300 hover:bg-violet-100 hover:shadow-sm"
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
                  ? "ml-8 bg-violet-50 text-violet-800 border border-violet-100"
                  : "mr-8 bg-slate-50 text-slate-700 border border-slate-100"
              }`}
            >
              <div className="mb-1 text-xs font-semibold text-slate-400">
                {m.role === "user" ? "나" : "Valid8 AI"}
              </div>
              <div className="whitespace-pre-wrap">
                {m.parts
                  .filter((part) => part.type === "text")
                  .map((part, i) => (
                    <span key={i}>{part.text}</span>
                  ))}
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
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex items-center justify-center rounded-xl bg-violet-500 px-4 py-2.5 text-white shadow-sm transition-all hover:bg-violet-600 hover:shadow disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
