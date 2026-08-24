import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, Video, Download, Play, Pause, Trash2, BrainCircuit, Activity,
  Eye, User, Key, CheckCircle, RefreshCw, Volume2, VolumeX, Sparkles,
  RotateCcw, FastForward, Zap, Cpu, ArrowUpRight, Award
} from 'lucide-react';
import { exportRawFramesToCSV, exportWindowsToCSV, FrameRecord, WindowRecord } from './services/csvExporter';
import { aggregateFramesIntoWindows } from './services/windowAggregator';
import {
  trainNeuroSynkModel,
  exportTrainedModel,
  predictCognitiveState,
  TrainingProgress,
  TrainingResult,
  CLASS_NAMES
} from './services/modelTrainer';

declare global {
  interface Window {
    Holistic: any;
    drawConnectors: any;
    drawLandmarks: any;
    FACEMESH_TESSELATION: any;
    FACEMESH_RIGHT_EYE: any;
    FACEMESH_RIGHT_EYEBROW: any;
    FACEMESH_LEFT_EYE: any;
    FACEMESH_LEFT_EYEBROW: any;
    FACEMESH_FACE_OVAL: any;
    FACEMESH_LIPS: any;
    POSE_CONNECTIONS: any;
    tf: any;
  }
}

const FALLBACK_POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [24, 26]
];

const FALLBACK_LIPS = [
  [61, 146], [146, 91], [91, 181], [181, 84], [84, 17],
  [17, 314], [314, 405], [405, 321], [321, 375], [375, 291],
  [61, 185], [185, 40], [40, 39], [39, 37], [37, 0],
  [0, 267], [267, 269], [269, 270], [270, 409], [409, 291]
];

const FALLBACK_LEFT_EYEBROW = [[70, 63], [63, 105], [105, 66], [66, 107]];
const FALLBACK_RIGHT_EYEBROW = [[336, 296], [296, 334], [334, 293], [293, 300]];

interface StateDefinition {
  label: number;
  name: string;
  key: string;
  color: string;
  bgColor: string;
  borderColor: string;
  desc: string;
}

const STATE_MAP: Record<string, StateDefinition> = {
  '0': { label: 0, name: 'ESTUDIO NORMAL / NEUTRO', key: '0', color: 'text-sky-400', bgColor: 'bg-sky-500/20', borderColor: 'border-sky-500', desc: 'Lectura tranquila y ritmo regular (Línea base neutra)' },
  '1': { label: 1, name: 'ENFOQUE PROFUNDO (FLOW)', key: '1', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', borderColor: 'border-emerald-500', desc: 'Concentración máxima y fijación activa' },
  '2': { label: 2, name: 'DISTRACCIÓN', key: '2', color: 'text-amber-400', bgColor: 'bg-amber-500/20', borderColor: 'border-amber-500', desc: 'Mirada o giro de cabeza fuera de zona' },
  '3': { label: 3, name: 'FATIGA', key: '3', color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-500', desc: 'Parpadeos lentos / Somnolencia' },
  '4': { label: 4, name: 'SOBREESTIMULACIÓN', key: '4', color: 'text-rose-400', bgColor: 'bg-rose-500/20', borderColor: 'border-rose-500', desc: 'Inquietud motora / Movimiento continuo' },
  '5': { label: 5, name: 'AGOBIO POSTURAL', key: '5', color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-500', desc: 'Manos a la cara / Tensión en hombros' },
  'p': { label: -1, name: 'PAUSA (STANDBY)', key: 'P', color: 'text-zinc-400', bgColor: 'bg-zinc-800', borderColor: 'border-zinc-700', desc: 'Pausa momentánea (no guarda datos)' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'RECORD' | 'TRAIN'>('RECORD');
  const [activeMode, setActiveMode] = useState<'CAM' | 'MP4'>('CAM');
  const [activeStateKey, setActiveStateKey] = useState<string>('0');
  const activeStateRef = useRef<StateDefinition>(STATE_MAP['0']);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);

  // Rendimiento
  const [targetFps, setTargetFps] = useState<number>(12);
  const targetFpsRef = useRef<number>(12);
  targetFpsRef.current = targetFps;

  // Buffer de datos
  const framesBufferRef = useRef<FrameRecord[]>([]);
  const [recordedCount, setRecordedCount] = useState<number>(0);
  const [windowCount, setWindowCount] = useState<number>(0);
  const [actualFps, setActualFps] = useState<number>(0);

  // Filtros visuales
  const [showFaceMesh, setShowFaceMesh] = useState<boolean>(true);
  const [showEyebrowsLips, setShowEyebrowsLips] = useState<boolean>(true);
  const [showPoseSkeleton, setShowPoseSkeleton] = useState<boolean>(true);
  const [soundFeedback, setSoundFeedback] = useState<boolean>(true);

  // Estado del modelo MediaPipe
  const [isModelReady, setIsModelReady] = useState<boolean>(false);

  // Estado del Entrenamiento de TensorFlow.js
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
  const [trainedResult, setTrainedResult] = useState<TrainingResult | null>(null);
  const [customCsvWindows, setCustomCsvWindows] = useState<WindowRecord[]>([]);

  // Predicción en vivo con el modelo entrenado
  const [livePrediction, setLivePrediction] = useState<{
    className: string;
    confidence: number;
    probabilities: number[];
  } | null>(null);

  // Métricas en vivo de Alta Definición
  const [liveMetrics, setLiveMetrics] = useState({
    ear: 0,
    earLeft: 0,
    earRight: 0,
    perclos: 0,
    blinkCount: 0,
    yaw: 0,
    pitch: 0,
    rollAngle: 0,
    headForward: 0,
    frown: 0,
    browRaise: 0,
    mar: 0,
    jawDrop: 0,
    shoulderAngle: 0,
    torsoSlump: 0,
    noseDelta: 0,
    touchZone: 'ninguna'
  });

  // Video MP4
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holisticRef = useRef<any>(null);

  // Identidad de Sujeto, Sesión y Tarea (Soporte HD)
  const [subjectId, setSubjectId] = useState<string>('Sujeto_01');
  const [sessionId, setSessionId] = useState<string>('Sesion_A');
  const [taskName, setTaskName] = useState<string>('Lectura_Estudio');
  const subjectIdRef = useRef<string>('Sujeto_01');
  const sessionIdRef = useRef<string>('Sesion_A');
  const taskNameRef = useRef<string>('Lectura_Estudio');
  subjectIdRef.current = subjectId;
  sessionIdRef.current = sessionId;
  taskNameRef.current = taskName;

  const blinkCountRef = useRef<number>(0);
  const isBlinkingRef = useRef<boolean>(false);
  const perclosBufferRef = useRef<{ isClosed: boolean; t: number }[]>([]);

  const frameTimesRef = useRef<number[]>([]);
  const lastNosePosRef = useRef<{ x: number; y: number } | null>(null);
  const gazeHistoryRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const window2sBufferRef = useRef<{
    ear: number;
    yaw: number;
    pitch: number;
    frown: number;
    noseDelta: number;
    gazeVar: number;
    shoulder: number;
    mar: number;
    roll: number;
    t: number;
  }[]>([]);
  const lastInferenceTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);

  const toggleRecording = (val?: boolean) => {
    const nextVal = typeof val === 'boolean' ? val : !isRecordingRef.current;
    isRecordingRef.current = nextVal;
    setIsRecording(nextVal);
    playBeep(nextVal ? 880 : 440);
  };

  const playBeep = (freq: number) => {
    if (!soundFeedback) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (_) {}
  };

  // Teclas Rápidas (0 - 4 para Estados Cognitivos, P para Pausa, Espacio para Grabar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (STATE_MAP[key]) {
        setActiveStateKey(key);
        activeStateRef.current = STATE_MAP[key];
        playBeep(key === 'p' ? 350 : 520 + (parseInt(key) || 0) * 70);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [soundFeedback]);

  // Actualizador periódico de estadísticas de UI (Optimizado a 1s para sesiones largas ilimitadas)
  useEffect(() => {
    const timer = setInterval(() => {
      const total = framesBufferRef.current.length;
      setRecordedCount(total);
      if (total > 0) {
        const windows = aggregateFramesIntoWindows(framesBufferRef.current, 2000);
        setWindowCount(windows.length);
      } else {
        setWindowCount(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Inicialización de MediaPipe Holistic Lite
  useEffect(() => {
    let isMounted = true;

    const initMediaPipe = async () => {
      if (!window.Holistic) {
        setTimeout(initMediaPipe, 300);
        return;
      }

      try {
        const holistic = new window.Holistic({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
        });

        holistic.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          refineFaceLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        holistic.onResults(onResults);
        holisticRef.current = holistic;
        setIsModelReady(true);

        if (activeMode === 'CAM' && videoRef.current) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 15, max: 20 }
              }
            });

            if (!isMounted) {
              stream.getTracks().forEach(t => t.stop());
              return;
            }

            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
            };

            let isProcessing = false;
            const processCameraFrame = async () => {
              if (!isMounted) return;

              const now = performance.now();
              const minInterval = 1000 / targetFpsRef.current;

              if (
                videoRef.current &&
                videoRef.current.readyState >= 2 &&
                holisticRef.current &&
                !isProcessing &&
                now - lastInferenceTimeRef.current >= minInterval
              ) {
                lastInferenceTimeRef.current = now;
                isProcessing = true;
                try {
                  await holisticRef.current.send({ image: videoRef.current });
                } catch (_) {
                } finally {
                  isProcessing = false;
                }
              }
              if (isMounted) {
                animationFrameIdRef.current = requestAnimationFrame(processCameraFrame);
              }
            };
            processCameraFrame();
          } catch (camErr) {
            console.error("Camera access error:", camErr);
          }
        }
      } catch (err) {
        console.error("MediaPipe initialization error:", err);
      }
    };

    initMediaPipe();

    return () => {
      isMounted = false;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      if (holisticRef.current) {
        holisticRef.current.close();
        holisticRef.current = null;
      }
      setIsModelReady(false);
    };
  }, [activeMode]);

  // Procesamiento de Video MP4
  const startMp4ProcessingLoop = () => {
    let isProcessing = false;
    const processMp4Frame = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      const now = performance.now();
      const minInterval = 1000 / targetFpsRef.current;

      if (
        videoRef.current.readyState >= 2 &&
        holisticRef.current &&
        !isProcessing &&
        now - lastInferenceTimeRef.current >= minInterval
      ) {
        lastInferenceTimeRef.current = now;
        isProcessing = true;
        setVideoCurrentTime(videoRef.current.currentTime);
        try {
          await holisticRef.current.send({ image: videoRef.current });
        } catch (_) {
        } finally {
          isProcessing = false;
        }
      }

      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        animationFrameIdRef.current = requestAnimationFrame(processMp4Frame);
      }
    };
    animationFrameIdRef.current = requestAnimationFrame(processMp4Frame);
  };

  const handleMp4PlayToggle = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPlaying(true);
      startMp4ProcessingLoop();
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const jumpVideo = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoDuration, videoRef.current.currentTime + seconds));
      setVideoCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setIsVideoPlaying(false);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.onloadedmetadata = () => {
          setVideoDuration(videoRef.current?.duration || 0);
          setVideoCurrentTime(0);
        };
      }
    }
  };

  // Cargar archivo CSV externo para entrenar
  const handleLoadCsvForTraining = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const windows: WindowRecord[] = [];

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(r => r.trim().replace(/"/g, ''));
          if (row.length < 10) continue;

          const col = (name: string, fallback = 0) => {
            const idx = headers.indexOf(name);
            return idx >= 0 ? (parseFloat(row[idx]) || fallback) : fallback;
          };
          const colInt = (name: string, fallback = 0) => {
            const idx = headers.indexOf(name);
            return idx >= 0 ? (parseInt(row[idx]) || fallback) : fallback;
          };
          const colStr = (name: string, fallback = '') => {
            const idx = headers.indexOf(name);
            return idx >= 0 ? (row[idx] || fallback) : fallback;
          };

          windows.push({
            window_id: colInt('window_id', i),
            subject_id: colStr('subject_id', 'imported'),
            session_id: colStr('session_id', 'session_1'),
            task_name: colStr('task_name', 'estudio'),
            timestamp_start: col('timestamp_start'),
            timestamp_end: col('timestamp_end'),
            ear_mean: col('ear_mean'),
            ear_min: col('ear_min'),
            ear_std: col('ear_std', 0.005),
            ear_asymmetry_mean: col('ear_asymmetry_mean', 0.0),
            gaze_variance_mean: col('gaze_variance_mean'),
            perclos_mean: col('perclos_mean', 0.0),
            blink_rate_per_min: col('blink_rate_per_min', 15.0),
            yaw_mean: col('yaw_mean'),
            yaw_std: col('yaw_std'),
            pitch_mean: col('pitch_mean'),
            pitch_std: col('pitch_std'),
            roll_angle_mean: col('roll_angle_mean', 0.0),
            roll_angle_std: col('roll_angle_std', 0.5),
            head_forward_mean: col('head_forward_mean', 0.15),
            nose_delta_sum: col('nose_delta_sum'),
            frown_mean: col('frown_mean'),
            brow_raise_mean: col('brow_raise_mean', 0.1),
            mar_mean: col('mar_mean', 0.05),
            mar_max: col('mar_max', 0.05),
            jaw_drop_mean: col('jaw_drop_mean', 0.4),
            lip_tension_mean: col('lip_tension_mean', 0.35),
            shoulder_angle_mean: col('shoulder_angle_mean'),
            torso_slump_mean: col('torso_slump_mean', 0.5),
            hands_detected_mean: col('hands_detected_mean'),
            hand_face_dist_min: col('hand_face_dist_min', 1.0),
            predominant_touch_zone: colStr('predominant_touch_zone', 'ninguna'),
            sample_count: colInt('sample_count', 10),
            label: colInt('label'),
            label_name: colStr('label_name', 'ESTADO')
          });
        }
        setCustomCsvWindows(windows);
        playBeep(700);
      };
      reader.readAsText(file);
    }
  };

  // Ejecutar el Entrenamiento de la Red Neuronal
  const handleStartTraining = async () => {
    const dataSource = customCsvWindows.length > 0
      ? customCsvWindows
      : aggregateFramesIntoWindows(framesBufferRef.current, 2000);

    if (dataSource.length < 5) {
      alert('Se necesitan al menos 5 ventanas de 2 segundos para entrenar la red.');
      return;
    }

    setIsTraining(true);
    setTrainingProgress({ epoch: 0, totalEpochs: 60, loss: 0, accuracy: 0 });

    try {
      const result = await trainNeuroSynkModel(dataSource, 60, (progress) => {
        setTrainingProgress(progress);
      });
      setTrainedResult(result);
      playBeep(950);
    } catch (err: any) {
      console.error('Error entrenando modelo:', err);
      alert('Error en el entrenamiento: ' + err.message);
    } finally {
      setIsTraining(false);
    }
  };

  // Callback de Inferencia de MediaPipe
  const onResults = (results: any) => {
    const now = Date.now();
    frameTimesRef.current.push(now);
    frameTimesRef.current = frameTimesRef.current.filter(t => now - t < 1000);
    setActualFps(frameTimesRef.current.length);

    const canvas = canvasRef.current;
    if (!canvas || !results.image) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const w = canvas.width;
    const h = canvas.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, w, h);
    canvasCtx.drawImage(results.image, 0, 0, w, h);

    const drawConn = window.drawConnectors || (() => {});
    const drawLand = window.drawLandmarks || (() => {});

    // DIBUJO DE ROSTRO
    if (results.faceLandmarks) {
      const faces = results.faceLandmarks;

      if (showFaceMesh) {
        const ovalConn = window.FACEMESH_FACE_OVAL;
        if (ovalConn) drawConn(canvasCtx, faces, ovalConn, { color: '#10B981', lineWidth: 1.2 });

        const rEyeConn = window.FACEMESH_RIGHT_EYE;
        const lEyeConn = window.FACEMESH_LEFT_EYE;
        if (rEyeConn) drawConn(canvasCtx, faces, rEyeConn, { color: '#38BDF8', lineWidth: 1.5 });
        if (lEyeConn) drawConn(canvasCtx, faces, lEyeConn, { color: '#38BDF8', lineWidth: 1.5 });
      }

      if (showEyebrowsLips) {
        const lEyebrow = window.FACEMESH_LEFT_EYEBROW || FALLBACK_LEFT_EYEBROW;
        const rEyebrow = window.FACEMESH_RIGHT_EYEBROW || FALLBACK_RIGHT_EYEBROW;
        drawConn(canvasCtx, faces, lEyebrow, { color: '#F59E0B', lineWidth: 2 });
        drawConn(canvasCtx, faces, rEyebrow, { color: '#F59E0B', lineWidth: 2 });

        const lipsConn = window.FACEMESH_LIPS || FALLBACK_LIPS;
        drawConn(canvasCtx, faces, lipsConn, { color: '#EC4899', lineWidth: 2 });
      }
    }

    // DIBUJO DE TORSO
    if (showPoseSkeleton && results.poseLandmarks) {
      const poseConn = window.POSE_CONNECTIONS || FALLBACK_POSE_CONNECTIONS;
      drawConn(canvasCtx, results.poseLandmarks, poseConn, { color: '#06B6D4', lineWidth: 2.2 });
      drawLand(canvasCtx, results.poseLandmarks, { color: '#3B82F6', fillColor: '#93C5FD', lineWidth: 1, radius: 3 });
    }

    canvasCtx.restore();

    // EXTRACCIÓN DE MÉTRICAS BIOMÉTRICAS DE ALTA DEFINICIÓN
    const faces = results.faceLandmarks;
    if (!faces || faces.length === 0) return;

    // 1. Ojos y Parpadeos
    const rUpper = faces[159], rLower = faces[145], rOuter = faces[33], rInner = faces[133];
    const lUpper = faces[386], lLower = faces[374], lOuter = faces[263], lInner = faces[362];

    const rHeight = Math.hypot(rUpper.x - rLower.x, rUpper.y - rLower.y);
    const rWidth = Math.hypot(rOuter.x - rInner.x, rOuter.y - rInner.y);
    const earRight = rHeight / Math.max(0.001, rWidth);

    const lHeight = Math.hypot(lUpper.x - lLower.x, lUpper.y - lLower.y);
    const lWidth = Math.hypot(lOuter.x - lInner.x, lOuter.y - lInner.y);
    const earLeft = lHeight / Math.max(0.001, lWidth);

    const earAvg = (earRight + earLeft) / 2;

    // Detección de Parpadeos
    if (earAvg < 0.19) {
      if (!isBlinkingRef.current) {
        blinkCountRef.current += 1;
        isBlinkingRef.current = true;
      }
    } else if (earAvg > 0.23) {
      isBlinkingRef.current = false;
    }

    // PERCLOS (ventana deslizante de 30 segundos)
    perclosBufferRef.current.push({ isClosed: earAvg < 0.20, t: now });
    perclosBufferRef.current = perclosBufferRef.current.filter(p => now - p.t <= 30000);
    const closedCount = perclosBufferRef.current.filter(p => p.isClosed).length;
    const perclos = perclosBufferRef.current.length > 0 ? closedCount / perclosBufferRef.current.length : 0;

    // Mirada e Iris
    const nose = faces[1];
    const mouth = faces[14];
    const pI = faces[468] || rUpper;
    const pD = faces[473] || lUpper;
    const midX = (pI.x + pD.x) / 2;
    const midY = (pI.y + pD.y) / 2;
    gazeHistoryRef.current.push({ x: midX, y: midY, t: now });
    gazeHistoryRef.current = gazeHistoryRef.current.filter(p => now - p.t < 3000);

    let gazeVariance = 0;
    if (gazeHistoryRef.current.length > 3) {
      let mX = 0, mY = 0;
      gazeHistoryRef.current.forEach(p => { mX += p.x; mY += p.y; });
      mX /= gazeHistoryRef.current.length;
      mY /= gazeHistoryRef.current.length;
      gazeHistoryRef.current.forEach(p => {
        gazeVariance += Math.pow(p.x - mX, 2) + Math.pow(p.y - mY, 2);
      });
      gazeVariance /= gazeHistoryRef.current.length;
    }

    // 2. Pose Cefálica 3D y Protrusión
    const dx = faces[263].x - faces[33].x;
    const dy = mouth.y - ((faces[263].y + faces[33].y) / 2);
    const yawRatio = dx !== 0 ? (nose.x - faces[33].x) / dx : 0.5;
    const pitchRatio = dy !== 0 ? (nose.y - ((faces[263].y + faces[33].y) / 2)) / dy : 0.5;

    const rollRad = Math.atan2(faces[263].y - faces[33].y, faces[263].x - faces[33].x);
    const rollAngle = rollRad * (180 / Math.PI);

    let headForwardDist = 0.15;
    let shoulderAngle = 0;
    let torsoSlump = 0.5;
    const pose = results.poseLandmarks;
    if (pose && pose[11] && pose[12]) {
      const shMidX = (pose[11].x + pose[12].x) / 2;
      const shMidY = (pose[11].y + pose[12].y) / 2;
      headForwardDist = Math.hypot(nose.x - shMidX, nose.y - shMidY);

      if (pose[13]) {
        const rad = Math.atan2(pose[13].y - pose[11].y, pose[13].x - pose[11].x) - Math.atan2(pose[12].y - pose[11].y, pose[12].x - pose[11].x);
        shoulderAngle = Math.abs((rad * 180) / Math.PI);
      }

      if (pose[23] && pose[24]) {
        const hipMidY = (pose[23].y + pose[24].y) / 2;
        torsoSlump = Math.abs(hipMidY - shMidY);
      }
    }

    // Inquietud de nariz
    let noseDelta = 0;
    if (lastNosePosRef.current) {
      noseDelta = Math.hypot(nose.x - lastNosePosRef.current.x, nose.y - lastNosePosRef.current.y);
    }
    lastNosePosRef.current = { x: nose.x, y: nose.y };

    // 3. Tensión Facial FACS (Ceño, Elevación, Boca, Mandíbula)
    const faceWidth = Math.hypot(faces[234].x - faces[454].x, faces[234].y - faces[454].y);
    const frownDist = faceWidth !== 0 ? Math.hypot(faces[65].x - faces[295].x, faces[65].y - faces[295].y) / faceWidth : 0.22;

    const rBrowRaise = Math.hypot(faces[65].x - rUpper.x, faces[65].y - rUpper.y);
    const lBrowRaise = Math.hypot(faces[295].x - lUpper.x, faces[295].y - lUpper.y);
    const browRaiseAvg = (rBrowRaise + lBrowRaise) / 2;

    const mouthTop = faces[13] || mouth;
    const mouthBottom = faces[14] || mouth;
    const mouthLeft = faces[61] || faces[33];
    const mouthRight = faces[291] || faces[263];
    const mouthHeight = Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y);
    const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
    const MAR = mouthWidth !== 0 ? (mouthHeight / Math.max(0.001, mouthWidth)) : 0.05;

    const chin = faces[152] || mouthBottom;
    const jawDrop = faceWidth !== 0 ? Math.hypot(mouthTop.x - chin.x, mouthTop.y - chin.y) / faceWidth : 0.4;
    const lipCornerDist = faceWidth !== 0 ? mouthWidth / faceWidth : 0.35;

    // 4. Detección de Manos y Zonas de Contacto (Touch Hotspots)
    const rightHand = results.rightHandLandmarks as any[] | undefined;
    const leftHand = results.leftHandLandmarks as any[] | undefined;
    const handsDetected = (rightHand ? 1 : 0) + (leftHand ? 1 : 0);

    let handFaceDist = 1.0;
    let touchZone = 'ninguna';
    const activeHand = rightHand || leftHand;
    if (activeHand && activeHand.length > 0) {
      const hx = activeHand.reduce((s: number, p: any) => s + p.x, 0) / activeHand.length;
      const hy = activeHand.reduce((s: number, p: any) => s + p.y, 0) / activeHand.length;
      handFaceDist = Math.hypot(hx - nose.x, hy - nose.y);

      // Clasificación de zona anatómica de contacto
      const distChin = Math.hypot(hx - chin.x, hy - chin.y);
      const distForehead = Math.hypot(hx - faces[10].x, hy - faces[10].y);
      const distEyes = Math.hypot(hx - nose.x, hy - nose.y);
      const distCheek = Math.min(Math.hypot(hx - faces[234].x, hy - faces[234].y), Math.hypot(hx - faces[454].x, hy - faces[454].y));
      const distMouth = Math.hypot(hx - mouth.x, hy - mouth.y);

      if (distChin < 0.12) touchZone = 'barbilla';
      else if (distForehead < 0.12) touchZone = 'frente';
      else if (distEyes < 0.10) touchZone = 'ojos';
      else if (distMouth < 0.10) touchZone = 'boca';
      else if (distCheek < 0.12) touchZone = 'mejilla';
      else if (handFaceDist < 0.22) touchZone = 'cerca_rostro';
    }

    setLiveMetrics({
      ear: earAvg,
      earLeft: earLeft,
      earRight: earRight,
      perclos: perclos,
      blinkCount: blinkCountRef.current,
      yaw: yawRatio,
      pitch: pitchRatio,
      rollAngle: rollAngle,
      headForward: headForwardDist,
      frown: frownDist,
      browRaise: browRaiseAvg,
      mar: MAR,
      jawDrop: jawDrop,
      shoulderAngle: shoulderAngle,
      torsoSlump: torsoSlump,
      noseDelta: noseDelta,
      touchZone: touchZone
    });

    // Buffer rodante de 2 segundos para la Inferencia en Vivo
    window2sBufferRef.current.push({
      ear: earAvg,
      yaw: yawRatio,
      pitch: pitchRatio,
      frown: frownDist,
      noseDelta: noseDelta,
      gazeVar: gazeVariance,
      shoulder: shoulderAngle,
      mar: MAR,
      roll: rollAngle,
      t: now
    });
    window2sBufferRef.current = window2sBufferRef.current.filter(f => now - f.t <= 2000);

    // Predicción en vivo con el modelo entrenado
    if (trainedResult && window2sBufferRef.current.length >= 4 && now - lastInferenceTimeRef.current >= 200) {
      lastInferenceTimeRef.current = now;
      const wFrames = window2sBufferRef.current;
      const wCount = wFrames.length;

      const ears = wFrames.map(f => f.ear);
      const yaws = wFrames.map(f => f.yaw);
      const pitches = wFrames.map(f => f.pitch);
      const frowns = wFrames.map(f => f.frown);
      const gazes = wFrames.map(f => f.gazeVar);
      const shoulders = wFrames.map(f => f.shoulder);
      const mars = wFrames.map(f => f.mar);
      const rolls = wFrames.map(f => f.roll);

      const earMean = ears.reduce((a, b) => a + b, 0) / wCount;
      const earMin = Math.min(...ears);
      const yawMean = yaws.reduce((a, b) => a + b, 0) / wCount;
      const yawStd = Math.sqrt(yaws.reduce((sq, n) => sq + Math.pow(n - yawMean, 2), 0) / wCount) || 0.005;
      const pitchMean = pitches.reduce((a, b) => a + b, 0) / wCount;
      const pitchStd = Math.sqrt(pitches.reduce((sq, n) => sq + Math.pow(n - pitchMean, 2), 0) / wCount) || 0.005;
      const frownMean = frowns.reduce((a, b) => a + b, 0) / wCount;
      const noseDeltaSum = wFrames.reduce((a, b) => a + b.noseDelta, 0);
      const gazeVarMean = gazes.reduce((a, b) => a + b, 0) / wCount;
      const shoulderMean = shoulders.reduce((a, b) => a + b, 0) / wCount;
      const marMean = mars.reduce((a, b) => a + b, 0) / wCount;
      const rollMean = rolls.reduce((a, b) => a + b, 0) / wCount;

      const currentFeatures = [
        earMean,
        earMin,
        yawMean,
        yawStd,
        pitchMean,
        pitchStd,
        frownMean,
        noseDeltaSum,
        gazeVarMean,
        shoulderMean,
        marMean,
        rollMean
      ];

      const pred = predictCognitiveState(
        trainedResult.model,
        currentFeatures,
        trainedResult.featureMeans,
        trainedResult.featureStds
      );
      setLivePrediction(pred);
    }

    // Guardado en Buffer con Telemetría HD Completa
    const currentRef = activeStateRef.current;
    if (isRecordingRef.current && currentRef.label >= 0) {
      const record: FrameRecord = {
        timestamp: now,
        subject_id: subjectIdRef.current || 'anon',
        session_id: sessionIdRef.current || 'session_1',
        task_name: taskNameRef.current || 'estudio',
        ear_avg: earAvg,
        ear_left: earLeft,
        ear_right: earRight,
        gaze_x: midX,
        gaze_y: midY,
        gaze_variance: gazeVariance,
        perclos: perclos,
        blink_count: blinkCountRef.current,
        yaw_ratio: yawRatio,
        pitch_ratio: pitchRatio,
        roll_angle: rollAngle,
        head_forward_dist: headForwardDist,
        nose_delta: noseDelta,
        frown_dist: frownDist,
        brow_raise_avg: browRaiseAvg,
        mar: MAR,
        jaw_drop: jawDrop,
        lip_corner_dist: lipCornerDist,
        shoulder_angle: shoulderAngle,
        torso_slump: torsoSlump,
        hands_detected: handsDetected,
        hand_face_dist: handFaceDist,
        touch_zone: touchZone,
        label: currentRef.label,
        label_name: currentRef.name
      };
      framesBufferRef.current.push(record);
    }
  };

  const activeState = STATE_MAP[activeStateKey] || STATE_MAP['0'];
  const activeWindows = customCsvWindows.length > 0
    ? customCsvWindows
    : aggregateFramesIntoWindows(framesBufferRef.current, 2000);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 md:p-8 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center relative">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-900 ${isModelReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">NeuroSynk AI Hub</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold flex items-center gap-1">
                <Zap className="w-3 h-3" /> Multi-Subject Edition
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              Recolector Biométrico Científico & Entrenador de Red Neuronal en Vivo
            </p>
          </div>
        </div>

        {/* IDENTIDAD DE PARTICIPANTE, SESIÓN Y ACTIVIDAD */}
        <div className="flex flex-wrap items-center gap-3 bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[10px] uppercase font-bold">Participante:</span>
            <input
              type="text"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder="Ej: P01, Juan_M"
              className="bg-zinc-900 border border-zinc-700 text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-bold w-24 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[10px] uppercase font-bold">Sesión:</span>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Ej: Sesion_1"
              className="bg-zinc-900 border border-zinc-700 text-purple-300 px-2.5 py-1 rounded-lg text-xs font-bold w-20 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[10px] uppercase font-bold">Tarea:</span>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Ej: Lectura_Libreta, Pantalla"
              className="bg-zinc-900 border border-zinc-700 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold w-28 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* PESTAÑAS PRINCIPALES: RECOLECCIÓN VS ENTRENAMIENTO */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-800 font-mono text-xs">
            <button
              onClick={() => setActiveTab('RECORD')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'RECORD' ? 'bg-emerald-500 text-black font-bold shadow-lg' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4" /> 1. Recolección
            </button>
            <button
              onClick={() => setActiveTab('TRAIN')}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'TRAIN' ? 'bg-purple-500 text-black font-bold shadow-lg' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" /> 2. Entrenador IA
            </button>
          </div>

          <button
            onClick={() => setSoundFeedback(!soundFeedback)}
            title="Activar/Desactivar sonido"
            className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
          >
            {soundFeedback ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
          </button>
        </div>
      </div>

      {/* VISTA 1: RECOLECCIÓN DE DATOS */}
      {activeTab === 'RECORD' && (
        <div className="space-y-6">

          {/* PANEL DE CONTROL DE TECLAS */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-sm font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2 font-bold">
                <Key className="w-4 h-4 text-emerald-400" /> Etiquetado en Vivo (Presiona Teclas 0 - 5 o Barra Espaciadora)
              </h2>
              <span className="text-xs font-mono text-zinc-400 bg-zinc-950 px-3 py-1 rounded-xl border border-zinc-800">
                Estado Actual: <span className={`font-bold ${activeState.color}`}>{activeState.name}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.values(STATE_MAP).map(st => {
                const isCurrent = activeStateKey === st.key;
                return (
                  <button
                    key={st.key}
                    onClick={() => {
                      setActiveStateKey(st.key);
                      activeStateRef.current = st;
                      playBeep(st.key === '0' ? 350 : 520 + parseInt(st.key) * 70);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                      isCurrent ? `${st.bgColor} ${st.borderColor} shadow-lg scale-[1.02] ring-1 ring-white/20` : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-black/60 border border-white/10 text-white">
                        Tecla [{st.key}]
                      </span>
                      {isCurrent && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div>
                      <div className={`font-bold text-xs ${st.color}`}>{st.name}</div>
                      <div className="text-[10px] text-zinc-400 line-clamp-1">{st.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MAIN WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT: VIDEO Y CANVAS */}
            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col gap-4 shadow-xl relative">
              <div className="flex flex-wrap justify-between items-center gap-3 bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-zinc-600'}`} />
                  <span className="font-mono text-xs text-zinc-300 font-bold">
                    {isRecording ? 'REC GRABANDO DATASET' : 'EN PAUSA (Presiona Iniciar)'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-[11px] font-mono">
                  <button
                    onClick={() => setShowFaceMesh(!showFaceMesh)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      showFaceMesh ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-zinc-500'
                    }`}
                  >
                    Rostro
                  </button>
                  <button
                    onClick={() => setShowEyebrowsLips(!showEyebrowsLips)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      showEyebrowsLips ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-500'
                    }`}
                  >
                    Cejas/Labios
                  </button>
                  <button
                    onClick={() => setShowPoseSkeleton(!showPoseSkeleton)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      showPoseSkeleton ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-zinc-500'
                    }`}
                  >
                    Torso
                  </button>
                </div>

                <div className={`px-3 py-1.5 rounded-xl border font-mono text-xs font-extrabold uppercase ${activeState.bgColor} ${activeState.borderColor} ${activeState.color}`}>
                  [{activeState.key}] {activeState.name}
                </div>
              </div>

              {/* CANVAS */}
              <div className="relative rounded-2xl overflow-hidden bg-black flex-1 flex items-center justify-center border border-zinc-800 min-h-[380px] aspect-video">
                <video ref={videoRef} className="hidden" playsInline muted src={videoSrc || undefined} />
                <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-contain rounded-2xl" />

                <div className="absolute top-4 left-4 font-mono text-[11px] bg-black/80 border border-zinc-700/80 px-3 py-1.5 rounded-xl backdrop-blur-md text-zinc-300 flex items-center gap-3">
                  <div>FPS: <span className="text-emerald-400 font-bold">{actualFps}</span></div>
                  <div className="w-px h-3 bg-zinc-700" />
                  <div>Frames: <span className="text-white font-bold">{recordedCount}</span></div>
                  <div className="w-px h-3 bg-zinc-700" />
                  <div>Ventanas: <span className="text-emerald-400 font-bold">{windowCount}</span></div>
                </div>

                {/* PREDICCIÓN EN VIVO EN PANTALLA SI EL MODELO ESTÁ ENTRENADO */}
                {livePrediction && (
                  <div className="absolute bottom-4 left-4 right-4 bg-black/85 border border-purple-500/40 p-3.5 rounded-2xl backdrop-blur-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40">
                        <Cpu className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-zinc-400 uppercase">Predicción de Red Neuronal (En Vivo):</div>
                        <div className="text-sm font-black text-white font-mono flex items-center gap-2">
                          <span className="text-emerald-400">{livePrediction.className}</span>
                          <span className="text-xs text-zinc-400 font-normal">({(livePrediction.confidence * 100).toFixed(1)}% de Confianza)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CONTROLES DE REPRODUCCIÓN MP4 */}
              {activeMode === 'MP4' && (
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => jumpVideo(-5)}
                        disabled={!videoSrc}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-xl flex items-center gap-1 cursor-pointer border border-zinc-800"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> -5s
                      </button>
                      <button
                        onClick={handleMp4PlayToggle}
                        disabled={!videoSrc}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-black font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        {isVideoPlaying ? 'Pausar' : 'Reproducir'}
                      </button>
                      <button
                        onClick={() => jumpVideo(5)}
                        disabled={!videoSrc}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-xl flex items-center gap-1 cursor-pointer border border-zinc-800"
                      >
                        <FastForward className="w-3.5 h-3.5" /> +5s
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                      {[0.5, 1.0, 1.5, 2.0].map(rate => (
                        <button
                          key={rate}
                          onClick={() => changeSpeed(rate)}
                          className={`px-2 py-0.5 rounded-lg ${playbackRate === rate ? 'bg-purple-500 text-black font-bold' : 'text-zinc-400'}`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>

                    <div className="font-mono text-xs text-zinc-400">
                      {videoCurrentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s
                    </div>
                  </div>
                </div>
              )}

              {/* BOTONES DE GRABACIÓN */}
              <div className="flex gap-4">
                <button
                  onClick={() => toggleRecording()}
                  className={`flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                    isRecording ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20' : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                  }`}
                >
                  {isRecording ? <Pause className="w-5 h-5 fill-black" /> : <Play className="w-5 h-5 fill-black" />}
                  {isRecording ? 'Pausar Grabación (Espacio)' : 'Iniciar Grabación de Dataset (Espacio)'}
                </button>

                <button
                  onClick={() => {
                    framesBufferRef.current = [];
                    setRecordedCount(0);
                    setWindowCount(0);
                  }}
                  className="px-6 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs transition-all flex items-center gap-2 cursor-pointer border border-zinc-700"
                >
                  <Trash2 className="w-4 h-4 text-red-400" /> Limpiar
                </button>
              </div>
            </div>

            {/* RIGHT: EXPORTADOR */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between gap-6 shadow-xl">
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" /> Métricas del Dataset
                </h2>

                <div className="space-y-2">
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-mono text-zinc-400">Total Fotogramas</div>
                      <div className="text-2xl font-black text-white font-mono">{recordedCount}</div>
                    </div>
                    <div className="text-xs font-mono text-emerald-400">~{((recordedCount * 70) / 1024).toFixed(1)} KB</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <div className="text-xs font-mono text-zinc-400">Ventanas de 2s</div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">{windowCount}</div>
                    </div>
                    <div className="text-xs font-mono text-emerald-400 font-bold">TensorFlow Ready</div>
                  </div>
                </div>

                {/* PANEL DE SENSORES BIOMÉTRICOS DE ALTA DEFINICIÓN */}
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 uppercase font-bold">
                    <span>Telemetría HD en Vivo</span>
                    <span className="text-emerald-400">28+ Señales</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="text-[8px] font-mono text-zinc-500 uppercase">EAR (Ojos)</div>
                      <div className={`text-xs font-black font-mono ${
                        liveMetrics.ear < 0.2 ? 'text-blue-400' : 'text-emerald-400'
                      }`}>{liveMetrics.ear.toFixed(3)}</div>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="text-[8px] font-mono text-zinc-500 uppercase">PERCLOS</div>
                      <div className={`text-xs font-black font-mono ${
                        liveMetrics.perclos > 0.3 ? 'text-amber-400' : 'text-zinc-300'
                      }`}>{(liveMetrics.perclos * 100).toFixed(0)}%</div>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="text-[8px] font-mono text-zinc-500 uppercase">Parpadeos</div>
                      <div className="text-xs font-black font-mono text-white">{liveMetrics.blinkCount}</div>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="text-[8px] font-mono text-zinc-500 uppercase">MAR (Boca)</div>
                      <div className={`text-xs font-black font-mono ${
                        liveMetrics.mar > 0.4 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{liveMetrics.mar.toFixed(3)}</div>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="text-[8px] font-mono text-zinc-500 uppercase">Roll (°)</div>
                      <div className={`text-xs font-black font-mono ${
                        Math.abs(liveMetrics.rollAngle) > 10 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{liveMetrics.rollAngle.toFixed(1)}°</div>
                    </div>
                    <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div className="text-[8px] font-mono text-zinc-500 uppercase">Hombros (°)</div>
                      <div className="text-xs font-black font-mono text-zinc-300">{liveMetrics.shoulderAngle.toFixed(1)}°</div>
                    </div>
                  </div>

                  {/* Zona de contacto de manos */}
                  <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-500">Contacto Mano-Rostro:</span>
                    <span className={`font-bold uppercase ${liveMetrics.touchZone !== 'ninguna' ? 'text-purple-400 font-black' : 'text-zinc-500'}`}>
                      {liveMetrics.touchZone}
                    </span>
                  </div>

                  {/* Barra de bostezo */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                      <span>Apertura Bucal (Bostezo / MAR)</span>
                      <span className={liveMetrics.mar > 0.4 ? 'text-amber-400 font-bold' : ''}>
                        {liveMetrics.mar > 0.4 ? '⚠ BOSTEZO / TENSIÓN' : 'Normal'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-100 ${
                          liveMetrics.mar > 0.4 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, liveMetrics.mar * 150).toFixed(0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-2">
                  <div className="text-xs font-bold text-purple-300 uppercase flex items-center gap-1.5 font-mono">
                    <Cpu className="w-4 h-4" /> Entrenar en esta misma App
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Cuando tengas suficientes ventanas grabadas, ve a la pestaña <strong>"2. Entrenador IA"</strong> para entrenar y descargar el modelo con 1 clic.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => exportRawFramesToCSV(framesBufferRef.current)}
                  disabled={recordedCount === 0}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer uppercase tracking-wider"
                >
                  <Download className="w-4 h-4" /> Descargar CSV por Cuadros
                </button>

                <button
                  onClick={() => {
                    const windows = aggregateFramesIntoWindows(framesBufferRef.current, 2000);
                    exportWindowsToCSV(windows);
                  }}
                  disabled={recordedCount === 0}
                  className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer border border-emerald-500/30 uppercase tracking-wider"
                >
                  <Download className="w-4 h-4 text-emerald-400" /> Descargar CSV Ventanas 2s
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: ENTRENADOR DE RED NEURONAL TENSORFLOW.JS */}
      {activeTab === 'TRAIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUMNA IZQUIERDA: CONFIGURACIÓN Y EJECUCIÓN DEL ENTRENAMIENTO */}
          <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-400" /> Entrenador de Red Neuronal (TensorFlow.js)
                </h2>
                <p className="text-xs text-zinc-400 font-mono mt-1">
                  Aprende patrones biométricos y genera los archivos <strong>model.json</strong> y <strong>weights.bin</strong>
                </p>
              </div>
            </div>

            {/* SELECCIÓN DE ORIGEN DE DATOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="text-xs font-mono text-zinc-400 uppercase font-bold">1. Usar Ventanas de la Sesión Actual</div>
                <div className="text-xl font-black text-white font-mono">{windowCount} ventanas en memoria</div>
                <div className="text-[11px] text-zinc-500">Datos capturados en vivo con la cámara o MP4.</div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="text-xs font-mono text-zinc-400 uppercase font-bold">2. O Cargar archivo CSV guardado</div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleLoadCsvForTraining}
                  className="block w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 cursor-pointer"
                />
                {customCsvWindows.length > 0 && (
                  <div className="text-xs font-mono text-emerald-400 font-bold">
                    ✅ {customCsvWindows.length} ventanas cargadas desde el archivo CSV
                  </div>
                )}
              </div>
            </div>

            {/* BARRA DE PROGRESO DE ENTRENAMIENTO */}
            {isTraining && trainingProgress && (
              <div className="p-6 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-4 animate-pulse">
                <div className="flex justify-between items-center font-mono text-xs">
                  <span className="text-purple-300 font-bold flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                    Entrenando Red Neuronal: Época {trainingProgress.epoch} de {trainingProgress.totalEpochs}
                  </span>
                  <span className="text-emerald-400 font-black text-sm">
                    Precisión: {(trainingProgress.accuracy * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-100"
                    style={{ width: `${(trainingProgress.epoch / trainingProgress.totalEpochs) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                  <div>Loss (Pérdida): {trainingProgress.loss.toFixed(4)}</div>
                  <div>Algoritmo: Adam (Learning Rate: 0.005)</div>
                </div>
              </div>
            )}

            {/* RESULTADOS DEL ENTRENAMIENTO */}
            {trainedResult && !isTraining && (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">¡Red Neuronal Entrenada con Éxito!</h3>
                    <p className="text-xs font-mono text-emerald-400">
                      Precisión Final: {(trainedResult.finalAccuracy * 100).toFixed(1)}% • Loss: {trainedResult.finalLoss.toFixed(4)}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">
                  El cerebro IA aprendió a correlacionar las <strong>12 métricas biométricas</strong> (incluyendo MAR y Roll) con los <strong>6 estados cognitivos</strong>. Ahora puedes descargar los archivos para integrarlos en <strong>NeuroSynk FocusBud</strong>.
                </p>

                <button
                  onClick={() => exportTrainedModel(trainedResult.model)}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg uppercase tracking-wider"
                >
                  <Download className="w-4 h-4" /> Descargar Modelo IA (model.json + weights.bin)
                </button>
              </div>
            )}

            {/* BOTÓN DE INICIO DE ENTRENAMIENTO */}
            <button
              onClick={handleStartTraining}
              disabled={isTraining || activeWindows.length < 5}
              className="w-full py-5 bg-purple-500 hover:bg-purple-400 text-black font-black text-sm rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer uppercase tracking-wider shadow-lg shadow-purple-500/20"
            >
              <Cpu className="w-5 h-5" /> Iniciar Entrenamiento con {activeWindows.length} Ventanas
            </button>
          </div>

          {/* COLUMNA DERECHA: EXPLICACIÓN DE LA ARQUITECTURA */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 font-mono">
                <BrainCircuit className="w-5 h-5 text-emerald-400" /> Arquitectura del Modelo
              </h2>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-3 bg-zinc-950 rounded-xl border border-emerald-500/30">
                  <div className="text-zinc-400 text-[10px]">Capa de Entrada (Input)</div>
                  <div className="text-emerald-400 font-bold mt-1">12 Neuronas — EAR, Yaw, Pitch, Frown, NoseDelta, Gaze, Shoulder, MAR, Roll + más</div>
                </div>

                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-zinc-400 text-[10px]">Capa Oculta 1 + Dropout</div>
                  <div className="text-purple-400 font-bold mt-1">64 Neuronas (ReLU, heNormal) + Dropout 0.15</div>
                </div>

                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-zinc-400 text-[10px]">Capa Oculta 2</div>
                  <div className="text-purple-400 font-bold mt-1">32 Neuronas (ReLU, heNormal)</div>
                </div>

                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  <div className="text-zinc-400 text-[10px]">Capa Oculta 3</div>
                  <div className="text-purple-400 font-bold mt-1">16 Neuronas (ReLU, heNormal)</div>
                </div>

                <div className="p-3 bg-zinc-950 rounded-xl border border-emerald-500/20">
                  <div className="text-zinc-400 text-[10px]">Capa de Salida (Output)</div>
                  <div className="text-emerald-400 font-bold mt-1">6 Estados Cognitivos (Softmax)</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs font-mono text-zinc-400">
              <div className="text-white font-bold uppercase">📁 Archivos generados:</div>
              <div>• <strong>model.json</strong> (Estructura)</div>
              <div>• <strong>weights.bin</strong> (Pesos IA)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
