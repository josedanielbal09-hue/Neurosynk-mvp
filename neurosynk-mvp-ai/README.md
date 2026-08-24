# 🧠 NeuroSynk MVP — Mentor Biométrico de Foco y Neuro-productividad

NeuroSynk es un asistente de productividad cognitivo e interactivo diseñado para optimizar el estado de flujo de trabajo mediante telemetría biométrica 100% local y mentoría cognitiva adaptativa en tiempo real.

## 🚀 Características Clave

*   **Telemetría PDEF en Tiempo Real**: Medición inteligente de sobrecarga cognitiva y fatiga mental utilizando MediaPipe Holistic (procesamiento facial y cinemático local).
*   **Mentoría Cognitiva Adaptativa**: Integración directa con Google Gemini (`gemini-3.1-flash-lite`) para acompañamiento en tiempo real y alivio de parálisis cognitiva.
*   **Subdivisión Dinámica**: Si el rendimiento C.L.A.P. desciende del 50%, el sistema detecta el bloqueo y divide la micro-tarea actual en tres pasos absurdamente sencillos.
*   **Redefinición Temática**: Modificación y re-planificación de objetivos conversando directamente en lenguaje natural con el chatbot.
*   **Splash Screen & Mascot**: Carga interactiva estilizada con expresiones animadas.

---

## 🛠️ Guía de Instalación para Desarrolladores

Sigue estos pasos para levantar la aplicación en tu entorno local de desarrollo:

### 1. Requisitos Previos
*   **Node.js** (Versión 18 o superior recomendada)
*   **Cámara Web** (Para la captura biométrica local)

### 2. Clonar e Instalar Dependencias
Instala los paquetes necesarios del proyecto ejecutando en tu terminal:
```bash
npm install
```

### 3. Configurar Clave de API de Google Gemini (Gratuita)
Cada miembro del equipo debe obtener su propia clave de API gratuita para que la aplicación realice solicitudes de IA:

1. Ingresa a **[Google AI Studio](https://aistudio.google.com/)**.
2. Inicia sesión con cualquier cuenta de Google.
3. Haz clic en el botón azul **"Get API key"** (Obtener clave de API) en la esquina superior izquierda.
4. Selecciona **"Create API key"** y asóciala a un proyecto nuevo o existente.
5. Copia la clave generada (empieza por `AIzaSy...`).

### 4. Configurar Variables de Entorno
Crea un archivo local para tus secretos de configuración:
1. En la raíz de la carpeta `neurosynk-mvp`, crea un archivo llamado `.env.local` (este archivo está configurado en `.gitignore` para que **nunca** se suba a GitHub por seguridad).
2. Pega tu clave de API en él siguiendo este formato:
```env
GEMINI_API_KEY="TU_CLAVE_DE_API_DE_GEMINI_AQUÍ"
```

### 5. Iniciar Servidor de Desarrollo
Para levantar el servidor web local con recarga rápida (HMR):
```bash
npm run dev
```
Abre tu navegador en **`http://localhost:3000`** para interactuar con la app.
