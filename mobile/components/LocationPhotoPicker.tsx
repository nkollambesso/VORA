import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useClerkUser } from "@/lib/useClerkSafe";
import { getBackendUrl } from "@/lib/config";

interface LocationPhotoPickerProps {
  currentLat: number;
  currentLng: number;
  placeName?: string;
}

export const LocationPhotoPicker: React.FC<LocationPhotoPickerProps> = ({
  currentLat,
  currentLng,
  placeName = "",
}) => {
  const { user } = useClerkUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Initialise with placeName; stays in sync when the parent resolves the real address
  const [inputPlaceName, setInputPlaceName] = useState(placeName);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [nearbyPhotos, setNearbyPhotos] = useState<any[]>([]);
  const [matchedPhoto, setMatchedPhoto] = useState<any | null>(null);

  // Keep the field synced when the parent resolves the actual user address (async geo)
  useEffect(() => {
    if (placeName && placeName.trim().length > 0) {
      setInputPlaceName(placeName);
    }
  }, [placeName]);

  const fetchNearbyPhotos = async () => {
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(
        `${backendUrl}/api/location-photos/nearby?lat=${currentLat}&lng=${currentLng}`
      );
      const data = await res.json();
      if (data.success && data.photos) {
        setNearbyPhotos(data.photos);
      }
    } catch (err) {
      console.error("Erreur chargement photos lieux:", err);
    }
  };

  const fetchMatchedPhoto = async () => {
    try {
      const backendUrl = getBackendUrl();
      const params = new URLSearchParams({ lat: String(currentLat), lng: String(currentLng) });
      if (placeName.trim()) params.append("place_name", placeName.trim());
      const res = await fetch(`${backendUrl}/api/location-photos/match?${params.toString()}`);
      const data = await res.json();
      setMatchedPhoto(data.success && data.photo ? data.photo : null);
    } catch (err) {
      console.error("Erreur recherche photo du lieu:", err);
    }
  };

  useEffect(() => {
    fetchNearbyPhotos();
    fetchMatchedPhoto();
  }, [currentLat, currentLng, placeName]);

  const handlePickPhoto = async () => {
    try {
      // Lazy-load expo-image-picker to avoid module-level crash
      const ImagePicker = await import("expo-image-picker");

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Accès aux photos nécessaire.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Image = `data:image/jpeg;base64,${asset.base64}`;
        setSelectedImage(base64Image);
      }
    } catch (err) {
      console.error("Erreur sélection photo:", err);
      Alert.alert("Erreur", "Le sélecteur de photos n'est pas disponible.");
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedImage) {
      Alert.alert("Photo requise", "Veuillez prendre ou sélectionner une photo du lieu.");
      return;
    }
    if (!inputPlaceName.trim()) {
      Alert.alert("Nom du lieu requis", "Veuillez donner un nom au repère (ex: devant la pharmacie).");
      return;
    }

    setIsUploading(true);
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/location-photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || null,
          place_name: inputPlaceName.trim(),
          lat: currentLat,
          lng: currentLng,
          image_url: selectedImage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert("Succès", "Photo du repère enregistrée ! Elle aidera les autres passagers et chauffeurs.");
        setSelectedImage(null);
        setIsModalOpen(false);
        fetchNearbyPhotos();
        fetchMatchedPhoto();
      } else {
        Alert.alert("Erreur", data.error || "Impossible de sauvegarder la photo.");
      }
    } catch (err) {
      console.error("Erreur envoi photo lieu:", err);
      Alert.alert("Erreur", "Erreur de connexion au serveur.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <View style={styles.container}>
      {/* Photo déjà assignée à ce lieu : affichée avec les infos du lieu */}
      {matchedPhoto ? (
        <View style={styles.matchedCard}>
          <Image source={{ uri: matchedPhoto.image_url }} style={styles.matchedImage} />
          <View style={styles.matchedInfo}>
            <View style={styles.matchedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#059669" />
              <Text style={styles.matchedBadgeText}>Repère vérifié - ce lieu a déjà une photo</Text>
            </View>
            <Text style={styles.matchedPlaceName} numberOfLines={2}>
              {matchedPhoto.place_name}
            </Text>
            <View style={styles.matchedMetaRow}>
              <Ionicons name="person-circle-outline" size={12} color="#64748B" />
              <Text style={styles.matchedMetaText} numberOfLines={1}>
                {matchedPhoto.uploader_name || "Membre de la communauté"}
              </Text>
              {typeof matchedPhoto.distance_m === "number" ? (
                <>
                  <Ionicons name="location-outline" size={12} color="#64748B" />
                  <Text style={styles.matchedMetaText}>{formatDistance(matchedPhoto.distance_m)}</Text>
                </>
              ) : null}
              {matchedPhoto.created_at ? (
                <>
                  <Ionicons name="calendar-outline" size={12} color="#64748B" />
                  <Text style={styles.matchedMetaText}>{formatDate(matchedPhoto.created_at)}</Text>
                </>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {/* Bouton pour ajouter un repère visuel */}
      <TouchableOpacity
        style={styles.addLandmarkBtn}
        onPress={() => {
          // On open: ensure field shows the latest resolved address
          if (placeName && placeName.trim().length > 0) {
            setInputPlaceName(placeName);
          }
          setIsModalOpen(true);
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="camera-outline" size={18} color="#0284C7" />
          <View style={{ flex: 1 }}>
            <Text style={styles.addLandmarkBtnText}>Assigner une photo à ce lieu</Text>
            {inputPlaceName ? (
              <Text style={styles.addLandmarkBtnSub} numberOfLines={1}>
                {inputPlaceName}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {/* Galerie des photos de repères proches */}
      {nearbyPhotos.length > 0 && (
        <View style={styles.photosSection}>
          <Text style={styles.photosTitle}>Repères visuels de la communauté</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
            {nearbyPhotos.map((item) => (
              <View key={item.id} style={styles.photoItemCard}>
                <Image source={{ uri: item.image_url }} style={styles.photoThumbnail} />
                <Text style={styles.photoPlaceName} numberOfLines={1}>
                  {item.place_name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Modal d'Ajout de Photo Géolocalisée */}
      <Modal visible={isModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Assigner une photo à ce lieu</Text>
              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#F1F5F9",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 8,
                }}
                accessibilityLabel="Fermer"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Prenez une photo du repère (panneau, bâtiment, pharmacie) pour guider la communauté.
            </Text>

            <Text style={styles.inputLabel}>NOM DU REPÈRE / LIEU DE PRISE EN CHARGE</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Devant le supermarché Bastos"
              placeholderTextColor="#94A3B8"
              value={inputPlaceName}
              onChangeText={setInputPlaceName}
              autoFocus={false}
            />
            {placeName ? (
              <Text style={styles.inputHint}>
                Position actuelle : {placeName}
              </Text>
            ) : null}

            {/* Aperçu de l'image sélectionnée */}
            {selectedImage ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.changeImageBtn}
                  onPress={() => setSelectedImage(null)}
                >
                  <Text style={styles.changeImageText}>Changer de photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.pickImageBox} onPress={handlePickPhoto}>
                <Ionicons name="camera" size={24} color="#0284C7" style={{ marginBottom: 4 }} />
                <Text style={styles.pickImageText}>Prendre / Choisir une photo</Text>
              </TouchableOpacity>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, isUploading && { opacity: 0.6 }]}
                onPress={handleUploadPhoto}
                disabled={isUploading}
              >
                <Text style={styles.submitText}>
                  {isUploading ? "Enregistrement..." : "Publier le Repère"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  matchedCard: {
    flexDirection: "row",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#059669",
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    gap: 12,
  },
  matchedImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  matchedInfo: {
    flex: 1,
    justifyContent: "center",
  },
  matchedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  matchedBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.3,
  },
  matchedPlaceName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  matchedMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  matchedMetaText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginRight: 6,
  },
  addLandmarkBtn: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#0EA5E9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  addLandmarkBtnText: {
    color: "#0284C7",
    fontSize: 13,
    fontWeight: "800",
  },
  addLandmarkBtnSub: {
    color: "#0EA5E9",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  inputHint: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: -12,
    marginBottom: 8,
  },
  photosSection: {
    marginTop: 12,
  },
  photosTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  photosScroll: {
    flexDirection: "row",
  },
  photoItemCard: {
    width: 110,
    marginRight: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  photoThumbnail: {
    width: "100%",
    height: 70,
    borderRadius: 8,
  },
  photoPlaceName: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 4,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 16,
  },
  pickImageBox: {
    backgroundColor: "#F0F9FF",
    borderWidth: 2,
    borderColor: "#0EA5E9",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  pickImageText: {
    color: "#0284C7",
    fontSize: 14,
    fontWeight: "800",
  },
  previewContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  previewImage: {
    width: "100%",
    height: 160,
    borderRadius: 16,
  },
  changeImageBtn: {
    marginTop: 8,
  },
  changeImageText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },
  submitBtn: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});

export default LocationPhotoPicker;
