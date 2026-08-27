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
      "Estamos avanzando juntos a buen ritmo.",
      "Mantenemos el foco en este micro-paso.",
      "Aquí sigo contigo. Seguimos concentrados.",
      "Buen ritmo. Un paso a la vez.",
      "Estamos en la zona. Continuamos.",
    ],
    audioConfig: {
      frequency: 440,
      type: 'sine',
      duration: 0.25,
      cooldown: 60000,
    },
  },
  ALERTA_SUAVE: {
    messages: [
      "Volvamos poco a poco al objetivo.",
      "Sin prisa: retomemos donde nos quedamos.",
      "Reconectemos con el micro-paso activo.",
      "Tomemos aire y regresemos al flujo.",
      "Aquí estamos. Volvamos a la pantalla.",
    ],
    audioConfig: {
      frequency: 528,
      type: 'sine',
      duration: 0.3,
      cooldown: 45000,
    },
  },
  FATIGA: {
    messages: [
      "Siento el cansancio. Respiremos un momento.",
      "Parpadear e hidratarse también es avanzar.",
      "Bajemos la velocidad unos segundos.",
      "Cuidemos la energía. Vamos a nuestro ritmo.",
      "Tomemos un respiro rápido para recuperar.",
    ],
    audioConfig: {
      frequency: 330,
      type: 'triangle',
      duration: 0.5,
      cooldown: 60000,
    },
  },
  PARALISIS: {
    messages: [
      "No hay prisa. Solo hagamos el primer clic.",
      "Simplifiquemos: enfoquémonos en una sola acción.",
      "Estamos aquí. Avancemos sin presión.",
      "Rompamos la inercia con un paso mínimo.",
      "Cero presión. Avanzamos cuando estés listo.",
    ],
    audioConfig: {
      frequency: 261.63,
      type: 'sine',
      duration: 0.7,
      cooldown: 45000,
    },
  },
  CELEBRACION: {
    messages: [
      "¡Buen trabajo! Sigamos con el siguiente paso.",
      "¡Un paso menos! Sentimos ese avance.",
      "¡Logrado! Estamos avanzando con firmeza.",
      "¡Muy bien! Seguimos sumando victorias.",
      "¡Paso completado! Vamos por el que sigue.",
    ],
    audioConfig: {
      frequency: 523.25,
      type: 'sine',
      duration: 0.3,
      cooldown: 0,
    },
  },
  PAUSA: {
    messages: [
      "Nos tomamos una pausa bien merecida.",
      "Desconectemos unos minutos para recargar.",
      "Momento de estirarnos y descansar la vista.",
      "Pausa activa: cuidamos nuestra mente.",
    ],
    audioConfig: {
      frequency: 392,
      type: 'sine',
      duration: 0.3,
      cooldown: 30000,
    },
  },
};

/**
 * Retorna una frase aleatoria en tono de compañero TDAH (Body Doubling) para el estado actual.
 */
export const getRandomStateMessage = (state: FocusState): string => {
  const messages = AVATAR_CONFIG[state]?.messages;
  if (!messages || messages.length === 0) return '';
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
};
