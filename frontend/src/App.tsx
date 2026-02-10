import { useEffect, useState, useMemo } from "react"
import type { Labels } from "./types/labels"
import { getLabelsForFrame } from "./utils/labelInheritance"
import { validateAnnotation } from "./utils/validateAnnotation"

const API = import.meta.env.VITE_API_URL

console.log("API:", import.meta.env.VITE_API_URL)

// ---------------- TYPES ----------------

export type VideoMetadata = {
  polarity?: "real" | "fake"
  generation_tool?: string
  architecture?: string
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
  const [metadata, setMetadata] = useState<VideoMetadata>({})

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

    const issues = validateAnnotation(
      { totalFrames, keyframes, VideoMetadata: metadata },
      { strict: true }
    )

    if (issues.some(i => i.type === "error")) {
      alert("Cannot export: fix validation errors first")
      return
    }

    const payload = {
      videoId,
      totalFrames,
      metadata,
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

  // ---------------- EXPORT WARNINGS -----------------
  const validationIssues = useMemo(
  () =>
    validateAnnotation(
      {
        totalFrames,
        keyframes,
        VideoMetadata: metadata,
      },
      { strict: false }
    ),
  [totalFrames, keyframes, metadata]
)


  const hasErrors = validationIssues.some(i => i.type === "error")


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
        if (data.keyframes) {
          const normalized: Record<number, Labels> = {}
          Object.entries(data.keyframes).forEach(([k, v]) => {
            normalized[Number(k)] = v as Labels
          })
          setKeyframes(normalized)
        }
        if (data.metadata) {
          setMetadata(data.metadata)
        }
      })
  }, [videoId])

  // useEffect(() => {
  //   if (!videoId) return

  //   const id = setTimeout(() => {
  //     fetch(`${API}/video/${videoId}/annotations`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ metadata }),
  //     })
  //   }, 600)

  //   return () => clearTimeout(id)
  // }, [metadata, videoId])

  
  // ---------------- DERIVED ----------------
  const currentLabels = getLabelsForFrame(currentFrame, keyframes)
  const isRejected = !!keyframes[currentFrame]?.rejected
  const locked = annotationStatus === "final"
  const isFake = metadata.polarity === "fake"
  const isReal = metadata.polarity === "real"

  const [frameUrl, setFrameUrl] = useState("")

  useEffect(() => {
    if (!videoId) return

    fetch(`${API}/video/${videoId}/frame/${currentFrame}`)
      .then(res => {
        if (res.headers.get("content-type")?.includes("application/json")) {
          return res.json().then(d => d.url)
        }
        return `${API}/video/${videoId}/frame/${currentFrame}`
      })
      .then(setFrameUrl)
  }, [videoId, currentFrame])


  const keyframeFrames = Object.keys(keyframes)
    .map(Number)
    .sort((a, b) => a - b)

  const prevKeyframe = [...keyframeFrames]
    .reverse()
    .find(f => f < currentFrame)

  const nextKeyframe = keyframeFrames.find(f => f > currentFrame)

  // ---------------- AUTOSAVE ----------------

  useEffect(() => {
    if (isReal) {
      setMetadata(m => ({
        ...m,
        generation_tool: undefined,
        architecture: undefined,
      }))
    }
  }, [isReal])


  useEffect(() => {
    if (!videoId || locked) return

    const id = setTimeout(() => {
      fetch(`${API}/video/${videoId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyframes,
          metadata,
        }),
      })
    }, 600)

    return () => clearTimeout(id)
  }, [keyframes, metadata, videoId, locked])
  
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
  const appBackground = {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #121212, #0a0a0a)",
    color: "#eaeaea",
    fontFamily: "Inter, system-ui, sans-serif",
  }
  const primaryButton = {
    background: "linear-gradient(135deg, #4caf50, #2e7d32)",
    border: "none",
    color: "#fff",
    padding: "10px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  }

  const secondaryButton = {
    background: "#1e1e1e",
    border: "1px solid #333",
    color: "#eee",
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
  }

  const dangerButton = {
    background: "#b71c1c",
    border: "1px solid #ff5252",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 8,
  }

  const labelCard = {
    background: "#0f0f0f",
    border: "1px solid #222",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  }

  if (!videoId) {
    return (
      <div
        style={{
          ...appBackground,
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {uploadInput}
        <div style={{ width: 520, textAlign: "center", background: "#111", padding: "48px 40px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", }}>
          <h1 style={{ fontSize: 48, marginBottom: 4 }}>FLINT</h1>
          <p style={{ opacity: 0.7 }}>Frame Level Intelligent Tagging</p>
          <p style={{ fontSize: 13, opacity: 0.5 }}>A ProjectKarna Tool</p>

          <button style={primaryButton} 
            onClick={() => document.getElementById("video-upload")?.click()}>
            Upload Video
          </button>

          {isUploading && <p style={{ marginTop: 12, opacity:0.7 }}>⏳Extracting frames…</p>}
        </div>
      </div>
    )
  }

  // ---------------- MAIN UI ----------------
  return (
    <div
      style={{
        ...appBackground,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      {uploadInput}

      <div style={{
        width: "100%",
        maxWidth: "1600px",
        margin: "0 auto",
        padding: "0 24px",
      }}>
        {/* HEADER BAR */}
          <div
            style={{
              background: "#0f0f0f",
              padding: "16px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 5,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
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

              {/* {validationIssues.length > 0 && (
                <div style={{
                  background: "#1e1e1e",
                  border: "1px solid #444",
                  padding: 12,
                  marginTop: 16
                }}>
                  <h4>Validation Issues</h4>
                  <ul>
                    {validationIssues.map((i, idx) => (
                      <li key={idx} style={{ color: i.type === "error" ? "#f44336" : "#ff9800" }}>
                        {i.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )} */}

              <button
                disabled={hasErrors}
                onClick={exportAnnotations}
                style={{
                  opacity: hasErrors ? 0.5 : 1,
                  cursor: hasErrors ? "not-allowed" : "pointer"
                }}
              >
                Export Annotation
              </button>

            </div>
          </div>

      

        {/* FRAME + NAV */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr 120px",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >

        {/* ZOOM */}
        {/* <div style={{ textAlign: "center", marginTop: 8 }}>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>−</button>
          <span style={{ margin: "0 12px" }}>{zoom.toFixed(1)}x</span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}>+</button> */}
          {/* {isRejected && (
            <div style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "#b71c1c",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: 12,
            }}>
              REJECTED
            </div>
          )} */}
        {/* </div> */}

        {/* NAV */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "stretch",
          }}
        >
          <button onClick={() => setCurrentFrame(f => Math.max(1, f - 1))}>
            ◀ Prev
          </button>

          <button onClick={() => setCurrentFrame(f => Math.max(1, f - 10))}>
            -10
          </button>

          <button onClick={() => prevKeyframe && setCurrentFrame(prevKeyframe)}>
            ⏮ Key
          </button>
        </div>
        <div
          style={{
            height: 350,
            background: "#000",
            borderRadius: 14,
            border: "1px solid #222",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "sticky",
            top: 16,
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
        
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "stretch",
          }}
        >
          <button onClick={() => setCurrentFrame(f => Math.min(totalFrames, f + 1))}>
            Next ▶
          </button>

          <button onClick={() => setCurrentFrame(f => Math.min(totalFrames, f + 10))}>
            +10
          </button>

          <button onClick={() => nextKeyframe && setCurrentFrame(nextKeyframe)}>
            Key ⏭
          </button>
        </div>
        </div>


        {locked && (
          <p style={{ color: "red", textAlign: "center", marginTop: 8 }}>
            🔒 Annotations are finalized and read-only
          </p>
        )}

        <p style={{ textAlign: "center", margin : 0}}>
          Frame <b>{currentFrame}</b> / {totalFrames}
          {keyframes[currentFrame] && (!isRejected) && (
            <span style={{ color: "green", marginLeft: 10 }}>● Keyframe</span>
          )}
        </p>

        <div style={{ textAlign: "center", marginBottom: 2 }}>
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

        {/* LABEL GROUP ROW */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "stretch",
            marginTop: 12,
          }}
        >
        <div style={ labelCard }>
        <h5 style={{ marginBottom : 6, marginTop: 10, opacity: 0.8, fontWeight: 500}}>Identity</h5>

        {/* <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}> */}

        {/* <h5 style={{ marginBottom : 6, marginTop: 10, opacity: 0.8, fontWeight: 500}}>Identity</h5> */}
          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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

          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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

          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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

          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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
        <div style={ labelCard}>
        <h5 style={{ marginBottom : 6, marginTop: 10, opacity: 0.8, fontWeight: 500}}>Visual</h5>
          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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

          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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
          
          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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
          
          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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

          <input style={{
            width:90,
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
            disabled = {locked || isRejected}
            type="number"
            placeholder="Speaker"
            value={currentLabels.speaker ?? "0"}
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
      
      {/* <div style={ labelCard }>
      <h5 style={{ marginBottom: 6, marginTop: 14, opacity: 0.8, fontWeight: 500 }}>Audio</h5>
          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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
          
          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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

          <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
          }}
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
      </div> */}
    </div>

      {/* METADATA + REJECT */}
      {/* <div style={{ marginTop: 16, marginBottom: 40 }}> */}
      <h4 style={{ marginTop: 0, opacity: 0.85 }}>Video Metadata</h4>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", background: "#101010", border: "1px solid #222", borderRadius: 12, padding: 14, marginBottom: 16, }}>
        <select style={{
            background: "#111",
            color: "#fff",
            border: "1px solid #333",
            padding: "6px 10px",
            borderRadius: 6,
        }}
          value={metadata.polarity ?? ""}
          onChange={e =>
            setMetadata(m => ({ ...m, polarity: e.target.value as any }))
          }
        >
          <option value="">Polarity</option>
          <option value="real">Real</option>
          <option value="fake">Fake</option>
        </select>

        <select
          disabled = {!isFake}
          value={metadata.generation_tool ?? ""}
          onChange={e =>
            setMetadata(m => ({ ...m, generation_tool: e.target.value || undefined }))
          }
        >
          <option value="">Generation Tool</option>
          <option value="deepfacelab">DeepFaceLab</option>
          <option value="faceswap">FaceSwap</option>
          <option value="veo">Veo</option>
          <option value="other">Other</option>
        </select>

        <select
          disabled = {!isFake}
          value={metadata.architecture ?? ""}
          onChange={e =>
            setMetadata(m => ({ ...m, architecture: e.target.value || undefined }))
          }
        >
          <option value="">Architecture</option>
          <option value="gan">GAN</option>
          <option value="diffusion">Diffusion</option>
          <option value="neural_rendering">Neural Rendering</option>
          <option value="unknown">Unknown</option>
        </select>
        {isFake && (
          <span style={{
            background: "#b71c1c",
            padding: "2px 8px",
            borderRadius: 6,
            fontSize: 12,
            marginLeft: 8,
          }}>
            FAKE VIDEO
          </span>
        )}

        {isReal && (
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Generation details are not applicable for real videos
          </div>
        )}

        {metadata.polarity === undefined && (
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Select polarity to enable generation details
          </div>
        )}

      </div>
        {/* REJECT */}
        <div style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 10,
          background: isRejected ? "#2a0000" : "#111",
          border: "1px solid #442",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              disabled = {locked}
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
