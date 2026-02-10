import os
from fastapi.responses import FileResponse

MODE = os.getenv("STORAGE_MODE", "local")

# ---------- LOCAL STORAGE ----------
DATA_DIR = "data"
FRAMES_DIR = os.path.join(DATA_DIR, "frames")


def save_local(file_bytes, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(file_bytes)


def get_local_frame(video_id, frame):
    path = os.path.join(FRAMES_DIR, video_id, f"{frame}.jpg")
    if not os.path.exists(path):
        return None
    return FileResponse(path)


# ---------- S3 STORAGE ----------
if MODE == "s3":
    import boto3

    s3 = boto3.client(
        "s3",
        region_name=os.getenv("AWS_REGION"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY"),
        aws_secret_access_key=os.getenv("AWS_SECRET_KEY"),
    )

    BUCKET = os.getenv("S3_BUCKET")

    def upload_s3(local_path, key):
        s3.upload_file(local_path, BUCKET, key)

    def s3_url(video_id, frame):
        key = f"frames/{video_id}/{frame}.jpg"
        return {
            "url": f"https://{BUCKET}.s3.amazonaws.com/{key}"
        }


# ---------- UNIFIED API ----------

def save_frame(video_id, frame, local_path):
    if MODE == "local":
        return
    upload_s3(local_path, f"frames/{video_id}/{frame}.jpg")


def get_frame(video_id, frame):
    if MODE == "local":
        return get_local_frame(video_id, frame)
    return s3_url(video_id, frame)
