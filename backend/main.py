from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import uuid
import os
import shutil
import cv2
import json

from database import SessionLocal,Base,engine
from models import Video, Annotation
from schemas import AnnotationPayload

# ---------------- APP ----------------
app = FastAPI()

Base.metadata.create_all(bind=engine)

# ---------------- CORS ----------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- CONFIG ----------------
DATA_DIR = "data"
FRAMES_DIR = os.path.join(DATA_DIR, "frames")
os.makedirs(FRAMES_DIR, exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL")

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
    if not ann:
        return {"keyframes": {}, "metadata": {}}

    return {
        "video_id": ann.video_id,
        "keyframes": ann.keyframes or {},
        "metadata": ann.meta or {}
    }

@app.post("/video/{video_id}/annotations")
def save_annotations(
    video_id: str,
    payload: AnnotationPayload,
    db: Session = Depends(get_db)
):
    ann = db.query(Annotation).filter_by(video_id=video_id).first()

    # 🔑 CREATE IF MISSING
    if not ann:
        ann = Annotation(
            video_id=video_id,
            keyframes={},
            meta={}
        )
        db.add(ann)
        db.commit()
        db.refresh(ann)

    # ---- KEYFRAMES ----
    if payload.keyframes:
        existing = ann.keyframes or {}

        for frame, incoming in payload.keyframes.items():
            frame = str(frame)

            if incoming.rejected is True:
                existing[frame] = {"rejected": True}
                continue

            if frame not in existing or existing[frame].get("rejected"):
                existing[frame] = {}

            for k, v in incoming.model_dump(exclude_unset=True).items():
                if k == "rejected" and v is False:
                    continue
                existing[frame][k] = v

        ann.keyframes = existing

    # ---- METADATA ----
    if payload.meta:
        ann.meta = {
            **(ann.meta or {}),
            **payload.meta.model_dump(exclude_unset=True)
        }

    db.commit()

    return {"status": "saved"}

@app.post("/video/{video_id}/annotations/status")
def update_annotation_status(
    video_id: str,
    status: str,
    db: Session = Depends(get_db)
):
    if status not in {"in_progress", "review", "final"}:
        raise HTTPException(400, "Invalid status")

    ann = db.query(Annotation).filter_by(video_id=video_id).first()
    if not ann:
        raise HTTPException(404, "Annotation not found")

    ann.status = status
    db.commit()

    return {"status": ann.status}

# ---------------- HEALTH ----------------

@app.get("/")
def root():
    return {"status": "FLINT backend running"}
