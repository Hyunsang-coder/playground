import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock IdeaAnalyzer so no real API calls are made
vi.mock("../../app/api/analyze/analyzer", () => {
  const mockAnalyze = vi.fn(async function* () {
    yield { data: { message: "분석 완료" } };
  });
  return {
    IdeaAnalyzer: vi.fn().mockImplementation(() => ({
      analyze: mockAnalyze,
    })),
  };
});

// Import after mocks are set up
const { POST } = await import("../../app/api/analyze/route");

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  it("returns 400 for invalid JSON body", async () => {
    const request = new Request("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const response = await POST(request as any);
    expect(response.status).toBe(400);
  });

  it("returns 400 when idea is missing", async () => {
    const response = await POST(makeRequest({ enabledSteps: [1, 2, 3] }) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("idea");
  });

  it("returns 400 when idea is empty string", async () => {
    const response = await POST(makeRequest({ idea: "   " }) as any);
    expect(response.status).toBe(400);
  });

  it("returns 400 when idea exceeds 500 characters", async () => {
    const response = await POST(makeRequest({ idea: "a".repeat(501) }) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("500");
  });

  it("returns 400 when enabledSteps contains only invalid values", async () => {
    const response = await POST(makeRequest({ idea: "Test idea", enabledSteps: [99, 0, -1] }) as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("enabledSteps");
  });

  it("returns 200 with text/event-stream for valid request", async () => {
    const response = await POST(makeRequest({ idea: "Test idea", enabledSteps: [1, 2, 3] }) as any);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("accepts idea without enabledSteps (defaults to all steps)", async () => {
    const response = await POST(makeRequest({ idea: "Minimal valid idea" }) as any);
    expect(response.status).toBe(200);
  });

  it("accepts idea at exactly 500 characters", async () => {
    const response = await POST(makeRequest({ idea: "a".repeat(500) }) as any);
    expect(response.status).toBe(200);
  });
});
