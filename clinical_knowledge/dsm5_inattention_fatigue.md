# Framework Clínico DSM-5: Criterios Neuroconductuales para Inatención, Fatiga y Esfuerzo Mental

## 1. Criterios de Inatención y Desconexión Ejecutiva (DSM-5 / F90.0)

En tareas sostenidas en pantalla (trabajo/estudio), los episodios de inatención y desregulación atencional se manifiestan a través de los siguientes biomarcadores observables:

### A. Desorganización del Foco Visual (Gaze Dispersion)
- **Criterio Clínico**: Dificultad para mantener la atención en tareas que requieren esfuerzo mental continuo.
- **Biomarcador**: Aumento brusco en la varianza de mirada (`gaze_variance_mean > 0.0040`) y desviaciones horizontales erráticas de la cabeza (`yaw_std > 0.065`).
- **Estado Asignado**: `DISTRACCIÓN` (Clase 2).

### B. Inquietud Motora / Búsqueda de Dopamina
- **Criterio Clínico**: Inquietud, movimientos continuos de cabeza/tronco o abandono de la postura de trabajo cuando la tarea pierde novedad.
- **Biomarcador**: Desplazamientos continuos de nariz (`nose_delta_sum > 0.12`) combinados con mirada dispersa y tensión en hombros.
- **Estado Asignado**: `SOBREESTIMULACIÓN / INQUIETUD` (Clase 4).

---

## 2. Agotamiento Neurobiológico y Fatiga (Depleción del Locus Coeruleus)

### A. Fatiga Ocular y Micro-Somnolencia
- **Criterio Clínico**: Pérdida de tono palpebral, enlentecimiento de la tasa de parpadeo y bostezos de oxigenación/alerta.
- **Biomarcador**: 
  - Apertura ocular reducida respecto al baseline (`ear_mean < 0.22` o caída >30% del baseline).
  - Apertura bucal prolongada (`mar_mean > 0.40`).
- **Estado Asignado**: `FATIGA` (Clase 3).

### B. Fatiga Postural y Apoyo Cefálico
- **Criterio Clínico**: Pérdida de tono en la musculatura cervical/escapular por agotamiento o intento de sostener la cabeza con las manos.
- **Biomarcador**:
  - Inclinación lateral de la cabeza (`abs(roll_angle_mean) > 12.0°`).
  - Manos en contacto o proximidad extrema con el rostro (`hand_face_dist_min < 0.25`).
- **Estado Asignado**: `AGOBIO POSTURAL / COLAPSO` (Clase 5).

---

## 3. Estado de Flujo vs. Estudio Basal Normal

### A. Enfoque Profundo (Flow State)
- **Criterio Clínico**: Fijación visual estable, postura erguida pero relajada, mínima variabilidad en yaw/pitch, ausencia de movimientos parásitos.
- **Biomarcador**: `gaze_variance_mean < 0.0008`, `yaw_std < 0.025`, `pitch_std < 0.025`, `ear_mean >= 0.28`, `nose_delta_sum < 0.04`.
- **Estado Asignado**: `ENFOQUE PROFUNDO (FLOW)` (Clase 1).

### B. Estudio Normal / Neutro
- **Criterio Clínico**: Actividad regular, parpadeos normales, descansos visuales leves dentro de parámetros basales.
- **Estado Asignado**: `ESTUDIO NORMAL / NEUTRO` (Clase 0).
