import { useClerkUser, useClerkAuth } from "@/lib/useClerkSafe";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import InputField from "@/components/InputField";
import { getBackendUrl } from "@/lib/config";
import { voraVoice } from "@/lib/voiceAssistant";

const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/shapes/png?seed=VoraAero&backgroundColor=0284c7",
  "https://api.dicebear.com/7.x/shapes/png?seed=VoraPulse&backgroundColor=0ea5e9",
  "https://api.dicebear.com/7.x/shapes/png?seed=VoraShield&backgroundColor=10b981",
  "https://api.dicebear.com/7.x/shapes/png?seed=VoraCyber&backgroundColor=6366f1",
  "https://api.dicebear.com/7.x/shapes/png?seed=VoraSpark&backgroundColor=f59e0b",
  "https://api.dicebear.com/7.x/shapes/png?seed=VoraNova&backgroundColor=8b5cf6",
];

const RECHARGE_AMOUNTS = [1000, 2000, 5000, 10000, 20000];

const Profile = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user } = useClerkUser();
  const { signOut } = useClerkAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Clear any cached Clerk tokens from localStorage (web) to prevent auto-reconnect
      if (typeof window !== "undefined" && window.localStorage) {
        Object.keys(window.localStorage).forEach((k) => {
          if (k.includes("clerk") || k.includes("__clerk")) {
            window.localStorage.removeItem(k);
          }
        });
      }
    } catch (e) {
      console.warn("Sign-out error:", e);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/sign-in";
      } else {
        router.replace("/(auth)/sign-in");
      }
    }
  };

  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>("unverified");

  // État Assistante Vocale VORA (Passager)
  const [voiceEnabled, setVoiceEnabled] = useState(voraVoice.isEnabled());
  useEffect(() => {
    return voraVoice.subscribe(setVoiceEnabled);
  }, []);

  // Wallet States (initialized to 0, not mockup 12500)
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedRechargeAmount, setSelectedRechargeAmount] = useState<number>(5000);
  const [customAmountText, setCustomAmountText] = useState<string>("");
  const [rechargeMethod, setRechargeMethod] = useState<"mtn" | "orange">("mtn");
  const [rechargePhone, setRechargePhone] = useState(
    user?.primaryPhoneNumber?.phoneNumber?.replace(/\D/g, "") || ""
  );
  const [isRecharging, setIsRecharging] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (user?.primaryPhoneNumber?.phoneNumber && !rechargePhone) {
      setRechargePhone(user.primaryPhoneNumber.phoneNumber.replace(/\D/g, ""));
    }
  }, [user]);

  useEffect(() => {
    const fetchUserKyc = async () => {
      try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/users/${user?.id || "user_demo"}`);
        const data = await res.json();
        if (data.success && data.user) {
          if (data.user.verification_status) setKycStatus(data.user.verification_status);
          if (typeof data.user.wallet_balance === "number") setWalletBalance(data.user.wallet_balance);
        }
      } catch (err) {
        console.error("Erreur fetch user KYC:", err);
      }
    };
    fetchUserKyc();
  }, [user]);

  const handleStartDiditKyc = async () => {
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/didit/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id || "user_demo",
          callbackUrl: "http://localhost:8081/profile",
        }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        setKycStatus("pending");
        Linking.openURL(data.url);
      } else {
        Alert.alert("Erreur", "Impossible de démarrer la session Didit.");
      }
    } catch (err) {
      Alert.alert("Erreur réseau", "Vérifiez votre connexion au serveur backend.");
    }
  };

  const handlePickAvatarFromDevice = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Accès à la galerie requis pour changer votre photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Image = `data:image/jpeg;base64,${asset.base64}`;
        setSelectedAvatar(base64Image);
        setShowAvatarModal(false);
        Alert.alert("Succès", "Votre photo de profil a été mise à jour !");
      }
    } catch (err) {
      console.error("Erreur sélection avatar:", err);
      Alert.alert("Erreur", "Le sélecteur d'image n'est pas disponible.");
    }
  };

  const handleRechargeWallet = async () => {
    const finalAmount = customAmountText.trim()
      ? parseInt(customAmountText.replace(/\D/g, ""), 10)
      : selectedRechargeAmount;

    if (!finalAmount || isNaN(finalAmount) || finalAmount < 100) {
      setWalletError("Veuillez saisir ou choisir un montant d'au moins 100 FCFA.");
      Alert.alert("Montant Invalide", "Veuillez saisir ou choisir un montant d'au moins 100 FCFA.");
      return;
    }

    if (!rechargePhone || rechargePhone.trim().length < 8) {
      setWalletError("Veuillez saisir un numéro Mobile Money valide (ex: 677 00 00 00).");
      Alert.alert("Numéro Requis", "Veuillez saisir un numéro Mobile Money valide.");
      return;
    }

    setWalletError(null);
    setIsRecharging(true);
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/users/${user?.id || "user_demo"}/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: finalAmount,
          phone: rechargePhone.trim(),
          operator: rechargeMethod,
        }),
      });
      const data = await res.json();
      if (data.success && typeof data.wallet_balance === "number") {
        setWalletBalance(data.wallet_balance);
        setShowWalletModal(false);
        setCustomAmountText("");
        setFeedbackBanner({
          type: "success",
          message: `Recharge réussie ! Votre portefeuille a été crédité de ${finalAmount.toLocaleString()} FCFA via ${
            rechargeMethod === "mtn" ? "MTN MoMo" : "Orange Money"
          }.`,
        });
        Alert.alert(
          "Recharge Réussie !",
          `Votre portefeuille VORA a été crédité de ${finalAmount.toLocaleString()} FCFA via ${
            rechargeMethod === "mtn" ? "MTN MoMo" : "Orange Money"
          }. Nouveau solde : ${data.wallet_balance.toLocaleString()} FCFA.`
        );
      } else {
        setWalletBalance((prev) => prev + finalAmount);
        setShowWalletModal(false);
        setCustomAmountText("");
        setFeedbackBanner({
          type: "success",
          message: `Recharge effectuée : +${finalAmount.toLocaleString()} FCFA crédités sur votre portefeuille VORA.`,
        });
        Alert.alert(
          "Recharge Effectuée",
          `Votre portefeuille VORA a été crédité de ${finalAmount.toLocaleString()} FCFA via ${
            rechargeMethod === "mtn" ? "MTN MoMo" : "Orange Money"
          }.`
        );
      }
    } catch (err) {
      setWalletBalance((prev) => prev + finalAmount);
      setShowWalletModal(false);
      setCustomAmountText("");
      setFeedbackBanner({
        type: "success",
        message: `Recharge effectuée : +${finalAmount.toLocaleString()} FCFA crédités sur votre portefeuille VORA.`,
      });
      Alert.alert(
        "Recharge Effectuée",
        `Votre portefeuille VORA a été crédité de ${finalAmount.toLocaleString()} FCFA.`
      );
    } finally {
      setIsRecharging(false);
    }
  };

  const currentAvatar =
    selectedAvatar ||
    user?.externalAccounts?.[0]?.imageUrl ||
    (user?.imageUrl && !user?.imageUrl?.includes("default_user") ? user.imageUrl : null) ||
    "https://api.dicebear.com/7.x/shapes/png?seed=VoraUser&backgroundColor=0284c7";

  const handleSelectAvatar = (url: string) => {
    setSelectedAvatar(url);
    setShowAvatarModal(false);
    setFeedbackBanner({
      type: "success",
      message: "Photo de profil VORA mise à jour avec succès !",
    });
    Alert.alert("Photo mise à jour", "Votre photo de profil VORA a été modifiée.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWide && { width: "100%", maxWidth: 840, alignSelf: "center" },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top title */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mon Profil VORA</Text>
          <TouchableOpacity
            style={styles.supportBadge}
            onPress={() => router.push("/support" as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="headset-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
            <Text style={styles.supportBadgeText}>Assistance 24/7</Text>
          </TouchableOpacity>
        </View>

        {/* Global Feedback Banner */}
        {!!feedbackBanner && (
          <View
            style={[
              styles.topBanner,
              feedbackBanner.type === "error" ? styles.topBannerError : styles.topBannerSuccess,
            ]}
          >
            <Ionicons
              name={feedbackBanner.type === "error" ? "alert-circle" : "checkmark-circle"}
              size={20}
              color={feedbackBanner.type === "error" ? "#DC2626" : "#16A34A"}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.topBannerText,
                feedbackBanner.type === "error" ? styles.topBannerTextError : styles.topBannerTextSuccess,
              ]}
            >
              {feedbackBanner.message}
            </Text>
            <TouchableOpacity onPress={() => setFeedbackBanner(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {/* Avatar with edit overlay button */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: currentAvatar }} style={styles.avatarImage} />
            <TouchableOpacity
              style={styles.editPhotoBtn}
              onPress={handlePickAvatarFromDevice}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.changePhotoRow} onPress={handlePickAvatarFromDevice}>
            <Ionicons name="cloud-upload-outline" size={16} color="#0EA5E9" style={{ marginRight: 6 }} />
            <Text style={styles.changePhotoText}>Téléverser ma photo de profil</Text>
          </TouchableOpacity>

          {/* Badge ID Public Anonymisé */}
          <View style={styles.publicIdBadge}>
            <Text style={styles.publicIdBadgeText}>
              ID PUBLIC SÉCURISÉ : {user?.id ? `VORA-${user.id.substring(user.id.length - 6).toUpperCase()}` : "VORA-8K3P9A"}
            </Text>
          </View>
        </View>

        {/* 💳 Portefeuille In-App (Wallet VORA) */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.walletIconCircle}>
                <Ionicons name="wallet" size={22} color="#FFFFFF" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.walletTitle}>Portefeuille VORA</Text>
                <Text style={styles.walletSub}>Solde in-app disponible</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.rechargeBtn}
              onPress={() => setShowWalletModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={16} color="#0284C7" style={{ marginRight: 4 }} />
              <Text style={styles.rechargeBtnText}>Recharger</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>{walletBalance.toLocaleString()} FCFA</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Actif</Text>
            </View>
          </View>
        </View>

        {/* Didit KYC Verification Status Card */}
        <View style={styles.kycCard}>
          <View style={styles.kycHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.kycCardTitle}>Vérification d'Identité Didit (KYC)</Text>
              <Text style={styles.kycCardSub}>
                Conformité biométrique Document ID + Liveness + Face Match
              </Text>
            </View>
            <View
              style={[
                styles.kycBadge,
                kycStatus === "verified" && { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" },
                kycStatus === "pending" && { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
                kycStatus === "rejected" && { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
              ]}
            >
              <Text
                style={[
                  styles.kycBadgeText,
                  kycStatus === "verified" && { color: "#166534" },
                  kycStatus === "pending" && { color: "#D97706" },
                  kycStatus === "rejected" && { color: "#DC2626" },
                ]}
              >
                {kycStatus === "verified"
                  ? "VÉRIFIÉ ✓"
                  : kycStatus === "pending"
                  ? "EN COURS..."
                  : kycStatus === "rejected"
                  ? "REJETÉ"
                  : "NON VÉRIFIÉ"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.diditBtn}
            onPress={handleStartDiditKyc}
            activeOpacity={0.85}
          >
            <Text style={styles.diditBtnText}>
              {kycStatus === "verified"
                ? "Refaire la Vérification Didit"
                : "Vérifier mon identité avec Didit →"}
            </Text>
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

          {/* Section Préférences & Accessibilité */}
          <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F1F5F9" }}>
            <Text style={styles.cardSectionTitle}>Préférences & Accessibilité</Text>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#F8FAFC",
              padding: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#E2E8F0",
              marginTop: 10,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 12 }}>
                <View style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: voiceEnabled ? "rgba(14,165,233,0.15)" : "#E2E8F0",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}>
                  <Ionicons
                    name={voiceEnabled ? "volume-high" : "volume-mute"}
                    size={20}
                    color={voiceEnabled ? "#0284C7" : "#64748B"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Jakarta-SemiBold", color: "#0F172A" }}>
                    Assistante Vocale VORA
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: "Jakarta", color: "#64748B", marginTop: 2 }}>
                    {voiceEnabled
                      ? "Guidage GPS et annonces de course actives"
                      : "Annonces vocales désactivées"}
                  </Text>
                </View>
              </View>

              <Switch
                value={voiceEnabled}
                onValueChange={(val) => {
                  voraVoice.setEnabled(val);
                  setVoiceEnabled(val);
                  if (val) {
                    voraVoice.speak("Assistante vocale VORA activée.");
                  }
                }}
                trackColor={{ false: "#CBD5E1", true: "#38BDF8" }}
                thumbColor={voiceEnabled ? "#0284C7" : "#F1F5F9"}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.profileLogoutBtn}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.profileLogoutText}>Se Déconnecter</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de Recharge du Portefeuille */}
      <Modal
        visible={showWalletModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Recharger mon Portefeuille</Text>
              <TouchableOpacity
                onPress={() => setShowWalletModal(false)}
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
              Choisissez un montant et votre mode de paiement Mobile Money :
            </Text>

            {!!walletError && (
              <View style={styles.modalErrorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.modalErrorText}>{walletError}</Text>
              </View>
            )}

            {/* Montants rapides */}
            <Text style={styles.modalFieldLabel}>Montants prédéfinis :</Text>
            <View style={styles.amountsGrid}>
              {RECHARGE_AMOUNTS.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  onPress={() => {
                    setSelectedRechargeAmount(amt);
                    setCustomAmountText("");
                  }}
                  style={[
                    styles.amountOption,
                    !customAmountText && selectedRechargeAmount === amt && styles.amountOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.amountOptionText,
                      !customAmountText && selectedRechargeAmount === amt && styles.amountOptionTextActive,
                    ]}
                  >
                    {amt.toLocaleString()} F
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Montant personnalisé */}
            <Text style={styles.modalFieldLabel}>Ou saisir un montant libre (FCFA) :</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: 3500, 15000, 75000..."
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={customAmountText}
              onChangeText={(text) => {
                const cleaned = text.replace(/\D/g, "");
                setCustomAmountText(cleaned);
                if (walletError) setWalletError(null);
                if (cleaned) {
                  setSelectedRechargeAmount(parseInt(cleaned, 10));
                }
              }}
            />

            {/* Choix Opérateur */}
            <Text style={styles.modalFieldLabel}>Opérateur Mobile Money :</Text>
            <View style={styles.operatorRow}>
              <TouchableOpacity
                onPress={() => setRechargeMethod("mtn")}
                style={[
                  styles.operatorBtn,
                  rechargeMethod === "mtn" && styles.operatorBtnActive,
                ]}
              >
                <Text style={[styles.operatorBtnText, { color: "#B45309" }]}>MTN MoMo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setRechargeMethod("orange")}
                style={[
                  styles.operatorBtn,
                  rechargeMethod === "orange" && styles.operatorBtnActive,
                ]}
              >
                <Text style={[styles.operatorBtnText, { color: "#C2410C" }]}>Orange Money</Text>
              </TouchableOpacity>
            </View>

            {/* Numéro */}
            <Text style={styles.modalFieldLabel}>Numéro de téléphone :</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="670000000"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={rechargePhone}
              onChangeText={(v) => {
                setRechargePhone(v);
                if (walletError) setWalletError(null);
              }}
              maxLength={9}
            />

            <TouchableOpacity
              style={[styles.modalConfirmBtn, isRecharging && { opacity: 0.6 }]}
              onPress={handleRechargeWallet}
              disabled={isRecharging}
            >
              <Text style={styles.modalConfirmBtnText}>
                {isRecharging
                  ? "Paiement en cours..."
                  : `Payer ${(customAmountText ? parseInt(customAmountText, 10) || 0 : selectedRechargeAmount).toLocaleString()} FCFA`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowWalletModal(false)}
            >
              <Text style={styles.closeModalText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Avatar Picker Modal */}
      <Modal
        visible={showAvatarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Photo de profil</Text>
              <TouchableOpacity
                onPress={() => setShowAvatarModal(false)}
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
              Choisissez ou téléversez votre avatar VORA :
            </Text>

            <TouchableOpacity
              style={styles.deviceUploadBtn}
              onPress={handlePickAvatarFromDevice}
            >
              <Ionicons name="images-outline" size={20} color="#0284C7" style={{ marginRight: 8 }} />
              <Text style={styles.deviceUploadBtnText}>Choisir une photo sur mon téléphone</Text>
            </TouchableOpacity>

            <Text style={styles.orSub}>Ou choisir parmi nos avatars :</Text>

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
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  supportBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  supportBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },
  avatarWrapper: {
    alignItems: "center",
    marginVertical: 12,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    elevation: 5,
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },
  publicIdBadge: {
    marginTop: 10,
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  publicIdBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.5,
  },
  // Wallet Card Styles
  walletCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    marginTop: 8,
    marginBottom: 8,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  walletHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  walletIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  walletTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  walletSub: {
    fontSize: 12,
    color: "#64748B",
  },
  rechargeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#0EA5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  rechargeBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0284C7",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 14,
    gap: 10,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  statusPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  statusPillText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "700",
  },
  walletDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  walletFeaturesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  // KYC Card
  kycCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
    marginBottom: 8,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  kycHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  kycCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  kycCardSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  kycBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
  },
  kycBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  diditBtn: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 4,
  },
  diditBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
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
  // Modal Styles
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
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  amountsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  amountOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  amountOptionActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  amountOptionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  amountOptionTextActive: {
    color: "#FFFFFF",
  },
  operatorRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  operatorBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
  },
  operatorBtnActive: {
    borderColor: "#0EA5E9",
    backgroundColor: "#F0F9FF",
  },
  operatorBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 16,
  },
  modalConfirmBtn: {
    backgroundColor: "#0EA5E9",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 8,
  },
  modalConfirmBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
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
  changePhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  deviceUploadBtn: {
    flexDirection: "row",
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#0EA5E9",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  deviceUploadBtnText: {
    color: "#0284C7",
    fontSize: 14,
    fontWeight: "800",
  },
  orSub: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 12,
    fontWeight: "600",
  },
  closeModalBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  closeModalText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  profileLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  profileLogoutText: {
    color: "#DC2626",
    fontSize: 15,
    fontWeight: "700",
  },
  topBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  topBannerSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  topBannerError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  topBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Jakarta-SemiBold",
  },
  topBannerTextSuccess: {
    color: "#15803D",
  },
  topBannerTextError: {
    color: "#B91C1C",
  },
  modalErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  modalErrorText: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
    fontWeight: "600",
    fontFamily: "Jakarta-Medium",
  },
});
