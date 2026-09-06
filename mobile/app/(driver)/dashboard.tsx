import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { useClerkUser } from "@/lib/useClerkSafe";
import { voraSocket } from "@/lib/socket";

export default function DriverDashboard() {
  const { user } = useClerkUser();
  const [isOnline, setIsOnline] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayRidesCount, setTodayRidesCount] = useState(0);

  // Charger le profil chauffeur
  useEffect(() => {
    const fetchDriver = async () => {
      try {
        const backendUrl =
          process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";
        const res = await fetch(
          `${backendUrl}/api/drivers/profile/${user?.id || "driver_demo"}`
        );
        const data = await res.json();
        if (data.success && data.driver) {
          setDriverProfile(data.driver);
          setIsOnline(!!data.driver.is_online);
          if (data.driver.today_earnings !== undefined) {
            setTodayEarnings(data.driver.today_earnings);
          }
          if (data.driver.today_rides_count !== undefined) {
            setTodayRidesCount(data.driver.today_rides_count);
          }
        }
      } catch (err) {
        console.error("Erreur profil chauffeur:", err);
      }
    };

    fetchDriver();
  }, [user]);

  // Initialiser Socket.io et écouter les demandes de course
  useEffect(() => {
    const userId = user?.id || "driver_demo";
    const socket = voraSocket.connect(userId, "DRIVER");

    socket?.on("new-ride-available", (ride: any) => {
      if (isOnline) {
        router.push({
          pathname: "/(driver)/ride-request" as any,
          params: { rideData: JSON.stringify(ride) },
        });
      }
    });

    return () => {
      socket?.off("new-ride-available");
    };
  }, [user, isOnline]);

  // Loop d'envoi GPS si EN LIGNE
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isOnline) {
      const sendGPS = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({});
            setCurrentLocation(loc.coords);
            if (driverProfile?.id) {
              voraSocket.updateDriverLocation(
                driverProfile.id,
                loc.coords.latitude,
                loc.coords.longitude
              );
            }
          }
        } catch (err) {
          console.error("Erreur GPS chauffeur:", err);
        }
      };

      sendGPS();
      interval = setInterval(sendGPS, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnline, driverProfile]);

  const handleToggleOnline = async (value: boolean) => {
    if (value && driverProfile?.verification_status !== "verified") {
      Alert.alert(
        "Vérification Didit Requise",
        "Vous devez faire vérifier votre identité biométrique avec Didit KYC dans votre profil pour pouvoir passer En Ligne et recevoir des courses.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Vérifier avec Didit",
            onPress: () => router.push("/(root)/(tabs)/profile" as any),
          },
        ]
      );
      return;
    }
    setIsOnline(value);
    try {
      const backendUrl =
        process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";
      await fetch(`${backendUrl}/api/drivers/toggle-online`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverProfile?.id || 1,
          is_online: value,
          lat: currentLocation?.latitude || 3.8667,
          lng: currentLocation?.longitude || 11.5167,
        }),
      });
    } catch (err) {
      console.error("Erreur toggle online:", err);
    }
  };

  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const isKycVerified = driverProfile?.verification_status === "verified";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scroll,
        isWide && { width: "100%", maxWidth: 1080, alignSelf: "center" },
      ]}
    >
      {/* Header Sky Blue Glass */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => router.replace("/(root)/(tabs)/profile")}
            style={styles.backModeBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.backModeBtnText}>← Passager</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(driver)/earnings" as any)}
            style={styles.earningsBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.earningsBtnText}>Revenus</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTag}>ESPACE CHAUFFEUR VORA</Text>
          <Text style={styles.headerName}>
            {user?.fullName || user?.firstName || "Chauffeur VORA"}
          </Text>
          <Text style={styles.headerVehicle}>
            {driverProfile?.vehicle_model
              ? `${driverProfile.vehicle_model} (${driverProfile.license_plate})`
              : "Toyota Yaris (CE 482 AA)"}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* Banner Avertissement Didit KYC si non vérifié */}
        {!isKycVerified && (
          <View style={styles.kycWarnCard}>
            <Text style={styles.kycWarnTitle}>⚠️ Identité non vérifiée (Didit KYC)</Text>
            <Text style={styles.kycWarnText}>
              Votre compte n'a pas encore validé la vérification biométrique Didit. Vous devez compléter votre KYC pour passer en ligne.
            </Text>
            <TouchableOpacity
              style={styles.kycWarnBtn}
              onPress={() => router.push("/(root)/(tabs)/profile" as any)}
            >
              <Text style={styles.kycWarnBtnText}>Faire la Vérification Didit →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Toggle statut Online / Offline */}
        <View
          style={[
            styles.statusCard,
            { borderColor: isOnline ? "#0EA5E9" : "#CBD5E1" },
          ]}
        >
          <View style={styles.statusRow}>
            <View style={styles.statusTextGroup}>
              <Text style={styles.statusLabel}>STATUT DE DISPONIBILITÉ</Text>
              <Text
                style={[
                  styles.statusValue,
                  { color: isOnline ? "#0284C7" : "#64748B" },
                ]}
              >
                {isOnline
                  ? "EN LIGNE — Prêt pour les courses"
                  : "HORS LIGNE — En pause"}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: "#CBD5E1", true: "#0EA5E9" }}
              thumbColor={isOnline ? "#FFFFFF" : "#F1F5F9"}
            />
          </View>

          <View
            style={[
              styles.infoBox,
              { backgroundColor: isOnline ? "#F0F9FF" : "#F8FAFC" },
            ]}
          >
            <Text
              style={[
                styles.infoText,
                { color: isOnline ? "#0369A1" : "#64748B" },
              ]}
            >
              {isOnline
                ? "Position GPS transmise au serveur toutes les 10 secondes. Vous recevrez les demandes de courses en direct."
                : "Activez l'interrupteur pour commencer à recevoir des demandes de courses à proximité."}
            </Text>
          </View>
        </View>

        {/* Résumé de la Journée */}
        <Text style={styles.sectionTitle}>Performances de la Journée</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>GAINS DU JOUR</Text>
            <Text style={styles.metricValuePrimary}>
              {todayEarnings.toLocaleString()} FCFA
            </Text>
            <Text style={styles.metricSub}>Paiements encaissés</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>COURSES EFFECTUÉES</Text>
            <Text style={styles.metricValueDark}>
              {todayRidesCount} courses
            </Text>
            <Text style={styles.metricSubSuccess}>Taux de succès 100%</Text>
          </View>
        </View>

        {/* Simulation Button */}
        <TouchableOpacity
          onPress={() => {
            const mockRide = {
              id: `VORA-REQ-${Date.now()}`,
              rider_name: "Emmanuel Nkoumou",
              origin_address: "Carrefour Mokolo, Yaoundé",
              destination_address: "Quartier Bastos, Yaoundé",
              fare_fcfa: 1750,
              vehicle_type: "taxi",
              multiplier: 1.2,
            };
            router.push({
              pathname: "/(driver)/ride-request" as any,
              params: { rideData: JSON.stringify(mockRide) },
            });
          }}
          style={styles.demoBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.demoBtnText}>
            Simuler une Demande de Course
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backModeBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  backModeBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  headerTextGroup: {
    marginTop: 4,
  },
  headerTag: {
    color: "#E0F2FE",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  headerName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
  },
  headerVehicle: {
    color: "#BAE6FD",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
  },
  earningsBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  earningsBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  infoBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  infoText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  metricValuePrimary: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0EA5E9",
    marginTop: 6,
  },
  metricValueDark: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 6,
  },
  metricSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  metricSubSuccess: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
    marginTop: 4,
  },
  demoBtn: {
    backgroundColor: "#E0F2FE",
    borderWidth: 1.5,
    borderColor: "#0EA5E9",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  demoBtnText: {
    color: "#0284C7",
    fontSize: 14,
    fontWeight: "800",
  },
  kycWarnCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    padding: 16,
    marginBottom: 20,
  },
  kycWarnTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#991B1B",
    marginBottom: 4,
  },
  kycWarnText: {
    fontSize: 13,
    color: "#B91C1C",
    lineHeight: 18,
    marginBottom: 12,
  },
  kycWarnBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  kycWarnBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
