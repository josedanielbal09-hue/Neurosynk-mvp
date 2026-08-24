from pydantic import BaseModel, Field
from typing import List, Optional

class BiometricFeaturesPayload(BaseModel):
    ear_mean: float = Field(..., description="Eye Aspect Ratio promedio (Apertura ocular)")
    ear_min: float = Field(..., description="Eye Aspect Ratio mínimo")
    yaw_mean: float = Field(..., description="Giro horizontal de cabeza promedio")
    yaw_std: float = Field(..., description="Desviación estándar de giro horizontal")
    pitch_mean: float = Field(..., description="Inclinación vertical promedio")
    pitch_std: float = Field(..., description="Desviación estándar de inclinación vertical")
    frown_mean: float = Field(..., description="Distancia interciliar / ceño")
    nose_delta_sum: float = Field(..., description="Inquietud motora acumulada")
    gaze_variance_mean: float = Field(..., description="Dispersión de mirada")
    shoulder_angle_mean: float = Field(..., description="Ángulo postural de hombros en grados")
    mar_mean: Optional[float] = Field(0.05, description="Apertura bucal promedio (Bostezos / Tensión)")
    roll_angle_mean: Optional[float] = Field(0.0, description="Inclinación lateral de cabeza en grados")

    model_config = {
        "json_schema_extra": {
            "example": {
                "ear_mean": 0.3650,
                "ear_min": 0.2950,
                "yaw_mean": 0.5120,
                "yaw_std": 0.0420,
                "pitch_mean": 0.6050,
                "pitch_std": 0.0210,
                "frown_mean": 0.4150,
                "nose_delta_sum": 0.0350,
                "gaze_variance_mean": 0.0008,
                "shoulder_angle_mean": 99.50,
                "mar_mean": 0.0520,
                "roll_angle_mean": 1.20
            }
        }
    }

class AIInferenceResponse(BaseModel):
    class_index: int = Field(..., description="0: Neutro, 1: Enfoque Flow, 2: Distracción, 3: Fatiga, 4: Sobreestimulación, 5: Agobio")
    class_name: str
    confidence: float
    probabilities: List[float]
    focus_score: int
    stress_level: int
    status_message: str
