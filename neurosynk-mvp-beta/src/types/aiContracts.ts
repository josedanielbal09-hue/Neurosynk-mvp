export interface BiometricFeaturesPayload {
  ear_mean: number;
  ear_min: number;
  yaw_mean: number;
  yaw_std: number;
  pitch_mean: number;
  pitch_std: number;
  frown_mean: number;
  nose_delta_sum: number;
  gaze_variance_mean: number;
  shoulder_angle_mean: number;
  mar_mean: number;
  roll_angle_mean: number;
}

export interface AIInferenceResponse {
  class_index: number;
  class_name: string;
  confidence: number;
  probabilities: number[];
  focus_score: number;
  stress_level: number;
  status_message: string;
}

export interface HealthCheckResponse {
  status: string;
  service: string;
  model_ready: boolean;
  version: string;
}
