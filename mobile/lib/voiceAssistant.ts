/**
 * Assistante Vocale VORA (Voix Féminine Style Google Maps)
 * 
 * Utilise l'API Web Speech Synthesis avec sélection préférentielle
 * d'une voix française féminine naturelle, chaleureuse et fluide.
 */

class VoiceAssistant {
  private isSpeaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private voiceLoaded = false;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.initVoice();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoice();
      }
    }
  }

  private initVoice() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    // 1. Chercher d'abord une voix féminine française (fr-FR / fr)
    const frenchVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));

    const preferredFemale = frenchVoices.find((v) => {
      const name = v.name.toLowerCase();
      return (
        name.includes("female") ||
        name.includes("femme") ||
        name.includes("amelie") ||
        name.includes("amélie") ||
        name.includes("hortense") ||
        name.includes("audrey") ||
        name.includes("marie") ||
        name.includes("google français") ||
        name.includes("virginie")
      );
    });

    this.selectedVoice = preferredFemale || frenchVoices[0] || voices[0];
    this.voiceLoaded = true;
  }

  public speak(text: string, options?: { pitch?: number; rate?: number }) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      console.log(`[Assistante VORA] 🎙️ "${text}"`);
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Annule la file précédente pour réactivité immédiate

      if (!this.selectedVoice) {
        this.initVoice();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
        utterance.lang = this.selectedVoice.lang || "fr-FR";
      } else {
        utterance.lang = "fr-FR";
      }

      // Ton féminin chaleureux, courtois et dynamique (type guidage GPS)
      utterance.pitch = options?.pitch ?? 1.15;
      utterance.rate = options?.rate ?? 0.98;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        this.isSpeaking = true;
      };
      utterance.onend = () => {
        this.isSpeaking = false;
      };
      utterance.onerror = (e) => {
        this.isSpeaking = false;
        console.warn("[Assistante VORA] Erreur audio:", e);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("[Assistante VORA] Synthèse vocale indisponible:", err);
    }
  }

  // Annonces prédéfinies
  public announceWelcome() {
    this.speak("Bonjour, bienvenue sur VORA. Où souhaitez-vous aller aujourd'hui ?");
  }

  public announceRideAccepted(driverName: string = "Votre chauffeur", vehicleModel: string = "son véhicule", etaMin: number = 3) {
    this.speak(`Course confirmée ! ${driverName} arrive avec ${vehicleModel} dans environ ${etaMin} minutes.`);
  }

  public announceDriverArrived() {
    this.speak("Votre chauffeur VORA est arrivé au point de rendez-vous.");
  }

  public announcePassengerPickedUp(destination: string = "votre destination") {
    this.speak(`Prise en charge validée. En route vers ${destination}. Installez-vous confortablement.`);
  }

  public announceRideCompleted() {
    this.speak("Vous êtes arrivés à destination. Merci d'avoir voyagé avec VORA ! N'oubliez pas vos effets personnels.");
  }

  public announceDriverNewRide(pickupAddress: string) {
    this.speak(`Nouvelle demande de course reçue ! Prise en charge à ${pickupAddress}.`);
  }

  public announceDriverPickupReady() {
    this.speak("Vous êtes arrivé auprès du client. Validez la prise en charge pour commencer le trajet.");
  }
}

export const voraVoice = new VoiceAssistant();
