import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useClerkUser } from "@/lib/useClerkSafe";

import RideLayout from "@/components/RideLayout";
import VehicleTypeSelector from "@/components/VehicleTypeSelector";
import LocationPhotoPicker from "@/components/LocationPhotoPicker";
import CamerPaySelector from "@/components/CamerPaySelector";
import { icons } from "@/constants";
import { useLocationStore } from "@/store";
import { calculateVoraFare, PricingDetail } from "@/lib/vora-pricing";
import { voraSocket } from "@/lib/socket";
import { getBackendUrl } from "@/lib/config";

const BookRide = () => {
  const { user } = useClerkUser();
  const { userAddress, userLatitude, userLongitude, destinationAddress, destinationLatitude, destinationLongitude } =
    useLocationStore();

  const [selectedVehicleType, setSelectedVehicleType] = useState<"moto" | "taxi" | "confort">("taxi");
  const [passengerCount, setPassengerCount] = useState(1);
  const [luggageCount, setLuggageCount] = useState(0);

  // Initialisation immédiate du tarif par défaut pour éviter tout blocage
  const [selectedPricing, setSelectedPricing] = useState<PricingDetail>(() =>
    calculateVoraFare(4.5, 12, "taxi", 0, 1)
  );

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MTN_MOMO" | "ORANGE_MONEY" | "WALLET">("CASH");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isBooking, setIsBooking] = useState(false);

  // Recalculer le tarif si les options changent
  useEffect(() => {
    const updated = calculateVoraFare(4.5, 12, selectedVehicleType, luggageCount, passengerCount);
    setSelectedPricing(updated);
  }, [selectedVehicleType, luggageCount, passengerCount]);

  const handleBookRide = async () => {
    if (paymentMethod !== "CASH" && paymentMethod !== "WALLET" && (!phoneNumber || phoneNumber.length < 9)) {
      Alert.alert("Numéro Requis", "Veuillez entrer un numéro de téléphone Mobile Money valide (9 chiffres) pour le règlement.");
      return;
    }

    setIsBooking(true);
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/rides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rider_id: user?.id || "rider_demo",
          origin_address: userAddress || "Carrefour Mokolo, Yaoundé",
          destination_address: destinationAddress || "Quartier Bastos, Yaoundé",
          origin_lat: userLatitude || 3.8667,
          origin_lng: userLongitude || 11.5167,
          dest_lat: destinationLatitude || 3.875,
          dest_lng: destinationLongitude || 11.52,
          vehicle_type: selectedPricing.vehicleType,
          passenger_count: passengerCount,
          luggage_count: luggageCount,
          fare_fcfa: selectedPricing.finalFare,
          multiplier: selectedPricing.multiplier,
          surge_reason: selectedPricing.multiplierReason,
          payment_method: paymentMethod,
        }),
      });

      const data = await res.json();
      if (data.success && data.ride) {
        // Déclencher la recherche séquentielle de chauffeurs par Socket.io
        voraSocket.requestRide(data.ride.id);

        Alert.alert(
          "Course Demandée !",
          `Votre demande de course ${selectedPricing.label} (${selectedPricing.finalFare.toLocaleString()} FCFA) a été transmise aux chauffeurs à proximité.`
        );

        router.replace({
          pathname: "/(root)/find-ride" as any,
          params: { rideId: data.ride.id, rideData: JSON.stringify(data.ride) },
        });
      } else {
        Alert.alert("Erreur", data.error || "Impossible de réserver la course.");
      }
    } catch (err) {
      console.error("Erreur réservation course:", err);
      Alert.alert("Erreur réseau", "Impossible de joindre le serveur VORA. Veuillez réessayer.");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <RideLayout title="Réservation de Course">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Détails de l'itinéraire</Text>

        <View style={styles.locationBox}>
          <View style={styles.locationRow}>
            <Image source={icons.to} style={{ width: 20, height: 20, marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel}>DÉPART</Text>
              <Text style={styles.locationText}>{userAddress || "Prise en charge géolocalisée (Mokolo, Yaoundé)"}</Text>
            </View>
          </View>

          <View style={styles.locationDivider} />

          <View style={styles.locationRow}>
            <Image source={icons.point} style={{ width: 20, height: 20, marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationLabel}>DESTINATION</Text>
              <Text style={styles.locationText}>{destinationAddress || "Quartier Bastos, Yaoundé"}</Text>
            </View>
          </View>
        </View>

        {/* Composant de Photo Géolocalisée pour le Lieu de Prise en Charge */}
        <LocationPhotoPicker
          currentLat={userLatitude || 3.8667}
          currentLng={userLongitude || 11.5167}
          placeName={userAddress || "Carrefour Mokolo, Yaoundé"}
        />

        {/* Sélecteur des 3 Catégories + Passagers & Bagages */}
        <VehicleTypeSelector
          distanceKm={4.5}
          durationMin={12}
          selectedType={selectedVehicleType}
          passengerCount={passengerCount}
          luggageCount={luggageCount}
          onPassengerChange={setPassengerCount}
          onLuggageChange={setLuggageCount}
          onSelect={(detail) => {
            setSelectedVehicleType(detail.vehicleType);
            setSelectedPricing(detail);
          }}
        />

        {/* Sélecteur de Mode de Paiement (Mobile Money / Cash / Wallet) */}
        <CamerPaySelector
          amountFcfa={selectedPricing.finalFare}
          selectedMethod={paymentMethod}
          onSelectMethod={setPaymentMethod}
          phoneNumber={phoneNumber}
          onPhoneChange={setPhoneNumber}
        />

        {/* Bouton de Confirmation Finale */}
        <TouchableOpacity
          style={[styles.confirmBtn, isBooking && { opacity: 0.6 }]}
          onPress={handleBookRide}
          disabled={isBooking}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmBtnText}>
            {isBooking
              ? "Recherche de chauffeur en cours..."
              : `Confirmer la Course (${selectedPricing.finalFare.toLocaleString()} FCFA)`}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </RideLayout>
  );
};

export default BookRide;

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  locationBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2,
  },
  locationDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  confirmBtn: {
    backgroundColor: "#0EA5E9",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
