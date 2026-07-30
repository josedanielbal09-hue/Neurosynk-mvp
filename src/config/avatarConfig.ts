export type FocusState = 'ENFOQUE' | 'ALERTA_SUAVE' | 'FATIGA' | 'PARALISIS' | 'CELEBRACION' | 'PAUSA';

export interface AudioConfig {
  frequency: number;
  type: 'sine' | 'triangle';
  duration: number;
  cooldown: number;
}

export interface StateAvatarConfig {
  messages: string[];
  audioConfig: AudioConfig;
}

export const AVATAR_CONFIG: Record<FocusState, StateAvatarConfig> = {
  ENFOQUE: {
    messages: [
      "¡Estás en la zona!",
      "¡Excelente ritmo!",
      "Gran concentración, sigue",
      "¡Qué gran flujo!",
    ],
    audioConfig: {
      frequency: 440,
      type: 'sine',
      duration: 0.15,
      cooldown: 60000,
    },
  },
  ALERTA_SUAVE: {
    messages: [
      "Volvamos al objetivo",
      "Respiramos y retomamos",
      "Ajustemos el foco",
      "Un pasito a la vez",
    ],
    audioConfig: {
      frequency: 320,
      type: 'sine',
      duration: 0.2,
      cooldown: 45000,
    },
  },
  FATIGA: {
    messages: [
      "Toma un sorbo de agua",
      "Parpadea y estírate",
      "Descansa la vista 1 min",
      "Baja los hombros, respira",
    ],
    audioConfig: {
      frequency: 280,
      type: 'triangle',
      duration: 0.3,
      cooldown: 60000,
    },
  },
  PARALISIS: {
    messages: [
      "Haz solo 1 minuto hoy",
      "Divide el paso en mini",
      "Sin presión, empieza ya",
      "Respiración profunda",
    ],
    audioConfig: {
      frequency: 350,
      type: 'triangle',
      duration: 0.25,
      cooldown: 45000,
    },
  },
  CELEBRACION: {
    messages: [
      "¡Lo lograste! 🎯",
      "¡Increíble trabajo! 🔥",
      "¡Objetivo cumplido! ⭐",
      "¡Eres imparable! 🚀",
    ],
    audioConfig: {
      frequency: 528,
      type: 'sine',
      duration: 0.4,
      cooldown: 0,
    },
  },
  PAUSA: {
    messages: [
      "Pausa merecida ☕",
      "Desconecta unos minutos",
      "Carga energías",
      "Momento de estirarse",
    ],
    audioConfig: {
      frequency: 392,
      type: 'sine',
      duration: 0.2,
      cooldown: 30000,
    },
  },
};

/**
 * Retorna una frase aleatoria en todo de compañero TDAH para el estado actual.
 */
export const getRandomStateMessage = (state: FocusState): string => {
  const messages = AVATAR_CONFIG[state]?.messages;
  if (!messages || messages.length === 0) return '';
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
};
