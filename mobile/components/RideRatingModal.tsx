import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getBackendUrl } from "@/lib/config";
import { voraVoice } from "@/lib/voiceAssistant";

interface RideRatingModalProps {
  visible: boolean;
  rideId: string;
  driverName?: string;
  driverAvatar?: string;
  vehicleModel?: string;
  onClose: () => void;
  onRated?: (rating: number) => void;
}

const COMPLIMENT_TAGS = [
  "Conduite prudente",
  "Véhicule propre",
  "Ponctuel",
  "Poli & Courtois",
  "Climatisation agréable",
];

export const RideRatingModal: React.FC<RideRatingModalProps> = ({
  visible,
  rideId,
  driverName = "Chauffeur VORA",
  driverAvatar,
  vehicleModel,
  onClose,
  onRated,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmitRating = async () => {
    setSubmitting(true);
    try {
      const backendUrl = getBackendUrl();
      const combinedFeedback = [
        ...selectedTags,
        feedback.trim(),
      ]
        .filter(Boolean)
        .join(" • ");

      const res = await fetch(`${backendUrl}/api/rides/${rideId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          feedback: combinedFeedback,
        }),
      });

      const data = await res.json();
      if (data.success) {
        voraVoice.speak("Merci beaucoup pour votre évaluation ! À bientôt sur VORA.");
        Alert.alert(
          "Merci pour votre avis !",
          `Votre note de ${rating}/5 a bien été prise en compte et valorise la notoriété de votre chauffeur.`
        );
        if (onRated) onRated(rating);
        onClose();
      } else {
        Alert.alert("Erreur", data.error || "Impossible d'enregistrer votre note.");
      }
    } catch (e) {
      console.warn("Erreur notation:", e);
      Alert.alert("Avis enregistré", "Merci pour votre évaluation de course !");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#F1F5F9",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
            accessibilityLabel="Fermer"
          >
            <Text style={{ fontSize: 18, color: "#64748B", fontWeight: "700" }}>✕</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ backgroundColor: "#E0F2FE", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, alignSelf: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: "#0284C7", letterSpacing: 0.5 }}>COURSE TERMINÉE</Text>
            </View>
            <Text style={styles.title}>Merci d'avoir voyagé avec VORA !</Text>
            <Text style={styles.subtitle}>
              Votre évaluation récompense les chauffeurs exemplaires et renforce leur notoriété sur la plateforme.
            </Text>
          </View>


          {/* Driver Card */}
          <View style={styles.driverBox}>
            <Image
              source={{
                uri:
                  driverAvatar ||
                  "https://api.dicebear.com/7.x/shapes/png?seed=VoraDriver&backgroundColor=0ea5e9",
              }}
              style={styles.avatar}
            />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.vehicleText}>{vehicleModel || "Véhicule Partenaire VORA"}</Text>
            </View>
          </View>

          {/* Star Rating Picker */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={styles.starBtn}
                activeOpacity={0.7}
              >
                <Text style={[styles.starIcon, rating >= star && styles.starActive]}>
                  ★
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>
            {rating === 5 && "Excellent service ! ⭐⭐⭐⭐⭐"}
            {rating === 4 && "Très bonne course ! ⭐⭐⭐⭐"}
            {rating === 3 && "Correct ⭐⭐⭐"}
            {rating === 2 && "Peut mieux faire ⭐⭐"}
            {rating === 1 && "Décevant ⭐"}
          </Text>

          {/* Compliments Tags */}
          <View style={styles.tagsContainer}>
            {COMPLIMENT_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tagBadge, active && styles.tagBadgeActive]}
                >
                  <Text style={[styles.tagText, active && styles.tagTextActive]}>
                    {active ? `✓ ${tag}` : `+ ${tag}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Comment text input */}
          <TextInput
            style={styles.input}
            placeholder="Un mot pour le chauffeur ? (Optionnel)..."
            placeholderTextColor="#94a3b8"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={2}
          />

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmitRating}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.submitText}>Envoyer mon Évaluation</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
            <Text style={styles.skipText}>Passer cette étape</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 999,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  celebrationEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  driverBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 16,
    width: "100%",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#cbd5e1",
  },
  driverName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  vehicleText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  starBtn: {
    padding: 6,
  },
  starIcon: {
    fontSize: 34,
    color: "#cbd5e1",
  },
  starActive: {
    color: "#f59e0b",
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284c7",
    marginBottom: 14,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginBottom: 14,
  },
  tagBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tagBadgeActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#0284c7",
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  tagTextActive: {
    color: "#0284c7",
  },
  input: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    fontSize: 13,
    color: "#0f172a",
    marginBottom: 16,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: "#0ea5e9",
    paddingVertical: 14,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  submitText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  skipBtn: {
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
});
