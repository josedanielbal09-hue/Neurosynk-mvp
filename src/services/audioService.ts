import { AVATAR_CONFIG, FocusState } from '../config/avatarConfig';

interface NoteSpec {
  freq: number;
  type?: OscillatorType;
  startTimeOffset: number;
  duration: number;
  gain?: number;
}

class AudioService {
  private audioCtx: AudioContext | null = null;
  private lastPlayedMap: Map<FocusState, number> = new Map();
  private muted: boolean = false;

  /**
   * Obtiene o inicializa perezosamente el AudioContext nativo de la Web Audio API.
   * Restaura el contexto si el navegador lo suspendió por políticas de reproducción.
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {
        // Ignora silenciosamente si aún no ha habido gesto de usuario
      });
    }

    return this.audioCtx;
  }

  /**
   * Alterna el estado global de silencio del audio.
   * @returns el nuevo estado de silencio (true si está en silencio).
   */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Indica si el servicio de audio se encuentra actualmente en silencio.
   */
  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Establece de forma explícita el estado de silencio global.
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * Reproduce una secuencia o acorde polifónico de notas armónicas ("Earcons")
   * con envolventes suaves de ataque y caída gradual.
   */
  private playHarmonicNotes(notes: NoteSpec[], defaultType: OscillatorType = 'sine'): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = note.type || defaultType;
        osc.frequency.setValueAtTime(note.freq, now + note.startTimeOffset);

        const attackTime = 0.02;
        const noteStart = now + note.startTimeOffset;
        const noteDuration = Math.max(note.duration, attackTime + 0.05);
        const peakGain = note.gain ?? 0.15;

        gainNode.gain.setValueAtTime(0, noteStart);
        gainNode.gain.linearRampToValueAtTime(peakGain, noteStart + attackTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + noteDuration);
      });
    } catch (err) {
      console.warn('AudioContext play error:', err);
    }
  }

  /**
   * Reproduce el "Earcon" armónico polifónico sintetizado correspondiente al estado dado,
   * respetando la regla de cooldown anti-fatiga.
   */
  public playStateSound(state: FocusState): void {
    if (this.muted) return;

    const config = AVATAR_CONFIG[state]?.audioConfig;
    if (!config) return;

    const now = Date.now();
    const lastPlayed = this.lastPlayedMap.get(state) || 0;

    // Lógica anti-fatiga: Ignora silenciosamente si se ejecutó hace menos del cooldown estipulado
    if (config.cooldown > 0 && now - lastPlayed < config.cooldown) {
      return;
    }

    switch (state) {
      case 'ENFOQUE':
        // Acorde ascendente suave de 2 notas (Do5 ➔ Sol5: 523.25Hz -> 783.99Hz)
        this.playHarmonicNotes([
          { freq: 523.25, type: 'sine', startTimeOffset: 0, duration: 0.35, gain: 0.12 },
          { freq: 783.99, type: 'sine', startTimeOffset: 0.08, duration: 0.4, gain: 0.15 },
        ]);
        break;

      case 'ALERTA_SUAVE':
        // Intervalo cálido descendente (La4 ➔ Mi4: 440Hz -> 329.63Hz) con onda triangular
        this.playHarmonicNotes([
          { freq: 440.0, type: 'triangle', startTimeOffset: 0, duration: 0.25, gain: 0.14 },
          { freq: 329.63, type: 'triangle', startTimeOffset: 0.07, duration: 0.35, gain: 0.12 },
        ], 'triangle');
        break;

      case 'FATIGA':
        // Frecuencia grave y cálida (220Hz ➔ 277.18Hz) con tono envolvente
        this.playHarmonicNotes([
          { freq: 220.0, type: 'triangle', startTimeOffset: 0, duration: 0.45, gain: 0.14 },
          { freq: 277.18, type: 'triangle', startTimeOffset: 0.1, duration: 0.4, gain: 0.1 },
        ], 'triangle');
        break;

      case 'PARALISIS':
        // Tono suave grave y profundo (220Hz ➔ 261.63Hz)
        this.playHarmonicNotes([
          { freq: 220.0, type: 'triangle', startTimeOffset: 0, duration: 0.4, gain: 0.15 },
          { freq: 261.63, type: 'triangle', startTimeOffset: 0.08, duration: 0.35, gain: 0.12 },
        ], 'triangle');
        break;

      case 'CELEBRACION':
        // Arpegio ascendente brillante en acorde mayor (Do5 ➔ Mi5 ➔ Sol5 ➔ Do6)
        this.playHarmonicNotes([
          { freq: 523.25, type: 'sine', startTimeOffset: 0, duration: 0.5, gain: 0.12 },
          { freq: 659.25, type: 'sine', startTimeOffset: 0.08, duration: 0.5, gain: 0.13 },
          { freq: 783.99, type: 'sine', startTimeOffset: 0.16, duration: 0.6, gain: 0.14 },
          { freq: 1046.5, type: 'sine', startTimeOffset: 0.24, duration: 0.8, gain: 0.16 },
        ]);
        break;

      case 'PAUSA':
        // Intervalo relajante (Sol4 ➔ Si4: 392Hz -> 493.88Hz)
        this.playHarmonicNotes([
          { freq: 392.0, type: 'sine', startTimeOffset: 0, duration: 0.35, gain: 0.12 },
          { freq: 493.88, type: 'sine', startTimeOffset: 0.1, duration: 0.45, gain: 0.12 },
        ]);
        break;
    }

    // Registrar timestamp del último sonido emitido para este estado
    this.lastPlayedMap.set(state, now);
  }
}

export const audioService = new AudioService();
