import os
import json
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from typing import Literal
from pydantic import BaseModel, Field

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
    idea: str = Field(..., min_length=1, max_length=500)
    mode: Literal["hackathon", "startup", "sideproject"] = "hackathon"


@app.post("/api/analyze")
async def analyze_idea(req: AnalyzeRequest):
    analyzer = IdeaAnalyzer(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", ""),
        github_token=os.getenv("GITHUB_TOKEN", ""),
    )

    async def event_generator():
        async for step in analyzer.analyze(req.idea, req.mode):
            yield {"event": step["event"], "data": json.dumps(step["data"], ensure_ascii=False)}

    return EventSourceResponse(event_generator())


@app.get("/health")
async def health():
    return {"status": "ok"}
