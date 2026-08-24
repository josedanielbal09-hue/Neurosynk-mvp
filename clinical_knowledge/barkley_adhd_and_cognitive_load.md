# Modelo de Disfunción Ejecutiva de Russell Barkley & Teoría de Carga Cognitiva

## 1. Modelo de Autorregulación e Inhibición Conductual (Barkley)

El TDAH no es una falta de atención, sino un trastorno en la **autorregulación y la gestión temporal del esfuerzo cognitivo**:

### A. Dinámica de Agotamiento de la Inhibición
- En sujetos con TDAH o alta sobrecarga mental, el esfuerzo sostenido agota rápidamente la glucosa y neurotransmisores prefrontales.
- **Manifestación Temporal**: Un periodo breve de hiperenfoque (3-5 min) seguido abruptamente por ráfagas de micro-movimientos erráticos (`yaw_std` alto, `nose_delta` elevado).
- **Interpretación del Modelo**: La alternancia rápida entre foco rígido e hiperquinesia indica **Disfunción de Control Inhibitorio**.

---

## 2. Teoría de Carga Cognitiva de John Sweller (Cognitive Load Theory)

La memoria de trabajo tiene una capacidad finita (~4 elementos simultáneos). En entornos digitales, existen 3 tipos de carga:

### A. Carga Intrínseca (Dificultad real del problema)
- Estado fisiológico: Ceño ligeramente contraído (`frown_mean < 0.38`), mirada fija en el centro de la pantalla, respiración controlada.
- Clasificación: `ENFOQUE PROFUNDO`.

### B. Sobrecarga Extraña (Cognitive Overload / Bloqueo)
- Ocurre cuando el entorno, las distracciones o la frustración saturan la memoria de trabajo.
- Estado fisiológico: Cabeceos verticales (`pitch_std > 0.05`), hombros elevados en tensión (`shoulder_angle > 135°`), distancia interciliar muy contraída o relajación abrupta por abandono de tarea.
- Clasificación: `SOBREESTIMULACIÓN` o `AGOBIO POSTURAL`.

---

## 3. Matriz de Fusión para Etiquetado de Soft Targets (Probabilidades Continuas)

Ningún estado cognitivo humano es 100% puro o discreto. Gemini debe generar **distribuciones de probabilidad suaves**:

```
Ejemplo de salida de Gemini:
- Probabilidad Enfoque: 0.15
- Probabilidad Distracción: 0.10
- Probabilidad Fatiga: 0.65
- Probabilidad Sobrecarga: 0.05
- Probabilidad Agobio: 0.05
- Probabilidad Neutro: 0.00
```
Esta distribución suave (*Soft Labels*) permite entrenar la red neuronal local con **Cross-Entropy Regularizada (Knowledge Distillation)**, logrando que el modelo aprenda transiciones naturales entre estados.
