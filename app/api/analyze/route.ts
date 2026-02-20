import { NextRequest, NextResponse } from "next/server";
import { IdeaAnalyzer } from "./analyzer";

export async function POST(request: NextRequest) {
  const supportedSteps = [1, 2, 3] as const;

  // 1. Parse and validate request body
  let body: { idea?: string; enabledSteps?: number[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { idea, enabledSteps = [...supportedSteps] } = body;

  if (!idea || typeof idea !== "string" || idea.trim().length === 0) {
    return NextResponse.json({ error: "idea is required" }, { status: 400 });
  }
  if (idea.length > 500) {
    return NextResponse.json({ error: "idea must be 500 characters or less" }, { status: 400 });
  }
  const validSteps = [...supportedSteps];
  const sanitizedSteps = Array.isArray(enabledSteps)
    ? enabledSteps.filter((s): s is number => Number.isInteger(s) && validSteps.includes(s as (typeof supportedSteps)[number]))
    : validSteps;
  const uniqueSteps = Array.from(new Set(sanitizedSteps));
  if (Array.isArray(enabledSteps) && enabledSteps.length > 0 && uniqueSteps.length === 0) {
    return NextResponse.json(
      { error: "enabledSteps must include one or more of: 1, 2, 3" },
      { status: 400 }
    );
  }
  const finalSteps = uniqueSteps.length > 0 ? uniqueSteps : validSteps;

  // 2. Create analyzer with env-based API keys
  const analyzer = new IdeaAnalyzer(
    process.env.ANTHROPIC_API_KEY || "",
    process.env.TAVILY_API_KEY || "",
    process.env.GITHUB_TOKEN || ""
  );

  // 3. Stream SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of analyzer.analyze(idea.trim(), finalSteps)) {
          const line = `data: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
      } catch (e) {
        const errorData = { error: e instanceof Error ? e.message : "분석 중 오류가 발생했습니다." };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
