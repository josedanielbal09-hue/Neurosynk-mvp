/**
 * NeuroSynk AI Core - Universal Gemini Client Service
 * Soporta llamadas híbridas con detección precisa de entorno:
 * 1. En localhost: intenta primero el backend local (/api/*).
 * 2. En Cloudflare / producción estática: realiza llamada HTTPS directa a Google Generative Language API con rotación de modelos y reintento resiliente.
 */

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash-exp'
];

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
 * Prueba la conectividad directa con la API de Google Gemini y devuelve diagnóstico claro
 */
export async function testGeminiConnection(
  apiKey?: string
): Promise<{ success: boolean; message: string }> {
  const cleanKey = sanitizeApiKey(apiKey);
  if (!cleanKey) {
    return { success: false, message: 'La clave de API está vacía. Pega tu clave de Google AI Studio.' };
  }

  try {
    const text = await callGoogleGeminiDirect(
      cleanKey,
      'Responde únicamente con "Conexión activa".',
      'Test de enlace.',
      false
    );
    return { success: true, message: `Conexión exitosa con Gemini: "${text.trim()}"` };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error desconocido al conectar con Google Gemini' };
  }
}

/**
 * Llamada directa a la API REST de Google Generative Language desde el navegador
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

  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    // Intentar primero con payload estándar (systemInstruction estructurado)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    // Intento A: Con systemInstruction oficial
    try {
      const payload: any = {
        contents: [
          {
            role: "user",
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
          responseMimeType: "application/json"
        };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) return text;
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${res.status}`;
        lastError = new Error(errMsg);

        // Si el error fue 400 por systemInstruction no soportado en ese tier, probar Intento B
        if (res.status === 400 && systemInstruction) {
          const fallbackPayload: any = {
            contents: [
              {
                role: "user",
                parts: [{ text: `[INSTRUCCIONES DEL SISTEMA]\n${systemInstruction}\n\n[MENSAJE DEL USUARIO]\n${userContent}` }]
              }
            ]
          };
          if (isJson) {
            fallbackPayload.generationConfig = { responseMimeType: "application/json" };
          }
          const resFallback = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fallbackPayload)
          });
          if (resFallback.ok) {
            const dataFb = await resFallback.json();
            const textFb = dataFb.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textFb && textFb.trim().length > 0) return textFb;
          } else {
            const errFb = await resFallback.json().catch(() => ({}));
            lastError = new Error(errFb?.error?.message || errMsg);
          }
        }
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("Google Gemini no devolvió respuesta. Verifica la validez de tu API Key.");
}

export interface ChatMessageItem {
  role: string;
  content: string;
}

/**
 * Chat universal: Intenta backend local solo si es localhost; de lo contrario consulta directamente a Gemini
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

  // 1. Intentar backend local únicamente en desarrollo local
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

  // 2. Si no hay clave
  if (!cleanKey) {
    return {
      reply: "⚠️ No hay clave de Gemini API configurada. Abre Ajustes (⚙️ arriba a la derecha) e introduce tu clave para chatear con el Mentor."
    };
  }

  // 3. Llamada directa a Gemini desde el navegador
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
 * Task Survey universal
 */
export async function taskSurveyUniversal(
  task: string,
  apiKey: string
): Promise<{ questions: SurveyQuestionItem[] }> {
  const cleanKey = sanitizeApiKey(apiKey);
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost) {
    try {
      const res = await fetch('/api/task-survey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': cleanKey
        },
        body: JSON.stringify({ task })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
          return data;
        }
      }
    } catch (e) {
      // Continuar a llamada directa
    }
  }

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

  try {
    const text = await callGoogleGeminiDirect(cleanKey, prompt_sistema, `Meta académica o laboral del usuario: "${task}"`, true);
    const data = JSON.parse(text);
    if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
      return { questions: data.questions };
    }
  } catch (err) {
    console.warn("[Gemini Direct Task Survey] Error:", err);
  }

  return { questions: DEFAULT_SURVEY_QUESTIONS };
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

  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost) {
    try {
      const res = await fetch('/api/split-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': cleanKey
        },
        body: JSON.stringify({
          task,
          surveyAnswers,
          context
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
          return { steps: data.steps.map((s: string) => s.replace(/(Paso \d+:)/i, '').replace(/\*/g, '').trim()) };
        }
      }
    } catch (e) {
      // Continuar a llamada directa
    }
  }

  if (!cleanKey) {
    return { steps: getFallbackSteps(task, surveyAnswers) };
  }

  const prompt_sistema = `Eres el Arquitecto de Planificación y Enfoque de NeuroSynk.
Tu misión es diseñar una sesión de trabajo realista basada en las respuestas de la encuesta del usuario, especialmente su TIEMPO DISPONIBLE y su ESTADO COGNITIVO.

LÓGICA DE PLANIFICACIÓN POR TIEMPO Y RITMO (POMODORO ADAPTATIVO):
1. RESTRICCIÓN DE TIEMPO (Variable Reina):
   - Sesión de ~30 min: Diseña UN SOLO bloque de enfoque concentrado en una porción atómica y alcanzable (4 a 5 micro-pasos en total). Prohibido abarcar temarios completos.
   - Sesión de 45-60 min: Diseña DOS bloques de enfoque separados por una micro-pausa somática de 3-5 minutos (ej. 6 a 8 pasos en total, insertando un paso de PAUSA SOMÁTICA al medio).
   - Sesión de 90-120 min: Diseña TRES bloques de enfoque intercalados con pausas breves de biorregulación y un hito final de verificación o cierre (9 a 12 pasos en total).

2. INCORPORACIÓN DE PAUSAS SOMÁTICAS EN LA SECUENCIA:
   - Cuando la sesión requiera descanso entre bloques, el paso DEBE redactarse como una instrucción activa de recuperación física (ej. "PAUSA SOMÁTICA: Despeja la vista de la pantalla, bebe agua y estira los brazos por 3 minutos.").

3. CALIBRACIÓN POR CONOCIMIENTO Y ENERGÍA:
   - Si el usuario indicó conocimiento previo bajo o parálisis/fatiga, los 2 primeros pasos deben ser de fricción ultra-baja (<60 seg) para romper la inercia.
   - Si el usuario indicó conocimiento avanzado y alta energía, omite introducciones y enfoca los bloques directamente en la práctica compleja o redacción avanzada.

REGLAS DE FORMATO:
- Cada paso debe iniciar obligatoriamente con un VERBO DE ACCIÓN EN MAYÚSCULAS (ej. IDENTIFICA, REDACTA, RESUELVE, PAUSA, VERIFICA).
- Longitud: Entre 12 y 22 palabras por paso. Cero formato Markdown.
- Devuelve un JSON estructurado con la propiedad "steps" (array de strings).`;

  const userContent = `OBJETIVO: "${task}"\nRESPUESTAS DE LA ENCUESTA: ${JSON.stringify(surveyAnswers || {})}\nCONTEXTO ADICIONAL: "${context || 'Ninguno'}"`;

  try {
    const text = await callGoogleGeminiDirect(cleanKey, prompt_sistema, userContent, true);
    const data = JSON.parse(text);
    if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
      return { steps: data.steps.map((s: string) => s.replace(/(Paso \d+:)/i, '').replace(/\*/g, '').trim()) };
    }
  } catch (err) {
    console.warn("[Gemini Direct Split Task] Error:", err);
  }

  return { steps: getFallbackSteps(task, surveyAnswers) };
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

  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalhost) {
    try {
      const res = await fetch('/api/subdivide-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': cleanKey
        },
        body: JSON.stringify({
          parentStep,
          taskContext,
          stepNumber
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.subSteps && Array.isArray(data.subSteps)) {
          return { subSteps: data.subSteps.map((s: string) => s.replace(/\*/g, '').trim()) };
        }
      }
    } catch (e) {
      // Continuar a llamada directa
    }
  }

  if (!cleanKey) {
    return { subSteps: defaultNanoSteps };
  }

  const prompt_sistema = `Eres el Rescatista Ejecutivo de NeuroSynk.
Tu misión es recibir un paso donde el usuario experimenta bloqueo o parálisis cognitiva y fragmentarlo en exactamente 3 NANO-PASOS secuenciales de fricción cero (<60 segundos cada uno).

REGLAS DE RESCATE ATÓMICO:
1. NANO-PASO 1: Anclaje físico o de cursor (ej. TOMA tu pluma, SITÚA el cursor, ABRE el documento).
2. NANO-PASO 2: Micro-lectura mínima (ej. LOCALIZA el primer renglón, REVISA la primera palabra).
3. NANO-PASO 3: Registro mecánico atómico (ej. ESCRIBE una sola palabra clave, ANOTA el título).

REGLAS DE FORMATO:
- Cada nano-paso debe iniciar obligatoriamente con un VERBO DE ACCIÓN FÍSICA EN MAYÚSCULAS (ej. TOMA, LOCALIZA, ESCRIBE).
- Longitud: Entre 8 y 16 palabras por nano-paso.
- Cero Markdown (prohibido usar asteriscos o negritas).
- Prohibidas las explicaciones, justificaciones o rodeos.
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
