class BrownNoiseEngine {
  private ctx: AudioContext | null = null;
  private node: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;

  public start(volume: number = 0.3) {
    if (this.isPlaying) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Filtro de integración para generar ruido browniano (-6dB/octava)
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Ganancia para compensar caída
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);

      noiseSource.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      noiseSource.start(0);
      this.node = noiseSource;
      this.isPlaying = true;
    } catch (e) {
      console.warn("Web Audio API no iniciada:", e);
    }
  }

  public stop() {
    if (!this.isPlaying) return;
    try {
      if (this.node) {
        (this.node as AudioBufferSourceNode).stop();
        this.node.disconnect();
      }
      if (this.ctx) {
        this.ctx.close();
      }
    } catch (e) {
      console.warn("Error al detener audio:", e);
    }
    this.isPlaying = false;
    this.ctx = null;
    this.node = null;
  }

  public setVolume(volume: number) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime);
    }
  }

  public getStatus(): boolean {
    return this.isPlaying;
  }
}

export const brownNoise = new BrownNoiseEngine();
