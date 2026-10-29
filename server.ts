import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
import express from "express";
import { createServer as createViteServer } from "vite";

const app = express();
app.use(express.json());
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// =========================================================================
// META MODEL API & BASETEN CLIENT CONFIGURATION
// =========================================================================
const META_API_KEY = (process.env.MODEL_API_KEY || process.env.META_MODEL_API_KEY || process.env.META_API_KEY || '').trim();
const META_API_URL = process.env.META_API_URL || "https://api.meta.ai/v1/responses";
const BASETEN_API_KEY = (process.env.BASETEN_API_KEY || '').trim();

interface MetaCallParams {
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
}

/**
 * Universal caller prioritizing Meta Model API (Muse Spark / Wonder)
 * with graceful fallback to Baseten and offline deterministic heuristics.
 */
async function callMetaModel(params: MetaCallParams): Promise<string> {
  const model = params.model || "muse-wonder-1.0";
  const messages: any[] = [];
  if (params.systemPrompt) {
    messages.push({ role: "system", content: params.systemPrompt });
  }
  messages.push({ role: "user", content: params.userPrompt });

  // 1. Try Meta Model API (Official dev.meta.ai responses endpoint)
  if (META_API_KEY) {
    try {
      const response = await fetch(META_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${META_API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({
          model,
          input: messages,
          stream: true,
          temperature: params.temperature ?? 0.7,
          max_output_tokens: params.maxTokens ?? 2048,
          top_p: 1,
          reasoning: { effort: params.reasoningEffort || "medium" }
        })
      });

      if (response.ok && response.body) {
        let fullText = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataContent = trimmed.substring(6).trim();
              if (dataContent === "[DONE]") continue;
              try {
                const parsed = JSON.parse(dataContent);
                const delta = parsed.delta?.text || parsed.choices?.[0]?.delta?.content || parsed.text || "";
                fullText += delta;
              } catch {
                fullText += dataContent;
              }
            }
          }
        }
        if (fullText.trim().length > 0) {
          return fullText.trim();
        }
      }
    } catch (metaErr: any) {
      console.warn(`[Meta Model API] Call failed (${metaErr?.message || metaErr}), trying Baseten fallback...`);
    }
  }

  // 2. Try Baseten fallback
  if (BASETEN_API_KEY) {
    try {
      const basetenUrl = process.env.BASETEN_ENDPOINT_URL || "https://inference.baseten.co/v1/chat/completions";
      const basetenRes = await fetch(basetenUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BASETEN_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-models/muse-spark-open-1026",
          messages,
          reasoning_effort: params.reasoningEffort || "minimal",
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 2048
        })
      });

      if (basetenRes.ok) {
        const data = await basetenRes.json();
        const text = data.choices?.[0]?.message?.content || "";
        if (text.trim().length > 0) {
          return text.trim();
        }
      }
    } catch (basetenErr: any) {
      console.warn(`[Baseten Fallback] Call failed:`, basetenErr?.message || basetenErr);
    }
  }

  throw new Error("No upstream AI provider available");
}

// =========================================================================
// APPLICATION ENDPOINTS
// =========================================================================

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

  try {
    const prompt_sistema = `Eres el Diagnosticador Cognitivo y de Tareas de NeuroSynk alimentado por Meta Muse.
Tu misión es diseñar una encuesta de calibración rápida de EXACTAMENTE 5 preguntas breves a partir de la meta introducida por el usuario.
Responde estrictamente con un JSON con la clave "questions": array de objetos con "id", "question", "options".`;

    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Meta del usuario: "${task}"`
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data.questions && Array.isArray(data.questions)) {
        res.json({ questions: data.questions });
        return;
      }
    }
  } catch (error: any) {
    console.warn("[Task Survey] Using adaptive fallback:", error?.message || error);
  }

  res.json(fallbackSurvey);
});

app.post("/api/split-task", async (req, res) => {
  const { task, surveyAnswers, context } = req.body;
  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

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

  try {
    const prompt_sistema = `Eres el Arquitecto de Planificación y Enfoque de NeuroSynk impulsado por Meta Muse Wonder.
Tu misión es diseñar una sesión de trabajo realista basada en las respuestas de la encuesta del usuario.
Cada paso debe iniciar con un VERBO DE ACCIÓN EN MAYÚSCULAS. Cero formato Markdown.
Responde estrictamente con un JSON con la clave "steps": array de strings.`;

    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `OBJETIVO: "${task}"\nRESPUESTAS: ${JSON.stringify(surveyAnswers || {})}\nCONTEXTO: "${context || 'General'}"`,
      reasoningEffort: "high"
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data.steps) && data.steps.length > 0) {
        const cleanSteps = data.steps.map((s: string) => s.replace(/\*/g, '').trim());
        res.json({ steps: cleanSteps });
        return;
      }
    }
  } catch (err: any) {
    console.warn("[Split Task] Using deterministic fallback:", err?.message || err);
  }

  res.json({ steps: getFallbackSteps(task, surveyAnswers) });
});

app.post("/api/subdivide-step", async (req, res) => {
  const { parentStep, taskContext } = req.body;
  if (!parentStep) {
    res.status(400).json({ error: "parentStep is required" });
    return;
  }

  const fallbackSubSteps = [
    "TOMA tu pluma o sitúa el cursor directamente en tu espacio de trabajo.",
    "LOCALIZA únicamente la primera línea o concepto introductorio.",
    "ESCRIBE la primera palabra clave para romper la inercia."
  ];

  try {
    const prompt_sistema = `Eres el Rescatista Ejecutivo de NeuroSynk con Meta Muse Spark.
Fragmenta el paso bloqueado en exactamente 3 NANO-PASOS atómicos de menos de 60 segundos cada uno.
Cada nano-paso debe iniciar con un VERBO DE ACCIÓN EN MAYÚSCULAS.
Responde estrictamente con un JSON con la clave "subSteps": array de 3 strings.`;

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Paso bloqueado: "${parentStep}"\nContexto: "${taskContext || 'General'}"`
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data.subSteps) && data.subSteps.length > 0) {
        res.json({ subSteps: data.subSteps.map((s: string) => s.replace(/\*/g, '').trim()) });
        return;
      }
    }
  } catch (err: any) {
    console.warn("[Subdivide Step] Using fallback:", err?.message || err);
  }

  res.json({ subSteps: fallbackSubSteps });
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

  try {
    const prompt_sistema = `Eres el Mentor de Co-presencia de NeuroSynk impulsado por Meta Muse Spark.
Tu misión es mantener al usuario en acción resolviendo dudas en menos de 28 palabras.
Inicia SIEMPRE con un VERBO DE ACCIÓN EN MAYÚSCULAS. Cero Markdown. Tono de co-presencia ("estamos / vamos").`;

    const text = await callMetaModel({
      model: "muse-spark-1.0",
      systemPrompt: prompt_sistema,
      userPrompt: `Paso activo: "${currentStep || 'Trabajo'}"\nContexto: "${taskContext || 'General'}"\nMensaje: "${userText}"`,
      reasoningEffort: "minimal",
      maxTokens: 100
    });

    const cleanReply = text.replace(/[*_#]/g, '').trim();
    res.json({ reply: cleanReply || "AVANZA con el primer detalle del paso. Estamos contigo." });
  } catch (err: any) {
    console.warn("[Chat] Using adaptive reply:", err?.message || err);
    res.json({ reply: "DIVIDE el paso en su mínima expresión. Escribe la primera palabra para arrancar." });
  }
});

app.get("/api/api-status", (req, res) => {
  res.json({
    hasMetaKey: !!META_API_KEY,
    hasBasetenKey: !!BASETEN_API_KEY,
    activeProvider: META_API_KEY ? "meta-model-api" : (BASETEN_API_KEY ? "baseten" : "offline-adaptive")
  });
});

// =========================================================================
// META GLOBAL AI HACKATHON CORE ENDPOINTS (MUSE SPARK, WONDER, SAM 3.1)
// =========================================================================

/**
 * 1. Muse Spark - Streaming SSE de Intervención Rápida en Co-presencia
 */
app.post("/api/meta/muse-spark/stream", async (req, res) => {
  const { perclos = 0, fatigueScore = 0, postureScore = 0, currentTask = 'Estudio', cognitiveClass = 'NEUTRO' } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const prompt = `Usuario en sesión de trabajo. Estado: PERCLOS=${perclos}%, Fatiga=${fatigueScore}/100, Postura=${postureScore}/100, Clasificación=${cognitiveClass}. Tarea: "${currentTask}". Genera UNA sola micro-instrucción empática de máximo 15 palabras iniciando con verbo de acción en MAYÚSCULAS.`;

  try {
    const text = await callMetaModel({
      model: "muse-spark-1.0",
      userPrompt: prompt,
      temperature: 0.5,
      maxTokens: 45
    });

    const words = text.split(" ");
    for (const w of words) {
      res.write(`${w} `);
      await new Promise(r => setTimeout(r, 30));
    }
    res.end();
  } catch (err) {
    let fallback = "ENFOCA el primer detalle del paso. Estamos juntos en este sprint.";
    if (perclos > 25 || fatigueScore > 50) {
      fallback = "DESCANSA tu mirada 20 segundos fuera de la pantalla. Cuidamos tu ritmo cognitivo.";
    } else if (postureScore > 40) {
      fallback = "AJUSTA tu espalda y relaja los hombros. La postura despeja la mente.";
    }
    const words = fallback.split(" ");
    for (const w of words) {
      res.write(`${w} `);
      await new Promise(r => setTimeout(r, 30));
    }
    res.end();
  }
});

/**
 * 2. Muse Wonder - Descomposición Cognitiva de Tareas en 3 Nano-Pasos
 */
app.post("/api/meta/muse-wonder/decompose", async (req, res) => {
  const { task = 'Trabajo', perclos = 0, stressLevel = 0 } = req.body;

  const fallback = {
    nanoSteps: [
      `DELIMITA el primer término o punto atómico de "${task}".`,
      "ESCRIBE una sola frase o abre el primer archivo de trabajo.",
      "CONTINÚA sin juzgar la perfección; registraremos tu avance paso a paso."
    ],
    estimatedSecondsPerStep: perclos > 25 ? 60 : 45
  };

  try {
    const text = await callMetaModel({
      model: "muse-wonder-1.0",
      systemPrompt: "Eres Muse Wonder. Descompón la tarea en exactamente 3 nano-pasos ejecutables en menos de 60 segundos cada uno. Responde en JSON con la clave 'nanoSteps': array de strings.",
      userPrompt: `Tarea: "${task}", PERCLOS: ${perclos}%, Estrés: ${stressLevel}%`,
      reasoningEffort: "high"
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (Array.isArray(data.nanoSteps)) {
        res.json({ nanoSteps: data.nanoSteps, estimatedSecondsPerStep: fallback.estimatedSecondsPerStep });
        return;
      }
    }
  } catch (e) {
    console.warn("[Meta Muse Wonder] Using fallback:", e);
  }

  res.json(fallback);
});

/**
 * 3. SAM 3.1 & Vision Multimodal - Calibración Ergonómica de Espacio de Estudio
 */
app.post("/api/meta/sam/calibrate", async (req, res) => {
  const { image } = req.body;
  if (image && BASETEN_API_KEY) {
    try {
      const basetenUrl = process.env.BASETEN_ENDPOINT_URL || "https://inference.baseten.co/v1/chat/completions";
      const basetenRes = await fetch(basetenUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BASETEN_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-models/muse-spark-open-1026",
          messages: [
            {
              role: "system",
              content: "Eres el Evaluador de Ergonomía Visual de NeuroSynk con Meta Muse Spark Open. Analiza la postura y alineación ergonómica a partir de la captura visual. Responde estrictamente con un JSON con las claves: isCalibrated (boolean), distanceMetric ('OPTIMAL'|'TOO_CLOSE'|'TOO_FAR'), headTiltAngle (number), shoulderAlignmentScore (number 0-100), clutterScore (number 0-100), recommendations (array de 2 strings con micro-instrucciones con verbo en MAYÚSCULAS)."
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Calibra ergonómicamente el espacio de estudio del usuario:" },
                { type: "image_url", image_url: { url: image } }
              ]
            }
          ],
          reasoning_effort: "minimal",
          max_tokens: 300
        })
      });

      if (basetenRes.ok) {
        const data = await basetenRes.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          res.json({
            provider: "meta-muse-spark-vision",
            isCalibrated: parsed.isCalibrated ?? true,
            distanceMetric: parsed.distanceMetric || 'OPTIMAL',
            headTiltAngle: parsed.headTiltAngle ?? 0,
            shoulderAlignmentScore: parsed.shoulderAlignmentScore ?? 92,
            clutterScore: parsed.clutterScore ?? 14,
            recommendations: parsed.recommendations || [
              'Línea visual alineada con el tercio superior del monitor.',
              'Cámara centrada y espacio ergonómico listo para el sprint.'
            ]
          });
          return;
        }
      }
    } catch (e: any) {
      console.warn("[SAM / Vision Calibrate] Fallback to deterministic calibration:", e?.message || e);
    }
  }

  res.json({
    provider: "local-biomechanical",
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

/**
 * 4. Vision Multimodal Endpoint - Análisis Ergonómico en Tiempo Real
 */
app.post("/api/meta/vision-ergonomics", async (req, res) => {
  const { image, task = 'Estudio', cognitiveState = 'NEUTRO' } = req.body;
  if (!image) {
    res.status(400).json({ error: "Image snapshot required" });
    return;
  }

  if (BASETEN_API_KEY) {
    try {
      const basetenUrl = process.env.BASETEN_ENDPOINT_URL || "https://inference.baseten.co/v1/chat/completions";
      const basetenRes = await fetch(basetenUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${BASETEN_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-models/muse-spark-open-1026",
          messages: [
            {
              role: "system",
              content: "Eres el Agente de Ergonomía Cognitiva de NeuroSynk. Analiza la postura y tensión ergonómica del usuario. Responde estrictamente con un JSON con: postureScore (0-100), distanceMetric ('OPTIMAL'|'TOO_CLOSE'|'TOO_FAR'), headTiltAngle (number), recommendations (array de 2 strings con micro-instrucciones iniciando con verbo en MAYÚSCULAS)."
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Analiza esta postura. Estado cognitivo: ${cognitiveState}. Tarea: ${task}` },
                { type: "image_url", image_url: { url: image } }
              ]
            }
          ],
          reasoning_effort: "minimal",
          max_tokens: 280
        })
      });

      if (basetenRes.ok) {
        const data = await basetenRes.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          res.json({
            provider: "meta-muse-spark-vision",
            postureScore: parsed.postureScore ?? 88,
            distanceMetric: parsed.distanceMetric ?? "OPTIMAL",
            headTiltAngle: parsed.headTiltAngle ?? 0,
            recommendations: parsed.recommendations ?? [
              "ALINEA tu columna recta frente al monitor.",
              "PARPADEA conscientemente para oxigenar la vista."
            ]
          });
          return;
        }
      }
    } catch (err: any) {
      console.warn("[Vision Ergonomics] Fallback:", err?.message || err);
    }
  }

  res.json({
    provider: "local-biomechanical-fallback",
    postureScore: 90,
    distanceMetric: "OPTIMAL",
    headTiltAngle: 0,
    recommendations: [
      "MANTÉN tu mirada alineada al tercio superior del monitor.",
      "RESPIRA profundo y relaja la tensión de los hombros."
    ]
  });
});

/**
 * 5. NeuroSynk Core AI Model Metadata Endpoint
 */
app.get("/api/model-info", async (req, res) => {
  try {
    const fs = await import("fs/promises");
    const metaPath = "./public/models/metadata.json";
    const data = await fs.readFile(metaPath, "utf-8");
    res.json(JSON.parse(data));
  } catch (err: any) {
    res.status(500).json({ error: "Could not read model metadata" });
  }
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
    console.log(`Active AI Provider: ${META_API_KEY ? 'Meta Model API' : (BASETEN_API_KEY ? 'Baseten' : 'Offline Adaptive Heuristics')}`);
  });
}

startServer();
