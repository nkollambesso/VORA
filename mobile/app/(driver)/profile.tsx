import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useClerkUser } from "@/lib/useClerkSafe";
import { getBackendUrl } from "@/lib/config";

export default function DriverProfileScreen() {
  const { user } = useClerkUser();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  const [faceAnalysisResult, setFaceAnalysisResult] = useState<{ isPerson: boolean; message: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [vehicleType, setVehicleType] = useState<"taxi" | "confort" | "moto">("taxi");
  const [vehicleModel, setVehicleModel] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [color, setColor] = useState("");
  const [vehicleImage, setVehicleImage] = useState("");
  const [vehicleDocuments, setVehicleDocuments] = useState("");
  const [kycStatus, setKycStatus] = useState("unverified");

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/drivers/profile/${user?.id || "driver_demo"}`);
      const data = await res.json();
      if (data.success && data.driver) {
        const d = data.driver;
        setName(d.name || user?.fullName || "");
        setPhone(d.phone || user?.primaryPhoneNumber?.phoneNumber || "");
        setAvatarUrl(d.avatar_url || user?.imageUrl || "");
        setVehicleType(d.vehicle_type || "taxi");
        setVehicleModel(d.vehicle_model || "");
        setLicensePlate(d.license_plate || "");
        setColor(d.color || "");
        setVehicleImage(d.vehicle_image || "");
        setVehicleDocuments(d.vehicle_documents || "");
        setKycStatus(d.verification_status || "unverified");
      }
    } catch (err) {
      console.error("Erreur chargement profil chauffeur:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sélection & Analyse faciale IA de la photo de profil
  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setIsAnalyzingFace(true);
        setFaceAnalysisResult(null);

        // Appel IA vérification visage
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/drivers/verify-face`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Uri }),
        });
        const data = await res.json();
        setIsAnalyzingFace(false);

        if (data.isPerson) {
          setAvatarUrl(base64Uri);
          setFaceAnalysisResult({ isPerson: true, message: "Visage humain validé par l'IA VORA." });
        } else {
          setFaceAnalysisResult({ isPerson: false, message: data.message || "Aucun visage humain net détecté." });
          Alert.alert("Photo refusée", data.message || "Veuillez fournir un selfie clair de face.");
        }
      }
    } catch (e) {
      setIsAnalyzingFace(false);
      Alert.alert("Erreur", "Impossible de sélectionner l'image.");
    }
  };

  // Sélection de la photo du véhicule
  const handlePickCarImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setVehicleImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      Alert.alert("Erreur", "Impossible de sélectionner l'image.");
    }
  };

  // Sélection des documents du véhicule
  const handlePickDocuments = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setVehicleDocuments(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (e) {
      Alert.alert("Erreur", "Impossible de sélectionner le document.");
    }
  };

  const handleSave = async () => {
    setFeedback(null);
    if (!vehicleModel.trim() || !licensePlate.trim() || !color.trim()) {
      setFeedback({ type: "error", message: "Le modèle, l'immatriculation et la couleur sont obligatoires." });
      return;
    }

    setIsSaving(true);
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/drivers/profile/${user?.id || "driver_demo"}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          avatar_url: avatarUrl,
          vehicle_type: vehicleType,
          vehicle_model: vehicleModel,
          license_plate: licensePlate,
          color,
          vehicle_image: vehicleImage,
          vehicle_documents: vehicleDocuments,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Profil et véhicule mis à jour avec succès !" });
        setTimeout(() => {
          router.replace("/(driver)/dashboard" as any);
        }, 1200);
      } else {
        setFeedback({ type: "error", message: data.error || "Erreur lors de la mise à jour." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "Erreur réseau lors de l'enregistrement." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Chargement du profil chauffeur...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        isWide && { width: "100%", maxWidth: 840, alignSelf: "center" },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Profil Chauffeur</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Banner Feedback */}
      {feedback && (
        <View
          style={[
            styles.feedbackBanner,
            feedback.type === "success" ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          <Ionicons
            name={feedback.type === "success" ? "checkmark-circle" : "alert-circle"}
            size={20}
            color={feedback.type === "success" ? "#059669" : "#DC2626"}
            style={{ marginRight: 8 }}
          />
          <Text
            style={[
              styles.feedbackText,
              feedback.type === "success" ? styles.feedbackTextSuccess : styles.feedbackTextError,
            ]}
          >
            {feedback.message}
          </Text>
        </View>
      )}

      {/* Card 1 : Photo de Profil avec IA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Photo de Profil Chauffeur</Text>
        <Text style={styles.cardSub}>
          Votre selfie certifié permet aux passagers de vous identifier en toute confiance.
        </Text>

        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#94A3B8" />
              </View>
            )}
            {isAnalyzingFace && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.analyzingText}>Analyse IA...</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={handlePickAvatar}
            style={styles.changeAvatarBtn}
            activeOpacity={0.8}
            disabled={isAnalyzingFace}
          >
            <Ionicons name="camera" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.changeAvatarBtnText}>Changer Photo (Selfie IA)</Text>
          </TouchableOpacity>
        </View>

        {faceAnalysisResult && (
          <View
            style={[
              styles.aiResultBanner,
              faceAnalysisResult.isPerson ? styles.aiResultSuccess : styles.aiResultError,
            ]}
          >
            <Ionicons
              name={faceAnalysisResult.isPerson ? "shield-checkmark" : "warning"}
              size={18}
              color={faceAnalysisResult.isPerson ? "#059669" : "#DC2626"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.aiResultText,
                faceAnalysisResult.isPerson ? styles.aiResultTextSuccess : styles.aiResultTextError,
              ]}
            >
              {faceAnalysisResult.message}
            </Text>
          </View>
        )}
      </View>

      {/* Card 2 : Coordonnées Personnelles */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informations Personnelles</Text>

        <Text style={styles.fieldLabel}>Nom Complet</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: Jean Paul Nguemo"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.fieldLabel}>Numéro de Téléphone (Mobile Money)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+237 6XX XX XX XX"
          placeholderTextColor="#94A3B8"
          keyboardType="phone-pad"
        />

        <View style={styles.kycStatusRow}>
          <Text style={styles.kycLabel}>Statut d'identité Didit :</Text>
          <View
            style={[
              styles.kycBadge,
              kycStatus === "verified" ? styles.kycBadgeVerified : styles.kycBadgeUnverified,
            ]}
          >
            <Text
              style={[
                styles.kycBadgeText,
                kycStatus === "verified" ? styles.kycTextVerified : styles.kycTextUnverified,
              ]}
            >
              {kycStatus === "verified" ? "VÉRIFIÉ ✓" : "EN ATTENTE"}
            </Text>
          </View>
        </View>
      </View>

      {/* Card 3 : Informations du Véhicule */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Détails du Véhicule VORA</Text>

        {/* Type de véhicule */}
        <Text style={styles.fieldLabel}>Type de Véhicule</Text>
        <View style={styles.typeSelectorRow}>
          {[
            { id: "taxi", label: "Taxi Jaune", icon: "car" },
            { id: "confort", label: "Confort VTC", icon: "sparkles" },
            { id: "moto", label: "Moto Taxi", icon: "bicycle" },
          ].map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => setVehicleType(t.id as any)}
              style={[
                styles.typeOption,
                vehicleType === t.id && styles.typeOptionActive,
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={t.icon as any}
                size={18}
                color={vehicleType === t.id ? "#0284C7" : "#64748B"}
              />
              <Text
                style={[
                  styles.typeOptionText,
                  vehicleType === t.id && styles.typeOptionTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Modèle du Véhicule</Text>
        <TextInput
          style={styles.input}
          value={vehicleModel}
          onChangeText={setVehicleModel}
          placeholder="Ex: Toyota Corolla, Yaris, Bajaj Boxer..."
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.fieldLabel}>Numéro d'Immatriculation (Plaque)</Text>
        <TextInput
          style={styles.input}
          value={licensePlate}
          onChangeText={setLicensePlate}
          placeholder="Ex: LT 123 AB"
          placeholderTextColor="#94A3B8"
          autoCapitalize="characters"
        />

        <Text style={styles.fieldLabel}>Couleur du Véhicule</Text>
        <TextInput
          style={styles.input}
          value={color}
          onChangeText={setColor}
          placeholder="Ex: Jaune Taxi, Gris Métallisé, Bleu..."
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Card 4 : Photo du Véhicule & Documents */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Photo du Véhicule & Documents Officiels</Text>
        <Text style={styles.cardSub}>
          Obligatoires pour être identifiable par le passager et certifié conforme.
        </Text>

        {/* Photo Véhicule */}
        <Text style={styles.fieldLabel}>Photo Extérieure du Véhicule</Text>
        <View style={styles.uploadBox}>
          {vehicleImage ? (
            <Image source={{ uri: vehicleImage }} style={styles.previewCarImg} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="car-outline" size={40} color="#94A3B8" />
              <Text style={styles.uploadPlaceholderText}>Aucune photo enregistrée</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={handlePickCarImage}
            style={styles.uploadBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="image-outline" size={16} color="#0EA5E9" style={{ marginRight: 6 }} />
            <Text style={styles.uploadBtnText}>
              {vehicleImage ? "Remplacer la photo du véhicule" : "Ajouter une photo du véhicule"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Documents Véhicule */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Carte Grise / Documents du Véhicule</Text>
        <View style={styles.uploadBox}>
          {vehicleDocuments ? (
            <Image source={{ uri: vehicleDocuments }} style={styles.previewDocImg} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="document-text-outline" size={40} color="#94A3B8" />
              <Text style={styles.uploadPlaceholderText}>Aucun document enregistré</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={handlePickDocuments}
            style={styles.uploadBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="attach-outline" size={16} color="#0EA5E9" style={{ marginRight: 6 }} />
            <Text style={styles.uploadBtnText}>
              {vehicleDocuments ? "Mettre à jour le document" : "Téléverser le document"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bouton de Sauvegarde */}
      <TouchableOpacity
        onPress={handleSave}
        style={styles.saveBtn}
        activeOpacity={0.85}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="save-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.saveBtnText}>Enregistrer les Modifications</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  feedbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  feedbackError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  feedbackTextSuccess: {
    color: "#065F46",
  },
  feedbackTextError: {
    color: "#991B1B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 18,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#0EA5E9",
    position: "relative",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  analyzingText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "700",
    marginTop: 4,
  },
  changeAvatarBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  changeAvatarBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  aiResultBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
  },
  aiResultSuccess: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  aiResultError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  aiResultText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  aiResultTextSuccess: {
    color: "#065F46",
  },
  aiResultTextError: {
    color: "#991B1B",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  kycStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  kycLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  kycBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kycBadgeVerified: {
    backgroundColor: "#DCFCE7",
  },
  kycBadgeUnverified: {
    backgroundColor: "#FEF3C7",
  },
  kycBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  kycTextVerified: {
    color: "#166534",
  },
  kycTextUnverified: {
    color: "#B45309",
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  typeOptionActive: {
    backgroundColor: "#E0F2FE",
    borderColor: "#0284C7",
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  typeOptionTextActive: {
    color: "#0284C7",
  },
  uploadBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  previewCarImg: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
    resizeMode: "cover",
  },
  previewDocImg: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
    resizeMode: "contain",
  },
  uploadPlaceholder: {
    paddingVertical: 24,
    alignItems: "center",
  },
  uploadPlaceholderText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
    marginTop: 6,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  uploadBtnText: {
    fontSize: 12,
    color: "#0284C7",
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
