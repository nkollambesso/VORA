import React, { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { processCamerPayPayment } from "@/lib/camerpay";

interface CamerPaySelectorProps {
  amountFcfa: number;
  rideId: string;
  onPaymentSuccess: (transactionId: string, method: string) => void;
}

export const CamerPaySelector: React.FC<CamerPaySelectorProps> = ({
  amountFcfa,
  rideId,
  onPaymentSuccess,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "mtn" | "orange">("cash");
  const [phoneNumber, setPhoneNumber] = useState("670000000");
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (selectedMethod !== "cash" && (!phoneNumber || phoneNumber.length < 9)) {
      Alert.alert("Numéro invalide", "Veuillez entrer un numéro Mobile Money valide à 9 chiffres.");
      return;
    }

    setLoading(true);

    try {
      const res = await processCamerPayPayment({
        amount: amountFcfa,
        phone: phoneNumber,
        operator: selectedMethod,
        rideId,
        description: `Course VORA #${rideId}`,
      });

      if (res.success) {
        Alert.alert(
          "Paiement Confirmé",
          res.message || `Paiement de ${amountFcfa} FCFA effectué avec succès.`,
          [{ text: "Continuer", onPress: () => onPaymentSuccess(res.transactionId || "OK", selectedMethod) }]
        );
      } else {
        Alert.alert("Échec du paiement", res.error || "Une erreur est survenue lors du paiement.");
      }
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.92)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(224, 242, 254, 0.8)",
        padding: 20,
        shadowColor: "#0EA5E9",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <Text className="text-xl font-JakartaExtraBold text-slate-800 mb-1">
        Mode de Règlement
      </Text>
      <Text className="text-sm font-JakartaMedium text-slate-500 mb-4">
        Montant total à régler :{" "}
        <Text className="text-primary-600 font-JakartaExtraBold">{amountFcfa} FCFA</Text>
      </Text>

      {/* Options de paiement Glass Cards */}
      <View className="space-y-3">
        {/* Espèces */}
        <TouchableOpacity
          onPress={() => setSelectedMethod("cash")}
          className={`p-4 rounded-xl border flex-row items-center justify-between ${
            selectedMethod === "cash"
              ? "bg-sky-50 border-primary-500"
              : "bg-white border-slate-200"
          }`}
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-emerald-100 items-center justify-center mr-3">
              <Text className="text-emerald-700 font-JakartaBold text-xs">CASH</Text>
            </View>
            <View>
              <Text className="font-JakartaBold text-base text-slate-800">Espèces</Text>
              <Text className="text-xs text-slate-400">Règlement direct auprès du chauffeur</Text>
            </View>
          </View>
          <View
            className={`w-5 h-5 rounded-full border items-center justify-center ${
              selectedMethod === "cash" ? "border-primary-500 bg-primary-500" : "border-slate-300"
            }`}
          >
            {selectedMethod === "cash" && <View className="w-2 h-2 rounded-full bg-white" />}
          </View>
        </TouchableOpacity>

        {/* MTN Mobile Money */}
        <TouchableOpacity
          onPress={() => setSelectedMethod("mtn")}
          className={`p-4 rounded-xl border flex-row items-center justify-between ${
            selectedMethod === "mtn"
              ? "bg-sky-50 border-primary-500"
              : "bg-white border-slate-200"
          }`}
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center mr-3">
              <Text className="text-amber-800 font-JakartaBold text-xs">MTN</Text>
            </View>
            <View>
              <Text className="font-JakartaBold text-base text-slate-800">MTN Mobile Money</Text>
              <Text className="text-xs text-slate-400">Paiement Mobile via CamerPay</Text>
            </View>
          </View>
          <View
            className={`w-5 h-5 rounded-full border items-center justify-center ${
              selectedMethod === "mtn" ? "border-primary-500 bg-primary-500" : "border-slate-300"
            }`}
          >
            {selectedMethod === "mtn" && <View className="w-2 h-2 rounded-full bg-white" />}
          </View>
        </TouchableOpacity>

        {/* Orange Money */}
        <TouchableOpacity
          onPress={() => setSelectedMethod("orange")}
          className={`p-4 rounded-xl border flex-row items-center justify-between ${
            selectedMethod === "orange"
              ? "bg-sky-50 border-primary-500"
              : "bg-white border-slate-200"
          }`}
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mr-3">
              <Text className="text-orange-700 font-JakartaBold text-xs">OM</Text>
            </View>
            <View>
              <Text className="font-JakartaBold text-base text-slate-800">Orange Money</Text>
              <Text className="text-xs text-slate-400">Paiement Mobile via CamerPay</Text>
            </View>
          </View>
          <View
            className={`w-5 h-5 rounded-full border items-center justify-center ${
              selectedMethod === "orange" ? "border-primary-500 bg-primary-500" : "border-slate-300"
            }`}
          >
            {selectedMethod === "orange" && <View className="w-2 h-2 rounded-full bg-white" />}
          </View>
        </TouchableOpacity>
      </View>

      {/* Saisie Numéro MoMo si MTN/Orange */}
      {selectedMethod !== "cash" && (
        <View className="mt-4">
          <Text className="text-xs font-JakartaBold text-slate-700 mb-1">
            Numéro de Téléphone {selectedMethod === "mtn" ? "MTN" : "Orange"}
          </Text>
          <TextInput
            className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 font-JakartaMedium"
            placeholder="670000000"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>
      )}

      <TouchableOpacity
        onPress={handlePayment}
        disabled={loading}
        className="mt-6 bg-primary-500 py-4 rounded-xl items-center shadow-md shadow-sky-200"
      >
        <Text className="text-white font-JakartaExtraBold text-base">
          {loading
            ? "Traitement en cours..."
            : selectedMethod === "cash"
            ? "Confirmer la Réservation (Espèces)"
            : `Payer ${amountFcfa} FCFA avec CamerPay`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default CamerPaySelector;
