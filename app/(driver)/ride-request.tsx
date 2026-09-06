import React, { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { voraSocket } from "@/lib/socket";

export default function DriverRideRequest() {
  const { rideData } = useLocalSearchParams();
  const [ride, setRide] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(30);

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

  // Compte à rebours 30 secondes pour accepter
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
    voraSocket.acceptRide(ride.id, 1); // 1 = driverId par défaut ou dynamique
    router.replace({
      pathname: "/(driver)/navigation" as any,
      params: { rideId: ride.id, rideData: JSON.stringify(ride) },
    });
  };

  const handleDecline = () => {
    router.back();
  };

  if (!ride) return null;

  return (
    <View className="flex-1 bg-slate-900/80 justify-end p-5">
      <View
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.96)",
          borderRadius: 24,
          borderWidth: 1.5,
          borderColor: "rgba(14, 165, 233, 0.5)",
          padding: 24,
          shadowColor: "#0EA5E9",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        {/* Header timer */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="bg-sky-100 px-3 py-1 rounded-full border border-sky-300">
            <Text className="text-primary-700 font-JakartaExtraBold text-xs">
              Nouvelle Demande de Course
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center border border-red-200">
            <Text className="text-red-600 font-JakartaExtraBold text-sm">{timeLeft}s</Text>
          </View>
        </View>

        {/* Tarif FCFA */}
        <View className="mb-5 bg-sky-50 p-4 rounded-2xl border border-sky-100">
          <Text className="text-xs text-slate-400 font-JakartaBold uppercase">Montant de la Course</Text>
          <Text className="text-3xl font-JakartaExtraBold text-primary-600 mt-0.5">
            {ride.fare_fcfa} FCFA
          </Text>
          {ride.multiplier > 1.0 && (
            <Text className="text-xs text-amber-700 font-JakartaBold mt-1">
              Tarif Majoré (x{ride.multiplier})
            </Text>
          )}
        </View>

        {/* Adresses Départ & Arrivée */}
        <View className="space-y-3 mb-6">
          <View>
            <Text className="text-[11px] font-JakartaBold text-slate-400 uppercase">Lieu de Prise en Charge</Text>
            <Text className="text-base font-JakartaBold text-slate-800 mt-0.5">
              {ride.origin_address}
            </Text>
          </View>

          <View className="border-t border-slate-100 pt-2">
            <Text className="text-[11px] font-JakartaBold text-slate-400 uppercase">Destination</Text>
            <Text className="text-base font-JakartaBold text-slate-800 mt-0.5">
              {ride.destination_address}
            </Text>
          </View>
        </View>

        {/* Boutons d'action */}
        <View className="flex-row justify-between space-x-3">
          <TouchableOpacity
            onPress={handleDecline}
            className="flex-1 bg-slate-100 border border-slate-300 py-4 rounded-xl items-center"
          >
            <Text className="text-slate-700 font-JakartaBold text-base">Refuser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleAccept}
            className="flex-1 bg-primary-500 py-4 rounded-xl items-center shadow-md shadow-sky-300"
          >
            <Text className="text-white font-JakartaExtraBold text-base">Accepter la Course</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
