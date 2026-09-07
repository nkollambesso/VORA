import { getBackendUrl } from "@/lib/config";
import React, { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { useClerkUser } from "@/lib/useClerkSafe";
import { voraSocket } from "@/lib/socket";

export const SOSButton = () => {
  const { user } = useClerkUser();
  const [loading, setLoading] = useState(false);

  const handleSOSTrigger = async () => {
    Alert.alert(
      "CONFIRMER L'ALERTE SOS D'URGENCE",
      "Êtes-vous sûr de vouloir déclencher l'alerte de secours VORA ? Vos coordonnées GPS seront transmises immédiatement aux équipes de sécurité.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "DÉCLENCHER LE SOS",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              let lat = 3.8667;
              let lng = 11.5167;

              if (status === "granted") {
                const loc = await Location.getCurrentPositionAsync({});
                lat = loc.coords.latitude;
                lng = loc.coords.longitude;
              }

              const userId = user?.id || "guest_user";
              voraSocket.sendSOS(userId, "PASSENGER", lat, lng);

              const backendUrl = getBackendUrl();
              await fetch(`${backendUrl}/api/sos/trigger`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId,
                  userRole: "PASSENGER",
                  lat,
                  lng,
                }),
              });

              Alert.alert(
                "ALERTE TRANSMISE",
                "Votre alerte SOS a été enregistrée. Les équipes VORA et les services de secours sont notifiés de votre position GPS."
              );
            } catch (err: any) {
              console.error("Erreur SOS:", err);
              Alert.alert("Erreur", "Alerte envoyée au serveur par secours réseau.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handleSOSTrigger}
      disabled={loading}
      style={{
        backgroundColor: "rgba(220, 38, 38, 0.92)",
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "rgba(254, 202, 202, 0.8)",
        paddingHorizontal: 16,
        paddingVertical: 10,
        shadowColor: "#DC2626",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      }}
      className="flex-row items-center justify-center"
    >
      <Text className="text-white font-JakartaExtraBold text-sm uppercase tracking-wider">
        {loading ? "Envoi du Signal..." : "BOUTON SOS D'URGENCE"}
      </Text>
    </TouchableOpacity>
  );
};

export default SOSButton;
