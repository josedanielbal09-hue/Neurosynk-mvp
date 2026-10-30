// scripts/test_baseten_live.js
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const apiKey = (process.env.BASETEN_API_KEY || "").trim();

if (!apiKey) {
  console.error("❌ No se encontró BASETEN_API_KEY en .env.local");
  process.exit(1);
}

console.log("========================================================================");
console.log("📡 CONECTANDO EN TIEMPO REAL CON BASETEN (meta-models/muse-spark-open-1026)");
console.log("========================================================================");
console.log(`Endpoint: https://inference.baseten.co/v1/chat/completions`);
console.log(`API Key:  ${apiKey.substring(0, 8)}... (activa)`);
console.log(`Enviando prompt de prueba...\n`);

const payload = {
  model: "meta-models/muse-spark-open-1026",
  messages: [
    {
      role: "system",
      content: "Eres el Mentor de Co-presencia de NeuroSynk. Tu misión es mantener al usuario en acción. Inicia SIEMPRE con un VERBO DE ACCIÓN EN MAYÚSCULAS. Responde en menos de 20 palabras. Tono de co-presencia ('vamos / estamos contigo')."
    },
    {
      role: "user",
      content: "El sensor biométrico detectó FATIGA y bloqueo en el paso: 'Calcular la matriz inversa'. El usuario lleva 3 minutos sin teclear."
    }
  ],
  reasoning_effort: "minimal",
  temperature: 0.6,
  max_tokens: 300
};

const startTime = Date.now();

try {
  const response = await fetch("https://inference.baseten.co/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const elapsedMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Error HTTP ${response.status}:`, errorText);
    process.exit(1);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  console.log("✅ RESPUESTA EN VIVO RECIBIDA EXITOSAMENTE:");
  console.log("------------------------------------------------------------------------");
  console.log(`⏱️  Latencia de respuesta: ${elapsedMs} ms`);
  console.log(`🤖 Modelo reportado:      ${data.model}`);
  console.log(`🆔 ID de la petición:     ${data.id}`);
  console.log(`📊 Tokens consumidos:     Prompt: ${data.usage?.prompt_tokens} | Salida: ${data.usage?.completion_tokens} | Total: ${data.usage?.total_tokens}`);
  
  if (choice?.message?.reasoning_content) {
    console.log("\n🧠 [Pensamiento interno / Reasoning del modelo]:");
    console.log(choice.message.reasoning_content);
  }

  console.log("\n💬 [Mensaje generado por Muse Spark Open]:");
  console.log(choice?.message?.content);
  console.log("------------------------------------------------------------------------");
  console.log("🚀 Baseten está respondiendo en vivo directamente a tu proyecto.");

} catch (err) {
  console.error("❌ Error de conexión:", err);
}
