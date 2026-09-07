import { router } from "expo-router";
import Constants from "expo-constants";
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { icons } from "@/constants";

// Lazy-load Clerk OAuth hook
let _useOAuth: any = null;
try { _useOAuth = require("@clerk/clerk-expo").useOAuth; } catch {}
let _googleOAuth: any = null;
try { _googleOAuth = require("@/lib/auth").googleOAuth; } catch {}

// Detect if running inside Expo Go (OAuth won't work there)
const isExpoGo = Constants.appOwnership === "expo";

interface OAuthProps {
  role?: "PASSENGER" | "DRIVER";
}

const OAuth = ({ role = "PASSENGER" }: OAuthProps) => {
  let startOAuthFlow: any = null;
  try {
    if (_useOAuth) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      startOAuthFlow = _useOAuth({ strategy: "oauth_google" }).startOAuthFlow;
    }
  } catch {}

  const handleGoogleSignIn = async () => {
    // Google OAuth does NOT work in Expo Go — requires a custom dev build
    if (isExpoGo) {
      Alert.alert(
        "⚠️ Expo Go — Google OAuth indisponible",
        "La connexion Google ne fonctionne pas dans Expo Go.\n\nUtilisez email + mot de passe, ou faites un build de développement (expo run:android / expo run:ios).",
        [{ text: "Compris", style: "default" }]
      );
      return;
    }

    try {
      if (startOAuthFlow && _googleOAuth) {
        const result = await _googleOAuth(startOAuthFlow, role);
        if (result && (result.code === "success" || result.code === "session_exists" || result.success)) {
          const target = result.targetRoute || (role === "DRIVER" ? "/(driver)/dashboard" : "/(root)/(tabs)/home");
          router.replace(target as any);
          return;
        } else {
          Alert.alert("Connexion Google", result?.message || "La connexion avec Google a échoué. Assurez-vous que l'option Google SSO est activée.");
          return;
        }
      }
      Alert.alert("Google OAuth", "Le service d'authentification Google n'est pas disponible actuellement.");
    } catch (e: any) {
      console.warn("Google OAuth notice:", e);
      Alert.alert("Erreur Google OAuth", e?.message || "Une erreur est survenue lors de la connexion Google.");
    }
  };


  return (
    <View style={styles.root}>
      {/* ── Divider "Ou" ── */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Ou</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* ── Google button ── */}
      <TouchableOpacity
        onPress={handleGoogleSignIn}
        style={styles.googleBtn}
        activeOpacity={0.8}
      >
        <Image
          source={icons.google}
          style={styles.googleIcon}
          resizeMode="contain"
        />
        <Text style={styles.googleText}>Continuer avec Google</Text>
      </TouchableOpacity>
    </View>
  );
};

export default OAuth;

const styles = StyleSheet.create({
  root: {
    width: "100%",
    marginTop: 16,
  },
  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "600",
    paddingHorizontal: 4,
  },
  // Google button
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#ffffff",
    gap: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
});
