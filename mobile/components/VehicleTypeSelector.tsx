import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { calculateVoraRidesFare, PricingDetail } from "@/lib/vora-pricing";

interface VehicleTypeSelectorProps {
  distanceKm: number;
  durationMin: number;
  selectedType: "moto" | "taxi" | "confort";
  onSelect: (detail: PricingDetail) => void;
}

export const VehicleTypeSelector: React.FC<VehicleTypeSelectorProps> = ({
  distanceKm,
  durationMin,
  selectedType,
  onSelect,
}) => {
  const fares = calculateVoraRidesFare(distanceKm || 5, durationMin || 15);

  const options: Array<{ type: "moto" | "taxi" | "confort"; detail: PricingDetail }> = [
    { type: "moto", detail: fares.moto },
    { type: "taxi", detail: fares.taxi },
    { type: "confort", detail: fares.confort },
  ];

  return (
    <View className="space-y-3 my-3">
      <Text className="text-sm font-JakartaExtraBold text-slate-800 uppercase tracking-wider mb-1">
        Choix du Véhicule VORA
      </Text>

      {options.map(({ type, detail }) => {
        const isSelected = selectedType === type;

        return (
          <TouchableOpacity
            key={type}
            onPress={() => onSelect(detail)}
            style={{
              backgroundColor: isSelected ? "rgba(240, 249, 255, 0.95)" : "rgba(255, 255, 255, 0.9)",
              borderRadius: 16,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? "#0EA5E9" : "rgba(226, 232, 240, 0.8)",
              padding: 16,
              shadowColor: "#0EA5E9",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isSelected ? 0.15 : 0.05,
              shadowRadius: 8,
              elevation: isSelected ? 4 : 1,
            }}
            className="flex-row items-center justify-between"
          >
            <View className="flex-1 pr-3">
              <View className="flex-row items-center">
                <Text className="font-JakartaExtraBold text-base text-slate-800">
                  {type === "moto" ? "VORA MOTO" : type === "taxi" ? "VORA TAXI" : "VORA CONFORT"}
                </Text>
                <View className="ml-2 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  <Text className="text-[10px] font-JakartaBold text-slate-600">
                    {detail.capacity} place{detail.capacity > 1 ? "s" : ""}
                  </Text>
                </View>
              </View>

              <Text className="text-xs text-slate-500 font-JakartaMedium mt-0.5">
                {type === "moto"
                  ? "Bendskin rapide & agile"
                  : type === "taxi"
                  ? "Taxi jaune classique"
                  : "Berline climatisée haute qualité"}
              </Text>
            </View>

            <View className="items-end">
              <Text className="font-JakartaExtraBold text-lg text-primary-600">
                {detail.finalFare} FCFA
              </Text>
              {detail.multiplier > 1.0 && (
                <Text className="text-[10px] text-amber-700 font-JakartaBold">
                  {detail.multiplierReason}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default VehicleTypeSelector;
