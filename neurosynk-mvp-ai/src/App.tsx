import React, { useEffect, useRef, useState } from 'react';
import { Activity, BrainCircuit, CheckCircle, Target, ArrowRight, Play, Pause, Eye, Timer, MessageSquare, Send, Settings, Sparkles, Cpu, ShieldCheck, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadNeuroSynkBrain, evaluateAIBiometrics, AIPredictionResult, episodicMemory } from './services/aiInference';
import { aiClient } from './api/aiClient';
import { AIInferenceResponse } from './types/aiContracts';
import { sessionTelemetry } from './services/sessionTelemetry';
import { TelemetryDrawer } from './components/TelemetryDrawer';

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

interface NeuroMascotProps {
  expression?: 'normal' | 'blink' | 'happy';
  size?: number;
}

function NeuroMascot({ expression = 'normal', size = 120 }: NeuroMascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="drop-shadow-[0_0_25px_rgba(34,197,94,0.5)] transition-all duration-300"
    >
      {/* Cuerpo circular negro con contorno verde neón */}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="#09090b"
        stroke="#22c55e"
        strokeWidth="4"
      />

      {/* Ojos expresivos minimalistas */}
      <g>
        {expression === 'normal' && (
          <>
            {/* Ojo izquierdo */}
            <motion.ellipse
              cx="36"
              cy="48"
              rx="5"
              ry="9"
              fill="white"
              initial={{ scaleY: 1 }}
              animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
              transition={{ repeat: Infinity, duration: 3, repeatDelay: 1.5 }}
            />
            {/* Ojo derecho */}
            <motion.ellipse
              cx="64"
              cy="48"
              rx="5"
              ry="9"
              fill="white"
              initial={{ scaleY: 1 }}
              animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
              transition={{ repeat: Infinity, duration: 3, repeatDelay: 1.5 }}
            />
          </>
        )}
        {expression === 'blink' && (
          <>
            <path
              d="M 31,48 L 41,48"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 59,48 L 69,48"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </>
        )}
        {expression === 'happy' && (
          <>
            <path
              d="M 31,51 Q 36,43 41,51"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <path
              d="M 59,51 Q 64,43 69,51"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </>
        )}
      </g>
    </svg>
  );
}

export default function App() {
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  const [isAppLoading, setIsAppLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mascotExpression, setMascotExpression] = useState<'normal' | 'blink' | 'happy'>('normal');
  const [proposedChange, setProposedChange] = useState<{ proposedTask: string; proposedSteps: string[] } | null>(null);

  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<'browser' | 'server' | 'none'>('none');

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch('/api/api-status');
        const data = await response.json();
        if (localStorage.getItem('gemini_api_key')) {
          setApiStatus('browser');
        } else if (data.hasServerKey) {
          setApiStatus('server');
        } else {
          setApiStatus('none');
        }
      } catch (e) {
        console.error("Error checking API status:", e);
      }
    };
    checkApiStatus();
  }, [geminiApiKey]);

  useEffect(() => {
    if (!isAppLoading) return;
    const duration = 2500;
    const intervalTime = 25;
    const step = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setLoadingProgress(prev => {
        const next = prev + step;
        if (next >= 100) {
          clearInterval(timer);
          setMascotExpression('happy');
          setTimeout(() => {
            setIsAppLoading(false);
          }, 600);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isAppLoading]);

  // Chat States
  const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([
    { role: 'assistant', content: '¿Duda rápida? Pregunta y no pierdas el flujo.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // NÚCLEO PDEF v1.0 State
  const metricsRef = useRef({
    blinks: [] as number[],
    is_blinking: false,
    gaze_history: [] as { x: number, y: number, t: number }[],
    distraction_start: null as number | null,
    stress_events: [] as { timestamp: number, weight: number, reason: string }[],
    frown_accumulated_ms: 0,
    hands_accumulated_ms: 0,
    last_frame_time: 0,
    last_blink_penalty: 0,
    last_auto_chat: 0,
    calibration_start: null as number | null,

    calib_frames: 0,
    calib_ear_sum: 0,
    calib_frown_sum: 0,
    calib_yaw_sum: 0,
    calib_pitch_sum: 0,
    baseline_ear: 0.2,
    baseline_frown: 0.22,
    baseline_yaw: 0.5,
    baseline_pitch: 0.5,

    // Subdivisión de tareas
    subdivided_indexes: [] as number[],
    is_subdividing: false,

    // UI mapped properties
    nivel_clap: 100.0,
    nivel_carga: 0.0,
  });

  // Estado del Motor de Red Neuronal TensorFlow.js
  const [isAIBrainReady, setIsAIBrainReady] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<AIPredictionResult | null>(null);
  const windowFramesRef = useRef<{ ear: number; yaw: number; pitch: number; frown: number; noseDelta: number; gazeVar: number; shoulder: number; mar: number; roll: number; t: number }[]>([]);
  const lastNoseRef = useRef<{ x: number; y: number } | null>(null);

  // Estado del Microservicio Python FastAPI (Arquitectura de Microservicios)
  const [pythonAiResult, setPythonAiResult] = useState<AIInferenceResponse | null>(null);
  const [isPythonCoreOnline, setIsPythonCoreOnline] = useState<boolean | null>(null);
  const [microserviceLatency, setMicroserviceLatency] = useState<number>(0);
  const isEvaluatingMicroserviceRef = useRef<boolean>(false);

  // Verificación periódica del Microservicio Python FastAPI
  useEffect(() => {
    const checkPythonServer = async () => {
      const healthy = await aiClient.checkHealth();
      setIsPythonCoreOnline(healthy !== null);
    };
    checkPythonServer();
    const interval = setInterval(checkPythonServer, 10000);
    return () => clearInterval(interval);
  }, []);

  // Carga inicial del cerebro IA local
  useEffect(() => {
    loadNeuroSynkBrain().then(res => {
      setIsAIBrainReady(res.isReady);
    });
  }, []);

  const [appStage, setAppStage] = useState<'LOGIN' | 'BRIEFING' | 'FOCUS'>('LOGIN');
  const [isTelemetryOpen, setIsTelemetryOpen] = useState<boolean>(false);
  const [briefingMsgs, setBriefingMsgs] = useState<{ role: string, content: string }[]>([]);
  const [briefingInput, setBriefingInput] = useState('');

  const [workMode, setWorkMode] = useState<'pantalla' | 'lectura' | 'flexible'>('pantalla');
  const workModeRef = useRef<'pantalla' | 'lectura' | 'flexible'>('pantalla');
  const [sensitivity, setSensitivity] = useState<'estricto' | 'normal' | 'relajado'>('normal');
  const sensitivityRef = useRef<'estricto' | 'normal' | 'relajado'>('normal');

  useEffect(() => {
    workModeRef.current = workMode;
  }, [workMode]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const rewardTimeoutRef = useRef<number | null>(null);

  // Sync ref for MediaPipe callback
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const currentStepIdxRef = useRef(0);
  useEffect(() => {
    currentStepIdxRef.current = currentStepIdx;
  }, [currentStepIdx]);

  const subdivideCurrentStepRef = useRef<(stepIdx: number) => Promise<void>>(async () => { });
  useEffect(() => {
    subdivideCurrentStepRef.current = async (stepIdx: number) => {
      const metrics = metricsRef.current;
      if (metrics.is_subdividing || metrics.subdivided_indexes.includes(stepIdx)) return;

      metrics.is_subdividing = true;
      metrics.subdivided_indexes.push(stepIdx);

      const parentStepText = steps[stepIdx];
      if (!parentStepText) {
        metrics.is_subdividing = false;
        return;
      }

      // Evitar subdividir un sub-paso ya existente (ej. "3.1") para no saturar la lista
      const isAlreadySubStep = /\b\d+\.\d+\b/.test(parentStepText);
      if (isAlreadySubStep) {
        metrics.is_subdividing = false;
        return;
      }

      sessionTelemetry.logEvent(`[SUBDIVISIÓN DISPARADA]: El paso #${stepIdx + 1} "${parentStepText}" se desglosó por detección de sobrecarga.`);

      setIsChatLoading(true);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚙️ Analizando dificultad del paso actual... Vamos a desglosar "${parentStepText}" en metas más pequeñas.`
      }]);

      try {
        const response = await fetch('/api/subdivide-step', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-api-key': geminiApiKey || ''
          },
          body: JSON.stringify({
            parentStep: parentStepText,
            taskContext: task,
            stepNumber: stepIdx + 1
          })
        });
        const data = await response.json();

        if (data.subSteps && Array.isArray(data.subSteps)) {
          setSteps(prevSteps => {
            const nextSteps = [...prevSteps];
            nextSteps.splice(stepIdx, 1, ...data.subSteps);
            return nextSteps;
          });

          metrics.nivel_clap = Math.min(100, metrics.nivel_clap + 30);

          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: `💡 ¡Listo! He subdividido el paso en 3 metas más sencillas:
${data.subSteps.map((s: string) => `• ${s}`).join('\n')}

Concentrémonos en el primer sub-paso. ¡Tú puedes!`
          }]);
        } else {
          throw new Error("Respuesta no válida");
        }
      } catch (err) {
        console.error("Error subdividing step:", err);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠️ No pude desglosar el paso automáticamente, pero recuerda que puedes tomar un breve respiro si lo necesitas.`
        }]);
      } finally {
        setIsChatLoading(false);
        metrics.is_subdividing = false;
      }
    };
  }, [steps, task, isChatLoading]);

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

  // Cleanup reward timeout on unmount
  useEffect(() => {
    return () => {
      if (rewardTimeoutRef.current) {
        clearTimeout(rewardTimeoutRef.current);
      }
    };
  }, []);

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
      const memorySummary = episodicMemory.getSummary();
      const sysMsg = {
        role: 'system',
        content: `Contexto de Inteligencia Artificial de la sesión: El usuario está trabajando en "${task}". Paso actual: "${steps[currentStepIdx] || 'General'}". ${memorySummary.narrativeSummary}. Responde de forma breve, empática y orientada a la acción basada en su estado real de concentración.`
      };
      const currentMsgs = [...chatMessages, { role: 'user', content: userMsg }];
      const payloadMsgs = [sysMsg, ...currentMsgs.map(m => ({ role: m.role, content: m.content }))];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiApiKey || ''
        },
        body: JSON.stringify({ messages: payloadMsgs })
      });
      const data = await response.json();

      const replyText = typeof data.reply === 'string' ? data.reply : "⚠️ Error de decodificación neuronal.";

      setChatMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
      if (data.proposal) {
        setProposedChange(data.proposal);
      }
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

  // HUD Stat Refs and variables
  const focusRef = useRef<HTMLDivElement>(null);
  const fatigueRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);



  // Automated System Intervention (Stress trigger to AI)
  const interventionRef = useRef((info: string) => { });
  useEffect(() => {
    interventionRef.current = async (info: string) => {
      if (isChatLoading) return;
      setIsChatLoading(true);
      try {
        const sysMsg = { role: 'system', content: info };
        const currentMsgs = chatMessages.map(m => ({ role: m.role, content: m.content }));
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-gemini-api-key': geminiApiKey || ''
          },
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
  }, [chatMessages, isChatLoading, geminiApiKey]);

  const isSystemBooted = useRef(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTask = task.trim() ? task : 'Estudiar material general';
    setTask(finalTask);

    setBriefingMsgs([
      { role: 'assistant', content: `Excelente, vamos a "${finalTask}" en modo ${workMode.toUpperCase()}. Para generar pasos útiles, cuéntame más: ¿Tienes un límite de tiempo? ¿Es para la escuela, proyecto o personal?` }
    ]);
    setAppStage('BRIEFING');
  };

  const handleBriefingSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefingInput.trim() || isLoading) return;
    const userMsg = briefingInput.trim();
    setBriefingInput('');
    setBriefingMsgs(prev => [...prev, { role: 'user', content: userMsg }]);

    setIsLoading(true);
    try {
      const currentMsgs = briefingMsgs.map(m => ({ role: m.role, content: m.content }));
      const sysMsg = { role: 'system', content: `El usuario está en una entrevista de briefing para configurar sus tareas. Tarea actual: "${task}". Modo: ${workMode}. Hazle otra pregunta breve si necesitas más contexto para crear micro-pasos, o dale ánimos si ya tienes lo necesario.` };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiApiKey || ''
        },
        body: JSON.stringify({ messages: [sysMsg, ...currentMsgs, { role: 'user', content: userMsg }] })
      });
      const data = await response.json();
      setBriefingMsgs(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error("Briefing chat error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartFocus = async () => {
    setIsLoading(true);
    const contextStr = briefingMsgs.map(m => `${m.role === 'user' ? 'Usuario' : 'IA'}: ${m.content}`).join('\n');

    try {
      const response = await fetch('/api/split-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiApiKey || ''
        },
        body: JSON.stringify({ task, context: contextStr }),
      });
      const data = await response.json();

      if (data.steps && Array.isArray(data.steps)) {
        const cleanSteps = data.steps.map((s: string) => s.replace(/(Paso \d+:)/i, '').trim());
        setSteps(cleanSteps);
      } else {
        throw new Error("Formato de respuesta incorrecto");
      }
    } catch (err) {
      setSteps(['Preparar material', 'Iniciar primera fase', 'Revisar progreso', 'Finalizar']);
    } finally {
      setIsLoading(false);
      setIsStarted(true);
      setAppStage('FOCUS');
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
    const canvasCtx = canvasRef.current?.getContext('2d');
    if (!canvasCtx || !canvasRef.current || !videoRef.current) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, width, height);

    // Flip horizonally to mirror
    canvasCtx.translate(width, 0);
    canvasCtx.scale(-1, 1);

    // Draw Video feed onto canvas
    canvasCtx.drawImage(results.image, 0, 0, width, height);

    // MediaPipe overlays (Safe Drawing Guards)
    const drawConn = window.drawConnectors;
    const drawLnd = window.drawLandmarks;
    if (results.faceLandmarks && typeof drawConn === 'function') {
      if (window.FACEMESH_RIGHT_EYEBROW) drawConn(canvasCtx, results.faceLandmarks, window.FACEMESH_RIGHT_EYEBROW, { color: '#FF3030', lineWidth: 1.5 });
      if (window.FACEMESH_RIGHT_EYE) drawConn(canvasCtx, results.faceLandmarks, window.FACEMESH_RIGHT_EYE, { color: '#FF3030', lineWidth: 1.5 });
      if (window.FACEMESH_LEFT_EYEBROW) drawConn(canvasCtx, results.faceLandmarks, window.FACEMESH_LEFT_EYEBROW, { color: '#30FF30', lineWidth: 1.5 });
      if (window.FACEMESH_LEFT_EYE) drawConn(canvasCtx, results.faceLandmarks, window.FACEMESH_LEFT_EYE, { color: '#30FF30', lineWidth: 1.5 });
      if (window.FACEMESH_FACE_OVAL) drawConn(canvasCtx, results.faceLandmarks, window.FACEMESH_FACE_OVAL, { color: '#E0E0E0', lineWidth: 1.5 });
      if (window.FACEMESH_LIPS) drawConn(canvasCtx, results.faceLandmarks, window.FACEMESH_LIPS, { color: '#E0E0E0', lineWidth: 1.5 });
      if (window.FACEMESH_TESSELATION) drawConn(canvasCtx, results.faceLandmarks, window.FACEMESH_TESSELATION, { color: '#10B98133', lineWidth: 0.6 });
    }
    if (results.poseLandmarks && typeof drawConn === 'function' && window.POSE_CONNECTIONS) {
      drawConn(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#E0E0E0', lineWidth: 1.8 });
      if (typeof drawLnd === 'function') {
        drawLnd(canvasCtx, results.poseLandmarks, { color: '#00FFFF', lineWidth: 1, radius: 2.0 });
      }
    }


    canvasCtx.restore();

    if (isPausedRef.current) {
      if (statusRef.current) {
        statusRef.current.textContent = "SISTEMA PAUSADO (PULSA 'Q')";
        statusRef.current.className = `px-4 py-2 mt-4 rounded-md border font-mono text-xs tracking-wider absolute top-4 left-4 bg-blue-500/10 text-blue-400 border-blue-500/30 uppercase shadow-2xl backdrop-blur-md`;
      }
      return;
    }

    // ===========================================
    // NÚCLEO BIOMÉTRICO P.D.E.F. v1.0
    // ===========================================
    let statusMsg = "EN ESTADO DE FLUJO (FIJACIÓN ACTIVA)";
    let statusColor = "text-green-500";
    let statusBg = "bg-green-500/10";
    let statusBorder = "border-green-500/30";

    const faces = results.faceLandmarks;
    if (faces) {
      const now = Date.now();
      const metrics = metricsRef.current;

      // Fase de Calibración (15 segundos)
      if (!metrics.calibration_start) {
        metrics.calibration_start = now;
        metrics.calib_frames = 0;
        metrics.calib_ear_sum = 0;
        metrics.calib_frown_sum = 0;
        metrics.calib_yaw_sum = 0;
        metrics.calib_pitch_sum = 0;
        metrics.stress_events = [];
      }
      const isCalibrating = (now - metrics.calibration_start) < 15000;

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

      const eyeHeight = Math.hypot(upperEye.x - lowerEye.x, upperEye.y - lowerEye.y);
      const eyeWidth = Math.hypot(outerEye.x - innerEye.x, outerEye.y - innerEye.y);
      const EAR = eyeHeight / eyeWidth;

      const dx = faces[263].x - faces[33].x;
      const dy = mouth.y - ((faces[263].y + faces[33].y) / 2);
      const yawRatio = dx !== 0 ? (nose.x - faces[33].x) / dx : 0.5;
      const pitchRatio = dy !== 0 ? (nose.y - ((faces[263].y + faces[33].y) / 2)) / dy : 0.5;

      const faceWidth = Math.hypot(faces[234].x - faces[454].x, faces[234].y - faces[454].y);
      const eyebrowDist = faceWidth !== 0 ? Math.hypot(cejaI.x - cejaD.x, cejaI.y - cejaD.y) / faceWidth : 0.22;

      const midX = (pI.x + pD.x) / 2;
      const midY = (pI.y + pD.y) / 2;
      metrics.gaze_history.push({ x: midX, y: midY, t: now });
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

      // --- EXTRACCIÓN CINEMÁTICA (Pose de Agobio / Tensión) ---
      const pose = results.poseLandmarks;
      let distressPosture = false;
      let postureDetail = "";
      let leftShoulderTorsoAngle = 0;
      let rightShoulderTorsoAngle = 0;
      let leftArmShoulderAngle = 0;
      let rightArmShoulderAngle = 0;

      // Helper to calculate 2D angle between 3 points
      const getAngle = (
        p1: { x: number; y: number },
        p2: { x: number; y: number },
        p3: { x: number; y: number }
      ) => {
        const rad = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
        let deg = Math.abs((rad * 180) / Math.PI);
        if (deg > 180) deg = 360 - deg;
        return deg;
      };

      if (pose && pose[11] && pose[12] && pose[13] && pose[14] && pose[15] && pose[16]) {
        const leftShoulder = pose[11];
        const rightShoulder = pose[12];
        const leftElbow = pose[13];
        const rightElbow = pose[14];
        const leftWrist = pose[15];
        const rightWrist = pose[16];
        const leftHip = pose[23] || { x: leftShoulder.x, y: leftShoulder.y + 0.5 };
        const rightHip = pose[24] || { x: rightShoulder.x, y: rightShoulder.y + 0.5 };

        // 1. Ángulo en el codo (brazo estirado)
        const leftElbowAngle = getAngle(leftShoulder, leftElbow, leftWrist);
        const rightElbowAngle = getAngle(rightShoulder, rightElbow, rightWrist);

        // 2. Ángulo en el hombro con respecto al torso (línea recta / 180 grados con el cuerpo hacia arriba)
        leftShoulderTorsoAngle = getAngle(leftElbow, leftShoulder, leftHip);
        rightShoulderTorsoAngle = getAngle(rightElbow, rightShoulder, rightHip);
        const isLeftArmRaisedUp = leftShoulderTorsoAngle > 135;
        const isRightArmRaisedUp = rightShoulderTorsoAngle > 135;

        // 3. Ángulo del brazo con respecto al hombro opuesto (brazo horizontal o extendido hacia fuera)
        leftArmShoulderAngle = getAngle(leftElbow, leftShoulder, rightShoulder);
        rightArmShoulderAngle = getAngle(rightElbow, rightShoulder, leftShoulder);
        const isLeftArmHorizontal = Math.abs(leftArmShoulderAngle - 180) < 35;
        const isRightArmHorizontal = Math.abs(rightArmShoulderAngle - 180) < 35;

        // 4. Manos (muñecas) por encima del torso o de los hombros
        const isLeftHandAboveTorso = leftWrist.y < leftShoulder.y - 0.05;
        const isRightHandAboveTorso = rightWrist.y < rightShoulder.y - 0.05;

        // Condición combinada de agobio/tensión
        if (isLeftArmRaisedUp || isRightArmRaisedUp) {
          distressPosture = true;
          postureDetail = `Brazos arriba (Izq: ${leftShoulderTorsoAngle.toFixed(0)}°, Der: ${rightShoulderTorsoAngle.toFixed(0)}°)`;
        } else if (isLeftArmHorizontal || isRightArmHorizontal) {
          distressPosture = true;
          postureDetail = `Brazos rectos (Izq: ${leftArmShoulderAngle.toFixed(0)}°, Der: ${rightArmShoulderAngle.toFixed(0)}°)`;
        } else if (isLeftHandAboveTorso || isRightHandAboveTorso) {
          distressPosture = true;
          postureDetail = "Manos altas";
        }
      }

      // Calcular delta de tiempo real entre frames
      const delta = Math.min(1000, metrics.last_frame_time > 0 ? (now - metrics.last_frame_time) : 33);
      metrics.last_frame_time = now;

        // 1. Cálculo de Desplazamiento Nasal (Inquietud física)
        let noseDelta = 0;
        if (lastNoseRef.current) {
          noseDelta = Math.hypot(nose.x - lastNoseRef.current.x, nose.y - lastNoseRef.current.y);
        }
        lastNoseRef.current = { x: nose.x, y: nose.y };

        // 2. Ángulo de hombros / Postura
        let shoulderAngle = 105;
        if (pose && pose[11] && pose[12] && pose[13]) {
          const rad = Math.atan2(pose[13].y - pose[11].y, pose[13].x - pose[11].x) - Math.atan2(pose[12].y - pose[11].y, pose[12].x - pose[11].x);
          shoulderAngle = Math.abs((rad * 180) / Math.PI);
        }

        // 3. MAR (Mouth Aspect Ratio) — Detección de bostezos y fatiga extrema
        const mouthTop = faces[13];
        const mouthBottom = faces[14];
        const mouthLeft = faces[61];
        const mouthRight = faces[291];
        const mouthHeight = mouthTop && mouthBottom
          ? Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y)
          : 0;
        const mouthWidth = mouthLeft && mouthRight
          ? Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y)
          : 0.1;
        const MAR = mouthHeight / Math.max(0.001, mouthWidth);

        // 4. Roll (Inclinación Lateral de Cabeza) — Detecta apoyo en manos y fatiga postural
        const rollRad = Math.atan2(faces[263].y - faces[33].y, faces[263].x - faces[33].x);
        const rollAngle = rollRad * (180 / Math.PI);

        // 5. Buffer rodante de 2 segundos para la Red Neuronal de TensorFlow.js
        windowFramesRef.current.push({
          ear: EAR,
          yaw: yawRatio,
          pitch: pitchRatio,
          frown: eyebrowDist,
          noseDelta: noseDelta,
          gazeVar: variance,
          shoulder: shoulderAngle,
          mar: MAR,
          roll: rollAngle,
          t: now
        });
        windowFramesRef.current = windowFramesRef.current.filter(f => now - f.t <= 2000);

        const wFrames = windowFramesRef.current;
        const wCount = Math.max(1, wFrames.length);

        const ears = wFrames.map(f => f.ear);
        const yaws = wFrames.map(f => f.yaw);
        const pitches = wFrames.map(f => f.pitch);
        const frowns = wFrames.map(f => f.frown);
        const gazes = wFrames.map(f => f.gazeVar);
        const shoulders = wFrames.map(f => f.shoulder);
        const mars = wFrames.map(f => f.mar ?? 0.05);
        const rolls = wFrames.map(f => f.roll ?? 0.0);

        const earMean = ears.reduce((a, b) => a + b, 0) / wCount;
        const earMin = Math.min(...ears);
        const yawMean = yaws.reduce((a, b) => a + b, 0) / wCount;
        const yawStd = Math.sqrt(yaws.reduce((sq, n) => sq + Math.pow(n - yawMean, 2), 0) / wCount);
        const pitchMean = pitches.reduce((a, b) => a + b, 0) / wCount;
        const pitchStd = Math.sqrt(pitches.reduce((sq, n) => sq + Math.pow(n - pitchMean, 2), 0) / wCount);
        const frownMean = frowns.reduce((a, b) => a + b, 0) / wCount;
        const noseDeltaSum = wFrames.reduce((a, b) => a + b.noseDelta, 0);
        const gazeVarMean = gazes.reduce((a, b) => a + b, 0) / wCount;
        const shoulderMean = shoulders.reduce((a, b) => a + b, 0) / wCount;
        const marMean = mars.reduce((a, b) => a + b, 0) / wCount;
        const rollMean = rolls.reduce((a, b) => a + b, 0) / wCount;

        // 4. INFERENCIA CON LA RED NEURONAL ENTRENADA EN TENSORFLOW.JS (<2ms)
        const aiResult = evaluateAIBiometrics({
          ear_mean: earMean,
          ear_min: earMin,
          yaw_mean: yawMean,
          yaw_std: yawStd,
          pitch_mean: pitchMean,
          pitch_std: pitchStd,
          frown_mean: frownMean,
          nose_delta_sum: noseDeltaSum,
          gaze_variance_mean: gazeVarMean,
          shoulder_angle_mean: shoulderMean,
          mar_mean: marMean,
          roll_angle_mean: rollMean
        });

        setAiPrediction(aiResult);

        // 4.1 INFERENCIA ASÍNCRONA HACIA EL MICROSERVICIO PYTHON FASTAPI (DESACOPLADO)
        if (!isEvaluatingMicroserviceRef.current && wFrames.length >= 6) {
          isEvaluatingMicroserviceRef.current = true;
          const startT = performance.now();
          aiClient.evaluateBiometrics({
            ear_mean: Number(earMean.toFixed(4)),
            ear_min: Number(earMin.toFixed(4)),
            yaw_mean: Number(yawMean.toFixed(4)),
            yaw_std: Number(yawStd.toFixed(4)),
            pitch_mean: Number(pitchMean.toFixed(4)),
            pitch_std: Number(pitchStd.toFixed(4)),
            frown_mean: Number(frownMean.toFixed(4)),
            nose_delta_sum: Number(noseDeltaSum.toFixed(4)),
            gaze_variance_mean: Number(gazeVarMean.toFixed(6)),
            shoulder_angle_mean: Number(shoulderMean.toFixed(2)),
            mar_mean: Number(marMean.toFixed(4)),
            roll_angle_mean: Number(rollMean.toFixed(2))
          }).then(pythonRes => {
            const elapsed = Math.round(performance.now() - startT);
            setMicroserviceLatency(elapsed);
            setPythonAiResult(pythonRes);
          }).catch(err => {
            console.debug("FastAPI core async poll:", err);
          }).finally(() => {
            setTimeout(() => {
              isEvaluatingMicroserviceRef.current = false;
            }, 1800);
          });
        }

        // Control Directo del Agente Autónomo sobre las Métricas de Enfoque y Carga
        const pEnfoque = aiResult.probabilities[0] || 0;
        const pDistr = aiResult.probabilities[1] || 0;
        const pFatiga = aiResult.probabilities[2] || 0;
        const pSobre = aiResult.probabilities[3] || 0;
        const pAgobio = aiResult.probabilities[4] || 0;

        // Barra Verde (C.L.A.P. Focus Score) y Barra Roja (Carga Cognitiva) con Suavizado Exponencial Orgánico:
        const targetFocus = aiResult.focusScore;
        const targetLoad = aiResult.stressLevel;

        metrics.nivel_clap = Math.max(5, Math.min(100, metrics.nivel_clap * 0.88 + targetFocus * 0.12));
        metrics.nivel_carga = Math.max(0, Math.min(100, metrics.nivel_carga * 0.88 + targetLoad * 0.12));

        if (aiResult.classIndex === 0) {
          setMascotExpression('happy');
        } else if (aiResult.classIndex === 2 || aiResult.classIndex === 4) {
          setMascotExpression('blink');
        } else {
          setMascotExpression('normal');
        }

        // Registrar Telemetría Continua para Diagnóstico en Vivo (Caja Negra)
        sessionTelemetry.recordFrame(
          {
            ear_mean: Number(earMean.toFixed(4)),
            ear_min: Number(earMin.toFixed(4)),
            yaw_mean: Number(yawMean.toFixed(4)),
            yaw_std: Number(yawStd.toFixed(4)),
            pitch_mean: Number(pitchMean.toFixed(4)),
            pitch_std: Number(pitchStd.toFixed(4)),
            frown_mean: Number(frownMean.toFixed(4)),
            nose_delta_sum: Number(noseDeltaSum.toFixed(4)),
            gaze_variance_mean: Number(gazeVarMean.toFixed(6)),
            shoulder_angle_mean: Number(shoulderMean.toFixed(2)),
            mar_mean: Number(marMean.toFixed(4)),
            roll_angle_mean: Number(rollMean.toFixed(2))
          },
          pythonAiResult || {
            class_index: aiResult.classIndex,
            class_name: aiResult.className,
            confidence: aiResult.confidence,
            probabilities: aiResult.probabilities,
            focus_score: aiResult.focusScore,
            stress_level: aiResult.stressLevel,
            status_message: aiResult.statusMessage
          },
          metrics.nivel_clap,
          metrics.nivel_carga,
          steps[currentStepIdxRef.current] || 'General',
          currentStepIdxRef.current
        );

        // Subdivisión autónoma de tarea si la Red Neuronal detecta que el enfoque cayó bajo 45%
        if (metrics.nivel_clap < 45 && !metrics.is_subdividing && !metrics.subdivided_indexes.includes(currentStepIdxRef.current)) {
          subdivideCurrentStepRef.current(currentStepIdxRef.current);
        }

        // Intervención proactiva del Agente / Mentor IA cuando la Red Neuronal detecta sobrecarga continua
        if ((pAgobio > 0.65 || pFatiga > 0.65 || metrics.nivel_carga > 75) && (now - metrics.last_auto_chat > 45000)) {
          metrics.last_auto_chat = now;
          const symptom = pAgobio > 0.65 
            ? `Postura en tensión física y agobio (${(pAgobio * 100).toFixed(0)}%)` 
            : `Fatiga ocular y somnolencia (${(pFatiga * 100).toFixed(0)}%)`;
          
          interventionRef.current(`[Agente Autónomo NeuroSynk]: La red neuronal detectó ${aiResult.className} con ${(aiResult.confidence * 100).toFixed(0)}% de certeza. Motivo: ${symptom}. Dale al usuario un consejo empático, corto y directo para desatorarse.`);
        }

        statusMsg = `🧠 IA: ${aiResult.className} (${(aiResult.confidence * 100).toFixed(0)}%) • ${aiResult.statusMessage}`;
        statusColor = aiResult.badgeColor;
        statusBg = aiResult.badgeBg;
        statusBorder = aiResult.badgeBorder;
      } else {
        statusMsg = "PDEF INACTIVO: ROSTRO NO DETECTADO";
        statusColor = "text-zinc-600";
        statusBg = "bg-zinc-800/10";
        statusBorder = "border-zinc-800/30";
      }

    // Actualización directa del DOM de las barras para rendimiento a 60 FPS
    if (focusRef.current) {
      focusRef.current.style.width = `${Math.round(metricsRef.current.nivel_clap)}%`;
    }
    if (fatigueRef.current) {
      fatigueRef.current.style.width = `${Math.round(metricsRef.current.nivel_carga)}%`;
    }
    if (statusRef.current) {
      statusRef.current.textContent = statusMsg;
      statusRef.current.className = `px-4 py-2 mt-4 rounded-md border font-mono text-xs tracking-wider absolute top-4 left-4 ${statusBg} ${statusColor} ${statusBorder} uppercase shadow-2xl backdrop-blur-md transition-all duration-300`;
    }
  };

  const handleRecalibrate = (silent = false) => {
    const metrics = metricsRef.current;
    metrics.calibration_start = Date.now();
    metrics.calib_frames = 0;
    metrics.calib_ear_sum = 0;
    metrics.calib_frown_sum = 0;
    metrics.calib_yaw_sum = 0;
    metrics.calib_pitch_sum = 0;
    metrics.stress_events = [];
    metrics.frown_accumulated_ms = 0;
    metrics.hands_accumulated_ms = 0;
    metrics.nivel_carga = 0;

    if (!silent) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: '🔄 Re-iniciando sensores biométricos. Por favor, mantén una postura cómoda y rostro neutral durante 15 segundos para la recalibración.'
      }]);
    }
  };

  const handleAcceptProposal = () => {
    if (!proposedChange) return;

    const newSteps = proposedChange.proposedSteps.map((s: string) => s.replace(/(Paso \d+\.\d+:|Paso \d+:)/i, '').trim());
    setTask(proposedChange.proposedTask);
    setSteps(newSteps);
    setCurrentStepIdx(0);
    setElapsedTime(0);

    metricsRef.current.subdivided_indexes = [];
    setProposedChange(null);

    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: `🚀 ¡Misión actualizada con éxito! Ahora tu objetivo es: "${proposedChange.proposedTask}".`
    }]);

    setTimeout(() => {
      handleRecalibrate(true);
    }, 100);
  };

  const handleNextStep = () => {
    if (currentStepIdx < steps.length) {
      setCurrentStepIdx(c => c + 1);
      metricsRef.current.nivel_clap = 100; // Dopamine CLAP boost
      metricsRef.current.nivel_carga = Math.max(0, metricsRef.current.nivel_carga - 30); // Less stress

      // Clear any existing timeout
      if (rewardTimeoutRef.current) {
        clearTimeout(rewardTimeoutRef.current);
      }

      // Trigger Kawaii Reward
      if (currentStepIdx + 1 < steps.length) {
        const randomKao = KAOMOJIS[Math.floor(Math.random() * KAOMOJIS.length)];
        setRewardKaomoji(randomKao);
        setIsShowingReward(true);
        rewardTimeoutRef.current = window.setTimeout(() => {
          setIsShowingReward(false);
          rewardTimeoutRef.current = null;
        }, 2000);
      }
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${s}`;
  };

  const renderGlobalSettings = () => {
    return (
      <>
        {/* GLOBAL HEADER CONTROLS (Settings & Status) */}
        <div className="fixed top-4 right-4 z-[90] flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-2.5 rounded-2xl shadow-2xl select-none">
          <div className="flex items-center gap-2 px-2.5">
            <div className={`w-2 h-2 rounded-full ${apiStatus === 'browser' ? 'bg-green-500 animate-pulse' :
                apiStatus === 'server' ? 'bg-blue-500 animate-pulse' : 'bg-red-500 animate-pulse'
              }`} />
            <span className="font-mono text-[9px] tracking-wider text-zinc-400 uppercase font-semibold">
              {apiStatus === 'browser' ? 'Enlace: Local' :
                apiStatus === 'server' ? 'Enlace: Servidor' : 'Enlace: Offline'}
            </span>
          </div>

          <button
            onClick={() => setIsTelemetryOpen(true)}
            className="p-2 hover:bg-zinc-800 hover:text-amber-400 text-zinc-400 rounded-xl transition-all cursor-pointer"
            title="Caja Negra / Telemetría y Diagnóstico de Sesión en Vivo"
          >
            <Terminal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-zinc-800 hover:text-green-400 text-zinc-400 rounded-xl transition-all cursor-pointer"
            title="Configuración de Enlace Neuronal (API Key)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* TELEMETRY & DIAGNOSTICS FLIGHT RECORDER DRAWER */}
        <TelemetryDrawer isOpen={isTelemetryOpen} onClose={() => setIsTelemetryOpen(false)} />

        {/* SETTINGS MODAL */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl flex flex-col gap-5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                    <Settings className="text-green-500 w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-white font-medium text-base tracking-tight">Ajustes de Enlace</h3>
                    <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Gemini API Connection</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Gemini API Key:</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-green-500 text-white placeholder-zinc-700 font-mono text-xs shadow-inner"
                  />
                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    Obtén tu clave gratuita en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">Google AI Studio</a>. Se guardará de forma local en tu navegador.
                  </p>
                </div>

                <div className="flex gap-2 border-t border-zinc-800/80 pt-4">
                  <button
                    onClick={() => {
                      localStorage.setItem('gemini_api_key', geminiApiKey);
                      setIsSettingsOpen(false);
                    }}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold text-xs rounded-xl transition-colors uppercase tracking-wider"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => {
                      setGeminiApiKey('');
                      localStorage.removeItem('gemini_api_key');
                    }}
                    className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded-xl transition-colors"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={() => {
                      setGeminiApiKey(localStorage.getItem('gemini_api_key') || '');
                      setIsSettingsOpen(false);
                    }}
                    className="py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-xl transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  if (appStage === 'LOGIN') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center font-sans tracking-tight">
        <AnimatePresence>
          {isAppLoading && (
            <motion.div
              key="splash-screen"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -50, transition: { duration: 0.5, ease: "easeInOut" } }}
              className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center select-none"
            >
              {/* Top YouTube-style progress bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-zinc-900">
                <motion.div
                  className="h-full bg-green-500 shadow-[0_0_10px_#22c55e]"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>

              {/* Centered Mascot */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [0.8, 1.05, 1],
                  opacity: 1,
                  y: [0, -4, 0]
                }}
                transition={{
                  scale: { duration: 0.6, ease: "easeOut" },
                  opacity: { duration: 0.4 },
                  y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                }}
                className="flex flex-col items-center gap-6"
              >
                <NeuroMascot expression={mascotExpression} size={130} />

                <div className="flex flex-col items-center gap-1.5">
                  <span className="font-mono text-xs tracking-[0.25em] text-green-500 uppercase font-semibold animate-pulse">
                    Conectando Enlaces...
                  </span>
                  <span className="font-mono text-[10px] text-zinc-600 tracking-wider">
                    {Math.round(loadingProgress)}%
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-8 rounded-3xl bg-zinc-900 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
              <BrainCircuit className="text-green-500 w-5 h-5" />
            </div>
            <h1 className="text-xl font-medium text-white tracking-tight">NeuroSynk v3.4 Web</h1>
          </div>

          <form onSubmit={handleStart} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Ingresa la tarea o proyecto de hoy:
              </label>
              <input
                autoFocus
                type="text"
                className="w-full px-4 py-4 bg-zinc-950 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 text-white placeholder-zinc-700 font-mono text-sm shadow-inner"
                placeholder="Ej. Estudiar material general"
                value={task}
                onChange={e => setTask(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Perfil Biométrico de Trabajo:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setWorkMode('pantalla')}
                  className={`p-2 rounded-xl border text-xs font-medium transition-colors ${workMode === 'pantalla' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                >
                  💻 Pantalla
                </button>
                <button
                  type="button"
                  onClick={() => setWorkMode('lectura')}
                  className={`p-2 rounded-xl border text-xs font-medium transition-colors ${workMode === 'lectura' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                >
                  📖 Lectura/Papel
                </button>
                <button
                  type="button"
                  onClick={() => setWorkMode('flexible')}
                  className={`p-2 rounded-xl border text-xs font-medium transition-colors ${workMode === 'flexible' ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                >
                  🎨 TDAH/Flexible
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Sensibilidad de la IA (Tolerancia):
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setSensitivity('estricto')} className={`p-2 rounded-xl border text-xs font-medium transition-colors ${sensitivity === 'estricto' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>⚡ Estricto</button>
                <button type="button" onClick={() => setSensitivity('normal')} className={`p-2 rounded-xl border text-xs font-medium transition-colors ${sensitivity === 'normal' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>⚖️ Normal</button>
                <button type="button" onClick={() => setSensitivity('relajado')} className={`p-2 rounded-xl border text-xs font-medium transition-colors ${sensitivity === 'relajado' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>☕ Relajado</button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <>
                Siguiente <ArrowRight className="w-4 h-4 fill-black inline ml-1" />
              </>
            </button>
            <p className="text-xs text-center text-zinc-500 font-mono">
              Requiere acceso a la cámara. Procesamiento biometría 100% local.
            </p>
          </form>
        </motion.div>
        {renderGlobalSettings()}
      </div>
    );
  }

  if (appStage === 'BRIEFING') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center font-sans tracking-tight p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full p-6 sm:p-8 rounded-3xl bg-zinc-900 shadow-2xl flex flex-col gap-6"
        >
          <div className="flex items-center justify-between mb-2 border-b border-zinc-800 pb-4">
            <h2 className="text-xl font-medium text-white flex items-center gap-2">
              <BrainCircuit className="text-green-500" /> Afinando Detalles
            </h2>
          </div>

          <div className="flex flex-col gap-4 max-h-[40vh] overflow-y-auto pr-2">
            {briefingMsgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl text-sm ${m.role === 'user' ? 'bg-green-500/20 text-green-100 border border-green-500/30' : 'bg-zinc-800 text-zinc-300'}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleBriefingSend} className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500"
              placeholder="Escribe tu respuesta..."
              value={briefingInput}
              onChange={e => setBriefingInput(e.target.value)}
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading} className="bg-zinc-800 p-3 rounded-xl hover:bg-zinc-700 transition">
              <Send className="w-4 h-4" />
            </button>
          </form>

          <button
            onClick={handleStartFocus}
            disabled={isLoading}
            className="w-full mt-2 py-4 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4 fill-black inline mr-1" /> Generar Pasos e Iniciar Sesión
              </>
            )}
          </button>
        </motion.div>
        {renderGlobalSettings()}
      </div>
    );
  }

  return (
    <div className="lg:h-screen lg:overflow-hidden bg-zinc-950 text-zinc-300 font-sans p-4 xl:p-8 flex flex-col lg:flex-row gap-6 items-stretch">

      {/* LEFT PANEL: VIDEO, BIOMETRICS & CHAT */}
      <div className="flex-1 w-full max-w-5xl flex flex-col gap-6 min-h-0">

        {/* HUD Bars with TensorFlow.js Neural AI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest uppercase">
                <Target className="w-4 h-4 text-emerald-500" /> ENFOQUE C.L.A.P.
              </span>
              <span className="font-mono text-xs font-bold text-emerald-400">
                {aiPrediction ? `${aiPrediction.focusScore}%` : '100%'}
              </span>
            </div>
            <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden shadow-inner flex items-center mb-2">
              <div
                ref={focusRef}
                className="h-full bg-emerald-500 w-full rounded-full transition-[width] duration-300 ease-out shadow-[0_0_15px_rgba(16,185,129,0.6)]"
              />
            </div>
            <div className="text-[10px] font-mono text-zinc-400 truncate">
              {aiPrediction ? aiPrediction.statusMessage : 'Fijación ocular y atención óptima'}
            </div>
          </div>

          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest uppercase">
                <Activity className="w-4 h-4 text-rose-500" /> CARGA COGNITIVA & FATIGA
              </span>
              <span className="font-mono text-xs font-bold text-rose-400">
                {aiPrediction ? `${aiPrediction.stressLevel}%` : '0%'}
              </span>
            </div>
            <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden shadow-inner flex items-center mb-2">
              <div
                ref={fatigueRef}
                className="h-full bg-rose-500 w-0 rounded-full transition-[width] duration-300 ease-out shadow-[0_0_15px_rgba(244,63,94,0.6)]"
              />
            </div>
            <div className="text-[10px] font-mono text-zinc-400 truncate">
              {aiPrediction && aiPrediction.stressLevel > 50 ? '⚠️ Tensión o fatiga acumulada' : 'Nivel de estrés bajo y despejado'}
            </div>
          </div>

          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest uppercase">
                <BrainCircuit className="w-4 h-4 text-cyan-400" /> RED NEURONAL LOCAL
              </span>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase tracking-wider">
                TF.js 95.7% Acc
              </span>
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold font-mono text-white tracking-wide">
                {aiPrediction ? aiPrediction.className : 'ENFOQUE'}
              </span>
              <span className="text-xs font-mono text-zinc-400 font-semibold">
                {aiPrediction ? `${(aiPrediction.confidence * 100).toFixed(0)}% Conf.` : '100%'}
              </span>
            </div>

            {/* Desglose Multi-Probabilidad de 5 Estados */}
            <div className="grid grid-cols-5 gap-1 pt-1 border-t border-zinc-800/60 text-center">
              <div title="Enfoque" className={`py-1 rounded-md text-[8px] font-mono font-bold ${aiPrediction?.classIndex === 0 ? 'bg-emerald-500 text-black shadow-sm' : 'bg-zinc-950 text-zinc-500'}`}>
                ENF {aiPrediction ? Math.round((aiPrediction.probabilities[0] || 0) * 100) : 100}%
              </div>
              <div title="Distracción" className={`py-1 rounded-md text-[8px] font-mono font-bold ${aiPrediction?.classIndex === 1 ? 'bg-amber-500 text-black shadow-sm' : 'bg-zinc-950 text-zinc-500'}`}>
                DIS {aiPrediction ? Math.round((aiPrediction.probabilities[1] || 0) * 100) : 0}%
              </div>
              <div title="Fatiga" className={`py-1 rounded-md text-[8px] font-mono font-bold ${aiPrediction?.classIndex === 2 ? 'bg-blue-500 text-black shadow-sm' : 'bg-zinc-950 text-zinc-500'}`}>
                FAT {aiPrediction ? Math.round((aiPrediction.probabilities[2] || 0) * 100) : 0}%
              </div>
              <div title="Sobreestimulación" className={`py-1 rounded-md text-[8px] font-mono font-bold ${aiPrediction?.classIndex === 3 ? 'bg-rose-500 text-black shadow-sm' : 'bg-zinc-950 text-zinc-500'}`}>
                SOB {aiPrediction ? Math.round((aiPrediction.probabilities[3] || 0) * 100) : 0}%
              </div>
              <div title="Agobio Postural" className={`py-1 rounded-md text-[8px] font-mono font-bold ${aiPrediction?.classIndex === 4 ? 'bg-purple-500 text-black shadow-sm' : 'bg-zinc-950 text-zinc-500'}`}>
                AGO {aiPrediction ? Math.round((aiPrediction.probabilities[4] || 0) * 100) : 0}%
              </div>
            </div>
          </div>
        </div>

        {/* WORKSPACE: Camera & Quick Chat */}
        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
          {/* Camera Viewport */}
          <div className="relative rounded-3xl overflow-hidden bg-zinc-950 flex-[3] flex flex-col items-center justify-center shadow-2xl border border-zinc-900 min-h-0">
            {/* Hidden native video element for media pipe */}
            <video ref={videoRef} className="absolute w-0 h-0 opacity-0 -z-10" autoPlay playsInline muted />

            {/* The visible Canvas with overlay */}
            <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-contain" />

            <div ref={statusRef} className="absolute top-4 left-4 px-4 py-2 rounded-md border font-mono text-xs tracking-wider bg-zinc-800/80 text-zinc-400 border-zinc-700 uppercase backdrop-blur-md shadow-2xl">
              🧠 INICIANDO RED NEURONAL TENSORFLOW.JS...
            </div>

            <button
              onClick={() => handleRecalibrate(false)}
              className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-md bg-black/60 hover:bg-black/80 hover:text-green-400 border border-zinc-700/50 backdrop-blur-md font-mono text-[10px] text-zinc-300 flex items-center gap-1.5 shadow-2xl transition-all cursor-pointer uppercase tracking-wider font-semibold"
              title="Reiniciar calibración biométrica"
            >
              🔄 Recalibrar IA
            </button>

            <div className="absolute bottom-4 left-4 flex gap-2">
              <span className="px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md font-mono text-[10px] text-zinc-400 flex items-center gap-2 shadow-2xl">
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-blue-500' : 'bg-red-500 animate-pulse'}`} /> {isPaused ? 'EN PAUSA' : 'INFERENCIA ACTIVA (TF.js)'}
              </span>
            </div>

            {isPaused && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-20 flex items-center justify-center pointer-events-none">
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
                <div key={i} className={`max-w-[90%] rounded-2xl px-5 py-3 text-sm leading-relaxed font-sans ${msg.role === 'user'
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

              {proposedChange && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-[95%] self-start bg-zinc-900 border-2 border-emerald-500/30 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono text-[10px] tracking-widest text-emerald-500 uppercase font-bold">💡 Propuesta de Nueva Misión</span>
                    <h4 className="text-white font-semibold text-sm leading-snug">{proposedChange.proposedTask}</h4>
                  </div>

                  <div className="flex flex-col gap-1 border-t border-zinc-800 pt-3">
                    <span className="font-mono text-[9px] tracking-wider text-zinc-500 uppercase">Micro-pasos de Acción:</span>
                    <ul className="text-xs text-zinc-400 space-y-1.5 mt-1 list-disc pl-4 leading-relaxed">
                      {proposedChange.proposedSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleAcceptProposal}
                      className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
                    >
                      Aceptar Nueva Tarea
                    </button>
                    <button
                      onClick={() => setProposedChange(null)}
                      className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-400 text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Descartar
                    </button>
                  </div>
                </motion.div>
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
          <AnimatePresence mode="wait">
            {isShowingReward && (
              <motion.div
                key="reward-overlay"
                initial={{ opacity: 0, scale: 0.3, y: 100 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.5 }}
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

          <div className="p-6 pb-4 bg-zinc-900 flex justify-between items-center z-10 shadow-sm shadow-black/20">
            <div className="flex items-center gap-3">
              <NeuroMascot expression={mascotExpression} size={46} />
              <div className="flex flex-col gap-0.5">
                <h2 className="text-white text-lg tracking-tight font-medium flex items-center gap-2">
                  Mentor IA Autónomo
                </h2>
                <p className="text-xs font-mono text-zinc-500 truncate max-w-[180px]">OBJ: {task}</p>
              </div>
            </div>
            {/* Timer & Pause Controls */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center justify-center w-12 rounded-xl shadow-lg border transition-colors ${isPaused ? 'bg-blue-500 border-blue-400 text-black' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                  }`}
                title="Pausar / Reanudar (Tecla Q)"
              >
                {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
              </button>
              <div className={`flex items-center gap-2 px-4 py-2 bg-black border rounded-xl transition-all ${isPaused ? 'border-zinc-800 opacity-50' : 'border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                }`}>
                <Timer className={`w-5 h-5 ${isPaused ? 'text-zinc-600' : 'text-green-500 animate-pulse'}`} />
                <span className={`font-mono text-xl tracking-[0.15em] font-bold ${isPaused ? 'text-zinc-600' : 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                  }`}>
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
            <div className="space-y-4">
              {steps.map((step, i) => {
                const isCompleted = i < currentStepIdx;
                const isCurrent = i === currentStepIdx;

                return (
                  <motion.div
                    key={i}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={isCurrent ? {
                      opacity: 1,
                      x: 0,
                      boxShadow: ["0px 0px 0px rgba(52,211,153,0)", "0px 0px 25px rgba(52,211,153,0.3)", "0px 0px 15px rgba(52,211,153,0.1)"],
                      backgroundColor: ["rgba(24,24,27,1)", "rgba(16,185,129,0.1)", "rgba(34,197,94,0.1)"]
                    } : {
                      opacity: 1,
                      x: 0,
                      boxShadow: "0px 0px 0px rgba(52,211,153,0)",
                      backgroundColor: isCompleted ? "rgba(24,24,27,1)" : "rgba(24,24,27,0.5)"
                    }}
                    transition={{
                      delay: i * 0.1,
                      boxShadow: { duration: 1.5, ease: "easeOut" },
                      backgroundColor: { duration: 1.5, ease: "easeOut" }
                    }}
                    className={`p-5 rounded-2xl flex items-start gap-4 transition-all duration-300 ${isCurrent
                        ? 'ring-1 ring-green-500/20'
                        : isCompleted
                          ? 'opacity-40 border border-zinc-900/50'
                          : 'opacity-80 border border-zinc-800'
                      }`}
                  >
                    <motion.div
                      className="mt-0.5 min-w-6 origin-center"
                      animate={isCurrent ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.6, repeat: isCurrent ? Infinity : 0, repeatDelay: 1.5 }}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-6 h-6 text-zinc-600" />
                      ) : isCurrent ? (
                        <ArrowRight className="w-6 h-6 text-green-500" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-zinc-800" />
                      )}
                    </motion.div>

                    <span className={`text-base leading-relaxed ${isCurrent ? 'text-green-50 font-semibold' : isCompleted ? 'text-zinc-600 line-through' : 'text-zinc-400'
                      }`}>
                      {step}
                    </span>
                  </motion.div>
                )
              })}

              {currentStepIdx >= steps.length && steps.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    rotate: 0,
                    backgroundColor: ["#ffffff", "#dcfce7", "#ffffff"]
                  }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="p-6 mt-8 rounded-2xl bg-white text-black text-center flex flex-col items-center gap-3 shadow-[0_0_40px_rgba(34,197,94,0.2)] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-green-500/5 pointer-events-none" />
                  <Target className="w-16 h-16 text-green-500 mb-2 animate-bounce" />
                  <h3 className="font-black text-2xl tracking-tight text-center text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-400">
                    (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧<br />¡Misión Cumplida!
                  </h3>
                  <p className="text-sm opacity-80 leading-relaxed font-mono mt-2 mb-4 font-semibold text-zinc-700">Completado en {formatTime(elapsedTime)}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-black text-white rounded-2xl text-base font-bold hover:bg-zinc-800 transition-colors uppercase tracking-widest"
                  >
                    Iniciar Nueva Misión
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          {currentStepIdx < steps.length && (
            <div className="p-6 bg-zinc-900 border-t border-zinc-800/50 z-10 relative">
              <button
                onClick={handleNextStep}
                className="w-full py-5 bg-green-500 hover:bg-green-400 text-black font-black text-lg rounded-2xl transition-all flex items-center justify-center gap-2 relative group overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.2)]"
              >
                {isShowingReward ? "¡VAMOS!" : "COMPLETAR PASO"}
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              </button>
              <p className="text-[10px] uppercase tracking-wider font-mono text-center text-zinc-500 mt-4">
                Pulsa para recuperar dopamina
              </p>
            </div>
          )}
        </div>
      </div>
      {renderGlobalSettings()}
    </div>
  );
}
