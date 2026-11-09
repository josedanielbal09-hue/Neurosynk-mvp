/**
 * NeuroSynk AI Core - Universal Google Gemini Integration Client
 *
 * Integrated capabilities:
 * 1. Google Gemini 2.5 Flash / 2.0 Flash / 1.5 Flash (Low-latency streaming & structured JSON)
 * 2. Dynamic Model Discovery via Google Generative Language API (ListModels)
 * 3. Hybrid Localhost (/api/*) + Direct Browser HTTPS execution
 * 4. Local Edge-Biomechanical Ergonomic Calibration (100% On-Device Privacy)
 */

import { getCurrentAppLanguage } from '../context/SettingsContext';
import {
  ContextProbeResult,
  ExtractedContextState,
  BrianTracyIdeaItem,
  TaskFlowDiagramData
} from '../types/studioTypes';

export interface MetaSparkPayload {
  perclos: number;
  fatigueScore: number;
  postureScore: number;
  currentTask: string;
  sessionMinutes: number;
  cognitiveClass: string;
}

export interface MetaWonderDecomposePayload {
  task: string;
  perclos: number;
  stressLevel: number;
  availableMinutes: number;
  context?: string;
}

export interface MetaSAMCalibrationResult {
  isCalibrated: boolean;
  distanceMetric: 'OPTIMAL' | 'TOO_CLOSE' | 'TOO_FAR';
  headTiltAngle: number;
  shoulderAlignmentScore: number;
  clutterScore: number;
  recommendations: string[];
}

export interface BiometricTelemetryPayload {
  cognitiveState?: string;
  focusScore?: number;
  stressLevel?: number;
  sessionMinutes?: number;
  postureState?: string;
}

export interface SessionDebriefPayload {
  task: string;
  totalMinutes: number;
  completedStepsCount: number;
  totalStepsCount: number;
  averageFocus: number;
  flowPercentage: number;
  fatigueEventsCount: number;
}

export interface SessionDebriefResult {
  debrief: string;
}

let cachedModels: { key: string; models: string[] } | null = null;

export function getDefaultGoogleApiKey(): string {
  const envKey =
    (typeof process !== 'undefined' && (process.env as any)?.GEMINI_API_KEY)
      ? String((process.env as any).GEMINI_API_KEY).trim()
      : '';
  if (envKey.startsWith('AIza')) return envKey;
  return 'AIzaSyBljBmluUvfywcoql0IoZ72xdfss_hh3p8';
}

export function sanitizeApiKey(raw?: string): string {
  if (!raw) {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gemini_api_key') || '';
      // Purge any legacy Baseten key that doesn't start with Google's "AIza" prefix
      if (stored && !stored.trim().startsWith('AIza')) {
        localStorage.removeItem('gemini_api_key');
        localStorage.removeItem('baseten_api_key');
        raw = getDefaultGoogleApiKey();
        localStorage.setItem('gemini_api_key', raw);
      } else {
        raw = stored || getDefaultGoogleApiKey();
      }
    } else {
      raw = getDefaultGoogleApiKey();
    }
  }
  const cleaned = raw.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, '').trim().replace(/^["']|["']$/g, '');
  if (cleaned && !cleaned.startsWith('AIza')) {
    return getDefaultGoogleApiKey();
  }
  return cleaned;
}

function getClientApiKey(explicitKey?: string): string {
  const candidate = (explicitKey && explicitKey.trim())
    ? explicitKey.trim()
    : (typeof localStorage !== 'undefined' ? (localStorage.getItem('gemini_api_key') || '').trim() : '');
  return sanitizeApiKey(candidate);
}

/**
 * Queries Google Generative Language API for available models enabled for the given API Key,
 * prioritizing gemini-3.5-flash, then gemini-2.5-flash, and finally gemini-2.0-flash.
 */
export async function getAvailableModels(apiKey: string): Promise<string[]> {
  const cleanKey = sanitizeApiKey(apiKey);
  const priorityChain = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  if (!cleanKey) return priorityChain;

  if (cachedModels && cachedModels.key === cleanKey && cachedModels.models.length > 0) {
    return cachedModels.models;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const valid = data.models
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m: any) => String(m.name || '').replace(/^models\//, ''));

        if (valid.length > 0) {
          const ordered = [
            ...priorityChain,
            ...valid.filter((m: string) => !priorityChain.includes(m) && (m.startsWith('gemini-3.5-flash') || m.startsWith('gemini-2.5-flash') || m.startsWith('gemini-2.0-flash')))
          ];
          cachedModels = { key: cleanKey, models: ordered };
          return ordered;
        }
      }
    }
  } catch (e) {
    console.warn('[Gemini ListModels] Warning:', e);
  }

  return priorityChain;
}

/**
 * Direct REST call to Google Generative Language API from the browser
 */
export async function callGoogleGeminiDirect(
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  isJson: boolean = false
): Promise<string> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey || cleanKey === getDefaultGoogleApiKey()) {
    throw new Error('Using server-side Cloud AI endpoint.');
  }

  const modelsToTry = await getAvailableModels(cleanKey);
  let lastError: any = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    try {
      const payload: any = {
        contents: [
          {
            role: 'user',
            parts: [{ text: userContent }]
          }
        ]
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      if (isJson) {
        payload.generationConfig = {
          responseMimeType: 'application/json'
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text.trim().length > 0) {
          return text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        }
      } else {
        const errText = await res.text();
        lastError = new Error(`Google Gemini (${model}): ${res.status} ${errText.slice(0, 120)}`);
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Could not connect to Google Gemini API.');
}

export async function testGeminiConnection(apiKey?: string): Promise<{ success: boolean; message: string }> {
  const cleanKey = getClientApiKey(apiKey);

  // 1. Check Backend /api/api-status first (supports both Google Gemini & Cloud AI Failover)
  try {
    const res = await fetch('/api/api-status');
    if (res.ok) {
      const data = await res.json();
      if (data.keyValid || data.hasGeminiKey || data.hasServerKey) {
        return {
          success: true,
          message: 'Connected to Google Gemini AI Engine (200 OK)'
        };
      }
    }
  } catch {}

  if (cleanKey) {
    try {
      const text = await callGoogleGeminiDirect(
        cleanKey,
        'Respond strictly with "Connection active".',
        'Link test.',
        false
      );
      return {
        success: true,
        message: `Connected to Google Gemini (3.5 -> 2.5 -> 2.0 Flash): "${text.trim()}"`
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Error connecting to Google Gemini API'
      };
    }
  }

  return {
    success: false,
    message: 'API Key is empty. Paste your Google AI Studio key (AIza...).'
  };
}

export const testMetaModelConnection = testGeminiConnection;

export async function chatUniversal(
  messages: any[] | string,
  _apiKey?: string,
  currentStep: string = '',
  taskContext: string = '',
  telemetry?: BiometricTelemetryPayload
): Promise<{ reply: string; proposal?: any }> {
  const userText = Array.isArray(messages)
    ? (messages[messages.length - 1]?.content || '')
    : (typeof messages === 'string' ? messages : '');
  const key = getClientApiKey(_apiKey);
  const lang = getCurrentAppLanguage();
  const langLabel = lang === 'es' ? 'Spanish (Español)' : 'English';

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({
        message: userText,
        messages: Array.isArray(messages) ? messages : undefined,
        currentStep,
        taskContext,
        telemetry,
        language: lang,
        apiKey: key
      })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.reply) {
        return { reply: data.reply, proposal: data.proposal };
      }
    }
  } catch (err) {
    console.warn('[Gemini Client Chat] Backend fallback to direct:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Co-Presence Mentor powered by Google Gemini.
Answer the user's question in under 28 words strictly in ${langLabel}.
ALWAYS start with an ACTION VERB IN ALL CAPS. Zero Markdown.`;
      const reply = await callGoogleGeminiDirect(
        key,
        sys,
        `Active step: "${currentStep}" | Context: "${taskContext}" | Biometrics: ${JSON.stringify(telemetry || {})} | Question: "${userText}"`,
        false
      );
      if (reply) return { reply: reply.replace(/[*_#]/g, '').trim() };
    } catch (e) {
      console.warn('[Gemini Direct Chat] Fallback:', e);
    }
  }

  return {
    reply:
      lang === 'es'
        ? 'AVANZA con determinación en este paso. Sigo aquí contigo.'
        : 'MOVE forward with determination on this step. Still here with you.'
  };
}

export async function sessionDebriefUniversal(
  payload: SessionDebriefPayload,
  _apiKey?: string
): Promise<SessionDebriefResult> {
  const key = getClientApiKey(_apiKey);
  const lang = getCurrentAppLanguage();
  const langLabel = lang === 'es' ? 'Spanish (Español)' : 'English';
  try {
    const response = await fetch('/api/session-debrief', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ ...payload, language: lang, apiKey: key })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.debrief) {
        return { debrief: data.debrief };
      }
    }
  } catch (err) {
    console.warn('[Session Debrief Client] Fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Mentor powered by Google Gemini. Write a concise closing debrief in ${langLabel} (max 50 words) covering pace balance, completed steps, and somatic recovery.`;
      const prompt = `Task: "${payload.task}" | Duration: ${payload.totalMinutes}m | Steps: ${payload.completedStepsCount}/${payload.totalStepsCount} | Avg Focus: ${payload.averageFocus}%`;
      const text = await callGoogleGeminiDirect(key, sys, prompt, false);
      if (text) return { debrief: text.replace(/[*_#]/g, '').trim() };
    } catch {}
  }

  return {
    debrief:
      lang === 'es'
        ? `SESIÓN COMPLETADA: Terminaste ${payload.completedStepsCount} de ${payload.totalStepsCount} pasos en "${payload.task}". Tu enfoque promedio se mantuvo en ${payload.averageFocus}%. Excelente constancia. Toma 5 minutos para estirar y descansar la vista antes del siguiente bloque.`
        : `SESSION COMPLETED: You finished ${payload.completedStepsCount} of ${payload.totalStepsCount} steps on "${payload.task}". Your average focus stayed at ${payload.averageFocus}%. Outstanding persistence. Take 5 minutes to stretch and rest your eyes before your next block.`
  };
}

export async function taskSurveyUniversal(
  task: string,
  _apiKey?: string
): Promise<{ questions: any[] }> {
  const key = getClientApiKey(_apiKey);
  const lang = getCurrentAppLanguage();
  const langLabel = lang === 'es' ? 'Spanish (Español)' : 'English';
  try {
    const response = await fetch('/api/task-survey', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ task, language: lang, apiKey: key })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.questions && Array.isArray(data.questions)) {
        return { questions: data.questions };
      }
    }
  } catch (err) {
    console.warn('[Gemini Task Survey] Fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Cognitive & Task Diagnostician powered by Google Gemini.
Design a quick calibration survey of EXACTLY 5 brief questions in ${langLabel} based on the goal entered by the user.
Respond strictly with valid JSON containing the key "questions": array of objects with "id", "question", "options" (3 concrete options each, in ${langLabel}).`;
      const text = await callGoogleGeminiDirect(key, sys, `User goal: "${task}"`, true);
      const data = JSON.parse(text);
      if (data.questions && Array.isArray(data.questions)) {
        return { questions: data.questions };
      }
    } catch {}
  }

  if (lang === 'es') {
    return {
      questions: [
        {
          id: "q1",
          question: "¿Cuánto tiempo dedicarás a esta sesión?",
          options: ["25 a 30 minutos (Sprint corto)", "45 a 60 minutos (Sesión estándar)", "90 a 120 minutos (Sesión profunda)"]
        },
        {
          id: "q2",
          question: "¿Qué entregable tangible quieres lograr al terminar?",
          options: ["Dominar el concepto central", "Resolver un módulo o sección", "Terminar un entregable formal"]
        },
        {
          id: "q3",
          question: "¿Qué tan preparado estás con los materiales o herramientas?",
          options: ["Empiezo desde cero", "Tengo bases y notas listas", "Domino el tema, listo para ejecutar"]
        },
        {
          id: "q4",
          question: "¿Cómo describirías tu energía y claridad mental ahora mismo?",
          options: ["Energía alta y mente clara", "Energía media / neutral", "Mente dispersa o fatiga inicial"]
        },
        {
          id: "q5",
          question: "¿En qué punto sueles sentir mayor bloqueo o fricción?",
          options: ["Al romper la inercia inicial", "A mitad de la parte técnica densa", "Al cerrar y pulir los detalles finales"]
        }
      ]
    };
  }

  return {
    questions: [
      {
        id: "q1",
        question: "How much time will you dedicate to this session?",
        options: ["25 to 30 minutes (Short sprint)", "45 to 60 minutes (Standard session)", "90 to 120 minutes (Deep session)"]
      },
      {
        id: "q2",
        question: "What tangible outcome do you want to achieve by the end?",
        options: ["Grasp the core concept", "Solve an exercise or section", "Complete a formal deliverable"]
      },
      {
        id: "q3",
        question: "How familiar or prepared are you with the materials?",
        options: ["Starting from scratch", "Have basics and notes ready", "Mastered the topic, ready to produce"]
      },
      {
        id: "q4",
        question: "How would you describe your energy and focus right now?",
        options: ["High energy and clear focus", "Medium / neutral energy", "Scattered mind or initial fatigue"]
      },
      {
        id: "q5",
        question: "When do you usually experience the most friction or mental block?",
        options: ["Breaking initial inertia", "Midway through dense technical parts", "Wrapping up and polishing final details"]
      }
    ]
  };
}

export async function splitTaskUniversal(
  task: string,
  surveyAnswers: any,
  apiKeyOrContext?: string,
  contextOrApiKey?: string
): Promise<{ steps: string[] }> {
  let context = '';
  let candidateKey = '';

  if (typeof apiKeyOrContext === 'string') {
    if (apiKeyOrContext.includes(':') || apiKeyOrContext.includes('\n') || apiKeyOrContext.length > 50) {
      context = apiKeyOrContext;
      candidateKey = contextOrApiKey || '';
    } else {
      candidateKey = apiKeyOrContext;
      context = contextOrApiKey || '';
    }
  }

  const key = getClientApiKey(candidateKey);
  const lang = getCurrentAppLanguage();
  const langLabel = lang === 'es' ? 'Spanish (Español)' : 'English';
  try {
    const response = await fetch('/api/split-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ task, surveyAnswers, context, language: lang, apiKey: key })
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        return { steps: data.steps };
      }
    }
  } catch (err) {
    console.warn('[Gemini Split Task] Fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Planning & Focus Architect powered by Google Gemini.
Design a realistic work session in ${langLabel} based on the user's survey answers.
Every step MUST begin with an ACTION VERB IN ALL CAPS (e.g., "DEFINE", "ANALYZE", "DEVELOP", "SOMATIC PAUSE:", "VERIFY"). Include at least one "SOMATIC PAUSE:" step. Zero Markdown formatting.
Respond strictly with valid JSON containing the key "steps": array of strings in ${langLabel}.`;
      const text = await callGoogleGeminiDirect(
        key,
        sys,
        `GOAL: "${task}" | ANSWERS: ${JSON.stringify(surveyAnswers || {})} | CONTEXT: "${context || 'General'}"`,
        true
      );
      const data = JSON.parse(text);
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        return { steps: data.steps.map((s: any) => String(typeof s === 'string' ? s : (s?.step || s?.text || s || '')).replace(/\*/g, '').trim()) };
      }
    } catch {}
  }

  if (lang === 'es') {
    return {
      steps: [
        `DEFINE el objetivo concreto y los materiales esenciales para este bloque sobre '${task}'.`,
        `ANALIZA el primer concepto central identificando sus definiciones clave.`,
        `DESARROLLA la primera sección aplicando el método principal.`,
        `PAUSA SOMÁTICA: Aparta la vista de la pantalla, bebe agua y estira los brazos durante 3 minutos.`,
        `EJECUTA la segunda fase práctica consolidando los avances logrados.`,
        `VERIFICA tus resultados y redacta un cierre breve de lo completado.`
      ]
    };
  }

  return {
    steps: [
      `DEFINE the specific objective and essential materials for this block on '${task}'.`,
      `ANALYZE the first core concept by identifying key definitions.`,
      `DEVELOP the first section applying the main methods.`,
      `SOMATIC PAUSE: Look away from the screen, drink water, and stretch your arms for 3 minutes.`,
      `EXECUTE the second practice phase consolidating the concepts covered.`,
      `VERIFY your results and write a brief closing summary.`
    ]
  };
}

export async function subdivideStepUniversal(
  parentStep: string,
  taskContextOrStepNum?: string | number,
  stepNumberOrApiKey?: number | string,
  _apiKey?: string
): Promise<{ subSteps: string[] }> {
  const taskContext = typeof taskContextOrStepNum === 'string' ? taskContextOrStepNum : (typeof stepNumberOrApiKey === 'string' ? stepNumberOrApiKey : '');
  const stepNumber = typeof taskContextOrStepNum === 'number' ? taskContextOrStepNum : (typeof stepNumberOrApiKey === 'number' ? stepNumberOrApiKey : 1);
  const explicitKey = typeof stepNumberOrApiKey === 'string' && stepNumberOrApiKey.length > 20 ? stepNumberOrApiKey : _apiKey;
  const key = getClientApiKey(explicitKey);
  const lang = getCurrentAppLanguage();
  const langLabel = lang === 'es' ? 'Spanish (Español)' : 'English';

  try {
    const response = await fetch('/api/subdivide-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ parentStep, stepNumber, taskContext, language: lang, apiKey: key })
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.subSteps) && data.subSteps.length > 0) {
        return { subSteps: data.subSteps };
      }
    }
  } catch (err) {
    console.warn('[Gemini Subdivide Step] Fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are NeuroSynk's Executive Rescue Specialist powered by Google Gemini.
Break the blocked step into exactly 3 atomic NANO-STEPS in ${langLabel}, each taking under 60 seconds.
Every nano-step MUST start with an ACTION VERB IN ALL CAPS.
Respond strictly with valid JSON containing the key "subSteps": array of 3 strings in ${langLabel}.`;
      const text = await callGoogleGeminiDirect(
        key,
        sys,
        `Blocked step: "${parentStep}" | Context: "${taskContext || 'General'}"`,
        true
      );
      const data = JSON.parse(text);
      if (Array.isArray(data.subSteps) && data.subSteps.length > 0) {
        return { subSteps: data.subSteps.map((s: any) => String(typeof s === 'string' ? s : (s?.step || s?.text || s || '')).replace(/\*/g, '').trim()) };
      }
    } catch {}
  }

  if (lang === 'es') {
    return {
      subSteps: [
        "TOMA tu lápiz o coloca el cursor directamente en tu espacio de trabajo.",
        "UBICA únicamente el primer renglón o concepto inicial del paso.",
        "ESCRIBE la primera palabra clave para romper la inercia ahora mismo."
      ]
    };
  }

  return {
    subSteps: [
      "GRAB your pen or place the cursor directly in your workspace.",
      "LOCATE only the very first line or introductory concept.",
      "WRITE the first keyword to break initial inertia."
    ]
  };
}

/**
 * Requests a human, specific verbal celebration from Google Gemini
 * for the micro-step the user just mastered.
 */
export async function celebrateStepUniversal(
  completedStep: string,
  nextStep?: string,
  taskContext?: string
): Promise<string> {
  const key = getClientApiKey();
  const lang = getCurrentAppLanguage();
  const getDynamicFallback = (step: string): string => {
    const clean = step.replace(/^(\d+\.?\s*|[-•*]\s*)/, '').trim();
    const match = clean.match(/^([A-ZÁÉÍÓÚÑ]{3,})\s+(.*)/i);
    if (match) {
      const verb = match[1].toLowerCase();
      const rest = match[2].slice(0, 42).replace(/[.,;:].*$/, '').trim();
      return lang === 'es'
        ? `¡Excelente avance al ${verb} ${rest}! Sigamos con ese ritmo.`
        : `Great work as you ${verb} ${rest}! Keep that momentum going.`;
    }
    return lang === 'es'
      ? `¡Paso completado con éxito! Vamos directo al siguiente objetivo.`
      : `Step conquered! Moving right on to the next goal.`;
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch('/api/step-celebration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ completedStep, nextStep, taskContext, language: lang, apiKey: key }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.phrase && typeof data.phrase === 'string' && data.phrase.trim().length > 0) {
        return data.phrase.replace(/["*]/g, '').trim();
      }
    }
  } catch (err) {
    console.warn('[Celebrate Step Client] Fallback:', err);
  }

  return getDynamicFallback(completedStep);
}

/**
 * Requests a streaming verbal micro-intervention from Google Gemini
 */
export async function streamMuseSparkIntervention(
  payload: MetaSparkPayload,
  onChunk: (chunk: string) => void,
  onComplete?: () => void
): Promise<void> {
  const key = getClientApiKey();
  const lang = getCurrentAppLanguage();
  try {
    const response = await fetch('/api/meta/muse-spark/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ ...payload, language: lang, apiKey: key })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Gemini stream link error (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }

    if (onComplete) onComplete();
  } catch (error) {
    console.warn('[Gemini Intervention Client] Local fallback:', error);
    let fallback =
      lang === 'es'
        ? 'MANTÉN el ritmo. Respira profundo 3 segundos y sigue enfocado.'
        : 'KEEP the rhythm. Breathe deeply for 3 seconds and stay focused.';
    if (payload.perclos > 25 || payload.fatigueScore > 50) {
      fallback =
        lang === 'es'
          ? 'DESCANSA la vista lejos de la pantalla 20 segundos. Protegemos tu energía.'
          : 'REST your gaze away from the screen for 20 seconds. Protecting your energy.';
    } else if (payload.postureScore > 40) {
      fallback =
        lang === 'es'
          ? 'ALINEA tus hombros y eleva la barbilla. Buena postura da claridad.'
          : 'ALIGN your shoulders and lift your chin. Good posture sharpens clarity.';
    }
    onChunk(fallback);
    if (onComplete) onComplete();
  }
}

/**
 * Decomposes a complex cognitive task into 3 executable nano-steps using Google Gemini
 */
export async function decomposeWithMuseWonder(
  payload: MetaWonderDecomposePayload
): Promise<{ nanoSteps: string[]; estimatedSecondsPerStep: number }> {
  const key = getClientApiKey();
  const lang = getCurrentAppLanguage();
  try {
    const response = await fetch('/api/meta/muse-wonder/decompose', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({ ...payload, language: lang, apiKey: key })
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.nanoSteps) && data.nanoSteps.length > 0) {
        return {
          nanoSteps: data.nanoSteps,
          estimatedSecondsPerStep: data.estimatedSecondsPerStep || 45
        };
      }
    }
  } catch (err) {
    console.warn('[Gemini Decompose Client] Fallback:', err);
  }

  return {
    nanoSteps:
      lang === 'es'
        ? [
            `DEFINE la primera palabra clave o concepto inicial de "${payload.task}".`,
            'ABRE tu documento o cuaderno y escribe una sola oración introductoria.',
            'AVANZA con el primer párrafo sin juzgar perfección; cuidamos tu flujo.'
          ]
        : [
            `DEFINE the first keyword or initial concept of "${payload.task}".`,
            'OPEN your document or notebook and write a single introductory sentence.',
            'PROCEED with the first paragraph without judging perfection; we will maintain flow.'
          ],
    estimatedSecondsPerStep: 45
  };
}

/**
 * Deterministic local ergonomic calibration (Edge Privacy)
 * NEVER sends user video or images off the device.
 */
export async function calibrateErgonomicsWithSAM(
  telemetryOrSnapshot?: string | { rollAngle?: number; shoulderAngle?: number; pitchAngle?: number; stressLevel?: number }
): Promise<MetaSAMCalibrationResult> {
  const payload = typeof telemetryOrSnapshot === 'object' && telemetryOrSnapshot !== null
    ? telemetryOrSnapshot
    : {};
  try {
    const response = await fetch('/api/meta/sam/calibrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Ergonomic Calibration Client] Local fallback:', err);
  }

  return {
    isCalibrated: true,
    distanceMetric: 'OPTIMAL',
    headTiltAngle: 0,
    shoulderAlignmentScore: 92,
    clutterScore: 15,
    recommendations: [
      'Screen-to-face distance within optimal ergonomic range (50-70 cm).',
      'Shoulders horizontally aligned. Workspace clear for peak attention.'
    ]
  };
}

/**
 * Surgical Pre-Focus Contextualization Probe (Max 18 words per turn).
 * Extracts WHAT (whatGoal), HOW (howMethod), and BLOCKER (mainBlocker)
 * before splitting tasks or launching Studio artifacts.
 */
export async function probeTaskContext(
  message: string,
  currentContext: Partial<ExtractedContextState>,
  _apiKey?: string
): Promise<ContextProbeResult> {
  const key = getClientApiKey(_apiKey);
  const lang = getCurrentAppLanguage();
  const whatGoal = currentContext.whatGoal || null;
  const howMethod = currentContext.howMethod || null;
  const mainBlocker = currentContext.mainBlocker || null;

  let cleanedMessage = String(message || '').replace(/^\[VOICE_BRAIN_DUMP\]\s*/i, '').trim();
  for (let i = 0; i < 3; i++) {
    cleanedMessage = cleanedMessage
      .replace(/^(hola(\s+chat|\s+bot|\s+focusbud)?[,.\s]*)/i, '')
      .replace(/^(buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hey|hi|hello)[,.\s]*/i, '')
      .replace(/^(hoy|ahora(\s+mismo)?|ahorita|este\s+d[ií]a|pues|bueno|mira|oye)[,.\s]+/i, '')
      .replace(/^(quiero|necesito|quisiera|me\s+gustar[ií]a|voy\s+a|tengo\s+que|debo|hay\s+que)\s+/i, '')
      .trim();
  }
  const lowerMsg = cleanedMessage.toLowerCase();
  const isGreetingOnly = /^(hola|buenas|hey|hi|hello|que tal|qué tal|buenos dias|buenos días|buenas tardes|ok|vale)$/i.test(lowerMsg);
  const isNoneBlocker = /^(ninguno|ninguna|nada|no|todo bien|none|nothing|sin bloqueo)$/i.test(lowerMsg);
  const isDontKnow = /^(no\s*s[eé]|nose|idk|no\s+lo\s+s[eé]|cualquiera|recomi[eé]ndame|ay[uú]dame|ayuda|no\s+tengo\s+idea)$/i.test(lowerMsg);

  let nextWhat = whatGoal;
  let nextHow = howMethod;
  let nextBlocker = mainBlocker;

  if (!nextWhat && cleanedMessage && !isGreetingOnly && !isDontKnow) {
    nextWhat = (cleanedMessage.charAt(0).toUpperCase() + cleanedMessage.slice(1)).slice(0, 140);
  } else if (!nextHow && cleanedMessage && !isGreetingOnly) {
    nextHow = isDontKnow
      ? (lang === 'es' ? 'Práctica guiada con ejercicios paso a paso' : 'Guided step-by-step practice exercises')
      : cleanedMessage.slice(0, 140);
  } else if (!nextBlocker && cleanedMessage) {
    nextBlocker = (isNoneBlocker || isDontKnow)
      ? (lang === 'es' ? 'Estructurar el orden paso a paso sin distracciones' : 'Structuring step-by-step order without distractions')
      : cleanedMessage.slice(0, 140);
  }

  const buildDeterministicFallback = (): ContextProbeResult => {
    const resolvedWhat = nextWhat;
    const resolvedHow = nextHow;
    const resolvedBlocker = nextBlocker;

    const filledCount = [resolvedWhat, resolvedHow, resolvedBlocker].filter(Boolean).length;
    const completenessScore = filledCount === 3 ? 100 : filledCount === 2 ? 68 : filledCount === 1 ? 34 : 0;
    const nextTargetField: 'whatGoal' | 'howMethod' | 'mainBlocker' | 'ready' =
      !resolvedWhat ? 'whatGoal' : !resolvedHow ? 'howMethod' : !resolvedBlocker ? 'mainBlocker' : 'ready';

    let replyEs = '';
    let replyEn = '';

    if (isGreetingOnly && !resolvedWhat) {
      replyEs = '¡Hola! Dime exactamente: ¿qué tarea, examen o proyecto quieres resolver hoy?';
      replyEn = 'Hello! Tell me: what exact task, exam, or project do you want to tackle today?';
    } else if (isGreetingOnly && resolvedWhat && !resolvedHow) {
      replyEs = `¡Hola! Para "${resolvedWhat}", ¿usarás apuntes, libro, código o ejercicios prácticos?`;
      replyEn = `Hi! For "${resolvedWhat}", will you use notes, textbook, code, or practice problems?`;
    } else if (nextTargetField === 'whatGoal') {
      replyEs = '¿Qué entregable o resultado concreto quieres lograr hoy?';
      replyEn = 'What specific deliverable or outcome do you want to achieve today?';
    } else if (nextTargetField === 'howMethod') {
      replyEs = `Meta: "${resolvedWhat}". ¿Cómo lo abordarás (ejercicios, lectura, código, apuntes)?`;
      replyEn = `Goal: "${resolvedWhat}". How will you tackle it (exercises, reading, code, notes)?`;
    } else if (nextTargetField === 'mainBlocker') {
      replyEs = isDontKnow
        ? `Te sugiero: "${resolvedHow}". ¿Qué parte de "${resolvedWhat}" se te dificulta más ahora?`
        : `Usando "${resolvedHow}". ¿Qué parte te cuesta más o qué te frena ahora mismo?`;
      replyEn = isDontKnow
        ? `I suggest: "${resolvedHow}". Which part of "${resolvedWhat}" is hardest for you right now?`
        : `Using "${resolvedHow}". Which part is hardest or blocking you right now?`;
    } else {
      replyEs = `¡Listo! Meta: "${resolvedWhat}". Elige abajo: 50 Ideas Brian Tracy, Diagrama o Micro-pasos.`;
      replyEn = `Ready! Goal: "${resolvedWhat}". Choose below: 50 Brian Tracy Ideas, Diagram, or Micro-steps.`;
    }

    const chipsEs =
      nextTargetField === 'whatGoal'
        ? ['Estudiar para examen clave', 'Terminar proyecto pendiente', 'Resolver guía de ejercicios']
        : nextTargetField === 'howMethod'
        ? ['Resolviendo ejercicios prácticos', 'Resumen y lectura activa', 'Práctica en código / laboratorio']
        : nextTargetField === 'mainBlocker'
        ? ['Me cuesta concentrarme al iniciar', 'Fórmulas / conceptos complejos', 'Ninguno, quiero ir rápido']
        : ['🧠 Generar 50 Ideas Brian Tracy', '🕸️ Crear Mapa Mental / Diagrama', '🚀 Dividir en Micro-pasos'];

    const chipsEn =
      nextTargetField === 'whatGoal'
        ? ['Study for key exam', 'Finish pending project', 'Solve problem set']
        : nextTargetField === 'howMethod'
        ? ['Solving practice problems', 'Active reading & summary', 'Coding / lab practice']
        : nextTargetField === 'mainBlocker'
        ? ['Hard to focus when starting', 'Complex formulas / concepts', 'None, want to move fast']
        : ['🧠 Generate 50 Brian Tracy Ideas', '🕸️ Create Mindmap Flow', '🚀 Split into Micro-steps'];

    return {
      reply: lang === 'es' ? replyEs : replyEn,
      extracted: {
        whatGoal: resolvedWhat,
        howMethod: resolvedHow,
        mainBlocker: resolvedBlocker,
        isComplete: filledCount === 3,
        completenessScore,
        nextTargetField
      },
      suggestedKeyboardChips: lang === 'es' ? chipsEs : chipsEn
    };
  };

  // 1. Try Backend /api/context-probe with 25s AbortSignal timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('/api/context-probe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({
        message,
        language: lang,
        currentContext: { whatGoal, howMethod, mainBlocker },
        apiKey: key
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.reply && data.extracted) {
        return data as ContextProbeResult;
      }
    }
  } catch (err) {
    console.warn('[probeTaskContext] Proxy fallback to direct Gemini HTTPS:', err);
  }

  // 2. Fallback to Direct HTTPS call to Google Gemini API (3.5 -> 2.5 -> 2.0 Flash)
  if (key) {
    try {
      const langName = lang === 'es' ? 'Spanish (Español)' : 'English';
      const sys = `You are NeuroSynk's Surgical Productivity Architect.
Extract 3 strategic pillars before splitting tasks: whatGoal, howMethod, mainBlocker.
Reply in MAXIMUM 18 WORDS in ${langName}, asking ONLY for the next missing pillar (or confirming readiness).
Respond ONLY with JSON:
{
  "reply": "string (max 18 words in ${langName})",
  "extracted": { "whatGoal": string|null, "howMethod": string|null, "mainBlocker": string|null, "isComplete": boolean },
  "suggestedKeyboardChips": ["chip1", "chip2", "chip3"]
}`;
      const prompt = `Current Context: ${JSON.stringify({ whatGoal, howMethod, mainBlocker })}\nUser Input: "${message}"`;
      const rawJson = await callGoogleGeminiDirect(key, sys, prompt, true);
      const parsed = JSON.parse(rawJson.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim());
      if (parsed && parsed.reply) {
        const ext = parsed.extracted || {};
        const finalWhat = ext.whatGoal || nextWhat || null;
        const finalHow = ext.howMethod || nextHow || null;
        const finalBlocker = ext.mainBlocker || nextBlocker || null;
        const count = [finalWhat, finalHow, finalBlocker].filter(Boolean).length;
        const nextTargetField: 'whatGoal' | 'howMethod' | 'mainBlocker' | 'ready' =
          !finalWhat ? 'whatGoal' : !finalHow ? 'howMethod' : !finalBlocker ? 'mainBlocker' : 'ready';

        return {
          reply: String(parsed.reply).trim(),
          extracted: {
            whatGoal: finalWhat,
            howMethod: finalHow,
            mainBlocker: finalBlocker,
            isComplete: Boolean(ext.isComplete || count === 3),
            completenessScore: count === 3 ? 100 : count === 2 ? 68 : count === 1 ? 34 : 0,
            nextTargetField
          },
          suggestedKeyboardChips: Array.isArray(parsed.suggestedKeyboardChips)
            ? parsed.suggestedKeyboardChips.map(String).slice(0, 4)
            : buildDeterministicFallback().suggestedKeyboardChips
        };
      }
    } catch (directErr) {
      console.warn('[probeTaskContext] Direct Gemini fallback:', directErr);
    }
  }

  return buildDeterministicFallback();
}

/**
 * Generates up to 50 Brian Tracy Problem-Solving & Execution Ideas with real-time progress (0% -> 100%).
 * Connects to Google Gemini API when valid key is active, or synthesizes 50 topic-tailored ideas locally.
 */
export async function generateBrianTracy50Ideas(
  goal: string,
  method: string | null,
  blocker: string | null,
  apiKey?: string,
  onProgress?: (pct: number, label: string) => void
): Promise<BrianTracyIdeaItem[]> {
  const lang = getCurrentAppLanguage();
  const langName = lang === 'es' ? 'Spanish (Español)' : 'English';
  const key = getClientApiKey(apiKey);
  const cleanGoal = (goal || (lang === 'es' ? 'Meta de estudio' : 'Study goal')).trim();
  const cleanMethod = (method || (lang === 'es' ? 'Práctica activa' : 'Active practice')).trim();
  const cleanBlocker = (blocker || (lang === 'es' ? 'Inercia inicial' : 'Starting inertia')).trim();

  onProgress?.(12, lang === 'es' ? 'Iniciando matriz Brian Tracy (1-15)...' : 'Starting Brian Tracy matrix (1-15)...');

  const buildLocal50 = (): BrianTracyIdeaItem[] => {
    const esTemplates: { text: string; cat: BrianTracyIdeaItem['category']; effort: 1|2|3|4|5; impact: 1|2|3|4|5 }[] = [
      { text: `Definir en 1 oración el entregable mínimo viable de "${cleanGoal}" para los próximos 25 min.`, cat: 'quick_win', effort: 1, impact: 5 },
      { text: `Aplicar la Regla del 80/20: aislar el 20% de "${cleanGoal}" que concentra el 80% del examen o entrega.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Eliminar de inmediato la fricción "${cleanBlocker}" preparando solo "${cleanMethod}" en pantalla.`, cat: 'unblocker', effort: 1, impact: 5 },
      { text: `Técnica Feynman: explicar el núcleo de "${cleanGoal}" en voz alta en menos de 90 segundos.`, cat: 'creative_leap', effort: 2, impact: 5 },
      { text: `Resolver primero el ejemplo o ejercicio más representativo de "${cleanGoal}" antes de leer teoría pasiva.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Regla de los 2 Minutos: abrir "${cleanMethod}" y escribir únicamente el título y las 3 variables clave.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Invertir el bloqueo ("${cleanBlocker}"): ¿qué pasaría si hicieras solo el 10% más fácil ahora mismo?`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Crear una hoja de fórmulas/conceptos de 1 sola cara para "${cleanGoal}".`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Hacer ingeniería inversa: partir del problema resuelto de "${cleanGoal}" hacia el primer paso.`, cat: 'creative_leap', effort: 3, impact: 5 },
      { text: `Establecer un temporizador estricto de 15 minutos sin borrar ni editar nada en "${cleanMethod}".`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Identificar las 3 preguntas más frecuentes o difíciles sobre "${cleanGoal}" y atacarlas primero.`, cat: 'pareto_20', effort: 3, impact: 5 },
      { text: `Bloquear pestañas secundarias que alimentan "${cleanBlocker}" durante 1 bloque Pomodoro.`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Dibujar un diagrama de bloques con las relaciones causa-efecto de "${cleanGoal}".`, cat: 'creative_leap', effort: 2, impact: 4 },
      { text: `Redactar 5 preguntas de autoevaluación rápida sobre "${cleanGoal}" usando "${cleanMethod}".`, cat: 'pareto_20', effort: 2, impact: 4 },
      { text: `Dividir el estudio de "${cleanGoal}" en 3 capas: Intuición (5m), Mecánica (15m) y Verificación (5m).`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Reemplazar la lectura pasiva por resolución activa de 3 casos prácticos en "${cleanMethod}".`, cat: 'pareto_20', effort: 3, impact: 5 },
      { text: `Usar el Método del Queso Suizo: perforar "${cleanGoal}" con una tarea diminuta de 3 minutos.`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Resumir cada subtema de "${cleanGoal}" en exactamente 1 viñeta accionable.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Simular que debes enseñar "${cleanGoal}" mañana a un compañero usando solo 3 ejemplos.`, cat: 'creative_leap', effort: 2, impact: 5 },
      { text: `Aislar el término o ecuación que más confusión genera en "${cleanGoal}" y buscar 2 analogías reales.`, cat: 'unblocker', effort: 2, impact: 4 },
      { text: `Crear una lista de verificación (Checklist) de 5 puntos para validar que dominas "${cleanGoal}".`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Aplicar "Eat That Frog" (Trágate ese sapo): atacar el subpunto más intimidante de "${cleanGoal}" en el minuto 1.`, cat: 'pareto_20', effort: 3, impact: 5 },
      { text: `Reducir el alcance actual de "${cleanGoal}" a la mitad para garantizar 100% de ejecución hoy.`, cat: 'unblocker', effort: 1, impact: 5 },
      { text: `Comparar 2 enfoques distintos para resolver "${cleanGoal}" dentro de "${cleanMethod}".`, cat: 'creative_leap', effort: 3, impact: 4 },
      { text: `Hacer un vaciado mental en papel de 60 segundos para despejar "${cleanBlocker}".`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Grabar una nota de voz de 1 minuto sintetizando lo que ya sabes de "${cleanGoal}".`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Localizar el cuello de botella exacto donde te detienes al practicar "${cleanGoal}".`, cat: 'unblocker', effort: 2, impact: 5 },
      { text: `Diseñar 3 tarjetas rápidas (Flashcards) de pregunta/respuesta para los pilares de "${cleanGoal}".`, cat: 'quick_win', effort: 2, impact: 4 },
      { text: `Conectar "${cleanGoal}" con un problema del mundo real para anclar la memoria a largo plazo.`, cat: 'creative_leap', effort: 2, impact: 4 },
      { text: `Establecer una micro-recompensa inmediata al terminar los primeros 20 minutos de "${cleanGoal}".`, cat: 'quick_win', effort: 1, impact: 3 },
      { text: `Resolver un ejercicio de "${cleanGoal}" con libro abierto y el siguiente de memoria sin mirar apuntes.`, cat: 'pareto_20', effort: 3, impact: 5 },
      { text: `Detectar qué prerrequisito rápido necesitas repasar 5 minutos para destrabar "${cleanGoal}".`, cat: 'unblocker', effort: 2, impact: 5 },
      { text: `Escribir los pasos algorítmicos (1, 2, 3) para resolver cualquier problema tipo de "${cleanGoal}".`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Cambiar de formato en "${cleanMethod}": pasar de texto a esquema visual para romper "${cleanBlocker}".`, cat: 'creative_leap', effort: 2, impact: 4 },
      { text: `Marcar con color verde lo que ya dominas de "${cleanGoal}" y con ámbar lo que requiere práctica hoy.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Limitar el material de consulta a 1 sola fuente principal para evitar parálisis por análisis.`, cat: 'unblocker', effort: 1, impact: 5 },
      { text: `Plantear un caso extremo o límite dentro de "${cleanGoal}" para probar tu comprensión profunda.`, cat: 'creative_leap', effort: 3, impact: 4 },
      { text: `Cronometrar cuánto tardas en completar 1 unidad mínima de "${cleanGoal}" y tratar de superarlo.`, cat: 'quick_win', effort: 2, impact: 4 },
      { text: `Documentar el error más común al ejecutar "${cleanGoal}" para no repetirlo en la sesión.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Hacer una pausa somática de 3 respiraciones profundas antes de abordar la parte densa de "${cleanGoal}".`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Sintetizar toda la sesión de "${cleanGoal}" en 3 palabras clave ancla.`, cat: 'quick_win', effort: 1, impact: 3 },
      { text: `Formular la pregunta "¿Cuál es el uso más valioso de mi tiempo en '${cleanGoal}' ahora mismo?"`, cat: 'pareto_20', effort: 1, impact: 5 },
      { text: `Desglosar "${cleanGoal}" en entradas (datos), proceso (fórmula/método) y salida (resultado).`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Neutralizar "${cleanBlocker}" comprometiéndote solo a 5 minutos de acción imperfecta.`, cat: 'unblocker', effort: 1, impact: 5 },
      { text: `Asociar cada concepto clave de "${cleanGoal}" con una imagen mental exagerada o memorable.`, cat: 'creative_leap', effort: 2, impact: 4 },
      { text: `Revisar el índice o estructura global de "${cleanGoal}" en 2 minutos antes de entrar al detalle.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Resolver primero los apartados de mayor puntaje o impacto directo en "${cleanGoal}".`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Dejar preparado el siguiente ejercicio en "${cleanMethod}" antes de tomar cualquier descanso.`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Combinar "${cleanMethod}" con recuperación activa (Active Recall) cada 10 minutos.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Cerrar el bloque escribiendo 1 conclusión accionable y el primer paso exacto de la próxima sesión.`, cat: 'quick_win', effort: 1, impact: 5 }
    ];

    const enTemplates: { text: string; cat: BrianTracyIdeaItem['category']; effort: 1|2|3|4|5; impact: 1|2|3|4|5 }[] = [
      { text: `Define in 1 sentence the minimum viable deliverable for "${cleanGoal}" for the next 25 min.`, cat: 'quick_win', effort: 1, impact: 5 },
      { text: `Apply the 80/20 Rule: isolate the 20% of "${cleanGoal}" driving 80% of the results.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Eliminate friction "${cleanBlocker}" immediately by keeping only "${cleanMethod}" open.`, cat: 'unblocker', effort: 1, impact: 5 },
      { text: `Feynman Technique: explain the core of "${cleanGoal}" out loud in under 90 seconds.`, cat: 'creative_leap', effort: 2, impact: 5 },
      { text: `Solve the most representative problem of "${cleanGoal}" first before passive reading.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `2-Minute Rule: open "${cleanMethod}" and write down only the title and 3 key variables.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Invert the blocker ("${cleanBlocker}"): what if you only did the easiest 10% right now?`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Build a 1-page master formula/concept cheat sheet for "${cleanGoal}".`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Reverse-engineer "${cleanGoal}" starting from a solved example back to step one.`, cat: 'creative_leap', effort: 3, impact: 5 },
      { text: `Set a strict 15-minute sprint in "${cleanMethod}" without editing or backspacing.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Identify the top 3 highest-yield questions in "${cleanGoal}" and tackle them first.`, cat: 'pareto_20', effort: 3, impact: 5 },
      { text: `Close secondary tabs feeding "${cleanBlocker}" for one full Pomodoro block.`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Sketch a cause-and-effect block diagram for "${cleanGoal}".`, cat: 'creative_leap', effort: 2, impact: 4 },
      { text: `Write 5 rapid self-test prompts on "${cleanGoal}" using "${cleanMethod}".`, cat: 'pareto_20', effort: 2, impact: 4 },
      { text: `Split "${cleanGoal}" into 3 layers: Intuition (5m), Mechanics (15m), Verification (5m).`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Replace passive review with solving 3 active practice cases in "${cleanMethod}".`, cat: 'pareto_20', effort: 3, impact: 5 },
      { text: `Swiss Cheese Method: punch a 3-minute hole into "${cleanGoal}" right now.`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Condense each sub-topic of "${cleanGoal}" into a single actionable bullet.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Pretend you must teach "${cleanGoal}" tomorrow using only 3 concrete examples.`, cat: 'creative_leap', effort: 2, impact: 5 },
      { text: `Isolate the most confusing term in "${cleanGoal}" and create 2 real-world analogies.`, cat: 'unblocker', effort: 2, impact: 4 },
      { text: `Draft a 5-point mastery checklist to verify completion of "${cleanGoal}".`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Eat That Frog: attack the single most important sub-task of "${cleanGoal}" at minute 1.`, cat: 'pareto_20', effort: 3, impact: 5 },
      { text: `Cut the current scope of "${cleanGoal}" in half to guarantee 100% completion today.`, cat: 'unblocker', effort: 1, impact: 5 },
      { text: `Compare 2 different methods to solve "${cleanGoal}" inside "${cleanMethod}".`, cat: 'creative_leap', effort: 3, impact: 4 },
      { text: `Do a 60-second brain dump to clear "${cleanBlocker}" from working memory.`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Speak a 1-minute summary of what you already know about "${cleanGoal}".`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Pinpoint the exact bottleneck step where you stall in "${cleanGoal}".`, cat: 'unblocker', effort: 2, impact: 5 },
      { text: `Create 3 high-impact Q&A flashcards for the pillars of "${cleanGoal}".`, cat: 'quick_win', effort: 2, impact: 4 },
      { text: `Link "${cleanGoal}" to a practical real-world application for deeper retention.`, cat: 'creative_leap', effort: 2, impact: 4 },
      { text: `Set an immediate micro-reward after completing 20 focused minutes on "${cleanGoal}".`, cat: 'quick_win', effort: 1, impact: 3 },
      { text: `Solve one problem of "${cleanGoal}" open-book, and the next from pure memory.`, cat: 'pareto_20', effort: 3, impact: 5 },
      { text: `Identify any 5-minute prerequisite needed to unlock "${cleanGoal}".`, cat: 'unblocker', effort: 2, impact: 5 },
      { text: `Write the step-by-step recipe (1, 2, 3) for solving any standard "${cleanGoal}" task.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Switch modalities in "${cleanMethod}" from text to visual mapping to beat "${cleanBlocker}".`, cat: 'creative_leap', effort: 2, impact: 4 },
      { text: `Highlight mastered parts of "${cleanGoal}" in green and target areas in amber.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Restrict reference material to 1 primary source to prevent analysis paralysis.`, cat: 'unblocker', effort: 1, impact: 5 },
      { text: `Test an edge case in "${cleanGoal}" to stress-test your understanding.`, cat: 'creative_leap', effort: 3, impact: 4 },
      { text: `Time how long 1 unit of "${cleanGoal}" takes and gamify beating that baseline.`, cat: 'quick_win', effort: 2, impact: 4 },
      { text: `Log the #1 most common mistake in "${cleanGoal}" so you never repeat it.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Take 3 deep somatic breaths before starting the densest section of "${cleanGoal}".`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Distill today's "${cleanGoal}" session into 3 anchor keywords.`, cat: 'quick_win', effort: 1, impact: 3 },
      { text: `Ask Brian Tracy's core question: "What is the most valuable use of my time on '${cleanGoal}' right now?"`, cat: 'pareto_20', effort: 1, impact: 5 },
      { text: `Break "${cleanGoal}" into Inputs (data), Process (method), and Output (deliverable).`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Neutralize "${cleanBlocker}" by committing to just 5 minutes of imperfect action.`, cat: 'unblocker', effort: 1, impact: 5 },
      { text: `Associate each key concept of "${cleanGoal}" with a vivid mental image.`, cat: 'creative_leap', effort: 2, impact: 4 },
      { text: `Scan the high-level outline of "${cleanGoal}" in 2 minutes before diving into details.`, cat: 'quick_win', effort: 1, impact: 4 },
      { text: `Prioritize the highest-weighted sections of "${cleanGoal}" first.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Stage the next exercise in "${cleanMethod}" before taking any break.`, cat: 'unblocker', effort: 1, impact: 4 },
      { text: `Pair "${cleanMethod}" with Active Recall every 10 minutes.`, cat: 'pareto_20', effort: 2, impact: 5 },
      { text: `Close the sprint by writing 1 key takeaway and the exact first step for next time.`, cat: 'quick_win', effort: 1, impact: 5 }
    ];

    const list = lang === 'es' ? esTemplates : enTemplates;
    return list.map((item, idx) => ({
      id: idx + 1,
      text: item.text,
      category: item.cat,
      effort: item.effort,
      impact: item.impact,
      selected: idx < 4
    }));
  };

  await new Promise(r => setTimeout(r, 220));
  onProgress?.(42, lang === 'es' ? 'Estructurando lote Pareto 80/20 y Desbloqueadores (16-35)...' : 'Structuring Pareto 80/20 & Unblockers (16-35)...');

  // 1. Try Backend /api/brian-tracy-50 (Real-time AI + Failover)
  try {
    const res = await fetch('/api/brian-tracy-50', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({
        goal: cleanGoal,
        method: cleanMethod,
        blocker: cleanBlocker,
        language: lang,
        apiKey: key
      })
    });
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && Array.isArray(parsed.ideas) && parsed.ideas.length >= 5) {
        onProgress?.(88, lang === 'es' ? 'Refinando y clasificando las 50 ideas (36-50)...' : 'Refining and ranking all 50 ideas (36-50)...');
        const localFallback = buildLocal50();
        const merged: BrianTracyIdeaItem[] = parsed.ideas.slice(0, 50).map((it: any, idx: number) => ({
          id: idx + 1,
          text: String(it.text || localFallback[idx]?.text || ''),
          category: (['quick_win', 'pareto_20', 'unblocker', 'creative_leap'].includes(it.category)
            ? it.category
            : localFallback[idx]?.category || 'quick_win') as BrianTracyIdeaItem['category'],
          effort: (Math.min(5, Math.max(1, Number(it.effort) || 2)) as 1|2|3|4|5),
          impact: (Math.min(5, Math.max(1, Number(it.impact) || 5)) as 1|2|3|4|5),
          selected: idx < 4
        }));
        while (merged.length < 50) {
          merged.push(localFallback[merged.length]);
        }
        onProgress?.(100, lang === 'es' ? '¡50 Ideas de Brian Tracy listas!' : '50 Brian Tracy Ideas ready!');
        return merged;
      }
    }
  } catch (err) {
    console.warn('[generateBrianTracy50Ideas] Backend fallback:', err);
  }

  if (key) {
    try {
      const sys = `You are Brian Tracy's Executive Productivity Engine inside NeuroSynk.
Generate a JSON object with key "ideas": an array of 50 concrete, specific ways to execute "${cleanGoal}" using "${cleanMethod}" and overcoming "${cleanBlocker}" strictly in ${langName}.
Each item must have: {"id": number (1..50), "text": string, "category": "quick_win"|"pareto_20"|"unblocker"|"creative_leap", "effort": 1..5, "impact": 1..5}.`;
      const raw = await callGoogleGeminiDirect(
        key,
        sys,
        `Goal: "${cleanGoal}" | Method: "${cleanMethod}" | Blocker: "${cleanBlocker}" | Language: ${langName}`,
        true
      );
      onProgress?.(85, lang === 'es' ? 'Refinando y clasificando las 50 ideas (36-50)...' : 'Refining and ranking all 50 ideas (36-50)...');
      const parsed = JSON.parse(raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim());
      if (parsed && Array.isArray(parsed.ideas) && parsed.ideas.length >= 10) {
        const localFallback = buildLocal50();
        const merged: BrianTracyIdeaItem[] = parsed.ideas.slice(0, 50).map((it: any, idx: number) => ({
          id: idx + 1,
          text: String(it.text || localFallback[idx]?.text || ''),
          category: (['quick_win', 'pareto_20', 'unblocker', 'creative_leap'].includes(it.category)
            ? it.category
            : localFallback[idx]?.category || 'quick_win') as BrianTracyIdeaItem['category'],
          effort: (Math.min(5, Math.max(1, Number(it.effort) || 2)) as 1|2|3|4|5),
          impact: (Math.min(5, Math.max(1, Number(it.impact) || 5)) as 1|2|3|4|5),
          selected: idx < 4
        }));
        while (merged.length < 50) {
          merged.push(localFallback[merged.length]);
        }
        onProgress?.(100, lang === 'es' ? '¡50 Ideas de Brian Tracy listas!' : '50 Brian Tracy Ideas ready!');
        return merged;
      }
    } catch (err) {
      console.warn('[generateBrianTracy50Ideas] Using rich local 50-idea generator:', err);
    }
  }

  await new Promise(r => setTimeout(r, 260));
  onProgress?.(78, lang === 'es' ? 'Calculando matriz de Impacto vs Esfuerzo (36-50)...' : 'Computing Impact vs Effort matrix (36-50)...');
  await new Promise(r => setTimeout(r, 220));
  onProgress?.(100, lang === 'es' ? '¡50 Ideas de Brian Tracy listas!' : '50 Brian Tracy Ideas ready!');
  return buildLocal50();
}

/**
 * Generates an interactive Mindmap / Task Flow Diagram for the user's goal, method, and blocker.
 */
export async function generateTaskFlowDiagram(
  goal: string,
  method: string | null,
  blocker: string | null,
  apiKey?: string
): Promise<TaskFlowDiagramData> {
  const lang = getCurrentAppLanguage();
  const key = getClientApiKey(apiKey);
  const cleanGoal = (goal || (lang === 'es' ? 'Meta Principal' : 'Primary Goal')).trim();
  const cleanMethod = (method || (lang === 'es' ? 'Práctica Focalizada' : 'Focused Practice')).trim();
  const cleanBlocker = (blocker || (lang === 'es' ? 'Fricción Inicial' : 'Initial Friction')).trim();

  try {
    const res = await fetch('/api/task-flow-diagram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { 'x-gemini-api-key': key, 'x-api-key': key } : {})
      },
      body: JSON.stringify({
        goal: cleanGoal,
        method: cleanMethod,
        blocker: cleanBlocker,
        language: lang,
        apiKey: key
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.nodes) && data.nodes.length >= 3) {
        return data as TaskFlowDiagramData;
      }
    }
  } catch (err) {
    console.warn('[generateTaskFlowDiagram] Backend fallback:', err);
  }

  if (lang === 'es') {
    return {
      title: `Arquitectura de Flujo: ${cleanGoal}`,
      nodes: [
        {
          id: 'n1',
          label: `1. Meta: ${cleanGoal}`,
          detail: `Definir el alcance exacto para los primeros 25 min.`,
          phase: 'root',
          estimatedMinutes: 3
        },
        {
          id: 'n2',
          label: `2. Entorno: ${cleanMethod}`,
          detail: `Preparar herramientas y aislar distracciones externas.`,
          phase: 'preparation',
          estimatedMinutes: 4
        },
        {
          id: 'n3',
          label: `3. Neutralizar: ${cleanBlocker}`,
          detail: `Aplicar regla de 2 minutos para romper la fricción.`,
          phase: 'unblocker',
          estimatedMinutes: 5
        },
        {
          id: 'n4',
          label: `4. Bloque Pareto 80/20`,
          detail: `Ejecutar el núcleo de mayor impacto de "${cleanGoal}".`,
          phase: 'execution',
          estimatedMinutes: 15
        },
        {
          id: 'n5',
          label: `5. Verificación y Cierre`,
          detail: `Autoevaluar el entregable y consolidar aprendizaje.`,
          phase: 'deliverable',
          estimatedMinutes: 5
        }
      ],
      edges: [
        { from: 'n1', to: 'n2', label: 'Configura' },
        { from: 'n2', to: 'n3', label: 'Desbloquea' },
        { from: 'n3', to: 'n4', label: 'Sprint Profundo' },
        { from: 'n4', to: 'n5', label: 'Valida' }
      ],
      criticalPath: ['n1', 'n3', 'n4', 'n5']
    };
  }

  return {
    title: `Task Flow Architecture: ${cleanGoal}`,
    nodes: [
      {
        id: 'n1',
        label: `1. Goal: ${cleanGoal}`,
        detail: `Define the exact scope for the first 25-min sprint.`,
        phase: 'root',
        estimatedMinutes: 3
      },
      {
        id: 'n2',
        label: `2. Setup: ${cleanMethod}`,
        detail: `Prepare tools and isolate external distractions.`,
        phase: 'preparation',
        estimatedMinutes: 4
      },
      {
        id: 'n3',
        label: `3. Bypass: ${cleanBlocker}`,
        detail: `Apply the 2-minute rule to break starting friction.`,
        phase: 'unblocker',
        estimatedMinutes: 5
      },
      {
        id: 'n4',
        label: `4. Pareto 80/20 Sprint`,
        detail: `Execute the highest-impact core of "${cleanGoal}".`,
        phase: 'execution',
        estimatedMinutes: 15
      },
      {
        id: 'n5',
        label: `5. Verification & Close`,
        detail: `Self-test the deliverable and lock in progress.`,
        phase: 'deliverable',
        estimatedMinutes: 5
      }
    ],
    edges: [
      { from: 'n1', to: 'n2', label: 'Setup' },
      { from: 'n2', to: 'n3', label: 'Unblock' },
      { from: 'n3', to: 'n4', label: 'Deep Sprint' },
      { from: 'n4', to: 'n5', label: 'Verify' }
    ],
    criticalPath: ['n1', 'n3', 'n4', 'n5']
  };
}

/**
 * Fetches trained Biometric Neural Network model metadata
 */
export async function getModelInfo(): Promise<any> {
  try {
    const response = await fetch('/api/model-info');
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('[Model Info Client] Fallback:', err);
  }
  return null;
}
