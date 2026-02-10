# FLINT — Frame Level Intelligent Tagging

## Production Documentation Blueprint

Below is a **ready-to-use README structure** tailored to your current architecture (FastAPI + React + optional S3 storage).

---

## Project Overview

FLINT is a frame-level video annotation platform designed for structured labeling workflows. It supports:

* Keyframe-based annotation
* Label inheritance
* Rejection handling
* Video metadata tagging
* Persistent annotation storage
* Optional S3-backed storage
* Local + cloud deployment modes

---

## Architecture

### Backend

* **Framework:** FastAPI
* **Database:** SQLAlchemy + SQLite/Postgres
* **Storage layer:** Pluggable (Local filesystem or AWS S3)
* **Core features:**

  * Video upload + frame extraction
  * Annotation persistence
  * Metadata handling
  * Storage abstraction

### Frontend

* **Framework:** React + Vite + TypeScript
* Annotation UI
* Frame navigation
* Autosave support
* Label inheritance logic

---

## 📁 Project Structure

```
FLINT/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── storage.py
│   ├── init_db.py
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── types/
│   │   ├── utils/
│   │   └── assets/
│   ├── vite.config.ts
│   └── .env.example
│
├── requirements.txt
└── README.md
```

---

## ⚙ Environment Configuration

### Backend `cp .env.example .env`

### Local storage mode

```
STORAGE_MODE=local
DATABASE_URL=sqlite:///flint.db
```

### S3 storage mode

```
STORAGE_MODE=s3
DATABASE_URL=postgresql://...

AWS_REGION=...
AWS_ACCESS_KEY=...
AWS_SECRET_KEY=...
S3_BUCKET=...
```

---

### Frontend `.env`

```
VITE_API_URL=http://localhost:8000
```

---

## 🛠 Local Development Setup

### Backend

```
cd backend
pip install -r ../requirements.txt
python init_db.py
uvicorn main:app --reload
```

Backend runs at:

```
http://localhost:8000
```

Swagger docs:

```
http://localhost:8000/docs
```

---

### Frontend

```
cd frontend
npm install
npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

##  Workflow Overview

### Upload video

```
POST /upload-video
```

Backend:

* stores video
* extracts frames
* initializes annotation record

---

### Fetch frame

```
GET /video/{video_id}/frame/{frame}
```

* local → serves image file
* S3 → returns URL

---

### Save annotation

```
POST /video/{video_id}/annotations
```

Features:

* safe merge updates
* rejection handling
* metadata persistence
* lazy annotation creation

---

## Annotation Logic Rules

### Label inheritance

Frames inherit labels from the closest previous **non-rejected keyframe**.

This ensures:

* minimal manual labeling
* single-frame rejection support
* annotation continuity

---

### Rejection behavior

If a keyframe is marked rejected:

```
frame = { rejected: true }
```

Inheritance skips it automatically.

---

### Metadata persistence

Video-level metadata merges safely:

```
existing metadata + incoming updates
```

No overwrite loss.

---

## Storage Modes

### Local mode

* frames stored on disk
* direct file serving

### S3 mode

* frames uploaded to bucket
* API returns S3 URL
* frontend loads remotely

Switch via:

```
STORAGE_MODE
```

No frontend changes required.

---

## Deployment Guide

### Backend (EC2 / server)

```
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Recommended production stack:

```
Gunicorn + Uvicorn workers
Nginx reverse proxy
```

---

### Frontend (static hosting)

Build:

```
npm run build
```

Deploy to:

* S3 static hosting
* Vercel
* Netlify
* Nginx server

---

### CORS setup

Backend must allow frontend origin:

```python
CORSMiddleware(
    allow_origins=["http://localhost:5173"],
)
```

Adjust for production domain.

---

## Testing Checklist

Before deployment verify:

✅ video upload
✅ frame navigation
✅ label persistence after refresh
✅ metadata save
✅ inheritance logic
✅ rejected frame behavior
✅ backend restart recovery
✅ S3 mode toggle

---

## Future Extensions

* multi-user locking
* annotation audit logs
* job queue frame extraction
* direct S3 upload
* CDN acceleration
* authentication layer
* review workflow

---

## Developer Notes

Key design principles:

* single annotation per video
* storage abstraction layer
* deterministic inheritance logic
* backend authority over data
* frontend stateless UI

---

## Known Constraints

* no auth yet
* single annotator workflow
* synchronous frame extraction

---

## Deployment Philosophy

Same codebase supports:

```
local dev → staging → production
```

via environment configuration only.

---