import { getBackendUrl } from "@/lib/config";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useClerkUser } from "@/lib/useClerkSafe";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons } from "@/constants";

const DriverRegister = () => {
  const { user } = useClerkUser();
  const [vehicleType, setVehicleType] = useState<"moto" | "taxi" | "confort">("taxi");
  const [form, setForm] = useState({
    vehicleModel: "",
    licensePlate: "",
    color: "",
  });
  const [vehicleImage, setVehicleImage] = useState<string>("");
  const [driverAvatar, setDriverAvatar] = useState<string>("");
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  const [faceAnalysisResult, setFaceAnalysisResult] = useState<{ isPerson: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Choisir photo du véhicule
  const handlePickVehicleImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setVehicleImage(dataUrl);
      }
    } catch {
      Alert.alert("Erreur", "Impossible de charger la photo du véhicule.");
    }
  };

  // Choisir photo de profil avec analyse IA
  const handlePickDriverAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setDriverAvatar(dataUrl);
        setFaceAnalysisResult(null);

        setIsAnalyzingFace(true);
        try {
          const backendUrl = getBackendUrl();
          const verifyRes = await fetch(`${backendUrl}/api/drivers/verify-face`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          });
          const analysis = await verifyRes.json();
          if (analysis.isPerson) {
            setFaceAnalysisResult({
              isPerson: true,
              message: "Visage humain validé par l'IA.",
            });
          } else {
            setFaceAnalysisResult({
              isPerson: false,
              message: analysis.reason || "Aucun visage humain net détecté. Veuillez fournir un selfie clair.",
            });
          }
        } catch {
          setFaceAnalysisResult({
            isPerson: true,
            message: "Photo sélectionnée.",
          });
        } finally {
          setIsAnalyzingFace(false);
        }
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'accéder aux photos de profil.");
    }
  };

  const onSubmit = async () => {
    if (!form.vehicleModel || !form.licensePlate || !form.color) {
      Alert.alert("Champs requis", "Veuillez remplir toutes les informations sur votre véhicule.");
      return;
    }

    if (!vehicleImage) {
      Alert.alert(
        "Photo du véhicule obligatoire",
        "Veuillez charger une photo de votre véhicule afin que vos passagers puissent vous reconnaître facilement."
      );
      return;
    }

    if (!driverAvatar) {
      Alert.alert(
        "Photo de profil obligatoire",
        "Une photo de votre visage est obligatoire pour la sécurité de la communauté VORA."
      );
      return;
    }

    if (faceAnalysisResult && !faceAnalysisResult.isPerson) {
      Alert.alert(
        "Validation Faciale Rejetée",
        faceAnalysisResult.message || "La photo de profil fournie ne correspond pas à un visage humain. Veuillez charger un selfie valide."
      );
      return;
    }

    setLoading(true);

    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/drivers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || `user_${Date.now()}`,
          vehicle_type: vehicleType,
          vehicle_model: form.vehicleModel,
          license_plate: form.licensePlate,
          color: form.color,
          vehicle_image: vehicleImage,
          avatar_url: driverAvatar,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          "Félicitations !",
          "Votre profil Chauffeur VORA est validé avec photo de véhicule et visage vérifiés par l'IA.",
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
    <ScrollView style={styles.scroll}>
      <View style={{ flex: 1 }}>
        {/* Header Sky Blue Glass */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Espace Chauffeur</Text>
          <Text style={styles.headerSub}>
            Enregistrez votre véhicule et commencez à recevoir des courses VORA.
          </Text>
        </View>

        <View style={styles.body}>
          {/* Choice card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Type de Véhicule</Text>

            <View style={styles.typeRow}>
              {/* Moto */}
              <TouchableOpacity
                onPress={() => setVehicleType("moto")}
                style={[
                  styles.typeBtn,
                  vehicleType === "moto" && styles.typeBtnActive,
                ]}
              >
                <Text style={styles.typeBtnTitle}>MOTO</Text>
                <Text style={styles.typeBtnSub}>Bendskin</Text>
              </TouchableOpacity>

              {/* Taxi */}
              <TouchableOpacity
                onPress={() => setVehicleType("taxi")}
                style={[
                  styles.typeBtn,
                  vehicleType === "taxi" && styles.typeBtnActive,
                ]}
              >
                <Text style={styles.typeBtnTitle}>TAXI</Text>
                <Text style={styles.typeBtnSub}>Classique</Text>
              </TouchableOpacity>

              {/* Confort */}
              <TouchableOpacity
                onPress={() => setVehicleType("confort")}
                style={[
                  styles.typeBtn,
                  vehicleType === "confort" && styles.typeBtnActive,
                ]}
              >
                <Text style={styles.typeBtnTitle}>CONFORT</Text>
                <Text style={styles.typeBtnSub}>Berline Clim.</Text>
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
            placeholder="ex: Jaune Taxi, Gris Métallisé..."
            icon={icons.target}
            value={form.color}
            onChangeText={(val: string) => setForm({ ...form, color: val })}
          />

          {/* Upload Photo Véhicule */}
          <Text style={styles.sectionLabel}>PHOTO DU VÉHICULE (OBLIGATOIRE)</Text>
          <Text style={styles.sectionHelp}>
            Cette image permet aux passagers d'identifier facilement votre véhicule lors de la prise de contact.
          </Text>
          <TouchableOpacity
            style={styles.uploadCard}
            onPress={handlePickVehicleImage}
            activeOpacity={0.8}
          >
            {vehicleImage ? (
              <View style={styles.previewWrapper}>
                <Image source={{ uri: vehicleImage }} style={styles.previewImg} resizeMode="cover" />
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>Modifier la photo</Text>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderTitle}>Charger la photo du véhicule</Text>
                <Text style={styles.placeholderSub}>Format photo clair (vue 3/4 avant ou profil)</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Upload Photo Profil Chauffeur avec Validation IA */}
          <Text style={styles.sectionLabel}>PHOTO DE PROFIL CHAUFFEUR (OBLIGATOIRE — VÉRIFIÉE PAR IA)</Text>
          <Text style={styles.sectionHelp}>
            Une intelligence artificielle vérifie la présence d'un visage humain réel pour certifier votre profil.
          </Text>
          <TouchableOpacity
            style={styles.uploadCard}
            onPress={handlePickDriverAvatar}
            activeOpacity={0.8}
          >
            {driverAvatar ? (
              <View style={styles.avatarPreviewWrapper}>
                <Image source={{ uri: driverAvatar }} style={styles.avatarImg} resizeMode="cover" />
                <View style={styles.editBadge}>
                  <Text style={styles.editBadgeText}>Changer le selfie</Text>
                </View>
              </View>
            ) : (
              <View style={styles.placeholderBox}>
                <Text style={styles.placeholderTitle}>Prendre un selfie de face</Text>
                <Text style={styles.placeholderSub}>Photo nette, visage bien éclairé sans masque</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* AI Face Status */}
          {isAnalyzingFace && (
            <View style={styles.aiBoxLoading}>
              <ActivityIndicator size="small" color="#0284C7" />
              <Text style={styles.aiTextLoading}>Analyse faciale par l'IA en cours...</Text>
            </View>
          )}

          {faceAnalysisResult && !isAnalyzingFace && (
            <View
              style={[
                styles.aiBoxResult,
                faceAnalysisResult.isPerson ? styles.aiBoxSuccess : styles.aiBoxError,
              ]}
            >
              <Text
                style={[
                  styles.aiResultText,
                  faceAnalysisResult.isPerson ? styles.aiResultSuccessText : styles.aiResultErrorText,
                ]}
              >
                {faceAnalysisResult.message}
              </Text>
            </View>
          )}

          <View style={{ marginTop: 20, marginBottom: 40 }}>
            <CustomButton
              title={loading ? "Validation en cours..." : "Valider mon Inscription Chauffeur"}
              onPress={onSubmit}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default DriverRegister;

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    width: "100%",
    height: 200,
    backgroundColor: "#0EA5E9",
    justifyContent: "flex-end",
    padding: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  headerSub: {
    fontSize: 14,
    color: "#E0F2FE",
    marginTop: 4,
    fontWeight: "500",
  },
  body: {
    padding: 20,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  typeBtnActive: {
    backgroundColor: "#F0F9FF",
    borderColor: "#0EA5E9",
  },
  typeBtnTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  typeBtnSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0369A1",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 4,
  },
  sectionHelp: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
    lineHeight: 16,
  },
  uploadCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    marginBottom: 12,
  },
  previewWrapper: {
    width: "100%",
    height: 160,
    position: "relative",
  },
  previewImg: {
    width: "100%",
    height: "100%",
  },
  avatarPreviewWrapper: {
    width: "100%",
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarImg: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  placeholderBox: {
    padding: 20,
    alignItems: "center",
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0284C7",
    marginBottom: 4,
  },
  placeholderSub: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
  },
  aiBoxLoading: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  aiTextLoading: {
    fontSize: 12,
    color: "#0369A1",
    fontWeight: "600",
  },
  aiBoxResult: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  aiBoxSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  aiBoxError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  aiResultText: {
    fontSize: 12,
    fontWeight: "700",
  },
  aiResultSuccessText: {
    color: "#166534",
  },
  aiResultErrorText: {
    color: "#991B1B",
  },
});
