from pydantic import BaseModel
from typing import Dict, Any

class AnnotationPayload(BaseModel):
    keyframes: Dict[str, Any]
