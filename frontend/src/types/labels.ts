export type Labels = {
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