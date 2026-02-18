import os
import json
import asyncio
from typing import Literal
from dotenv import load_dotenv
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel, field_validator

from analyzer import IdeaAnalyzer

load_dotenv()

app = FastAPI(title="Valid8 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VALID_MODES = {"hackathon", "sideproject"}


class AnalyzeRequest(BaseModel):
    idea: str
    mode: str = "hackathon"

    @field_validator("idea")
    @classmethod
    def idea_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("아이디어를 입력해주세요.")
        if len(v) > 500:
            raise ValueError("아이디어는 500자 이내로 입력해주세요.")
        return v

    @field_validator("mode")
    @classmethod
    def mode_valid(cls, v: str) -> str:
        if v not in VALID_MODES:
            raise ValueError(f"유효하지 않은 모드입니다. ({', '.join(VALID_MODES)})")
        return v


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
