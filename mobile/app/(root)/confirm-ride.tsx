import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import { RideRatingModal } from "@/components/RideRatingModal";
import RideLayout from "@/components/RideLayout";
import { icons } from "@/constants";
import { getBackendUrl } from "@/lib/config";
import { voraSocket } from "@/lib/socket";
import { voraVoice } from "@/lib/voiceAssistant";
import { useClerkUser } from "@/lib/useClerkSafe";
import { callAudio } from "@/lib/callAudio";
import { voraNotif } from "@/lib/notifications";
import { voraVoIP } from "@/lib/webrtcVoice";


export default function ConfirmRide() {
  const { user } = useClerkUser();
  const params = useLocalSearchParams();
  const rideId = (params.rideId as string) || "";
  const initialOtp = (params.otpCode as string) || "";

  const [ride, setRide] = useState<any>(null);
  const [status, setStatus] = useState<
    "ACCEPTED" | "IN_TRANSIT" | "ARRIVEE_SIGNALEE" | "COMPLETED" | "EN_LITIGE"
  >("ACCEPTED");
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [otpCode, setOtpCode] = useState(initialOtp);

  // ─── ÉTAT APPELS VOCAUX IN-APP (VoIP) ─────────────────────────────
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<"calling" | "connected" | "ended">("calling");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  // ─── ÉTAT CHAT EN DIRECT AVEC LE CHAUFFEUR ─────────────────────────
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; senderId: string; text: string; timestamp: string }>>([
    {
      id: "sys-init",
      senderId: "system",
      text: "Échange sécurisé & direct avec votre chauffeur VORA. Vos numéros réels restent protégés.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [chatInputText, setChatInputText] = useState("");

  // ─── ÉTAT ASSISTANTE VOCALE VORA (Passager peut activer/désactiver) ────
  const [voiceEnabled, setVoiceEnabled] = useState(voraVoice.isEnabled());
  useEffect(() => {
    return voraVoice.subscribe(setVoiceEnabled);
  }, []);

  // 1. Initialiser les données de la course
  useEffect(() => {
    if (params.rideData) {
      try {
        const parsed =
          typeof params.rideData === "string"
            ? JSON.parse(params.rideData)
            : params.rideData;
        setRide(parsed);
        if (parsed.otp_code) setOtpCode(parsed.otp_code);
        if (parsed.status) setStatus(parsed.status);
      } catch (err) {
        console.warn("Erreur parsing rideData:", err);
      }
    }

    // Récupération complète depuis l'API backend si rideId présent
    if (rideId) {
      const fetchRide = async () => {
        try {
          const backendUrl = getBackendUrl();
          const res = await fetch(`${backendUrl}/api/rides/${rideId}`);
          const data = await res.json();
          if (data.success && data.ride) {
            setRide(data.ride);
            if (data.ride.otp_code) setOtpCode(data.ride.otp_code);
            if (data.ride.status) setStatus(data.ride.status);
          }
        } catch (err) {
          console.error("Erreur chargement course:", err);
        }
      };
      fetchRide();
    }
  }, [rideId, params.rideData]);

  // 2. Annonce vocale d'accueil VORA dès l'arrivée sur l'écran
  useEffect(() => {
    if (ride) {
      const driverName = ride.driver_display_name || ride.driver_name || "Un chauffeur";
      voraVoice.speak(
        `${driverName} a accepté votre course. Le véhicule est en route vers votre point de prise en charge.`
      );
    }
  }, [ride?.id]);

  // 3. Socket.io : Suivi en temps réel de la géolocalisation et des statuts
  useEffect(() => {
    const socket = voraSocket.getSocket();
    if (!socket) return;

    const targetDriverId = ride?.driver_id || 1;

    // Écouter la position en direct du chauffeur
    const locationChannel = `driver-location:${targetDriverId}`;
    socket.on(locationChannel, (data: { driverId: number; lat: number; lng: number }) => {
      setDriverLocation({ lat: data.lat, lng: data.lng });
    });

    // Prise en charge effectuée par le chauffeur
    const onPickedUp = () => {
      setStatus("IN_TRANSIT");
      voraVoice.speak("Votre chauffeur vous a pris en charge. En route vers votre destination !");
      Alert.alert(
        "Prise en charge confirmée",
        "Votre trajet vers la destination finale a commencé."
      );
    };

    socket.on("passenger-picked-up", onPickedUp);
    socket.on("ride-started", onPickedUp);

    // Arrivée déclarée par le chauffeur
    socket.on("arrival-declared", () => {
      setStatus("ARRIVEE_SIGNALEE");
      voraNotif.playCompleted();
      voraVoice.speak(
        "Votre chauffeur signale être arrivé à destination. Veuillez confirmer la fin de la course."
      );
    });

    // Course clôturée mutuellement ou par expiration
    socket.on("ride-completed-mutual", (data: any) => {
      setStatus("COMPLETED");
      voraNotif.notifyRideCompleted(data?.fare_fcfa || ride?.fare_fcfa);
      voraVoice.speak(
        "Course terminée. Merci d'avoir voyagé avec VORA. Veuillez noter votre chauffeur."
      );
      setShowRatingModal(true);
    });

    // Litige
    socket.on("ride-disputed", () => {
      setStatus("EN_LITIGE");
      voraVoice.speak("Un litige a été ouvert. Le support VORA traite votre réclamation.");
    });

    // Annulation de la course par le chauffeur
    const onRideCancelled = (data?: { reason?: string; cancelledBy?: string }) => {
      voraNotif.notifyRideCancelled(data?.reason, data?.cancelledBy);
      voraVoice.speak("Attention, votre chauffeur a dû annuler la prise en charge.");
      const reasonMsg = data?.reason || "Le chauffeur a rencontré un imprévu et a dû annuler la prise en charge avant le départ.";

      if (Platform.OS === "web") {
        window.alert(`Course annulée par le chauffeur.\n\n${reasonMsg}\n\nAucun frais ne vous a été débité. Vous pouvez commander un nouveau véhicule immédiatement.`);
        router.replace("/(root)/(tabs)/home" as any);
        return;
      }

      Alert.alert(
        "Course Annulée par le Chauffeur",
        `${reasonMsg}\n\nAucun frais ne vous a été débité.`,
        [
          {
            text: "Trouver un autre chauffeur",
            onPress: () => router.replace("/(root)/(tabs)/home" as any),
          },
        ]
      );
    };

    socket.on("ride-cancelled", onRideCancelled);
    if (rideId) {
      socket.on(`ride-cancelled:${rideId}`, onRideCancelled);
    }

    // Vérification d'annulation active par polling
    const cancelCheckInterval = setInterval(async () => {
      if (!rideId) return;
      try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/rides/${rideId}`);
        const data = await res.json();
        if (data.success && data.ride && data.ride.status === "CANCELLED") {
          clearInterval(cancelCheckInterval);
          onRideCancelled({ reason: "Le chauffeur a annulé la prise en charge." });
        }
      } catch (e) {}
    }, 2000);

    return () => {
      clearInterval(cancelCheckInterval);
      socket.off(locationChannel);
      socket.off("passenger-picked-up");
      socket.off("ride-started");
      socket.off("arrival-declared");
      socket.off("ride-completed-mutual");
      socket.off("ride-disputed");
      socket.off("ride-cancelled", onRideCancelled);
      if (rideId) {
        socket.off(`ride-cancelled:${rideId}`, onRideCancelled);
      }
    };
  }, [ride?.driver_id, rideId]);

  // 4. Timer d'Appel Vocal In-App
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isCallActive && callStatus === "connected") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive, callStatus]);

  // 5. Socket Listeners pour Appel In-App & Chat en direct
  useEffect(() => {
    // S'assurer que le socket est connecté (reconnexion si nécessaire)
    let socket = voraSocket.getSocket();
    if (!socket && user?.id) {
      socket = voraSocket.connect(user.id, "PASSENGER");
    }
    if (!socket) return;

    // Rejoindre la room de la course pour le VoIP
    const currentRideId = (rideId || ride?.id || "").toString();
    if (currentRideId) voraSocket.joinRide(currentRideId);

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
      voraVoice.speak("Communication vocale sécurisée établie.");
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

    // Sonnerie côté passager quand le chauffeur appelle
    const handleIncomingCall = (data: { callerId: string; callerName: string; rideId?: string; offer?: any }) => {
      setIsCallActive(true);
      setCallStatus("calling");
      callAudio.startRinging();
      voraVoice.speak(`Appel entrant de ${data.callerName || "votre chauffeur"}`);

      // Auto-réponse après 1.5s
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
  }, [rideId, user?.id, ride?.id]);

  const handleStartInAppCall = async () => {
    setIsCallActive(true);
    setCallStatus("calling");
    setCallDuration(0);
    callAudio.startRinging();
    voraVoice.speak("Appel vocal sécurisé VORA en cours.");

    let socket = voraSocket.getSocket();
    if (!socket && user?.id) {
      socket = voraSocket.connect(user.id, "PASSENGER");
    }

    const currentRideId = (rideId || ride?.id || "").toString();
    if (currentRideId && socket) {
      voraSocket.joinRide(currentRideId);
      socket.emit("webrtc-call-ride", {
        rideId: currentRideId,
        callerId: user?.id || "rider_me",
        callerName: user?.fullName || user?.firstName || "Passager VORA",
      });

      // Lance la transmission vocale micro réelle
      await voraVoIP.startCall(socket, currentRideId);
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

  const handleEndInAppCall = () => {
    callAudio.playEnded();
    voraVoIP.cleanup();
    const socket = voraSocket.getSocket();
    const currentRideId = (rideId || ride?.id || "").toString();
    const targetUserId = ride?.driver_user_id || ride?.driver_id || "1";
    if (currentRideId && socket) {
      socket.emit("webrtc-hangup-ride", {
        rideId: currentRideId,
        targetUserId: targetUserId.toString(),
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
      senderId: user?.id || "me",
      text: msgText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInputText("");

    const socket = voraSocket.getSocket();
    const targetUserId = ride?.driver_user_id || ride?.driver_id || "1";
    socket?.emit("send-chat-message", {
      targetUserId: targetUserId.toString(),
      text: msgText,
      senderId: user?.id || "me",
    });
  };

  const formatCallTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Action : Confirmer la fin de la course
  const handleConfirmArrival = () => {
    if (rideId) {
      voraSocket.confirmRideEnd(rideId);
      setStatus("COMPLETED");
      voraVoice.speak("Merci d'avoir confirmé votre arrivée. Veuillez évaluer votre expérience.");
      setShowRatingModal(true);
    }
  };

  // Action : Annuler la course (uniquement pendant ACCEPTED)
  const [cancelling, setCancelling] = React.useState(false);
  const handleCancelRide = () => {
    Alert.alert(
      "Annuler la course",
      "Souhaitez-vous vraiment annuler cette course ? Le chauffeur sera notifié immédiatement.",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              const backendUrl = getBackendUrl();
              await fetch(`${backendUrl}/api/rides/${rideId}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Annulé par le passager" }),
              });
              // Notify driver via socket
              const socket = voraSocket.getSocket();
              if (socket) {
                socket.emit("ride-cancelled", { rideId, cancelledBy: "passenger" });
              }
              voraVoice.speak("Course annulée. Nous espérons vous retrouver très bientôt sur VORA.");
              router.replace("/(root)/(tabs)/home" as any);
            } catch (err) {
              console.error("Erreur annulation course:", err);
              Alert.alert("Erreur", "Impossible d'annuler la course. Veuillez contacter le support VORA.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // Action : Signaler un litige
  const handleReportDispute = () => {
    Alert.prompt
      ? Alert.prompt(
          "Signaler un problème",
          "Décrivez le motif du désaccord ou incident :",
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Envoyer réclamation",
              onPress: (text) => {
                voraSocket.disputeRide(
                  rideId,
                  ride?.rider_id || "rider_demo",
                  ride?.driver_id || 1,
                  text || "Problème signalé par le client"
                );
                setStatus("EN_LITIGE");
              },
            },
          ]
        )
      : Alert.alert(
          "Signaler un litige",
          "Voulez-vous signaler un problème sur cette course à l'assistance VORA ?",
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Signaler",
              style: "destructive",
              onPress: () => {
                voraSocket.disputeRide(
                  rideId,
                  ride?.rider_id || "rider_demo",
                  ride?.driver_id || 1,
                  "Problème signalé par le passager"
                );
                setStatus("EN_LITIGE");
              },
            },
          ]
        );
  };

  // Coordonnées pour la carte interactive
  const originLat = ride?.origin_lat || 3.8667;
  const originLng = ride?.origin_lng || 11.5167;
  const destLat = ride?.dest_lat || 3.875;
  const destLng = ride?.dest_lng || 11.52;

  // Position du chauffeur (suivi temps réel ou simulation d'approche)
  const currentDriverLat = driverLocation?.lat || originLat - 0.004;
  const currentDriverLng = driverLocation?.lng || originLng - 0.003;

  return (
    <RideLayout
      title="Suivi de Course en Direct"
      mapProps={{
        userLatitude: originLat,
        userLongitude: originLng,
        destinationLatitude: destLat,
        destinationLongitude: destLng,
        driverLatitude: currentDriverLat,
        driverLongitude: currentDriverLng,
        vehicleType: ride?.vehicle_type || "taxi",
        zoom: 15, // Zoom rapproché pour voir les quartiers
      }}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Statut Badge */}
        <View style={styles.statusHeader}>
          <View
            style={[
              styles.statusPill,
              status === "ACCEPTED" && styles.pillAccepted,
              status === "IN_TRANSIT" && styles.pillInTransit,
              status === "ARRIVEE_SIGNALEE" && styles.pillWaiting,
              status === "COMPLETED" && styles.pillCompleted,
              status === "EN_LITIGE" && styles.pillDispute,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                status === "ACCEPTED" && { backgroundColor: "#0284C7" },
                status === "IN_TRANSIT" && { backgroundColor: "#059669" },
                status === "ARRIVEE_SIGNALEE" && { backgroundColor: "#D97706" },
                status === "COMPLETED" && { backgroundColor: "#10B981" },
                status === "EN_LITIGE" && { backgroundColor: "#DC2626" },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                status === "ACCEPTED" && { color: "#0284C7" },
                status === "IN_TRANSIT" && { color: "#059669" },
                status === "ARRIVEE_SIGNALEE" && { color: "#D97706" },
                status === "COMPLETED" && { color: "#10B981" },
                status === "EN_LITIGE" && { color: "#DC2626" },
              ]}
            >
              {status === "ACCEPTED"
                ? "Chauffeur en approche"
                : status === "IN_TRANSIT"
                ? "Course en cours — À bord"
                : status === "ARRIVEE_SIGNALEE"
                ? "Arrivée signalée — Veuillez confirmer"
                : status === "COMPLETED"
                ? "Course terminée"
                : "Litige en cours"}
            </Text>
          </View>

          <Text style={styles.fareHighlight}>
            {(ride?.fare_fcfa || 1500).toLocaleString("fr-FR")} FCFA
          </Text>
        </View>

        {/* Bannière "Commande pour un tiers" si applicable */}
        {ride?.booked_for_other && (
          <View style={styles.otherBanner}>
            <Text style={styles.otherBannerTitle}>
              Course commandée pour une autre personne
            </Text>
            <Text style={styles.otherBannerSub}>
              Bénéficiaire : <Text style={{ fontWeight: "800" }}>{ride.passenger_name}</Text> ({ride.passenger_phone}).
              Vous conservez le suivi GPS en temps réel.
            </Text>
          </View>
        )}

        {/* Code OTP de Sécurité */}
        {status === "ACCEPTED" && otpCode && (
          <View style={styles.otpCard}>
            <Text style={styles.otpCardLabel}>CODE DE SÉCURITÉ OTP</Text>
            <Text style={styles.otpCardValue}>{otpCode}</Text>
            <Text style={styles.otpCardSub}>
              Communiquez ce code au chauffeur à son arrivée pour valider la prise en charge.
            </Text>
          </View>
        )}

        {/* Carte Chauffeur & Véhicule */}
        <View style={styles.driverCard}>
          <View style={styles.driverInfoRow}>
            {ride?.driver_avatar ? (
              <Image source={{ uri: ride.driver_avatar }} style={styles.driverAvatarImg} resizeMode="cover" />
            ) : (
              <View style={styles.driverAvatar}>
                <Text style={{ fontSize: 11, fontWeight: "900", color: "#0284C7" }}>
                  {ride?.vehicle_type === "moto" ? "MOTO" : "TAXI"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>
                {ride?.driver_display_name || ride?.driver_name || "Paul M. (Chauffeur VORA)"}
              </Text>
              <Text style={styles.vehicleDetails}>
                {ride?.vehicle_model || "Toyota Yaris"} • {ride?.color || "Jaune Taxi"}
              </Text>
              <View style={styles.ratingRow}>
                <Text style={styles.starText}>Note : {ride?.driver_rating || ride?.rating || "4.9"}/5</Text>
                <Text style={styles.ratingSub}>Notoriété vérifiée</Text>
              </View>
            </View>

            {/* Plaque d'immatriculation Cameroun */}
            <View style={styles.plateBadge}>
              <Text style={styles.plateCountry}>CMR</Text>
              <Text style={styles.plateText}>{ride?.license_plate || "LT-842-CA"}</Text>
            </View>
          </View>

          {/* Photo du véhicule pour identification visuelle rapide par le passager */}
          {ride?.vehicle_image && (
            <View style={styles.vehiclePhotoCard}>
              <View style={styles.vehiclePhotoHeader}>
                <Text style={styles.vehiclePhotoLabel}>VÉHICULE EN APPROCHE</Text>
                <Text style={styles.vehiclePhotoSub}>
                  {ride.vehicle_model} • {ride.color}
                </Text>
              </View>
              <Image
                source={{ uri: ride.vehicle_image }}
                style={styles.vehiclePhotoImg}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Boutons d'interaction 100% In-App */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              onPress={handleStartInAppCall}
              style={styles.callButton}
              activeOpacity={0.8}
            >
              <Ionicons name="call" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.callButtonText}>Appel In-App</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsChatActive(true)}
              style={styles.chatButton}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.chatButtonText}>Chat Chauffeur</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const next = voraVoice.toggleEnabled();
                setVoiceEnabled(next);
                if (next) {
                  voraVoice.speak("Assistante vocale VORA activée.");
                }
              }}
              style={[
                styles.voiceButton,
                !voiceEnabled && { backgroundColor: "rgba(148,163,184,0.12)", borderColor: "rgba(148,163,184,0.35)" },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={voiceEnabled ? "volume-high" : "volume-mute"}
                size={14}
                color={voiceEnabled ? "#0EA5E9" : "#94A3B8"}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.voiceButtonText, !voiceEnabled && { color: "#94A3B8" }]}>
                {voiceEnabled ? "Voix Active" : "Voix Coupée"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Résumé Trajet */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#10B981" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DÉPART</Text>
              <Text style={styles.routeAddress}>
                {ride?.origin_address || "Carrefour Mokolo, Yaoundé"}
              </Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#EF4444" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DESTINATION</Text>
              <Text style={styles.routeAddress}>
                {ride?.destination_address || "Quartier Bastos, Yaoundé"}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions selon Statut */}
        {status === "ARRIVEE_SIGNALEE" && (
          <View style={styles.arrivalPromptCard}>
            <Text style={styles.arrivalPromptTitle}>Arrivée signalée par le chauffeur</Text>
            <Text style={styles.arrivalPromptSub}>
              Le chauffeur indique être arrivé à bon port. Êtes-vous bien arrivé à destination ?
            </Text>
            <TouchableOpacity
              onPress={handleConfirmArrival}
              style={styles.confirmArrivalBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmArrivalBtnText}>
                Confirmer mon arrivée
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bouton d'annulation — visible uniquement si le chauffeur n'a pas encore pris en charge */}
        {status === "ACCEPTED" && (
          <TouchableOpacity
            onPress={handleCancelRide}
            style={[styles.cancelRideBtn, cancelling && styles.cancelRideBtnDisabled]}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Text style={styles.cancelRideBtnText}>Annuler la course</Text>
            }
          </TouchableOpacity>
        )}

        {status === "COMPLETED" && !hasRated && (
          <TouchableOpacity
            onPress={() => setShowRatingModal(true)}
            style={styles.rateDriverBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.rateDriverBtnText}>
              Évaluer et Noter le Chauffeur
            </Text>
          </TouchableOpacity>
        )}

        {/* Bouton Litige & Retour */}
        <View style={styles.bottomFooter}>
          {status !== "COMPLETED" && (
            <TouchableOpacity onPress={handleReportDispute} style={styles.disputeBtn}>
              <Text style={styles.disputeBtnText}>Signaler un problème</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.replace("/(root)/(tabs)/home" as any)}
            style={styles.homeBtn}
          >
            <Text style={styles.homeBtnText}>Retour à l'Accueil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal d'évaluation et de notation du chauffeur */}
      <RideRatingModal
        visible={showRatingModal}
        rideId={rideId}
        driverName={ride?.driver_display_name || ride?.driver_name || "Chauffeur VORA"}
        vehicleModel={ride?.vehicle_model || "Véhicule VORA"}
        onClose={() => setShowRatingModal(false)}
        onRated={() => {
          setHasRated(true);
          setShowRatingModal(false);
        }}
      />

      {/* ── MODAL APPEL VOCAL IN-APP VORA (VoIP) ── */}
      <Modal visible={isCallActive} animationType="slide" transparent>
        <View style={styles.callOverlay}>
          <View style={styles.callCard}>
            <TouchableOpacity
              onPress={handleEndInAppCall}
              style={styles.closeCallBtn}
              accessibilityLabel="Fermer"
            >
              <Text style={{ fontSize: 18, color: "#FFFFFF", fontWeight: "700" }}>✕</Text>
            </TouchableOpacity>

            <View style={styles.callAvatarCircle}>
              {ride?.driver_avatar ? (
                <Image source={{ uri: ride.driver_avatar }} style={styles.callAvatarImg} />
              ) : (
                <Text style={styles.callAvatarInitial}>
                  {(ride?.driver_display_name || ride?.driver_name || "C").charAt(0).toUpperCase()}
                </Text>
              )}
            </View>

            <Text style={styles.callName}>
              {ride?.driver_display_name || ride?.driver_name || "Chauffeur VORA"}
            </Text>
            <Text style={styles.callPublicId}>
              {ride?.driver_matricule || ride?.license_plate || "Appel Chiffré In-App VORA"}
            </Text>

            <View style={styles.callStatusBadge}>
              <View style={[styles.callStatusPulse, callStatus === "connected" && { backgroundColor: "#10B981" }]} />
              <Text style={styles.callStatusText}>
                {callStatus === "calling"
                  ? "Appel VoIP VORA en cours..."
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

              <TouchableOpacity style={styles.callHangupBtn} onPress={handleEndInAppCall}>
                <Ionicons name="call" size={22} color="#FFFFFF" style={{ transform: [{ rotate: "135deg" }] }} />
                <Text style={styles.callHangupBtnText}>Raccrocher</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL CHAT EN DIRECT AVEC LE CHAUFFEUR ── */}
      <Modal visible={isChatActive} animationType="slide" transparent>
        <View style={styles.chatOverlay}>
          <View style={styles.chatCard}>
            {/* Header Chat */}
            <View style={styles.chatHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View style={styles.chatHeaderAvatar}>
                  <Text style={styles.chatHeaderAvatarText}>
                    {(ride?.driver_display_name || ride?.driver_name || "C").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.chatHeaderName} numberOfLines={1}>
                    {ride?.driver_display_name || ride?.driver_name || "Chauffeur VORA"}
                  </Text>
                  <Text style={styles.chatHeaderSub} numberOfLines={1}>
                    {ride?.vehicle_model ? `${ride.vehicle_model} • ` : ""}En route vers vous
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    setIsChatActive(false);
                    router.push({
                      pathname: "/(root)/(tabs)/chat" as any,
                      params: {
                        driverId: ride?.driver_id?.toString() || "1",
                        driverName: ride?.driver_display_name || ride?.driver_name || "Chauffeur",
                        driverPublicId: ride?.driver_matricule || `VORA-DRV0${ride?.driver_id || 1}`,
                        vehicleModel: ride?.vehicle_model || "Véhicule VORA",
                        rideId: ride?.id,
                      },
                    });
                  }}
                  style={styles.chatExpandBtn}
                >
                  <Ionicons name="expand-outline" size={14} color="#0EA5E9" style={{ marginRight: 3 }} />
                  <Text style={styles.chatExpandBtnText}>Plein écran</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsChatActive(false)}
                  style={styles.chatCloseBtn}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notice sécurité */}
            <View style={styles.chatNotice}>
              <Ionicons name="shield-checkmark" size={14} color="#0EA5E9" style={{ marginRight: 6 }} />
              <Text style={styles.chatNoticeText}>
                Discussion cryptée VORA. Vos coordonnées réelles ne sont jamais partagées.
              </Text>
            </View>

            {/* Liste des messages */}
            <ScrollView style={styles.chatMessagesList} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
              {chatMessages.map((msg) => {
                const isMe = msg.senderId === (user?.id || "me");
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

            {/* Réponses rapides en 1 clic */}
            <View style={styles.chatQuickReplies}>
              <TouchableOpacity
                style={styles.quickReplyChip}
                onPress={() => setChatInputText("Je suis au point de rendez-vous.")}
              >
                <Text style={styles.quickReplyText}>👋 Je suis au RDV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickReplyChip}
                onPress={() => setChatInputText("J'arrive dans 1 minute !")}
              >
                <Text style={styles.quickReplyText}>⏳ J'arrive dans 1 min</Text>
              </TouchableOpacity>
            </View>

            {/* Champ de saisie */}
            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatInputField}
                placeholder="Écrire un message au chauffeur..."
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
    </RideLayout>
  );
}

const styles = StyleSheet.create({
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  pillAccepted: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
  },
  pillInTransit: {
    backgroundColor: "#D1FAE5",
    borderColor: "#A7F3D0",
  },
  pillWaiting: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  pillCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#6EE7B7",
  },
  pillDispute: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  fareHighlight: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0EA5E9",
  },
  otherBanner: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  otherBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  otherBannerSub: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 2,
    lineHeight: 16,
  },
  otpCard: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  otpCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  otpCardValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#38BDF8",
    letterSpacing: 6,
    marginVertical: 4,
  },
  otpCardSub: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },
  driverCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  driverInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  driverAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: "#0EA5E9",
  },
  vehiclePhotoCard: {
    marginTop: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  vehiclePhotoHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  vehiclePhotoLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0369A1",
    letterSpacing: 0.5,
  },
  vehiclePhotoSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  vehiclePhotoImg: {
    width: "100%",
    height: 140,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  vehicleDetails: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  starText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D97706",
  },
  ratingSub: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
  },
  plateBadge: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#0F172A",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
  },
  plateCountry: {
    fontSize: 8,
    fontWeight: "800",
    color: "#64748B",
  },
  plateText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  callButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#0EA5E9",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  chatButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#10B981",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  chatButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  voiceButton: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  routeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
  },
  routeAddress: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 1,
  },
  routeDivider: {
    height: 16,
    borderLeftWidth: 2,
    borderLeftColor: "#E2E8F0",
    marginLeft: 4,
    marginVertical: 4,
  },
  arrivalPromptCard: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  arrivalPromptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B45309",
    marginBottom: 4,
  },
  arrivalPromptSub: {
    fontSize: 12,
    color: "#92400E",
    lineHeight: 16,
    marginBottom: 12,
  },
  confirmArrivalBtn: {
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmArrivalBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  cancelRideBtn: {
    borderWidth: 1.5,
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
    minHeight: 48,
    justifyContent: "center",
  },
  cancelRideBtnDisabled: {
    opacity: 0.6,
  },
  cancelRideBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  rateDriverBtn: {
    backgroundColor: "#D97706",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  rateDriverBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  bottomFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  disputeBtn: {
    paddingVertical: 8,
  },
  disputeBtnText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  homeBtn: {
    paddingVertical: 8,
  },
  homeBtnText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
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
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#38BDF8",
    overflow: "hidden",
  },
  callAvatarImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
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
    backgroundColor: "#0EA5E9",
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
  chatExpandBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  chatExpandBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0EA5E9",
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
});
