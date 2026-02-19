"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const MOCK_RESULTS = [
  { step: 1, title: "경쟁 제품 탐색", result: { competitors: [], raw_count: 0, summary: "테스트" } },
  { step: 5, title: "종합 판정", result: { verdict: "GO", overall_score: 75, one_liner: "테스트 판정" } },
];

export default function TestChatPage() {
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const log = useCallback(
    (msg: string) => setDebugLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]),
    []
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { analysisResults: MOCK_RESULTS },
      }),
    []
  );

  const { messages, sendMessage, status, error } = useChat({ transport });

  useEffect(() => {
    log(`status: ${status}`);
  }, [status, log]);

  useEffect(() => {
    if (error) log(`error: ${error.message}`);
  }, [error, log]);

  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      log(`msg[${messages.length - 1}] role=${last.role} parts=${JSON.stringify(last.parts)} content="${(last as unknown as Record<string, unknown>).content || "(no content)"}"`);
    }
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [messages, log]);

  const [input, setInput] = useState("");

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInput("");
    log(`sending: "${text}"`);
    await sendMessage({ text });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 font-mono text-sm">
      <h1 className="text-xl font-bold mb-4">Chat API Test Page</h1>
      <div className="grid grid-cols-2 gap-4">
        {/* Messages */}
        <div className="bg-white rounded-lg border p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <h2 className="font-bold text-slate-600">Messages ({messages.length})</h2>
          {messages.map((m, i) => (
            <div key={m.id} className={`p-3 rounded-lg text-xs ${m.role === "user" ? "bg-blue-50" : "bg-green-50"}`}>
              <div className="font-bold mb-1">[{i}] {m.role} (id: {m.id})</div>
              <div className="mb-1">
                <span className="text-slate-400">parts: </span>
                <pre className="whitespace-pre-wrap">{JSON.stringify(m.parts, null, 2)}</pre>
              </div>
              <div>
                <span className="text-slate-400">content: </span>
                <pre className="whitespace-pre-wrap">{JSON.stringify((m as unknown as Record<string, unknown>).content)}</pre>
              </div>
            </div>
          ))}
          {messages.length === 0 && <div className="text-slate-400">No messages yet</div>}
        </div>

        {/* Debug log */}
        <div ref={logRef} className="bg-slate-900 text-green-400 rounded-lg p-4 max-h-[70vh] overflow-y-auto">
          <h2 className="font-bold text-green-300 mb-2">Debug Log</h2>
          {debugLog.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border px-4 py-2"
        />
        <button onClick={() => handleSend(input)} className="bg-blue-500 text-white px-4 py-2 rounded-lg">
          Send
        </button>
        <button onClick={() => handleSend("테스트 질문입니다")} className="bg-slate-500 text-white px-4 py-2 rounded-lg">
          Quick Test
        </button>
      </div>

      <div className="mt-2 text-xs text-slate-500">
        Status: <span className="font-bold">{status}</span> | Error: {error?.message || "none"}
      </div>
    </div>
  );
}
