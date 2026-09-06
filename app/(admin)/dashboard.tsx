import React, { useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isSimulation, setIsSimulation] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchStats = async () => {
    try {
      const backendUrl = (typeof process !== "undefined" && process.env.EXPO_PUBLIC_BACKEND_URL) || "http://localhost:5000";
      const res = await fetch(`${backendUrl}/api/admin/dashboard-stats`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setIsSimulation(data.stats.isSimulationMode);
      }
    } catch (err) {
      console.error("Erreur chargement stats admin:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleToggleSimulation = async (value: boolean) => {
    setUpdating(true);
    try {
      const backendUrl = (typeof process !== "undefined" && process.env.EXPO_PUBLIC_BACKEND_URL) || "http://localhost:5000";
      const res = await fetch(`${backendUrl}/api/admin/toggle-simulation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enable: value,
          adminEmail: "superadmin@vora.cm",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSimulation(data.isSimulation);
        Alert.alert(
          "Mode Simulation CamerPay",
          `Le mode simulation de paiement CamerPay est désormais ${
            data.isSimulation ? "ACTIVÉ (les paiements seront simulés sans débit réel)" : "DÉSACTIVÉ (les clés API réelles seront interrogées)"
          }.`
        );
      }
    } catch (err: any) {
      Alert.alert("Erreur", "Impossible de mettre à jour le mode simulation.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStats(); }} />}
    >
      {/* Header Sky Blue Glass */}
      <View className="bg-primary-600 p-6 pt-12 pb-8 rounded-b-3xl shadow-lg">
        <Text className="text-white text-xs font-JakartaBold uppercase tracking-wider opacity-80">
          Panneau de Contrôle Super Admin
        </Text>
        <Text className="text-white text-3xl font-JakartaExtraBold mt-1">
          Administration VORA
        </Text>
        <Text className="text-sky-100 text-sm font-JakartaMedium mt-1">
          Gestion de la plateforme, simulation des paiements et sécurité
        </Text>
      </View>

      <View className="p-5">
        {/* Card Mode Simulation CamerPay */}
        <View
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderWidth: 1.5,
            borderColor: isSimulation ? "rgba(14, 165, 233, 0.4)" : "rgba(239, 68, 68, 0.3)",
            borderRadius: 20,
            padding: 20,
            marginBottom: 24,
            elevation: 6,
            shadowColor: "#0EA5E9",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
          }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-JakartaExtraBold uppercase text-primary-600">
                Paiements CamerPay
              </Text>
              <Text className="text-lg font-JakartaBold text-slate-800 mt-0.5">
                Mode Simulation Super Admin
              </Text>
            </View>
            <Switch
              value={isSimulation}
              onValueChange={handleToggleSimulation}
              disabled={updating}
              trackColor={{ false: "#CBD5E1", true: "#0EA5E9" }}
              thumbColor={isSimulation ? "#FFFFFF" : "#F1F5F9"}
            />
          </View>

          <View
            className={`p-3 rounded-xl ${
              isSimulation ? "bg-sky-50 border border-sky-200" : "bg-amber-50 border border-amber-200"
            }`}
          >
            <Text className={`text-xs font-JakartaBold ${isSimulation ? "text-sky-900" : "text-amber-900"}`}>
              {isSimulation
                ? "Statut : SIMULATION ACTIVÉE — Les transactions MTN & Orange Money réussiront automatiquement pour les démonstrations du hackathon."
                : "Statut : MODE RÉEL — Les transactions feront des requêtes en direct vers l'API CamerPay."}
            </Text>
          </View>
        </View>

        {/* Grille Statistiques VORA */}
        <Text className="text-base font-JakartaBold text-slate-800 mb-3">
          Aperçu de la Plateforme
        </Text>

        <View className="flex-row flex-wrap justify-between">
          {/* Utilisateurs */}
          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Utilisateurs</Text>
            <Text className="text-2xl font-JakartaExtraBold text-slate-800 mt-1">
              {stats?.totalUsers ?? 0}
            </Text>
            <Text className="text-[11px] text-slate-500 mt-1">Comptes inscrits</Text>
          </View>

          {/* Chauffeurs */}
          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Chauffeurs</Text>
            <Text className="text-2xl font-JakartaExtraBold text-slate-800 mt-1">
              {stats?.totalDrivers ?? 0}
            </Text>
            <Text className="text-[11px] text-sky-600 font-JakartaBold mt-1">
              {stats?.onlineDrivers ?? 0} actuellement en ligne
            </Text>
          </View>

          {/* Courses Total */}
          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Courses Effectuées</Text>
            <Text className="text-2xl font-JakartaExtraBold text-slate-800 mt-1">
              {stats?.completedRides ?? 0}
            </Text>
            <Text className="text-[11px] text-slate-500 mt-1">sur {stats?.totalRides ?? 0} demandées</Text>
          </View>

          {/* Revenus total FCFA */}
          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Revenus Cumulés</Text>
            <Text className="text-xl font-JakartaExtraBold text-primary-600 mt-1">
              {stats?.totalRevenueFcfa ?? 0} FCFA
            </Text>
            <Text className="text-[11px] text-slate-500 mt-1">Volume de la plateforme</Text>
          </View>
        </View>

        {/* Navigation Rapide */}
        <TouchableOpacity
          onPress={() => router.push("/(root)/(tabs)/home")}
          className="mt-4 bg-slate-800 py-4 rounded-xl items-center"
        >
          <Text className="text-white font-JakartaBold text-base">
            Retour à l'Application Passager
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
