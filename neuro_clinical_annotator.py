"""
Anotador Neuroclínico de IA - NeuroSynk (Powered by Gemini 2.5 Flash API)
Utiliza las bases clínicas del DSM-5, Modelo de Barkley y Carga Cognitiva de Sweller
para evaluar telemetría biomecánica y generar Soft Labels clínicas.
"""

import os
import sys
import json
import csv
import urllib.request
import urllib.error
from typing import List, Dict, Any

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

CLINICAL_SYSTEM_PROMPT = """
Eres un Neurocientífico Clínico y Especialista en Ergonomía Cognitiva.
Tu tarea es diagnosticar el estado neurocognitivo de estudiantes a partir de series temporales de telemetría de 2 segundos.

CRITERIOS CLÍNICOS FUNDAMENTALES:
1. ENFOQUE NORMAL / NEUTRO (Clase 0): EAR estable (0.35-0.45), mirada fija o alternancia normal de lectura, MAR < 0.15, postura ergonómica regular.
2. ENFOQUE PROFUNDO / FLOW (Clase 1): Alta estabilidad en mirada (gaze_variance muy baja), ceño ligeramente concentrado, mínima inquietud cefálica (nose_delta bajo), estabilidad postural continua.
3. DISTRACCIÓN (Clase 2): Desviación horizontal/vertical pronunciada (Yaw/Pitch > 0.15 respecto al centro), dispersión de mirada alta, giros cefálicos rápidos (nose_delta alto).
4. FATIGA (Clase 3): Caída de apertura palpebral (EAR < 0.28), PERCLOS > 0.20, bostezo (MAR > 0.40), caída postural de hombros, parpadeos lentos prolongados.
5. SOBREESTIMULACIÓN (Clase 4): Alta varianza errática de mirada, movimientos oculomotores acelerados, tensión facial marcada sin cierre palpebral.
6. AGOBIO POSTURAL (Clase 5): Inclinación lateral o desplome (Roll > 15° o Slump marcado), manos en rostro (contacto en barbilla, frente o mejilla), ceño fruncido intenso (frown bajo).

FORMATO DE SALIDA ESTRICTO JSON:
Responde únicamente un objeto JSON con la clave 'evaluations' que contenga una lista para cada window_id:
{
  "evaluations": [
    {
      "window_id": 1,
      "subject_id": "Sujeto_02",
      "primary_class_index": 0,
      "primary_class_name": "ESTUDIO NORMAL / NEUTRO",
      "soft_probabilities": [0.70, 0.20, 0.05, 0.03, 0.01, 0.01],
      "confidence": 0.90,
      "clinical_rationale": "EAR 0.39 estable, PERCLOS 0%, Pitch orientado a libreta, sin signos de fatiga ni agobio."
    }
  ]
}
"""

def query_gemini_rest(chunk_data: list, api_key: str) -> Dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    prompt = f"{CLINICAL_SYSTEM_PROMPT}\n\nEVALÚA LAS SIGUIENTES {len(chunk_data)} VENTANAS TEMPORALES:\n"
    prompt += json.dumps(chunk_data, indent=2)
    
    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
            "thinkingConfig": {
                "thinkingBudget": 0
            }
        }
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    
    with urllib.request.urlopen(req, timeout=60) as response:
        res_body = response.read().decode("utf-8")
        parsed = json.loads(res_body)
        text = parsed["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)

def annotate_session_csv(csv_path: str, output_csv_path: str, api_key: str):
    print(f"\n[NeuroSynk AI] 🧠 Iniciando Destilación Clínica con Gemini 2.5 Flash...", flush=True)
    print(f"  Archivo de entrada: {csv_path}", flush=True)
    
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    if not reader:
        print("  CSV vacío.", flush=True)
        return

    print(f"  Total de ventanas a evaluar: {len(reader)}", flush=True)
    
    # Procesar en bloques de 15 ventanas
    chunk_size = 15
    annotated_rows = []

    for i in range(0, len(reader), chunk_size):
        chunk = reader[i : i + chunk_size]
        try:
            data = query_gemini_rest(chunk, api_key)
            evals = data.get("evaluations", [])
            eval_dict = {e["window_id"]: e for e in evals}
            
            for row in chunk:
                w_id = int(row.get("window_id", 0))
                ev = eval_dict.get(w_id)
                if ev:
                    row["label"] = str(ev["primary_class_index"])
                    row["label_name"] = ev["primary_class_name"]
                    row["gemini_confidence"] = f"{ev.get('confidence', 0.9):.2f}"
                    row["clinical_rationale"] = ev.get("clinical_rationale", "")
                    row["soft_probs"] = json.dumps(ev.get("soft_probabilities", []))
                annotated_rows.append(row)

            print(f"  ✅ Procesado bloque {i//chunk_size + 1}/{(len(reader) + chunk_size - 1)//chunk_size} ({len(annotated_rows)}/{len(reader)} ventanas)...", flush=True)
        except Exception as e:
            print(f"  [Aviso en bloque {i}]: {e}", flush=True)
            annotated_rows.extend(chunk)

    fieldnames = list(annotated_rows[0].keys())
    with open(output_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(annotated_rows)

    print(f"\n✨ ¡ÉXITO! Dataset enriquecido con diagnóstico clínico guardado en:\n  👉 {output_csv_path}", flush=True)

if __name__ == "__main__":
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        env_local = os.path.join(os.path.dirname(__file__), ".env.local")
        if os.path.exists(env_local):
            with open(env_local, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("GEMINI_API_KEY="):
                        api_key = line.split("=", 1)[1].strip()
                        break

    if not api_key:
        print("[Error] No se encontró GEMINI_API_KEY.", flush=True)
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Uso: python neuro_clinical_annotator.py <archivo_ventanas.csv> [archivo_salida.csv]", flush=True)
    else:
        input_csv = sys.argv[1]
        out_csv = sys.argv[2] if len(sys.argv) > 2 else input_csv.replace(".csv", "_anotado_clinico.csv")
        annotate_session_csv(input_csv, out_csv, api_key)
