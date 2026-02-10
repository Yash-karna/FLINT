# API Documentation — FLINT Backend

## Base URL

```
http://localhost:8000
```

Production:

```
https://<your-domain>
```

Interactive Swagger UI:

```
/docs
```

---

# API Overview

The FLINT API provides endpoints for:

* video upload & frame extraction
* frame retrieval
* annotation persistence
* metadata management

Design principles:

* **single annotation per video**
* safe merge updates
* deterministic label inheritance
* storage abstraction (local/S3)

---

---

# Upload Video

## Endpoint

```
POST /upload-video
```

### Purpose

Uploads a video, extracts frames, initializes annotation storage.

---

### Request

**Content-Type**

```
multipart/form-data
```

**Body**

| Field | Type   | Required | Description |
| ----- | ------ | -------- | ----------- |
| file  | binary | ✅        | Video file  |

---

### Response

```json
{
  "video_id": "uuid",
  "total_frames": 120
}
```

---

### Behavior

Server:

* stores video
* extracts frames
* initializes annotation row
* returns metadata

---

---

# Fetch Frame

## Endpoint

```
GET /video/{video_id}/frame/{frame}
```

### Parameters

| Param    | Type    | Description |
| -------- | ------- | ----------- |
| video_id | string  | video UUID  |
| frame    | integer | frame index |

---

### Response Modes

#### Local storage mode

Returns:

```
image/jpeg
```

Direct file stream.

---

#### S3 storage mode

Returns:

```json
{
  "url": "https://bucket/frame.jpg"
}
```

Frontend loads image from URL.

---

### Errors

```
404 — frame not found
```

---

---

# Save Annotation

## Endpoint

```
POST /video/{video_id}/annotations
```

### Purpose

Safely merges annotation updates and metadata.

---

### Request Body

```json
{
  "keyframes": {
    "6": {
      "gender": "M",
      "emotion": "neutral"
    },
    "12": {
      "rejected": true
    }
  },
  "metadata": {
    "polarity": "fake",
    "tool": "deepfake",
    "architecture": "GAN"
  }
}
```

---

### Keyframe Rules

#### Normal keyframe

```json
{
  "gender": "F"
}
```

Merged into existing frame labels.

---

#### Rejected frame

```json
{
  "rejected": true
}
```

Inheritance skips this frame.

---

### Metadata Behavior

Metadata merges:

```
existing + incoming updates
```

No destructive overwrite.

---

### Response

```json
{
  "status": "saved"
}
```

---

### Errors

```
404 — annotation not found (auto-created if configured)
422 — schema validation failure
```

---

---

# Fetch Annotation 

## Endpoint

```
GET /video/{video_id}/annotations
```

### Response

```json
{
  "keyframes": {...},
  "metadata": {...}
}
```

Used for:

* reload persistence
* frontend state recovery

---

---

# Annotation Model

## Keyframes Structure

```json
{
  "frame_number": {
    "labels..."
  }
}
```

Example:

```json
{
  "6": { "gender": "M" },
  "12": { "rejected": true }
}
```

---

## Metadata Structure

```json
{
  "polarity": "real | fake",
  "tool": "...",
  "architecture": "..."
}
```

---

---

# Inheritance Logic (Client-side)

For any frame:

```
use nearest previous non-rejected keyframe
```

This ensures:

* minimal relabeling
* continuity
* single-frame rejection support

---

---

# Error Handling

| Status | Meaning            |
| ------ | ------------------ |
| 400    | invalid request    |
| 404    | resource not found |
| 422    | validation error   |
| 500    | server error       |

---

---

# Concurrency Model

Current system guarantees:

```
1 video → 1 annotation record
```

Future locking mechanisms may be added.

---

---

#  Storage Awareness

API behavior adapts based on:

```
STORAGE_MODE = local | s3
```

No client changes required.

---

---

# Testing Tips

Use Swagger UI:

```
/docs
```

Or curl:

```bash
curl -X POST http://localhost:8000/upload-video -F file=@test.mp4
```

---

---

# API Guarantees

* idempotent annotation merges
* schema validation
* persistence safety
* storage abstraction

---

---

# Future API Extensions

Planned endpoints:

* annotation locking
* batch export
* review workflow
* user auth
* audit logs

---