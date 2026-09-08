/**
 * Module Audio VoIP In-App VORA (WebRTC + Fallback Audio Chunks)
 * 
 * Assure la transmission réelle bidirectionnelle de la voix entre le passager et le chauffeur.
 * Utilise l'API WebRTC native (RTCPeerConnection + STUN Google) et dispose d'un fallback
 * de streaming de fragments audio haute fidélité (Opus/WebM) via Socket.io.
 */

import { Socket } from "socket.io-client";

class WebRTCVoiceManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private mediaRecorder: any = null;
  private isMuted = false;
  private isConnected = false;
  private currentRideId: string | null = null;
  private socket: Socket | null = null;

  private iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  /**
   * Initialise le microphone local de l'utilisateur
   */
  public async initMicrophone(): Promise<MediaStream | null> {
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      console.warn("[VoIP] getUserMedia non supporté dans cet environnement.");
      return null;
    }

    try {
      if (this.localStream) {
        this.stopLocalStream();
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      console.log("🎤 [VoIP] Microphone capturé avec succès :", this.localStream.getAudioTracks().length, "pistes");
      return this.localStream;
    } catch (err) {
      console.warn("⚠️ [VoIP] Erreur d'accès au microphone :", err);
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
  public async startCall(socket: Socket, rideId: string) {
    this.socket = socket;
    this.currentRideId = rideId;
    this.isConnected = false;

    await this.initMicrophone();
    this.setupPeerConnection();

    if (this.pc && this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc?.addTrack(track, this.localStream!);
      });

      try {
        const offer = await this.pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await this.pc.setLocalDescription(offer);

        socket.emit("webrtc-offer-ride", {
          rideId,
          offer,
        });
        console.log("📤 [VoIP] Offre WebRTC émise pour la course", rideId);
      } catch (err) {
        console.warn("⚠️ [VoIP] Erreur création de l'offre WebRTC:", err);
      }
    }

    // Démarre le streaming audio de secours via WebSocket
    this.startAudioChunkStreaming(socket, rideId);
  }

  /**
   * Répond à un appel WebRTC entrant
   */
  public async answerCall(socket: Socket, rideId: string, offer?: any) {
    this.socket = socket;
    this.currentRideId = rideId;

    await this.initMicrophone();
    this.setupPeerConnection();

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
        });
        console.log("📤 [VoIP] Réponse WebRTC émise pour la course", rideId);
      } catch (err) {
        console.warn("⚠️ [VoIP] Erreur réponse WebRTC:", err);
      }
    }

    // Démarre le streaming audio de secours via WebSocket
    this.startAudioChunkStreaming(socket, rideId);
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
  private setupPeerConnection() {
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
   * Streaming direct des paquets audio par WebSocket (Garantie de son même si WebRTC NAT bloque)
   */
  private startAudioChunkStreaming(socket: Socket, rideId: string) {
    if (typeof window === "undefined" || !this.localStream) return;

    try {
      // @ts-ignore
      const MediaRecorderClass = window.MediaRecorder;
      if (!MediaRecorderClass) return;

      const mimeType = MediaRecorderClass.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorderClass.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "";

      this.mediaRecorder = mimeType
        ? new MediaRecorderClass(this.localStream, { mimeType })
        : new MediaRecorderClass(this.localStream);

      this.mediaRecorder.ondataavailable = (event: any) => {
        if (event.data && event.data.size > 0 && socket && !this.isMuted) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            socket.emit("webrtc-audio-chunk", {
              rideId,
              audioBase64: base64data,
            });
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Émet un paquet audio toutes les 350ms pour une transmission continue et fluide
      this.mediaRecorder.start(350);
      console.log("🎙️ [VoIP] Enregistrement & retransmission vocale continue actif (350ms chunks)");
    } catch (err) {
      console.warn("⚠️ [VoIP] Échec initialisation MediaRecorder:", err);
    }
  }

  /**
   * Joue un fragment audio reçu via WebSocket (Fallback direct)
   */
  public playAudioChunk(audioBase64: string) {
    if (!audioBase64 || typeof document === "undefined") return;

    try {
      const audio = new Audio(audioBase64);
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch (e) {
      // Erreur de lecture silencieuse
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
    this.stopLocalStream();

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch (e) {}
      this.mediaRecorder = null;
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

    this.isConnected = false;
    this.currentRideId = null;
    this.socket = null;
  }
}

export const voraVoIP = new WebRTCVoiceManager();
