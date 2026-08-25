import React, { useEffect, useRef, useState } from 'react';
import { Camera, BrainCircuit, Activity, Zap, ShieldCheck, AlertCircle } from 'lucide-react';
import { aiClient } from '../api/aiClient';
import { AIInferenceResponse } from '../types/aiContracts';
import {
  calculateEAR,
  calculateHeadPose,
  calculateFrown,
  calculateShoulderAngle,
  aggregateBiometricWindow,
  RawBiometricFrame
} from '../services/featureExtractor';

interface FocusTrackerProps {
  onInferenceResult?: (result: AIInferenceResponse) => void;
}

export const FocusTracker: React.FC<FocusTrackerProps> = ({ onInferenceResult }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holisticRef = useRef<any>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  // Estados de IA devueltos por el backend Python
  const [prediction, setPrediction] = useState<AIInferenceResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Búfer rodante de frames (2 segundos)
  const framesBufferRef = useRef<RawBiometricFrame[]>([]);
  const lastNosePosRef = useRef<{ x: number; y: number } | null>(null);

  // 1. Verificación periódica del estado del Microservicio Python
  useEffect(() => {
    const checkServer = async () => {
      const healthy = await aiClient.checkHealth();
      setIsBackendHealthy(healthy !== null);
    };

    checkServer();
    const interval = setInterval(checkServer, 10000);
    return () => clearInterval(interval);
  }, []);

  // 2. Inicialización de Cámara y MediaPipe
  useEffect(() => {
    let isMounted = true;

    const initPipeline = async () => {
      if (!window.Holistic) {
        setTimeout(initPipeline, 200);
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

        holistic.onResults(handleMediaPipeResults);
        holisticRef.current = holistic;

        // Iniciar WebCam
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsCameraActive(true);
          };
        }

        // Bucle de procesamiento de frames
        let isProcessing = false;
        const processFrame = async () => {
          if (!isMounted) return;
          if (videoRef.current && videoRef.current.readyState >= 2 && !isProcessing) {
            isProcessing = true;
            try {
              await holistic.send({ image: videoRef.current });
            } catch (_) {
            } finally {
              isProcessing = false;
            }
          }
          requestAnimationFrame(processFrame);
        };
        requestAnimationFrame(processFrame);
      } catch (err) {
        console.error("❌ Error al iniciar el pipeline visual:", err);
      }
    };

    initPipeline();

    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Extracción de Features en cada frame de MediaPipe
  const handleMediaPipeResults = (results: any) => {
    const canvas = canvasRef.current;
    if (!canvas || !results.image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Renderizar imagen de cámara
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // Dibujar mesh facial si está disponible
    if (results.faceLandmarks && window.drawConnectors && window.FACEMESH_FACE_OVAL) {
      window.drawConnectors(ctx, results.faceLandmarks, window.FACEMESH_FACE_OVAL, {
        color: '#10B981',
        lineWidth: 1.2,
      });
    }
    ctx.restore();

    const faces = results.faceLandmarks;
    if (!faces || faces.length === 0) return;

    const now = Date.now();
    const ear = calculateEAR(faces);
    const { yaw, pitch } = calculateHeadPose(faces);
    const frown = calculateFrown(faces);
    const shoulderAngle = calculateShoulderAngle(results.poseLandmarks || []);

    const nose = faces[1];
    let noseDelta = 0;
    if (lastNosePosRef.current && nose) {
      noseDelta = Math.hypot(nose.x - lastNosePosRef.current.x, nose.y - lastNosePosRef.current.y);
    }
    if (nose) {
      lastNosePosRef.current = { x: nose.x, y: nose.y };
    }

    const midEyeX = (faces[159].x + faces[386].x) / 2.0;
    const midEyeY = (faces[159].y + faces[386].y) / 2.0;

    framesBufferRef.current.push({
      timestamp: now,
      ear,
      yaw,
      pitch,
      frown,
      nose_delta: noseDelta,
      gaze_x: midEyeX,
      gaze_y: midEyeY,
      shoulder_angle: shoulderAngle
    });

    // Mantener únicamente los últimos 2500ms
    framesBufferRef.current = framesBufferRef.current.filter(f => now - f.timestamp <= 2500);
  };

  // 4. Bucle de Inferencia hacia el Microservicio Python (cada 2.0 segundos)
  useEffect(() => {
    const inferenceTimer = setInterval(async () => {
      if (framesBufferRef.current.length < 5 || isEvaluating) return;

      const payload = aggregateBiometricWindow(framesBufferRef.current);
      setIsEvaluating(true);
      const startT = performance.now();

      try {
        const res = await aiClient.evaluateBiometrics(payload);
        const elapsed = Math.round(performance.now() - startT);
        setLatencyMs(elapsed);
        setPrediction(res);
        if (onInferenceResult) {
          onInferenceResult(res);
        }
      } catch (err) {
        console.warn("⚠️ Fallo en llamada a microservicio Python:", err);
      } finally {
        setIsEvaluating(false);
      }
    }, 2000);

    return () => clearInterval(inferenceTimer);
  }, [isEvaluating, onInferenceResult]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Header con Estado del Microservicio */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/30">
            <BrainCircuit className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">Pipeline Visual & Microservicio IA</h2>
            <p className="text-xs text-zinc-400">MediaPipe Edge Feature Extractor ➔ FastAPI Core</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isBackendHealthy ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Python Core Online ({latencyMs}ms)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span>Python Core Offline (Puerto 8000)</span>
            </div>
          )}
        </div>
      </div>

      {/* Visor de Cámara y Canvas */}
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-zinc-800">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-contain" />

        {!isCameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-500 font-mono text-xs">
            <Camera className="w-8 h-8 animate-pulse text-zinc-600" />
            <span>Inicializando sensor óptico y Face Mesh...</span>
          </div>
        )}

        {/* HUD de Inferencia en Tiempo Real */}
        {prediction && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/85 border border-white/10 p-4 rounded-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Predicción del Microservicio:</div>
              <div className="text-base font-black text-white font-mono flex items-center gap-2">
                <span className="text-emerald-400">{prediction.class_name}</span>
                <span className="text-xs text-zinc-400 font-normal">({(prediction.confidence * 100).toFixed(1)}%)</span>
              </div>
              <div className="text-xs text-zinc-300 font-sans mt-0.5">{prediction.status_message}</div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Enfoque (CLAP)</div>
                <div className="text-lg font-black text-emerald-400 font-mono">{prediction.focus_score}%</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-mono text-zinc-400 uppercase">Estrés / Fatiga</div>
                <div className="text-lg font-black text-rose-400 font-mono">{prediction.stress_level}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
