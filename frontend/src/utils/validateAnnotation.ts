import type { Labels } from "../types/labels"
import type {VideoMetadata}  from "../App"

export type ValidationIssue = {
  type: "error" | "warning"
  message: string
  frame?: number
}

type ValidateContext = {
  strict: boolean // true = export-time validation
}

export function validateAnnotation(
  data: {
    totalFrames: number
    keyframes: Record<number, Labels>
    VideoMetadata: VideoMetadata
  },
  context: ValidateContext
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const { VideoMetadata: videoMeta } = data

  // Polarity not set
  if (!videoMeta.polarity) {
    issues.push({
      type: context.strict ? "error" : "warning",
      message: "Video polarity (real/fake) is not set"
    })
  }

  // Fake-specific requirements
  if (videoMeta.polarity === "fake") {
    if (!videoMeta.generation_tool) {
      issues.push({
        type: "error",
        message: "Generation tool is required for fake videos"
      })
    }
    if (!videoMeta.architecture) {
      issues.push({
        type: "error",
        message: "Architecture is required for fake videos"
      })
    }
  }

  return issues
}
