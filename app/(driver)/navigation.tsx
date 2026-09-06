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
  const [status, setStatus] = useState<"ACCEPTED" | "IN_TRANSIT" | "COMPLETED">("ACCEPTED");
  const [otpInput, setOtpInput] = useState("");

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

  // Écouter les retours Socket.io OTP et status
  useEffect(() => {
    const socket = voraSocket.getSocket();

    socket?.on("ride-started-confirmed", () => {
      setStatus("IN_TRANSIT");
      Alert.alert("Code OTP Validé", "Le passager a été pris en charge. La course commence !");
    });

    socket?.on("otp-error", (data: any) => {
      Alert.alert("Code Erroné", data.message || "Le code OTP saisi est incorrect.");
    });

    socket?.on("ride-ended-confirmed", () => {
      setStatus("COMPLETED");
      Alert.alert("Course Terminée", "La course est clôturée et le paiement est enregistré.", [
        { text: "Retour au Tableau de Bord", onPress: () => router.replace("/(driver)/dashboard" as any) },
      ]);
    });

    return () => {
      socket?.off("ride-started-confirmed");
      socket?.off("otp-error");
      socket?.off("ride-ended-confirmed");
    };
  }, []);

  const handleVerifyOTP = () => {
    if (otpInput.length < 4) {
      Alert.alert("Code incomplet", "Veuillez entrer le code OTP fourni par le passager.");
      return;
    }
    voraSocket.startRideWithOTP((rideId as string) || ride?.id, otpInput);
  };

  const handleEndRide = () => {
    voraSocket.endRide((rideId as string) || ride?.id);
  };

  return (
    <View style={styles.container}>
      {/* Carte GPS */}
      <View style={styles.mapContainer}>
        <Map />
      </View>

      {/* Panneau de contrôle */}
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {status === "ACCEPTED"
                ? "En route vers le passager"
                : status === "IN_TRANSIT"
                ? "Course en cours"
                : "Course terminée"}
            </Text>
          </View>
          <Text style={styles.fareText}>
            {ride?.fare_fcfa || 1500} FCFA
          </Text>
        </View>

        {/* Détails trajet */}
        <View style={styles.addressBox}>
          <Text style={styles.addressLabel}>Adresse actuelle</Text>
          <Text style={styles.addressValue}>
            {status === "ACCEPTED"
              ? ride?.origin_address || "Point de prise en charge"
              : ride?.destination_address || "Destination finale"}
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

        {/* Bouton Terminer */}
        {status === "IN_TRANSIT" && (
          <TouchableOpacity
            onPress={handleEndRide}
            style={styles.endBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.endBtnText}>
              Terminer la Course & Encaisser
            </Text>
          </TouchableOpacity>
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
});
