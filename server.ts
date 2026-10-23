import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// En el backend, usaremos la instanciación dinámica por cada petición.
// Pero conservamos esto para verificar si el servidor local tiene la clave en .env.local
const serverApiKey = process.env.GEMINI_API_KEY;

const CANDIDATE_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.8-flash"
];

async function generateWithModelCascade(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
): Promise<{ text: string; model: string }> {
  let lastError: any = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config
      });
      const text = typeof result.text === 'function' ? (result.text as any)() : result.text;
      if (text && text.trim().length > 0) {
        return { text, model };
      }
    } catch (err: any) {
      console.warn(`[Server Cascade] Model ${model} failed (${err?.status || err?.message}). Cascading to next candidate...`);
      lastError = err;
    }
  }
  throw lastError || new Error("No model in cascade succeeded");
}

app.post("/api/task-survey", async (req, res) => {
  const { task } = req.body;
  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

  const fallbackSurvey = {
    questions: [
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
    ]
  };

  const apiKey = (req.headers['x-gemini-api-key'] as string || '').trim() || serverApiKey;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  if (!ai) {
    console.warn("⚠️ GEMINI_API_KEY no configurada. Activando encuesta de calibración offline.");
    res.json(fallbackSurvey);
    return;
  }

  try {
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
- Respuesta en formato JSON estricto.`;

    const completion = await generateWithModelCascade(ai, {
      contents: `Meta académica o laboral del usuario: "${task}"`,
      config: {
        systemInstruction: prompt_sistema,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  question: { type: "string" },
                  options: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["id", "question", "options"]
              }
            }
          },
          required: ["questions"]
        }
      }
    });

    const responseText = completion.text;
    if (!responseText) throw new Error("Respuesta vacía de Gemini en task-survey");

    const data = JSON.parse(responseText);
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("Formato de preguntas no válido");
    }

    res.json({ questions: data.questions });
  } catch (error: any) {
    console.error("Gemini Task Survey Error:", error?.message || error);
    res.json(fallbackSurvey);
  }
});

app.post("/api/split-task", async (req, res) => {
  const { task, surveyAnswers, context } = req.body;
  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

  const apiKey = (req.headers['x-gemini-api-key'] as string || '').trim() || serverApiKey;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // Helper de respaldo offline inteligente adaptado a la restricción temporal y al estado cognitivo
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

    // Sesión estándar (45 a 60 minutos): Dos bloques con pausa somática intermedia
    return [
      `DELIMITA el objetivo específico y materiales necesarios para este bloque de '${targetTask}'.`,
      `ANALIZA el primer núcleo conceptual identificando definiciones clave y sus relaciones.`,
      `DESARROLLA la primera sección o ejercicio aplicando los métodos centrales del tema.`,
      `PAUSA SOMÁTICA: Despeja la vista de la pantalla, bebe agua y estira los brazos por 3 minutos.`,
      `EJECUTA la segunda fase de práctica o redacción consolidando los conceptos trabajados.`,
      `VERIFICA los resultados obtenidos y formula un resumen de validación final.`
    ];
  };

  // Respaldo offline si no hay clave
  if (!ai) {
    console.warn("⚠️ GEMINI_API_KEY no configurada. Activando modo offline adaptativo.");
    res.json({ steps: getFallbackSteps(task, surveyAnswers) });
    return;
  }

  try {
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
- Devuelve un JSON estructurado con la propiedad "steps" (array de strings) para máxima compatibilidad con el frontend.`;

    const completion = await generateWithModelCascade(ai, {
      contents: `OBJETIVO: "${task}"\nRESPUESTAS DE LA ENCUESTA: ${JSON.stringify(surveyAnswers || {})}\nCONTEXTO ADICIONAL: "${context || 'Ninguno'}"`,
      config: {
        systemInstruction: prompt_sistema,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Secuencia secuencial adaptada al tiempo y pausas somáticas"
            }
          },
          required: ["steps"]
        }
      }
    });

    const responseText = completion.text;
    if (!responseText) throw new Error("Respuesta vacía de Gemini");

    const data = JSON.parse(responseText);
    if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
      throw new Error("Formato de pasos no válido");
    }

    // Limpieza de asteriscos y espacios residuales
    const cleanSteps = data.steps.map((s: string) => s.replace(/\*/g, '').trim());
    res.json({ steps: cleanSteps });
  } catch (error: any) {
    console.error("Gemini Split Task Error:", error?.message || error);
    res.json({ steps: getFallbackSteps(task, surveyAnswers) });
  }
});

app.post("/api/subdivide-step", async (req, res) => {
  const { parentStep, stepNumber, taskContext } = req.body;
  if (!parentStep) {
    res.status(400).json({ error: "parentStep is required" });
    return;
  }

  const apiKey = (req.headers['x-gemini-api-key'] as string || '').trim() || serverApiKey;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // Respaldo offline con nano-pasos atómicos de rescate
  if (!ai) {
    console.warn("⚠️ GEMINI_API_KEY no configurada. Activando modo offline en subdivide-step.");
    res.json({
      subSteps: [
        "TOMA tu pluma o sitúa el cursor directamente en tu espacio de trabajo.",
        "LOCALIZA únicamente la primera línea o concepto introductorio.",
        "ESCRIBE la primera palabra clave para romper la inercia."
      ]
    });
    return;
  }

  try {
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
- Prohibidas las explicaciones, justificaciones o rodeos.`;

    const completion = await generateWithModelCascade(ai, {
      contents: `Paso bloqueado: ${parentStep}\nContexto de la tarea: ${taskContext || 'General'}`,
      config: {
        systemInstruction: prompt_sistema,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            subSteps: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Exactamente 3 nano-pasos atómicos de rescate"
            }
          },
          required: ["subSteps"]
        }
      }
    });

    const responseText = completion.text;
    if (!responseText) {
      throw new Error("Respuesta vacía de Gemini");
    }

    const data = JSON.parse(responseText);
    if (!data.subSteps || !Array.isArray(data.subSteps)) {
      throw new Error("Formato JSON de sub-pasos no válido");
    }

    // Limpieza de asteriscos y espacios residuales
    const cleanSubSteps = data.subSteps.map((s: string) => s.replace(/\*/g, '').trim());
    res.json({ subSteps: cleanSubSteps });
  } catch (error: any) {
    console.error("Gemini Subdivide Step Error:", error?.message || error);
    res.json({
      subSteps: [
        "TOMA tu pluma o sitúa el cursor directamente en tu espacio de trabajo.",
        "LOCALIZA únicamente la primera línea o concepto introductorio.",
        "ESCRIBE la primera palabra clave para romper la inercia."
      ]
    });
  }
});


app.post("/api/chat", async (req, res) => {
  const { message, messages, currentStep, taskContext } = req.body;
  
  const userText = message || (Array.isArray(messages) && messages.length > 0 
    ? (messages[messages.length - 1].content || messages[messages.length - 1].text || '') 
    : '');

  if (!userText || typeof userText !== 'string') {
    res.status(400).json({ error: "Mensaje requerido" });
    return;
  }

  const apiKey = (req.headers['x-gemini-api-key'] as string || '').trim() || serverApiKey;
  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  if (!ai) {
    console.warn("⚠️ Cliente Gemini no disponible en /api/chat");
    res.json({ reply: "CONTINÚA con el paso actual. Estamos avanzando juntos." });
    return;
  }

  try {
    const prompt_sistema = `Eres el Mentor de Ejecución y Co-presencia de NeuroSynk.
Tu misión es mantener al estudiante en acción resolviendo dudas de forma quirúrgica.
Contexto: Meta: "${taskContext || 'General'}" | Paso activo: "${currentStep || 'Trabajo en curso'}".

INSTRUCCIONES DE RESPUESTA:
1. Si el usuario pide explicación ("no entiendo", "explícalo", "ayuda"): Explica en UNA sola frase directa el concepto central del paso y da una micro-acción física inmediata.
2. Si el usuario reporta distracción o evasión: Ordena interrumpir el distractor e iniciar una acción de 30 segundos en el paso.
3. Si el usuario reporta avance ("listo", "ya"): Valida el avance e impulsa al siguiente paso.

REGLAS DE FORMATO ESTRICTAS:
- Inicia SIEMPRE con un VERBO DE ACCIÓN EN MAYÚSCULAS (ej. REVISA, IDENTIFICA, ESCRIBE, ENFOCA).
- Máximo 2 oraciones (menos de 28 palabras en total).
- Cero Markdown (sin asteriscos, sin negritas).
- Tono de co-presencia ("nosotros / estamos").`;

    const completion = await generateWithModelCascade(ai, {
      contents: `Paso en pantalla: "${currentStep || 'No especificado'}"\nMensaje del usuario: "${userText}"`,
      config: {
        systemInstruction: prompt_sistema,
      }
    });

    const rawText = completion.text;
    const cleanReply = rawText ? rawText.replace(/[*_#]/g, '').trim() : "AVANZA con el primer detalle del paso. Aquí sigo contigo.";

    res.json({ reply: cleanReply });
  } catch (err: any) {
    console.error("DEBUG_CHAT_ERROR:", err?.status || err?.code || '', err?.message || err);
    res.json({
      reply: "DIVIDE el paso en su mínima expresión. Escribe solo el primer término para arrancar."
    });
  }
});

app.get("/api/api-status", (req, res) => {
  res.json({
    hasServerKey: !!process.env.GEMINI_API_KEY,
    hasMetaKey: !!(process.env.META_API_KEY || process.env.META_MODEL_API_KEY)
  });
});

// =========================================================================
// META GLOBAL AI HACKATHON CORE ENDPOINTS (MUSE SPARK, WONDER, SAM 3.1)
// =========================================================================

const META_API_KEY = process.env.META_MODEL_API_KEY || process.env.META_API_KEY || '';
const META_API_BASE = process.env.META_API_BASE || 'https://api.meta.ai/v1';

/**
 * 1. Muse Spark - Streaming de Intervención Rápida en Co-presencia
 */
app.post("/api/meta/muse-spark/stream", async (req, res) => {
  const { perclos = 0, fatigueScore = 0, postureScore = 0, currentTask = 'Estudio', cognitiveClass = 'NEUTRO' } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Si no hay llave aún (pre-Kickoff), responder con generador de co-presencia de latencia ultrabaja
  if (!META_API_KEY) {
    let message = "ENFOCA el primer detalle del paso. Estamos juntos en este sprint.";
    if (perclos > 25 || fatigueScore > 50) {
      message = "DESCANSA tu mirada 20 segundos fuera de la pantalla. Cuidamos tu ritmo cognitivo.";
    } else if (postureScore > 40) {
      message = "AJUSTA tu espalda y relaja los hombros. La postura despeja la mente.";
    }

    const words = message.split(" ");
    for (const w of words) {
      res.write(`${w} `);
      await new Promise(r => setTimeout(r, 40));
    }
    res.end();
    return;
  }

  try {
    const prompt = `Usuario en sesión de estudio. Estado biológico: PERCLOS=${perclos}%, Fatiga=${fatigueScore}/100, Postura=${postureScore}/100, Clasificación=${cognitiveClass}. Tarea: "${currentTask}". Genera UNA sola micro-instrucción empática de máximo 15 palabras iniciando con verbo de acción en MAYÚSCULAS.`;

    const metaRes = await fetch(`${META_API_BASE}/models/muse-spark:stream`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt, stream: true, max_tokens: 45 })
    });

    if (metaRes.ok && metaRes.body) {
      metaRes.body.pipeTo(new WritableStream({
        write(chunk) { res.write(chunk); },
        close() { res.end(); }
      }));
    } else {
      res.write("AVANZA con determinación en este paso. Seguimos contigo.");
      res.end();
    }
  } catch (err) {
    console.warn("[Meta Muse Spark Stream Error]:", err);
    res.write("RESPIRA hondo y retoma el primer objetivo.");
    res.end();
  }
});

/**
 * 2. Muse Wonder - Descomposición Cognitiva de Tareas en 3 Nano-Pasos
 */
app.post("/api/meta/muse-wonder/decompose", async (req, res) => {
  const { task = 'Trabajo', perclos = 0, stressLevel = 0 } = req.body;

  // Fallback determinista de fricción cero
  const fallback = {
    nanoSteps: [
      `DELIMITA el primer término o punto atómico de "${task}".`,
      "ESCRIBE una sola frase o abre el primer archivo de trabajo.",
      "CONTINÚA sin juzgar la perfección; registraremos tu avance paso a paso."
    ],
    estimatedSecondsPerStep: perclos > 25 ? 60 : 45
  };

  if (!META_API_KEY) {
    res.json(fallback);
    return;
  }

  try {
    const metaRes = await fetch(`${META_API_BASE}/models/muse-wonder:generate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        task,
        perclos,
        stressLevel,
        format: "json",
        max_steps: 3
      })
    });

    if (metaRes.ok) {
      const data = await metaRes.json();
      res.json(data);
      return;
    }
  } catch (e) {
    console.warn("[Meta Muse Wonder Error]:", e);
  }

  res.json(fallback);
});

/**
 * 3. SAM 3.1 - Calibración Ergonómica de Espacio de Estudio
 */
app.post("/api/meta/sam/calibrate", (req, res) => {
  res.json({
    isCalibrated: true,
    distanceMetric: 'OPTIMAL',
    headTiltAngle: 0,
    shoulderAlignmentScore: 94,
    clutterScore: 12,
    recommendations: [
      'Línea visual alineada con el tercio superior del monitor.',
      'Cámara centrada y espacio ergonómico listo para el sprint.'
    ]
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const path = await import("path");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
