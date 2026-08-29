# 🧠 Especificaciones Técnicas y Código de Entrenamiento: NeuroSynk AI Core

Este documento contiene las **especificaciones matemáticas, arquitectura de red neuronal, preprocesamiento de tensores y guía de entrenamiento** en TensorFlow y Keras para **NeuroSynk**.

---

## 🏛️ 1. Arquitectura Cognitiva del Sistema (Dual-System AI)

NeuroSynk opera bajo una arquitectura cognitivo-computacional dual:
1. **Sistema 1 (Inferencia Rápida de Borde - 60 FPS / <2ms)**:
   - Red Neuronal Profunda ejecutada en el cliente web (**TensorFlow.js / WebGL**).
   - Inferencia continua y clasificación de atención en 6 estados clínicos.
   - Suavizado temporal exponencial ($\alpha = 0.45$) con filtro de histéresis de 400ms.
2. **Sistema 2 (Supervisión Clínica y Desglose de Misiones)**:
   - Razonamiento multimodal asistido por **Gemini 2.5 / 3.6 Flash**.
   - Subdivisión de tareas en micro-pasos de dopamina y acompañamiento TDAH (*Body Doubling*).

---

## 📐 2. Especificación del Vector de Entrada (12 Dimensiones)

El vector $X \in \mathbb{R}^{12}$ procesa las siguientes métricas biométricas extraídas de MediaPipe:

| Índice | Variable | Rango Típico | Descripción Clínica / Mapeo FACS |
| :---: | :--- | :---: | :--- |
| **0** | `ear_mean` | $[0.15, 0.50]$ | Apertura promedio de párpados (*Eye Aspect Ratio*). |
| **1** | `ear_min` | $[0.05, 0.45]$ | Apertura mínima (detección de parpadeo y micro-somnolencia). |
| **2** | `yaw_mean` | $[-0.5, 0.5]$ | Rotación horizontal de la cabeza (orientación de la mirada). |
| **3** | `yaw_std` | $[0.00, 0.30]$ | Variabilidad horizontal (búsqueda visual / distracción). |
| **4** | `pitch_mean` | $[-0.5, 0.5]$ | Inclinación vertical (cabeceo de fatiga o lectura concentrada). |
| **5** | `pitch_std` | $[0.00, 0.30]$ | Inestabilidad postural vertical. |
| **6** | `frown_mean` | $[0.20, 0.70]$ | FACS AU4: Tensión muscular del entrecejo (estrés/concentración). |
| **7** | `nose_delta_sum`| $[0.00, 0.50]$ | Micro-movimientos rápidos del ápice nasal (inquietud motora TDAH). |
| **8** | `gaze_variance_mean`| $[0.000, 0.030]$ | Dispersión de la fijación pupilar (Score C.L.A.P.). |
| **9** | `shoulder_angle_mean`| $[110^\circ, 160^\circ]$ | Asimetría escapular e inclinación de hombros. |
| **10** | `mar_mean` | $[0.01, 0.25]$ | FACS AU25/AU27: Apertura de la boca (bostezos / tensión). |
| **11** | `roll_angle_mean`| $[-0.5, 0.5]$ | Inclinación lateral de la cabeza hacia los hombros. |

---

## 🎯 3. Clases de Clasificación Clínica (6 Estados)

El vector de salida es una distribución de probabilidad Softmax $y \in \Delta^5$:

$$\sum_{i=0}^5 y_i = 1.0 \pm 10^{-5}$$

1. **Clase 0 (`ESTUDIO NORMAL / NEUTRO`)**: Estado basal equilibrado.
2. **Clase 1 (`ENFOQUE PROFUNDO - FLOW`)**: Fijación visual estable, ceño neutro y postura alineada.
3. **Clase 2 (`DISTRACCIÓN`)**: Elevada varianza de Yaw/Pitch y pérdida de fijación pupilar.
4. **Clase 3 (`FATIGA`)**: Ojos caídos (EAR bajo), cabeceo frecuente y aumento de bostezos (MAR).
5. **Clase 4 (`SOBREESTIMULACIÓN`)**: Inquietud motora alta (`nose_delta_sum`), tensión ocular y mandibular.
6. **Clase 5 (`AGOBIO POSTURAL`)**: Colapso de hombros, tensión muscular prolongada y asimetría corporal.

---

## ⚙️ 4. Normalización Z-Score Determinista

Cada dimensión $j$ se normaliza antes de ingresar a la red mediante:

$$X_{norm}^{(j)} = \frac{X^{(j)} - \mu_j}{\sigma_j}$$

Donde $\mu_j$ y $\sigma_j$ son los parámetros calculados durante el entrenamiento y guardados en `metadata.json`.

---

## 🏗️ 5. Arquitectura de la Red Neuronal (Keras / TensorFlow)

```
=================================================================
 Capa (Tipo)                     Forma de Salida       Parámetros
=================================================================
 biometric_12d_input (InputLayer)  (None, 12)            0
 dense_layer_1 (Dense + L2 + ReLU) (None, 64)            832
 batch_norm_1 (BatchNormalization) (None, 64)            256
 dropout_1 (Dropout 20%)           (None, 64)            0
 dense_layer_2 (Dense + L2 + ReLU) (None, 32)            2,080
 batch_norm_2 (BatchNormalization) (None, 32)            128
 dropout_2 (Dropout 15%)           (None, 32)            0
 latent_features (Dense + ReLU)    (None, 16)            528
 cognitive_state_output (Softmax)  (None, 6)             102
=================================================================
 Total de Parámetros: 3,926 (15.34 KB) - Ultraligero para WebGL
=================================================================
```

---

## 🚀 6. Cómo Ejecutar el Entrenamiento en tu Terminal

Dentro del entorno virtual `.venv` de Python 3.12:

```bash
# 1. Ejecutar el pipeline maestro de punta a punta:
./.venv/Scripts/python.exe entrenamiento_ia_core/05_run_full_training.py
```

El script realizará:
1. La carga y validación de datos.
2. La normalización Z-Score de 12 dimensiones.
3. El entrenamiento de la red con *Early Stopping* y *Reduce LR on Plateau*.
4. La verificación del contrato de probabilidades Softmax ($1.0 \pm 10^{-5}$).
5. La exportación directa de `model.json`, `weights.bin` y `metadata.json` para el MVP web.
