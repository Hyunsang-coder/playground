from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from youtube_transcript_api import YouTubeTranscriptApi

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


@app.post("/transcript")
def get_transcript(body: dict):
    video_id = body.get("videoId")
    if not video_id:
        raise HTTPException(status_code=400, detail="videoId is required")

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript = ytt_api.fetch(video_id, languages=["ko", "en"])

        segments = [
            {
                "text": snippet.text,
                "offset": int(snippet.start * 1000),
                "duration": int(snippet.duration * 1000),
            }
            for snippet in transcript.snippets
        ]

        return {"videoId": video_id, "segments": segments}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
