import React from "react";
import { Text, View } from "react-native";
import { getVoraPricingMultiplier } from "@/lib/vora-pricing";

export const PeakPricingBadge: React.FC = () => {
  const peak = getVoraPricingMultiplier();

  return (
    <View
      style={{
        backgroundColor: peak.isPeak ? "rgba(14, 165, 233, 0.12)" : "rgba(241, 245, 249, 0.8)",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: peak.isPeak ? "rgba(14, 165, 233, 0.4)" : "rgba(226, 232, 240, 0.8)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignSelf: "flex-start",
      }}
    >
      <Text
        className={`text-xs font-JakartaExtraBold ${
          peak.isPeak ? "text-primary-700" : "text-slate-600"
        }`}
      >
        {peak.label}
      </Text>
    </View>
  );
};

export default PeakPricingBadge;
