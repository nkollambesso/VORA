import { Link, router } from "expo-router";
import React, { useCallback, useState } from "react";
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

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import OAuth from "@/components/OAuth";
import { icons, images } from "@/constants";

// Lazy-load Clerk hook only when context is available
let _useSignIn: any = null;
try {
  _useSignIn = require("@clerk/clerk-expo").useSignIn;
} catch {}

const SignIn = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  let signInHook: any = { signIn: null, setActive: null, isLoaded: false };
  try {
    if (_useSignIn) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      signInHook = _useSignIn();
    }
  } catch {}
  const { signIn, setActive, isLoaded } = signInHook;

  const [role, setRole] = useState<"PASSENGER" | "DRIVER">("PASSENGER");
  const [form, setForm] = useState({ email: "", password: "" });

  const onSignInPress = useCallback(async () => {
    if (!form.email.trim() || !form.password.trim()) {
      Alert.alert("Champs requis", "Veuillez entrer votre adresse email et votre mot de passe.");
      return;
    }

    const targetRoute =
      role === "DRIVER" ? "/(driver)/dashboard" : "/(root)/(tabs)/home";

    if (!isLoaded || !signIn) {
      Alert.alert("Service indisponible", "Le service d'authentification n'est pas encore prêt.");
      return;
    }
    try {
      const attempt = await signIn.create({
        identifier: form.email.trim(),
        password: form.password,
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace(targetRoute as any);
      } else {
        Alert.alert("Erreur de connexion", "Connexion non finalisée. Statut: " + attempt.status);
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      Alert.alert(
        "Échec de connexion",
        err?.errors?.[0]?.longMessage || err?.message || "Identifiants incorrects. Veuillez vérifier votre email et mot de passe."
      );
    }
  }, [isLoaded, form, role, signIn, setActive]);

  return (
    <View style={isWide ? styles.rootWide : styles.rootMobile}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={isWide ? styles.scrollContentWide : styles.scrollContentMobile}
      >
        <View style={isWide ? styles.cardWide : styles.cardMobile}>
          {/* Hero banner */}
          <View style={styles.hero}>
            <Image
              source={images.signUpCar}
              style={styles.heroImg}
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/welcome")}
              style={styles.backBtnFloating}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnFloatingText}>← Accueil</Text>
            </TouchableOpacity>
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>Bienvenue sur VORA</Text>
              <Text style={styles.heroSub}>Connectez-vous à votre compte</Text>
            </View>
          </View>

          <View style={styles.body}>
            {/* Role Selector */}
            <Text style={styles.sectionLabel}>Connexion en tant que :</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                onPress={() => setRole("PASSENGER")}
                style={[
                  styles.roleBtn,
                  role === "PASSENGER" && styles.roleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    role === "PASSENGER" && styles.roleBtnTextActive,
                  ]}
                >
                  Passager
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRole("DRIVER")}
                style={[
                  styles.roleBtn,
                  role === "DRIVER" && styles.roleBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    role === "DRIVER" && styles.roleBtnTextActive,
                  ]}
                >
                  Chauffeur
                </Text>
              </TouchableOpacity>
            </View>

            <InputField
              label="Email"
              placeholder="Votre adresse email"
              icon={icons.email}
              textContentType="emailAddress"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => setForm({ ...form, email: v })}
            />
            <InputField
              label="Mot de passe"
              placeholder="Votre mot de passe"
              icon={icons.lock}
              secureTextEntry
              textContentType="password"
              value={form.password}
              onChangeText={(v) => setForm({ ...form, password: v })}
            />

            {/* Clerk Captcha container for Bot Protection on Web */}
            <View nativeID="clerk-captcha" />

            <View style={{ marginTop: 20 }}>
              <CustomButton
                title={
                  role === "DRIVER"
                    ? "Se connecter en Chauffeur"
                    : "Se connecter en Passager"
                }
                onPress={onSignInPress}
              />
            </View>

            <OAuth role={role} />

            <Link href="/sign-up" style={styles.linkRow}>
              <Text style={styles.linkGray}>Pas encore de compte ? </Text>
              <Text style={styles.linkBlue}>S'inscrire</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default SignIn;

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
    maxWidth: 540,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.08)",
    elevation: 6,
  },
  // Hero
  hero: {
    width: "100%",
    height: 200,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#0f172a",
  },
  heroImg: {
    width: "100%",
    height: "100%",
    opacity: 0.75,
  },
  backBtnFloating: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  backBtnFloatingText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  heroOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "500",
    marginTop: 2,
  },
  // Body
  body: {
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
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
});
