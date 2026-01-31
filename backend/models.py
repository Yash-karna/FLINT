from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.sql import func
from database import Base

class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True, index=True)
    total_frames = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(String, index=True)
    keyframes = Column(JSON, nullable=False)
    status = Column(String, default="in_progress", nullable=False)
    meta = Column(JSON, nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())