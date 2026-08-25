import { BiometricFeaturesPayload, AIInferenceResponse } from '../types/aiContracts';

export interface TelemetryFrame {
  timestamp: number;
  timeFormatted: string;
  rawInputs: BiometricFeaturesPayload;
  aiOutput: {
    className: string;
    confidence: number;
    probabilities: number[];
  };
  focusScore: number;
  stressLevel: number;
  currentStep: string;
  stepIdx: number;
  events: string[];
  anomalies: string[];
}

export interface SessionDiagnosticReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  totalFrames: number;
  averageFocus: number;
  averageStress: number;
  subdivisionCount: number;
  anomaliesDetected: {
    jitterCount: number;
    falseFatigueSpikes: number;
    rapidClassFlips: number;
    prematureSubdivisions: number;
  };
  eventLog: string[];
  framesTimeline: TelemetryFrame[];
}

export class SessionTelemetryRecorder {
  private frames: TelemetryFrame[] = [];
  private startTime: number = Date.now();
  private sessionId: string = `session_${Date.now()}`;
  private eventLog: string[] = [];
  private subdivisionCount: number = 0;
  private lastClassIndex: number = 0;
  private lastFocusScore: number = 100;

  constructor() {
    this.resetSession();
  }

  public resetSession(): void {
    this.frames = [];
    this.startTime = Date.now();
    this.sessionId = `session_${Date.now()}`;
    this.eventLog = [`[${new Date().toLocaleTimeString()}] Sesión iniciada y grabador de telemetría activo.`];
    this.subdivisionCount = 0;
    this.lastClassIndex = 0;
    this.lastFocusScore = 100;
  }

  public recordFrame(
    inputs: BiometricFeaturesPayload,
    aiResult: AIInferenceResponse,
    currentFocus: number,
    currentStress: number,
    currentStep: string,
    stepIdx: number,
    instantEvents: string[] = []
  ): TelemetryFrame {
    const now = Date.now();
    const elapsedSecs = Math.floor((now - this.startTime) / 1000);
    const mins = Math.floor(elapsedSecs / 60).toString().padStart(2, '0');
    const secs = (elapsedSecs % 60).toString().padStart(2, '0');
    const timeFormatted = `${mins}:${secs}`;

    const anomalies: string[] = [];

    // 1. Detección de Jitter (Salto brusco de enfoque > 35% en un solo ciclo)
    if (Math.abs(currentFocus - this.lastFocusScore) > 35 && this.frames.length > 3) {
      anomalies.push(`JITTER_ANOMALY: Salto brusco de ${this.lastFocusScore}% a ${currentFocus}%`);
    }

    // 2. Detección de Volatilidad de Clases (Cambio de estado sin persistencia)
    if (aiResult.class_index !== this.lastClassIndex && aiResult.confidence < 0.65) {
      anomalies.push(`LOW_CONFIDENCE_FLIP: Cambio a clase ${aiResult.class_name} con solo ${(aiResult.confidence * 100).toFixed(0)}%`);
    }

    // 3. Falsa Fatiga Ocular (Apertura EAR normal pero clasificado en fatiga)
    if (aiResult.class_index === 2 && inputs.ear_mean > 0.35) {
      anomalies.push(`FALSE_FATIGUE_SUSPECT: Marcado como fatiga con EAR alto (${inputs.ear_mean.toFixed(3)})`);
    }

    const frame: TelemetryFrame = {
      timestamp: now,
      timeFormatted,
      rawInputs: inputs,
      aiOutput: {
        className: aiResult.class_name,
        confidence: aiResult.confidence,
        probabilities: aiResult.probabilities
      },
      focusScore: Math.round(currentFocus),
      stressLevel: Math.round(currentStress),
      currentStep,
      stepIdx,
      events: instantEvents,
      anomalies
    };

    this.frames.push(frame);
    this.lastClassIndex = aiResult.class_index;
    this.lastFocusScore = currentFocus;

    return frame;
  }

  public logEvent(event: string): void {
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${event}`;
    this.eventLog.push(entry);
    if (event.includes("Subdivisión") || event.includes("subdivided")) {
      this.subdivisionCount++;
    }
  }

  public generateReport(): SessionDiagnosticReport {
    const now = Date.now();
    const duration = Math.max(1, Math.floor((now - this.startTime) / 1000));
    const total = this.frames.length;

    let avgFocus = 100;
    let avgStress = 0;
    let jitterCount = 0;
    let falseFatigue = 0;
    let classFlips = 0;

    if (total > 0) {
      avgFocus = Math.round(this.frames.reduce((a, b) => a + b.focusScore, 0) / total);
      avgStress = Math.round(this.frames.reduce((a, b) => a + b.stressLevel, 0) / total);

      this.frames.forEach(f => {
        f.anomalies.forEach(a => {
          if (a.includes("JITTER")) jitterCount++;
          if (a.includes("FALSE_FATIGUE")) falseFatigue++;
          if (a.includes("LOW_CONFIDENCE")) classFlips++;
        });
      });
    }

    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: now,
      durationSeconds: duration,
      totalFrames: total,
      averageFocus: avgFocus,
      averageStress: avgStress,
      subdivisionCount: this.subdivisionCount,
      anomaliesDetected: {
        jitterCount,
        falseFatigueSpikes: falseFatigue,
        rapidClassFlips: classFlips,
        prematureSubdivisions: this.subdivisionCount > 3 ? this.subdivisionCount - 1 : 0
      },
      eventLog: this.eventLog,
      framesTimeline: this.frames
    };
  }

  public async exportReportToBackend(): Promise<boolean> {
    try {
      const report = this.generateReport();
      const res = await fetch('http://localhost:8000/api/v1/telemetry/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const sessionTelemetry = new SessionTelemetryRecorder();
