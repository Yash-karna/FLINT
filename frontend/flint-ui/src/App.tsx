import { useEffect, useState } from "react"

const API = "http://localhost:8000"

type Labels = {
  gender?: "M" | "F"
  beard?: "zero" | "light" | "medium" | "heavy"
  occlusion?: "none" | "hand"
  speaker?: number
}

function App() {
  const [totalFrames, setTotalFrames] = useState<number>(0)
  const [currentFrame, setCurrentFrame] = useState<number>(1)
  const [frameLabels, setFrameLabels] = useState<Record<number, Labels>>({})
  const currentLabels = frameLabels[currentFrame] || {}

  // Fetch video metadata
  useEffect(() => {
    fetch(`${API}/video/frames`)
      .then(res => res.json())
      .then(data => {
        setTotalFrames(data.total_frames)
      })
      .catch(err => {
        console.error("Failed to fetch video metadata", err)
      })
  }, [])

  const frameUrl = `${API}/video/frame/${currentFrame}`

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2>FLINT – Frame Level Annotation (MVP)</h2>

      {/* Frame Viewer */}
      <div>
        <img
          src={frameUrl}
          width={480}
          style={{ border: "1px solid #ccc", background: "#eee" }}
          alt={`Frame ${currentFrame}`}
        />
      </div>

      {/* Navigation */}
      <div style={{ marginTop: 10 }}>
        <button onClick={() => setCurrentFrame(f => Math.max(1, f - 1))}>
          ◀ Prev
        </button>

        <button
          style={{ marginLeft: 5 }}
          onClick={() => setCurrentFrame(f => Math.min(totalFrames, f + 1))}
        >
          Next ▶
        </button>

        <button
          style={{ marginLeft: 10 }}
          onClick={() => setCurrentFrame(f => Math.max(1, f - 10))}
        >
          -10
        </button>

        <button
          style={{ marginLeft: 5 }}
          onClick={() => setCurrentFrame(f => Math.min(totalFrames, f + 10))}
        >
          +10
        </button>
      </div>

      <p style={{ marginTop: 5 }}>
        Frame <b>{currentFrame}</b> / {totalFrames}
      </p>

      <hr />

      {/* Label Panel */}
      <div>
        <h4>Labels (local only – Day 1)</h4>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select
            value={currentLabels.gender ?? ""}
            onChange={e =>
              setFrameLabels(prev => ({
                ...prev,
                [currentFrame]: {
                  ...prev[currentFrame],
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
              setFrameLabels(prev => ({
                ...prev,
                [currentFrame]: {
                  ...prev[currentFrame],
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
              setFrameLabels(prev => ({
              ...prev,
              [currentFrame]: {
                ...prev[currentFrame],
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
              setFrameLabels(prev => ({
                ...prev,
                [currentFrame]: {
                  ...prev[currentFrame],
                  speaker: e.target.value === "" ? undefined : Number(e.target.value),
                },
              }))
            }
            style={{ width: 80 }}
          />
        </div>

        <pre
          style={{
            marginTop: 15,
            background: "#171616",
            padding: 10,
            fontSize: 12,
          }}
        >
          {JSON.stringify(frameLabels[currentFrame] || {}, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export default App