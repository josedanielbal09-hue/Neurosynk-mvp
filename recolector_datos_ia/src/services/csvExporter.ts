export interface FrameRecord {
  timestamp: number;
  subject_id: string;
  session_id: string;
  task_name: string;
  // Dinámica Ocular e Iris
  ear_avg: number;
  ear_left: number;
  ear_right: number;
  gaze_x: number;
  gaze_y: number;
  gaze_variance: number;
  perclos: number;
  blink_count: number;
  // Pose Cefálica 3D y Movimiento
  yaw_ratio: number;
  pitch_ratio: number;
  roll_angle: number;
  head_forward_dist: number;
  nose_delta: number;
  // Tensión Facial y Expresión (FACS)
  frown_dist: number;
  brow_raise_avg: number;
  mar: number;
  jaw_drop: number;
  lip_corner_dist: number;
  // Ergonomía Postural y Tronco
  shoulder_angle: number;
  torso_slump: number;
  // Gestos Manuales y Zonas de Contacto
  hands_detected: number;
  hand_face_dist: number;
  touch_zone: string;
  // Etiqueta
  label: number;
  label_name: string;
}

export interface WindowRecord {
  window_id: number;
  subject_id: string;
  session_id: string;
  task_name: string;
  timestamp_start: number;
  timestamp_end: number;
  // Estadísticas Oculares
  ear_mean: number;
  ear_min: number;
  ear_std: number;
  ear_asymmetry_mean: number;
  gaze_variance_mean: number;
  perclos_mean: number;
  blink_rate_per_min: number;
  // Estadísticas de Pose Cefálica 3D
  yaw_mean: number;
  yaw_std: number;
  pitch_mean: number;
  pitch_std: number;
  roll_angle_mean: number;
  roll_angle_std: number;
  head_forward_mean: number;
  nose_delta_sum: number;
  // Estadísticas Faciales FACS
  frown_mean: number;
  brow_raise_mean: number;
  mar_mean: number;
  mar_max: number;
  jaw_drop_mean: number;
  lip_tension_mean: number;
  // Estadísticas Posturales
  shoulder_angle_mean: number;
  torso_slump_mean: number;
  // Estadísticas de Manos y Contacto
  hands_detected_mean: number;
  hand_face_dist_min: number;
  predominant_touch_zone: string;
  // Metadatos
  sample_count: number;
  label: number;
  label_name: string;
}

export function exportRawFramesToCSV(records: FrameRecord[], filename?: string) {
  if (records.length === 0) return;

  const subject = records[0]?.subject_id || 'general';
  const targetFilename = filename || `dataset_frames_HD_${subject}_${Date.now()}.csv`;

  const headers = [
    'timestamp',
    'subject_id',
    'session_id',
    'task_name',
    'ear_avg',
    'ear_left',
    'ear_right',
    'gaze_x',
    'gaze_y',
    'gaze_variance',
    'perclos',
    'blink_count',
    'yaw_ratio',
    'pitch_ratio',
    'roll_angle',
    'head_forward_dist',
    'nose_delta',
    'frown_dist',
    'brow_raise_avg',
    'mar',
    'jaw_drop',
    'lip_corner_dist',
    'shoulder_angle',
    'torso_slump',
    'hands_detected',
    'hand_face_dist',
    'touch_zone',
    'label',
    'label_name'
  ];

  const rows = records.map(r => [
    r.timestamp,
    `"${r.subject_id || 'anon'}"`,
    `"${r.session_id || 'session_1'}"`,
    `"${r.task_name || 'estudio'}"`,
    r.ear_avg.toFixed(4),
    r.ear_left.toFixed(4),
    r.ear_right.toFixed(4),
    r.gaze_x.toFixed(4),
    r.gaze_y.toFixed(4),
    r.gaze_variance.toFixed(6),
    r.perclos.toFixed(4),
    r.blink_count,
    r.yaw_ratio.toFixed(4),
    r.pitch_ratio.toFixed(4),
    r.roll_angle.toFixed(2),
    r.head_forward_dist.toFixed(4),
    r.nose_delta.toFixed(4),
    r.frown_dist.toFixed(4),
    r.brow_raise_avg.toFixed(4),
    r.mar.toFixed(4),
    r.jaw_drop.toFixed(4),
    r.lip_corner_dist.toFixed(4),
    r.shoulder_angle.toFixed(2),
    r.torso_slump.toFixed(4),
    r.hands_detected,
    r.hand_face_dist.toFixed(4),
    `"${r.touch_zone}"`,
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
  const targetFilename = filename || `dataset_ventanas_HD_${subject}_${Date.now()}.csv`;

  const headers = [
    'window_id',
    'subject_id',
    'session_id',
    'task_name',
    'timestamp_start',
    'timestamp_end',
    'ear_mean',
    'ear_min',
    'ear_std',
    'ear_asymmetry_mean',
    'gaze_variance_mean',
    'perclos_mean',
    'blink_rate_per_min',
    'yaw_mean',
    'yaw_std',
    'pitch_mean',
    'pitch_std',
    'roll_angle_mean',
    'roll_angle_std',
    'head_forward_mean',
    'nose_delta_sum',
    'frown_mean',
    'brow_raise_mean',
    'mar_mean',
    'mar_max',
    'jaw_drop_mean',
    'lip_tension_mean',
    'shoulder_angle_mean',
    'torso_slump_mean',
    'hands_detected_mean',
    'hand_face_dist_min',
    'predominant_touch_zone',
    'sample_count',
    'label',
    'label_name'
  ];

  const rows = windows.map(w => [
    w.window_id,
    `"${w.subject_id || 'anon'}"`,
    `"${w.session_id || 'session_1'}"`,
    `"${w.task_name || 'estudio'}"`,
    w.timestamp_start,
    w.timestamp_end,
    w.ear_mean.toFixed(4),
    w.ear_min.toFixed(4),
    w.ear_std.toFixed(4),
    w.ear_asymmetry_mean.toFixed(4),
    w.gaze_variance_mean.toFixed(6),
    w.perclos_mean.toFixed(4),
    w.blink_rate_per_min.toFixed(1),
    w.yaw_mean.toFixed(4),
    w.yaw_std.toFixed(4),
    w.pitch_mean.toFixed(4),
    w.pitch_std.toFixed(4),
    w.roll_angle_mean.toFixed(2),
    w.roll_angle_std.toFixed(2),
    w.head_forward_mean.toFixed(4),
    w.nose_delta_sum.toFixed(4),
    w.frown_mean.toFixed(4),
    w.brow_raise_mean.toFixed(4),
    w.mar_mean.toFixed(4),
    w.mar_max.toFixed(4),
    w.jaw_drop_mean.toFixed(4),
    w.lip_tension_mean.toFixed(4),
    w.shoulder_angle_mean.toFixed(2),
    w.torso_slump_mean.toFixed(4),
    w.hands_detected_mean.toFixed(2),
    w.hand_face_dist_min.toFixed(4),
    `"${w.predominant_touch_zone}"`,
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
