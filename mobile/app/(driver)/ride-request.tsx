import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { voraSocket } from "@/lib/socket";

export default function DriverRideRequest() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { rideData } = useLocalSearchParams();

  const [ride, setRide] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(30);

  // Parse payload parameter safely
  useEffect(() => {
    if (rideData) {
      try {
        if (typeof rideData === "object") {
          setRide(rideData);
        } else if (typeof rideData === "string") {
          setRide(JSON.parse(rideData));
        }
      } catch (err) {
        console.error("Erreur parsing rideData:", err);
      }
    } else {
      // Fallback demo simulation data to prevent blank screen
      setRide({
        id: `VORA-DEMO-${Date.now()}`,
        rider_name: "Passager Test",
        origin_address: "Carrefour Mokolo, Yaoundé",
        destination_address: "Quartier Bastos, Yaoundé",
        fare_fcfa: 1750,
        vehicle_type: "taxi",
        multiplier: 1.2,
      });
    }
  }, [rideData]);

  // 30s countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      router.back();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAccept = () => {
    if (!ride) return;
    voraSocket.acceptRide(ride.id, 1);
    router.replace({
      pathname: "/(driver)/navigation" as any,
      params: { rideId: ride.id, rideData: JSON.stringify(ride) },
    });
  };

  const handleDecline = () => {
    router.back();
  };

  // Safe fallback component if loading
  if (!ride) {
    return (
      <View style={styles.backdrop}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingText}>Chargement de la demande...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.backdrop}>
      <View style={[styles.modalCard, isWide && styles.modalCardWide]}>
        {/* Header timer */}
        <View style={styles.headerRow}>
          <View style={styles.badgeNew}>
            <Text style={styles.badgeNewText}>Demande de Course VORA</Text>
          </View>
          <View style={styles.timerCircle}>
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>
        </View>

        {/* Fare FCFA */}
        <View style={styles.fareBox}>
          <Text style={styles.fareLabel}>TARIF PROPOSÉ</Text>
          <Text style={styles.fareAmount}>
            {(ride.fare_fcfa || 1500).toLocaleString()} FCFA
          </Text>
          {ride.multiplier > 1.0 && (
            <Text style={styles.multiplierText}>
              Tarif Heure de Pointe (x{ride.multiplier})
            </Text>
          )}
        </View>

        {/* Addresses */}
        <View style={styles.addressSection}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>PRISE EN CHARGE</Text>
            <Text style={styles.addressText}>
              {ride.origin_address || "Carrefour Mokolo, Yaoundé"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>DESTINATION</Text>
            <Text style={styles.addressText}>
              {ride.destination_address || "Quartier Bastos, Yaoundé"}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={handleDecline}
            style={styles.declineBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.declineBtnText}>Refuser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAccept}
            style={styles.acceptBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptBtnText}>Accepter la Course</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.2)",
    elevation: 10,
  },
  modalCardWide: {
    maxWidth: 520,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  badgeNew: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  badgeNewText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.3,
  },
  timerCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  timerText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#DC2626",
  },
  fareBox: {
    backgroundColor: "#F0F9FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  fareLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369A1",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fareAmount: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0284C7",
  },
  multiplierText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B45309",
    marginTop: 4,
  },
  addressSection: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  addressBlock: {},
  addressLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
  acceptBtn: {
    flex: 1.5,
    backgroundColor: "#0EA5E9",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    boxShadow: "0px 4px 12px rgba(14, 165, 233, 0.35)",
    elevation: 4,
  },
  acceptBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
  },
});
