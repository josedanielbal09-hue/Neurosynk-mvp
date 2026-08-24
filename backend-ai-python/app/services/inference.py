import os
import json
import numpy as np
from typing import List, Dict, Any, Optional
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
import joblib

from app.schemas.biometric import BiometricFeaturesPayload, AIInferenceResponse

CLASS_NAMES = [
    "ESTUDIO NORMAL / NEUTRO",
    "ENFOQUE PROFUNDO (FLOW)",
    "DISTRACCION",
    "FATIGA",
    "SOBREESTIMULACION",
    "AGOBIO POSTURAL"
]

STATUS_MESSAGES = {
    0: "ESTUDIO EN CALMA (RITMO REGULAR Y BASAL)",
    1: "EN ESTADO DE FLUJO (FIJACION ACTIVA)",
    2: "DISTRACCION DETECTADA (MIRADA FUERA DE FOCO)",
    3: "FATIGA COGNITIVA (PARPADEOS LENTOS / BOSTEZOS)",
    4: "SOBREESTIMULACION / INQUIETUD MOTORA ELEVADA",
    5: "ESTRES / AGOBIO POSTURAL (TENSION FISICA)"
}

class NeuralInferenceEngine:
    """
    Motor de Inferencia de Redes Neuronales para Clasificación Biomecánica (12 Características)
    """
    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = model_dir or os.path.join(os.path.dirname(__file__), "..", "models")
        os.makedirs(self.model_dir, exist_ok=True)
        self.model_path = os.path.join(self.model_dir, "neurosynk_mlp.joblib")
        self.scaler_path = os.path.join(self.model_dir, "scaler.joblib")
        
        self.model: Optional[MLPClassifier] = None
        self.scaler: Optional[StandardScaler] = None
        self.is_ready: bool = False
        
        self._initialize_or_train()

    def _initialize_or_train(self):
        """Carga el modelo serializado o lo entrena con el Dataset Maestro si no existe"""
        self._train_from_master_dataset()

    def _train_from_master_dataset(self):
        """Entrena un MLP Classifier con regularización sobre el dataset maestro"""
        dataset_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "dataset_ventanas_aumentado.csv"))
        if not os.path.exists(dataset_path):
            dataset_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "dataset_maestro_ventanas.csv"))

        if not os.path.exists(dataset_path):
            print(f"[AI Core] No se encontro dataset en {dataset_path}. Inicializando pesos base.")
            self._init_fallback_model()
            return

        print(f"[AI Core] Entrenando Red Neuronal desde: {dataset_path}")
        import csv

        X, y = [], []
        with open(dataset_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                lbl = int(row['label'])
                if lbl < 0:
                    continue
                features = [
                    float(row['ear_mean']),
                    float(row['ear_min']),
                    float(row['yaw_mean']),
                    float(row['yaw_std']),
                    float(row['pitch_mean']),
                    float(row['pitch_std']),
                    float(row['frown_mean']),
                    float(row['nose_delta_sum']),
                    float(row['gaze_variance_mean']),
                    float(row['shoulder_angle_mean']),
                    float(row.get('mar_mean', 0.05)),
                    float(row.get('roll_angle_mean', 0.0))
                ]
                X.append(features)
                y.append(lbl)

        X_arr = np.array(X, dtype=np.float32)
        y_arr = np.array(y, dtype=np.int32)

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X_arr)

        self.model = MLPClassifier(
            hidden_layer_sizes=(64, 32, 16),
            activation='relu',
            solver='adam',
            alpha=0.001,
            max_iter=200,
            random_state=42
        )
        self.model.fit(X_scaled, y_arr)

        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        self.is_ready = True
        print(f"[AI Core] Red Neuronal entrenada con éxito (Precisión: {self.model.score(X_scaled, y_arr)*100:.1f}%)")

    def _init_fallback_model(self):
        """Modelo sintético en caso de ausencia total de datos"""
        np.random.seed(42)
        X_dummy = np.random.randn(100, 12)
        y_dummy = np.random.randint(0, 6, size=100)
        self.scaler = StandardScaler()
        X_s = self.scaler.fit_transform(X_dummy)
        self.model = MLPClassifier(hidden_layer_sizes=(32, 16), max_iter=10)
        self.model.fit(X_s, y_dummy)
        self.is_ready = True

    def predict(self, payload: BiometricFeaturesPayload) -> AIInferenceResponse:
        """Calcula inferencia neuronal sobre el payload biométrico"""
        if not self.is_ready or not self.model or not self.scaler:
            raise RuntimeError("El modelo neuronal no está listo para inferencia.")

        features = np.array([[
            payload.ear_mean,
            payload.ear_min,
            payload.yaw_mean,
            payload.yaw_std,
            payload.pitch_mean,
            payload.pitch_std,
            payload.frown_mean,
            payload.nose_delta_sum,
            payload.gaze_variance_mean,
            payload.shoulder_angle_mean,
            payload.mar_mean or 0.05,
            payload.roll_angle_mean or 0.0
        ]], dtype=np.float32)

        features_scaled = self.scaler.transform(features)
        probs = self.model.predict_proba(features_scaled)[0].tolist()
        class_idx = int(np.argmax(probs))
        confidence = float(probs[class_idx])

        # Scores
        p_neutro = probs[0] if len(probs) > 0 else 0.0
        p_flow = probs[1] if len(probs) > 1 else 0.0
        p_dist = probs[2] if len(probs) > 2 else 0.0
        p_fat = probs[3] if len(probs) > 3 else 0.0
        p_sob = probs[4] if len(probs) > 4 else 0.0
        p_ago = probs[5] if len(probs) > 5 else 0.0

        focus_score = int(np.clip((p_neutro * 70.0 + p_flow * 100.0 - p_dist * 60.0 - p_fat * 40.0), 0, 100))
        stress_level = int(np.clip((p_fat * 60.0 + p_sob * 80.0 + p_ago * 90.0), 0, 100))

        class_name = CLASS_NAMES[class_idx] if class_idx < len(CLASS_NAMES) else f"ESTADO_{class_idx}"
        status_msg = STATUS_MESSAGES.get(class_idx, "PROCESANDO")

        return AIInferenceResponse(
            class_index=class_idx,
            class_name=class_name,
            confidence=round(confidence, 4),
            probabilities=[round(p, 4) for p in probs],
            focus_score=focus_score,
            stress_level=stress_level,
            status_message=status_msg
        )
