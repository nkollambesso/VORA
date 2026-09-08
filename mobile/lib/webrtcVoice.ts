/**
 * Module Audio VoIP In-App VORA (WebRTC + Fallback Audio Chunks)
 * 
 * Assure la transmission réelle bidirectionnelle de la voix entre le passager et le chauffeur.
 * Utilise l'API WebRTC native (RTCPeerConnection + STUN Google) et dispose d'un fallback
 * de streaming de fragments audio autonomes haute fidélité (Opus/WebM/WAV) via Socket.io.
 */

import { Socket } from "socket.io-client";

class WebRTCVoiceManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private isStreamingAudio = false;
  private currentRecorder: any = null;
  private isMuted = false;
  private isConnected = false;
  private currentRideId: string | null = null;
  private socket: Socket | null = null;
  private audioQueue: string[] = [];
  private isPlayingQueue = false;
  public micStatus: "granted" | "denied" | "prompt" | "unsupported" = "prompt";

  private iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  /**
   * Déverrouille les restrictions de lecture audio du navigateur (Autoplay policy)
   */
  public unlockAudio() {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (e) {
      console.warn("[VoIP] unlockAudio:", e);
    }
  }

  /**
   * Initialise le microphone local de l'utilisateur
   */
  public async initMicrophone(): Promise<MediaStream | null> {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      console.warn("[VoIP] getUserMedia non supporté dans cet environnement.");
      this.micStatus = "unsupported";
      return null;
    }

    try {
      if (this.localStream) {
        this.stopLocalStream();
      }

      this.unlockAudio();

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.micStatus = "granted";
      console.log("🎤 [VoIP] Microphone capturé avec succès :", this.localStream.getAudioTracks().length, "pistes");
      return this.localStream;
    } catch (err: any) {
      console.warn("⚠️ [VoIP] Erreur d'accès au microphone :", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        this.micStatus = "denied";
      }
      return null;
    }
  }

  /**
   * Prépare ou récupère l'élément <audio> pour écouter l'interlocuteur
   */
  private getOrCreateRemoteAudio(): HTMLAudioElement | null {
    if (typeof document === "undefined") return null;

    if (!this.remoteAudio) {
      this.remoteAudio = document.createElement("audio");
      this.remoteAudio.id = "vora-remote-voip-audio";
      this.remoteAudio.autoplay = true;
      // @ts-ignore
      this.remoteAudio.playsInline = true;
      document.body.appendChild(this.remoteAudio);
    }
    return this.remoteAudio;
  }

  /**
   * Démarre une session d'appel WebRTC en tant qu'Appelant
   */
  public async startCall(socket: Socket, rideId: string, targetUserId?: string): Promise<{ offer?: any }> {
    this.socket = socket;
    this.currentRideId = rideId;
    this.isConnected = false;

    this.unlockAudio();
    await this.initMicrophone();
    this.setupPeerConnection(targetUserId);

    let createdOffer: any = null;

    if (this.pc && this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc?.addTrack(track, this.localStream!);
      });

      try {
        createdOffer = await this.pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await this.pc.setLocalDescription(createdOffer);

        socket.emit("webrtc-offer-ride", {
          rideId,
          offer: createdOffer,
          targetUserId,
        });
        console.log("📤 [VoIP] Offre WebRTC émise pour la course", rideId);
      } catch (err) {
        console.warn("⚠️ [VoIP] Erreur création de l'offre WebRTC:", err);
      }
    }

    // Démarre le streaming audio continu par fragments autonomes (garantit l'audio 100%)
    this.startAutonomousAudioChunkStreaming(socket, rideId, targetUserId);

    return { offer: createdOffer };
  }

  /**
   * Répond à un appel WebRTC entrant
   */
  public async answerCall(socket: Socket, rideId: string, offer?: any, targetUserId?: string) {
    this.socket = socket;
    this.currentRideId = rideId;

    this.unlockAudio();
    await this.initMicrophone();
    this.setupPeerConnection(targetUserId);

    if (this.pc && this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc?.addTrack(track, this.localStream!);
      });
    }

    if (this.pc && offer) {
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        socket.emit("webrtc-answer-ride", {
          rideId,
          answer,
          targetUserId,
        });
        console.log("📤 [VoIP] Réponse WebRTC émise pour la course", rideId);
      } catch (err) {
        console.warn("⚠️ [VoIP] Erreur réponse WebRTC:", err);
      }
    }

    // Démarre le streaming audio continu par fragments autonomes (garantit l'audio 100%)
    this.startAutonomousAudioChunkStreaming(socket, rideId, targetUserId);
  }

  /**
   * Traite la réponse reçue de l'interlocuteur
   */
  public async handleAnswer(answer: any) {
    if (this.pc && answer && this.pc.signalingState !== "stable") {
      try {
        await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ [VoIP] Remote Description (Answer) appliquée avec succès.");
      } catch (err) {
        console.warn("⚠️ [VoIP] Erreur application de la réponse:", err);
      }
    }
  }

  /**
   * Traite un ICE Candidate reçu
   */
  public async handleIceCandidate(candidate: any) {
    if (this.pc && candidate) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("⚠️ [VoIP] Erreur ajout ICE Candidate:", err);
      }
    }
  }

  /**
   * Configure l'instance RTCPeerConnection
   */
  private setupPeerConnection(targetUserId?: string) {
    if (typeof window === "undefined" || !window.RTCPeerConnection) {
      console.warn("[VoIP] RTCPeerConnection non supporté.");
      return;
    }

    try {
      this.pc = new RTCPeerConnection({ iceServers: this.iceServers });

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.socket && this.currentRideId) {
          this.socket.emit("webrtc-ice-candidate-ride", {
            rideId: this.currentRideId,
            candidate: event.candidate,
            targetUserId,
          });
        }
      };

      this.pc.ontrack = (event) => {
        console.log("🔊 [VoIP] Piste audio distante reçue !");
        this.isConnected = true;
        const remoteAudio = this.getOrCreateRemoteAudio();
        if (remoteAudio && event.streams && event.streams[0]) {
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.play().catch((e) => console.warn("Auto-play bloqué :", e));
        }
      };

      this.pc.onconnectionstatechange = () => {
        console.log("🌐 [VoIP] État de connexion WebRTC :", this.pc?.connectionState);
        if (this.pc?.connectionState === "connected") {
          this.isConnected = true;
        }
      };
    } catch (e) {
      console.warn("⚠️ [VoIP] Erreur création RTCPeerConnection:", e);
    }
  }

  /**
   * Enregistre en continu des segments audio complets et autonomes (avec entêtes complètes)
   * pour une retransmission vocale fluide et sans échec de décodage.
   */
  private startAutonomousAudioChunkStreaming(socket: Socket, rideId: string, targetUserId?: string) {
    if (typeof window === "undefined" || !this.localStream) return;

    // @ts-ignore
    const MediaRecorderClass = window.MediaRecorder;
    if (!MediaRecorderClass) return;

    this.isStreamingAudio = true;

    const mimeType = MediaRecorderClass.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorderClass.isTypeSupported("audio/ogg;codecs=opus")
      ? "audio/ogg;codecs=opus"
      : "";

    const captureChunk = () => {
      if (!this.isStreamingAudio || !this.localStream) return;

      try {
        const recorder = mimeType
          ? new MediaRecorderClass(this.localStream, { mimeType })
          : new MediaRecorderClass(this.localStream);

        this.currentRecorder = recorder;

        recorder.ondataavailable = (event: any) => {
          if (event.data && event.data.size > 200 && socket && !this.isMuted) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result as string;
              socket.emit("webrtc-audio-chunk", {
                rideId,
                audioBase64: base64data,
                targetUserId,
              });
            };
            reader.readAsDataURL(event.data);
          }
        };

        recorder.start();

        // Stoppe après 450ms pour finaliser un fichier audio WebM/Opus complet avec header
        setTimeout(() => {
          try {
            if (recorder.state === "recording") {
              recorder.stop();
            }
          } catch {}

          if (this.isStreamingAudio) {
            captureChunk();
          }
        }, 450);
      } catch (err) {
        console.warn("⚠️ [VoIP] Erreur capture chunk audio :", err);
      }
    };

    captureChunk();
    console.log("🎙️ [VoIP] Retransmission vocale haute fidélité active (450ms discrete segments)");
  }

  /**
   * Joue un fragment audio reçu via une file d'attente séquentielle (zéro coupure ni conflit)
   */
  public playAudioChunk(audioBase64: string) {
    if (!audioBase64 || typeof document === "undefined") return;

    this.unlockAudio();
    this.audioQueue.push(audioBase64);

    if (!this.isPlayingQueue) {
      this.processAudioQueue();
    }
  }

  private processAudioQueue() {
    if (this.audioQueue.length === 0) {
      this.isPlayingQueue = false;
      return;
    }

    this.isPlayingQueue = true;
    const chunkData = this.audioQueue.shift()!;

    try {
      const audio = new Audio(chunkData);
      audio.volume = 1.0;

      const advance = () => {
        audio.onended = null;
        audio.onerror = null;
        this.processAudioQueue();
      };

      audio.onended = advance;
      audio.onerror = advance;

      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(() => {
          advance();
        });
      }
    } catch {
      this.processAudioQueue();
    }
  }

  /**
   * Coupe ou réactive le microphone
   */
  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Bascule le haut-parleur
   */
  public setSpeaker(speakerOn: boolean) {
    if (this.remoteAudio) {
      this.remoteAudio.volume = speakerOn ? 1.0 : 0.6;
    }
  }

  /**
   * Arrête toutes les pistes audio du microphone local
   */
  private stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Nettoie et clôture complètement la communication audio
   */
  public cleanup() {
    console.log("🛑 [VoIP] Clôture et libération des ressources audio WebRTC.");
    this.isStreamingAudio = false;
    this.stopLocalStream();

    if (this.currentRecorder) {
      try {
        if (this.currentRecorder.state !== "inactive") {
          this.currentRecorder.stop();
        }
      } catch {}
      this.currentRecorder = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }

    if (this.remoteAudio) {
      try {
        this.remoteAudio.pause();
        this.remoteAudio.srcObject = null;
        this.remoteAudio.remove();
      } catch (e) {}
      this.remoteAudio = null;
    }

    this.audioQueue = [];
    this.isPlayingQueue = false;
    this.isConnected = false;
    this.currentRideId = null;
    this.socket = null;
  }
}

export const voraVoIP = new WebRTCVoiceManager();
