from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import uuid
import os
import shutil
import cv2
import json

from storage import save_frame, FRAMES_DIR
from storage import get_frame as storage_get_frame
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

def extract_frames(video_path: str, video_id: str) -> int:
    out_dir = os.path.join(FRAMES_DIR, video_id)
    os.makedirs(out_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        count += 1
        frame_path = os.path.join(out_dir, f"{count}.jpg")

        cv2.imwrite(frame_path, frame)

        save_frame(video_id, count, frame_path)

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

    total_frames = extract_frames(video_path, video_id)

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
    result = storage_get_frame(video_id, frame)

    if result is None:
        raise HTTPException(404, "Frame not found")

    return result

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
