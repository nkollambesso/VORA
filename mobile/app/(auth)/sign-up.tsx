import { getBackendUrl } from "@/lib/config";
import { Link, router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { ReactNativeModal } from "react-native-modal";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import OAuth from "@/components/OAuth";
import { icons, images } from "@/constants";
import { fetchAPI } from "@/lib/fetch";

// Lazy-load Clerk hook only when context is available
let _useSignUp: any = null;
try {
  _useSignUp = require("@clerk/clerk-expo").useSignUp;
} catch {}

const SignUp = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  let signUpHook: any = { isLoaded: false, signUp: null, setActive: null };
  try {
    if (_useSignUp) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      signUpHook = _useSignUp();
    }
  } catch {}
  const { isLoaded, signUp, setActive } = signUpHook;

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [role, setRole] = useState<"PASSENGER" | "DRIVER">("PASSENGER");
  const [form, setForm] = useState({ name: "", email: "", password: "", gender: "MALE" });
  const [verification, setVerification] = useState({
    state: "default",
    error: "",
    code: "",
  });

  const onSignUpPress = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      Alert.alert("Champs requis", "Veuillez remplir votre nom, email et mot de passe.");
      return;
    }

    if (!isLoaded || !signUp) {
      Alert.alert("Service indisponible", "Le service d'authentification n'est pas encore prêt.");
      return;
    }
    try {
      const nameParts = form.name.trim().split(" ");
      const firstName = nameParts[0] || form.name.trim();
      const lastName = nameParts.slice(1).join(" ") || " ";

      await signUp.create({
        emailAddress: form.email.trim(),
        password: form.password,
        firstName,
        lastName,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerification({ ...verification, state: "pending" });
    } catch (err: any) {
      Alert.alert(
        "Erreur d'inscription",
        err.errors?.[0]?.longMessage || err.message || "Échec d'inscription. Vérifiez les informations saisies."
      );
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) return;
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verification.code.trim(),
      });
      if (completeSignUp.status === "complete") {
        try {
          const backendUrl =
            getBackendUrl();
          await fetch(`${backendUrl}/api/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: completeSignUp.createdUserId,
              name: form.name,
              email: form.email,
              role,
            }),
          });
        } catch (syncErr) {
          console.warn("Backend user sync warning:", syncErr);
        }

        if (setActive) {
          await setActive({ session: completeSignUp.createdSessionId });
        }
        setVerification({ ...verification, state: "success" });
      } else {
        setVerification({
          ...verification,
          error: "Échec de vérification (Statut: " + completeSignUp.status + ")",
          state: "failed",
        });
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setVerification({
        ...verification,
        error:
          err.errors?.[0]?.longMessage ||
          err.message ||
          "Code de vérification invalide ou expiré.",
        state: "failed",
      });
    }
  };

  return (
    <View style={isWide ? styles.rootWide : styles.rootMobile}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={isWide ? styles.scrollContentWide : styles.scrollContentMobile}
      >
        <View style={isWide ? styles.cardWide : styles.cardMobile}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Créer un compte VORA</Text>
            <Text style={styles.headerSub}>
              Vos déplacements et courses en toute simplicité
            </Text>
          </View>

          <View style={styles.body}>
            {/* Role selector */}
            <Text style={styles.sectionLabel}>Je m'inscris en tant que :</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                onPress={() => setRole("PASSENGER")}
                style={[styles.roleBtn, role === "PASSENGER" && styles.roleBtnActive]}
              >
                <Text style={[styles.roleBtnText, role === "PASSENGER" && styles.roleBtnTextActive]}>
                  Passager
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRole("DRIVER")}
                style={[styles.roleBtn, role === "DRIVER" && styles.roleBtnActive]}
              >
                <Text style={[styles.roleBtnText, role === "DRIVER" && styles.roleBtnTextActive]}>
                  Chauffeur
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <InputField
              label="Nom complet"
              placeholder="Ex: Jean Tchouamo"
              icon={icons.person}
              value={form.name}
              onChangeText={(v: string) => setForm({ ...form, name: v })}
            />

            {/* Gender selection */}
            <Text style={styles.sectionLabel}>Genre / Sexe :</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                onPress={() => setForm({ ...form, gender: "MALE" })}
                style={[
                  styles.roleBtn,
                  form.gender === "MALE" && styles.roleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    form.gender === "MALE" && styles.roleBtnTextActive,
                  ]}
                >
                  Homme
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setForm({ ...form, gender: "FEMALE" })}
                style={[
                  styles.roleBtn,
                  form.gender === "FEMALE" && styles.roleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    form.gender === "FEMALE" && styles.roleBtnTextActive,
                  ]}
                >
                  Femme
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setForm({ ...form, gender: "OTHER" })}
                style={[
                  styles.roleBtn,
                  form.gender === "OTHER" && styles.roleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    form.gender === "OTHER" && styles.roleBtnTextActive,
                  ]}
                >
                  Autre
                </Text>
              </TouchableOpacity>
            </View>

            <InputField
              label="Email"
              placeholder="votre.email@domaine.cm"
              icon={icons.email}
              textContentType="emailAddress"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v: string) => setForm({ ...form, email: v })}
            />
            <InputField
              label="Mot de passe"
              placeholder="Choisissez un mot de passe"
              icon={icons.lock}
              secureTextEntry
              textContentType="password"
              value={form.password}
              onChangeText={(v: string) => setForm({ ...form, password: v })}
            />

            {/* Clerk Captcha container for Bot Protection on Web */}
            <View nativeID="clerk-captcha" />

            <View style={{ marginTop: 20 }}>
              <CustomButton
                title={role === "DRIVER" ? "S'inscrire comme Chauffeur" : "Créer mon compte Passager"}
                onPress={onSignUpPress}
              />
            </View>

            <OAuth role={role} />

            <View style={styles.linkRow}>
              <Text style={styles.linkGray}>Déjà un compte ? </Text>
              <TouchableOpacity onPress={() => router.push("/sign-in")}>
                <Text style={styles.linkBlue}>Se connecter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Verification Modal */}
      <ReactNativeModal
        isVisible={verification.state === "pending"}
        onModalHide={() => {
          if (verification.state === "success") setShowSuccessModal(true);
        }}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Vérification de l'email</Text>
          <Text style={styles.modalSub}>
            Nous avons envoyé un code de vérification à {form.email}.
          </Text>
          <InputField
            label="Code de vérification"
            icon={icons.lock}
            placeholder="123456"
            keyboardType="numeric"
            value={verification.code}
            onChangeText={(code: string) => setVerification({ ...verification, code })}
          />
          {verification.error ? (
            <Text style={styles.errorText}>{verification.error}</Text>
          ) : null}
          <View style={{ marginTop: 16 }}>
            <CustomButton title="Vérifier l'adresse" onPress={onPressVerify} />
          </View>
        </View>
      </ReactNativeModal>

      {/* Success Modal */}
      <ReactNativeModal isVisible={showSuccessModal}>
        <View style={styles.modal}>
          <Image
            source={images.check}
            style={{ width: 80, height: 80, alignSelf: "center", marginBottom: 16 }}
          />
          <Text style={[styles.modalTitle, { textAlign: "center" }]}>
            Compte créé !
          </Text>
          <Text style={[styles.modalSub, { textAlign: "center" }]}>
            Bienvenue sur VORA. Votre profil est prêt.
          </Text>
          <CustomButton
            title="Accéder à l'application"
            onPress={() => {
              setShowSuccessModal(false);
              if (role === "DRIVER") {
                router.replace("/(auth)/driver-register" as any);
              } else {
                router.replace("/(root)/(tabs)/home");
              }
            }}
          />
        </View>
      </ReactNativeModal>
    </View>
  );
};

export default SignUp;

// ─── Styles ───────────────────────────────────────────────────────────────────
const PRIMARY = "#0EA5E9";

const styles = StyleSheet.create({
  rootMobile: {
    flex: 1,
    backgroundColor: "#ffffff",
    width: "100%",
  },
  rootWide: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    width: "100%",
  },
  scroll: {
    flex: 1,
    width: "100%",
  },
  scrollContentMobile: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  scrollContentWide: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  cardMobile: {
    width: "100%",
    backgroundColor: "#ffffff",
  },
  cardWide: {
    width: "100%",
    maxWidth: 580,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.08)",
    elevation: 6,
  },
  // Header
  header: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  backBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  backBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "500",
    marginTop: 4,
  },
  // Body
  body: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  roleRow: {
    flexDirection: "row",
    backgroundColor: "#f0f9ff",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  roleBtnActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  roleBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  roleBtnTextActive: {
    color: "#ffffff",
  },
  // Links
  linkRow: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  linkGray: {
    fontSize: 15,
    color: "#64748b",
  },
  linkBlue: {
    fontSize: 15,
    color: PRIMARY,
    fontWeight: "700",
  },
  // Modals
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    minHeight: 240,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    marginTop: 6,
  },
});
