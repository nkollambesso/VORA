import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { calculateVoraRidesFare, PricingDetail, getMotoNightMultiplier } from "@/lib/vora-pricing";

interface VehicleTypeSelectorProps {
  distanceKm: number;
  durationMin: number;
  selectedType: "moto" | "taxi" | "confort";
  passengerCount: number;
  luggageCount: number;
  onPassengerChange: (count: number) => void;
  onLuggageChange: (count: number) => void;
  onSelect: (detail: PricingDetail) => void;
}

export const VehicleTypeSelector: React.FC<VehicleTypeSelectorProps> = ({
  distanceKm,
  durationMin,
  selectedType,
  passengerCount,
  luggageCount,
  onPassengerChange,
  onLuggageChange,
  onSelect,
}) => {
  const fares = calculateVoraRidesFare(
    distanceKm || 5,
    durationMin || 15,
    luggageCount,
    passengerCount
  );

  const motoNight = getMotoNightMultiplier();
  const isMotoNight = motoNight.multiplier > 1.0;

  // Moto capacity rules:
  // - With luggage: max 1 passenger
  // - Without luggage: max 2 passengers
  const getMotoDisabledReason = (): string | null => {
    if (luggageCount >= 1 && passengerCount > 1) {
      return "Max 1 passager avec bagages";
    }
    if (passengerCount > 2) {
      return "Max 2 passagers sans bagages";
    }
    return null;
  };

  const options: Array<{ type: "moto" | "taxi" | "confort"; detail: PricingDetail }> = [
    { type: "moto", detail: fares.moto },
    { type: "taxi", detail: fares.taxi },
    { type: "confort", detail: fares.confort },
  ];

  return (
    <View style={{ marginVertical: 12 }}>
      {/* Sélecteurs Passagers & Bagages */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          padding: 14,
          borderWidth: 1,
          borderColor: "#E2E8F0",
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 0.6, marginBottom: 10 }}>
          DÉTAILS DU TRANSPORT
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>Nombre de passagers</Text>
            <Text style={{ fontSize: 11, color: "#64748B" }}>
              {passengerCount === 1 ? "1 personne" : `${passengerCount} personnes`}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[1, 2, 3, 4].map((num) => {
              const isDisabledByMoto = selectedType === "moto" && num > 2;
              return (
                <TouchableOpacity
                  key={num}
                  onPress={() => !isDisabledByMoto && onPassengerChange(num)}
                  disabled={isDisabledByMoto}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    backgroundColor: passengerCount === num ? "#0EA5E9" : isDisabledByMoto ? "#F8FAFC" : "#F1F5F9",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isDisabledByMoto ? 0.35 : 1,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "800", color: passengerCount === num ? "#FFFFFF" : "#475569" }}>
                    {num}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>Avez-vous des bagages ?</Text>
            <Text style={{ fontSize: 11, color: "#64748B" }}>
              {luggageCount === 0 ? "Aucun bagage (+0 FCFA)" : `${luggageCount} bagage(s) (+${luggageCount * 300} FCFA)`}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity
              onPress={() => onLuggageChange(Math.max(0, luggageCount - 1))}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "#F1F5F9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#475569" }}>-</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#0F172A", width: 16, textAlign: "center" }}>
              {luggageCount}
            </Text>
            <TouchableOpacity
              onPress={() => onLuggageChange(Math.min(5, luggageCount + 1))}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: "#0EA5E9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF" }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tarif Nuit Moto Warning */}
      {isMotoNight && (
        <View style={{
          backgroundColor: "#FFF7ED",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#FED7AA",
          padding: 10,
          marginBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}>
          <View style={{
            backgroundColor: "#EA580C",
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}>
            <Text style={{ fontSize: 10, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.5 }}>NUIT</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#C2410C" }}>Tarif Nuit Moto Actif (après 18h)</Text>
            <Text style={{ fontSize: 11, color: "#92400E", lineHeight: 16 }}>
              Les tarifs MOTO doublent automatiquement après 18h00 conformément à la réglementation VORA.
            </Text>
          </View>
        </View>
      )}

      <Text style={{ fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 0.6, marginBottom: 8 }}>
        CHOIX DU VÉHICULE VORA
      </Text>

      {options.map(({ type, detail }) => {
        const isSelected = selectedType === type;
        const motoDisabledReason = type === "moto" ? getMotoDisabledReason() : null;
        const isDisabled = !!motoDisabledReason;

        return (
          <TouchableOpacity
            key={type}
            onPress={() => !isDisabled && onSelect(detail)}
            disabled={isDisabled}
            style={{
              backgroundColor: isSelected ? "rgba(240, 249, 255, 0.95)" : "rgba(255, 255, 255, 0.9)",
              borderRadius: 16,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? "#0EA5E9" : "rgba(226, 232, 240, 0.8)",
              padding: 16,
              marginBottom: 10,
              opacity: isDisabled ? 0.4 : 1,
              shadowColor: "#0EA5E9",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isSelected ? 0.15 : 0.05,
              shadowRadius: 8,
              elevation: isSelected ? 4 : 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#0F172A" }}>
                    {type === "moto" ? "VORA MOTO" : type === "taxi" ? "VORA TAXI" : "VORA CONFORT"}
                  </Text>
                  <View style={{ marginLeft: 8, backgroundColor: "#F1F5F9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#475569" }}>
                      {type === "moto" ? (luggageCount >= 1 ? "Max 1 place" : "Max 2 places") : `Max ${detail.capacity} places`}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 12, color: isDisabled ? "#EF4444" : "#64748B", marginTop: 2 }}>
                  {motoDisabledReason
                    ? `[Non autorisé] ${motoDisabledReason}`
                    : type === "moto"
                    ? "Bendskin rapide & agile"
                    : type === "taxi"
                    ? "Taxi jaune classique"
                    : "Berline climatisée haute qualité"}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#0284C7" }}>
                  {detail.finalFare} FCFA
                </Text>
                {detail.multiplier > 1.0 && (
                  <Text style={{ fontSize: 10, color: "#B45309", fontWeight: "700" }}>
                    {detail.multiplierReason}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default VehicleTypeSelector;
