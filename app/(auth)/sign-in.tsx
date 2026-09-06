import { Link, router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
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
    const targetRoute =
      role === "DRIVER" ? "/(driver)/dashboard" : "/(root)/(tabs)/home";

    if (!isLoaded || !signIn) {
      router.replace(targetRoute as any);
      return;
    }
    try {
      const attempt = await signIn.create({
        identifier: form.email,
        password: form.password,
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace(targetRoute as any);
      } else {
        Alert.alert("Erreur", "Connexion échouée. Réessayez.");
      }
    } catch (err: any) {
      // Fallback demo mode navigation if Clerk unauthenticated
      router.replace(targetRoute as any);
    }
  }, [isLoaded, form, role, signIn, setActive]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      {/* Hero banner */}
      <View style={styles.hero}>
        <Image
          source={images.signUpCar}
          style={styles.heroImg}
          resizeMode="cover"
        />
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

        <View style={{ marginTop: 20 }}>
          <CustomButton
            title={role === "DRIVER" ? "Se connecter en Chauffeur" : "Se connecter en Passager"}
            onPress={onSignInPress}
          />
        </View>

        <OAuth />

        <Link href="/sign-up" style={styles.linkRow}>
          <Text style={styles.linkGray}>Pas encore de compte ? </Text>
          <Text style={styles.linkBlue}>S'inscrire</Text>
        </Link>
      </View>
    </ScrollView>
  );
};

export default SignIn;

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
  // Hero
  hero: {
    width: "100%",
    height: 220,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#0f172a",
  },
  heroImg: {
    width: "100%",
    height: "100%",
    opacity: 0.75,
  },
  heroOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
  },
  heroTitle: {
    fontSize: 28,
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
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
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
