import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "neurosynk-ai-core"
    assert "model_ready" in data

def test_predict_endpoint_flow():
    payload = {
        "ear_mean": 0.3650,
        "ear_min": 0.2950,
        "yaw_mean": 0.5120,
        "yaw_std": 0.0420,
        "pitch_mean": 0.6050,
        "pitch_std": 0.0210,
        "frown_mean": 0.4150,
        "nose_delta_sum": 0.0350,
        "gaze_variance_mean": 0.0008,
        "shoulder_angle_mean": 99.50
    }
    response = client.post("/api/v1/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "class_index" in data
    assert "class_name" in data
    assert "confidence" in data
    assert len(data["probabilities"]) == 5
    assert 0 <= data["focus_score"] <= 100
    assert 0 <= data["stress_level"] <= 100

def test_predict_endpoint_invalid_payload():
    # Payload incompleto (falta shoulder_angle_mean)
    payload = {
        "ear_mean": 0.3650
    }
    response = client.post("/api/v1/predict", json=payload)
    assert response.status_code == 422  # Error de validación Pydantic
