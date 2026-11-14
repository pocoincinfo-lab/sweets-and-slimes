class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastPlayed: Record<string, number> = {};

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private canPlay(key: string, minIntervalMs: number): boolean {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return false;
    const now = performance.now();
    const prev = this.lastPlayed[key] ?? 0;
    if (now - prev < minIntervalMs) return false;
    this.lastPlayed[key] = now;
    return true;
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delaySec = 0
  ): void {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delaySec;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  playPlace(): void {
    this.unlock();
    if (!this.canPlay('place', 35)) return;
    this.tone(360, 620, 0.09, 'sine', 0.14);
  }

  playDemolish(): void {
    this.unlock();
    if (!this.canPlay('demolish', 45)) return;
    this.tone(420, 180, 0.1, 'triangle', 0.12);
  }

  playRotate(): void {
    this.unlock();
    if (!this.canPlay('rotate', 30)) return;
    this.tone(680, 820, 0.05, 'sine', 0.08);
  }

  playShoot(): void {
    if (!this.canPlay('shoot', 70)) return;
    this.tone(520, 240, 0.08, 'triangle', 0.07);
  }

  playMunch(): void {
    if (!this.canPlay('munch', 75)) return;
    this.tone(290, 440, 0.07, 'sine', 0.06);
  }

  playBounce(chain = 0): void {
    if (!this.canPlay('bounce', 60)) return;
    const base = 330 * Math.pow(1.12, Math.min(chain, 6));
    this.tone(base, base * 1.9, 0.22, 'sine', 0.14);
    this.tone(base * 1.25, base * 2.1, 0.18, 'triangle', 0.08, 0.05);
  }

  playStar(): void {
    if (!this.canPlay('star', 80)) return;
    this.tone(880, 1046, 0.1, 'sine', 0.09, 0);
    this.tone(1174, 1567, 0.14, 'sine', 0.09, 0.06);
  }

  playPhaseUp(): void {
    this.unlock();
    if (!this.canPlay('phase', 400)) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, n * 1.02, 0.22, 'triangle', 0.13, idx * 0.08);
    });
  }

  playLaunch(): void {
    this.unlock();
    if (!this.canPlay('launch', 800)) return;
    const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    fanfare.forEach((n, idx) => {
      this.tone(n, n * 1.04, 0.3, 'triangle', 0.15, idx * 0.1);
    });
    this.tone(140, 620, 1.4, 'sawtooth', 0.07, 0.2);
  }
}

export const audio = new SoundEngine();
