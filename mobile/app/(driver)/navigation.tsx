import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import Map from "@/components/Map";
import { voraSocket } from "@/lib/socket";
import { voraVoice } from "@/lib/voiceAssistant";
import { useClerkUser } from "@/lib/useClerkSafe";
import { callAudio } from "@/lib/callAudio";
import { getBackendUrl } from "@/lib/config";
import { voraNotif } from "@/lib/notifications";
import { voraVoIP } from "@/lib/webrtcVoice";


export default function DriverNavigation() {
  const { user } = useClerkUser();
  const { rideId, rideData } = useLocalSearchParams();
  const [ride, setRide] = useState<any>(null);
  const [status, setStatus] = useState<
    "ACCEPTED" | "IN_TRANSIT" | "ARRIVEE_SIGNALEE" | "COMPLETED" | "EN_LITIGE"
  >("ACCEPTED");
  const [otpInput, setOtpInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(voraVoice.isEnabled());

  useEffect(() => {
    return voraVoice.subscribe(setVoiceEnabled);
  }, []);

  // In-App Call & Chat States
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<"calling" | "connected" | "ended">("calling");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; senderId: string; text: string; timestamp: string }>>([
    {
      id: "sys-drv-init",
      senderId: "system",
      text: "Ligne sécurisée VORA avec votre passager. Vos numéros réels sont protégés.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [chatInputText, setChatInputText] = useState("");

  // Parse ride data
  useEffect(() => {
    if (rideData) {
      try {
        if (typeof rideData === "object") {
          setRide(rideData);
        } else if (typeof rideData === "string") {
          setRide(JSON.parse(rideData));
        }
      } catch (err) {
        console.error("Erreur parse rideData:", err);
      }
    }
  }, [rideData]);

  // Initial Voice guidance when screen loads in ACCEPTED state
  useEffect(() => {
    if (ride && status === "ACCEPTED" && voiceEnabled) {
      const pickupPlace = ride.origin_address || "au point de rendez-vous";
      voraVoice.speak(
        `Nouvelle course acceptée. Dirigez-vous vers le point de prise en charge du passager à ${pickupPlace}.`
      );
    }
  }, [ride]);

  // Écouter les retours Socket.io (OTP, prise en charge, arrivée, clôture)
  useEffect(() => {
    const socket = voraSocket.getSocket();
    if (!socket) return;

    // Prise en charge validée via OTP
    socket.on("ride-started-confirmed", () => {
      setStatus("IN_TRANSIT");
      if (voiceEnabled) {
        voraVoice.speak(
          `Prise en charge confirmée. En route vers la destination finale à ${
            ride?.destination_address || "destination"
          }.`
        );
      }
      Alert.alert(
        "Client Pris en Charge",
        "Le trajet vers la destination finale commence !"
      );
    });

    // Prise en charge validée directement (pickup-passenger)
    socket.on("pickup-confirmed", (data: any) => {
      setStatus("IN_TRANSIT");
      if (voiceEnabled) {
        voraVoice.speak(
          `Prise en charge validée. En route vers la destination finale à ${
            ride?.destination_address || "destination"
          }.`
        );
      }
      Alert.alert(
        "Prise en Charge Validée",
        "Le client est à bord. Suivez l'itinéraire jusqu'au lieu de destination."
      );
    });

    socket.on("otp-error", (data: any) => {
      Alert.alert(
        "Code Erroné",
        data.message || "Le code OTP saisi est incorrect."
      );
    });

    socket.on("arrival-declared-confirmed", (data: any) => {
      setStatus("ARRIVEE_SIGNALEE");
      setStatusMessage(data.message || "En attente de la confirmation du passager...");
      if (voiceEnabled) {
        voraVoice.speak("Vous êtes arrivé à destination. En attente de validation du passager.");
      }
    });

    socket.on("ride-completed-mutual", (data: any) => {
      setStatus("COMPLETED");
      voraNotif.notifyDriverRideCompleted(data?.ride?.fare_fcfa || ride?.fare_fcfa);
      if (voiceEnabled) {
        voraVoice.speak("Course terminée avec succès. Merci pour votre professionnalisme sur VORA !");
      }
      const autoMsg = data.autoConfirmed
        ? " (Confirmation automatique après délai)"
        : "";
      Alert.alert(
        "Course Clôturée !",
        `La course a été confirmée et le paiement est validé !${autoMsg}`,
        [
          {
            text: "Retour au Tableau de Bord",
            onPress: () => router.replace("/(driver)/dashboard" as any),
          },
        ]
      );
    });

    socket.on("ride-disputed", (data: any) => {
      setStatus("EN_LITIGE");
      if (voiceEnabled) {
        voraVoice.speak("Un litige a été signalé. Le dossier est transmis au support.");
      }
      Alert.alert(
        "Litige Signalé",
        data.message ||
          "Le passager a signalé un problème. Le paiement est mis en attente d'arbitrage par l'administration.",
        [
          {
            text: "Retour au Tableau de Bord",
            onPress: () => router.replace("/(driver)/dashboard" as any),
          },
        ]
      );
    });

    return () => {
      socket.off("ride-started-confirmed");
      socket.off("pickup-confirmed");
      socket.off("otp-error");
      socket.off("arrival-declared-confirmed");
      socket.off("ride-completed-mutual");
      socket.off("ride-disputed");
    };
  }, [ride, voiceEnabled]);

  // Action 1 : Prise en charge du client
  const handlePickupPassenger = () => {
    const targetRideId = (rideId as string) || ride?.id;
    if (!targetRideId) return;

    // Si le chauffeur a tapé un OTP, valider par OTP
    if (otpInput.trim().length >= 4) {
      voraSocket.startRideWithOTP(targetRideId, otpInput.trim());
    } else {
      // Sinon, prise en charge directe notifiée au système
      voraSocket.pickupPassenger(targetRideId);
      setStatus("IN_TRANSIT");
      if (voiceEnabled) {
        voraVoice.speak(
          `Prise en charge validée. En route vers la destination à ${
            ride?.destination_address || "destination"
          }.`
        );
      }
    }
  };

  // Action 2 : Déclarer l'arrivée à destination
  const handleDeclareArrival = () => {
    const targetRideId = (rideId as string) || ride?.id;
    if (!targetRideId) return;
    voraSocket.declareArrival(targetRideId);
  };

  // Action 3 : Annuler la prise en charge (Strictement avant OTP / statut ACCEPTED)
  const [isCancelling, setIsCancelling] = useState(false);
  const handleDriverCancelRide = () => {
    if (status !== "ACCEPTED") {
      Alert.alert(
        "Action non autorisée",
        "Vous ne pouvez annuler la course qu'avant la prise en charge / validation du code OTP."
      );
      return;
    }

    const targetRideId = (rideId as string) || ride?.id;
    if (!targetRideId) return;

    const executeDriverCancel = async (reasonText: string) => {
      setIsCancelling(true);
      try {
        const backendUrl = getBackendUrl();
        await fetch(`${backendUrl}/api/rides/${targetRideId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reasonText, cancelledBy: "driver" }),
        });

        voraSocket.cancelRide(targetRideId, reasonText, "driver");
        voraVoice.speak("Course annulée. Le passager a été notifié.");

        if (Platform.OS === "web") {
          window.alert("Course annulée avec succès. Le passager a été notifié.");
          router.replace("/(driver)/dashboard" as any);
          return;
        }

        Alert.alert(
          "Course Annulée",
          "La course a été annulée. Le passager a été notifié immédiatement.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(driver)/dashboard" as any),
            },
          ]
        );
      } catch (err) {
        console.error("Erreur annulation chauffeur:", err);
        Alert.alert("Erreur", "Une erreur est survenue lors de l'annulation de la course.");
      } finally {
        setIsCancelling(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined"
        ? window.confirm("Êtes-vous sûr de vouloir annuler cette course avant la prise en charge ? Le passager sera immédiatement prévenu.")
        : true;
      if (confirmed) {
        executeDriverCancel("Annulé par le chauffeur avant ramassage");
      }
      return;
    }

    Alert.alert(
      "Annuler la Course",
      "Êtes-vous sûr de vouloir annuler cette course avant la prise en charge ? Le passager sera immédiatement informé.",
      [
        { text: "Non, poursuivre", style: "cancel" },
        {
          text: "Oui, annuler la course",
          style: "destructive",
          onPress: () => executeDriverCancel("Annulé par le chauffeur avant ramassage"),
        },
      ]
    );
  };

  // ── IN-APP VOIP CALL & CHAT HANDLERS (CHAUFFEUR) ──
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isCallActive && callStatus === "connected") {
      interval = setInterval(() => setCallDuration((p) => p + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive, callStatus]);

  useEffect(() => {
    let socket = voraSocket.getSocket();
    if (!socket && user?.id) {
      socket = voraSocket.connect(user.id, "DRIVER");
    }
    if (!socket) return;

    const currentRideId = (rideId || ride?.id || "").toString();
    if (currentRideId) {
      voraSocket.joinRide(currentRideId);
    }

    const handleIncomingChatMessage = (data: { senderId: string; text: string }) => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          senderId: data.senderId,
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    };

    const handleCallAnswered = (data?: any) => {
      callAudio.stopRinging();
      callAudio.playConnected();
      setCallStatus("connected");
      voraVoice.speak("Passager en ligne.");
      if (data?.answer) {
        voraVoIP.handleAnswer(data.answer);
      }
    };

    const handleCallEnded = () => {
      callAudio.playEnded();
      voraVoIP.cleanup();
      setCallStatus("ended");
      setTimeout(() => {
        setIsCallActive(false);
        setCallDuration(0);
      }, 800);
    };

    const handleIncomingCall = (data: { callerId: string; callerName: string; rideId?: string; offer?: any }) => {
      setIsCallActive(true);
      setCallStatus("calling");
      callAudio.startRinging();
      voraVoice.speak(`Appel entrant de ${data.callerName || "votre passager"}`);

      // Réponse automatique après 1.5s
      setTimeout(async () => {
        callAudio.stopRinging();
        callAudio.playConnected();
        setCallStatus("connected");
        const s = voraSocket.getSocket();
        const callRideId = (data.rideId || rideId || ride?.id || "").toString();
        if (s && callRideId) {
          await voraVoIP.answerCall(s, callRideId, data.offer);
          s.emit("webrtc-answer-ride", { rideId: callRideId, callerId: data.callerId });
        }
      }, 1500);
    };

    const handleOffer = async (data: any) => {
      const s = voraSocket.getSocket();
      const callRideId = (data.rideId || rideId || ride?.id || "").toString();
      if (s && callRideId && data?.offer) {
        await voraVoIP.answerCall(s, callRideId, data.offer);
      }
    };

    const handleIceCandidate = (data: any) => {
      if (data?.candidate) {
        voraVoIP.handleIceCandidate(data.candidate);
      }
    };

    const handleAudioChunk = (data: any) => {
      if (data?.audioBase64) {
        voraVoIP.playAudioChunk(data.audioBase64);
      }
    };

    socket.on("receive-chat-message", handleIncomingChatMessage);
    socket.on("webrtc-call-answered", handleCallAnswered);
    socket.on("webrtc-answer-ride", handleCallAnswered);
    socket.on("webrtc-call-ended", handleCallEnded);
    socket.on("webrtc-incoming-call", handleIncomingCall);
    socket.on("webrtc-offer-ride", handleOffer);
    socket.on("webrtc-ice-candidate-ride", handleIceCandidate);
    socket.on("webrtc-audio-chunk", handleAudioChunk);

    return () => {
      callAudio.stopRinging();
      socket!.off("receive-chat-message", handleIncomingChatMessage);
      socket!.off("webrtc-call-answered", handleCallAnswered);
      socket!.off("webrtc-answer-ride", handleCallAnswered);
      socket!.off("webrtc-call-ended", handleCallEnded);
      socket!.off("webrtc-incoming-call", handleIncomingCall);
      socket!.off("webrtc-offer-ride", handleOffer);
      socket!.off("webrtc-ice-candidate-ride", handleIceCandidate);
      socket!.off("webrtc-audio-chunk", handleAudioChunk);
    };
  }, [rideId, ride?.id, user?.id]);

  const handleCallPassenger = async () => {
    setIsCallActive(true);
    setCallStatus("calling");
    setCallDuration(0);
    callAudio.startRinging();
    voraVoice.speak("Appel du passager en cours.");

    let socket = voraSocket.getSocket();
    if (!socket && user?.id) {
      socket = voraSocket.connect(user.id, "DRIVER");
    }

    const currentRideId = (rideId || ride?.id || "").toString();
    if (currentRideId && socket) {
      voraSocket.joinRide(currentRideId);
      socket.emit("webrtc-call-ride", {
        rideId: currentRideId,
        callerId: user?.id || "driver_me",
        callerName: user?.fullName || "Votre Chauffeur VORA",
      });

      // Lance la transmission vocale micro réelle
      await voraVoIP.startCall(socket, currentRideId);
    }

    const targetUserId = ride?.rider_id;
    if (targetUserId && socket) {
      socket.emit("webrtc-call-user", {
        targetUserId: targetUserId.toString(),
        callerId: user?.id || "driver_me",
        callerName: user?.fullName || "Votre Chauffeur VORA",
        offer: { type: "offer", sdp: "sdp-audio-stream" },
      });
    }

    // Auto-connecter après 3s si pas de réponse (simulation VoIP)
    setTimeout(() => {
      setCallStatus((prev) => {
        if (prev === "calling") {
          callAudio.stopRinging();
          callAudio.playConnected();
          return "connected";
        }
        return prev;
      });
    }, 3000);
  };

  const handleEndCall = () => {
    callAudio.playEnded();
    voraVoIP.cleanup();
    const socket = voraSocket.getSocket();
    const currentRideId = (rideId || ride?.id || "").toString();
    const targetUserId = ride?.rider_id;
    if (currentRideId && socket) {
      socket.emit("webrtc-hangup-ride", {
        rideId: currentRideId,
        targetUserId: targetUserId ? targetUserId.toString() : undefined,
      });
    }
    if (targetUserId && socket) {
      socket.emit("webrtc-hangup", { targetUserId: targetUserId.toString() });
    }
    setCallStatus("ended");
    setTimeout(() => {
      setIsCallActive(false);
      setCallDuration(0);
    }, 600);
  };

  const handleSendChatMessage = () => {
    if (!chatInputText.trim()) return;
    const msgText = chatInputText.trim();
    const newMsg = {
      id: Date.now().toString(),
      senderId: user?.id || "driver_me",
      text: msgText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInputText("");

    const socket = voraSocket.getSocket();
    const targetUserId = ride?.rider_id || "rider_me";
    socket?.emit("send-chat-message", {
      targetUserId: targetUserId.toString(),
      text: msgText,
      senderId: user?.id || "driver_me",
    });
  };

  const formatCallTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Map coordinates depending on step
  const originLat = ride?.origin_lat || 3.8667;
  const originLng = ride?.origin_lng || 11.5167;
  const destLat = ride?.dest_lat || 3.875;
  const destLng = ride?.dest_lng || 11.52;

  return (
    <View style={styles.container}>
      {/* Carte GPS Interactive + Bouton Retour & Bouton Voix */}
      <View style={styles.mapContainer}>
        <View style={styles.topControls}>
          <TouchableOpacity
            onPress={() => router.replace("/(driver)/dashboard" as any)}
            style={styles.floatingBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.floatingBtnText}>← Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const next = voraVoice.toggleEnabled();
              setVoiceEnabled(next);
              if (next) voraVoice.speak("Assistante VORA activée.");
            }}
            style={[styles.floatingBtn, voiceEnabled && styles.floatingVoiceActive]}
            activeOpacity={0.8}
          >
            <Text style={styles.floatingBtnText}>
              {voiceEnabled ? "Voix VORA Active" : "Voix Désactivée"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Leaflet Map:
            Step 1 (ACCEPTED): route from driver towards pickup point
            Step 2 (IN_TRANSIT): route from pickup towards destination */}
        <Map
          userLatitude={originLat}
          userLongitude={originLng}
          destinationLatitude={status === "ACCEPTED" ? originLat : destLat}
          destinationLongitude={status === "ACCEPTED" ? originLng : destLng}
          driverLatitude={originLat - 0.004}
          driverLongitude={originLng - 0.003}
          vehicleType={ride?.vehicle_type || "taxi"}
          zoom={16} // Zoom très rapproché pour distinguer tous les carrefours et quartiers
          routeMode={status === "ACCEPTED" ? "pickup" : "destination"}
        />
      </View>

      {/* Panneau de Contrôle Inférieur */}
      <View style={styles.panel}>
        {/* En-tête Phase de Navigation */}
        <View style={styles.headerRow}>
          <View
            style={[
              styles.statusBadge,
              status === "ACCEPTED" && styles.badgeAccepted,
              status === "IN_TRANSIT" && styles.badgeInTransit,
              status === "ARRIVEE_SIGNALEE" && styles.badgeWaiting,
              status === "EN_LITIGE" && styles.badgeDispute,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                status === "ACCEPTED" && { color: "#0284C7" },
                status === "IN_TRANSIT" && { color: "#059669" },
                status === "ARRIVEE_SIGNALEE" && { color: "#D97706" },
                status === "EN_LITIGE" && { color: "#DC2626" },
              ]}
            >
              {status === "ACCEPTED"
                ? "Étape 1 : Vers le point de prise en charge"
                : status === "IN_TRANSIT"
                ? "Étape 2 : En route vers la destination"
                : status === "ARRIVEE_SIGNALEE"
                ? "Arrivée signalée — Attente client"
                : status === "EN_LITIGE"
                ? "Course en litige"
                : "Course terminée"}
            </Text>
          </View>

          <Text style={styles.fareText}>
            {(ride?.fare_fcfa || 1500).toLocaleString("fr-FR")} FCFA
          </Text>
        </View>

        {/* Détails du passager (prise en compte commande pour un tiers) */}
        <View style={styles.passengerRow}>
          <View style={styles.passengerAvatar}>
            <Text style={{ fontSize: 11, fontWeight: "900", color: "#0284C7" }}>CLI</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.passengerLabel}>
              {ride?.booked_for_other ? "BÉNÉFICIAIRE (COMMANDÉ PAR UN TIERS)" : "PASSAGER"}
            </Text>
            <Text style={styles.passengerName}>
              {ride?.booked_for_other
                ? `${ride?.passenger_name} (${ride?.passenger_phone})`
                : ride?.rider_name || "Client VORA"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={handleCallPassenger} style={styles.callBtn} activeOpacity={0.8}>
              <Ionicons name="call" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.callBtnText}>Appel In-App</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsChatActive(true)} style={styles.chatBtn} activeOpacity={0.8}>
              <Ionicons name="chatbubble-ellipses" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.callBtnText}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ÉTAPE 1 : Adresse de Prise en charge */}
        {status === "ACCEPTED" && (
          <View style={styles.addressBox}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTag}>POINT DE RAMASSAGE</Text>
              <Text style={styles.stepDistance}>Client en attente</Text>
            </View>
            <Text style={styles.addressValue}>
              {ride?.origin_address || "Carrefour Mokolo, Yaoundé"}
            </Text>

            {/* Bouton Principal de Prise en charge */}
            <TouchableOpacity
              onPress={handlePickupPassenger}
              style={styles.primaryActionBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionBtnText}>
                Prendre en charge le client
              </Text>
            </TouchableOpacity>

            {/* Alternative : Saisie OTP optionnelle */}
            <View style={styles.otpAccordion}>
              <Text style={styles.otpLabel}>Ou saisir le code OTP du client :</Text>
              <View style={styles.otpInputRow}>
                <TextInput
                  style={styles.otpInput}
                  placeholder="Code OTP (ex: 4589)"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChangeText={setOtpInput}
                />
                <TouchableOpacity
                  onPress={handlePickupPassenger}
                  style={styles.otpVerifyBtn}
                >
                  <Text style={styles.otpVerifyBtnText}>Valider</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bouton Annulation de course par le chauffeur (Strictement avant OTP) */}
            <TouchableOpacity
              onPress={handleDriverCancelRide}
              disabled={isCancelling}
              style={styles.cancelRideDriverBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.cancelRideDriverBtnText}>
                {isCancelling ? "Annulation en cours..." : "Annuler la prise en charge (Avant OTP)"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ÉTAPE 2 : Destination Finale */}
        {status === "IN_TRANSIT" && (
          <View style={[styles.addressBox, { borderColor: "#A7F3D0" }]}>
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTag, { color: "#059669" }]}>DESTINATION FINALE</Text>
              <Text style={styles.stepDistance}>Client à bord</Text>
            </View>
            <Text style={styles.addressValue}>
              {ride?.destination_address || "Quartier Bastos, Yaoundé"}
            </Text>

            {/* Bouton Principal Terminer Course */}
            <TouchableOpacity
              onPress={handleDeclareArrival}
              style={[styles.primaryActionBtn, { backgroundColor: "#059669" }]}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryActionBtnText}>
                Terminer la course (Déclarer l'arrivée)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Écran Attente Confirmation Passager */}
        {status === "ARRIVEE_SIGNALEE" && (
          <View style={styles.waitingBox}>
            <Text style={styles.waitingTitle}>Arrivée signalée avec succès</Text>
            <Text style={styles.waitingSub}>
              Le client a reçu une notification pour confirmer son arrivée et vous attribuer une note.
              La course sera validée dès sa confirmation ou automatiquement sous 60 secondes.
            </Text>
          </View>
        )}

        {/* Écran Litige */}
        {status === "EN_LITIGE" && (
          <View style={styles.disputeBox}>
            <Text style={styles.disputeTitle}>Litige en cours d'examen</Text>
            <Text style={styles.disputeSub}>
              Le passager a formulé une réclamation. L'équipe d'arbitrage VORA vous contactera sous peu.
            </Text>
          </View>
        )}
      </View>

      {/* ── MODAL APPEL VOCAL IN-APP VORA (VoIP) ── */}
      <Modal visible={isCallActive} animationType="slide" transparent>
        <View style={styles.callOverlay}>
          <View style={styles.callCard}>
            <TouchableOpacity
              onPress={handleEndCall}
              style={styles.closeCallBtn}
              accessibilityLabel="Fermer"
            >
              <Text style={{ fontSize: 18, color: "#FFFFFF", fontWeight: "700" }}>✕</Text>
            </TouchableOpacity>

            <View style={styles.callAvatarCircle}>
              <Text style={styles.callAvatarInitial}>
                {(ride?.booked_for_other ? ride?.passenger_name : ride?.rider_name || "P").charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.callName}>
              {ride?.booked_for_other ? ride?.passenger_name : ride?.rider_name || "Passager VORA"}
            </Text>
            <Text style={styles.callPublicId}>
              {ride?.booked_for_other ? "Passager Bénéficiaire" : "Passager VORA In-App"}
            </Text>

            <View style={styles.callStatusBadge}>
              <View style={[styles.callStatusPulse, callStatus === "connected" && { backgroundColor: "#10B981" }]} />
              <Text style={styles.callStatusText}>
                {callStatus === "calling"
                  ? "Appel du passager en cours..."
                  : callStatus === "connected"
                  ? `En communication (${formatCallTime(callDuration)})`
                  : "Appel terminé"}
              </Text>
            </View>

            {/* Contrôles de l'Appel */}
            <View style={styles.callControlsRow}>
              <TouchableOpacity
                style={[styles.callControlBtn, isMuted && styles.callControlBtnActive]}
                onPress={() => {
                  const next = !isMuted;
                  setIsMuted(next);
                  voraVoIP.setMuted(next);
                }}
              >
                <Ionicons name={isMuted ? "mic-off" : "mic"} size={20} color={isMuted ? "#EF4444" : "#FFFFFF"} />
                <Text style={[styles.callControlBtnText, isMuted && styles.callControlBtnTextActive]}>
                  {isMuted ? "Muet" : "Micro"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callControlBtn, isSpeakerOn && styles.callControlBtnActive]}
                onPress={() => {
                  const next = !isSpeakerOn;
                  setIsSpeakerOn(next);
                  voraVoIP.setSpeaker(next);
                }}
              >
                <Ionicons name={isSpeakerOn ? "volume-high" : "volume-low"} size={20} color={isSpeakerOn ? "#0EA5E9" : "#FFFFFF"} />
                <Text style={[styles.callControlBtnText, isSpeakerOn && styles.callControlBtnTextActive]}>
                  {isSpeakerOn ? "HP On" : "Écouteur"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.callHangupBtn} onPress={handleEndCall}>
                <Ionicons name="call" size={22} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                <Text style={styles.callHangupBtnText}>Raccrocher</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL CHAT EN DIRECT AVEC LE PASSAGER ── */}
      <Modal visible={isChatActive} animationType="slide" transparent>
        <View style={styles.chatOverlay}>
          <View style={styles.chatCard}>
            {/* Header Chat */}
            <View style={styles.chatHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View style={styles.chatHeaderAvatar}>
                  <Text style={styles.chatHeaderAvatarText}>
                    {(ride?.booked_for_other ? ride?.passenger_name : ride?.rider_name || "P").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.chatHeaderName} numberOfLines={1}>
                    {ride?.booked_for_other ? ride?.passenger_name : ride?.rider_name || "Passager VORA"}
                  </Text>
                  <Text style={styles.chatHeaderSub} numberOfLines={1}>
                    Discussion sécurisée avec le client
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsChatActive(false)}
                style={styles.chatCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Notice sécurité */}
            <View style={styles.chatNotice}>
              <Ionicons name="shield-checkmark" size={14} color="#0EA5E9" style={{ marginRight: 6 }} />
              <Text style={styles.chatNoticeText}>
                Vos numéros réels ne sont jamais partagés. Échange sécurisé VORA.
              </Text>
            </View>

            {/* Liste des messages */}
            <ScrollView style={styles.chatMessagesList} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
              {chatMessages.map((msg) => {
                const isMe = msg.senderId === (user?.id || "driver_me");
                const isSystem = msg.senderId === "system";

                if (isSystem) {
                  return (
                    <View key={msg.id} style={styles.chatSystemMsg}>
                      <Text style={styles.chatSystemMsgText}>{msg.text}</Text>
                    </View>
                  );
                }

                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.chatBubble,
                      isMe ? styles.chatBubbleMe : styles.chatBubbleOther,
                    ]}
                  >
                    <Text style={[styles.chatBubbleText, isMe ? styles.chatBubbleTextMe : styles.chatBubbleTextOther]}>
                      {msg.text}
                    </Text>
                    <Text style={[styles.chatBubbleTime, isMe ? styles.chatBubbleTimeMe : styles.chatBubbleTimeOther]}>
                      {msg.timestamp}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* Réponses rapides chauffeur en 1 clic */}
            <View style={styles.chatQuickReplies}>
              <TouchableOpacity
                style={styles.quickReplyChip}
                onPress={() => setChatInputText("Je suis arrivé au point de rendez-vous.")}
              >
                <Text style={styles.quickReplyText}>📍 Je suis au RDV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickReplyChip}
                onPress={() => setChatInputText("J'arrive dans 2 minutes, un peu d'embouteillage.")}
              >
                <Text style={styles.quickReplyText}>⏱️ J'arrive dans 2 min</Text>
              </TouchableOpacity>
            </View>

            {/* Champ de saisie */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInputField}
                placeholder="Répondre au passager..."
                placeholderTextColor="#94A3B8"
                value={chatInputText}
                onChangeText={setChatInputText}
                onSubmitEditing={handleSendChatMessage}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.chatSendBtn, !chatInputText.trim() && { opacity: 0.5 }]}
                onPress={handleSendChatMessage}
                disabled={!chatInputText.trim()}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  topControls: {
    position: "absolute",
    top: 40,
    left: 16,
    right: 16,
    zIndex: 99,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  floatingBtn: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingVoiceActive: {
    backgroundColor: "rgba(14, 165, 233, 0.95)",
    borderColor: "#38BDF8",
  },
  floatingBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#E0F2FE",
    padding: 20,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeAccepted: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
  },
  badgeInTransit: {
    backgroundColor: "#D1FAE5",
    borderColor: "#A7F3D0",
  },
  badgeWaiting: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  badgeDispute: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  fareText: {
    color: "#0EA5E9",
    fontSize: 18,
    fontWeight: "900",
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  passengerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  passengerLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  passengerName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  callBtn: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  callBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  addressBox: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  stepTag: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.5,
  },
  stepDistance: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  addressValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 14,
  },
  primaryActionBtn: {
    backgroundColor: "#0284C7",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  otpAccordion: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  otpLabel: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 6,
    fontWeight: "600",
  },
  otpInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  otpInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  otpVerifyBtn: {
    backgroundColor: "#334155",
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: "center",
  },
  otpVerifyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  waitingBox: {
    backgroundColor: "#FEF3C7",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  waitingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B45309",
    marginBottom: 6,
  },
  waitingSub: {
    fontSize: 12,
    color: "#92400E",
    lineHeight: 18,
  },
  disputeBox: {
    backgroundColor: "#FEE2E2",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  disputeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 4,
  },
  disputeSub: {
    fontSize: 12,
    color: "#991B1B",
    lineHeight: 16,
  },
  chatBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  // ── Modale d'Appel Vocal In-App (VoIP) ──
  callOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  callCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0F172A",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    position: "relative",
  },
  closeCallBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  callAvatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#38BDF8",
    overflow: "hidden",
  },
  callAvatarInitial: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  callName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
    textAlign: "center",
  },
  callPublicId: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 16,
    textAlign: "center",
  },
  callStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    gap: 8,
  },
  callStatusPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
  callStatusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  callControlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    width: "100%",
  },
  callControlBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    minWidth: 72,
  },
  callControlBtnActive: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "#EF4444",
    borderWidth: 1,
  },
  callControlBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#E2E8F0",
    marginTop: 4,
  },
  callControlBtnTextActive: {
    color: "#EF4444",
  },
  callHangupBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  callHangupBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // ── Modale Chat Direct ──
  chatOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  chatCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "78%",
    maxHeight: 650,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0284C7",
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  chatHeaderName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  chatHeaderSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#10B981",
  },
  chatCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  chatNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  chatNoticeText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    flex: 1,
  },
  chatMessagesList: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  chatSystemMsg: {
    alignSelf: "center",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginVertical: 8,
    maxWidth: "85%",
  },
  chatSystemMsgText: {
    fontSize: 11,
    color: "#475569",
    textAlign: "center",
    fontWeight: "600",
  },
  chatBubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 4,
  },
  chatBubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: "#0EA5E9",
    borderBottomRightRadius: 4,
  },
  chatBubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 19,
  },
  chatBubbleTextMe: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  chatBubbleTextOther: {
    color: "#0F172A",
    fontWeight: "600",
  },
  chatBubbleTime: {
    fontSize: 10,
    marginTop: 4,
  },
  chatBubbleTimeMe: {
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "right",
  },
  chatBubbleTimeOther: {
    color: "#94A3B8",
    textAlign: "left",
  },
  chatQuickReplies: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  quickReplyChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  quickReplyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  chatInputField: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelRideDriverBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  cancelRideDriverBtnText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
  },
});
