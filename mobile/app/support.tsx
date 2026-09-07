import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_LIST: FAQItem[] = [
  {
    q: "Comment fonctionne la tarification VORA ?",
    a: "VORA propose 3 catégories : Moto (Bendskin dès 500 FCFA), Taxi Classique (dès 1000 FCFA) et Berline Confort (dès 2000 FCFA). Des majorations s'appliquent automatiquement en heures de pointe (07h-09h, 17h-20h, 22h-05h) et en zones à forte affluence.",
  },
  {
    q: "Comment payer par MTN MoMo ou Orange Money ?",
    a: "Lors de la réservation, sélectionnez MTN Mobile Money ou Orange Money. Le paiement est sécurisé et traité instantanément via notre passerelle intégrée CamerPay.",
  },
  {
    q: "Mes coordonnées téléphoniques sont-elles protégées ?",
    a: "Oui ! Tous les appels et messages passent par notre réseau chiffré WebRTC et sont anonymisés sous un identifiant public VORA-XXXXXX. Votre numéro réel n'est jamais divulgué.",
  },
  {
    q: "Que faire en cas d'urgence ?",
    a: "Un bouton SOS d'urgence est accessible pendant toute la durée du trajet. Il transmet instantanément votre position GPS aux services d'assistance et à vos contacts de sécurité.",
  },
];

export default function Support() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSent, setTicketSent] = useState(false);

  const handleSendTicket = () => {
    if (!ticketMessage.trim()) return;
    setTicketSent(true);
    setTicketMessage("");
    setTimeout(() => setTicketSent(false), 4000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.mainWrapper, isWide && { maxWidth: 840, alignSelf: "center", width: "100%" }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assistance & Support VORA</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Banner */}
          <View style={styles.banner}>
            <View style={styles.bannerIconBox}>
              <Ionicons name="headset" size={32} color="#0EA5E9" />
            </View>
            <Text style={styles.bannerTitle}>Centre d'Aide & Support 24/7</Text>
            <Text style={styles.bannerSub}>
              Notre équipe d'assistance VORA est disponible 24h/24 et 7j/7 pour vous accompagner dans tous vos déplacements.
            </Text>
          </View>

          {/* Quick Contact Buttons */}
          <View style={styles.quickContactsRow}>
            <TouchableOpacity style={styles.contactCard} activeOpacity={0.85}>
              <View style={[styles.contactIconCircle, { backgroundColor: "#DCFCE7" }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#16A34A" />
              </View>
              <Text style={styles.contactCardTitle}>WhatsApp VORA</Text>
              <Text style={styles.contactCardSub}>Réponse en moins de 5 min</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} activeOpacity={0.85}>
              <View style={[styles.contactIconCircle, { backgroundColor: "#E0F2FE" }]}>
                <Ionicons name="call" size={24} color="#0284C7" />
              </View>
              <Text style={styles.contactCardTitle}>Ligne Directe</Text>
              <Text style={styles.contactCardSub}>Appel gratuit 24/7</Text>
            </TouchableOpacity>
          </View>

          {/* Formulaire de Message d'Assistance */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Envoyer un message à l'assistance</Text>
            <Text style={styles.cardSub}>
              Décrivez votre problème ou posez une question sur une course :
            </Text>

            <TextInput
              style={styles.textArea}
              placeholder="Ex: Problème de paiement, objet oublié, réclamation chauffeur..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              value={ticketMessage}
              onChangeText={setTicketMessage}
            />

            {ticketSent ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={styles.successText}>Message transmis ! Un conseiller vous répondra sous 15 minutes.</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.sendTicketBtn, !ticketMessage.trim() && { opacity: 0.6 }]}
                onPress={handleSendTicket}
                disabled={!ticketMessage.trim()}
                activeOpacity={0.85}
              >
                <Ionicons name="paper-plane-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.sendTicketBtnText}>Envoyer la Demande</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* FAQ Section */}
          <Text style={styles.sectionHeader}>Foire Aux Questions (FAQ)</Text>
          <View style={styles.faqList}>
            {FAQ_LIST.map((item, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.faqCard}
                  onPress={() => setExpandedIndex(isExpanded ? null : idx)}
                  activeOpacity={0.8}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{item.q}</Text>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color="#64748B"
                    />
                  </View>
                  {isExpanded && <Text style={styles.faqAnswer}>{item.a}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  mainWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  banner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  bannerIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
    textAlign: "center",
  },
  bannerSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
  },
  quickContactsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  contactCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  contactIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  contactCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  contactCardSub: {
    fontSize: 11,
    color: "#64748B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 14,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  sendTicketBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0EA5E9",
    paddingVertical: 13,
    borderRadius: 14,
  },
  sendTicketBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  successText: {
    flex: 1,
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  faqList: {
    gap: 10,
  },
  faqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    paddingRight: 8,
  },
  faqAnswer: {
    marginTop: 10,
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
  },
});
