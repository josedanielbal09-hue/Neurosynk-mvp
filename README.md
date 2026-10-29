# 🧠 NeuroSynk AI Core — Cognitive Ergonomics & Focus Agent
### Meta Global AI Developer Hackathon — Startup Track

NeuroSynk is an edge-first cognitive ergonomics and developer productivity agent designed to optimize mental flow states. It pairs **100% on-device biometric telemetry** at 60 FPS with **Meta AI models (Muse Spark, Muse Wonder, and SAM 3.1)** to alleviate task paralysis and sustain high-performance deep work.

---

## 🚀 Key Features

* **Edge Biometric Telemetry (100% On-Device & Private)**:
  Real-time facial and kinematic feature extraction using MediaPipe Holistic and local TensorFlow.js. Computes Z-Score normalized posture alignment, blink dynamics, and 30-second circular buffer PERCLOS without sending raw video feeds to the cloud.
* **Real-Time Interventions via Meta Muse Spark**:
  Ultra-low-latency streaming interventions via Server-Sent Events (SSE) that adaptively guide developers through cognitive friction.
* **Cognitive Task Decomposition via Meta Muse Wonder**:
  Dynamic micro-task decomposition. When ergonomic strain or executive fatigue is detected, complex work items are atomically subdivided into 3 actionable nano-steps (<60 seconds each).
* **Workspace Ergonomic Calibration via SAM 3.1**:
  Segment Anything powered ergonomic alignment to maintain ideal screen-to-face distance and posture during sprints.
* **Resilient Multi-Provider Fallback via Baseten**:
  Seamless fallback to **Muse Spark Open** (`meta-models/muse-spark-open-1026`) hosted on high-throughput **Baseten** serverless endpoints for 2M TPM enterprise throughput.
* **Interactive Robot Avatar (FocusBud)**:
  Procedural eye states (calibrated/focused, fatigued, recovery), dynamic radial aura, and WebAudio earcons providing instant grounding feedback.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER (Browser Client)                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐│
│  │  MediaPipe    │  │  TF.js Model │  │  Audio Grounding       ││
│  │  Holistic     │→ │  12-D Z-Score│  │  (Binaural/WebAudio)  ││
│  │  60 FPS Local │  │  PERCLOS 30s │  └──────────┬─────────────┘│
│  └──────┬───────┘  └──────┬───────┘              │              │
│         │                 │                       │              │
│         └────────┬────────┴───────────────────────┘              │
│                  ▼                                               │
│    aiInference.ts (EMA Filter α=0.45, Hysteresis 400ms)         │
│                  │                                               │
│                  ▼ Compact Telemetry Payload (~200 bytes)        │
│  Avatar.tsx / FocusBudWidget.tsx (Reactive States & Micro-steps) │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS / SSE
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend Server (Node/Express)               │
│                                                                 │
│  Primary:  Meta Model API (dev.meta.ai/v1/responses)           │
│            • muse-spark-1.0 (Real-time Streaming)               │
│            • muse-wonder-1.0 (Deep Reasoning Decomposition)     │
│            • SAM 3.1 (Ergonomic Posture Segmentation)           │
│                                                                 │
│  Fallback: Baseten Model API (inference.baseten.co/v1)          │
│            • meta-models/muse-spark-open-1026                   │
│                                                                 │
│  Cloud:    Modal Serverless GPU Container                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Quickstart & Setup

### 1. Prerequisites
* **Node.js** (v18 or higher)
* **Webcam** (for local biometric telemetry)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the project root (this file is excluded from git for security):
```env
# Meta Model API (Official Portal)
META_MODEL_API_KEY=LLM_your_meta_key_here
META_API_URL=https://api.meta.ai/v1/responses

# Baseten (Meta Muse Spark Open Fallback)
BASETEN_API_KEY=your_baseten_key_here
BASETEN_ENDPOINT_URL=https://inference.baseten.co/v1/chat/completions

# Server Config
PORT=3001
NODE_ENV=development
```

### 4. Run Development Server
```bash
npm run dev
```
Open **`http://localhost:3001`** in your browser.

---

## 🏆 Hackathon Targets
* **Startup Track — 1st Place**: Deep integration of Meta Muse Spark, Muse Wonder, and SAM 3.1.
* **Best Build on Meta Open Weight Models**: `muse-spark-open-1026` via Baseten.
* **Best Agentic Use-Case**: Closed-loop agent: Local Biometrics → Automated Cognitive Evaluation → Voice/Text Intervention.
