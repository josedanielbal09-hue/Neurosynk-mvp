import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(express.json());
const PORT = 3000;

// Initialize Gemini API Client
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

app.post("/api/split-task", async (req, res) => {
  const { task, context } = req.body;
  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

  if (!ai) {
    console.warn("⚠️ GEMINI_API_KEY no configurada. Activando modo offline.");
    const tarea_corta = task.length > 20 ? task.substring(0, 20) + "..." : task;
    res.json({
      steps: [
        `Paso 1: Preparar material para '${tarea_corta}'`,
        "Paso 2: Iniciar la primera fase (15 mins)",
        "Paso 3: Revisar progreso y corregir",
        "Paso 4: Finalizar y guardar avances"
      ]
    });
    return;
  }

  try {
    const prompt_sistema = `Eres el Mentor NeuroSynk. 
Regla 1: NUNCA resuelvas la tarea.
Regla 2: Divide la tarea en 4 micro-pasos absurdamente fáciles basados en el contexto del usuario.
Regla 3: Cada paso debe ser especifico y descriptivo (entre 15 a 25 palabras).
Regla 4: Responde en español. Usa solo texto plano sin formato markdown.`;

    const completion = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `Tarea a dividir: ${task}\nContexto adicional del usuario: ${context || 'Ninguno'}`,
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
              description: "4 pasos cortos para dividir la tarea"
            }
          },
          required: ["steps"]
        }
      }
    });

    const responseText = completion.text;
    if (!responseText) {
      throw new Error("Respuesta vacía de Gemini");
    }

    const data = JSON.parse(responseText);
    if (!data.steps || !Array.isArray(data.steps)) {
      throw new Error("Formato JSON de pasos no válido");
    }

    // Clean up any potential markdown formatting issues in elements
    const cleanSteps = data.steps.map((s: string) => s.replace(/\*/g, '').trim());

    res.json({ steps: cleanSteps });
  } catch (error: any) {
    console.error("Gemini Split Task Error:", error?.message || error);
    const tarea_corta = task.length > 20 ? task.substring(0, 20) + "..." : task;
    res.json({
      steps: [
        `Paso 1: Preparar material para '${tarea_corta}'`,
        "Paso 2: Iniciar la primera fase (15 mins)",
        "Paso 3: Revisar progreso y corregir",
        "Paso 4: Finalizar y guardar avances",
        "(Modo Respaldo Activado por error de API)"
      ]
    });
  }
});

app.post("/api/subdivide-step", async (req, res) => {
  const { parentStep, taskContext, stepNumber } = req.body;
  if (!parentStep) {
    res.status(400).json({ error: "Parent step is required" });
    return;
  }

  if (!ai) {
    console.warn("⚠️ GEMINI_API_KEY no configurada. Activando modo offline.");
    res.json({
      subSteps: [
        `Paso ${stepNumber}.1: Analizar detalles sencillos del paso '${parentStep}'`,
        `Paso ${stepNumber}.2: Resolver primera micro-parte del paso`,
        `Paso ${stepNumber}.3: Verificar progreso del paso`
      ]
    });
    return;
  }

  try {
    const prompt_sistema = `Eres el Mentor NeuroSynk.
El usuario está bloqueado o perdiendo el foco en el paso número ${stepNumber}: "${parentStep}" dentro de la tarea general: "${taskContext || 'Ninguna'}".
Divide este paso específico en 3 sub-pasos absurdamente fáciles, secuenciales y sumamente descriptivos (entre 10 y 20 palabras).
Numeración: Comienza cada sub-paso obligatoriamente con el prefijo "${stepNumber}.1 ", "${stepNumber}.2 ", o "${stepNumber}.3 ".
No uses ningún formato markdown.`;

    const completion = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `Paso a dividir: ${parentStep}`,
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
              description: "3 sub-pasos cortos numerados secuencialmente"
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

    const cleanSubSteps = data.subSteps.map((s: string) => s.replace(/\*/g, '').trim());
    res.json({ subSteps: cleanSubSteps });
  } catch (error: any) {
    console.error("Gemini Subdivide Step Error:", error?.message || error);
    res.json({
      subSteps: [
        `Paso ${stepNumber}.1: Dividir la tarea en un micro-paso de inicio`,
        `Paso ${stepNumber}.2: Ejecutar el micro-paso inicial con cuidado`,
        `Paso ${stepNumber}.3: Comprobar el resultado antes de continuar`
      ]
    });
  }
});


app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  
  if (!ai) {
    res.json({ reply: "⚠️ Sistema offline o sin llave API. Mantén el foco, volveré pronto. ( ◡‿◡ )" });
    return;
  }

  try {
    const systemPrompt = `Eres el Mentor de Neuro-Productividad "Deep Tech".
Regla 1: Respuestas claras y completas. Responde de forma detallada pero estructurada para no abrumar al usuario.
Regla 2: Formato: Usa párrafos legibles, viñetas para organizar las ideas y asegúrate de que todas tus oraciones estén completas.
Regla 3: Tono Neuro-Divergente: Ve al grano pero sé explicativo. Si el usuario te hace una pregunta conceptual, explícala con claridad.
Regla 4: Tono empático, rápido y al servicio del "Estado de Flujo". Usa kaomojis sutiles.
Regla 5: Responde en español de forma natural y clara. Asegúrate de finalizar siempre tus frases y pensamientos; nunca dejes ideas o palabras a la mitad.
Regla 6: INTENCIÓN DE CAMBIO DE TEMA: Si el usuario indica explícitamente que quiere cambiar de tema, de tarea, estudiar algo distinto o redefinir sus metas de hoy, DEBES proponer una nueva tarea y exactamente 4 micro-pasos ultra-simples y de acción inmediata en el campo "proposal". Si el usuario solo está conversando o haciendo preguntas conceptuales sin intenciones de cambiar de tema, NO incluyas el campo "proposal" en tu respuesta JSON.`;

    // 1. Extract dynamic system prompt messages and compile them
    let dynamicSystemPrompt = "";
    const filteredMessages = (Array.isArray(messages) ? messages : []).filter((m: any) => {
      if (m && m.role === "system") {
        if (m.content) {
          dynamicSystemPrompt += (dynamicSystemPrompt ? "\n" : "") + m.content;
        }
        return false;
      }
      return true;
    });

    // Combine custom instructions with default system instructions
    const finalSystemInstruction = systemPrompt + (dynamicSystemPrompt ? "\n\n[Contexto Actualizado de la Sesión]\n" + dynamicSystemPrompt : "");

    // 2. Map standard messages (user, model)
    const contentsMapped = filteredMessages
      .map((m: any) => {
        let role = m.role;
        if (role === "assistant") {
          role = "model";
        }
        return {
          role,
          parts: [{ text: m.content || "" }]
        };
      })
      .filter((m: any) => m.role === "user" || m.role === "model");

    // 3. Merge consecutive messages of the same role
    const alternateContents: any[] = [];
    for (const msg of contentsMapped) {
      if (alternateContents.length === 0) {
        alternateContents.push(msg);
      } else {
        const lastMsg = alternateContents[alternateContents.length - 1];
        if (lastMsg.role === msg.role) {
          lastMsg.parts[0].text += "\n" + msg.parts[0].text;
        } else {
          alternateContents.push(msg);
        }
      }
    }

    // 4. Ensure it starts with "user"
    while (alternateContents.length > 0 && alternateContents[0].role !== "user") {
      alternateContents.shift();
    }

    // 5. Slice to keep the last 6 messages
    let contents = alternateContents.slice(-6);
    
    // Ensure the sliced array also starts with "user"
    while (contents.length > 0 && contents[0].role !== "user") {
      contents.shift();
    }

    // Fallback if empty
    if (contents.length === 0) {
      contents = [{ role: "user", parts: [{ text: "Hola" }] }];
    }

    console.log("=== ENVIANDO LLAMADA CHAT A GEMINI ===");
    console.log("Instrucción del sistema:", finalSystemInstruction);
    console.log("Mensajes a procesar:", JSON.stringify(contents, null, 2));

    const completion = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: contents,
      config: {
        systemInstruction: finalSystemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            reply: {
              type: "string",
              description: "La respuesta empática y guiada del chatbot en español."
            },
            proposal: {
              type: "object",
              properties: {
                proposedTask: {
                  type: "string",
                  description: "El título de la nueva tarea o tema que el usuario quiere estudiar o realizar."
                },
                proposedSteps: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "Exactamente 4 micro-pasos de acción inmediata y absurdamente sencillos para la nueva tarea."
                }
              },
              required: ["proposedTask", "proposedSteps"],
              description: "Objeto opcional que solo se incluye si el usuario solicita cambiar de tema, de tarea o redefinir metas."
            }
          },
          required: ["reply"]
        },
        maxOutputTokens: 800,
        temperature: 0.5
      }
    });

    const responseText = completion.text || "{}";
    console.log("Respuesta cruda de Gemini:", responseText);
    
    try {
      const data = JSON.parse(responseText);
      res.json({ 
        reply: data.reply || "Entendido.",
        proposal: data.proposal || null
      });
    } catch (e) {
      res.json({
        reply: responseText,
        proposal: null
      });
    }
  } catch (error: any) {
    console.error("Gemini Chat Error:", error?.message || error);
    res.json({ reply: "⚠️ Error de conexion neuronal. Manten tu atencion en la tarea principal." });
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
  });
}

startServer();
