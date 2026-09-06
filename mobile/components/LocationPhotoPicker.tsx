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
import * as ImagePicker from "expo-image-picker";
import { useClerkUser } from "@/lib/useClerkSafe";

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
  const [inputPlaceName, setInputPlaceName] = useState(placeName);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [nearbyPhotos, setNearbyPhotos] = useState<any[]>([]);

  // Charger les photos de repères proches
  const fetchNearbyPhotos = async () => {
    try {
      const backendUrl =
        process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";
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

  useEffect(() => {
    fetchNearbyPhotos();
  }, [currentLat, currentLng]);

  const handlePickPhoto = async () => {
    try {
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
      const backendUrl =
        process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";
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

  return (
    <View style={styles.container}>
      {/* Bouton pour ajouter un repère visuel */}
      <TouchableOpacity
        style={styles.addLandmarkBtn}
        onPress={() => {
          setInputPlaceName(placeName);
          setIsModalOpen(true);
        }}
      >
        <Text style={styles.addLandmarkBtnText}>
          📸 Filmer / Assigner une photo à ce lieu
        </Text>
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
            <Text style={styles.modalTitle}>Assigner une photo à ce lieu</Text>
            <Text style={styles.modalSub}>
              Prenez une photo du repère (panneau, bâtiment, pharmacie) pour guider la communauté.
            </Text>

            <Text style={styles.inputLabel}>NOM DU REPÈRE OU LIEU</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Devant le supermarché Bastos"
              placeholderTextColor="#94A3B8"
              value={inputPlaceName}
              onChangeText={setInputPlaceName}
            />

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
                <Text style={styles.pickImageText}>📷 Prendre / Choisir une photo</Text>
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
  addLandmarkBtn: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#0EA5E9",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  addLandmarkBtnText: {
    color: "#0284C7",
    fontSize: 13,
    fontWeight: "800",
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
