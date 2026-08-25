# AGENTS.md - Directrices Maestras de NeuroSynk AI Core

Este archivo contiene las directivas permanentes (*standing instructions*) para cualquier agente de **Google Antigravity** que opere en este repositorio.

---

## 🏛️ 1. Arquitectura del Sistema (Dual-System AI)
NeuroSynk opera bajo una arquitectura cognitiva dual de alta precisión:
1. **Sistema 1 (Inferencia Rápida / Borde - 60 FPS / <2ms)**:
   - Red Neuronal Profunda en **TensorFlow.js / Keras** (`model.json` y `weights.bin`).
   - Clasificación continua en 6 estados: `ESTUDIO NORMAL / NEUTRO`, `ENFOQUE PROFUNDO (FLOW)`, `DISTRACCIÓN`, `FATIGA`, `SOBREESTIMULACIÓN`, `AGOBIO POSTURAL`.
   - Normalización Z-Score de 12 dimensiones y filtro temporal exponencial con histéresis ($\alpha = 0.45$, umbral $400\text{ms}$).
2. **Sistema 2 (Supervisión Clínica Profunda)**:
   - Razonamiento multimodal asistido por **Gemini 2.5 Flash** (`neuro_clinical_annotator.py`).
   - Validación cruzada de síntomas, detección de micro-expresiones FACS y patrones posturales del DSM-5.

---

## ⚡ 2. Environment & Tooling (Entorno de Desarrollo)
- **Gestión de Paquetes**: Priorizar `uv` y entornos virtuales limpios (`.venv/`) para Python 3.11+.
- **Node / Frontend**: Node.js v18+, Vite, TypeScript estricto, Tailwind CSS y Canvas/WebGL para renderizado a 60 FPS.
- **Aceleración Hardware**: TensorFlow debe aprovechar GPU/WebGL/WASM cuando estén disponibles.

---

## 📐 3. Code Standards (Estándares de Código)
- **Type Hints Obligatorios**: Todos los métodos en TypeScript y Python deben declarar tipos estrictos, detallando explícitamente las dimensiones de los tensores (e.g., `X: Tensor2D [N, 12]`, `y: Tensor2D [N, 6]`).
- **Reproducibilidad Matemática**: Configurar siempre semillas aleatorias fijas (`seed=42`) al inicio de los scripts de entrenamiento y particionado de datos.
- **Normalización Determinista**: Todos los parámetros de normalización ($\mu$ y $\sigma$) calculados durante el entrenamiento deben quedar documentados y exportados en `metadata.json`.

---

## 🔒 4. Data Governance & Privacy (Gobernanza y Privacidad)
- **Privacidad Local Absoluta**: NUNCA subir ni hacer commit de archivos con claves de API (`.env*`), entornos virtuales (`.venv/`), copias de seguridad zip ni credenciales personales a Git.
- **Flujos de Datos Descentralizados**: Las grabaciones de cámara no salen de la computadora del usuario; el procesamiento de MediaPipe y TensorFlow se ejecuta 100% en el cliente local.
- **Deduplicación y Calidad**: Cualquier nuevo lote de datos debe integrarse en el dataset maestro mediante pipelines deterministas y scripts de validación matemática.

---

## 🧪 5. Testing & Verification (Pruebas y Validación)
- **Pruebas de Inferencia**: Verificar siempre que la carga del modelo (`model.json`) y la respuesta de inferencia devuelvan un vector de 6 probabilidades normalizadas cuya suma sea exactamente $1.0 \pm 10^{-5}$.
- **Estabilidad de Servidores**: Las aplicaciones locales deben mantenerse verificadas en sus puertos designados (`localhost:3001` para el MVP y `localhost:3005` para el Recolector).
