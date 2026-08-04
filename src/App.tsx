import React, { useEffect, useRef, useState } from 'react';
import { Activity, BrainCircuit, CheckCircle, Target, ArrowRight, Play, Pause, Eye, Timer, MessageSquare, Send, Settings, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar, FocusBudState } from './components/Avatar';
import { AvatarMessage } from './components/avatar/AvatarMessage';
import { AVATAR_CONFIG, getRandomStateMessage, FocusState } from './config/avatarConfig';
import { audioService } from './services/audioService';

declare global {
  interface Window {
    Holistic: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    FACEMESH_TESSELATION: any;
    FACEMESH_CONTOURS: any;
    FACEMESH_RIGHT_EYE: any;
    FACEMESH_RIGHT_EYEBROW: any;
    FACEMESH_LEFT_EYE: any;
    FACEMESH_LEFT_EYEBROW: any;
    FACEMESH_FACE_OVAL: any;
    FACEMESH_LIPS: any;
    POSE_CONNECTIONS: any;
  }
}

export default function App() {
  type ScreenState = 'MODE_SELECTION' | 'WORKSPACE';
  type WorkMode = 'DEEP_WORK' | 'ANTI_PARALYSIS' | 'BODY_DOUBLING';

  const [currentScreen, setCurrentScreen] = useState<ScreenState>('MODE_SELECTION');
  const [workMode, setWorkMode] = useState<WorkMode>('DEEP_WORK');

  // Telemetría Biométrica en Vivo
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [landmarksCount, setLandmarksCount] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState<number>(100);

  const frameTimesRef = useRef<number[]>([]);
  const lastTelemetryUpdateRef = useRef<number>(0);

  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  // Sync ref for MediaPipe callback
  useEffect(() => {
      isPausedRef.current = isPaused;
  }, [isPaused]);

  // Keyboard Listener (Q to pause)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (isStarted && e.key.toLowerCase() === 'q') {
              setIsPaused(prev => !prev);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStarted]);

  // Separate Timer logic with Pause control
  useEffect(() => {
      let timerInterval: any;
      if (isStarted && currentStepIdx < steps.length && !isPaused) {
          timerInterval = setInterval(() => {
              setElapsedTime(prev => prev + 1);
          }, 1000);
      }
      return () => {
          if (timerInterval) clearInterval(timerInterval);
      };
  }, [isStarted, currentStepIdx, steps.length, isPaused]);

  // UX states for Micro-rewards
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rewardKaomoji, setRewardKaomoji] = useState('');
  const [isShowingReward, setIsShowingReward] = useState(false);
  const KAOMOJIS = ["(๑˃̵ᴗ˂̵)و 🚀", "✨ ESTELAR ✨", "🌸 FLUIDO 🌸", "🔥 ¡FUEGO! 🔥", "(ง'̀-'́)ง ⚡️"];

  // Chat States
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([
    { role: 'assistant', content: '¿Duda rápida? Pregunta y no pierdas el flujo.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const currentMsgs = [...chatMessages, { role: 'user', content: userMsg }];
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentMsgs.map(m => ({ role: m.role, content: m.content })) })
      });
      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Enlace neuronal inestable.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Performance Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holisticRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // FocusBud Avatar State Engine & Calibration
  const [avatarState, setAvatarState] = useState<FocusBudState>('ENFOQUE');
  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const lastAvatarStateRef = useRef<{ state: FocusBudState; time: number }>({
    state: 'ENFOQUE',
    time: Date.now(),
  });
  const celebrationUntilRef = useRef<number>(0);
  const baselineRef = useRef<{ yaw: number; pitch: number; browDist: number } | null>(null);
  const shouldCaptureBaselineRef = useRef<boolean>(false);

  // Alertas Multimodales (Texto + Audio)
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => audioService.isMuted());
  const messageTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);

  const triggerStateAlert = (newState: FocusState) => {
    setAvatarState(newState);
    const frase = getRandomStateMessage(newState);
    if (frase) {
      setCurrentMessage(frase);
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      messageTimeoutRef.current = window.setTimeout(() => {
        setCurrentMessage(null);
        messageTimeoutRef.current = null;
      }, 3500);
    }
    audioService.playStateSound(newState);
  };

  const handleRecalibrate = () => {
    setIsRecalibrating(true);
    baselineRef.current = null; // Reset baseline so next frame auto-calibrates with current posture
    shouldCaptureBaselineRef.current = true;
    metricsRef.current.blinks = [];
    metricsRef.current.is_blinking = false;
    metricsRef.current.gaze_history = [];
    metricsRef.current.distraction_start = null;
    metricsRef.current.stress_frames = 0;
    metricsRef.current.nivel_clap = 100.0;
    metricsRef.current.nivel_carga = 0.0;

    lastAvatarStateRef.current = { state: 'ENFOQUE', time: Date.now() };
    setAvatarState('ENFOQUE');

    if (focusRef.current) focusRef.current.style.width = '100%';
    if (fatigueRef.current) fatigueRef.current.style.width = '0%';
    if (statusRef.current) {
      statusRef.current.textContent = 'BIOMETRÍA Y CÁMARA RECALIBRADAS 🎯';
      statusRef.current.className = 'px-4 py-2 mt-20 left-4 rounded-md border font-mono text-xs tracking-wider absolute bg-emerald-500/20 text-emerald-400 border-emerald-500/40 uppercase shadow-2xl backdrop-blur-md z-20';
    }

    setTimeout(() => {
      setIsRecalibrating(false);
    }, 1000);
  };

  // HUD Stat Refs and variables
  const focusRef = useRef<HTMLDivElement>(null);
  const fatigueRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  
  // NÚCLEO PDEF v1.0 State
  const metricsRef = useRef({
    blinks: [] as number[],
    is_blinking: false,
    gaze_history: [] as {x: number, y: number, t: number}[],
    distraction_start: null as number | null,
    stress_frames: 0,
    last_auto_chat: 0,
    
    // UI mapped properties
    nivel_clap: 100.0,
    nivel_carga: 0.0,
  });

  // Automated System Intervention (Stress trigger to AI)
  const interventionRef = useRef((info: string) => {});
  useEffect(() => {
     interventionRef.current = async (info: string) => {
        if (isChatLoading) return;
        setIsChatLoading(true);
        try {
           const sysMsg = { role: 'system', content: info };
           const currentMsgs = chatMessages.map(m => ({ role: m.role, content: m.content }));
           const response = await fetch('/api/chat', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ messages: [...currentMsgs, sysMsg] })
           });
           const data = await response.json();
           setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (e) {
           console.error("Intervention error:", e);
        } finally {
           setIsChatLoading(false);
        }
     };
  }, [chatMessages, isChatLoading]);

  const isSystemBooted = useRef(false);

  const handleStart = async (e?: React.FormEvent, modeChoice?: WorkMode) => {
    if (e) e.preventDefault();
    const finalTask = task.trim() ? task : 'Estudiar material general';
    setTask(finalTask);
    const activeMode = modeChoice || workMode;
    setWorkMode(activeMode);
    setIsLoading(true);

    try {
      const response = await fetch('/api/split-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: finalTask, mode: activeMode }),
      });
      const data = await response.json();
      if (data.steps) {
        setSteps(data.steps.map((s: string) => s.replace(/(Paso \d+:)/, '').trim()));
      }
    } catch (err) {
      setSteps(['Preparar material', 'Iniciar primera fase', 'Revisar progreso', 'Finalizar']);
    } finally {
      setIsLoading(false);
      setIsStarted(true);
      setCurrentScreen('WORKSPACE');
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    let isComponentMounted = true;

    if (isStarted && !isSystemBooted.current && videoRef.current && canvasRef.current) {
      isSystemBooted.current = true;
      const initSystem = async () => {
        if (!window.Holistic) {
           if (statusRef.current) statusRef.current.textContent = "ESPERANDO MEDIAPIPE CDN...";
           setTimeout(initSystem, 1000);
           return;
        }

        try {
          // 1. Initialize Holistic Model
          const holistic = new window.Holistic({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
          });

          holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: true,
            refineFaceLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });

          holistic.onResults(onResults);
          holisticRef.current = holistic;

          // 2. Request Camera Natively (Solves MediaPipe Camera Utils bugs in modern browsers)
          if (statusRef.current) statusRef.current.textContent = "SOLICITANDO CAMARA...";
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
          });
          
          if (!isComponentMounted) {
              stream.getTracks().forEach(track => track.stop());
              return;
          }

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
            };
            
            // 3. Start processing frames once video is playing
            videoRef.current.onplaying = () => {
              if (statusRef.current) statusRef.current.textContent = "ANALIZANDO BIOMETRIA...";
              
              let isProcessing = false;
              
              const sendToMediaPipe = async () => {
                if (!isComponentMounted) return;
                
                if (videoRef.current && 
                    videoRef.current.readyState >= 2 && 
                    videoRef.current.videoWidth > 0 && 
                    videoRef.current.videoHeight > 0 && 
                    holisticRef.current && 
                    !isProcessing) {
                  
                  isProcessing = true;
                  try {
                    await holisticRef.current.send({ image: videoRef.current });
                  } catch (e) {
                    console.warn("MediaPipe Frame Skipped:", e);
                  } finally {
                    isProcessing = false;
                  }
                }
                
                if (isComponentMounted) {
                  animationFrameId = requestAnimationFrame(sendToMediaPipe);
                }
              };
              sendToMediaPipe();
            };
          }
        } catch (error) {
          console.error("Camera access denied or error:", error);
          if (statusRef.current) {
             statusRef.current.textContent = "ERROR: ACCESO A CAMARA DENEGADO";
             statusRef.current.className = "px-4 py-2 mt-4 rounded-md border font-mono text-xs tracking-wider absolute top-4 left-4 bg-red-500/10 text-red-500 border-red-500/30 uppercase shadow-2xl backdrop-blur-md";
          }
        }
      };

      initSystem();
    }
    
    return () => {
        isComponentMounted = false;
        isSystemBooted.current = false;
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        
        if (holisticRef.current) {
            holisticRef.current.close();
            holisticRef.current = null;
        }
    }
  }, [isStarted]);

  const onResults = (results: any) => {
    try {
      if (!results) {
        setFaceDetected(false);
        setLandmarksCount(0);
        return;
      }

      const faces = results.faceLandmarks;
      if (!faces || faces.length === 0) {
        setFaceDetected(false);
        setLandmarksCount(0);
      } else {
        setFaceDetected(true);
        setLandmarksCount(faces.length);
      }

      const canvasCtx = canvasRef.current?.getContext('2d');
      if (canvasCtx && canvasRef.current && videoRef.current && results.image) {
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, width, height);

        // Flip horizontally to mirror
        canvasCtx.translate(width, 0);
        canvasCtx.scale(-1, 1);
        
        // Draw Video feed onto canvas
        canvasCtx.drawImage(results.image, 0, 0, width, height);

        // MediaPipe overlays (Classic Python Styling)
        if (faces && window.drawConnectors) {
          if (window.FACEMESH_RIGHT_EYEBROW) window.drawConnectors(canvasCtx, faces, window.FACEMESH_RIGHT_EYEBROW, {color: '#FF3030', lineWidth: 1.5}); // Rojo
          if (window.FACEMESH_RIGHT_EYE) window.drawConnectors(canvasCtx, faces, window.FACEMESH_RIGHT_EYE, {color: '#FF3030', lineWidth: 1.5});
          if (window.FACEMESH_LEFT_EYEBROW) window.drawConnectors(canvasCtx, faces, window.FACEMESH_LEFT_EYEBROW, {color: '#30FF30', lineWidth: 1.5}); // Verde
          if (window.FACEMESH_LEFT_EYE) window.drawConnectors(canvasCtx, faces, window.FACEMESH_LEFT_EYE, {color: '#30FF30', lineWidth: 1.5});
          if (window.FACEMESH_FACE_OVAL) window.drawConnectors(canvasCtx, faces, window.FACEMESH_FACE_OVAL, {color: '#E0E0E0', lineWidth: 1.5}); // Blanco
          if (window.FACEMESH_LIPS) window.drawConnectors(canvasCtx, faces, window.FACEMESH_LIPS, {color: '#E0E0E0', lineWidth: 1.5});
        }
        if (results.poseLandmarks && window.POSE_CONNECTIONS && window.drawConnectors) {
          window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#E0E0E0', lineWidth: 2 });
          if (window.drawLandmarks) window.drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#00FFFF', lineWidth: 1, radius: 2.5 });
        }

        canvasCtx.restore();
      }

      // Telemetría FPS & Score
      const now = Date.now();
      frameTimesRef.current.push(now);
      frameTimesRef.current = frameTimesRef.current.filter(t => now - t < 1000);
      const calculatedFps = frameTimesRef.current.length;

      if (now - lastTelemetryUpdateRef.current > 300) {
        lastTelemetryUpdateRef.current = now;
        setFps(calculatedFps);
        setCurrentScore(Math.round(metricsRef.current.nivel_clap));
      }

      if (isPausedRef.current) {
        if (statusRef.current) {
          statusRef.current.textContent = "SISTEMA PAUSADO (PULSA 'Q')";
          statusRef.current.className = `px-4 py-2 mt-20 left-4 rounded-md border font-mono text-xs tracking-wider absolute bg-blue-500/10 text-blue-400 border-blue-500/30 uppercase shadow-2xl backdrop-blur-md z-20`;
        }
        return;
      }

      // ===========================================
      // NÚCLEO BIOMÉTRICO P.D.E.F. v1.0 (Commit 0d38d68 Fiel)
      // ===========================================
      let statusMsg = "EN ESTADO DE FLUJO (FIJACIÓN ACTIVA)";
      let statusColor = "text-green-500";
      let statusBg = "bg-green-500/10";
      let statusBorder = "border-green-500/30";

      let distDuration = 0;
      let blinkFreq = 0;

      if (faces) {
        const metrics = metricsRef.current;

        // --- EXTRACCIÓN DE MALLA (PDEF) ---
        const pI = faces[468] || faces[159]; // Pupila/Ojo Izquierdo
        const pD = faces[473] || faces[386]; // Pupila/Ojo Derecho
        const upperEye = faces[159];
        const lowerEye = faces[145];
        const outerEye = faces[33];
        const innerEye = faces[133];
        const cejaI = faces[65];
        const cejaD = faces[295];
        const nose = faces[1];
        const mouth = faces[14];

        // 1. FRECUENCIA DE PARPADEO (Fatiga)
        const eyeHeight = Math.hypot(upperEye.x - lowerEye.x, upperEye.y - lowerEye.y);
        const eyeWidth = Math.hypot(outerEye.x - innerEye.x, outerEye.y - innerEye.y);
        const EAR = eyeHeight / eyeWidth;
        
        if (EAR < 0.2 && !metrics.is_blinking) {
            metrics.is_blinking = true;
            metrics.blinks.push(now);
        } else if (EAR >= 0.2) {
            metrics.is_blinking = false;
        }
        // Ventana deslizante de 60s
        metrics.blinks = metrics.blinks.filter(t => now - t < 60000);
        blinkFreq = metrics.blinks.length; 

        // 2. ESTABILIDAD DE MIRADA (Varianza Pupilar)
        const midX = (pI.x + pD.x) / 2;
        const midY = (pI.y + pD.y) / 2;
        metrics.gaze_history.push({x: midX, y: midY, t: now});
        metrics.gaze_history = metrics.gaze_history.filter(p => now - p.t < 10000); // Ventana de 10s

        let variance = 0;
        if (metrics.gaze_history.length > 5) {
            let mX = 0, mY = 0;
            metrics.gaze_history.forEach(p => { mX += p.x; mY += p.y; });
            mX /= metrics.gaze_history.length;
            mY /= metrics.gaze_history.length;
            metrics.gaze_history.forEach(p => {
                variance += Math.pow(p.x - mX, 2) + Math.pow(p.y - mY, 2);
            });
            variance /= metrics.gaze_history.length;
        }
        // Invertimos varianza matemáticamente para estabilidad 0-100
        let gazeStability = Math.max(0, Math.min(100, 100 - (variance * 50000)));

        // 3. ÁNGULO DE EULER (Dirección Yaw/Pitch)
        const dx = faces[263].x - faces[33].x;
        const dy = mouth.y - ((faces[263].y + faces[33].y) / 2);
        
        const yawRatio = (nose.x - faces[33].x) / dx; // Asimetría izq/der (0.5 ideal)
        const pitchRatio = (nose.y - ((faces[263].y + faces[33].y) / 2)) / dy; // Asimetría arr/aba
        
        let isDistracted = false;
        // Yaw ±25° (~0.25 / 0.75), Pitch ±15° (~0.3 / 0.8)
        if (yawRatio < 0.25 || yawRatio > 0.75 || pitchRatio < 0.3 || pitchRatio > 0.8) {
            isDistracted = true;
        }

        if (isDistracted) {
            if (!metrics.distraction_start) metrics.distraction_start = now;
        } else {
            metrics.distraction_start = null;
        }
        distDuration = metrics.distraction_start ? (now - metrics.distraction_start) / 1000 : 0;

        // 4. MICRO-EXPRESIONES (Estrés/Sobrecarga Tarea)
        const faceWidth = Math.hypot(faces[234].x - faces[454].x, faces[234].y - faces[454].y);
        const eyebrowDist = Math.hypot(cejaI.x - cejaD.x, cejaI.y - cejaD.y) / faceWidth;
        
        // Ceño fruncido si la distancia < 0.22 ancho de cara
        if (eyebrowDist < 0.22) {
            metrics.stress_frames++;
        } else {
            metrics.stress_frames = Math.max(0, metrics.stress_frames - 2);
        }
        const isStressed = metrics.stress_frames > 45; // ~1.5 seg de fruncir constante

        // --- ALGORITMO C.L.A.P. ---
        // ( (Estabilidad de Mirada + Frecuencia de Parpadeo) / 2 ) * ( 1 / Duración de Distracción )
        const normBlinks = Math.min(100, (blinkFreq / 15) * 100); 
        const clapRaw = ((gazeStability + normBlinks) / 2) * (1 / Math.max(1, distDuration));
        
        // Suavizado para la barra UI
        metrics.nivel_clap += (clapRaw - metrics.nivel_clap) * 0.1;
        metrics.nivel_carga = isStressed ? Math.min(100, metrics.nivel_carga + 2) : 
                               (isDistracted ? Math.min(100, metrics.nivel_carga + 0.5) : Math.max(0, metrics.nivel_carga - 0.5));

        // --- RENDERIZADO VISUAL "JUICE" & AUTO-CHAT ---
        if (isStressed) {
            statusMsg = "⚠️ ESTRÉS COGNITIVO DETECTADO (CEÑO)";
            statusColor = "text-purple-400";
            statusBg = "bg-purple-500/10";
            statusBorder = "border-purple-500/30";
            
            // Intervención de Mentor IA Inteligente
            if (now - metrics.last_auto_chat > 60000) { // Enfriamiento de 60s
                metrics.last_auto_chat = now;
                interventionRef.current("Biometría PDEF reporta: El usuario tiene el ceño fruncido (estrés cognitivo continuado). Usa una frase MUY empática en una sola viñeta y pregúntale si necesita que simplifiques el paso que está haciendo.");
            }
        } 
        else if (distDuration > 1.5) {
            statusMsg = `DESVIACIÓN: TEMPORIZADOR COERCITIVO (${distDuration.toFixed(1)}s)`;
            statusColor = "text-amber-500";
            statusBg = "bg-amber-500/10";
            statusBorder = "border-amber-500/30";
        }
      } else {
          statusMsg = "PDEF INACTIVO: ROSTRO NO DETECTADO";
          statusColor = "text-zinc-600";
          statusBg = "bg-zinc-800/10";
          statusBorder = "border-zinc-800/30";
      }

      // Mapeo transparente derivado de las métricas puras de P.D.E.F. v1.0
      let targetAvatarState: FocusBudState = 'ENFOQUE';
      if (distDuration > 1.5 || metricsRef.current.nivel_clap < 50) {
          targetAvatarState = 'ALERTA_SUAVE';
      } else if (metricsRef.current.nivel_carga > 60 || blinkFreq > 25) {
          targetAvatarState = 'FATIGA';
      } else {
          targetAvatarState = 'ENFOQUE';
      }

      if (avatarState !== targetAvatarState) {
          setAvatarState(targetAvatarState);
      }

      // Direct DOM Update to prevent React Renders
      if (focusRef.current) {
          focusRef.current.style.width = `${metricsRef.current.nivel_clap}%`;
      }
      if (fatigueRef.current) {
          fatigueRef.current.style.width = `${metricsRef.current.nivel_carga}%`;
      }
      if (statusRef.current) {
          statusRef.current.textContent = statusMsg;
          statusRef.current.className = `px-4 py-2 mt-20 left-4 rounded-md border font-mono text-xs tracking-wider absolute ${statusBg} ${statusColor} ${statusBorder} uppercase shadow-2xl backdrop-blur-md z-20`;
      }
      if (biometricError) {
          setBiometricError(null);
      }
    } catch (err: any) {
      console.error("Error en frame de MediaPipe:", err);
      setBiometricError(String(err?.message || err));
    }
  };

  const handleNextStep = () => {
    if (currentStepIdx < steps.length) {
      setCurrentStepIdx(c => c + 1);
      metricsRef.current.nivel_clap = 100; // Dopamine CLAP boost
      metricsRef.current.nivel_carga = Math.max(0, metricsRef.current.nivel_carga - 30); // Less stress
      
      // Activar ventana de Celebración de 3.5s para el robot FocusBud
      celebrationUntilRef.current = Date.now() + 3500;
      triggerStateAlert('CELEBRACION');

      // Trigger Kawaii Reward
      if (currentStepIdx + 1 < steps.length) {
        const randomKao = KAOMOJIS[Math.floor(Math.random() * KAOMOJIS.length)];
        setRewardKaomoji(randomKao);
        setIsShowingReward(true);
        setTimeout(() => setIsShowingReward(false), 2000); // Hide after 2 seconds
      }
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${s}`;
  };

  if (currentScreen === 'MODE_SELECTION' || !isStarted) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center font-sans tracking-tight p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full p-8 rounded-3xl bg-zinc-900 shadow-2xl border border-zinc-800 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                <BrainCircuit className="text-green-500 w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">NeuroSynk v3.4 Web</h1>
                <p className="text-xs text-zinc-400 font-mono">Configura tu Sesión de Enfoque</p>
              </div>
            </div>
            {isStarted && (
              <button
                onClick={() => setCurrentScreen('WORKSPACE')}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono text-zinc-300 transition-colors cursor-pointer"
              >
                Volver al Workspace ➔
              </button>
            )}
          </div>

          <form onSubmit={(e) => handleStart(e)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                ¿En qué vas a trabajar hoy?
              </label>
              <input 
                autoFocus
                type="text"
                className="w-full px-4 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/50 text-white placeholder-zinc-600 font-mono text-sm shadow-inner transition-all"
                placeholder="Ej. Escribir reporte trimestral o estudiar matemáticas..."
                value={task}
                onChange={e => setTask(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-3">
                Selecciona tu Modo de Trabajo:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'DEEP_WORK' as WorkMode,
                    title: '⚡ Deep Work',
                    badge: 'Flujo',
                    desc: 'Foco profundo e intervenciones discretas.'
                  },
                  {
                    id: 'ANTI_PARALYSIS' as WorkMode,
                    title: '🆘 Rescate Anti-Parálisis',
                    badge: 'Paso a Paso',
                    desc: 'Micro-pasos mínimos para vencer la sobrecarga.'
                  },
                  {
                    id: 'BODY_DOUBLING' as WorkMode,
                    title: '🤝 Body Doubling',
                    badge: 'Estándar',
                    desc: 'Acompañamiento continuo y calibración activa.'
                  }
                ].map(mode => {
                  const isSelected = workMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setWorkMode(mode.id)}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-green-500/10 border-green-500/60 shadow-[0_0_20px_rgba(34,197,94,0.15)] ring-1 ring-green-500/30' 
                          : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-950'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-bold ${isSelected ? 'text-green-400' : 'text-white'}`}>
                            {mode.title}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                          {mode.desc}
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-zinc-800/40 flex justify-end">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                          isSelected ? 'bg-green-500/20 text-green-300' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {mode.badge}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-4 bg-green-500 hover:bg-green-400 text-black font-extrabold text-base rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_25px_rgba(34,197,94,0.25)] cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-5 h-5 fill-black" /> Iniciar Sesión ({workMode === 'DEEP_WORK' ? 'Deep Work' : workMode === 'ANTI_PARALYSIS' ? 'Rescate' : 'Body Doubling'})
                </>
              )}
            </button>
            
            <p className="text-[11px] text-center text-zinc-500 font-mono">
              🔒 Biometría 100% local en memoria navegador (MediaPipe CDN).
            </p>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="lg:h-screen lg:overflow-hidden bg-zinc-950 text-zinc-300 font-sans p-4 xl:p-8 flex flex-col lg:flex-row gap-6 items-stretch">
      
      {/* LEFT PANEL: VIDEO, BIOMETRICS & CHAT */}
      <div className="flex-1 w-full max-w-5xl flex flex-col gap-6 min-h-0">
        
        {/* HUD Bars */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest"><Target className="w-4 h-4 text-green-500"/> RENDIMIENTO (C.L.A.P.)</span>
            </div>
            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden shadow-inner flex items-center">
              <div 
                ref={focusRef} 
                className="h-full bg-green-500 w-full rounded-full transition-[width] duration-300 ease-out shadow-[0_0_15px_rgba(34,197,94,0.6)]"
              />
            </div>
          </div>
          
          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest"><Activity className="w-4 h-4 text-red-500"/> SOBRECARGA PDEF</span>
            </div>
            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden shadow-inner flex items-center">
              <div 
                ref={fatigueRef} 
                className="h-full bg-red-500 w-0 rounded-full transition-[width] duration-300 ease-out shadow-[0_0_15px_rgba(239,68,68,0.6)]"
              />
            </div>
          </div>
        </div>

        {/* WORKSPACE: Camera & Quick Chat */}
        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
            {/* Viewport Panorámico FocusBud (Stealth MediaPipe Overlay) */}
            <div className="relative rounded-3xl overflow-hidden bg-black flex-[3] flex flex-col items-center justify-center shadow-2xl border border-zinc-900 min-h-[380px] z-[60]">
                {/* Oculto: video nativo y canvas MediaPipe (100% privacidad local en memoria) */}
                <video ref={videoRef} className="absolute w-0 h-0 opacity-0 pointer-events-none -z-10" autoPlay playsInline muted />
                <canvas ref={canvasRef} width={1280} height={720} className="absolute w-0 h-0 opacity-0 pointer-events-none -z-10" />

                {/* Top Right: Mute / Unmute Audio Toggle Button */}
                <div className="absolute top-4 right-4 z-30 pointer-events-auto flex items-center gap-2">
                    <button
                        onClick={() => {
                            const muted = audioService.toggleMute();
                            setIsMuted(muted);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-md text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-all shadow-xl cursor-pointer pointer-events-auto flex items-center justify-center"
                        title={isMuted ? "Activar audio" : "Silenciar audio"}
                        aria-label={isMuted ? "Activar audio" : "Silenciar audio"}
                    >
                        {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                </div>

                {/* Insignia de Telemetría Biométrica en Vivo (Debug Overlay) */}
                <div className="absolute top-3 left-3 z-30 bg-black/80 border border-zinc-700 p-2.5 rounded-xl text-[10px] font-mono text-zinc-300 pointer-events-none flex flex-col gap-1 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center gap-1.5 font-bold">
                        Estado: <span className={faceDetected ? "text-green-400" : "text-red-400"}>{faceDetected ? "● ROSTRO ACTIVO" : "○ BUSCANDO ROSTRO"}</span>
                    </div>
                    <div className="text-zinc-400">
                        FPS: <span className="text-white font-bold">{fps}</span> | Puntos: <span className="text-white font-bold">{landmarksCount}</span>
                    </div>
                    <div className="text-zinc-400">
                        Score Enfoque: <span className="text-emerald-400 font-bold">{currentScore}%</span>
                    </div>
                    {biometricError && (
                        <div className="text-red-400 font-bold animate-pulse mt-0.5 max-w-[220px] truncate">
                            Err: {biometricError}
                        </div>
                    )}
                </div>

                {/* 1. Bocadillo de Texto Flotante (Arriba de FocusBud) */}
                <div className="absolute top-6 z-20 pointer-events-none">
                    <AvatarMessage message={currentMessage} />
                </div>

                {/* 2. Robot Avatar FocusBud (Centrado) */}
                <div className="w-full h-full flex items-center justify-center">
                    <Avatar state={avatarState} />
                </div>

                <div ref={statusRef} className="absolute top-4 left-4 px-4 py-2 rounded-md border font-mono text-xs tracking-wider bg-zinc-800/80 text-zinc-400 border-zinc-700 uppercase backdrop-blur-md shadow-2xl z-20">
                    INICIANDO SENSORES VIA MEDIAPIPE...
                </div>

                <div className="absolute bottom-4 left-4 flex gap-2 z-20">
                    <span className="px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md font-mono text-[10px] text-zinc-400 flex items-center gap-2 shadow-2xl border border-zinc-800">
                       <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`}/> {isPaused ? 'EN PAUSA' : 'EDGE BIOMETRICS ACTIVA (LOCAL)'}
                    </span>
                </div>

                <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                    <button
                        onClick={handleRecalibrate}
                        disabled={isRecalibrating}
                        className="px-3 py-1.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-md font-mono text-[10px] text-zinc-300 flex items-center gap-1.5 shadow-2xl border border-zinc-700 hover:border-zinc-500 transition-all group disabled:opacity-50"
                        title="Recalibrar cámara y métricas biométricas"
                    >
                        <RotateCcw className={`w-3.5 h-3.5 text-emerald-400 ${isRecalibrating ? 'animate-spin' : 'group-hover:rotate-[-45deg] transition-transform'}`} />
                        <span>{isRecalibrating ? 'RECALIBRANDO...' : 'RECALIBRAR'}</span>
                    </button>
                </div>

                {isPaused && (
                     <div className="absolute inset-0 bg-black/70 backdrop-blur-[4px] z-30 flex items-center justify-center pointer-events-none">
                         <span className="text-3xl font-black tracking-[0.3em] text-blue-400 font-mono drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">PAUSADO</span>
                     </div>
                )}
            </div>

            {/* Quick Info Chat */}
            <div className="rounded-3xl bg-zinc-900 shadow-2xl border border-zinc-800 flex-[2.5] flex flex-col overflow-hidden min-h-[350px]">
                {/* Header */}
                <div className="px-5 py-4 bg-zinc-950/50 border-b border-zinc-800 flex items-center gap-2 shrink-0">
                    <MessageSquare className="w-5 h-5 text-emerald-500" />
                    <span className="font-mono text-sm tracking-widest text-zinc-300 font-semibold uppercase">Chat de Asistencia</span>
                </div>
                {/* Messages view */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar scroll-smooth">
                    {chatMessages.map((msg, i) => (
                        <div key={i} className={`max-w-[90%] rounded-2xl px-5 py-3 text-sm leading-relaxed font-sans ${
                            msg.role === 'user' 
                              ? 'bg-zinc-800 text-white self-end rounded-tr-sm border border-zinc-700' 
                              : 'bg-emerald-500/10 text-emerald-50 self-start rounded-tl-sm border border-emerald-500/20'
                        }`}>
                            {msg.content}
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="bg-emerald-500/10 text-emerald-500 self-start rounded-tl-sm rounded-2xl px-5 py-3 border border-emerald-500/20 flex gap-2 items-center">
                           <span className="animate-pulse text-xs">●</span><span className="animate-pulse delay-75 text-xs">●</span><span className="animate-pulse delay-150 text-xs">●</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                {/* Input form */}
                <form onSubmit={handleSendChat} className="p-4 bg-zinc-950/30 border-t border-zinc-800 shrink-0">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            placeholder="Pregunta sin perder el foco..."
                            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white placeholder-zinc-600 font-mono transition-shadow min-w-0"
                        />
                        <button type="submit" disabled={isChatLoading || !chatInput.trim()} className="bg-emerald-500 text-black px-4 rounded-xl flex items-center justify-center hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 transition-colors shrink-0">
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>

      {/* RIGHT PANEL: IA MENTOR DASHBOARD */}
      <div className="w-full lg:w-[450px] shrink-0 flex flex-col gap-6 lg:h-full min-h-0">
        
        <div className="bg-zinc-900 rounded-3xl flex-1 flex flex-col overflow-hidden shadow-2xl border border-zinc-900 min-h-[500px] relative">
            
            {/* MASSIVE REWARD OVERLAY */}
            <AnimatePresence>
                {isShowingReward && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.3, y: 100 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 1.5, filter: "blur(15px)" }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none backdrop-blur-sm bg-black/40"
                    >
                        <div className="bg-zinc-950 border-2 border-green-500 px-8 py-6 rounded-[3rem] shadow-[0_0_100px_rgba(34,197,94,0.6)] flex items-center justify-center transform -rotate-3">
                            <span className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-200 drop-shadow-[0_0_30px_rgba(52,211,153,0.8)] whitespace-nowrap">
                                {rewardKaomoji}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="p-6 pb-4 bg-zinc-900 flex justify-between items-start z-10 shadow-sm shadow-black/20">
                <div className="flex flex-col gap-1">
                  <h2 className="text-white text-xl tracking-tight font-medium flex items-center gap-2">
                    <BrainCircuit className="text-green-500 w-6 h-6"/> Mentor IA
                  </h2>
                  <p className="text-sm font-mono text-zinc-500 truncate mt-1">OBJ: {task}</p>
                </div>
                {/* Mode Switch, Timer & Pause Controls */}
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => setCurrentScreen('MODE_SELECTION')}
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition-colors shadow-lg cursor-pointer"
                        title="⚙️ Cambiar Modo de Trabajo"
                    >
                        <Settings className="w-4 h-4 text-green-400" />
                        <span className="hidden sm:inline">Modo</span>
                    </button>
                    <button 
                        onClick={() => setIsPaused(!isPaused)}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl shadow-lg border transition-colors ${
                            isPaused ? 'bg-blue-500 border-blue-400 text-black' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                        }`}
                        title="Pausar / Reanudar (Tecla Q)"
                    >
                        {isPaused ? <Play className="w-4 h-4 fill-current"/> : <Pause className="w-4 h-4 fill-current"/>}
                    </button>
                    <div className={`flex items-center gap-2 px-3 py-2 bg-black border rounded-xl transition-all ${
                        isPaused ? 'border-zinc-800 opacity-50' : 'border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                    }`}>
                       <Timer className={`w-4 h-4 ${isPaused ? 'text-zinc-600' : 'text-green-500 animate-pulse'}`} />
                       <span className={`font-mono text-lg tracking-[0.15em] font-bold ${
                           isPaused ? 'text-zinc-600' : 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                       }`}>
                           {formatTime(elapsedTime)}
                       </span>
                    </div>
                </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between">
                {currentStepIdx < steps.length ? (
                    <>
                        <div className="space-y-6">
                            {/* Subtle Session Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs font-mono text-zinc-400">
                                    <span className="font-semibold text-green-400">Paso {currentStepIdx + 1} de {steps.length}</span>
                                    <span>{steps.length > 0 ? Math.min(100, Math.round((currentStepIdx / steps.length) * 100)) : 0}% completado</span>
                                </div>
                                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                                    <div 
                                        className="bg-gradient-to-r from-green-500 to-emerald-400 h-full transition-all duration-500 ease-out"
                                        style={{ width: `${steps.length > 0 ? Math.min(100, Math.round((currentStepIdx / steps.length) * 100)) : 0}%` }}
                                    />
                                </div>
                            </div>

                            {/* Active Step Card */}
                            <AnimatePresence mode="wait">
                                <motion.div 
                                    key={currentStepIdx}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.3 }}
                                    className="p-6 rounded-3xl bg-zinc-900/90 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)] space-y-4"
                                >
                                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-green-400">
                                        <ArrowRight className="w-4 h-4 text-green-400 animate-pulse" />
                                        <span>Paso Activo</span>
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-bold text-zinc-100 leading-relaxed tracking-tight">
                                        {steps[currentStepIdx]}
                                    </h3>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Primary Action Button: YA LO HICE ✅ */}
                        <div className="pt-6">
                            <button 
                                onClick={handleNextStep}
                                className="w-full py-5 bg-green-500 hover:bg-green-400 text-black font-black text-lg rounded-2xl transition-all flex items-center justify-center gap-2 relative group overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.25)] active:scale-[0.98]"
                            >
                                {isShowingReward ? (
                                    <span className="text-xl animate-bounce">{rewardKaomoji || "¡VAMOS!"}</span>
                                ) : (
                                    <span>YA LO HICE ✅</span>
                                )}
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                            </button>
                            <p className="text-[10px] uppercase tracking-wider font-mono text-center text-zinc-500 mt-4">
                                Pulsa para avanzar y liberar dopamina
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="my-auto">
                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-6">
                            <div className="bg-green-500 h-full w-full" />
                        </div>

                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                            animate={{ 
                                opacity: 1, 
                                scale: 1, 
                                rotate: 0,
                                backgroundColor: ["#ffffff", "#dcfce7", "#ffffff"]
                            }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="p-6 rounded-2xl bg-white text-black text-center flex flex-col items-center gap-3 shadow-[0_0_40px_rgba(34,197,94,0.2)] relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-green-500/5 pointer-events-none" />
                            <Target className="w-16 h-16 text-green-500 mb-2 animate-bounce" />
                            <h3 className="font-black text-2xl tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-400">
                                (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧<br/>¡Misión Cumplida!
                            </h3>
                            <p className="text-sm opacity-80 leading-relaxed font-mono mt-2 mb-4 font-semibold text-zinc-700">Completado en {formatTime(elapsedTime)}</p>
                            <button 
                                onClick={() => window.location.reload()}
                                className="w-full py-4 bg-black text-white rounded-2xl text-base font-bold hover:bg-zinc-800 transition-colors uppercase tracking-widest"
                            >
                                Iniciar Nueva Misión
                            </button>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
