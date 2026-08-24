export interface FrameRecord {
  timestamp: number;
  subject_id: string;
  session_id: string;
  ear: number;
  yaw_ratio: number;
  pitch_ratio: number;
  eyebrow_dist: number;
  nose_delta: number;
  gaze_variance: number;
  shoulder_angle: number;
  mar: number;
  roll_angle: number;
  hands_detected: number;
  hand_face_dist: number;
  label: number;
  label_name: string;
}

export interface WindowRecord {
  window_id: number;
  subject_id: string;
  session_id: string;
  timestamp_start: number;
  timestamp_end: number;
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
  hands_detected_mean: number;
  hand_face_dist_min: number;
  sample_count: number;
  label: number;
  label_name: string;
}

export function exportRawFramesToCSV(records: FrameRecord[], filename?: string) {
  if (records.length === 0) return;

  const subject = records[0]?.subject_id || 'general';
  const targetFilename = filename || `dataset_frames_${subject}_${Date.now()}.csv`;

  const headers = [
    'timestamp',
    'subject_id',
    'session_id',
    'ear',
    'yaw_ratio',
    'pitch_ratio',
    'eyebrow_dist',
    'nose_delta',
    'gaze_variance',
    'shoulder_angle',
    'mar',
    'roll_angle',
    'hands_detected',
    'hand_face_dist',
    'label',
    'label_name'
  ];

  const rows = records.map(r => [
    r.timestamp,
    `"${r.subject_id || 'anon'}"`,
    `"${r.session_id || 'session_1'}"`,
    r.ear.toFixed(4),
    r.yaw_ratio.toFixed(4),
    r.pitch_ratio.toFixed(4),
    r.eyebrow_dist.toFixed(4),
    r.nose_delta.toFixed(4),
    r.gaze_variance.toFixed(6),
    r.shoulder_angle.toFixed(2),
    (r.mar || 0).toFixed(4),
    (r.roll_angle || 0).toFixed(2),
    r.hands_detected,
    r.hand_face_dist.toFixed(4),
    r.label,
    `"${r.label_name}"`
  ].join(','));

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', targetFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportWindowsToCSV(windows: WindowRecord[], filename?: string) {
  if (windows.length === 0) return;

  const subject = windows[0]?.subject_id || 'general';
  const targetFilename = filename || `dataset_ventanas_${subject}_${Date.now()}.csv`;

  const headers = [
    'window_id',
    'subject_id',
    'session_id',
    'timestamp_start',
    'timestamp_end',
    'ear_mean',
    'ear_min',
    'yaw_mean',
    'yaw_std',
    'pitch_mean',
    'pitch_std',
    'frown_mean',
    'nose_delta_sum',
    'gaze_variance_mean',
    'shoulder_angle_mean',
    'mar_mean',
    'roll_angle_mean',
    'hands_detected_mean',
    'hand_face_dist_min',
    'sample_count',
    'label',
    'label_name'
  ];

  const rows = windows.map(w => [
    w.window_id,
    `"${w.subject_id || 'anon'}"`,
    `"${w.session_id || 'session_1'}"`,
    w.timestamp_start,
    w.timestamp_end,
    w.ear_mean.toFixed(4),
    w.ear_min.toFixed(4),
    w.yaw_mean.toFixed(4),
    w.yaw_std.toFixed(4),
    w.pitch_mean.toFixed(4),
    w.pitch_std.toFixed(4),
    w.frown_mean.toFixed(4),
    w.nose_delta_sum.toFixed(4),
    w.gaze_variance_mean.toFixed(6),
    w.shoulder_angle_mean.toFixed(2),
    (w.mar_mean || 0).toFixed(4),
    (w.roll_angle_mean || 0).toFixed(2),
    w.hands_detected_mean.toFixed(2),
    w.hand_face_dist_min.toFixed(4),
    w.sample_count,
    w.label,
    `"${w.label_name}"`
  ].join(','));

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', targetFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

