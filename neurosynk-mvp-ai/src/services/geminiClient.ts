/**
 * NeuroSynk AI Core - Universal Gemini Client Service
 * Soporta llamadas híbridas: servidor local (/api/*) y llamada directa desde el navegador (HTTPS)
 * con conmutación automática de modelos (gemini-3.6-flash -> gemini-1.5-flash -> gemini-2.0-flash).
 */

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash'
];

async function callGoogleGeminiDirect(
  apiKey: string,
  systemInstruction: string,
  userContent: string,
  isJson: boolean = false
): Promise<string> {
  let lastError: any = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
        if (text) return text;
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn(`[Gemini Direct] Falló modelo ${model} (${res.status}):`, errJson);
        lastError = new Error(errJson?.error?.message || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`[Gemini Direct] Error de conexión con ${model}:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error("Todos los modelos de Gemini fallaron");
}

export async function splitTaskUniversal(
  task: string,
  context: string,
  apiKey: string
): Promise<{ steps: string[] }> {
  // 1. Intentar llamar al backend local si está disponible
  try {
    const res = await fetch('/api/split-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-api-key': apiKey || ''
      },
      body: JSON.stringify({ task, context })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
        return data;
      }
    }
  } catch (e) {
    // Si falla el servidor local, continuamos con llamada directa
  }

  // 2. Si no hay backend (ej. Cloudflare Pages / Vercel estático), llamar directo a Gemini con la API Key del usuario
  if (!apiKey) {
    const tareaCorta = task.length > 20 ? task.substring(0, 20) + "..." : task;
    return {
      steps: [
        `Paso 1: Preparar material para '${tareaCorta}'`,
        "Paso 2: Iniciar la primera fase de estudio (15 mins)",
        "Paso 3: Revisar progreso y corregir",
        "Paso 4: Finalizar y guardar avances"
      ]
    };
  }

  const sysPrompt = `Eres el Mentor NeuroSynk.
Regla 1: NUNCA resuelvas la tarea.
Regla 2: Divide la tarea en 4 micro-pasos absurdamente fáciles basados en el contexto del usuario.
Regla 3: Cada paso debe ser específico, claro y descriptivo. Tienes absoluta libertad en la longitud: pueden ser cortos y directos, o extenderse hasta 50 palabras solo si es necesario para brindar máxima claridad.
Regla 4: Responde en español. Devuelve ÚNICAMENTE un JSON válido con la clave "steps" que contenga un arreglo de 4 strings.`;

  const userPrompt = `Tarea a dividir: ${task}\nContexto adicional del usuario: ${context || 'Ninguno'}`;

  try {
    const text = await callGoogleGeminiDirect(apiKey, sysPrompt, userPrompt, true);
    const parsed = JSON.parse(text);
    if (parsed.steps && Array.isArray(parsed.steps)) {
      return { steps: parsed.steps.map((s: string) => s.replace(/\*/g, '').trim()) };
    }
  } catch (err) {
    console.error("[Universal Gemini] Error en splitTask:", err);
  }

  const tareaCorta = task.length > 20 ? task.substring(0, 20) + "..." : task;
  return {
    steps: [
      `Paso 1: Preparar material para '${tareaCorta}'`,
      "Paso 2: Iniciar la primera fase de estudio",
      "Paso 3: Revisar progreso y corregir",
      "Paso 4: Finalizar y guardar avances"
    ]
  };
}

export async function subdivideStepUniversal(
  parentStep: string,
  taskContext: string,
  stepNumber: number,
  apiKey: string
): Promise<{ subSteps: string[] }> {
  // 1. Intentar backend local
  try {
    const res = await fetch('/api/subdivide-step', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-api-key': apiKey || ''
      },
      body: JSON.stringify({ parentStep, taskContext, stepNumber })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.subSteps && Array.isArray(data.subSteps)) {
        return data;
      }
    }
  } catch (e) {
    // Continuar a llamada directa
  }

  if (!apiKey) {
    return {
      subSteps: [
        `Paso ${stepNumber}.1: Analizar detalles sencillos de '${parentStep}'`,
        `Paso ${stepNumber}.2: Resolver primera micro-parte del paso`,
        `Paso ${stepNumber}.3: Verificar progreso del paso`
      ]
    };
  }

  const sysPrompt = `Eres el Mentor NeuroSynk.
El usuario está bloqueado o perdiendo el foco en el paso número ${stepNumber}: "${parentStep}" dentro de la tarea general: "${taskContext || 'Ninguna'}".
Divide este paso específico en 3 sub-pasos absurdamente fáciles, secuenciales y sumamente descriptivos. Tienes total libertad en la extensión (cortos o de hasta 50 palabras si el paso requiere explicar un detalle clave).
Numeración: Comienza cada sub-paso obligatoriamente con el prefijo "${stepNumber}.1 ", "${stepNumber}.2 ", o "${stepNumber}.3 ".
Devuelve ÚNICAMENTE un JSON válido con la clave "subSteps" conteniendo un arreglo de 3 strings.`;

  const userPrompt = `Paso a dividir: ${parentStep}`;

  try {
    const text = await callGoogleGeminiDirect(apiKey, sysPrompt, userPrompt, true);
    const parsed = JSON.parse(text);
    if (parsed.subSteps && Array.isArray(parsed.subSteps)) {
      return { subSteps: parsed.subSteps.map((s: string) => s.replace(/\*/g, '').trim()) };
    }
  } catch (err) {
    console.error("[Universal Gemini] Error en subdivideStep:", err);
  }

  return {
    subSteps: [
      `Paso ${stepNumber}.1: Dividir la tarea en un micro-paso de inicio`,
      `Paso ${stepNumber}.2: Ejecutar el micro-paso inicial con calma`,
      `Paso ${stepNumber}.3: Comprobar el resultado antes de continuar`
    ]
  };
}

export async function chatUniversal(
  messages: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<{ reply: string; proposal?: any }> {
  // 1. Intentar backend local
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-api-key': apiKey || ''
      },
      body: JSON.stringify({ messages })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reply) return data;
    }
  } catch (e) {
    // Continuar a llamada directa
  }

  if (!apiKey) {
    return {
      reply: "⚠️ No hay conexión con el Mentor IA. Por favor introduce tu Gemini API Key en el menú de Ajustes ⚙️ arriba a la derecha."
    };
  }

  const sysInstruction = `Eres el Mentor de Neuro-Productividad "Deep Tech" de NeuroSynk.
Regla 1: Respuestas claras y completas. Responde de forma estructurada para no abrumar al usuario.
Regla 2: Formato: Usa párrafos legibles y viñetas para organizar ideas.
Regla 3: Tono Neuro-Divergente: Ve al grano pero sé explicativo y empático. Usa kaomojis sutiles ( •̀ ω •́ )✧.
Regla 4: Responde en español de forma natural y completa.
Regla 5: Devuelve ÚNICAMENTE un JSON con el campo "reply".`;

  // Construir el historial formateado
  const historyText = messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n\n");

  try {
    const text = await callGoogleGeminiDirect(apiKey, sysInstruction, historyText, true);
    try {
      const parsed = JSON.parse(text);
      if (parsed.reply) return parsed;
    } catch {
      return { reply: text };
    }
  } catch (err: any) {
    console.error("[Universal Gemini] Error en chat:", err);
    return { reply: `⚠️ Error de comunicación con Gemini: ${err?.message || 'Error de conexión'}` };
  }

  return { reply: "🧠 Mentor en línea. ¿En qué te ayudo a enfocarte hoy?" };
}
