import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const MAX_MESSAGE_COUNT = 40;
const MAX_MESSAGES_JSON_CHARS = 60_000;
const MAX_ANALYSIS_JSON_CHARS = 12_000;
const MAX_IDEA_CHARS = 500;

type ChatRequestBody = {
  messages?: unknown;
  analysisResults?: unknown;
  idea?: unknown;
};

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function serializeWithLimit(value: unknown, maxChars: number): string {
  try {
    const json = JSON.stringify(value, null, 2);
    if (!json) return "[]";
    return truncateText(json, maxChars);
  } catch {
    return "[]";
  }
}

function sanitizeAnalysisResults(input: unknown): unknown[] {
  if (!Array.isArray(input)) return [];

  return input.slice(0, 6).map((item) => {
    if (!item || typeof item !== "object") return item;
    const record = item as Record<string, unknown>;
    const step = typeof record.step === "number" ? record.step : undefined;
    const title = typeof record.title === "string" ? truncateText(record.title, 120) : undefined;
    return {
      step,
      title,
      result: record.result,
    };
  });
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { messages, analysisResults, idea } = body;

  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages must be an array" }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGE_COUNT) {
    return Response.json(
      { error: `messages must contain at most ${MAX_MESSAGE_COUNT} items` },
      { status: 400 }
    );
  }

  const messagesSize = serializeWithLimit(messages, MAX_MESSAGES_JSON_CHARS).length;
  if (messagesSize >= MAX_MESSAGES_JSON_CHARS) {
    return Response.json({ error: "messages payload is too large" }, { status: 400 });
  }

  if (idea !== undefined && typeof idea !== "string") {
    return Response.json({ error: "idea must be a string" }, { status: 400 });
  }
  if (analysisResults !== undefined && !Array.isArray(analysisResults)) {
    return Response.json({ error: "analysisResults must be an array" }, { status: 400 });
  }

  const safeIdea = typeof idea === "string" ? truncateText(idea, MAX_IDEA_CHARS) : "";
  const safeAnalysisResults = sanitizeAnalysisResults(analysisResults);
  const analysisResultsText = serializeWithLimit(safeAnalysisResults, MAX_ANALYSIS_JSON_CHARS);

  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    modelMessages = await convertToModelMessages(messages as UIMessage[]);
  } catch {
    return Response.json({ error: "Invalid message format" }, { status: 400 });
  }

  const systemPrompt = `당신은 Valid8 AI 분석 어시스턴트입니다. 사용자의 해커톤/사이드 프로젝트 아이디어에 대해 3단계 분석이 완료되었습니다.

분석 결과 컨텍스트:
${analysisResultsText}

원본 아이디어:
${safeIdea}

위 분석 결과를 기반으로 사용자의 후속 질문에 답변하세요.
- 구체적인 기술 구현 방법, 차별화 전략, 피벗 방향 등을 조언하세요.
- 분석 결과에서 나온 데이터(점수, 경쟁사, 리스크 등)를 적극 인용하세요.
- 답변은 한국어로 하되, 기술 용어는 영어 원문을 병기하세요.
- 간결하고 실행 가능한 답변을 제공하세요.`;

  try {
    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: systemPrompt,
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch {
    return Response.json({ error: "Failed to start chat stream" }, { status: 500 });
  }
}
