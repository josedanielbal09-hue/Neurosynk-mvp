import React, { useEffect, useRef, useState } from 'react';
import { Activity, BrainCircuit, CheckCircle, Target, ArrowRight, Play, Pause, Eye, Timer, MessageSquare, Send, Settings, Sparkles, Cpu, ShieldCheck, Headphones, Volume2, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { loadNeuroSynkBrain, evaluateAIBiometrics, AIPredictionResult } from './services/aiInference';
import { FocusBudWidget } from './components/avatar/FocusBudWidget';
import { FocusState } from './config/avatarConfig';
import { getBudContextualMessage } from './utils/budMessages';
import { brownNoise } from './utils/audioEngine';
import { GroundingBreak } from './components/GroundingBreak';


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

const mapAIPredictionToAvatarState = (className?: string): FocusState => {
  switch (className) {
    case 'ENFOQUE PROFUNDO (FLOW)':
    case 'ESTUDIO NORMAL / NEUTRO':
    case 'ENFOQUE':
      return 'ENFOQUE';
    case 'DISTRACCIÓN':
    case 'SOBREESTIMULACIÓN':
      return 'ALERTA_SUAVE';
    case 'FATIGA':
      return 'FATIGA';
    case 'AGOBIO POSTURAL':
      return 'PARALISIS';
    default:
      return 'ENFOQUE';
  }
};

interface SurveyQuestion {
  id: string;
  question: string;
  options: string[];
}

const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: "q1",
    question: "¿Cuánto tiempo dedicarás a esta sesión?",
    options: [
      "25 a 30 minutos (Sprint corto)",
      "45 a 60 minutos (Sesión estándar)",
      "90 a 120 minutos (Sesión profunda)"
    ]
  },
  {
    id: "q2",
    question: "¿Qué avance tangible buscas lograr al concluir este tiempo?",
    options: [
      "Comprender la idea central",
      "Resolver un ejercicio o sección",
      "Completar una entrega formal"
    ]
  },
  {
    id: "q3",
    question: "¿Cuál es tu nivel de familiaridad o preparación con los materiales?",
    options: [
      "Parto desde cero absoluto",
      "Tengo bases y notas listas",
      "Domino el tema, voy a producir"
    ]
  },
  {
    id: "q4",
    question: "¿Cómo describirías tu nivel de energía y foco en este momento?",
    options: [
      "Alta energía y foco despejado",
      "Energía media / neutra",
      "Mente dispersa o fatiga inicial"
    ]
  },
  {
    id: "q5",
    question: "¿En qué momento sueles experimentar mayor fricción o bloqueo?",
    options: [
      "Al romper la inercia del inicio",
      "A la mitad con la densidad técnica",
      "Al cerrar y pulir detalles finales"
    ]
  }
];

type TimerMode = 'WORK' | 'SHORT_BREAK' | 'LONG_BREAK';

export default function App() {
  const [task, setTask] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Estados de la Encuesta Dinámica de Calibración de Contexto
  const [surveyQuestions, setSurveyQuestions] = useState<SurveyQuestion[]>([]);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [showSurvey, setShowSurvey] = useState<boolean>(false);
  const [isSurveyLoading, setIsSurveyLoading] = useState<boolean>(false);

  // Temporizador Pomodoro Adaptable
  const [workDuration, setWorkDuration] = useState<number>(25 * 60);
  const [breakDuration, setBreakDuration] = useState<number>(5 * 60);
  const [timerMode, setTimerMode] = useState<TimerMode>('WORK');
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [completedBlocks, setCompletedBlocks] = useState<number>(0);
  const [totalTargetBlocks, setTotalTargetBlocks] = useState<number>(2);

  // Configuración de audio
  const [isBrownNoiseActive, setIsBrownNoiseActive] = useState<boolean>(false);
  const [noiseVolume, setNoiseVolume] = useState<number>(0.3);
  const [isTimerConfigOpen, setIsTimerConfigOpen] = useState<boolean>(false);

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
  const lastAiUpdateRef = useRef<number>(0);
  const displayedClassRef = useRef<number>(0);
  const pendingClassRef = useRef<number | null>(null);
  const pendingClassSinceRef = useRef<number>(0);

  // Carga inicial del cerebro IA
  useEffect(() => {
    loadNeuroSynkBrain().then(res => {
      setIsAIBrainReady(res.isReady);
    });
  }, []);

  const [appStage, setAppStage] = useState<'LOGIN' | 'BRIEFING' | 'FOCUS'>('LOGIN');
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

  // Separate Timer logic with Pause control (Total Session Time)
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

  // Controles de Audio Ambiental (Ruido Marrón)
  const toggleBrownNoise = () => {
    if (isBrownNoiseActive) {
      brownNoise.stop();
      setIsBrownNoiseActive(false);
    } else {
      brownNoise.start(noiseVolume);
      setIsBrownNoiseActive(true);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setNoiseVolume(newVol);
    brownNoise.setVolume(newVol);
  };

  const handleSkipBreak = () => {
    setTimerMode('WORK');
    setTimerSecondsLeft(workDuration);
    if (isBrownNoiseActive) {
      brownNoise.start(noiseVolume);
    }
  };

  const handleTriggerTestGrounding = () => {
    // Si ya está en descanso, regresa a trabajo; si está en trabajo, activa el descanso
    if (timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK') {
      setTimerMode('WORK');
      setTimerSecondsLeft(workDuration || 25 * 60);
      if (isBrownNoiseActive) {
        brownNoise.start(noiseVolume);
      }
    } else {
      if (isBrownNoiseActive) {
        brownNoise.stop();
      }
      setTimerMode('SHORT_BREAK');
      setTimerSecondsLeft(breakDuration || 5 * 60);
    }
  };

  // Ciclo del Temporizador Pomodoro Adaptable
  useEffect(() => {
    let timerInterval: any = null;
    if (isStarted && isTimerRunning && !isPaused) {
      timerInterval = setInterval(() => {
        setTimerSecondsLeft(prev => {
          if (prev <= 1) {
            // Cambio de modo al llegar a 0
            if (timerMode === 'WORK') {
              setCompletedBlocks(c => c + 1);
              if (isBrownNoiseActive) {
                brownNoise.stop();
              }
              setTimerMode('SHORT_BREAK');
              return breakDuration;
            } else {
              setTimerMode('WORK');
              if (isBrownNoiseActive) {
                brownNoise.start(noiseVolume);
              }
              return workDuration;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isStarted, isTimerRunning, isPaused, timerMode, workDuration, breakDuration, isBrownNoiseActive, noiseVolume]);

  // Detener audio al desmontar
  useEffect(() => {
    return () => {
      brownNoise.stop();
    };
  }, []);

  // UX states for Micro-rewards
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rewardKaomoji, setRewardKaomoji] = useState('');
  const [isShowingReward, setIsShowingReward] = useState(false);
  const [isStateLocked, setIsStateLocked] = useState(false);

  useEffect(() => {
    setIsStateLocked(isShowingReward);
  }, [isShowingReward]);
  const KAOMOJIS = ["(๑˃̵ᴗ˂̵)و 🚀", "✨ ESTELAR ✨", "🌸 FLUIDO 🌸", "🔥 ¡FUEGO! 🔥", "(ง'̀-'́)ง ⚡️"];

  // Notificaciones Contextuales de FocusBud (Body Doubling - Fase 4)
  const stepDistractionsRef = useRef<number>(0);
  const prevAvatarStateRef = useRef<FocusState>('ENFOQUE');

  const isBreakActive = timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK';

  const currentFocusState: FocusState = (isBreakActive || isPaused)
    ? 'PAUSA'
    : isStateLocked
    ? 'CELEBRACION'
    : mapAIPredictionToAvatarState(aiPrediction?.className);

  // Estado biométrico directo emitido por la Red Neuronal (ej. 'AGOBIO POSTURAL', 'SOBREESTIMULACIÓN', 'ENFOQUE')
  const rawAIState = (isBreakActive || isPaused)
    ? 'PAUSA'
    : isStateLocked
    ? 'CELEBRACION'
    : (aiPrediction?.className || 'ENFOQUE');

  const currentActiveStep = steps[currentStepIdx] || '';
  const [budMessage, setBudMessage] = useState<string>(() =>
    getBudContextualMessage('ENFOQUE', { stepText: '', distractionCount: 0 })
  );

  useEffect(() => {
    if (isBreakActive) {
      setBudMessage("Buen trabajo. Terminamos este bloque. Toca descansar un poco.");
      return;
    }

    if (currentFocusState === 'ALERTA_SUAVE' && prevAvatarStateRef.current !== 'ALERTA_SUAVE') {
      stepDistractionsRef.current += 1;
    }
    prevAvatarStateRef.current = currentFocusState;

    const msg = getBudContextualMessage(rawAIState, {
      stepText: currentActiveStep,
      distractionCount: stepDistractionsRef.current
    });
    setBudMessage(msg);
  }, [rawAIState, currentFocusState, currentStepIdx, steps, currentActiveStep, isBreakActive]);

  // Reiniciar contador de distracciones al cambiar o completar un paso
  useEffect(() => {
    stepDistractionsRef.current = 0;
  }, [currentStepIdx]);




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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiApiKey || ''
        },
        body: JSON.stringify({
          message: userMsg,
          history: chatMessages.slice(-6), // últimos mensajes para contexto
          currentStep: steps[currentStepIdx] || 'Preparación general',
          taskContext: task || 'Estudio / Trabajo'
        })
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
  const lastFrameProcessTimeRef = useRef<number>(0);

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
    setIsSurveyLoading(true);

    try {
      const response = await fetch('/api/task-survey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiApiKey || ''
        },
        body: JSON.stringify({ task: finalTask })
      });
      const data = await response.json();
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setSurveyQuestions(data.questions);
      } else {
        setSurveyQuestions(DEFAULT_SURVEY_QUESTIONS);
      }
    } catch (err) {
      console.error("Task survey fetch error:", err);
      setSurveyQuestions(DEFAULT_SURVEY_QUESTIONS);
    } finally {
      setSurveyAnswers({});
      setShowSurvey(true);
      setIsSurveyLoading(false);
    }
  };

  const handleGenerateFromSurvey = async (useAnswers: boolean = true) => {
    setIsLoading(true);
    const answersToSend = useAnswers ? surveyAnswers : {};

    try {
      const response = await fetch('/api/split-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': geminiApiKey || ''
        },
        body: JSON.stringify({
          task,
          surveyAnswers: answersToSend,
          context: `Modo de trabajo: ${workMode}, Sensibilidad: ${sensitivity}`
        }),
      });
      const data = await response.json();

      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        const cleanSteps = data.steps.map((s: string) => s.replace(/(Paso \d+:)/i, '').trim());
        setSteps(cleanSteps);
      } else {
        throw new Error("Formato de respuesta incorrecto");
      }
    } catch (err) {
      console.error("Error al generar ruta de trabajo:", err);
      setSteps([
        `DELIMITA el objetivo y alcance principal de '${task}'.`,
        `ORGANIZA los materiales o fuentes indispensables para arrancar.`,
        `DESARROLLA el primer bloque central con enfoque total.`,
        `REVISA y consolida el avance realizado.`
      ]);
    } finally {
      // Sincronización con la Encuesta de Duración (surveyAnswers.q1)
      const q1Ans = surveyAnswers.q1 || '';
      let wDur = 25 * 60;
      let bDur = 5 * 60;
      let targetBlocks = 2;

      if (q1Ans.includes('30') || q1Ans.toLowerCase().includes('sprint')) {
        wDur = 25 * 60;
        bDur = 5 * 60;
        targetBlocks = 1;
      } else if (q1Ans.includes('60') || q1Ans.toLowerCase().includes('estándar') || q1Ans.toLowerCase().includes('estandar')) {
        wDur = 25 * 60;
        bDur = 5 * 60;
        targetBlocks = 2;
      } else if (q1Ans.includes('90') || q1Ans.includes('120') || q1Ans.toLowerCase().includes('profunda')) {
        wDur = 45 * 60;
        bDur = 10 * 60;
        targetBlocks = 3;
      }

      setWorkDuration(wDur);
      setBreakDuration(bDur);
      setTotalTargetBlocks(targetBlocks);
      setCompletedBlocks(0);
      setTimerMode('WORK');
      setTimerSecondsLeft(wDur);
      setIsTimerRunning(true);

      setCurrentStepIdx(0);
      setIsLoading(false);
      setShowSurvey(false);
      setIsStarted(true);
      setAppStage('FOCUS');
    }
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
      setIsTimerRunning(true);
      setTimerSecondsLeft(workDuration);
      setTimerMode('WORK');
      setCompletedBlocks(0);
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
          // 1. Inicializar Holistic en Modo Ligero (Complexity 0)
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

          // 2. Solicitar cámara nativa en 640x480
          if (statusRef.current) statusRef.current.textContent = "SOLICITANDO CAMARA...";
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640, max: 640 },
              height: { ideal: 480, max: 480 },
              frameRate: { ideal: 15, max: 20 },
              facingMode: "user"
            }
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

            // 3. Procesamiento controlado de cuadros
            videoRef.current.onplaying = () => {
              if (statusRef.current) statusRef.current.textContent = "ANALIZANDO BIOMETRIA...";

              let isProcessing = false;

              const sendToMediaPipe = async () => {
                if (!isComponentMounted) return;

                const now = performance.now();

                if (
                  now - lastFrameProcessTimeRef.current >= 100 &&
                  videoRef.current &&
                  videoRef.current.readyState >= 2 &&
                  videoRef.current.videoWidth > 0 &&
                  videoRef.current.videoHeight > 0 &&
                  holisticRef.current &&
                  !isProcessing
                ) {
                  lastFrameProcessTimeRef.current = now;
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
    };
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

    // MediaPipe overlays (Classic Python Styling)
    if (results.faceLandmarks) {
      window.drawConnectors(canvasCtx, results.faceLandmarks, window.FACEMESH_RIGHT_EYEBROW, { color: '#FF3030', lineWidth: 1.5 }); // Rojo
      window.drawConnectors(canvasCtx, results.faceLandmarks, window.FACEMESH_RIGHT_EYE, { color: '#FF3030', lineWidth: 1.5 });
      window.drawConnectors(canvasCtx, results.faceLandmarks, window.FACEMESH_LEFT_EYEBROW, { color: '#30FF30', lineWidth: 1.5 }); // Verde
      window.drawConnectors(canvasCtx, results.faceLandmarks, window.FACEMESH_LEFT_EYE, { color: '#30FF30', lineWidth: 1.5 });
      window.drawConnectors(canvasCtx, results.faceLandmarks, window.FACEMESH_FACE_OVAL, { color: '#E0E0E0', lineWidth: 1.5 }); // Blanco
      window.drawConnectors(canvasCtx, results.faceLandmarks, window.FACEMESH_LIPS, { color: '#E0E0E0', lineWidth: 1.5 });
    }
    if (results.poseLandmarks && window.POSE_CONNECTIONS) {
      window.drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#E0E0E0', lineWidth: 2 });
      window.drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#00FFFF', lineWidth: 1, radius: 2.5 });
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

      // MAR (Mouth Aspect Ratio - Detección de bostezo / fatiga somnolienta)
      const mouthTop = faces[13];
      const mouthBottom = faces[14];
      const mouthLeft = faces[61] || faces[78];
      const mouthRight = faces[291] || faces[308];
      const mouthHeight = Math.hypot(mouthTop.x - mouthBottom.x, mouthTop.y - mouthBottom.y);
      const mouthWidth = Math.hypot(mouthLeft.x - mouthRight.x, mouthLeft.y - mouthRight.y);
      const MAR = mouthWidth > 0 ? mouthHeight / mouthWidth : 0.05;

      // Inclinación lateral de la cabeza (Roll angle en grados)
      const rollRad = Math.atan2(faces[263].y - faces[33].y, faces[263].x - faces[33].x);
      const rollAngle = rollRad * (180 / Math.PI);

      // 3. Buffer rodante de 2 segundos para la Red Neuronal de TensorFlow.js (12 Dimensiones)
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

      // Normalización temporal de desplazamiento nasal (independiente de los FPS del navegador)
      const wDurationSec = Math.max(0.5, (wFrames[wFrames.length - 1].t - wFrames[0].t) / 1000);
      const rawNoseSum = wFrames.reduce((a, b) => a + b.noseDelta, 0);
      const noseDeltaSum = (rawNoseSum / wDurationSec) * 2.0;

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

      // Histéresis temporal de 1200ms para estabilización clínica de clase en pantalla
      const rawClassIdx = aiResult.classIndex;
      if (rawClassIdx !== displayedClassRef.current) {
        if (pendingClassRef.current !== rawClassIdx) {
          pendingClassRef.current = rawClassIdx;
          pendingClassSinceRef.current = now;
        } else if (now - pendingClassSinceRef.current >= 1200) {
          displayedClassRef.current = rawClassIdx;
          pendingClassRef.current = null;
        }
      } else {
        pendingClassRef.current = null;
      }

      const CLASS_NAMES = [
        'ESTUDIO NORMAL / NEUTRO',
        'ENFOQUE PROFUNDO (FLOW)',
        'DISTRACCIÓN',
        'FATIGA',
        'SOBREESTIMULACIÓN',
        'AGOBIO POSTURAL'
      ];

      const stabilizedResult: AIPredictionResult = {
        ...aiResult,
        classIndex: displayedClassRef.current,
        className: CLASS_NAMES[displayedClassRef.current] || aiResult.className
      };

      // Throttling de 200ms para setAiPrediction (previene re-renders innecesarios manteniendo 60 FPS en el canvas)
      if (now - lastAiUpdateRef.current >= 200) {
        lastAiUpdateRef.current = now;
        setAiPrediction(stabilizedResult);
      }

      // Control Directo de Métricas C.L.A.P. y Carga Cognitiva con Suavizado Exponencial Orgánico
      const targetFocus = aiResult.focusScore;
      const targetLoad = aiResult.stressLevel;

      metrics.nivel_clap = Math.max(5, Math.min(100, metrics.nivel_clap * 0.94 + targetFocus * 0.06));
      metrics.nivel_carga = Math.max(0, Math.min(100, metrics.nivel_carga * 0.94 + targetLoad * 0.06));

      if (displayedClassRef.current === 1 || displayedClassRef.current === 0) {
        setMascotExpression('happy');
      } else if (displayedClassRef.current === 3 || displayedClassRef.current === 5) {
        setMascotExpression('blink');
      } else {
        setMascotExpression('normal');
      }

      // Subdivisión autónoma de tarea si la Red Neuronal detecta que el enfoque cayó bajo 40%
      if (metrics.nivel_clap < 40 && !metrics.is_subdividing && !metrics.subdivided_indexes.includes(currentStepIdxRef.current)) {
        subdivideCurrentStepRef.current(currentStepIdxRef.current);
      }

      // Intervención proactiva del Agente / Mentor IA cuando la Red Neuronal detecta sobrecarga continua
      const pFatiga = aiResult.probabilities[3] || 0;
      const pAgobio = aiResult.probabilities[5] || 0;

      if ((pAgobio > 0.65 || pFatiga > 0.65 || metrics.nivel_carga > 75) && (now - metrics.last_auto_chat > 45000)) {
        metrics.last_auto_chat = now;
        const symptom = pAgobio > 0.65
          ? `Postura en tensión física y agobio (${(pAgobio * 100).toFixed(0)}%)`
          : `Fatiga ocular y somnolencia (${(pFatiga * 100).toFixed(0)}%)`;

        interventionRef.current(`[Agente Autónomo NeuroSynk]: La red neuronal detectó ${stabilizedResult.className} con ${(stabilizedResult.confidence * 100).toFixed(0)}% de certeza. Motivo: ${symptom}. Dale al usuario un consejo empático, corto y directo para desatorarse.`);
      }

      statusMsg = `🧠 IA: ${stabilizedResult.className} (${(stabilizedResult.confidence * 100).toFixed(0)}%) • ${stabilizedResult.statusMessage}`;
      statusColor = stabilizedResult.badgeColor;
      statusBg = stabilizedResult.badgeBg;
      statusBorder = stabilizedResult.badgeBorder;
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
    // Actualización de statusRef desactivada para consolidar notificación única en FocusBudWidget / AvatarMessage
    // if (statusRef.current) {
    //   statusRef.current.textContent = statusMsg;
    //   statusRef.current.className = `px-4 py-2 mt-4 rounded-md border font-mono text-xs tracking-wider absolute top-4 left-4 ${statusBg} ${statusColor} ${statusBorder} uppercase shadow-2xl backdrop-blur-md transition-all duration-300`;
    // }
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
      stepDistractionsRef.current = 0;
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
        {/* GLOBAL HEADER CONTROLS (Settings, Audio & Status) */}
        <div className="fixed top-4 right-4 z-[90] flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 p-2.5 rounded-2xl shadow-2xl select-none">
          {/* Conmutador de Audio Ambiental (Ruido Marrón) */}
          <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
            <button
              onClick={toggleBrownNoise}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                isBrownNoiseActive
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-700/50'
              }`}
              title={isBrownNoiseActive ? "Desactivar Ruido Marrón" : "Activar Ruido Marrón"}
            >
              <Headphones className={`w-3.5 h-3.5 ${isBrownNoiseActive ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline font-semibold">Ruido Marrón:</span>
              <span className={`font-bold ${isBrownNoiseActive ? 'text-amber-400' : 'text-zinc-500'}`}>
                {isBrownNoiseActive ? 'ON' : 'OFF'}
              </span>
            </button>
            {isBrownNoiseActive && (
              <div className="flex items-center gap-1.5 pl-1 animate-fadeIn">
                <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={noiseVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 h-1.5 bg-zinc-800 accent-amber-400 rounded-lg cursor-pointer"
                  title={`Volumen: ${Math.round(noiseVolume * 100)}%`}
                />
              </div>
            )}
          </div>

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
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 hover:bg-zinc-800 hover:text-green-400 text-zinc-400 rounded-xl transition-all cursor-pointer"
            title="Configuración de Enlace Neuronal (API Key)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

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
                    type="text"
                    style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                    placeholder="Introduce tu clave personal..."
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-green-500 text-white placeholder-zinc-700 font-mono text-xs shadow-inner"
                  />
                  <p className="text-[10px] text-zinc-500 leading-normal font-sans">
                    Obtén tu clave en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">Google AI Studio</a>. Se guardará de forma local y privada en tu navegador.
                  </p>
                </div>

                <div className="flex gap-2 border-t border-zinc-800/80 pt-4">
                  <button
                    onClick={() => {
                      const cleanKey = (geminiApiKey || '').trim();
                      try {
                        localStorage.setItem('gemini_api_key', cleanKey);
                        setApiStatus(cleanKey ? 'browser' : 'none');
                      } catch (e) {
                        console.warn("Storage warning:", e);
                      }
                      setIsSettingsOpen(false);
                    }}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold text-xs rounded-xl transition-colors uppercase tracking-wider cursor-pointer"
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

  if (showSurvey && !isStarted) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center font-sans tracking-tight p-4 sm:p-6 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-2xl w-full p-6 sm:p-8 rounded-3xl bg-zinc-900 border border-zinc-800/80 shadow-2xl flex flex-col gap-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                  Personalicemos tu sesión
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Meta: <span className="text-emerald-400 font-medium font-mono">"{task}"</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSurvey(false)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer"
              title="Volver a editar meta"
            >
              ← Modificar meta
            </button>
          </div>

          {/* Question List container with comfortable vertical scroll */}
          <div className="flex flex-col gap-4 max-h-[55vh] sm:max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {surveyQuestions.map((q, idx) => {
              const selectedOption = surveyAnswers[q.id];
              return (
                <div
                  key={q.id || idx}
                  className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center justify-center mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-sm font-medium text-zinc-100 leading-snug">
                      {q.question}
                    </p>
                  </div>

                  {/* Options as pill/card buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:pl-9">
                    {q.options.map((opt, oIdx) => {
                      const isSelected = selectedOption === opt;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => setSurveyAnswers(prev => ({ ...prev, [q.id]: opt }))}
                          className={`px-3 py-2.5 rounded-xl border text-xs text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)] font-medium ring-1 ring-emerald-500/50'
                              : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-850'
                          }`}
                        >
                          <span className="leading-snug">{opt}</span>
                          {isSelected && (
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleGenerateFromSurvey(true)}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-zinc-950 font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm sm:text-base cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Generando ruta adaptada...</span>
                </>
              ) : (
                <>
                  GENERAR RUTA DE TRABAJO 🚀
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleGenerateFromSurvey(false)}
              className="w-full py-2.5 text-xs sm:text-sm text-zinc-500 hover:text-zinc-300 font-medium transition-colors text-center cursor-pointer disabled:opacity-50"
            >
              Omitir y comenzar directo
            </button>
          </div>
        </motion.div>
        {renderGlobalSettings()}
      </div>
    );
  }

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
                <FocusBudWidget
                  state={currentFocusState}
                  message={budMessage}
                />

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
                disabled={isLoading || isSurveyLoading}
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
              disabled={isLoading || isSurveyLoading}
              className="w-full py-4 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSurveyLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Calibrando contexto...</span>
                </>
              ) : (
                <>
                  Siguiente <ArrowRight className="w-4 h-4 fill-black inline ml-1" />
                </>
              )}
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
          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest">
                <Target className="w-4 h-4 text-emerald-500" /> RENDIMIENTO (C.L.A.P.)
              </span>
            </div>
            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden shadow-inner flex items-center">
              <div
                ref={focusRef}
                className="h-full bg-emerald-500 w-full rounded-full transition-[width] duration-300 ease-out shadow-[0_0_15px_rgba(16,185,129,0.6)]"
              />
            </div>
          </div>

          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50">
            <div className="flex justify-between items-center mb-3">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest">
                <Activity className="w-4 h-4 text-rose-500" /> CARGA COGNITIVA
              </span>
            </div>
            <div className="h-3 w-full bg-zinc-950 rounded-full overflow-hidden shadow-inner flex items-center">
              <div
                ref={fatigueRef}
                className="h-full bg-rose-500 w-0 rounded-full transition-[width] duration-300 ease-out shadow-[0_0_15px_rgba(244,63,94,0.6)]"
              />
            </div>
          </div>

          <div className="bg-zinc-900 p-5 rounded-3xl shadow-xl border border-zinc-800/50 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-[10px] sm:text-xs text-zinc-400 flex items-center gap-2 tracking-widest">
                <BrainCircuit className="w-4 h-4 text-cyan-400" /> RED NEURONAL IA
              </span>
              <span className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase tracking-wider">
                TF.js 4.22
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold font-mono text-white tracking-wide">
                {aiPrediction ? aiPrediction.className : (isAIBrainReady ? 'ENFOQUE' : 'CALIBRANDO')}
              </span>
              <span className="text-xs font-mono text-zinc-400 font-semibold">
                {aiPrediction ? `${(aiPrediction.confidence * 100).toFixed(0)}% Conf.` : (isAIBrainReady ? '100%' : 'Listo')}
              </span>
            </div>
            <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                style={{ width: `${aiPrediction ? Math.round(aiPrediction.confidence * 100) : (isAIBrainReady ? 100 : 50)}%` }}
              />
            </div>
          </div>
        </div>

        {/* WORKSPACE: Camera & Quick Chat */}
        <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
          {/* FocusBud Viewport */}
          <div className="relative rounded-3xl overflow-hidden bg-zinc-950 flex-[3] flex flex-col items-center justify-center flex-1 w-full min-h-[420px] p-4 shadow-2xl border border-zinc-900">
            {/* Hidden native video and canvas elements for background MediaPipe & TensorFlow.js */}
            <video ref={videoRef} className="hidden" playsInline autoPlay muted />
            <canvas ref={canvasRef} width={1280} height={720} className="hidden" />

            {/* Protagonista Visual: FocusBud Robot con Bocadillo Empático Estilizado */}
            <div className="relative z-10 flex flex-col items-center justify-center w-full h-full my-auto py-8">
              <FocusBudWidget
                state={currentFocusState}
                message={budMessage}
              />
            </div>

            {/* Barra Inferior: Estado de Inferencia y Botón de Recalibrar */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 z-20 pointer-events-auto">
              <span className="px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md font-mono text-[10px] text-zinc-400 flex items-center gap-2 shadow-2xl">
                <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-blue-500' : 'bg-red-500 animate-pulse'}`} /> {isPaused ? 'EN PAUSA' : 'INFERENCIA ACTIVA (TF.js)'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerTestGrounding}
                  className="px-2.5 py-1 rounded text-[10px] font-mono tracking-wider uppercase bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 hover:text-emerald-200 border border-emerald-800/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Simular descanso para probar ejercicios de grounding"
                >
                  <span>☕</span> {timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK' ? 'VOLVER AL ENFOQUE' : 'PROBAR GROUNDING'}
                </button>

                <button
                  onClick={() => handleRecalibrate(false)}
                  className="px-2.5 py-1 rounded text-[10px] font-mono tracking-wider uppercase bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 border border-zinc-700/40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg"
                  title="Reiniciar calibración biométrica"
                >
                  <span>🔄</span> RECALIBRAR IA
                </button>
              </div>
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
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h2 className="text-white text-lg tracking-tight font-medium flex items-center gap-2">
                  Mentor IA Autónomo
                </h2>
                <p className="text-xs font-mono text-zinc-500 truncate max-w-[180px]">OBJ: {task}</p>
              </div>
            </div>
            {/* Timer & Pause Controls */}
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center justify-center w-10 h-10 rounded-xl shadow-lg border transition-colors cursor-pointer ${isPaused ? 'bg-blue-500 border-blue-400 text-black' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-300'
                  }`}
                title="Pausar / Reanudar (Tecla Q)"
              >
                {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
              </button>

              {/* HUD Pomodoro con Indicador de Estado */}
              <div className={`flex items-center gap-2 px-3 py-1.5 bg-black border rounded-xl transition-all ${
                timerMode === 'WORK'
                  ? isPaused ? 'border-zinc-800 opacity-60' : 'border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                  : 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              }`}>
                <div className="flex flex-col items-end leading-tight">
                  <span className={`text-[9px] font-mono font-bold tracking-wider uppercase flex items-center gap-1 ${
                    timerMode === 'WORK' ? 'text-green-400' : 'text-emerald-400'
                  }`}>
                    {timerMode === 'WORK' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        🟢 ENFOQUE | BLOQUE {Math.min(completedBlocks + 1, totalTargetBlocks)}/{totalTargetBlocks}
                      </>
                    ) : (
                      <>
                        ☕ DESCANSO
                      </>
                    )}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Timer className={`w-4 h-4 ${timerMode === 'WORK' ? (isPaused ? 'text-zinc-600' : 'text-green-500 animate-pulse') : 'text-emerald-400 animate-pulse'}`} />
                    <span className={`font-mono text-lg tracking-[0.15em] font-bold ${
                      timerMode === 'WORK'
                        ? isPaused ? 'text-zinc-600' : 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                        : 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    }`}>
                      {formatTime(timerSecondsLeft)}
                    </span>
                  </div>
                </div>

                {/* Botón de configuración de bloques */}
                <button
                  onClick={() => setIsTimerConfigOpen(!isTimerConfigOpen)}
                  className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                  title="Ajustar minutos de enfoque / descanso"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Popover de Ajuste Rápido Pomodoro */}
              <AnimatePresence>
                {isTimerConfigOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    className="absolute right-0 top-14 z-50 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-2xl p-3 shadow-2xl w-64 text-xs space-y-2 select-none"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-800 text-[11px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                      <span>Calibrar Pomodoro</span>
                      <button onClick={() => setIsTimerConfigOpen(false)} className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer">✕</button>
                    </div>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => {
                          setWorkDuration(25 * 60);
                          setBreakDuration(5 * 60);
                          if (timerMode === 'WORK') setTimerSecondsLeft(25 * 60);
                          else setTimerSecondsLeft(5 * 60);
                          setIsTimerConfigOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex justify-between items-center cursor-pointer ${
                          workDuration === 25 * 60 && breakDuration === 5 * 60
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'hover:bg-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs">25 min / 5 min</div>
                          <div className="text-[10px] text-zinc-500">Pomodoro Clásico</div>
                        </div>
                        <span className="text-[11px] font-mono text-emerald-400 font-bold">25/5</span>
                      </button>
                      <button
                        onClick={() => {
                          setWorkDuration(40 * 60);
                          setBreakDuration(10 * 60);
                          if (timerMode === 'WORK') setTimerSecondsLeft(40 * 60);
                          else setTimerSecondsLeft(10 * 60);
                          setIsTimerConfigOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex justify-between items-center cursor-pointer ${
                          workDuration === 40 * 60 && breakDuration === 10 * 60
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'hover:bg-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs">40 min / 10 min</div>
                          <div className="text-[10px] text-zinc-500">Deep Work Moderado</div>
                        </div>
                        <span className="text-[11px] font-mono text-cyan-400 font-bold">40/10</span>
                      </button>
                      <button
                        onClick={() => {
                          setWorkDuration(50 * 60);
                          setBreakDuration(10 * 60);
                          if (timerMode === 'WORK') setTimerSecondsLeft(50 * 60);
                          else setTimerSecondsLeft(10 * 60);
                          setIsTimerConfigOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex justify-between items-center cursor-pointer ${
                          workDuration === 50 * 60 && breakDuration === 10 * 60
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'hover:bg-zinc-800/80 text-zinc-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs">50 min / 10 min</div>
                          <div className="text-[10px] text-zinc-500">Sprint Extendido</div>
                        </div>
                        <span className="text-[11px] font-mono text-purple-400 font-bold">50/10</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between overflow-y-auto no-scrollbar">
            {timerMode === 'SHORT_BREAK' || timerMode === 'LONG_BREAK' ? (
              <GroundingBreak
                remainingSeconds={timerSecondsLeft}
                onSkipBreak={handleSkipBreak}
                formatTime={formatTime}
              />
            ) : currentStepIdx < steps.length ? (
              <div className="flex-1 flex flex-col justify-between">
                {/* a) Insignia de Progreso y Barra Delgada */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span className="font-semibold tracking-wider text-zinc-300">
                      PASO {currentStepIdx + 1} DE {steps.length}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {Math.round((currentStepIdx / steps.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.round((currentStepIdx / steps.length) * 100))}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* b) Tarjeta de Acción Única */}
                <div className="my-auto py-6 flex items-center justify-center flex-1">
                  <AnimatePresence mode="wait">
                    {(() => {
                      const activeStepText = steps[currentStepIdx] || '';
                      const isSomaticPause = /^PAUSA(\s+SOMÁTICA)?/i.test(activeStepText);

                      return (
                        <motion.div
                          key={currentStepIdx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.25, ease: "easeOut" }}
                          className={`w-full p-8 rounded-3xl backdrop-blur-sm flex flex-col items-center justify-center text-center relative group transition-all duration-300 ${
                            isSomaticPause
                              ? 'bg-gradient-to-b from-amber-950/30 via-zinc-950/90 to-zinc-950 border border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/20'
                              : 'bg-zinc-950/70 border border-zinc-800/80 shadow-2xl hover:border-emerald-500/30'
                          }`}
                        >
                          {isSomaticPause ? (
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-semibold uppercase tracking-wider mb-5 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                              Pausa Somática / Biorregulación
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono font-medium uppercase tracking-wider mb-5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Paso Activo
                            </div>
                          )}

                          <p className={`text-xl sm:text-2xl font-semibold leading-relaxed tracking-tight max-w-md break-words select-text ${
                            isSomaticPause ? 'text-amber-100 font-medium' : 'text-white'
                          }`}>
                            {activeStepText}
                          </p>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>
                </div>

                {/* c) Botón de Completado */}
                {(() => {
                  const activeStepText = steps[currentStepIdx] || '';
                  const isSomaticPause = /^PAUSA(\s+SOMÁTICA)?/i.test(activeStepText);

                  return (
                    <div className="pt-2">
                      <button
                        onClick={handleNextStep}
                        className={`w-full py-5 font-black text-lg rounded-2xl transition-all flex items-center justify-center gap-2 relative group overflow-hidden active:scale-[0.99] cursor-pointer ${
                          isSomaticPause
                            ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                            : 'bg-green-500 hover:bg-green-400 text-black shadow-[0_0_30px_rgba(34,197,94,0.2)]'
                        }`}
                      >
                        {isShowingReward ? "¡VAMOS!" : isSomaticPause ? "CONCLUIR PAUSA Y CONTINUAR ▶️" : "COMPLETAR PASO"}
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                      </button>
                      <p className="text-[10px] uppercase tracking-wider font-mono text-center text-zinc-500 mt-3">
                        {isSomaticPause ? "Respira hondo y regresa cuando estés listo" : "Pulsa para recuperar dopamina"}
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : steps.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="my-auto p-8 rounded-3xl bg-zinc-950/80 border border-emerald-500/30 text-center flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(16,185,129,0.15)] relative overflow-hidden backdrop-blur-md"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none" />

                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1 shadow-[0_0_25px_rgba(16,185,129,0.25)]">
                  <Sparkles className="w-8 h-8 animate-pulse text-emerald-400" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-black text-2xl sm:text-3xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-green-300 to-teal-200">
                    ¡SESIÓN COMPLETADA!
                  </h3>
                </div>

                <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal max-w-xs">
                  Has completado todos los bloques de la tarea con éxito.
                </p>

                <div className="px-4 py-2 rounded-xl bg-zinc-900/80 border border-zinc-800 font-mono text-xs text-zinc-400 flex items-center gap-2 my-1">
                  <Timer className="w-4 h-4 text-emerald-400" />
                  <span>Tiempo total: <strong className="text-white">{formatTime(elapsedTime)}</strong></span>
                </div>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full mt-2 py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] active:scale-[0.99] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                >
                  INICIAR NUEVA SESIÓN
                </button>
              </motion.div>
            ) : null}
          </div>
        </div>
      </div>
      {renderGlobalSettings()}
    </div>
  );
}
