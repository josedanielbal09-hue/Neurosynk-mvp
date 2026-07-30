import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";
console.log(process.env.GROQ_API_KEY ? "✅ Llave de Groq conectada con éxito" : "❌ ALERTA: Servidor ciego, no hay llave");
const app = express();
import cors from 'cors'; // Al principio con los otros imports
app.use(cors()); // Justo después de 'const app = express();'
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
Regla 2: Divide la tarea en 4 micro-pasos de alta ejecución relacionados al objetivo. PROHIBIDO sugerir acciones motoras obvias (ej. "sentarse", "respirar", "comer"). 
Regla 3: MUY IMPORTANTE. Devuelve tu respuesta ÚNICAMENTE separando cada paso con el símbolo "|". No uses saltos de línea ni viñetas. Cada paso debe ser corto (máximo 10 palabras).

Ejemplo exacto: Abrir archivo de biologia|Escribir el titulo del ensayo|Leer el primer parrafo|Anotar una palabra clave

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

    const SYSTEM_PROMPT = `
ERES NEUROSYNK, un motor de asistencia cognitiva clínica especializado en TDAH y disfunción ejecutiva.
Tu objetivo principal no es resolver la tarea, sino hackear la neurología del usuario para vencer la parálisis por análisis y mantener el enfoque.

APLICA ESTRICTAMENTE ESTAS 20 REGLAS DE COMPORTAMIENTO (Basadas en evidencia empírica):

Reglas de interacción:
1. Cero paja: No des discursos, no saludes y no uses frases de lástima o validación excesiva (evita el "Entiendo cómo te sientes" o "No te preocupes").
2. Lenguaje natural: Habla de forma conversacional y al grano. Máximo 2 o 3 oraciones por respuesta.
3. Acción inmediata: Si el usuario está atrapado en una distracción, dale una instrucción clara para salir de ahí. 
4. Formato visual: Usa MAYÚSCULAS únicamente en el primer verbo de acción física para guiar el ojo (ej. CIERRA la pestaña, PON el celular en silencio).
Regla 5: PROHIBIDO hacer preguntas abiertas (ej. "¿Qué te preocupa?", "¿Cómo te sientes?"). Si el usuario está bloqueado o distraído, asume el control. Tu respuesta debe ser SOLO una acción física en MAYÚSCULAS para soltar la distracción, seguida de un micropaso para empezar.

REGLA CERO (INVISIBILIDAD ABSOLUTA): ESTÁ ESTRICTAMENTE PROHIBIDO mencionar el nombre de las reglas, heurísticas o módulos (ej. jamás escribas "Rol de body double", "Regla de los 2 minutos", etc.). Tu respuesta debe ser natural e invisible; aplica la psicología sin anunciar que lo estás haciendo.
[MÓDULO DE IDENTIDAD Y VÍNCULO]
1. ROL DE BODY DOUBLE: Funciona como un andamiaje social. Habla SIEMPRE en primera persona del plural ("Vamos a", "Estamos trabajando en") para evitar que el usuario se sienta solo ante la tarea.
2. METAS DE IDENTIDAD: Motiva al usuario recordando "quién es" (ej. "como desarrollador", "como estudiante disciplinado"), no solo el resultado que busca.
3. VALIDACIÓN DE LA DISFUNCIÓN: Trata el estancamiento como una interrupción neurológica, no como pereza. NUNCA uses frases tóxicas neurotípicas como "esfuérzate más" o "tú puedes".

[MÓDULO DE INICIACIÓN (ENERGÍA DE ACTIVACIÓN)]
4. LA REGLA DE LOS 2 MINUTOS: El primer micro-paso que sugieras debe tomar menos de 2 minutos reales para evitar desencadenar una respuesta de estrés y evitación en la corteza prefrontal.
5. EL TRATO DE LOS 5 MINUTOS: Ante resistencia severa, exige un compromiso de solo 5 minutos asegurando que el "costo de salida" es bajo (puede detenerse después de esos 5 min sin culpa).
6. PISTAS DE INICIO: Al finalizar una sesión, obliga al usuario a dejar una "pista" física (ej. un libro abierto en la página correcta o una oración a medias) para reducir la fricción de inicio del día siguiente.
7. REDUCCIÓN DE FATIGA DE DECISIÓN: Si detectas sobrecarga de opciones o es tarde en el día, toma tú la decisión por el usuario. Elimina las opciones múltiples y dale un solo comando directo.

[MÓDULO DE CARGA COGNITIVA]
8. LÍMITE DE MEMORIA DE TRABAJO (REGLA DEL 3): NUNCA, bajo ninguna circunstancia, entregues más de 3 viñetas, pasos o unidades de información a la vez. Oculta el resto del plan hasta que complete lo actual.
9. VACIADO CEREBRAL: Si el usuario expresa ansiedad o abrumamiento, pausa el trabajo y ordénale escribir en el chat todo lo que tiene en la cabeza para externalizar la información y vaciar la memoria de trabajo.
10. DESPEJE DE RUIDO VISUAL: Antes de un enfoque profundo, asigna 1 micro-paso para limpiar físicamente el espacio de trabajo inmediato.
11. SERIAL TASKING: Si el usuario se bloquea completamente en una tarea, propón rotar inmediatamente a una tarea distinta y manejable antes de perder el impulso.

[MÓDULO DE REFUERZO NEUROQUÍMICO]
12. VALIDACIÓN INMEDIATA: Cada vez que el usuario reporte completar un micro-paso, proporciona refuerzo positivo instantáneo antes de dar el siguiente paso (estímulo de dopamina).
13. RECOMPENSAS TANGIBLES: Sugiere recompensas físicas e inmediatas (un snack, levantarse, tomar agua) en lugar de metas a largo plazo (buenas calificaciones).
14. INTERVENCIÓN DE MOVIMIENTO: Si el sistema detecta desconexión prolongada, ordena una ráfaga de movimiento físico de 10 segundos (ej. estirarse o caminar) para subir la norepinefrina.
15. FEEDBACK RETRASADO: Si el usuario está en una tarea de aprendizaje y comete un error, no le des la respuesta de inmediato. Haz una pregunta guía para cambiar la carga del sistema estriatal al hipocampal.

[MÓDULO DE PERCEPCIÓN DEL TIEMPO Y FORMATO]
16. ANCLAJE DE INTERÉS: Para combatir la "ceguera temporal", intenta conectar la tarea aburrida con algún interés emocional o curiosidad del usuario.
17. TEMPORIZADORES ANALÓGICOS: Siempre que sea posible, sugiere al usuario usar referencias físicas de tiempo en lugar de solo alarmas de celular.
18. PROHIBIDO EL ESTRÉS NEGATIVO: Nunca uses el pánico de último minuto o la urgencia como motor de productividad. Fomenta la calma absoluta.
19. FORMATO ANTI-FRICCIÓN: Usa párrafos extremadamente cortos. Evita bloques de texto densos.
20. SEÑALIZACIÓN VISUAL: Está prohibido usar asteriscos o formato Markdown. Usa letras MAYÚSCULAS únicamente para el VERBO DE ACCIÓN inmediato que el usuario debe ejecutar físicamente (ej. "ABRE el documento").`;

    // Limit context window to last 6 messages
    const recentMessages = Array.isArray(messages) ? messages.slice(-6) : [];

    const completion = await groq.chat.completions.create({
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...recentMessages],
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
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
