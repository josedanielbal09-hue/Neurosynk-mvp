import { FrameRecord, WindowRecord } from './csvExporter';

/**
 * Agregador Temporal de Alta Definición
 * Procesa series continuas de telemetría multidimensional (28+ estimadores estadísticos)
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

  if (currentBatch.length >= 4) {
    windows.push(computeWindowStats(windowId, windowStart, currentBatch[currentBatch.length - 1].timestamp, currentBatch));
  }

  return windows;
}

function computeWindowStats(windowId: number, start: number, end: number, batch: FrameRecord[]): WindowRecord {
  const count = batch.length;
  const first = batch[0] || {} as FrameRecord;
  const subjectId = first.subject_id || 'anon';
  const sessionId = first.session_id || 'session_1';
  const taskName = first.task_name || 'estudio';

  // 1. Oculares
  const ears = batch.map(b => b.ear_avg ?? 0.35);
  const earLefts = batch.map(b => b.ear_left ?? 0.35);
  const earRights = batch.map(b => b.ear_right ?? 0.35);
  const perclosVals = batch.map(b => b.perclos ?? 0.0);
  const gazeVars = batch.map(b => b.gaze_variance ?? 0.0001);

  const earMean = ears.reduce((a, b) => a + b, 0) / count;
  const earMin = Math.min(...ears);
  const earStd = Math.sqrt(ears.reduce((sq, n) => sq + Math.pow(n - earMean, 2), 0) / count) || 0.005;

  const earAsyms = batch.map((_, idx) => Math.abs(earLefts[idx] - earRights[idx]));
  const earAsymmetryMean = earAsyms.reduce((a, b) => a + b, 0) / count;
  const gazeVarMean = gazeVars.reduce((a, b) => a + b, 0) / count;
  const perclosMean = perclosVals.reduce((a, b) => a + b, 0) / count;

  // Tasa de parpadeo por minuto (extrapolada de los deltas de blink_count)
  const firstBlink = batch[0].blink_count ?? 0;
  const lastBlink = batch[count - 1].blink_count ?? 0;
  const blinkDelta = Math.max(0, lastBlink - firstBlink);
  const windowSecs = Math.max(0.5, (end - start) / 1000);
  const blinkRatePerMin = (blinkDelta / windowSecs) * 60;

  // 2. Pose Cefálica 3D
  const yaws = batch.map(b => b.yaw_ratio ?? 0.5);
  const pitches = batch.map(b => b.pitch_ratio ?? 0.6);
  const rolls = batch.map(b => b.roll_angle ?? 0.0);
  const headForwards = batch.map(b => b.head_forward_dist ?? 0.15);

  const yawMean = yaws.reduce((a, b) => a + b, 0) / count;
  const yawStd = Math.sqrt(yaws.reduce((sq, n) => sq + Math.pow(n - yawMean, 2), 0) / count) || 0.005;

  const pitchMean = pitches.reduce((a, b) => a + b, 0) / count;
  const pitchStd = Math.sqrt(pitches.reduce((sq, n) => sq + Math.pow(n - pitchMean, 2), 0) / count) || 0.005;

  const rollMean = rolls.reduce((a, b) => a + b, 0) / count;
  const rollStd = Math.sqrt(rolls.reduce((sq, n) => sq + Math.pow(n - rollMean, 2), 0) / count) || 0.5;

  const headForwardMean = headForwards.reduce((a, b) => a + b, 0) / count;
  const noseDeltaSum = batch.reduce((a, b) => a + (b.nose_delta ?? 0), 0);

  // 3. Faciales FACS
  const frowns = batch.map(b => b.frown_dist ?? 0.4);
  const browRaises = batch.map(b => b.brow_raise_avg ?? 0.1);
  const mars = batch.map(b => b.mar ?? 0.05);
  const jawDrops = batch.map(b => b.jaw_drop ?? 0.05);
  const lipTensions = batch.map(b => b.lip_corner_dist ?? 0.35);

  const frownMean = frowns.reduce((a, b) => a + b, 0) / count;
  const browRaiseMean = browRaises.reduce((a, b) => a + b, 0) / count;
  const marMean = mars.reduce((a, b) => a + b, 0) / count;
  const marMax = Math.max(...mars);
  const jawDropMean = jawDrops.reduce((a, b) => a + b, 0) / count;
  const lipTensionMean = lipTensions.reduce((a, b) => a + b, 0) / count;

  // 4. Postura
  const shoulders = batch.map(b => b.shoulder_angle ?? 100.0);
  const slumps = batch.map(b => b.torso_slump ?? 0.5);

  const shoulderMean = shoulders.reduce((a, b) => a + b, 0) / count;
  const torsoSlumpMean = slumps.reduce((a, b) => a + b, 0) / count;

  // 5. Manos y Touch Zone
  const hands = batch.map(b => b.hands_detected ?? 0);
  const handDists = batch.map(b => b.hand_face_dist ?? 1.0);

  const handsDetectedMean = hands.reduce((a, b) => a + b, 0) / count;
  const handFaceDistMin = Math.min(...handDists);

  // Zona de contacto predominante
  const zoneCounts: Record<string, number> = {};
  batch.forEach(b => {
    const z = b.touch_zone || 'ninguna';
    zoneCounts[z] = (zoneCounts[z] || 0) + 1;
  });
  let predominantTouchZone = 'ninguna';
  let maxZCount = 0;
  Object.keys(zoneCounts).forEach(z => {
    if (zoneCounts[z] > maxZCount) {
      maxZCount = zoneCounts[z];
      predominantTouchZone = z;
    }
  });

  // Etiqueta modal
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
    task_name: taskName,
    timestamp_start: start,
    timestamp_end: end,
    ear_mean: Number(earMean.toFixed(4)),
    ear_min: Number(earMin.toFixed(4)),
    ear_std: Number(earStd.toFixed(4)),
    ear_asymmetry_mean: Number(earAsymmetryMean.toFixed(4)),
    gaze_variance_mean: Number(gazeVarMean.toFixed(6)),
    perclos_mean: Number(perclosMean.toFixed(4)),
    blink_rate_per_min: Number(blinkRatePerMin.toFixed(1)),
    yaw_mean: Number(yawMean.toFixed(4)),
    yaw_std: Number(yawStd.toFixed(4)),
    pitch_mean: Number(pitchMean.toFixed(4)),
    pitch_std: Number(pitchStd.toFixed(4)),
    roll_angle_mean: Number(rollMean.toFixed(2)),
    roll_angle_std: Number(rollStd.toFixed(2)),
    head_forward_mean: Number(headForwardMean.toFixed(4)),
    nose_delta_sum: Number(noseDeltaSum.toFixed(4)),
    frown_mean: Number(frownMean.toFixed(4)),
    brow_raise_mean: Number(browRaiseMean.toFixed(4)),
    mar_mean: Number(marMean.toFixed(4)),
    mar_max: Number(marMax.toFixed(4)),
    jaw_drop_mean: Number(jawDropMean.toFixed(4)),
    lip_tension_mean: Number(lipTensionMean.toFixed(4)),
    shoulder_angle_mean: Number(shoulderMean.toFixed(2)),
    torso_slump_mean: Number(torsoSlumpMean.toFixed(4)),
    hands_detected_mean: Number(handsDetectedMean.toFixed(2)),
    hand_face_dist_min: handFaceDistMin === Infinity ? 1.0 : Number(handFaceDistMin.toFixed(4)),
    predominant_touch_zone: predominantTouchZone,
    sample_count: count,
    label: modeLabel,
    label_name: modeName
  };
}
