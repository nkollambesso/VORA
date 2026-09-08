import { getBackendUrl } from "@/lib/config";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { useClerkUser } from "@/lib/useClerkSafe";

export default function DriverEarnings() {
  const { user } = useClerkUser();
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [earningsData, setEarningsData] = useState<any>({
    day: { amount: 0, ridesCount: 0, hoursOnline: 0, avgPerRide: 0 },
    week: { amount: 0, ridesCount: 0, hoursOnline: 0, avgPerRide: 0 },
    month: { amount: 0, ridesCount: 0, hoursOnline: 0, avgPerRide: 0 },
  });

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const backendUrl =
          getBackendUrl();
        const userId = user?.id || "driver_demo";
        const res = await fetch(`${backendUrl}/api/drivers/earnings/${userId}`);
        const data = await res.json();
        if (data.success && data.earnings) {
          setEarningsData(data.earnings);
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des revenus:", err);
      }
    };
    fetchEarnings();
  }, [user]);

  const current = earningsData[period] || {
    amount: 0,
    ridesCount: 0,
    hoursOnline: 0,
    avgPerRide: 0,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scroll,
        isWide && { width: "100%", maxWidth: 1080, alignSelf: "center" },
      ]}
    >
      {/* Header Glass Sky Blue */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.backBtnText}>
            ← Retour au Tableau de Bord
          </Text>
        </TouchableOpacity>

        <Text style={styles.headerTag}>COMPTE CHAUFFEUR VORA</Text>
        <Text style={styles.headerTitle}>Historique des Revenus</Text>
      </View>

      <View style={styles.body}>
        {/* Selector Période */}
        <View style={styles.periodSelector}>
          <TouchableOpacity
            onPress={() => setPeriod("day")}
            style={[
              styles.periodBtn,
              period === "day" && styles.periodBtnActive,
            ]}
          >
            <Text
              style={[
                styles.periodBtnText,
                period === "day" && styles.periodBtnTextActive,
              ]}
            >
              Aujourd'hui
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPeriod("week")}
            style={[
              styles.periodBtn,
              period === "week" && styles.periodBtnActive,
            ]}
          >
            <Text
              style={[
                styles.periodBtnText,
                period === "week" && styles.periodBtnTextActive,
              ]}
            >
              Cette Semaine
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPeriod("month")}
            style={[
              styles.periodBtn,
              period === "month" && styles.periodBtnActive,
            ]}
          >
            <Text
              style={[
                styles.periodBtnText,
                period === "month" && styles.periodBtnTextActive,
              ]}
            >
              Ce Mois
            </Text>
          </TouchableOpacity>
        </View>

        {/* Big Glass Card Total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalCardLabel}>TOTAL NET ENCAISSÉ</Text>
          <Text style={styles.totalCardValue}>
            {current.amount.toLocaleString()} FCFA
          </Text>
          <Text style={styles.totalCardSub}>
            Versement disponible via MTN / Orange Money / Espèces
          </Text>
        </View>

        {/* Détails Grille */}
        <View style={styles.grid}>
          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>COURSES RÉALISÉES</Text>
            <Text style={styles.gridValue}>{current.ridesCount}</Text>
          </View>

          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>HEURES EN LIGNE</Text>
            <Text style={styles.gridValue}>{current.hoursOnline}h</Text>
          </View>

          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>MOYENNE / COURSE</Text>
            <Text style={styles.gridValue}>{current.avgPerRide} FCFA</Text>
          </View>

          <View style={styles.gridCard}>
            <Text style={styles.gridLabel}>NOTE MOYENNE</Text>
            <Text style={styles.gridValueAmber}>4.95 / 5</Text>
          </View>
        </View>
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
  backBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  headerTag: {
    color: "#E0F2FE",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  periodSelector: {
    flexDirection: "row",
    backgroundColor: "#F0F9FF",
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    marginBottom: 20,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: "#0EA5E9",
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  periodBtnTextActive: {
    color: "#FFFFFF",
  },
  totalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(14, 165, 233, 0.3)",
    padding: 24,
    marginBottom: 20,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  totalCardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  totalCardValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0EA5E9",
    marginTop: 4,
  },
  totalCardSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
    marginTop: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  gridCard: {
    width: "48%",
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
  gridLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  gridValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 6,
  },
  gridValueAmber: {
    fontSize: 20,
    fontWeight: "800",
    color: "#F59E0B",
    marginTop: 6,
  },
});
