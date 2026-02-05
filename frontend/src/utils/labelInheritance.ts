import type { Labels } from "../types/labels"

// ---------------- UTILS ----------------
export function getLabelsForFrame(
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