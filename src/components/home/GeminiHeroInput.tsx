import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Zap,
  Target,
  Layers,
  Menu,
  CheckCircle2,
  Rocket,
  RotateCcw,
  Wrench,
  AlertTriangle,
  Mic,
  MicOff,
  Lightbulb,
  Network,
  HelpCircle,
  Table2,
  Volume2,
  PanelRightOpen,
  PanelRightClose
} from 'lucide-react';
import { FocusBudLiving } from '../avatar/FocusBudLiving';
import { useSettings } from '../../context/SettingsContext';
import {
  probeTaskContext,
  generateBrianTracy50Ideas,
  generateTaskFlowDiagram,
  taskSurveyUniversal,
  splitTaskUniversal
} from '../../services/metaModelClient';
import { audioService } from '../../services/audioService';
import {
  PreFocusStage,
  ExtractedContextState,
  StudioArtifactItem,
  StudioArtifactType,
  BrianTracyCategory,
  BrianTracyIdeaItem,
  TaskFlowDiagramData
} from '../../types/studioTypes';

interface GeminiHeroInputProps {
  task: string;
  setTask: (t: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onLaunchFocusSession?: (finalTask: string, customSteps?: string[], contextSummary?: string) => void;
  geminiApiKey?: string;
  isLoading: boolean;
  isSurveyLoading: boolean;
  workMode: 'pantalla' | 'lectura' | 'flexible';
  setWorkMode: (m: 'pantalla' | 'lectura' | 'flexible') => void;
  sensitivity: 'estricto' | 'normal' | 'relajado';
  setSensitivity: (s: 'estricto' | 'normal' | 'relajado') => void;
  onOpenSettings?: () => void;
  onToggleSidebar?: () => void;
}

function cleanGoalInput(raw: string): string {
  let cleaned = String(raw || '').trim();
  for (let i = 0; i < 3; i++) {
    cleaned = cleaned
      .replace(/^(hola(\s+chat|\s+bot|\s+focusbud)?[,.\s]*)/i, '')
      .replace(/^(buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hey|hi|hello)[,.\s]*/i, '')
      .replace(/^(hoy|ahora(\s+mismo)?|ahorita|este\s+d[ií]a|pues|bueno|mira|oye)[,.\s]+/i, '')
      .replace(/^(quiero|necesito|quisiera|me\s+gustar[ií]a|voy\s+a|tengo\s+que|debo|hay\s+que)\s+/i, '')
      .trim();
  }
  if (!cleaned) return String(raw || '').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export const GeminiHeroInput: React.FC<GeminiHeroInputProps> = ({
  task,
  setTask,
  onSubmit,
  onLaunchFocusSession,
  geminiApiKey,
  isLoading,
  isSurveyLoading,
  onOpenSettings,
  onToggleSidebar
}) => {
  const { t, language } = useSettings();

  // Isolated Pre-Focus State Machine
  const [preFocusStage, setPreFocusStage] = useState<PreFocusStage>('IDLE');
  const [isProbing, setIsProbing] = useState(false);
  const [probeInput, setProbeInput] = useState('');
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]);
  const [extractedContext, setExtractedContext] = useState<ExtractedContextState>({
    whatGoal: null,
    howMethod: null,
    mainBlocker: null,
    completenessScore: 0,
    rawVoiceDumps: [],
    chatHistory: []
  });

  // NotebookLM-style Studio & In-Chat Interactive Function States
  const [studioArtifacts, setStudioArtifacts] = useState<StudioArtifactItem[]>([]);
  const [isStudioDrawerOpen, setIsStudioDrawerOpen] = useState(false);
  const [activeGeneratingType, setActiveGeneratingType] = useState<StudioArtifactType | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ pct: number; label: string }>({
    pct: 0,
    label: ''
  });

  // Interactive states for Brian Tracy 50 Ideas & In-Chat Quiz inside messages
  const [tracyFilter, setTracyFilter] = useState<'ALL' | BrianTracyCategory>('ALL');
  const [tracyPage, setTracyPage] = useState<number>(0);
  const [quizSelections, setQuizSelections] = useState<Record<string, string>>({});

  // Asymmetric Voice Venting (STT) State
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [extractedContext.chatHistory.length, isProbing, activeGeneratingType]);

  const quickPrompts = [
    {
      icon: Target,
      label: t.hero.quickPrompts.focusModeLabel,
      text: t.hero.quickPrompts.focusModeText,
      color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/30'
    },
    {
      icon: Zap,
      label: t.hero.quickPrompts.sprintLabel,
      text: t.hero.quickPrompts.sprintText,
      color: 'from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-500/30'
    },
    {
      icon: Layers,
      label: t.hero.quickPrompts.atomicLabel,
      text: t.hero.quickPrompts.atomicText,
      color: 'from-purple-500/20 to-purple-500/5 text-purple-300 border-purple-500/30'
    },
    {
      icon: BookOpen,
      label: t.hero.quickPrompts.readingLabel,
      text: t.hero.quickPrompts.readingText,
      color: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300 border-cyan-500/30'
    }
  ];

  // Toggle Voice-for-Venting (Web Speech API)
  const toggleVoiceCapture = () => {
    if (isListeningVoice && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListeningVoice(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = language === 'es' ? 'es-MX' : 'en-US';
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => setIsListeningVoice(true);
      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (preFocusStage === 'IDLE') {
          setTask(transcript);
        } else {
          setProbeInput(transcript);
        }
      };
      rec.onerror = () => setIsListeningVoice(false);
      rec.onend = () => setIsListeningVoice(false);

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  /**
   * Executes any Studio function in real time and embeds the interactive widget
   * directly inside FocusBud's chat conversation AND the Studio panel.
   */
  const handleTriggerStudioFunction = async (
    type: StudioArtifactType,
    overrideCtx?: ExtractedContextState
  ) => {
    if (activeGeneratingType) return;
    const ctx = overrideCtx || extractedContext;
    const rawGoal =
      ctx.whatGoal ||
      task.trim() ||
      (language === 'es' ? 'Sesión de estudio enfocada' : 'Focused study session');
    const activeGoal = cleanGoalInput(rawGoal);
    const activeMethod =
      ctx.howMethod || (language === 'es' ? 'Práctica activa y apuntes' : 'Active practice & notes');
    const activeBlocker =
      ctx.mainBlocker || (language === 'es' ? 'Inercia inicial' : 'Starting inertia');

    setPreFocusStage('CONTEXT_PROBING');
    setActiveGeneratingType(type);
    setGenerationProgress({
      pct: 12,
      label:
        language === 'es'
          ? 'Conectando con motor cognitivo NeuroSynk...'
          : 'Connecting to NeuroSynk cognitive engine...'
    });

    try {
      let artifact: StudioArtifactItem | null = null;
      let botIntro = '';

      if (type === 'BRIAN_TRACY_50') {
        const ideas = await generateBrianTracy50Ideas(
          activeGoal,
          activeMethod,
          activeBlocker,
          geminiApiKey,
          (pct, label) => setGenerationProgress({ pct, label })
        );
        artifact = {
          id: `art-bt-${Date.now()}`,
          type: 'BRIAN_TRACY_50',
          title:
            language === 'es'
              ? `50 Ideas Brian Tracy: ${activeGoal}`
              : `50 Brian Tracy Ideas: ${activeGoal}`,
          subtitle:
            language === 'es'
              ? 'Selecciona tus mejores ideas para convertirlas en micro-pasos'
              : 'Select top ideas to convert into your micro-steps',
          createdAt: Date.now(),
          status: 'ready',
          progressPct: 100,
          data: ideas
        };
        botIntro =
          language === 'es'
            ? `💡 Generé 50 ideas accionables (Método Brian Tracy) para "${activeGoal}". Filtra por categoría o selecciona tus favoritas para iniciar el Modo Estudio:`
            : `💡 Generated 50 actionable Brian Tracy ideas for "${activeGoal}". Filter by category or select your favorites to launch into Focus Mode:`;
      } else if (type === 'MINDMAP_FLOW') {
        setGenerationProgress({
          pct: 55,
          label:
            language === 'es'
              ? 'Construyendo nodos del Mapa Mental y Ruta Crítica...'
              : 'Building Mindmap nodes & Critical Path...'
        });
        const diagram = await generateTaskFlowDiagram(
          activeGoal,
          activeMethod,
          activeBlocker,
          geminiApiKey
        );
        setGenerationProgress({ pct: 100, label: '100%' });
        artifact = {
          id: `art-flow-${Date.now()}`,
          type: 'MINDMAP_FLOW',
          title: diagram.title,
          subtitle:
            language === 'es'
              ? 'Flujo visual de 5 nodos con ruta crítica'
              : '5-node visual flow with critical path',
          createdAt: Date.now(),
          status: 'ready',
          progressPct: 100,
          data: diagram
        };
        botIntro =
          language === 'es'
            ? `🕸️ Aquí tienes el Mapa Mental y Flujo de Ejecución para "${activeGoal}":`
            : `🕸️ Here is the Mindmap & Execution Flow for "${activeGoal}":`;
      } else if (type === 'CALIBRATION_QUIZ') {
        setGenerationProgress({
          pct: 60,
          label:
            language === 'es'
              ? 'Generando cuestionario de calibración con IA...'
              : 'Generating AI calibration quiz...'
        });
        const surveyRes = await taskSurveyUniversal(activeGoal, geminiApiKey);
        setGenerationProgress({ pct: 100, label: '100%' });
        artifact = {
          id: `art-quiz-${Date.now()}`,
          type: 'CALIBRATION_QUIZ',
          title:
            language === 'es'
              ? `Cuestionario Estratégico: ${activeGoal}`
              : `Strategic Quiz: ${activeGoal}`,
          subtitle:
            language === 'es'
              ? 'Responde aquí mismo en el chat para personalizar tus pasos'
              : 'Answer right inside the chat to tailor your steps',
          createdAt: Date.now(),
          status: 'ready',
          progressPct: 100,
          data: surveyRes.questions || []
        };
        botIntro =
          language === 'es'
            ? `❓ Preparé este cuestionario interactivo dentro del chat para calibrar "${activeGoal}":`
            : `❓ I prepared this interactive in-chat calibration quiz for "${activeGoal}":`;
      } else if (type === 'MICRO_STEPS_TABLE') {
        setGenerationProgress({
          pct: 65,
          label:
            language === 'es'
              ? 'Diseñando tabla de micro-pasos con IA...'
              : 'Designing AI micro-steps table...'
        });
        const contextStr = `Goal: ${activeGoal} | Method: ${activeMethod} | Blocker: ${activeBlocker}`;
        const splitRes = await splitTaskUniversal(
          activeGoal,
          quizSelections,
          contextStr,
          geminiApiKey
        );
        setGenerationProgress({ pct: 100, label: '100%' });
        artifact = {
          id: `art-table-${Date.now()}`,
          type: 'MICRO_STEPS_TABLE',
          title:
            language === 'es'
              ? `Tabla de Micro-pasos: ${activeGoal}`
              : `Micro-Steps Table: ${activeGoal}`,
          subtitle:
            language === 'es'
              ? 'Plan táctico listo para ejecutar en Modo Estudio'
              : 'Tactical plan ready to execute in Focus Mode',
          createdAt: Date.now(),
          status: 'ready',
          progressPct: 100,
          data: splitRes.steps || []
        };
        botIntro =
          language === 'es'
            ? `📊 Aquí tienes la tabla táctica de micro-pasos para "${activeGoal}":`
            : `📊 Here is the tactical micro-steps table for "${activeGoal}":`;
      } else if (type === 'AUDIO_BRIEF') {
        const audioScript =
          language === 'es'
            ? `Resumen ejecutivo NeuroSynk. Tu meta actual es ${activeGoal}. Trabajaremos mediante ${activeMethod}, neutralizando ${activeBlocker} con bloques de enfoque de veinticinco minutos y micro-pasos atómicos. Cuando estés listo, presiona Dividir en Micro-pasos.`
            : `NeuroSynk executive audio briefing. Your active goal is ${activeGoal}. We will execute using ${activeMethod}, neutralizing ${activeBlocker} with twenty-five minute focus blocks and atomic micro-steps. Whenever you are ready, press Split into Micro-steps.`;
        setGenerationProgress({ pct: 100, label: '100%' });
        artifact = {
          id: `art-audio-${Date.now()}`,
          type: 'AUDIO_BRIEF',
          title:
            language === 'es'
              ? `Resumen en Audio: ${activeGoal}`
              : `Audio Briefing: ${activeGoal}`,
          createdAt: Date.now(),
          status: 'ready',
          progressPct: 100,
          data: { script: audioScript }
        };
        botIntro =
          language === 'es'
            ? `🎧 Resumen en audio generado para "${activeGoal}":`
            : `🎧 Executive audio briefing generated for "${activeGoal}":`;
        audioService.speak(audioScript);
      }

      if (artifact) {
        setStudioArtifacts(prev => [artifact!, ...prev]);
        const botMsg = {
          id: `msg-art-${Date.now()}`,
          role: 'assistant' as const,
          content: botIntro,
          timestamp: Date.now(),
          artifact
        };
        setExtractedContext(prev => ({
          ...prev,
          whatGoal: prev.whatGoal || activeGoal,
          chatHistory: [...prev.chatHistory, botMsg]
        }));
      }
    } finally {
      setActiveGeneratingType(null);
    }
  };

  /**
   * Detects if the user typed a natural-language command asking for one of the Studio functions
   * right inside the chat input.
   */
  const detectDirectFunctionCommand = (text: string): StudioArtifactType | null => {
    const lower = text.toLowerCase();
    if (/\b(50\s*ideas|brian\s*tracy|lluvia\s*de\s*ideas|50\s*formas)\b/i.test(lower)) {
      return 'BRIAN_TRACY_50';
    }
    if (/\b(mapa\s*mental|diagrama|mind\s*map|flujo\s*visual|flowchart)\b/i.test(lower)) {
      return 'MINDMAP_FLOW';
    }
    if (/\b(cuestionario|encuesta|quiz|preguntas\s*de\s*calibraci[oó]n)\b/i.test(lower)) {
      return 'CALIBRATION_QUIZ';
    }
    if (/\b(tabla\s*de\s*datos|tabla\s*de\s*pasos|generar\s*pasos\s*aqu[ií]|ver\s*micro-?pasos)\b/i.test(lower)) {
      return 'MICRO_STEPS_TABLE';
    }
    if (/\b(resumen\s*en\s*audio|audio\s*brief|l[eé]elo\s*en\s*voz\s*alta)\b/i.test(lower)) {
      return 'AUDIO_BRIEF';
    }
    return null;
  };

  const runSurgicalProbe = async (userText: string, currentCtx: ExtractedContextState) => {
    const cleanText = userText.trim();
    if (!cleanText || isProbing || activeGeneratingType) return;

    const userMsg = {
      id: `msg-u-${Date.now()}`,
      role: 'user' as const,
      content: cleanText,
      modality: 'keyboard_precision' as const,
      timestamp: Date.now()
    };

    const updatedWithUser: ExtractedContextState = {
      ...currentCtx,
      chatHistory: [...currentCtx.chatHistory, userMsg]
    };

    setExtractedContext(updatedWithUser);
    setPreFocusStage('CONTEXT_PROBING');

    // Check if the user directly asked the chatbot to create one of the Studio functions inside the chat
    const requestedFn = detectDirectFunctionCommand(cleanText);
    if (requestedFn) {
      await handleTriggerStudioFunction(requestedFn, updatedWithUser);
      return;
    }

    setIsProbing(true);

    try {
      const probeRes = await probeTaskContext(cleanText, currentCtx, geminiApiKey);
      const botMsg = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant' as const,
        content: probeRes.reply,
        timestamp: Date.now(),
        suggestedChips: probeRes.suggestedKeyboardChips,
        targetField: probeRes.extracted.nextTargetField
      };

      const cleanedWhatGoal = probeRes.extracted.whatGoal
        ? cleanGoalInput(probeRes.extracted.whatGoal)
        : updatedWithUser.whatGoal;

      const nextCtx: ExtractedContextState = {
        ...updatedWithUser,
        whatGoal: cleanedWhatGoal,
        howMethod: probeRes.extracted.howMethod || updatedWithUser.howMethod,
        mainBlocker: probeRes.extracted.mainBlocker || updatedWithUser.mainBlocker,
        completenessScore: probeRes.extracted.completenessScore,
        chatHistory: [...updatedWithUser.chatHistory, botMsg]
      };

      setExtractedContext(nextCtx);
      if (cleanedWhatGoal) {
        setTask(cleanedWhatGoal);
      }
      setSuggestedChips(probeRes.suggestedKeyboardChips || []);
    } finally {
      setIsProbing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeText = preFocusStage === 'IDLE' ? task.trim() : probeInput.trim();
    if (!activeText || isLoading || isSurveyLoading || isProbing || activeGeneratingType) return;

    if (preFocusStage === 'IDLE') {
      await runSurgicalProbe(activeText, extractedContext);
    } else {
      setProbeInput('');
      await runSurgicalProbe(activeText, extractedContext);
    }
  };

  const handleLaunchMicroStepsNow = (customSteps?: string[]) => {
    const rawGoal =
      extractedContext.whatGoal ||
      task.trim() ||
      (language === 'es' ? 'Sesión de enfoque' : 'Focus session');
    const finalGoal = cleanGoalInput(rawGoal);
    const contextSummary = [
      extractedContext.whatGoal ? `Meta (QUÉ): ${finalGoal}` : '',
      extractedContext.howMethod ? `Método/Herramientas (CÓMO): ${extractedContext.howMethod}` : '',
      extractedContext.mainBlocker ? `Bloqueo Principal: ${extractedContext.mainBlocker}` : ''
    ]
      .filter(Boolean)
      .join(' | ');

    if (onLaunchFocusSession) {
      onLaunchFocusSession(finalGoal, customSteps, contextSummary);
    } else {
      onSubmit();
    }
  };

  const handleToggleTracyIdea = (artifactId: string, ideaId: number) => {
    const toggleList = (list: BrianTracyIdeaItem[]) =>
      list.map(item => (item.id === ideaId ? { ...item, selected: !item.selected } : item));

    setStudioArtifacts(prev =>
      prev.map(art => (art.id === artifactId ? { ...art, data: toggleList(art.data) } : art))
    );
    setExtractedContext(prev => ({
      ...prev,
      chatHistory: prev.chatHistory.map(msg =>
        msg.artifact && msg.artifact.id === artifactId
          ? { ...msg, artifact: { ...msg.artifact, data: toggleList(msg.artifact.data) } }
          : msg
      )
    }));
  };

  const handleResetPreFocus = () => {
    setPreFocusStage('IDLE');
    setProbeInput('');
    setSuggestedChips([]);
    setStudioArtifacts([]);
    setExtractedContext({
      whatGoal: null,
      howMethod: null,
      mainBlocker: null,
      completenessScore: 0,
      rawVoiceDumps: [],
      chatHistory: []
    });
  };

  const handleChipClick = (presetText: string) => {
    if (preFocusStage === 'IDLE') {
      setTask(presetText);
      runSurgicalProbe(presetText, extractedContext);
    } else {
      runSurgicalProbe(presetText, extractedContext);
    }
  };

  // Renders an interactive Studio Artifact cleanly without text overflow
  const renderInteractiveArtifact = (art: StudioArtifactItem, isCompact: boolean = false) => {
    if (art.type === 'BRIAN_TRACY_50') {
      const ideas: BrianTracyIdeaItem[] = Array.isArray(art.data) ? art.data : [];
      const filtered =
        tracyFilter === 'ALL' ? ideas : ideas.filter(i => i.category === tracyFilter);
      const pageSize = isCompact ? 4 : 5;
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const safePage = Math.min(tracyPage, totalPages - 1);
      const visibleIdeas = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
      const selectedIdeas = ideas.filter(i => i.selected);

      return (
        <div className="mt-2.5 p-3 rounded-xl bg-zinc-900/95 border border-emerald-500/30 space-y-2.5 text-left overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-mono text-[11px] font-bold text-white uppercase break-words">
                {art.title}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
              {selectedIdeas.length}{' '}
              {language === 'es' ? 'seleccionadas' : 'selected'} / {ideas.length}
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: language === 'es' ? 'Todas (50)' : 'All (50)' },
              { id: 'quick_win', label: language === 'es' ? '⚡ Victoria Rápida' : '⚡ Quick Win' },
              { id: 'pareto_20', label: language === 'es' ? '🎯 Pareto 80/20' : '🎯 Pareto 80/20' },
              { id: 'unblocker', label: language === 'es' ? '🔓 Desbloqueo' : '🔓 Unblocker' },
              { id: 'creative_leap', label: language === 'es' ? '🚀 Salto Creativo' : '🚀 Creative Leap' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setTracyFilter(tab.id as any);
                  setTracyPage(0);
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-colors cursor-pointer ${
                  tracyFilter === tab.id
                    ? 'bg-emerald-500 text-zinc-950 font-bold'
                    : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Paginated Ideas List */}
          <div className="space-y-1.5">
            {visibleIdeas.map(idea => (
              <button
                key={idea.id}
                type="button"
                onClick={() => handleToggleTracyIdea(art.id, idea.id)}
                className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-start gap-2 cursor-pointer ${
                  idea.selected
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-100'
                    : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-emerald-400 shrink-0 mt-0.5">
                  #{idea.id}
                </span>
                <span className="flex-1 leading-snug break-words">{idea.text}</span>
                <span className="text-[10px] font-mono text-amber-300 shrink-0">
                  ★{idea.impact}/5
                </span>
              </button>
            ))}
          </div>

          {/* Pagination + Launch Action */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setTracyPage(p => Math.max(0, p - 1))}
                className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-40 cursor-pointer"
              >
                ←
              </button>
              <span>
                {language === 'es' ? 'Pág' : 'Page'} {safePage + 1}/{totalPages}
              </span>
              <button
                type="button"
                disabled={safePage + 1 >= totalPages}
                onClick={() => setTracyPage(p => Math.min(totalPages - 1, p + 1))}
                className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 disabled:opacity-40 cursor-pointer"
              >
                →
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                handleLaunchMicroStepsNow(
                  selectedIdeas.length > 0 ? selectedIdeas.map(i => i.text) : undefined
                )
              }
              className="w-full sm:w-auto justify-center px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>
                {language === 'es'
                  ? `Iniciar Estudio con ${selectedIdeas.length || 4} Ideas`
                  : `Start Focus with ${selectedIdeas.length || 4} Ideas`}
              </span>
            </button>
          </div>
        </div>
      );
    }

    if (art.type === 'MINDMAP_FLOW') {
      const diagram: TaskFlowDiagramData = art.data;
      const nodes = diagram.nodes || [];
      return (
        <div className="mt-2.5 p-3 rounded-xl bg-zinc-900/95 border border-cyan-500/30 space-y-2.5 text-left overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Network className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-mono text-[11px] font-bold text-white uppercase break-words">
                {diagram.title}
              </span>
            </div>
          </div>

          {/* Responsive 1 or 2-column grid so nodes NEVER squish or overflow text */}
          <div className={`grid grid-cols-1 ${isCompact ? ' gap-2' : 'sm:grid-cols-2 gap-2.5'}`}>
            {nodes.map((node, idx) => (
              <div
                key={node.id || idx}
                className={`p-3 rounded-xl bg-zinc-950/90 border border-zinc-800 flex flex-col justify-between gap-1.5 ${
                  !isCompact && idx === nodes.length - 1 && nodes.length % 2 === 1
                    ? 'sm:col-span-2'
                    : ''
                }`}
              >
                <div className="text-[10px] font-mono text-cyan-400 font-bold flex items-center justify-between">
                  <span>
                    {language === 'es' ? `NODO #${idx + 1}` : `NODE #${idx + 1}`}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                    {node.estimatedMinutes} min
                  </span>
                </div>
                <div className="text-xs font-semibold text-white leading-snug break-words">
                  {node.label}
                </div>
                <div className="text-[11px] text-zinc-400 leading-snug break-words">
                  {node.detail}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() =>
                handleLaunchMicroStepsNow(
                  nodes.map(n => `${n.label}: ${n.detail}`)
                )
              }
              className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>
                {language === 'es'
                  ? 'Ejecutar este Flujo en Modo Estudio'
                  : 'Execute this Flow in Focus Mode'}
              </span>
            </button>
          </div>
        </div>
      );
    }

    if (art.type === 'CALIBRATION_QUIZ') {
      const questions: { id: string; question: string; options: string[] }[] = Array.isArray(
        art.data
      )
        ? art.data
        : [];
      return (
        <div className="mt-2.5 p-3 rounded-xl bg-zinc-900/95 border border-purple-500/30 space-y-2.5 text-left overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 min-w-0">
            <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="font-mono text-[11px] font-bold text-white uppercase break-words">
              {art.title}
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            {questions.slice(0, 4).map((q, idx) => (
              <div key={q.id || idx} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5">
                <p className="text-xs font-medium text-zinc-200 leading-snug break-words">
                  {idx + 1}. {q.question}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(q.options || []).map((opt, oIdx) => {
                    const active = quizSelections[q.id] === opt;
                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => setQuizSelections(prev => ({ ...prev, [q.id]: opt }))}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] border text-left transition-all cursor-pointer break-words ${
                          active
                            ? 'bg-purple-500/25 border-purple-400 text-purple-200 font-semibold'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => handleTriggerStudioFunction('MICRO_STEPS_TABLE')}
              className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>
                {language === 'es'
                  ? 'Generar Tabla de Micro-pasos con mis Respuestas'
                  : 'Generate Micro-Steps Table from Answers'}
              </span>
            </button>
          </div>
        </div>
      );
    }

    if (art.type === 'MICRO_STEPS_TABLE') {
      const stepList: string[] = Array.isArray(art.data) ? art.data : [];
      return (
        <div className="mt-2.5 p-3 rounded-xl bg-zinc-900/95 border border-emerald-500/30 space-y-2.5 text-left overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Table2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-mono text-[11px] font-bold text-white uppercase break-words">
                {art.title}
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 shrink-0">
              {stepList.length} {language === 'es' ? 'pasos' : 'steps'}
            </span>
          </div>

          <div className="space-y-1.5">
            {stepList.map((st, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 flex items-start gap-2 text-xs text-zinc-200"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="flex-1 leading-snug break-words">{st}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => handleLaunchMicroStepsNow(stepList)}
              className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <Rocket className="w-3.5 h-3.5 shrink-0" />
              <span>
                {language === 'es'
                  ? '🚀 Iniciar Modo Estudio con estos Pasos'
                  : '🚀 Launch Focus Mode with these Steps'}
              </span>
            </button>
          </div>
        </div>
      );
    }

    if (art.type === 'AUDIO_BRIEF') {
      const script = art.data?.script || '';
      return (
        <div className="mt-2.5 p-3 rounded-xl bg-zinc-900/95 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left overflow-hidden">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-amber-300 uppercase">
              <Volume2 className="w-4 h-4 shrink-0" />
              <span className="break-words">{art.title}</span>
            </div>
            <p className="text-xs text-zinc-300 leading-snug break-words">{script}</p>
          </div>
          <button
            type="button"
            onClick={() => audioService.speak(script)}
            className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{language === 'es' ? 'Escuchar' : 'Listen'}</span>
          </button>
        </div>
      );
    }

    return null;
  };

  const isBusy = isLoading || isSurveyLoading || isProbing || Boolean(activeGeneratingType);

  return (
    <div className="relative min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col justify-between items-center px-4 pt-16 sm:pt-14 pb-8 overflow-x-hidden select-none">
      {/* Dynamic Background Glow Effect */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 65% 45% at 50% 22%, rgba(16, 185, 129, 0.11), rgba(168, 85, 247, 0.04) 45%, transparent 80%)'
        }}
      />

      {/* Top Bar Minimalist */}
      <header className="w-full max-w-6xl flex items-center justify-between z-10 px-2 sm:px-4 mb-2">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
              title={t.common.menu}
            >
              <Menu className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline font-mono text-[11px] text-zinc-400 font-medium">
                {t.common.menu}
              </span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/30 to-emerald-400/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-tight text-white whitespace-nowrap">
              NeuroSynk <span className="text-zinc-500 text-xs font-normal font-mono">{t.common.workspace}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsStudioDrawerOpen(prev => !prev)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-colors ${
              isStudioDrawerOpen
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-900/90 hover:bg-zinc-800 border-zinc-800 text-emerald-400'
            }`}
          >
            {isStudioDrawerOpen ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            <span>Studio ({studioArtifacts.length})</span>
          </button>
        </div>

        {/* Right spacer for fixed global controls */}
        <div className="w-64 hidden lg:block" />
      </header>

      {/* Main Responsive Section: Side-by-Side when Studio is Open (NEVER overlaps the chat) */}
      <main
        className={`w-full ${
          isStudioDrawerOpen ? 'max-w-6xl' : 'max-w-3xl'
        } flex flex-col items-center justify-center my-auto z-10 text-center px-2 sm:px-4 transition-all duration-300`}
      >
        <div
          className={`w-full ${
            isStudioDrawerOpen
              ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start'
              : 'flex flex-col items-center'
          }`}
        >
          {/* LEFT / CENTER COLUMN: Avatar + Chat + Capsule Input */}
          <div
            className={`w-full flex flex-col items-center ${
              isStudioDrawerOpen ? 'lg:col-span-7' : ''
            }`}
          >
            {/* Animated Living Mascot Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: -10 }}
              animate={{ opacity: 1, scale: preFocusStage === 'IDLE' ? 1 : 0.85, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`${preFocusStage === 'IDLE' ? 'mb-4' : 'mb-2'} flex flex-col items-center justify-center relative`}
            >
              <div className="relative group cursor-pointer" onClick={() => onOpenSettings?.()}>
                <FocusBudLiving
                  size={preFocusStage === 'IDLE' ? 116 : 78}
                  state={isBusy ? 'CELEBRACION' : 'ENFOQUE'}
                  isStreaming={isBusy}
                  isSpeaking={false}
                  isFlow={!isBusy}
                />
              </div>
            </motion.div>

            {preFocusStage === 'IDLE' ? (
              <>
                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3"
                >
                  {t.hero.titlePrefix}{' '}
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                    {t.hero.titleHighlight}
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm sm:text-base text-zinc-400 max-w-lg mb-6 font-normal leading-relaxed"
                >
                  {t.hero.subtitle}
                </motion.p>
              </>
            ) : (
              /* Surgical Pre-Focus Contextualization & In-Chat Studio Functions View */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full mb-4 text-left bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl overflow-hidden"
              >
                {/* Header + 3 Live Strategic Pillars (QUÉ, CÓMO, BLOQUEO) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span>
                        {language === 'es'
                          ? 'FASE 1: CONTEXTO + STUDIO EN CHAT'
                          : 'PHASE 1: CONTEXT + IN-CHAT STUDIO'}
                      </span>
                    </span>
                    <span className="text-xs font-mono text-zinc-400">
                      {extractedContext.completenessScore}%
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetPreFocus}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3 shrink-0" />
                      <span>{language === 'es' ? 'Reiniciar' : 'Reset'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLaunchMicroStepsNow()}
                      disabled={isLoading || isSurveyLoading}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                    >
                      <Rocket className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {language === 'es'
                          ? 'Dividir en Micro-pasos Ahora'
                          : 'Split into Micro-steps Now'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3 Context Status Pills */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <div
                    className={`px-3 py-2 rounded-xl border text-xs transition-all ${
                      extractedContext.whatGoal
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider mb-0.5">
                      <Target className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{language === 'es' ? '1. QUÉ (META)' : '1. WHAT (GOAL)'}</span>
                      {extractedContext.whatGoal && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto shrink-0" />
                      )}
                    </div>
                    <p className="font-medium break-words line-clamp-2">
                      {extractedContext.whatGoal ||
                        (language === 'es' ? 'Pendiente...' : 'Pending...')}
                    </p>
                  </div>

                  <div
                    className={`px-3 py-2 rounded-xl border text-xs transition-all ${
                      extractedContext.howMethod
                        ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider mb-0.5">
                      <Wrench className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{language === 'es' ? '2. CÓMO (MÉTODO)' : '2. HOW (METHOD)'}</span>
                      {extractedContext.howMethod && (
                        <CheckCircle2 className="w-3 h-3 text-cyan-400 ml-auto shrink-0" />
                      )}
                    </div>
                    <p className="font-medium break-words line-clamp-2">
                      {extractedContext.howMethod ||
                        (language === 'es' ? 'Pendiente...' : 'Pending...')}
                    </p>
                  </div>

                  <div
                    className={`px-3 py-2 rounded-xl border text-xs transition-all ${
                      extractedContext.mainBlocker
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider mb-0.5">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{language === 'es' ? '3. BLOQUEO ACTUAL' : '3. MAIN BLOCKER'}</span>
                      {extractedContext.mainBlocker && (
                        <CheckCircle2 className="w-3 h-3 text-amber-400 ml-auto shrink-0" />
                      )}
                    </div>
                    <p className="font-medium break-words line-clamp-2">
                      {extractedContext.mainBlocker ||
                        (language === 'es' ? 'Pendiente...' : 'Pending...')}
                    </p>
                  </div>
                </div>

                {/* In-Chat Studio Function Bar */}
                <div className="flex flex-wrap items-center gap-1.5 pb-3 mb-3 border-b border-zinc-800/80">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mr-1">
                    {language === 'es' ? 'Generar en este chat:' : 'Generate in chat:'}
                  </span>
                  <button
                    type="button"
                    disabled={Boolean(activeGeneratingType)}
                    onClick={() => handleTriggerStudioFunction('BRIAN_TRACY_50')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Lightbulb className="w-3 h-3 shrink-0" />
                    <span>{language === 'es' ? '50 Ideas Brian Tracy' : '50 Brian Tracy Ideas'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(activeGeneratingType)}
                    onClick={() => handleTriggerStudioFunction('MINDMAP_FLOW')}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Network className="w-3 h-3 shrink-0" />
                    <span>{language === 'es' ? 'Mapa Mental' : 'Mindmap Flow'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(activeGeneratingType)}
                    onClick={() => handleTriggerStudioFunction('CALIBRATION_QUIZ')}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <HelpCircle className="w-3 h-3 shrink-0" />
                    <span>{language === 'es' ? 'Cuestionario' : 'Quiz'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(activeGeneratingType)}
                    onClick={() => handleTriggerStudioFunction('MICRO_STEPS_TABLE')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Table2 className="w-3 h-3 shrink-0" />
                    <span>{language === 'es' ? 'Tabla de Micro-pasos' : 'Micro-steps Table'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(activeGeneratingType)}
                    onClick={() => handleTriggerStudioFunction('AUDIO_BRIEF')}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Volume2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{language === 'es' ? 'Resumen en Audio' : 'Audio Overview'}</span>
                  </button>
                </div>

                {/* Conversation Thread with Embedded Interactive Studio Widgets */}
                <div
                  ref={chatScrollRef}
                  className="max-h-[370px] overflow-y-auto space-y-2.5 pr-1 custom-scrollbar"
                >
                  <AnimatePresence initial={false}>
                    {extractedContext.chatHistory.map(msg => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`${
                            msg.artifact ? 'w-full' : 'max-w-[90%]'
                          } px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-snug overflow-hidden ${
                            msg.role === 'user'
                              ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-br-sm'
                              : 'bg-zinc-950/90 border border-zinc-800 text-zinc-100 rounded-bl-sm'
                          }`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-mono text-[10px] text-emerald-400 font-semibold">
                                FocusBud • NeuroSynk AI
                              </span>
                              <button
                                type="button"
                                onClick={() => audioService.speak(msg.content)}
                                className="text-[10px] font-mono text-zinc-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer shrink-0"
                                title={language === 'es' ? 'Escuchar respuesta' : 'Listen to reply'}
                              >
                                <Volume2 className="w-3 h-3" />
                                <span>{language === 'es' ? 'Voz' : 'Voice'}</span>
                              </button>
                            </div>
                          )}
                          <div className="break-words">{msg.content}</div>
                          {msg.artifact && renderInteractiveArtifact(msg.artifact, false)}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Progress Bar (0% -> 100%) when generating 50 Brian Tracy Ideas or Studio Functions */}
                  {activeGeneratingType && (
                    <div className="p-3 rounded-2xl bg-zinc-950/95 border border-emerald-500/40 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-emerald-300">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          {generationProgress.label}
                        </span>
                        <span className="font-bold">{generationProgress.pct}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400"
                          initial={{ width: '5%' }}
                          animate={{ width: `${generationProgress.pct}%` }}
                          transition={{ duration: 0.25 }}
                        />
                      </div>
                    </div>
                  )}

                  {isProbing && (
                    <div className="flex justify-start">
                      <div className="px-3.5 py-2 rounded-2xl bg-zinc-950/90 border border-zinc-800 text-xs text-emerald-400 font-mono flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        {language === 'es'
                          ? 'Analizando contexto con Google Gemini...'
                          : 'Analyzing context with Google Gemini...'}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Main Capsule Input Form with Asymmetric Voice + Keyboard */}
            <motion.form
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onSubmit={handleSubmit}
              className="w-full relative group"
            >
              <div className="relative flex items-center w-full rounded-2xl sm:rounded-3xl bg-zinc-900/95 border border-zinc-800/90 hover:border-zinc-700/80 focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:shadow-[0_0_35px_rgba(16,185,129,0.14)] transition-colors duration-200 p-2 sm:p-2.5 gap-1.5">
                <div className="pl-2 sm:pl-3 pr-1 text-zinc-500 group-focus-within:text-emerald-400 transition-colors">
                  <Sparkles className="w-5 h-5" />
                </div>

                <input
                  type="text"
                  autoFocus
                  spellCheck={false}
                  disabled={isBusy}
                  value={preFocusStage === 'IDLE' ? task : probeInput}
                  onChange={e =>
                    preFocusStage === 'IDLE' ? setTask(e.target.value) : setProbeInput(e.target.value)
                  }
                  placeholder={
                    preFocusStage === 'IDLE'
                      ? t.hero.inputPlaceholder
                      : t.hero.inputPlaceholderKeyboardPrecision
                  }
                  className="w-full bg-transparent text-white placeholder-zinc-500 text-sm sm:text-base px-2 py-3 focus:outline-none font-sans font-normal min-w-0"
                />

                {/* Voice Venting Button (STT) */}
                <button
                  type="button"
                  onClick={toggleVoiceCapture}
                  title={t.hero.inputPlaceholderVoiceActive}
                  className={`p-3 rounded-xl sm:rounded-2xl border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                    isListeningVoice
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                      : 'bg-zinc-800/90 hover:bg-zinc-800 border-zinc-700/70 text-zinc-300 hover:text-emerald-300'
                  }`}
                >
                  {isListeningVoice ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="submit"
                  disabled={!(preFocusStage === 'IDLE' ? task.trim() : probeInput.trim()) || isBusy}
                  className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                    (preFocusStage === 'IDLE' ? task.trim() : probeInput.trim()) && !isBusy
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                  title={t.hero.startTooltip}
                >
                  {isBusy ? (
                    <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 font-bold" />
                  )}
                </button>
              </div>

              {/* Morphing Feedback Indicator */}
              {(isLoading || isSurveyLoading) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 flex items-center justify-center gap-2.5 text-xs font-mono text-emerald-400 font-medium select-none"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{t.hero.syncingFeedback}</span>
                </motion.div>
              )}
            </motion.form>

            {/* Quick Suggestion Chips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: isBusy ? 0.5 : 1,
                y: 0,
                pointerEvents: isBusy ? 'none' : 'auto'
              }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="w-full flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-4"
            >
              {preFocusStage === 'IDLE'
                ? quickPrompts.map((prompt, idx) => {
                    const Icon = prompt.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleChipClick(prompt.text)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-gradient-to-b border transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer shadow-sm ${prompt.color}`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{prompt.label}</span>
                      </button>
                    );
                  })
                : suggestedChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-900/90 hover:bg-emerald-500/15 text-zinc-200 hover:text-emerald-300 border border-zinc-800 hover:border-emerald-500/40 transition-all cursor-pointer active:scale-95"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{chip}</span>
                    </button>
                  ))}
            </motion.div>
          </div>

          {/* RIGHT COLUMN: Side-by-Side NotebookLM-Style Studio Panel (Never covers the chat) */}
          <AnimatePresence>
            {isStudioDrawerOpen && (
              <motion.aside
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.22 }}
                className="w-full lg:col-span-5 bg-zinc-900/95 border border-zinc-800 rounded-2xl p-4 shadow-2xl flex flex-col justify-between text-left max-h-[640px] overflow-hidden"
              >
                <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-semibold text-sm text-white">NeuroSynk Studio</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsStudioDrawerOpen(false)}
                      className="text-xs text-zinc-400 hover:text-white cursor-pointer px-1.5 py-0.5 rounded hover:bg-zinc-800"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Studio Function Grid (NotebookLM style) */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={Boolean(activeGeneratingType)}
                      onClick={() => handleTriggerStudioFunction('BRIAN_TRACY_50')}
                      className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/40 text-left flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {language === 'es' ? '50 Ideas Tracy' : '50 Tracy Ideas'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(activeGeneratingType)}
                      onClick={() => handleTriggerStudioFunction('MINDMAP_FLOW')}
                      className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-cyan-500/40 text-left flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Network className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {language === 'es' ? 'Mapa Mental' : 'Mindmap'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(activeGeneratingType)}
                      onClick={() => handleTriggerStudioFunction('CALIBRATION_QUIZ')}
                      className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-purple-500/40 text-left flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {language === 'es' ? 'Cuestionario' : 'Quiz'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(activeGeneratingType)}
                      onClick={() => handleTriggerStudioFunction('MICRO_STEPS_TABLE')}
                      className="p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-emerald-500/40 text-left flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Table2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {language === 'es' ? 'Tabla de Pasos' : 'Steps Table'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(activeGeneratingType)}
                      onClick={() => handleTriggerStudioFunction('AUDIO_BRIEF')}
                      className="col-span-2 p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/40 text-left flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-medium text-zinc-200">
                        {language === 'es' ? 'Resumen en Audio' : 'Audio Overview'}
                      </span>
                    </button>
                  </div>

                  {/* Saved Studio Outputs */}
                  <div className="pt-2 space-y-2.5">
                    {studioArtifacts.length === 0 ? (
                      <div className="text-center py-8 px-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/60 space-y-1">
                        <Sparkles className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-emerald-300">
                          {language === 'es'
                            ? 'Los resultados de Studio se guardarán aquí y en tu chat.'
                            : 'Studio results will be saved here and in your chat.'}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {language === 'es'
                            ? 'Haz clic en cualquier función arriba o pídela en el chat.'
                            : 'Click any function above or ask for it in the chat.'}
                        </p>
                      </div>
                    ) : (
                      studioArtifacts.map(art => (
                        <div key={art.id}>{renderInteractiveArtifact(art, true)}</div>
                      ))
                    )}
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Minimalist */}
      <footer className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 font-mono gap-3 z-10 border-t border-zinc-900/80 pt-4 mt-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
          <span>{t.hero.privacyFooter}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Google Gemini 3.5 / 2.5 / 2.0 Flash
          </span>
        </div>
      </footer>
    </div>
  );
};
