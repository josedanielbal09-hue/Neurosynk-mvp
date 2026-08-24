"""
Punto de Entrada del Microservicio de Inteligencia Artificial NeuroSynk
"""

import os
import json
from fastapi import FastAPI, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from app.schemas.biometric import BiometricFeaturesPayload, AIInferenceResponse
from app.services.inference import NeuralInferenceEngine

app = FastAPI(
    title="NeuroSynk AI Core Microservice",
    version="1.0.0",
    description="Motor de Inferencia de Redes Neuronales y Telemetría Diagnóstica"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = NeuralInferenceEngine()

LOGS_DIR = os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(LOGS_DIR, exist_ok=True)

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    """Endpoint de verificación de estado y disponibilidad del modelo"""
    return {
        "status": "healthy",
        "service": "neurosynk-ai-core",
        "model_ready": engine.is_ready,
        "version": "1.0.0"
    }

@app.post("/api/v1/predict", response_model=AIInferenceResponse, status_code=status.HTTP_200_OK)
def predict_cognitive_state(payload: BiometricFeaturesPayload):
    """
    Ejecuta la clasificación de estado cognitivo a partir del vector biométrico
    """
    try:
        response = engine.predict(payload)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en el pipeline de inferencia neuronal: {str(e)}"
        )

@app.post("/api/v1/telemetry/report", status_code=status.HTTP_200_OK)
def receive_session_telemetry(report: Dict[str, Any] = Body(...)):
    """
    Recibe la telemetría completa de la sesión para diagnóstico y depuración del agente
    """
    try:
        session_id = report.get("sessionId", "session_latest")
        filename = os.path.join(LOGS_DIR, f"{session_id}.json")
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        latest_path = os.path.join(LOGS_DIR, "session_diagnostics_latest.json")
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        print(f"[Telemetry] Reporte de sesión recibido y guardado: {filename}")
        return {"status": "recorded", "file": filename, "frames": report.get("totalFrames", 0)}
    except Exception as e:
        print(f"[Telemetry Error]: {e}")
        return {"status": "error", "detail": str(e)}

@app.get("/api/v1/telemetry/latest", status_code=status.HTTP_200_OK)
def get_latest_telemetry():
    """Devuelve el último reporte de telemetría guardado"""
    latest_path = os.path.join(LOGS_DIR, "session_diagnostics_latest.json")
    if not os.path.exists(latest_path):
        raise HTTPException(status_code=404, detail="No hay reportes de telemetría previos.")
    with open(latest_path, "r", encoding="utf-8") as f:
        return json.load(f)
