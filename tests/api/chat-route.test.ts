import { describe, it, expect, vi } from "vitest";

// Mock the AI SDK to prevent real API calls
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: vi.fn().mockReturnValue({
      toUIMessageStreamResponse: () =>
        new Response("data: test\n\n", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
    }),
    convertToModelMessages: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue({}),
}));

const { POST } = await import("../../app/api/chat/route");

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validMessage = { role: "user", content: [{ type: "text", text: "hello" }], id: "1" };

describe("POST /api/chat", () => {
  it("returns 400 for invalid JSON", async () => {
    const request = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when messages is missing", async () => {
    const response = await POST(makeRequest({ analysisResults: [] }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("messages");
  });

  it("returns 400 when messages is not an array", async () => {
    const response = await POST(makeRequest({ messages: "not an array" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("messages");
  });

  it("returns 400 when messages exceeds 40 items", async () => {
    const messages = Array.from({ length: 41 }, () => validMessage);
    const response = await POST(makeRequest({ messages }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("40");
  });

  it("returns 400 when analysisResults is not an array", async () => {
    const response = await POST(makeRequest({ messages: [validMessage], analysisResults: "bad" }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("analysisResults");
  });

  it("returns 200 for valid minimal request", async () => {
    const response = await POST(makeRequest({ messages: [validMessage] }));
    expect(response.status).toBe(200);
  });

  it("returns 200 with messages and analysisResults", async () => {
    const response = await POST(
      makeRequest({
        messages: [validMessage],
        analysisResults: [{ step: 1, title: "Step 1", result: {} }],
      })
    );
    expect(response.status).toBe(200);
  });

  it("accepts exactly 40 messages", async () => {
    const messages = Array.from({ length: 40 }, () => validMessage);
    const response = await POST(makeRequest({ messages }));
    expect(response.status).toBe(200);
  });
});
