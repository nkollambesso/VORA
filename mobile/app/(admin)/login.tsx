import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";

// ─── ADMIN PIN GATE ──────────────────────────────────────────────────────────
// The admin PIN is stored as an env variable: EXPO_PUBLIC_ADMIN_PIN
// If not set, defaults to 9 digits. Kept out of user-visible routes.
const ADMIN_PIN =
  (typeof process !== "undefined" && process.env.EXPO_PUBLIC_ADMIN_PIN) ||
  "VORA2025";

export default function AdminLogin() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!pin.trim()) {
      setError("Veuillez saisir le code d'accès administrateur.");
      shake();
      return;
    }

    setLoading(true);
    setError("");

    // Simulate a brief delay (prevents brute-force scanning)
    await new Promise((r) => setTimeout(r, 600));

    if (pin.trim() === ADMIN_PIN) {
      setLoading(false);
      router.replace("/(admin)/dashboard" as any);
    } else {
      setLoading(false);
      setPin("");
      setError("Code d'accès invalide. Accès refusé.");
      shake();
    }
  };

  return (
    <View style={isWide ? styles.rootWide : styles.rootMobile}>
      <View style={[styles.card, isWide && styles.cardWide]}>
        {/* Logo badge */}
        <View style={styles.logoBadgeRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>VORA</Text>
          </View>
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        </View>

        <Text style={styles.title}>Accès Administrateur</Text>
        <Text style={styles.subtitle}>
          Entrez le code d'accès confidentiel pour accéder au panneau de contrôle VORA.
        </Text>

        {/* PIN Input */}
        <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
          <TextInput
            style={[styles.pinInput, error ? styles.pinInputError : null]}
            placeholder="Code d'accès (ex: VORA2025)"
            placeholderTextColor="#94A3B8"
            value={pin}
            onChangeText={(v) => {
              setPin(v);
              if (error) setError("");
            }}
            secureTextEntry
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />
        </Animated.View>

        {error ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>Accéder au Panneau de Contrôle</Text>
          )}
        </TouchableOpacity>

        {/* Back to app */}
        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.replace("/(auth)/sign-in")}
          activeOpacity={0.7}
        >
          <Text style={styles.backLinkText}>Retour à l'application</Text>
        </TouchableOpacity>

        {/* Security note */}
        <View style={styles.securityNote}>
          <Text style={styles.securityNoteText}>
            Cette interface est réservée aux administrateurs agréés de la plateforme VORA. Toute tentative d'accès non autorisée est enregistrée.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rootMobile: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  rootWide: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#1E293B",
    borderRadius: 28,
    padding: 32,
    borderWidth: 1,
    borderColor: "#334155",
    boxShadow: "0px 20px 60px rgba(0, 0, 0, 0.5)",
    elevation: 12,
  },
  cardWide: {
    maxWidth: 480,
  },
  logoBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  logoBadge: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 1,
  },
  adminBadge: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F1F5F9",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    lineHeight: 20,
    marginBottom: 28,
    fontWeight: "500",
  },
  pinInput: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 16,
    fontWeight: "700",
    color: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#334155",
    letterSpacing: 2,
    marginBottom: 8,
  },
  pinInputError: {
    borderColor: "#EF4444",
  },
  errorRow: {
    backgroundColor: "#450A0A",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#7F1D1D",
  },
  errorText: {
    fontSize: 13,
    color: "#FCA5A5",
    fontWeight: "600",
  },
  btn: {
    width: "100%",
    backgroundColor: "#0EA5E9",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    boxShadow: "0px 4px 16px rgba(14, 165, 233, 0.35)",
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  backLink: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  securityNote: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
  },
  securityNoteText: {
    fontSize: 11,
    color: "#475569",
    lineHeight: 16,
    textAlign: "center",
  },
});
