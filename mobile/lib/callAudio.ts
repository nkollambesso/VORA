/**
 * VORA VoIP Call Audio Synthesizer
 * Génère des sonneries et effets sonores modernes (type FaceTime / Telegram)
 * sans dépendance externe lourde grâce à l'API Web Audio native.
 */

class CallAudioManager {
  private audioCtx: AudioContext | null = null;
  private ringInterval: any = null;
  private isRinging: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Joue une note douce avec une enveloppe d'attaque et d'extinction
   */
  private playTone(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = "sine",
    maxGain: number = 0.15
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      // Enveloppe d'amplitude ADSR ultra douce (pas de clic)
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(maxGain, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch {
      // Audio context might be restricted before first interaction
    }
  }

  /**
   * Motif de sonnerie VORA : Accord mélodique futuriste et élégant (Marimba / Chime)
   */
  private playRingPattern() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Motif mélodique VORA (Arpège élégant style Apple / Telegram)
    // Note 1: E5 (659 Hz)
    this.playTone(659.25, now, 0.28, "triangle", 0.18);
    this.playTone(1318.5, now, 0.22, "sine", 0.06);

    // Note 2: G#5 (830 Hz)
    this.playTone(830.61, now + 0.16, 0.28, "triangle", 0.18);

    // Note 3: B5 (987 Hz)
    this.playTone(987.77, now + 0.32, 0.35, "triangle", 0.2);

    // Note 4: E6 (1318 Hz)
    this.playTone(1318.51, now + 0.48, 0.45, "sine", 0.15);

    // Écho harmonique subtil
    this.playTone(1975.53, now + 0.52, 0.35, "sine", 0.05);
  }

  /**
   * Démarre la boucle de sonnerie (se répète toutes les 2.2 secondes)
   */
  public startRinging() {
    if (this.isRinging) return;
    this.isRinging = true;

    // Première sonnerie immédiate
    this.playRingPattern();

    // Répétition
    this.ringInterval = setInterval(() => {
      if (this.isRinging) {
        this.playRingPattern();
      }
    }, 2200);
  }

  /**
   * Arrête la sonnerie
   */
  public stopRinging() {
    this.isRinging = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  /**
   * Son de connexion d'appel (jingle satisfaisant à 3 tons ascendants)
   */
  public playConnected() {
    this.stopRinging();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(523.25, now, 0.14, "sine", 0.18);        // C5
    this.playTone(659.25, now + 0.12, 0.16, "sine", 0.2);  // E5
    this.playTone(1046.5, now + 0.24, 0.35, "triangle", 0.22); // C6
  }

  /**
   * Son de fin d'appel (deux bips doux descendants)
   */
  public playEnded() {
    this.stopRinging();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(493.88, now, 0.18, "sine", 0.15);       // B4
    this.playTone(329.63, now + 0.18, 0.25, "sine", 0.12); // E4
  }
}

export const callAudio = new CallAudioManager();
