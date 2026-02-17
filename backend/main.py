import os
import json
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from analyzer import IdeaAnalyzer

load_dotenv()

app = FastAPI(title="KillMyIdea API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    idea: str
    mode: str = "hackathon"  # "hackathon" | "startup" | "sideproject"


@app.post("/api/analyze")
async def analyze_idea(req: AnalyzeRequest):
    analyzer = IdeaAnalyzer(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        tavily_api_key=os.getenv("TAVILY_API_KEY", ""),
        github_token=os.getenv("GITHUB_TOKEN", ""),
    )

    async def event_generator():
        async for step in analyzer.analyze(req.idea, req.mode):
            yield {"event": step["event"], "data": json.dumps(step["data"], ensure_ascii=False)}

    return EventSourceResponse(event_generator())


@app.get("/health")
async def health():
    return {"status": "ok"}
