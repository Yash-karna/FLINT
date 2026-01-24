from fastapi import FastAPI, Body, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import uuid
import subprocess

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

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

UPLOAD_DIR = Path("uploads")
FRAMES_DIR = Path("frames")

UPLOAD_DIR.mkdir(exist_ok=True)
FRAMES_DIR.mkdir(exist_ok=True)

@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):
    video_id = str(uuid.uuid4())[:8]
    video_path = UPLOAD_DIR / f"{video_id}.mp4"
    frame_dir = FRAMES_DIR / video_id

    frame_dir.mkdir(parents=True, exist_ok=True)

    # Save video
    with open(video_path, "wb") as f:
        f.write(await file.read())

    # Extract frames using ffmpeg
    subprocess.run([
        "ffmpeg",
        "-i", str(video_path),
        str(frame_dir / "frame_%06d.jpg")
    ], check=True)

    total_frames = len(list(frame_dir.glob("*.jpg")))

    return {
        "video_id": video_id,
        "total_frames": total_frames
    }

@app.get("/video/{video_id}/frames")
def get_video_meta(video_id: str):
    frame_dir = FRAMES_DIR / video_id
    frames = sorted(frame_dir.glob("*.jpg"))
    return {
        "video_id": video_id,
        "total_frames": len(frames)
    }

@app.get("/video/{video_id}/frame/{frame_no}")
def get_frame(video_id: str, frame_no: int):
    frame_path = FRAMES_DIR / video_id / f"frame_{frame_no:06d}.jpg"
    if not frame_path.exists():
        return {"error": "Frame not found"}
    return FileResponse(frame_path)

def data_file(video_id: str):
    return DATA_DIR / f"{video_id}.json"

@app.get("/video/{video_id}/annotations")
def load_annotations(video_id: str):
    file = data_file(video_id)
    if not file.exists():
        return {"keyframes": {}}

    with open(file) as f:
        return json.load(f)

@app.post("/video/{video_id}/annotations")
def save_annotations(video_id: str, payload: dict = Body(...)):
    file = data_file(video_id)
    with open(file, "w") as f:
        json.dump(payload, f)

    return {"status": "saved"}

@app.post("/video/{video_id}/lock")
def lock_video(video_id: str, user: str):
    file = data_file(video_id)

    if file.exists():
        with open(file) as f:
            data = json.load(f)
            if data.get("locked_by") and data["locked_by"] != user:
                return {"locked": False, "by": data["locked_by"]}

    data = {
        "video_id": video_id,
        "locked_by": user,
        "keyframes": {}
    }
    with open(file, "w") as f:
        json.dump(data, f)

    return {"locked": True}

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
