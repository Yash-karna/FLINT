from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import uuid
import os
import shutil
import cv2
import json

from database import SessionLocal
from models import Video, Annotation

# ---------------- APP ----------------
app = FastAPI()

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- CONFIG ----------------
DATA_DIR = "data"
FRAMES_DIR = os.path.join(DATA_DIR, "frames")
os.makedirs(FRAMES_DIR, exist_ok=True)

# ---------------- DB DEP ----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- HELPERS ----------------
def extract_frames(video_path: str, out_dir: str) -> int:
    cap = cv2.VideoCapture(video_path)
    count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        count += 1
        cv2.imwrite(os.path.join(out_dir, f"{count}.jpg"), frame)

    cap.release()
    return count

# ---------------- ROUTES ----------------

@app.post("/upload-video")
def upload_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    video_id = str(uuid.uuid4())
    video_dir = os.path.join(FRAMES_DIR, video_id)
    os.makedirs(video_dir, exist_ok=True)

    video_path = os.path.join(video_dir, file.filename)
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    total_frames = extract_frames(video_path, video_dir)

    # Save DB records
    video = Video(
        id=video_id,
        total_frames=total_frames
    )
    db.add(video)

    annotation = Annotation(
        video_id=video_id,
        keyframes={}
    )
    db.add(annotation)

    db.commit()

    return {
        "video_id": video_id,
        "total_frames": total_frames
    }

# ---------------- FRAME SERVING ----------------

@app.get("/video/{video_id}/frame/{frame}")
def get_frame(video_id: str, frame: int):
    frame_path = os.path.join(FRAMES_DIR, video_id, f"{frame}.jpg")
    if not os.path.exists(frame_path):
        raise HTTPException(status_code=404, detail="Frame not found")

    return FileResponse(frame_path)

# ---------------- ANNOTATIONS ----------------

@app.get("/video/{video_id}/annotations")
def get_annotations(video_id: str, db: Session = Depends(get_db)):
    ann = db.query(Annotation).filter_by(video_id=video_id).first()
    return {"keyframes": ann.keyframes if ann else {}}

@app.post("/video/{video_id}/annotations")
def save_annotations(
    video_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    ann = db.query(Annotation).filter_by(video_id=video_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")

    ann.keyframes = payload.get("keyframes", {})
    db.commit()

    return {"status": "saved"}

# ---------------- HEALTH ----------------

@app.get("/")
def root():
    return {"status": "FLINT backend running"}
