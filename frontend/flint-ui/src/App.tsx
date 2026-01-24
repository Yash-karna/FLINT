import { useEffect, useState } from "react"

const API = "http://localhost:8000"

// ---------------- TYPES ----------------
type Labels = {
  gender?: "M" | "F"
  beard?: "zero" | "light" | "medium" | "heavy"
  occlusion?: "none" | "hand"
  speaker?: number
}

// ---------------- UTILS ----------------
function getLabelsForFrame(
  frame: number,
  keyframes: Record<number, Labels>
): Labels {
  const frames = Object.keys(keyframes)
    .map(Number)
    .filter(f => f <= frame)
    .sort((a, b) => b - a)

  return frames.length ? keyframes[frames[0]] : {}
}

// ---------------- APP ----------------
export default function App() {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [totalFrames, setTotalFrames] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(1)

  const [keyframes, setKeyframes] = useState<Record<number, Labels>>({})

  const [zoom, setZoom] = useState(1)
  const [isUploading, setIsUploading] = useState(false)

  // ---------------- VIDEO UPLOAD ----------------
  async function handleUpload(file: File) {
    setIsUploading(true)

    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch(`${API}/upload-video`, {
      method: "POST",
      body: formData,
    })

    const data = await res.json()

    setVideoId(data.video_id)
    setTotalFrames(data.total_frames)
    setCurrentFrame(1)
    setKeyframes({})
    setIsUploading(false)
  }

  // ---------------- LOAD ANNOTATIONS ----------------
  useEffect(() => {
    if (!videoId) return

    fetch(`${API}/video/${videoId}/annotations`)
      .then(res => res.json())
      .then(data => {
        if (data.keyframes) setKeyframes(data.keyframes)
      })
  }, [videoId])

  // ---------------- AUTOSAVE ----------------
  useEffect(() => {
    if (!videoId) return

    const id = setInterval(() => {
      fetch(`${API}/video/${videoId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyframes }),
      })
    }, 2000)

    return () => clearInterval(id)
  }, [keyframes, videoId])

  // ---------------- PRE-UPLOAD ----------------
  if (!videoId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          paddingTop: 60,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div style={{ width: 600, textAlign: "center" }}>
          {/* LOGO / TITLE */}
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ margin: 0, fontSize: 44, letterSpacing: 1 }}>
              FLINT
            </h1>
            <p style={{ margin: "6px 0", opacity: 0.7 }}>
              Frame Level Intelligent Tagging
            </p>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.6 }}>
              A ProjectKarna Tool
            </p>
          </div>

          <input
            type="file"
            accept="video/*"
            onChange={e => {
              if (e.target.files?.[0]) {
                handleUpload(e.target.files[0])
              }
            }}
          />

          {isUploading && <p style={{ marginTop: 10 }}>Extracting frames…</p>}
        </div>
      </div>
    )
  }

  // ---------------- DERIVED ----------------
  const currentLabels = getLabelsForFrame(currentFrame, keyframes)
  const frameUrl = `${API}/video/${videoId}/frame/${currentFrame}`

  // ---------------- UI ----------------
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        paddingTop: 30,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div style={{ width: 720 }}>
        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1 style={{ margin: 0, letterSpacing: 1 }}>FLINT</h1>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Frame Level Intelligent Tagging · ProjectKarna
          </div>
        </div>

        {/* FRAME VIEWER */}
        <div
          style={{
            width: 640,
            height: 360,
            margin: "0 auto",
            border: "1px solid #999",
            background: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img
            src={frameUrl}
            alt={`Frame ${currentFrame}`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              transform: `scale(${zoom})`,
              transformOrigin: "center",
              objectFit: "contain",
            }}
          />
        </div>

        {/* ZOOM */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>−</button>
          <span style={{ margin: "0 10px" }}>{zoom.toFixed(1)}x</span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}>+</button>
        </div>

        {/* NAV */}
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button
            style={{ marginLeft: 10 }}
            disabled={currentFrame <= 10}
            onClick={() => setCurrentFrame(f => f - 10)}
          >
            -10
          </button>
          <button disabled={currentFrame === 1} onClick={() => setCurrentFrame(f => f - 1)}>
            ◀ Prev
          </button>
          <button
            style={{ marginLeft: 5 }}
            disabled={currentFrame === totalFrames}
            onClick={() => setCurrentFrame(f => f + 1)}
          >
            Next ▶
          </button>
          <button
            style={{ marginLeft: 5 }}
            disabled={currentFrame + 10 > totalFrames}
            onClick={() => setCurrentFrame(f => f + 10)}
          >
            +10
          </button>
        </div>

        <p style={{ textAlign: "center" }}>
          Frame <b>{currentFrame}</b> / {totalFrames}
          {keyframes[currentFrame] && (
            <span style={{ color: "green", marginLeft: 10 }}>● Keyframe</span>
          )}
        </p>

        <hr />

        {/* LABELS */}
        <h4>Labels</h4>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            value={currentLabels.gender ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  gender: e.target.value as Labels["gender"],
                },
              }))
            }
          >
            <option value="">Gender</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>

          <select
            value={currentLabels.beard ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  beard: e.target.value as Labels["beard"],
                },
              }))
            }
          >
            <option value="">Beard</option>
            <option value="zero">Zero</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="heavy">Heavy</option>
          </select>

          <select
            value={currentLabels.occlusion ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  occlusion: e.target.value as Labels["occlusion"],
                },
              }))
            }
          >
            <option value="">Occlusion</option>
            <option value="none">None</option>
            <option value="hand">Hand</option>
          </select>

          <input
            type="number"
            placeholder="Speaker"
            value={currentLabels.speaker ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  speaker:
                    e.target.value === ""
                      ? undefined
                      : Number(e.target.value),
                },
              }))
            }
            style={{ width: 80 }}
          />
        </div>

        {keyframes[currentFrame] && (
          <button
            style={{ marginTop: 10 }}
            onClick={() =>
              setKeyframes(prev => {
                const copy = { ...prev }
                delete copy[currentFrame]
                return copy
              })
            }
          >
            Remove Keyframe
          </button>
        )}
      </div>
    </div>
  )
}
