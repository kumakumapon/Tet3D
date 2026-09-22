export class GameStorage {
  private best = 0;
  constructor() {
    try {
      const value = Number(localStorage.getItem("cube-cascade.best"));
      if (Number.isSafeInteger(value) && value >= 0) this.best = value;
    } catch {
      /* Private browsing may deny storage. */
    }
  }
  get score() {
    return this.best;
  }
  record(score: number) {
    if (score > this.best) {
      this.best = score;
      try {
        localStorage.setItem("cube-cascade.best", String(score));
      } catch {
        /* Keep a session best when storage is unavailable. */
      }
    }
  }
}
export class Sound {
  enabled = false;
  private context: AudioContext | null = null;
  unlock() {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume().catch(() => {});
  }
  play(chain: number) {
    if (!this.enabled) return;
    try {
      this.unlock();
      const ctx = this.context!,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(
        220 * 2 ** (Math.min(chain, 8) / 4),
        ctx.currentTime,
      );
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      /* Audio is optional. */
    }
  }
}
