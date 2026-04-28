import express from "express";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";

const app = express();
app.use(express.json());
const PORT = 3000;

app.post("/api/split-task", async (req, res) => {
  const { task } = req.body;
  if (!task) {
    res.status(400).json({ error: "Task is required" });
    return;
  }

  // Use standard API key (users should configure Groq key in the platform settings, mapped to GROQ_API_KEY)
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
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
    const groq = new Groq({ apiKey });
    
    const prompt_sistema = `Eres el Mentor NeuroSynk. 
Regla 1: NUNCA resuelvas la tarea.
Regla 2: Divide la tarea en 4 micro-pasos absurdamente fáciles.
Regla 3: MUY IMPORTANTE. Devuelve tu respuesta ÚNICAMENTE separando cada paso con el símbolo "|". No uses saltos de línea ni viñetas. Cada paso debe ser corto (máximo 10 palabras).

Ejemplo exacto: Paso 1: Abrir documento|Paso 2: Escribir el título|Paso 3: Leer el primer párrafo

IMPORTANTE: Responde en español, pero NO uses acentos, tildes, ni la letra ñ. Usa solo texto plano.

Tarea: ${task}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt_sistema }],
      model: "llama-3.1-8b-instant",
      temperature: 0.3
    });

    const texto_limpio = completion.choices[0]?.message?.content?.trim() || "";
    const lista_tareas = texto_limpio.split('|').filter((s: string) => s.trim().length > 0);
    
    if (lista_tareas.length === 0) {
      throw new Error("Formato incorrecto de la IA");
    }

    res.json({ steps: lista_tareas });
  } catch (error: any) {
    if (error?.status === 401 || error?.error?.type === 'invalid_request_error') {
       console.warn("⚠️ Groq API Key inválida o no configurada. Activando modo offline de respaldo.");
    } else {
       console.error("Groq API Error:", error?.message || error);
    }
    
    const tarea_corta = task.length > 20 ? task.substring(0, 20) + "..." : task;
    res.json({
      steps: [
        `Paso 1: Preparar material para '${tarea_corta}'`,
        "Paso 2: Iniciar la primera fase (15 mins)",
        "Paso 3: Revisar progreso y corregir",
        "Paso 4: Finalizar y guardar avances",
        "(Modo Respaldo Activado por falta de API Key)"
      ]
    });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    res.json({ reply: "⚠️ Sistema offline o sin llave API. Mantén el foco, volveré pronto. ( ◡‿◡ )" });
    return;
  }

  try {
    const groq = new Groq({ apiKey });

    const systemPrompt = `Eres el Mentor de Neuro-Productividad "Deep Tech".
Regla 1: Cero Sobrecarga Cognitiva. ESTRICTAMENTE PROHIBIDO responder con muros de texto.
Regla 2: Formato: Máximo 2 o 3 párrafos súper cortos o viñetas muy precisas.
Regla 3: Tono Neuro-Divergente: Ve directo al grano. Si respondes a algo complejo, da la idea central y cierra preguntando: "¿Necesitas que profundice en algún punto específico?".
Regla 4: Tono empático, rápido y al servicio del "Estado de Flujo". Usa kaomojis sutiles.`;

    // Limit context window to last 6 messages
    const recentMessages = Array.isArray(messages) ? messages.slice(-6) : [];

    const completion = await groq.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }, ...recentMessages],
      model: "llama-3.1-8b-instant",
      temperature: 0.4,
      max_tokens: 300
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "Entendido.";
    res.json({ reply });
  } catch (error: any) {
    console.warn("Chat Error:", error?.message || error);
    res.json({ reply: "⚠️ Error de conexión neuronal. Manten tu atención en la tarea principal." });
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
