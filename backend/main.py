from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

app = FastAPI()

# ✅ CORS FIX
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRAMES_DIR = Path("frames/demo_video")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/video/frames")
def get_video_meta():
    frames = sorted(FRAMES_DIR.glob("*.jpg"))
    return {
        "total_frames": len(frames),
        "video_id": "demo_video"
    }

@app.get("/video/frame/{frame_no}")
def get_frame(frame_no: int):
    frame_path = FRAMES_DIR / f"frame_{frame_no:06d}.jpg"
    if not frame_path.exists():
        return {"error": "Frame not found"}
    return FileResponse(frame_path)
