import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

export default function DriverEarnings() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");

  const earningsData = {
    day: { amount: 18500, ridesCount: 8, hoursOnline: 6.5, avgPerRide: 2312 },
    week: { amount: 112000, ridesCount: 46, hoursOnline: 38, avgPerRide: 2434 },
    month: { amount: 480000, ridesCount: 194, hoursOnline: 152, avgPerRide: 2474 },
  };

  const current = earningsData[period];

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Header Glass Sky Blue */}
      <View className="bg-primary-600 p-6 pt-12 pb-8 rounded-b-3xl shadow-lg">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-sky-100 font-JakartaBold text-xs uppercase">
            ← Retour au Tableau de Bord
          </Text>
        </TouchableOpacity>
        <Text className="text-white text-xs font-JakartaBold uppercase tracking-wider opacity-80">
          Compte Chauffeur VORA
        </Text>
        <Text className="text-white text-3xl font-JakartaExtraBold mt-1">
          Historique des Revenus
        </Text>
      </View>

      <View className="p-5">
        {/* Selector Période */}
        <View className="flex-row mb-6 bg-sky-50 p-1.5 rounded-xl border border-sky-100">
          <TouchableOpacity
            onPress={() => setPeriod("day")}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              period === "day" ? "bg-primary-500 shadow-sm" : "bg-transparent"
            }`}
          >
            <Text className={`font-JakartaBold ${period === "day" ? "text-white" : "text-slate-600"}`}>
              Aujourd'hui
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPeriod("week")}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              period === "week" ? "bg-primary-500 shadow-sm" : "bg-transparent"
            }`}
          >
            <Text className={`font-JakartaBold ${period === "week" ? "text-white" : "text-slate-600"}`}>
              Cette Semaine
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPeriod("month")}
            className={`flex-1 py-2.5 rounded-lg items-center ${
              period === "month" ? "bg-primary-500 shadow-sm" : "bg-transparent"
            }`}
          >
            <Text className={`font-JakartaBold ${period === "month" ? "text-white" : "text-slate-600"}`}>
              Ce Mois
            </Text>
          </TouchableOpacity>
        </View>

        {/* Big Glass Card Total */}
        <View
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: "rgba(14, 165, 233, 0.4)",
            padding: 24,
            marginBottom: 20,
            elevation: 6,
            shadowColor: "#0EA5E9",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
          }}
        >
          <Text className="text-xs text-slate-400 font-JakartaBold uppercase">
            Total Net Encaissé
          </Text>
          <Text className="text-4xl font-JakartaExtraBold text-primary-600 mt-1">
            {current.amount.toLocaleString()} FCFA
          </Text>
          <Text className="text-xs text-emerald-600 font-JakartaBold mt-2">
            Versement disponible via MTN / Orange Money / Espèces
          </Text>
        </View>

        {/* Détails Grille */}
        <View className="flex-row flex-wrap justify-between">
          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Courses Réalisées</Text>
            <Text className="text-2xl font-JakartaExtraBold text-slate-800 mt-1">
              {current.ridesCount}
            </Text>
          </View>

          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Heures en Ligne</Text>
            <Text className="text-2xl font-JakartaExtraBold text-slate-800 mt-1">
              {current.hoursOnline}h
            </Text>
          </View>

          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Moyenne par Course</Text>
            <Text className="text-xl font-JakartaExtraBold text-slate-800 mt-1">
              {current.avgPerRide} FCFA
            </Text>
          </View>

          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 mb-4 shadow-sm">
            <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Note Moyenne</Text>
            <Text className="text-xl font-JakartaExtraBold text-amber-500 mt-1">
              4.95 / 5
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
