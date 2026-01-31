from pydantic import BaseModel
from typing import Dict, Optional

class LabelSchema(BaseModel):
    # Identity
    gender: Optional[str] = None
    ethnicity: Optional[str] = None
    age: Optional[str] = None
    skin_tone: Optional[str] = None

    # Face / visual
    beard: Optional[str] = None
    is_occlusion: Optional[str] = None
    face_lighting: Optional[str] = None
    camera_angle: Optional[str] = None
    network_artifact: Optional[str] = None

    # Motion / sync
    lip_jitter: Optional[str] = None
    eye_blink_rate: Optional[str] = None
    head_motion_lag: Optional[str] = None
    phoneme_alignment: Optional[str] = None
    jaw_motion_alignment: Optional[str] = None

    # Audio
    audio_origin: Optional[str] = None

    # Speaker & control
    speaker: Optional[int] = None
    rejected: Optional[bool] = None


class AnnotationPayload(BaseModel):
    keyframes: Dict[int, LabelSchema]