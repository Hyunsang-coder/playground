import { streamText, convertToModelMessages } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export async function POST(req: Request) {
  const { messages, analysisResults } = await req.json();

  const systemPrompt = `당신은 Valid8 AI 분석 어시스턴트입니다. 사용자의 해커톤/사이드 프로젝트 아이디어에 대해 이미 5단계 분석이 완료되었습니다.

분석 결과 컨텍스트:
${JSON.stringify(analysisResults, null, 2)}

위 분석 결과를 기반으로 사용자의 후속 질문에 답변하세요.
- 구체적인 기술 구현 방법, 차별화 전략, 피벗 방향 등을 조언하세요.
- 분석 결과에서 나온 데이터(점수, 경쟁사, 리스크 등)를 적극 인용하세요.
- 답변은 한국어로 하되, 기술 용어는 영어 원문을 병기하세요.
- 간결하고 실행 가능한 답변을 제공하세요.`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
