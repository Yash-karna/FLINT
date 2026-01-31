import { useEffect, useState } from "react"

const API = import.meta.env.VITE_API_URL

// ---------------- TYPES ----------------
type Labels = {
  gender?: string
  ethnicity?: string
  age?: string
  skin_tone?: string

  beard?: string
  occlusion?: string
  face_lighting?: string
  camera_angle?: string
  network_artifact?: string

  lip_jitter?: string
  eye_blink_rate?: string
  head_motion_lag?: string
  phoneme_alignment?: string
  jaw_motion_alignment?: string

  audio_origin?: string
  speaker?: number
  rejected?: boolean
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

  for (const f of frames) {
    const labels = keyframes[f]
    if(!labels) continue

    if (labels?.rejected) continue
    return { ...labels }
  }
  
  return {}
}

// ---------------- APP ----------------
export default function App() {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [totalFrames, setTotalFrames] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(1)
  const [keyframes, setKeyframes] = useState<Record<number, Labels>>({})
  const [zoom, setZoom] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [annotationStatus, setAnnotationStatus] = useState<"in_progress" | "review" | "final">("in_progress")


  // ---------------- VIDEO UPLOAD ----------------
  async function handleUpload(file: File) {
    setIsUploading(true)

    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch(`${API}/upload-video`, {
      method: "POST",
      body: formData,
    })
    if (!res.ok) {
      throw new Error("Upload failed")
    }

    const data = await res.json()

    setVideoId(data.video_id)
    setTotalFrames(data.total_frames)
    setCurrentFrame(1)
    setKeyframes({})
    setZoom(1)
    setIsUploading(false)

    localStorage.setItem(
      "flint_video",
      JSON.stringify({
        videoId: data.video_id,
        totalFrames: data.total_frames,
      })
    )
  }

  // ---------------- EXPORT ----------------
  function exportAnnotations() {
    if (!videoId) return

    const payload = {
      videoId,
      totalFrames,
      keyframes,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `flint_${videoId}_annotations.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ---------------- LOAD SAVED VIDEO ----------------
  useEffect(() => {
    const saved = localStorage.getItem("flint_video")
    if (!saved) return
    const { videoId, totalFrames } = JSON.parse(saved)
    setVideoId(videoId)
    setTotalFrames(totalFrames)
    setCurrentFrame(1)
  }, [])

  // ---------------- LOAD ANNOTATIONS ----------------
  useEffect(() => {
    if (!videoId) return

    fetch(`${API}/video/${videoId}/annotations`)
      .then(res => res.json())
      .then(data => {
        setAnnotationStatus(data.status ?? "in_progress")

        if (!data.keyframes) return

        const normalized: Record<number, Labels> = {}
        Object.entries(data.keyframes).forEach(([k, v]) => {
          normalized[Number(k)] = v as Labels
        })
        setKeyframes(normalized)
      })
  },[videoId])
  
  // ---------------- DERIVED ----------------
  const currentLabels = getLabelsForFrame(currentFrame, keyframes)
  const frameUrl = `${API}/video/${videoId}/frame/${currentFrame}`
  const isRejected = !!keyframes[currentFrame]?.rejected
  const locked = annotationStatus === "final"

  const keyframeFrames = Object.keys(keyframes)
    .map(Number)
    .sort((a, b) => a - b)

  const prevKeyframe = [...keyframeFrames]
    .reverse()
    .find(f => f < currentFrame)

  const nextKeyframe = keyframeFrames.find(f => f > currentFrame)

  // ---------------- AUTOSAVE ----------------
  useEffect(() => {
    if (!videoId || locked) return

    const id = setTimeout(() => {
      fetch(`${API}/video/${videoId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyframes }),
      })
    }, 600)

    return () => clearTimeout(id)
  }, [keyframes, videoId, locked])

  
  // ---------------- UPLOAD INPUT ----------------
  const uploadInput = (
    <input
      id="video-upload"
      type="file"
      accept="video/*"
      style={{ display: "none" }}
      onChange={e => {
        const file = e.target.files?.[0]
        if (file) handleUpload(file)
        e.target.value = ""
      }}
    />
  )

  // ---------------- PRE-UPLOAD UI ----------------
  if (!videoId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        {uploadInput}
        <div style={{ textAlign: "center", width: 520 }}>
          <h1 style={{ fontSize: 44, marginBottom: 6 }}>FLINT</h1>
          <p style={{ opacity: 0.7 }}>Frame Level Intelligent Tagging</p>
          <p style={{ fontSize: 13, opacity: 0.6 }}>A ProjectKarna Tool</p>

          <button onClick={() => document.getElementById("video-upload")?.click()}>
            Upload Video
          </button>

          {isUploading && <p style={{ marginTop: 10 }}>Extracting frames…</p>}
        </div>
      </div>
    )
  }

  // ---------------- MAIN UI ----------------
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        paddingTop: 20,
        fontFamily: "Inter, Arial, sans-serif",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        paddingBottom: 12,
      }}
    >
      {uploadInput}

      <div style={{ width: 760 }}>
        {/* HEADER BAR */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            {/* LEFT: LOGO / TITLE */}
            <div>
              <h1 style={{ margin: 0, fontSize: 28 }}>FLINT</h1>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Frame Level Intelligent Tagging · ProjectKarna
              </div>
            </div>

            {/* RIGHT: ACTIONS */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={annotationStatus}
                onChange={e => {
                  const status = e.target.value as
                    | "in_progress"
                    | "review"
                    | "final"

                  setAnnotationStatus(status)

                  fetch(`${API}/video/${videoId}/annotations/status`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status }),
                  })
                }}
              >
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="final">Final (Lock)</option>
              </select>

              <button onClick={() => document.getElementById("video-upload")?.click()}>
                Upload New Video
              </button>

              <button onClick={exportAnnotations}>
                Export Keyframes
              </button>
            </div>
          </div>



        {/* FRAME VIEWER */}
        <div
          style={{
            width: 640,
            height: 360,
            margin: "0 auto",
            background: "#000",
            border: "1px solid #888",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            paddingBottom: 12,
          }}
        >
          <img
            src={frameUrl}
            alt={`Frame ${currentFrame}`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              transform: `scale(${zoom})`,
              objectFit: "contain",
            }}
          />
        </div>

        {/* ZOOM */}
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>−</button>
          <span style={{ margin: "0 12px" }}>{zoom.toFixed(1)}x</span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}>+</button>
          {isRejected && (
            <span style={{ color: "red", marginLeft: 12 }}>✖ Rejected</span>
          )}
        </div>

        {/* NAV */}
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button
            disabled={prevKeyframe === undefined}
            onClick={() => prevKeyframe && setCurrentFrame(prevKeyframe)}
          >
            ⏮ Prev Keyframe
          </button>

          <button
            disabled={currentFrame <= 10}
            onClick={() => setCurrentFrame(f => f - 10)}
          >
            -10
          </button>

          <button
            disabled={currentFrame === 1}
            onClick={() => setCurrentFrame(f => f - 1)}
          >
            ◀ Prev
          </button>

          <button
            disabled={currentFrame === totalFrames}
            onClick={() => setCurrentFrame(f => f + 1)}
          >
            Next ▶
          </button>

          <button
            disabled={currentFrame + 10 > totalFrames}
            onClick={() => setCurrentFrame(f => f + 10)}
          >
            +10
          </button>

          <button
            disabled={nextKeyframe === undefined}
            onClick={() => nextKeyframe && setCurrentFrame(nextKeyframe)}
          >
            Next Keyframe ⏭
          </button>
        </div>

        {locked && (
          <p style={{ color: "red", textAlign: "center", marginTop: 8 }}>
            🔒 Annotations are finalized and read-only
          </p>
        )}

        <p style={{ textAlign: "center" }}>
          Frame <b>{currentFrame}</b> / {totalFrames}
          {keyframes[currentFrame] && (!isRejected) && (
            <span style={{ color: "green", marginLeft: 10 }}>● Keyframe</span>
          )}
        </p>

        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <input
            type="number"
            min={1}
            max={totalFrames}
            placeholder="Jump to frame"
            style={{ width: 140 }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const value = Number((e.target as HTMLInputElement).value)
                if (value >= 1 && value <= totalFrames) {
                  setCurrentFrame(value)
                }
              }
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 6,
            fontSize: 11,
          }}
        >
          {keyframeFrames.map((f) => {
            const isRejectedFrame = !!keyframes[f]?.rejected

            return (
              <span
                key={f}
                onClick={() => setCurrentFrame(f)}
                style={{
                  cursor: "pointer",
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: isRejectedFrame
                    ? "#b71c1c"
                    : f === currentFrame
                    ? "#4caf50"
                    : f < currentFrame
                    ? "#777"
                    : "#333"
                }}
              >
                {f}
              </span>
            )
          })}

        </div>
            
        <hr />

        {/* LABELS */}
        <h5 style={{ marginBottom : 6, marginTop: 10, opacity: 0.8, fontWeight: 500}}>Identity</h5>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            disabled = {locked || isRejected}
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
            disabled = {locked || isRejected}
            value={currentLabels.ethnicity ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  ethnicity: e.target.value || undefined,
                },
              }))
            }
          >
            <option value="">Ethnicity</option>
            <option value="asian">Asian</option>
            <option value="south_asian">South Asian</option>
            <option value="east_asian">East Asian</option>
            <option value="black">Black</option>
            <option value="white">White</option>
            <option value="middle_eastern">Middle Eastern</option>
            <option value="latino">Latino</option>
            <option value="other">Other</option>
          </select>

          <select
            disabled = {locked || isRejected}
            value={currentLabels.age ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  age: e.target.value || undefined,
                },
              }))
            }
          >
            <option value="">Age</option>
            <option value="child">Child</option>
            <option value="teen">Teen</option>
            <option value="young_adult">Young Adult</option>
            <option value="adult">Adult</option>
            <option value="middle_aged">Middle Aged</option>
            <option value="senior">Senior</option>
          </select>

          <select
            disabled = {locked || isRejected}
            value={currentLabels.skin_tone ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  skin_tone: e.target.value || undefined,
                },
              }))
            }
          >
            <option value="">Skin Tone</option>
            <option value="very_light">Very Light</option>
            <option value="light">Light</option>
            <option value="medium">Medium</option>
            <option value="olive">Olive</option>
            <option value="brown">Brown</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <h5 style={{ marginBottom : 6, marginTop: 10, opacity: 0.8, fontWeight: 500}}>Visual</h5>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            disabled = {locked || isRejected}
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
            disabled = {locked || isRejected}
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
            <option value="glasses">Glasses</option>
            <option value="mic">Mic</option>
            <option value="headphone">Headphone</option>
            <option value="cap">Cap</option>
          </select>
          
          <select
            disabled = {locked || isRejected}
            value={currentLabels.face_lighting ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  face_lighting: e.target.value as Labels["face_lighting"],
                },
              }))
            }
          >
            <option value="">Face Lighting</option>
            <option value="well-lit">Well-lit</option>
            <option value="front-lit">Front-lit</option>
            <option value="back-lit">Back-lit</option>
            <option value="uneven">Uneven</option>
            <option value="dim">Dim</option>
            <option value="over-exposed">Over exposed</option>
            <option value="very-dim">Very Dim</option>
          </select>
          
          <select
            disabled = {locked || isRejected}
            value={currentLabels.camera_angle ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  camera_angle: e.target.value as Labels["camera_angle"],
                },
              }))
            }
          >
            <option value="">Camera Angle</option>
            <option value="front">Front facing</option>
            <option value="slight-turn">Slight Turn</option>
            <option value="side">Side View</option>
            <option value="upwards">Upwards</option>
            <option value="downwards">Downwards</option>
          </select>

          <input
            disabled = {locked || isRejected}
            type="number"
            placeholder="Speaker"
            value={currentLabels.speaker ?? "0"}
            style={{ width: 90 }}
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
          />
        </div>
      
      <h5 style={{ marginBottom: 6, marginTop: 14, opacity: 0.8, fontWeight: 500 }}>Audio</h5>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            disabled = {locked || isRejected}
            value={currentLabels.phoneme_alignment ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  phoneme_alignment: e.target.value as Labels["phoneme_alignment"],
                },
              }))
            }
          >
            <option value="">Phoneme Allignment</option>
            <option value="in-sync">In-Sync</option>
            <option value="severe-mismatch">Severe Mismatch</option>
            <option value="slight-mismatch">Slight Mismatch</option>
          </select>
          
          <select
            disabled = {locked || isRejected}
            value={currentLabels.jaw_motion_alignment ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  jaw_motion_alignment: e.target.value as Labels["jaw_motion_alignment"],
                },
              }))
            }
          >
            <option value="">Jaw Motion Allignment</option>
            <option value="in-sync">In-Sync</option>
            <option value="severe-mismatch">Severe Mismatch</option>
            <option value="slight-mismatch">Slight Mismatch</option>
          </select>

          <select
            disabled = {locked || isRejected}
            value={currentLabels.audio_origin ?? ""}
            onChange={e =>
              setKeyframes(prev => ({
                ...prev,
                [currentFrame]: {
                  ...getLabelsForFrame(currentFrame, prev),
                  audio_origin: e.target.value as Labels["audio_origin"],
                },
              }))
            }
          >
            <option value="">Audio Origin</option>
            <option value="real">Real</option>
            <option value="synthetic">Synthetic</option>
          </select>
      </div>
        {/* REJECT */}
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={isRejected}
              onChange={e =>
                setKeyframes(prev => ({
                  ...prev,
                  [currentFrame]: e.target.checked
                    ? { rejected: true }
                    : {},
                }))
              }
            />
            Reject this frame (poor quality / unusable)
          </label>
        </div>
      </div>
    </div>
  )
}
