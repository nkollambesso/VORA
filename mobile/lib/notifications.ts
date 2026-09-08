/**
 * VORA Notification System
 * Gère les notifications locales (Web Notifications API) et les alertes sonores
 * pour les événements du cycle de vie d'une course (acceptée, annulée, terminée).
 * Fonctionne en arrière-plan via le Service Worker.
 */

class VoraNotificationManager {
  private permission: NotificationPermission = "default";
  private audioCtx: AudioContext | null = null;

  /** Initialise le gestionnaire et demande les permissions */
  public async init(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      try {
        this.permission = await Notification.requestPermission();
      } catch {
        this.permission = "denied";
      }
    } else {
      this.permission = Notification.permission;
    }

    console.log("[VORA Notifications] Permission:", this.permission);
  }

  private getAudioCtx(): AudioContext | null {
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

  private playTone(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = "sine",
    maxGain: number = 0.2
  ) {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(maxGain, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch {}
  }

  /** Son positif — course acceptée (3 notes montantes harmonieuses) */
  public playAccepted() {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(523.25, now, 0.18, "sine", 0.22);          // C5
    this.playTone(659.25, now + 0.15, 0.18, "sine", 0.22);   // E5
    this.playTone(1046.5, now + 0.30, 0.35, "triangle", 0.25); // C6
    this.playTone(1318.5, now + 0.45, 0.40, "sine", 0.18);   // E6
  }

  /** Son d'alerte — course annulée (2 notes graves descendants) */
  public playCancelled() {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(493.88, now, 0.22, "triangle", 0.25);         // B4
    this.playTone(369.99, now + 0.22, 0.22, "triangle", 0.2);   // F#4
    this.playTone(293.66, now + 0.44, 0.35, "sine", 0.18);      // D4
  }

  /** Son de fin — course terminée (jingle VORA signature ascendant-descendant) */
  public playCompleted() {
    const ctx = this.getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.playTone(659.25, now, 0.15, "sine", 0.2);            // E5
    this.playTone(830.61, now + 0.13, 0.15, "sine", 0.2);     // G#5
    this.playTone(987.77, now + 0.26, 0.15, "triangle", 0.22); // B5
    this.playTone(1318.5, now + 0.39, 0.35, "sine", 0.22);    // E6
    this.playTone(1046.5, now + 0.65, 0.40, "triangle", 0.18); // C6
  }

  /** Affiche une notification système (si permission accordée) */
  public show(
    title: string,
    body: string,
    options?: { tag?: string; icon?: string }
  ): void {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    const perm = Notification.permission;
    if (perm !== "granted") return;

    try {
      new Notification(title, {
        body,
        icon: options?.icon || "/icon-192.png",
        badge: "/icon-192.png",
        tag: options?.tag || "vora-notification",
        silent: true, // Le son est géré par notre propre système audio
      });
    } catch (err) {
      console.warn("[VORA Notifications] Erreur notification:", err);
    }
  }

  /** Notifie que la course a été acceptée */
  public notifyRideAccepted(driverName?: string) {
    const name = driverName || "Un chauffeur";
    this.playAccepted();
    this.show(
      "🚗 Course Acceptée !",
      `${name} a accepté votre course. Il est en route vers vous.`,
      { tag: "ride-accepted" }
    );
  }

  /** Notifie que la course a été annulée */
  public notifyRideCancelled(reason?: string, cancelledBy?: string) {
    this.playCancelled();
    const who = cancelledBy === "driver" ? "Le chauffeur" : "Vous avez";
    this.show(
      "❌ Course Annulée",
      reason || `${who} annulé la prise en charge.`,
      { tag: "ride-cancelled" }
    );
  }

  /** Notifie que la course est terminée */
  public notifyRideCompleted(fare?: number) {
    this.playCompleted();
    const fareMsg = fare ? ` — Montant : ${fare} FCFA` : "";
    this.show(
      "✅ Course Terminée",
      `Votre course est terminée. Merci d'avoir voyagé avec VORA !${fareMsg}`,
      { tag: "ride-completed" }
    );
  }

  /** Notifie le chauffeur qu'une nouvelle course est disponible */
  public notifyNewRide(origin?: string) {
    this.playAccepted();
    this.show(
      "📍 Nouvelle Course !",
      origin ? `Prise en charge depuis : ${origin}` : "Une nouvelle demande de course est disponible.",
      { tag: "new-ride" }
    );
  }

  /** Notifie le chauffeur que le passager a confirmé la fin */
  public notifyDriverRideCompleted(fare?: number) {
    this.playCompleted();
    const fareMsg = fare ? ` — ${fare} FCFA encaissés.` : "";
    this.show(
      "✅ Course Terminée !",
      `Excellent travail ! La course est clôturée.${fareMsg}`,
      { tag: "driver-ride-completed" }
    );
  }
}

export const voraNotif = new VoraNotificationManager();
