/**
 * NeuroSynk AI Core - Universal Gemini Client Service
 * Estrategia de Carril Rápido:
 * - Ping en paralelo (Promise.any) a los modelos candidatos (gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash).
 * - El primer modelo que responda queda fijado automáticamente como el modelo activo del sistema.
 * - Timeouts agresivos de seguridad (3.5s) para garantizar que la UI nunca se quede congelada.
 */

export const CANDIDATE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3-flash-preview'
];

let activeConfirmedModel: string = 'gemini-2.5-flash-lite';

/**
 * Limpia y normaliza la clave de API eliminando comillas, espacios y saltos residuales
 */
export function sanitizeApiKey(rawKey?: string): string {
  if (!rawKey) {
    if (typeof window !== 'undefined') {
      rawKey = localStorage.getItem('gemini_api_key') || '';
    } else {
      rawKey = '';
    }
  }
  return rawKey.trim().replace(/^["']|["']$/g, '');
}

/**
 * Dispara una llamada simultánea en paralelo a cada modelo de Gemini.
 * El primero que responda con éxito es fijado como el modelo de la aplicación.
 */
export async function findFastestWorkingModel(apiKey: string): Promise<string> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) return 'gemini-2.5-flash-lite';

  const testModel = async (model: string): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 4000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }]
        }),
        signal: ctrl.signal
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`[${model}] ${err?.error?.message || res.status}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`[${model}] Respuesta vacía`);
      return model;
    } catch (e: any) {
      clearTimeout(timeout);
      throw e;
    }
  };

  try {
    const winner = await Promise.any(CANDIDATE_MODELS.map(m => testModel(m)));
    activeConfirmedModel = winner;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gemini_confirmed_model', winner);
    }
    return winner;
  } catch (aggErr: any) {
    console.warn("[Gemini Fast Ping] Modelos fallaron en paralelo:", aggErr?.errors);
    return 'gemini-2.5-flash-lite';
  }
}

/**
 * Prueba la conectividad directa y encuentra el modelo más rápido en tiempo real
 */
export async function testGeminiConnection(
  apiKey?: string
): Promise<{ success: boolean; message: string; model?: string }> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    return { success: false, message: 'La clave de API está vacía. Pega tu clave de Google AI Studio.' };
  }

  try {
    const winner = await findFastestWorkingModel(cleanKey);
    return {
      success: true,
      message: `Enlace establecido con éxito. Modelo activo: ${winner}`,
      model: winner
    };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error al conectar con Google Gemini' };
  }
}

/**
 * Llamada directa ultra-rápida a Google Generative Language API
 */
export async function callGoogleGeminiDirect(
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  isJson: boolean = false
): Promise<string> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    throw new Error("Clave de Gemini API no especificada. Por favor configúrala en el icono ⚙️.");
  }

  // Siempre intentar en orden de velocidad y menor saturación
  const modelsToTry = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3-flash-preview'
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    // Fusión directa de instrucciones de sistema en el contenido del usuario para latencia mínima
    const fullUserText = systemInstruction
      ? `[INSTRUCCIONES DEL SISTEMA]\n${systemInstruction}\n\n[MENSAJE DEL USUARIO]\n${userContent}`
      : userContent;

    const payload: any = {
      contents: [
        {
          role: "user",
          parts: [{ text: fullUserText }]
        }
      ]
    };

    if (isJson) {
      payload.generationConfig = {
        responseMimeType: "application/json"
      };
    }

    // Probar hasta 2 veces por modelo si Google da 503 transitorio
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 5000);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) {
            activeConfirmedModel = model;
            if (typeof window !== 'undefined') {
              localStorage.setItem('gemini_confirmed_model', model);
            }
            return text;
          }
        } else if (res.status === 503 && attempt === 0) {
          // Pico transitorio de demanda en Google: esperar 400ms y reintentar
          await new Promise(r => setTimeout(r, 400));
          continue;
        } else {
          const errJson = await res.json().catch(() => ({}));
          lastError = new Error(errJson?.error?.message || `HTTP ${res.status}`);
          break;
        }
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
        break;
      }
    }
  }

  throw lastError || new Error("Google Gemini no devolvió respuesta.");
}

export interface ChatMessageItem {
  role: string;
  content: string;
}

/**
 * Chat universal sin esperas innecesarias
 */
export async function chatUniversal(
  messages: ChatMessageItem[],
  apiKey: string,
  currentStep: string = '',
  taskContext: string = ''
): Promise<{ reply: string; proposal?: any }> {
  const userText = messages[messages.length - 1]?.content || '';
  const cleanKey = sanitizeApiKey(apiKey);

  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': cleanKey
        },
        body: JSON.stringify({
          message: userText,
          messages,
          currentStep: currentStep || 'Trabajo en curso',
          taskContext: taskContext || 'General'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (typeof data.reply === 'string') {
          return data;
        }
      }
    } catch (e) {
      // Continuar a llamada directa
    }
  }

  if (!cleanKey) {
    return {
      reply: "⚠️ No hay clave de Gemini API configurada. Abre Ajustes (⚙️ arriba a la derecha) e introduce tu clave para chatear con el Mentor."
    };
  }

  const prompt_sistema = `Eres el Mentor de Ejecución y Co-presencia de NeuroSynk.
Tu misión es mantener al estudiante en acción resolviendo dudas de forma quirúrgica.
Contexto: Meta: "${taskContext || 'General'}" | Paso activo: "${currentStep || 'Trabajo en curso'}".

INSTRUCCIONES DE RESPUESTA:
1. Si el usuario pide explicación ("no entiendo", "explícalo", "ayuda"): Explica en UNA sola frase directa el concepto central del paso y da una micro-acción física inmediata.
2. Si el usuario reporta distracción o evasión: Ordena interrumpir el distractor e iniciar una acción de 30 segundos en el paso.
3. Si el usuario reporta avance ("listo", "ya"): Valida el avance e impulsa al siguiente paso.

REGLAS DE FORMATO ESTRICTAS:
- Inicia SIEMPRE con un VERBO DE ACCIÓN EN MAYÚSCULAS (ej. REVISA, IDENTIFICA, ESCRIBE, ENFOCA, CONTINÚA).
- Máximo 2 oraciones (menos de 28 palabras en total).
- Cero Markdown (sin asteriscos, sin negritas).
- Tono de co-presencia ("nosotros / estamos").`;

  const userContent = `Paso en pantalla: "${currentStep || 'No especificado'}"\nMensaje del usuario: "${userText}"`;

  try {
    const text = await callGoogleGeminiDirect(cleanKey, prompt_sistema, userContent, false);
    const cleanReply = text ? text.replace(/[*_#]/g, '').trim() : "AVANZA con el primer detalle del paso. Aquí sigo contigo.";
    return { reply: cleanReply };
  } catch (err: any) {
    console.error("[Gemini Direct Chat] Error:", err);
    const errMsg = String(err?.message || '');
    const isHighDemand = errMsg.toLowerCase().includes('demand') || errMsg.includes('503');
    if (isHighDemand) {
      return {
        reply: `ESTAMOS listos en: "${currentStep || 'este paso'}". Continúa con la primera acción inmediata para no perder el ritmo mientras se disipa la demanda de Google.`
      };
    }
    return {
      reply: `⚠️ Error de Gemini API: ${err?.message || 'Error de conexión'}. Revisa tu clave en Ajustes ⚙️.`
    };
  }
}

export interface SurveyQuestionItem {
  id: string;
  question: string;
  options: string[];
}

export const DEFAULT_SURVEY_QUESTIONS: SurveyQuestionItem[] = [
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

/**
 * Task Survey universal con timeout de protección de 3.5 segundos
 */
export async function taskSurveyUniversal(
  task: string,
  apiKey: string
): Promise<{ questions: SurveyQuestionItem[] }> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    return { questions: DEFAULT_SURVEY_QUESTIONS };
  }

  const prompt_sistema = `Eres el Diagnosticador Cognitivo y de Tareas de NeuroSynk.
Tu misión es diseñar una encuesta de calibración rápida de EXACTAMENTE 5 preguntas breves a partir de la meta introducida por el usuario.

ESTRUCTURA OBLIGATORIA DE LA ENCUESTA:
- Pregunta 1 (id: "q1") DEBE SER OBLIGATORIAMENTE sobre el tiempo disponible para la sesión:
  question: "¿Cuánto tiempo dedicarás a esta sesión?"
  options: ["25 a 30 minutos (Sprint corto)", "45 a 60 minutos (Sesión estándar)", "90 a 120 minutos (Sesión profunda)"]
- Pregunta 2 (id: "q2"): Alcance y avance tangible que busca lograr en ese lapso.
- Pregunta 3 (id: "q3"): Conocimiento previo e insumos/materiales (si parte de cero o domina bases).
- Pregunta 4 (id: "q4"): Nivel de energía ejecutiva y dispersión mental actual.
- Pregunta 5 (id: "q5"): Punto habitual de fricción (arranque, mitad o cierre).

REGLAS DE FORMATO:
- Genera exactamente 5 preguntas (id: "q1" a "q5").
- Cada pregunta debe ser ultra-concisa (máximo 14 palabras).
- Preguntas q2 a q5 DEBEN incluir entre 2 y 3 opciones de respuesta rápida (máximo 6 palabras por opción) para responderse con un solo clic.
- Cero suposiciones fijas o materias impuestas. Las preguntas deben nacer de la meta introducida y del perfil del usuario.
- Respuesta en formato JSON estricto con la propiedad "questions".`;

  const fetchSurvey = async (): Promise<{ questions: SurveyQuestionItem[] }> => {
    const text = await callGoogleGeminiDirect(cleanKey, prompt_sistema, `Meta: "${task}"`, true);
    const data = JSON.parse(text);
    if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
      return { questions: data.questions };
    }
    return { questions: DEFAULT_SURVEY_QUESTIONS };
  };

  // Timeout guard: Si tarda más de 3.5 segundos, abrir la encuesta predeterminada al instante
  const timeoutPromise = new Promise<{ questions: SurveyQuestionItem[] }>((resolve) =>
    setTimeout(() => {
      resolve({ questions: DEFAULT_SURVEY_QUESTIONS });
    }, 3500)
  );

  try {
    return await Promise.race([fetchSurvey(), timeoutPromise]);
  } catch (err) {
    return { questions: DEFAULT_SURVEY_QUESTIONS };
  }
}

/**
 * Split Task universal adaptado al tiempo y pomodoro cognitivo
 */
export async function splitTaskUniversal(
  task: string,
  surveyAnswers: Record<string, string>,
  context: string,
  apiKey: string
): Promise<{ steps: string[] }> {
  const cleanKey = sanitizeApiKey(apiKey);

  const getFallbackSteps = (targetTask: string, answers: any): string[] => {
    const timeAns = String(answers?.q1 || '').toLowerCase();
    const isShort = timeAns.includes('25') || timeAns.includes('30') || timeAns.includes('sprint');
    const isLong = timeAns.includes('90') || timeAns.includes('120') || timeAns.includes('profunda');

    if (isShort) {
      return [
        `DELIMITA una porción atómica y concreta de '${targetTask}' para abordar en este sprint corto.`,
        `ABRE tu espacio de trabajo manteniendo a la vista únicamente el material indispensable.`,
        `EJECUTA el desarrollo directo del primer núcleo temático sin desviar la atención.`,
        `SINTETIZA el resultado alcanzado y registra la conclusión de tu bloque.`
      ];
    }

    if (isLong) {
      return [
        `DELIMITA los tres núcleos principales de trabajo que estructurarán tu sesión sobre '${targetTask}'.`,
        `ORGANIZA los materiales y notas para el primer bloque de avance conceptual.`,
        `DESARROLLA los fundamentos y primeros ejercicios del tema central con concentración plena.`,
        `PAUSA SOMÁTICA: Despeja la vista de la pantalla, bebe agua y estira los brazos por 4 minutos.`,
        `PROFUNDIZA en la aplicación práctica y resolución de problemas del segundo bloque.`,
        `SINTETIZA los argumentos o fórmulas clave generados durante la práctica profunda.`,
        `PAUSA SOMÁTICA: Levántate del asiento, respira profundo y camina unos pasos por 5 minutos.`,
        `CONSOLIDA el tercer bloque resolviendo dudas residuales o puliendo detalles técnicos.`,
        `VERIFICA el dominio operativo completo contrastando tu producción contra el objetivo inicial.`
      ];
    }

    return [
      `DELIMITA el objetivo específico y materiales necesarios para este bloque de '${targetTask}'.`,
      `ANALIZA el primer núcleo conceptual identificando definiciones clave y sus relaciones.`,
      `DESARROLLA la primera sección o ejercicio aplicando los métodos centrales del tema.`,
      `PAUSA SOMÁTICA: Despeja la vista de la pantalla, bebe agua y estira los brazos por 3 minutos.`,
      `EJECUTA la segunda fase de práctica o redacción consolidando los conceptos trabajados.`,
      `VERIFICA los resultados obtenidos y formula un resumen de validación final.`
    ];
  };

  if (!cleanKey) {
    return { steps: getFallbackSteps(task, surveyAnswers) };
  }

  const prompt_sistema = `Eres el Arquitecto de Planificación y Enfoque de NeuroSynk.
Tu misión es diseñar una sesión de trabajo realista basada en las respuestas de la encuesta del usuario, especialmente su TIEMPO DISPONIBLE y su ESTADO COGNITIVO.

LÓGICA DE PLANIFICACIÓN POR TIEMPO Y RITMO (POMODORO ADAPTATIVO):
1. RESTRICCIÓN DE TIEMPO (Variable Reina):
   - Sesión de ~30 min: Diseña UN SOLO bloque de enfoque concentrado en una porción atómica y alcanzable (4 a 5 micro-pasos en total).
   - Sesión de 45-60 min: Diseña DOS bloques de enfoque separados por una micro-pausa somática de 3-5 minutos (6 a 8 pasos en total).
   - Sesión de 90-120 min: Diseña TRES bloques de enfoque intercalados con pausas breves de biorregulación (9 a 12 pasos en total).

REGLAS DE FORMATO:
- Cada paso debe iniciar obligatoriamente con un VERBO DE ACCIÓN EN MAYÚSCULAS (ej. IDENTIFICA, REDACTA, RESUELVE, PAUSA, VERIFICA).
- Longitud: Entre 12 y 22 palabras por paso. Cero formato Markdown.
- Devuelve un JSON estructurado con la propiedad "steps" (array de strings).`;

  const userContent = `OBJETIVO: "${task}"\nRESPUESTAS: ${JSON.stringify(surveyAnswers || {})}\nCONTEXTO: "${context || 'Ninguno'}"`;

  const fetchSteps = async (): Promise<{ steps: string[] }> => {
    const text = await callGoogleGeminiDirect(cleanKey, prompt_sistema, userContent, true);
    const data = JSON.parse(text);
    if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
      return { steps: data.steps.map((s: string) => s.replace(/(Paso \d+:)/i, '').replace(/\*/g, '').trim()) };
    }
    return { steps: getFallbackSteps(task, surveyAnswers) };
  };

  const timeoutSteps = new Promise<{ steps: string[] }>((resolve) =>
    setTimeout(() => {
      resolve({ steps: getFallbackSteps(task, surveyAnswers) });
    }, 4500)
  );

  try {
    return await Promise.race([fetchSteps(), timeoutSteps]);
  } catch (err) {
    return { steps: getFallbackSteps(task, surveyAnswers) };
  }
}

/**
 * Subdivide Step universal
 */
export async function subdivideStepUniversal(
  parentStep: string,
  taskContext: string,
  stepNumber: number,
  apiKey: string
): Promise<{ subSteps: string[] }> {
  const cleanKey = sanitizeApiKey(apiKey);

  const defaultNanoSteps = [
    "TOMA tu pluma o sitúa el cursor directamente en tu espacio de trabajo.",
    "LOCALIZA únicamente la primera línea o concepto introductorio.",
    "ESCRIBE la primera palabra clave para romper la inercia."
  ];

  if (!cleanKey) {
    return { subSteps: defaultNanoSteps };
  }

  const prompt_sistema = `Eres el Rescatista Ejecutivo de NeuroSynk.
Tu misión es recibir un paso donde el usuario experimenta bloqueo o parálisis cognitiva y fragmentarlo en exactamente 3 NANO-PASOS secuenciales de fricción cero (<60 segundos cada uno).

REGLAS DE FORMATO:
- Cada nano-paso debe iniciar obligatoriamente con un VERBO DE ACCIÓN FÍSICA EN MAYÚSCULAS (ej. TOMA, LOCALIZA, ESCRIBE).
- Longitud: Entre 8 y 16 palabras por nano-paso. Cero Markdown.
- Devuelve un JSON estructurado con la clave "subSteps" conteniendo un arreglo de 3 strings.`;

  const userContent = `Paso bloqueado: ${parentStep}\nContexto de la tarea: ${taskContext || 'General'}`;

  try {
    const text = await callGoogleGeminiDirect(cleanKey, prompt_sistema, userContent, true);
    const data = JSON.parse(text);
    if (data.subSteps && Array.isArray(data.subSteps) && data.subSteps.length > 0) {
      return { subSteps: data.subSteps.map((s: string) => s.replace(/\*/g, '').trim()) };
    }
  } catch (err) {
    console.warn("[Gemini Direct Subdivide] Error:", err);
  }

  return { subSteps: defaultNanoSteps };
}
