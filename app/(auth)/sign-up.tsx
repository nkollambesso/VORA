import { Link, router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ReactNativeModal } from "react-native-modal";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import OAuth from "@/components/OAuth";
import { icons } from "@/constants";
import { fetchAPI } from "@/lib/fetch";

// Lazy-load Clerk hook only when context is available
let _useSignUp: any = null;
try {
  _useSignUp = require("@clerk/clerk-expo").useSignUp;
} catch {}

const SignUp = () => {
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
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [verification, setVerification] = useState({
    state: "default",
    error: "",
    code: "",
  });

  const onSignUpPress = async () => {
    if (!isLoaded || !signUp) {
      router.replace("/(root)/(tabs)/home");
      return;
    }
    try {
      await signUp.create({ emailAddress: form.email, password: form.password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerification({ ...verification, state: "pending" });
    } catch (err: any) {
      Alert.alert("Erreur", err.errors?.[0]?.longMessage || "Échec d'inscription");
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) return;
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verification.code,
      });
      if (completeSignUp.status === "complete") {
        await fetchAPI("/(api)/user", {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            clerkId: completeSignUp.createdUserId,
            role,
          }),
        });
        await setActive({ session: completeSignUp.createdSessionId });
        setVerification({ ...verification, state: "success" });
      } else {
        setVerification({ ...verification, error: "Échec de vérification.", state: "failed" });
      }
    } catch (err: any) {
      setVerification({ ...verification, error: err.errors?.[0]?.longMessage || "Erreur", state: "failed" });
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
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
            onPress={() => setForm({ ...form, gender: "MALE" } as any)}
            style={[
              styles.roleBtn,
              (form as any).gender !== "FEMALE" && (form as any).gender !== "OTHER" && styles.roleBtnActive,
            ]}
          >
            <Text
              style={[
                styles.roleBtnText,
                (form as any).gender !== "FEMALE" && (form as any).gender !== "OTHER" && styles.roleBtnTextActive,
              ]}
            >
              Homme
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setForm({ ...form, gender: "FEMALE" } as any)}
            style={[
              styles.roleBtn,
              (form as any).gender === "FEMALE" && styles.roleBtnActive,
            ]}
          >
            <Text
              style={[
                styles.roleBtnText,
                (form as any).gender === "FEMALE" && styles.roleBtnTextActive,
              ]}
            >
              Femme
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setForm({ ...form, gender: "OTHER" } as any)}
            style={[
              styles.roleBtn,
              (form as any).gender === "OTHER" && styles.roleBtnActive,
            ]}
          >
            <Text
              style={[
                styles.roleBtnText,
                (form as any).gender === "OTHER" && styles.roleBtnTextActive,
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
          placeholder="Minimum 8 caractères"
          icon={icons.lock}
          secureTextEntry
          textContentType="password"
          value={form.password}
          onChangeText={(v: string) => setForm({ ...form, password: v })}
        />

        <View style={{ marginTop: 20 }}>
          <CustomButton
            title={isLoaded ? "S'inscrire" : "Continuer en démo"}
            onPress={onSignUpPress}
          />
        </View>

        <OAuth />

        <Link href="/sign-in" style={styles.linkRow}>
          <Text style={styles.linkGray}>Déjà un compte ? </Text>
          <Text style={styles.linkBlue}>Se connecter</Text>
        </Link>
      </View>

      {/* Verification modal */}
      <ReactNativeModal
        isVisible={verification.state === "pending"}
        onModalHide={() => {
          if (verification.state === "success") setShowSuccessModal(true);
        }}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Vérification Email</Text>
          <Text style={styles.modalSub}>
            Code envoyé à {form.email}
          </Text>
          <InputField
            label="Code"
            icon={icons.lock}
            placeholder="123456"
            value={verification.code}
            keyboardType="numeric"
            onChangeText={(code: string) =>
              setVerification({ ...verification, code })
            }
          />
          {verification.error ? (
            <Text style={styles.errorText}>{verification.error}</Text>
          ) : null}
          <View style={{ marginTop: 16 }}>
            <CustomButton
              title="Valider l'Email"
              onPress={onPressVerify}
              bgVariant="success"
            />
          </View>
        </View>
      </ReactNativeModal>

      {/* Success modal */}
      <ReactNativeModal isVisible={showSuccessModal}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>✅ Compte Vérifié</Text>
          <Text style={styles.modalSub}>
            Votre compte VORA a été créé avec succès.
          </Text>
          <View style={{ marginTop: 20 }}>
            <CustomButton
              title={role === "DRIVER" ? "Configurer mon Véhicule" : "Découvrir VORA"}
              onPress={() => {
                if (role === "DRIVER") {
                  router.push("/(auth)/driver-register" as any);
                } else {
                  router.push("/(root)/(tabs)/home");
                }
              }}
            />
          </View>
        </View>
      </ReactNativeModal>
    </ScrollView>
  );
};

export default SignUp;

// ─── Styles ───────────────────────────────────────────────────────────────────
const PRIMARY = "#0EA5E9";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  // Header
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Role selector
  roleRow: {
    flexDirection: "row",
    backgroundColor: "#f0f9ff",
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
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
    textAlign: "center",
    flexDirection: "row",
    justifyContent: "center",
  } as any,
  linkGray: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
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
