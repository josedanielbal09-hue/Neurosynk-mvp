import { BiometricFeaturesPayload, AIInferenceResponse, HealthCheckResponse } from '../types/aiContracts';

export class AICoreClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  public async checkHealth(): Promise<HealthCheckResponse | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return null;
      return (await res.json()) as HealthCheckResponse;
    } catch {
      return null;
    }
  }

  public async evaluateBiometrics(payload: BiometricFeaturesPayload): Promise<AIInferenceResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      throw new Error(`AI Microservice responded with [${response.status}]: ${errorDetail}`);
    }

    return (await response.json()) as AIInferenceResponse;
  }
}

export const aiClient = new AICoreClient();
