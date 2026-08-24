# 🧠 NeuroSynk AI: Multi-Subject Cognitive & Biometric Telemetry Ecosystem

[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-v4.22.0-FF6F00?logo=tensorflow)](https://js.tensorflow.org/)
[![Google Gemini](https://img.shields.io/badge/Gemini_API-2.0_Flash-4285F4?logo=google)](https://ai.google.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-v19.0-61DAFB?logo=react)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

**NeuroSynk** es un ecosistema biométrico de tiempo real para la monitorización no invasiva de la atención, la fatiga cognitiva y la ergonomía postural en entornos de estudio y trabajo digital.

---

## 🌟 Características Principales

* 📹 **Visión por Computadora No Invasiva (MediaPipe Holistic)**: Extracción en tiempo real de 12 variables fisiológicas (EAR ocular, MAR bucal, rotación Yaw/Pitch/Roll, varianza de mirada y postura escapular).
* 🧪 **Grounding Clínico con Gemini API**: Destilación de conocimiento asistida por LLM fundamentada en los criterios del **DSM-5**, el **Modelo de Disfunción Ejecutiva de Russell Barkley (TDAH)** y la **Teoría de Carga Cognitiva de Sweller**.
* ⚡ **Inferencia Local a 60 FPS (TensorFlow.js)**: Red neuronal profunda optimizada para ejecutarse en el navegador con latencia $<2\text{ms}$ y $0 costo de API en tiempo de ejecución.
* 🎯 **Auto-Calibración Basal Dinámica**: Aprende la fisionomía y postura única de cada participante durante los primeros 30 segundos de sesión.
* 🛡️ **Filtro de Histéresis y Estabilidad Temporal**: Elimina el *jitter* óptico y previene falsos positivos al distinguir entre parpadeos naturales, estudio en libreta y distracción.

---

## 🏗️ Arquitectura del Ecosistema

```
┌───────────────────────────────┐
│     recolector_datos_ia       │ ──> Genera series temporales CSV multi-sujeto
│ (Recolección Continua Web)    │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│  neuro_clinical_annotator.py  │ ──> Anotación científica con Gemini API (DSM-5 / Barkley)
│     (Teacher Distillation)    │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ train_deep_temporal_model.py  │ ──> Entrena la Red Neuronal Profunda (Loss KL Divergence)
│   (TensorFlow / Keras Core)   │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│       neurosynk-mvp-ai        │ ──> Motor web final con evaluación local en tiempo real
│  (MVP Client con TF.js)       │
└───────────────────────────────┘
```

---

## 🚀 Inicio Rápido

### 1. Recolección de Datos Biométricos
```bash
cd recolector_datos_ia
npm install
npm run dev
# Abrir http://localhost:3005 para grabar sesiones con ID de participante
```

### 2. Anotación Neuroclínica con Gemini
```bash
# Configura tu clave de Gemini API
export GEMINI_API_KEY="tu_clave_aqui"

# Procesa el CSV con conocimiento médico
python neuro_clinical_annotator.py dataset_ventanas_P01.csv dataset_anotado_P01.csv
```

### 3. Entrenamiento del Modelo Profundo
```bash
python train_deep_temporal_model.py dataset_anotado_P01.csv
# Exporta automáticamente model.json y weights.bin a public/models/
```

### 4. Ejecución de la Aplicación MVP
```bash
cd neurosynk-mvp-ai
npm install
npm run dev
# Abrir http://localhost:3001 para monitoreo en vivo con auto-calibración
```

---

## 🔒 Privacidad y Seguridad
Este repositorio está estrictamente configurado para proteger las claves de API y los datos personales de los participantes mediante `.gitignore`. Ningún video crudo ni clave privada se sube a la nube.
