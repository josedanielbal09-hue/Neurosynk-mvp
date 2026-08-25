import { BiometricFeaturesPayload } from '../types/aiContracts';

export interface RawBiometricFrame {
  timestamp: number;
  ear: number;
  yaw: number;
  pitch: number;
  frown: number;
  nose_delta: number;
  gaze_x: number;
  gaze_y: number;
  shoulder_angle: number;
  mar: number;
  roll: number;
}

/**
 * Calcula el Eye Aspect Ratio (EAR) a partir de los puntos del ojo de MediaPipe
 */
export function calculateEAR(landmarks: any[]): number {
  if (!landmarks || landmarks.length < 468) return 0.35;

  // Ojo Izquierdo
  const upperLeft = landmarks[159];
  const lowerLeft = landmarks[145];
  const outerLeft = landmarks[33];
  const innerLeft = landmarks[133];

  const heightLeft = Math.hypot(upperLeft.x - lowerLeft.x, upperLeft.y - lowerLeft.y);
  const widthLeft = Math.hypot(outerLeft.x - innerLeft.x, outerLeft.y - innerLeft.y);
  const earLeft = heightLeft / Math.max(0.001, widthLeft);

  // Ojo Derecho
  const upperRight = landmarks[386];
  const lowerRight = landmarks[374];
  const outerRight = landmarks[362];
  const innerRight = landmarks[263];

  const heightRight = Math.hypot(upperRight.x - lowerRight.x, upperRight.y - lowerRight.y);
  const widthRight = Math.hypot(outerRight.x - innerRight.x, outerRight.y - innerRight.y);
  const earRight = heightRight / Math.max(0.001, widthRight);

  return (earLeft + earRight) / 2.0;
}

/**
 * Calcula la estimación de orientación de la cabeza (Yaw y Pitch)
 */
export function calculateHeadPose(landmarks: any[]): { yaw: number; pitch: number } {
  if (!landmarks || landmarks.length < 468) return { yaw: 0.5, pitch: 0.6 };

  const nose = landmarks[1];
  const leftCheek = landmarks[33];
  const rightCheek = landmarks[263];
  const mouth = landmarks[14];

  // Yaw (Giro horizontal)
  const dx = rightCheek.x - leftCheek.x;
  const yaw = dx !== 0 ? (nose.x - leftCheek.x) / dx : 0.5;

  // Pitch (Inclinación vertical)
  const midEyesY = (leftCheek.y + rightCheek.y) / 2.0;
  const dy = mouth.y - midEyesY;
  const pitch = dy !== 0 ? (nose.y - midEyesY) / dy : 0.5;

  return { yaw, pitch };
}

/**
 * Calcula la distancia interciliar normalizada (Ceño)
 */
export function calculateFrown(landmarks: any[]): number {
  if (!landmarks || landmarks.length < 468) return 0.41;

  const leftEyebrow = landmarks[65];
  const rightEyebrow = landmarks[295];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  const faceWidth = Math.hypot(leftCheek.x - rightCheek.x, leftCheek.y - rightCheek.y);
  const eyebrowDist = Math.hypot(leftEyebrow.x - rightEyebrow.x, leftEyebrow.y - rightEyebrow.y);

  return faceWidth !== 0 ? eyebrowDist / faceWidth : 0.41;
}

/**
 * Calcula el ángulo biomecánico de los hombros a partir de la pose
 */
export function calculateShoulderAngle(poseLandmarks: any[]): number {
  if (!poseLandmarks || poseLandmarks.length < 14) return 100.0;

  const leftShoulder = poseLandmarks[11];
  const rightShoulder = poseLandmarks[12];
  const leftElbow = poseLandmarks[13];

  if (!leftShoulder || !rightShoulder || !leftElbow) return 100.0;

  const rad = Math.atan2(leftElbow.y - leftShoulder.y, leftElbow.x - leftShoulder.x) - 
              Math.atan2(rightShoulder.y - leftShoulder.y, rightShoulder.x - leftShoulder.x);
  
  const angle = Math.abs((rad * 180.0) / Math.PI);
  return isNaN(angle) ? 100.0 : angle;
}

/**
 * Agrega una ventana temporal de 2 segundos de frames en un único payload para el backend
 */
export function aggregateBiometricWindow(frames: RawBiometricFrame[]): BiometricFeaturesPayload {
  if (frames.length === 0) {
    return {
      ear_mean: 0.36,
      ear_min: 0.30,
      yaw_mean: 0.50,
      yaw_std: 0.02,
      pitch_mean: 0.60,
      pitch_std: 0.02,
      frown_mean: 0.41,
      nose_delta_sum: 0.02,
      gaze_variance_mean: 0.0005,
      shoulder_angle_mean: 100.0,
      mar_mean: 0.05,
      roll_angle_mean: 0.0
    };
  }

  const n = frames.length;
  const earVals = frames.map(f => f.ear);
  const yawVals = frames.map(f => f.yaw);
  const pitchVals = frames.map(f => f.pitch);
  const frownVals = frames.map(f => f.frown);
  const noseDeltas = frames.map(f => f.nose_delta);
  const shoulderAngles = frames.map(f => f.shoulder_angle);
  const marVals = frames.map(f => f.mar ?? 0.05);
  const rollVals = frames.map(f => f.roll ?? 0.0);

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr: number[], m: number) => Math.sqrt(arr.reduce((sq, v) => sq + Math.pow(v - m, 2), 0) / arr.length) || 0.005;

  const earMean = mean(earVals);
  const earMin = Math.min(...earVals);
  const yawMean = mean(yawVals);
  const yawStd = std(yawVals, yawMean);
  const pitchMean = mean(pitchVals);
  const pitchStd = std(pitchVals, pitchMean);
  const frownMean = mean(frownVals);
  const noseDeltaSum = noseDeltas.reduce((a, b) => a + b, 0);
  const shoulderAngleMean = mean(shoulderAngles);
  const marMean = mean(marVals);
  const rollAngleMean = mean(rollVals);

  // Varianza de mirada en la ventana
  const gazeXs = frames.map(f => f.gaze_x);
  const gazeYs = frames.map(f => f.gaze_y);
  const avgGx = mean(gazeXs);
  const avgGy = mean(gazeYs);
  const gazeVariance = frames.reduce((acc, f) => acc + Math.pow(f.gaze_x - avgGx, 2) + Math.pow(f.gaze_y - avgGy, 2), 0) / n;

  return {
    ear_mean: Number(earMean.toFixed(4)),
    ear_min: Number(earMin.toFixed(4)),
    yaw_mean: Number(yawMean.toFixed(4)),
    yaw_std: Number(yawStd.toFixed(4)),
    pitch_mean: Number(pitchMean.toFixed(4)),
    pitch_std: Number(pitchStd.toFixed(4)),
    frown_mean: Number(frownMean.toFixed(4)),
    nose_delta_sum: Number(noseDeltaSum.toFixed(4)),
    gaze_variance_mean: Number(gazeVariance.toFixed(6)),
    shoulder_angle_mean: Number(shoulderAngleMean.toFixed(2)),
    mar_mean: Number(marMean.toFixed(4)),
    roll_angle_mean: Number(rollAngleMean.toFixed(2))
  };
}
