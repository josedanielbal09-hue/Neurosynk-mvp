import { FrameRecord, WindowRecord } from './csvExporter';

/**
 * Agregador Robusto de Ventanas Temporales
 * Soporta sesiones continuas de larga duración (horas) e incluye MAR y Roll Angle
 */
export function aggregateFramesIntoWindows(frames: FrameRecord[], windowDurationMs = 2000): WindowRecord[] {
  if (frames.length === 0) return [];

  const validFrames = frames.filter(f => f.label >= 0);
  if (validFrames.length === 0) return [];

  const windows: WindowRecord[] = [];
  let currentBatch: FrameRecord[] = [];
  let windowStart = validFrames[0].timestamp;
  let windowId = 1;
  let lastTimestamp = validFrames[0].timestamp;

  for (let i = 0; i < validFrames.length; i++) {
    const frame = validFrames[i];

    // Si hubo una pausa o salto de tiempo grande (>3.5 segundos), cerrar ventana previa e iniciar nueva
    const timeDelta = frame.timestamp - lastTimestamp;
    if (timeDelta > 3500) {
      if (currentBatch.length >= 4) {
        windows.push(computeWindowStats(windowId++, windowStart, lastTimestamp, currentBatch));
      }
      currentBatch = [frame];
      windowStart = frame.timestamp;
      lastTimestamp = frame.timestamp;
      continue;
    }

    lastTimestamp = frame.timestamp;

    if (frame.timestamp - windowStart < windowDurationMs) {
      currentBatch.push(frame);
    } else {
      if (currentBatch.length >= 4) {
        windows.push(computeWindowStats(windowId++, windowStart, frame.timestamp, currentBatch));
      }
      currentBatch = [frame];
      windowStart = frame.timestamp;
    }
  }

  // Última ventana pendiente
  if (currentBatch.length >= 4) {
    windows.push(computeWindowStats(windowId, windowStart, currentBatch[currentBatch.length - 1].timestamp, currentBatch));
  }

  return windows;
}

function computeWindowStats(windowId: number, start: number, end: number, batch: FrameRecord[]): WindowRecord {
  const count = batch.length;
  const subjectId = batch[0]?.subject_id || 'anon';
  const sessionId = batch[0]?.session_id || 'session_1';
  const ears = batch.map(b => b.ear);
  const yaws = batch.map(b => b.yaw_ratio);
  const pitches = batch.map(b => b.pitch_ratio);
  const frowns = batch.map(b => b.eyebrow_dist);
  const gazes = batch.map(b => b.gaze_variance);
  const shoulders = batch.map(b => b.shoulder_angle);
  const mars = batch.map(b => b.mar || 0);
  const rolls = batch.map(b => b.roll_angle || 0);
  const hands = batch.map(b => b.hands_detected);
  const handFaceDists = batch.map(b => b.hand_face_dist);

  const earMean = ears.reduce((a, b) => a + b, 0) / count;
  const earMin = Math.min(...ears);

  const yawMean = yaws.reduce((a, b) => a + b, 0) / count;
  const yawStd = Math.sqrt(yaws.reduce((sq, n) => sq + Math.pow(n - yawMean, 2), 0) / count) || 0.005;

  const pitchMean = pitches.reduce((a, b) => a + b, 0) / count;
  const pitchStd = Math.sqrt(pitches.reduce((sq, n) => sq + Math.pow(n - pitchMean, 2), 0) / count) || 0.005;

  const frownMean = frowns.reduce((a, b) => a + b, 0) / count;
  const noseDeltaSum = batch.reduce((a, b) => a + b.nose_delta, 0);
  const gazeMean = gazes.reduce((a, b) => a + b, 0) / count;
  const shoulderMean = shoulders.reduce((a, b) => a + b, 0) / count;
  const marMean = mars.reduce((a, b) => a + b, 0) / count;
  const rollMean = rolls.reduce((a, b) => a + b, 0) / count;
  const handsDetectedMean = hands.reduce((a, b) => a + b, 0) / count;
  const handFaceDistMin = Math.min(...handFaceDists);

  // Obtener la etiqueta modal en la ventana
  const labelCounts: Record<number, { count: number; name: string }> = {};
  batch.forEach(b => {
    if (!labelCounts[b.label]) {
      labelCounts[b.label] = { count: 0, name: b.label_name };
    }
    labelCounts[b.label].count++;
  });

  let modeLabel = batch[0].label;
  let modeName = batch[0].label_name;
  let maxC = 0;
  Object.keys(labelCounts).forEach(k => {
    const keyNum = parseInt(k, 10);
    if (labelCounts[keyNum].count > maxC) {
      maxC = labelCounts[keyNum].count;
      modeLabel = keyNum;
      modeName = labelCounts[keyNum].name;
    }
  });

  return {
    window_id: windowId,
    subject_id: subjectId,
    session_id: sessionId,
    timestamp_start: start,
    timestamp_end: end,
    ear_mean: Number(earMean.toFixed(4)),
    ear_min: Number(earMin.toFixed(4)),
    yaw_mean: Number(yawMean.toFixed(4)),
    yaw_std: Number(yawStd.toFixed(4)),
    pitch_mean: Number(pitchMean.toFixed(4)),
    pitch_std: Number(pitchStd.toFixed(4)),
    frown_mean: Number(frownMean.toFixed(4)),
    nose_delta_sum: Number(noseDeltaSum.toFixed(4)),
    gaze_variance_mean: Number(gazeMean.toFixed(6)),
    shoulder_angle_mean: Number(shoulderMean.toFixed(2)),
    mar_mean: Number(marMean.toFixed(4)),
    roll_angle_mean: Number(rollMean.toFixed(2)),
    hands_detected_mean: Number(handsDetectedMean.toFixed(2)),
    hand_face_dist_min: handFaceDistMin === Infinity ? 1.0 : Number(handFaceDistMin.toFixed(4)),
    sample_count: count,
    label: modeLabel,
    label_name: modeName
  };
}

