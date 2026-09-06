import React, { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import Map from "@/components/Map";
import { voraSocket } from "@/lib/socket";

export default function DriverNavigation() {
  const { rideId, rideData } = useLocalSearchParams();
  const [ride, setRide] = useState<any>(null);
  const [status, setStatus] = useState<
    "ACCEPTED" | "IN_TRANSIT" | "ARRIVEE_SIGNALEE" | "COMPLETED" | "EN_LITIGE"
  >("ACCEPTED");
  const [otpInput, setOtpInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

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

  // Écouter les retours Socket.io OTP et confirmation mutuelle
  useEffect(() => {
    const socket = voraSocket.getSocket();

    socket?.on("ride-started-confirmed", () => {
      setStatus("IN_TRANSIT");
      Alert.alert(
        "Code OTP Validé",
        "Le passager a été pris en charge. La course commence !"
      );
    });

    socket?.on("otp-error", (data: any) => {
      Alert.alert(
        "Code Erroné",
        data.message || "Le code OTP saisi est incorrect."
      );
    });

    socket?.on("arrival-declared-confirmed", (data: any) => {
      setStatus("ARRIVEE_SIGNALEE");
      setStatusMessage(data.message || "En attente de la confirmation du passager...");
    });

    socket?.on("ride-completed-mutual", (data: any) => {
      setStatus("COMPLETED");
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

    socket?.on("ride-disputed", (data: any) => {
      setStatus("EN_LITIGE");
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
      socket?.off("ride-started-confirmed");
      socket?.off("otp-error");
      socket?.off("arrival-declared-confirmed");
      socket?.off("ride-completed-mutual");
      socket?.off("ride-disputed");
    };
  }, []);

  const handleVerifyOTP = () => {
    if (otpInput.length < 4) {
      Alert.alert(
        "Code incomplet",
        "Veuillez entrer le code OTP fourni par le passager."
      );
      return;
    }
    voraSocket.startRideWithOTP((rideId as string) || ride?.id, otpInput);
  };

  const handleDeclareArrival = () => {
    const targetRideId = (rideId as string) || ride?.id;
    voraSocket.declareArrival(targetRideId);
  };

  return (
    <View style={styles.container}>
      {/* Carte GPS + Bouton Retour */}
      <View style={styles.mapContainer}>
        <TouchableOpacity
          onPress={() => router.replace("/(driver)/dashboard" as any)}
          style={styles.floatingBackBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.floatingBackBtnText}>← Dashboard</Text>
        </TouchableOpacity>
        <Map />
      </View>

      {/* Panneau de contrôle */}
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View
            style={[
              styles.statusBadge,
              status === "ARRIVEE_SIGNALEE" && { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
              status === "EN_LITIGE" && { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                status === "ARRIVEE_SIGNALEE" && { color: "#D97706" },
                status === "EN_LITIGE" && { color: "#DC2626" },
              ]}
            >
              {status === "ACCEPTED"
                ? "En route vers le passager"
                : status === "IN_TRANSIT"
                ? "Course en cours"
                : status === "ARRIVEE_SIGNALEE"
                ? "Arrivée signalée — Attente client"
                : status === "EN_LITIGE"
                ? "Course en litige"
                : "Course terminée"}
            </Text>
          </View>
          <Text style={styles.fareText}>
            {ride?.fare_fcfa || 1500} FCFA
          </Text>
        </View>

        {/* Détails trajet */}
        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>Destination finale</Text>
          <Text style={styles.addressValue}>
            {ride?.destination_address || "Quartier Bastos, Yaoundé"}
          </Text>
        </View>

        {/* Validation OTP */}
        {status === "ACCEPTED" && (
          <View style={styles.otpGroup}>
            <Text style={styles.otpLabel}>
              Saisir le Code OTP de Prise en Charge
            </Text>
            <View style={styles.otpInputRow}>
              <TextInput
                style={styles.otpInput}
                placeholder="123456"
                keyboardType="numeric"
                maxLength={6}
                value={otpInput}
                onChangeText={setOtpInput}
              />
              <TouchableOpacity
                onPress={handleVerifyOTP}
                style={styles.otpBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.otpBtnText}>Valider OTP</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bouton Déclarer L'Arrivée */}
        {status === "IN_TRANSIT" && (
          <TouchableOpacity
            onPress={handleDeclareArrival}
            style={styles.endBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.endBtnText}>
              Déclarer l'arrivée à destination →
            </Text>
          </TouchableOpacity>
        )}

        {/* Attente de confirmation passager */}
        {status === "ARRIVEE_SIGNALEE" && (
          <View style={styles.waitingBox}>
            <Text style={styles.waitingTitle}>
              Arrivée signalée au passager
            </Text>
            <Text style={styles.waitingSub}>
              Le passager a reçu une notification sur son écran pour valider la fin de la course. Le paiement sera encaissé automatiquement dès sa confirmation ou après expiration du délai.
            </Text>
          </View>
        )}

        {/* Écran Litige */}
        {status === "EN_LITIGE" && (
          <View style={styles.disputeBox}>
            <Text style={styles.disputeTitle}>Litige en cours d'examen</Text>
            <Text style={styles.disputeSub}>
              Le passager a formulé une réclamation. L'équipe d'administration VORA traite le dossier sous peu.
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
  floatingBackBtn: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 99,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  floatingBackBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  panel: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#E0F2FE",
    padding: 24,
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
    marginBottom: 16,
  },
  statusBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  statusBadgeText: {
    color: "#0284C7",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  fareText: {
    color: "#0EA5E9",
    fontSize: 20,
    fontWeight: "800",
  },
  addressBox: {
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  addressValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  otpGroup: {
    gap: 8,
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  otpInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  otpInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    color: "#0F172A",
  },
  otpBtn: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 20,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  otpBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  endBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  endBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  waitingBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 16,
  },
  waitingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#D97706",
    marginBottom: 4,
  },
  waitingSub: {
    fontSize: 12,
    color: "#B45309",
    lineHeight: 18,
  },
  disputeBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    borderRadius: 16,
    padding: 16,
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
    lineHeight: 18,
  },
});
