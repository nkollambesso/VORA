import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useClerkUser } from "@/lib/useClerkSafe";

import RideLayout from "@/components/RideLayout";
import VehicleTypeSelector from "@/components/VehicleTypeSelector";
import { LocationPhotoPicker } from "@/components/LocationPhotoPicker";
import CamerPaySelector from "@/components/CamerPaySelector";
import { icons } from "@/constants";
import { useLocationStore } from "@/store";
import { calculateVoraRidesFare, PricingDetail, validateMotoCapacity } from "@/lib/vora-pricing";
import { validateIntraCity } from "@/lib/geofence";
import { voraSocket } from "@/lib/socket";
import { getBackendUrl } from "@/lib/config";

// Adapter: retourne le PricingDetail pour un type donné
const calculateVoraFare = (
  distanceKm: number,
  durationMin: number,
  vehicleType: "moto" | "taxi" | "confort",
  luggageCount: number = 0,
  passengerCount: number = 1
): PricingDetail => {
  const all = calculateVoraRidesFare(distanceKm, durationMin, luggageCount, passengerCount);
  return all[vehicleType];
};

// Strict phone validation: Cameroon numbers (6xx xxx xxx or 2xx xxx xxx)
const validateCameroonPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\s/g, "");
  return /^[62]\d{8}$/.test(cleaned);
};

const BookRide = () => {
  const { user } = useClerkUser();
  const {
    userAddress,
    userLatitude,
    userLongitude,
    destinationAddress,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();

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
  const [formError, setFormError] = useState<string | null>(null);

  // ====== RÉSERVATION POUR AUTRUI ======
  const [bookedForOther, setBookedForOther] = useState(false);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");

  // Recalculer le tarif si les options changent
  useEffect(() => {
    const updated = calculateVoraFare(4.5, 12, selectedVehicleType, luggageCount, passengerCount);
    setSelectedPricing(updated);
  }, [selectedVehicleType, luggageCount, passengerCount]);

  const validateInputs = (): boolean => {
    // 1. Vérification destination renseignée
    if (!destinationAddress || (!destinationLatitude && !destinationLongitude)) {
      const msg = "Veuillez saisir une destination avant de confirmer la course.";
      setFormError(msg);
      Alert.alert("Destination Requise", msg);
      return false;
    }

    // 2. Géofence intra-urbain
    const geoCheck = validateIntraCity(
      userLatitude || 3.8667,
      userLongitude || 11.5167,
      destinationLatitude || 3.875,
      destinationLongitude || 11.52,
      userAddress || "",
      destinationAddress || ""
    );
    if (!geoCheck.isValid) {
      const msg = geoCheck.error || "Le trajet dépasse le périmètre urbain desservi.";
      setFormError(msg);
      Alert.alert("Zone Non Desservie", msg);
      return false;
    }

    // 3. Capacité moto
    if (selectedVehicleType === "moto") {
      const motoError = validateMotoCapacity(passengerCount, luggageCount);
      if (motoError) {
        setFormError(motoError);
        Alert.alert("Capacité Moto Dépassée", motoError);
        return false;
      }
    }

    // 4. Paiement Mobile Money : numéro requis
    if (paymentMethod !== "CASH" && paymentMethod !== "WALLET" && (!phoneNumber || !validateCameroonPhone(phoneNumber))) {
      const msg = "Veuillez entrer un numéro de téléphone Mobile Money camerounais valide (ex: 677 123 456).";
      setFormError(msg);
      Alert.alert("Numéro Invalide", msg);
      return false;
    }

    // 5. Validation champs "Pour Autrui"
    if (bookedForOther) {
      if (!passengerName.trim() || passengerName.trim().length < 2) {
        const msg = "Veuillez entrer le nom complet de la personne à transporter (minimum 2 caractères).";
        setFormError(msg);
        Alert.alert("Nom Requis", msg);
        return false;
      }
      if (!passengerPhone || !validateCameroonPhone(passengerPhone)) {
        const msg = "Veuillez entrer un numéro de téléphone camerounais valide pour le passager (ex: 677 123 456).";
        setFormError(msg);
        Alert.alert("Téléphone Invalide", msg);
        return false;
      }
    }

    setFormError(null);
    return true;
  };

  const handleBookRide = async () => {
    if (!validateInputs()) return;

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
          // Réservation pour autrui
          booked_for_other: bookedForOther,
          passenger_name: bookedForOther ? passengerName.trim() : null,
          passenger_phone: bookedForOther ? passengerPhone.trim() : null,
        }),
      });

      const data = await res.json();
      if (data.success && data.ride) {
        // Déclencher la recherche séquentielle de chauffeurs par Socket.io
        voraSocket.requestRide(data.ride.id);

        Alert.alert(
          "Course Demandée !",
          bookedForOther
            ? `Votre demande pour ${passengerName} (${selectedPricing.label} — ${selectedPricing.finalFare.toLocaleString()} FCFA) a été transmise aux chauffeurs à proximité.`
            : `Votre demande de course ${selectedPricing.label} (${selectedPricing.finalFare.toLocaleString()} FCFA) a été transmise aux chauffeurs à proximité.`
        );

        router.replace({
          pathname: "/(root)/find-ride" as any,
          params: { rideId: data.ride.id, rideData: JSON.stringify(data.ride) },
        });
      } else {
        const msg = data.error || "Impossible de réserver la course.";
        setFormError(msg);
        Alert.alert("Erreur", msg);
      }
    } catch (err) {
      console.error("Erreur réservation course:", err);
      const msg = "Impossible de joindre le serveur VORA. Veuillez réessayer.";
      setFormError(msg);
      Alert.alert("Erreur réseau", msg);
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <RideLayout title="Réservation de Course">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
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
                <Text style={styles.locationText}>{destinationAddress || "Saisir une destination..."}</Text>
              </View>
            </View>
          </View>

          {/* Composant de Photo Géolocalisée pour le Lieu de Prise en Charge */}
          <LocationPhotoPicker
            currentLat={userLatitude || 3.8667}
            currentLng={userLongitude || 11.5167}
            placeName={userAddress || "Carrefour Mokolo, Yaoundé"}
          />

          {/* ====== RÉSERVATION POUR AUTRUI ====== */}
          <View style={styles.bookForOtherCard}>
            <View style={styles.bookForOtherHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.bookForOtherTitle}>Réserver pour une autre personne</Text>
                <Text style={styles.bookForOtherSub}>
                  Vous gardez le suivi de la course et du trajet en temps réel.
                </Text>
              </View>
              <Switch
                value={bookedForOther}
                onValueChange={setBookedForOther}
                trackColor={{ false: "#E2E8F0", true: "#BAE6FD" }}
                thumbColor={bookedForOther ? "#0EA5E9" : "#94A3B8"}
              />
            </View>

            {bookedForOther && (
              <View style={styles.otherFieldsContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NOM COMPLET DU PASSAGER *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex: Jean-Pierre Mbarga"
                    placeholderTextColor="#94A3B8"
                    value={passengerName}
                    onChangeText={setPassengerName}
                    maxLength={60}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>TÉLÉPHONE DU PASSAGER *</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.phonePrefix}>
                      <Text style={styles.phonePrefixText}>+237</Text>
                    </View>
                    <TextInput
                      style={[styles.textInput, { flex: 1, marginTop: 0 }]}
                      placeholder="677 123 456"
                      placeholderTextColor="#94A3B8"
                      value={passengerPhone}
                      onChangeText={(v) => setPassengerPhone(v.replace(/\D/g, "").slice(0, 9))}
                      keyboardType="numeric"
                      maxLength={9}
                    />
                  </View>
                  <Text style={styles.inputHint}>Format: 6xx xxx xxx ou 2xx xxx xxx</Text>
                </View>
              </View>
            )}
          </View>

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

          {/* Error Banner */}
          {!!formError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          )}

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
      </KeyboardAvoidingView>
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
  // Book for other
  bookForOtherCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  bookForOtherHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bookForOtherTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  bookForOtherSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  otherFieldsContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 14,
    gap: 12,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginTop: 4,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  phonePrefix: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  phonePrefixText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  inputHint: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#B91C1C",
    fontWeight: "600",
    fontFamily: "Jakarta-SemiBold",
  },
});
