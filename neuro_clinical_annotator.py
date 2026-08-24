"""
Anotador Neuroclínico de IA - NeuroSynk (Powered by Gemini API)
Utiliza las bases clínicas del DSM-5, Modelo de Barkley y Carga Cognitiva de Sweller
para procesar grabaciones de telemetría y generar Ground Truth con Soft Labels.
"""

import os
import sys
import json
import csv
import glob
from typing import List, Dict, Any

try:
    import google.generativeai as genai
except ImportError:
    print("[Error] Se requiere el paquete google-generativeai. Instálalo con: pip install google-generativeai")
    sys.exit(1)

# 1. Cargar bases de conocimiento clínico
KNOWLEDGE_DIR = os.path.join(os.path.dirname(__file__), "clinical_knowledge")

def load_clinical_knowledge() -> str:
    texts = []
    for md_file in glob.glob(os.path.join(KNOWLEDGE_DIR, "*.md")):
        with open(md_file, "r", encoding="utf-8") as f:
            texts.append(f"=== DOCUMENTO CLÍNICO: {os.path.basename(md_file)} ===\n" + f.read())
    return "\n\n".join(texts)

CLINICAL_KNOWLEDGE_BASE = load_clinical_knowledge()

SYSTEM_INSTRUCTION = f"""
Eres un Neurocientífico Clínico y Experto en Ergonomía Cognitiva de Alta Precisión.
Tu tarea es evaluar series temporales de telemetría biomecánica recolectadas durante sesiones de estudio/trabajo
y generar un diagnóstico objetivo del estado neurocognitivo del participante.

BÁSATE EXCLUSIVAMENTE EN EL SIGUIENTE MARCO CIENTÍFICO:
{CLINICAL_KNOWLEDGE_BASE}

ESTADOS COGNITIVOS VÁLIDOS (0 a 5):
0: ESTUDIO NORMAL / NEUTRO
1: ENFOQUE PROFUNDO (FLOW)
2: DISTRACCIÓN
3: FATIGA
4: SOBREESTIMULACIÓN
5: AGOBIO POSTURAL

REGLAS DE SALIDA:
Para cada bloque temporal recibido, debes responder estrictamente en formato JSON válido con la siguiente estructura:
{{
  "evaluations": [
    {{
      "window_id": int,
      "subject_id": str,
      "primary_class_index": int,
      "primary_class_name": str,
      "soft_probabilities": [p0, p1, p2, p3, p4, p5],  // Deben sumar 1.0
      "confidence": float,
      "clinical_rationale": "Breve justificación neurocientífica basada en los biomarcadores observados"
    }}
  ]
}}
"""

def setup_gemini_client(api_key: str = None):
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        print("[AVISO] No se encontró GEMINI_API_KEY. Configúrala como variable de entorno o pásala al script.")
        return None
    genai.configure(api_key=key)
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=SYSTEM_INSTRUCTION,
        generation_config={"response_mime_type": "application/json", "temperature": 0.2}
    )
    return model

def annotate_session_csv(csv_path: str, output_csv_path: str, model):
    if not model:
        print("[Error] Modelo Gemini no configurado.")
        return

    print(f"\n[NeuroSynk AI] Procesando sesión: {csv_path}")
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    if not reader:
        print("  CSV vacío.")
        return

    # Procesar en bloques de 10 ventanas (20 segundos por chunk para que Gemini tenga contexto temporal)
    chunk_size = 10
    annotated_rows = []

    for i in range(0, len(reader), chunk_size):
        chunk = reader[i : i + chunk_size]
        prompt = f"Analiza el siguiente segmento de telemetría continuo de {len(chunk)} ventanas:\n"
        prompt += json.dumps(chunk, indent=2)

        try:
            response = model.generate_content(prompt)
            data = json.loads(response.text)
            evals = data.get("evaluations", [])

            eval_dict = {e["window_id"]: e for e in evals}
            for row in chunk:
                w_id = int(row.get("window_id", 0))
                ev = eval_dict.get(w_id)
                if ev:
                    row["label"] = str(ev["primary_class_index"])
                    row["label_name"] = ev["primary_class_name"]
                    row["gemini_confidence"] = f"{ev['confidence']:.2f}"
                    row["clinical_rationale"] = ev.get("clinical_rationale", "")
                    row["soft_probs"] = json.dumps(ev.get("soft_probabilities", []))
                annotated_rows.append(row)

            print(f"  Procesado bloque {i//chunk_size + 1}/{(len(reader) + chunk_size - 1)//chunk_size}...")
        except Exception as e:
            print(f"  [Error en bloque {i}]: {e}")
            annotated_rows.extend(chunk)

    # Guardar CSV con anotaciones clínicas
    fieldnames = list(annotated_rows[0].keys())
    with open(output_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(annotated_rows)

    print(f"✅ Sesión enriquecida con conocimiento clínico guardada en: {output_csv_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python neuro_clinical_annotator.py <archivo_ventanas.csv> [archivo_salida.csv]")
        print("Ejemplo: python neuro_clinical_annotator.py dataset_ventanas_Sujeto_01.csv dataset_anotado_Sujeto_01.csv")
    else:
        input_csv = sys.argv[1]
        out_csv = sys.argv[2] if len(sys.argv) > 2 else input_csv.replace(".csv", "_clinically_annotated.csv")
        gemini_model = setup_gemini_client()
        if gemini_model:
            annotate_session_csv(input_csv, out_csv, gemini_model)
