import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Map from "@/components/Map";
import { voraSocket } from "@/lib/socket";
import { voraVoice } from "@/lib/voiceAssistant";

export default function DriverNavigation() {
  const { rideId, rideData } = useLocalSearchParams();
  const [ride, setRide] = useState<any>(null);
  const [status, setStatus] = useState<
    "ACCEPTED" | "IN_TRANSIT" | "ARRIVEE_SIGNALEE" | "COMPLETED" | "EN_LITIGE"
  >("ACCEPTED");
  const [otpInput, setOtpInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);

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

  // Appeler le passager ou passager tiers
  const handleCallPassenger = () => {
    const phone = ride?.booked_for_other ? ride?.passenger_phone : ride?.rider_phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert("Numéro", "Numéro de téléphone sécurisé via l'application.");
    }
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
              const next = !voiceEnabled;
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
          {(ride?.passenger_phone || ride?.rider_phone) && (
            <TouchableOpacity onPress={handleCallPassenger} style={styles.callBtn}>
              <Text style={styles.callBtnText}>Appeler</Text>
            </TouchableOpacity>
          )}
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
});
