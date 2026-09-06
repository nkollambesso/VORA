import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useClerkUser } from "@/lib/useClerkSafe";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons } from "@/constants";

const DriverRegister = () => {
  const { user } = useClerkUser();
  const [vehicleType, setVehicleType] = useState("taxi" as "moto" | "taxi" | "confort");
  const [form, setForm] = useState({
    vehicleModel: "",
    licensePlate: "",
    color: "",
  });
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!form.vehicleModel || !form.licensePlate || !form.color) {
      Alert.alert("Champs requis", "Veuillez remplir toutes les informations sur votre véhicule.");
      return;
    }

    setLoading(true);

    try {
      const backendUrl = (typeof process !== "undefined" && process.env.EXPO_PUBLIC_BACKEND_URL) || "http://localhost:5000";
      const response = await fetch(`${backendUrl}/api/drivers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || `user_${Date.now()}`,
          vehicle_type: vehicleType,
          vehicle_model: form.vehicleModel,
          license_plate: form.licensePlate,
          color: form.color,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          "Félicitations !",
          "Votre profil Chauffeur VORA est validé. Vous pouvez maintenant passer EN LIGNE !",
          [{ text: "Accéder au Tableau de Bord", onPress: () => router.replace("/(driver)/dashboard" as any) }]
        );
      } else {
        Alert.alert("Erreur", data.error || "Échec de l'inscription chauffeur.");
      }
    } catch (err: any) {
      console.error("Erreur enregistrement chauffeur:", err);
      Alert.alert("Erreur", "Impossible de contacter le serveur VORA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="flex-1">
        {/* Header Sky Blue Glass */}
        <View className="relative w-full h-[220px] bg-primary-500 justify-end p-6">
          <Text className="text-3xl text-white font-JakartaExtraBold">
            Espace Chauffeur
          </Text>
          <Text className="text-sky-100 text-base font-JakartaMedium mt-1">
            Enregistrez votre véhicule et commencez à recevoir des courses VORA.
          </Text>
        </View>

        <View className="p-5">
          {/* Glass Card Choice */}
          <View
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderWidth: 1,
              borderColor: "rgba(224, 242, 254, 0.8)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
              elevation: 4,
            }}
          >
            <Text className="text-lg font-JakartaBold text-slate-800 mb-3">
              Type de Véhicule
            </Text>

            <View className="flex-row justify-between">
              {/* Moto */}
              <TouchableOpacity
                onPress={() => setVehicleType("moto")}
                className={`flex-1 mr-2 p-3 rounded-xl border items-center ${
                  vehicleType === "moto"
                    ? "bg-sky-50 border-primary-500"
                    : "bg-white border-slate-200"
                }`}
              >
                <Text className="font-JakartaBold text-base text-slate-800 mb-1">MOTO</Text>
                <Text className="font-JakartaBold text-xs text-slate-600">Bendskin</Text>
              </TouchableOpacity>

              {/* Taxi */}
              <TouchableOpacity
                onPress={() => setVehicleType("taxi")}
                className={`flex-1 mx-1 p-3 rounded-xl border items-center ${
                  vehicleType === "taxi"
                    ? "bg-sky-50 border-primary-500"
                    : "bg-white border-slate-200"
                }`}
              >
                <Text className="font-JakartaBold text-base text-slate-800 mb-1">TAXI</Text>
                <Text className="font-JakartaBold text-xs text-slate-600">Classique</Text>
              </TouchableOpacity>

              {/* Confort */}
              <TouchableOpacity
                onPress={() => setVehicleType("confort")}
                className={`flex-1 ml-2 p-3 rounded-xl border items-center ${
                  vehicleType === "confort"
                    ? "bg-sky-50 border-primary-500"
                    : "bg-white border-slate-200"
                }`}
              >
                <Text className="font-JakartaBold text-base text-slate-800 mb-1">CONFORT</Text>
                <Text className="font-JakartaBold text-xs text-slate-600">Berline Clim.</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form details */}
          <InputField
            label="Marque et Modèle du Véhicule"
            placeholder="ex: Toyota Yaris, Carina, TVS 125"
            icon={icons.person}
            value={form.vehicleModel}
            onChangeText={(val: string) => setForm({ ...form, vehicleModel: val })}
          />

          <InputField
            label="Numéro d'Immatriculation / Plaque"
            placeholder="ex: LT 482-CE ou YDE 109-AA"
            icon={icons.lock}
            value={form.licensePlate}
            onChangeText={(val: string) => setForm({ ...form, licensePlate: val })}
          />

          <InputField
            label="Couleur du Véhicule"
            placeholder="ex: Jaune, Blanc, Gris Météore"
            icon={icons.target}
            value={form.color}
            onChangeText={(val: string) => setForm({ ...form, color: val })}
          />

          <CustomButton
            title={loading ? "Validation en cours..." : "Valider mon Inscription Chauffeur"}
            onPress={onSubmit}
            className="mt-6 bg-primary-500 shadow-md shadow-sky-300"
          />
        </View>
      </View>
    </ScrollView>
  );
};

export default DriverRegister;
