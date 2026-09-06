import { useClerkUser } from "@/lib/useClerkSafe";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";

const AVATAR_PRESETS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=250&q=80",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=250&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=250&q=80",
  "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=250&q=80",
];

const Profile = () => {
  const { user } = useClerkUser();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const currentAvatar =
    selectedAvatar ||
    user?.externalAccounts?.[0]?.imageUrl ||
    user?.imageUrl ||
    AVATAR_PRESETS[0];

  const handleSelectAvatar = (url: string) => {
    setSelectedAvatar(url);
    setShowAvatarModal(false);
    Alert.alert("Photo mise à jour", "Votre photo de profil VORA a été modifiée avec succès.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top title & mode badge */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mon Profil VORA</Text>
          <TouchableOpacity
            style={styles.driverBadge}
            onPress={() => router.push("/(driver)/dashboard" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.driverBadgeText}>Espace Chauffeur →</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar with edit overlay button */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: currentAvatar }}
              style={styles.avatarImage}
            />
            <TouchableOpacity
              style={styles.editPhotoBtn}
              onPress={() => setShowAvatarModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.editPhotoIcon}>Edit</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setShowAvatarModal(true)}>
            <Text style={styles.changePhotoText}>Changer ma photo de profil</Text>
          </TouchableOpacity>
        </View>

        {/* Main profile card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Informations Personnelles</Text>

          <InputField
            label="Prénom"
            placeholder={user?.firstName || "Non renseigné"}
            editable={false}
          />

          <InputField
            label="Nom"
            placeholder={user?.lastName || "Non renseigné"}
            editable={false}
          />

          {/* Gender selection */}
          <Text style={styles.fieldLabel}>Genre / Sexe</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity
              onPress={() => setGender("MALE")}
              style={[
                styles.genderBtn,
                gender === "MALE" && styles.genderBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.genderBtnText,
                  gender === "MALE" && styles.genderBtnTextActive,
                ]}
              >
                Homme
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setGender("FEMALE")}
              style={[
                styles.genderBtn,
                gender === "FEMALE" && styles.genderBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.genderBtnText,
                  gender === "FEMALE" && styles.genderBtnTextActive,
                ]}
              >
                Femme
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setGender("OTHER")}
              style={[
                styles.genderBtn,
                gender === "OTHER" && styles.genderBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.genderBtnText,
                  gender === "OTHER" && styles.genderBtnTextActive,
                ]}
              >
                Autre
              </Text>
            </TouchableOpacity>
          </View>

          <InputField
            label="Email"
            placeholder={
              user?.primaryEmailAddress?.emailAddress || "votre.email@domaine.cm"
            }
            editable={false}
          />

          <InputField
            label="Numéro de Téléphone"
            placeholder={user?.primaryPhoneNumber?.phoneNumber || "+237 6XX XX XX XX"}
            editable={false}
          />
        </View>

        {/* Driver Space Toggle Card */}
        <View style={styles.driverCard}>
          <Text style={styles.driverCardTitle}>Vous êtes Chauffeur VORA ?</Text>
          <Text style={styles.driverCardSub}>
            Accédez à votre tableau de bord chauffeur pour passer En Ligne, recevoir des courses et consulter vos revenus.
          </Text>
          <CustomButton
            title="Accéder à l'Espace Chauffeur"
            onPress={() => router.push("/(driver)/dashboard" as any)}
            className="mt-3 bg-sky-500 shadow-md"
          />
        </View>
      </ScrollView>

      {/* Avatar Picker Modal */}
      <Modal
        visible={showAvatarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choisir une photo de profil</Text>
            <Text style={styles.modalSub}>
              Sélectionnez votre nouvel avatar VORA :
            </Text>

            <View style={styles.presetGrid}>
              {AVATAR_PRESETS.map((url, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleSelectAvatar(url)}
                  style={[
                    styles.presetItem,
                    currentAvatar === url && styles.presetItemActive,
                  ]}
                >
                  <Image source={{ uri: url }} style={styles.presetImg} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowAvatarModal(false)}
            >
              <Text style={styles.closeModalText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Profile;

const PRIMARY = "#0EA5E9";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  driverBadge: {
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#38bdf8",
  },
  driverBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: PRIMARY,
  },
  avatarWrapper: {
    alignItems: "center",
    marginVertical: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  editPhotoBtn: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: PRIMARY,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    elevation: 5,
  },
  editPhotoIcon: {
    fontSize: 16,
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#64748b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 8,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginTop: 12,
    marginBottom: 8,
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  genderBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  genderBtnTextActive: {
    color: "#ffffff",
  },
  driverCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  driverCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0369a1",
    marginBottom: 4,
  },
  driverCardSub: {
    fontSize: 13,
    color: "#0284c7",
    lineHeight: 18,
    marginBottom: 12,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginBottom: 24,
  },
  presetItem: {
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "transparent",
    padding: 2,
  },
  presetItemActive: {
    borderColor: PRIMARY,
  },
  presetImg: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  closeModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  closeModalText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748b",
  },
});
