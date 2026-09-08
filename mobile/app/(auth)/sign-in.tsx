import { Link, router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import OAuth from "@/components/OAuth";
import { icons, images } from "@/constants";
import { useClerkAuth, useClerkUser } from "@/lib/useClerkSafe";
import { tryAdminLogin } from "@/lib/adminAuth";
import { getBackendUrl } from "@/lib/config";

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

  // Detect existing session to allow account switching
  const { isSignedIn, signOut } = useClerkAuth();
  const { user } = useClerkUser();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
      // Clear any cached tokens from SecureStore / localStorage
      if (typeof window !== "undefined" && window.localStorage) {
        Object.keys(window.localStorage).forEach((k) => {
          if (k.includes("clerk") || k.includes("__clerk")) {
            window.localStorage.removeItem(k);
          }
        });
        window.location.reload();
      }
    } catch (e) {
      console.warn("Sign-out error:", e);
    } finally {
      setSigningOut(false);
    }
  }, [signOut]);

  const [role, setRole] = useState<"PASSENGER" | "DRIVER">("PASSENGER");
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const onSignInPress = useCallback(async () => {
    const emailTrimmed = form.email.trim();
    const passwordTrimmed = form.password;

    const newErrors: { email?: string; password?: string; general?: string } = {};
    if (!emailTrimmed) {
      newErrors.email = "Veuillez entrer votre adresse email.";
    } else if (!emailTrimmed.includes("@") || !emailTrimmed.includes(".")) {
      newErrors.email = "Veuillez entrer un email valide (ex: contact@domaine.cm).";
    }
    if (!passwordTrimmed) {
      newErrors.password = "Veuillez entrer votre mot de passe.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Alert.alert("Champs incomplets", "Veuillez corriger les champs indiqués en rouge avant de vous connecter.");
      return;
    }

    setErrors({});
    setSubmitting(true);

    // 1. Check if entered credentials match system administrator (only if not Chauffeur role)
    if (role !== "DRIVER") {
      try {
        const adminResult = await tryAdminLogin(emailTrimmed, passwordTrimmed);
        if (adminResult.success) {
          setSubmitting(false);
          router.replace("/(admin)/dashboard" as any);
          return;
        }
        if (adminResult.isAdmin) {
          // Admin email recognized but password was incorrect
          setSubmitting(false);
          const errMsg = adminResult.error || "Mot de passe administrateur incorrect.";
          setErrors({ general: errMsg });
          Alert.alert("Accès Administrateur", errMsg);
          return;
        }
      } catch (e) {
        // Backend unreachable or error: continue to regular Clerk flow
      }
    }

    // 0. Purger toute session résiduelle : une déconnexion faite dans un
    //    autre onglet (ou un signOut qui a échoué) laisse une session
    //    active côté Clerk, et tout nouveau signIn.create échoue alors
    //    avec « You're already signed in ».
    try {
      await signOut();
    } catch {
      // Aucune session active — on continue simplement.
    }

    if (!isLoaded || !signIn) {
      setSubmitting(false);
      setErrors({ general: "Le service d'authentification n'est pas encore prêt." });
      Alert.alert("Service indisponible", "Le service d'authentification n'est pas encore prêt.");
      return;
    }

    // 2. Driver Ticket Auth (Réservé au compte Chauffeur de test pour contourner le 2FA d'évaluation)
    if (role === "DRIVER" && emailTrimmed.toLowerCase() === "driver@vora.cm") {
      try {
        const backendUrl = getBackendUrl();
        const ticketRes = await fetch(`${backendUrl}/api/drivers/auth-ticket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailTrimmed, password: passwordTrimmed }),
        });
        const ticketData = await ticketRes.json();
        if (ticketRes.ok && ticketData.success && ticketData.ticket) {
          const attempt = await signIn.create({
            strategy: "ticket",
            ticket: ticketData.ticket,
          });
          if (attempt.status === "complete") {
            await setActive({ session: attempt.createdSessionId });
            setSubmitting(false);
            router.replace("/(driver)/dashboard" as any);
            return;
          }
        } else if (!ticketRes.ok) {
          // Ticket refusé (ex. identifiants de test incorrects) — on signale
          // au lieu de tomber silencieusement sur le flux standard qui peut
          // buter sur le 2FA.
          const msg =
            ticketData?.error ||
            "Ticket chauffeur refusé. Vérifiez vos identifiants de test.";
          setErrors({ general: msg });
          Alert.alert("Connexion chauffeur", msg);
          setSubmitting(false);
          return;
        }
      } catch (e) {
        console.warn("Driver ticket auth fallback to standard sign-in:", e);
      }
    }

    // 3. Regular user / standard Clerk sign-in
    const targetRoute =
      role === "DRIVER" ? "/(driver)/dashboard" : "/(root)/(tabs)/home";

    try {
      const attempt = await signIn.create({
        identifier: emailTrimmed,
        password: passwordTrimmed,
      });
      if (attempt.status === "complete") {
        await setActive({ session: attempt.createdSessionId });
        router.replace(targetRoute as any);
      } else {
        const msg = "Connexion non finalisée. Statut: " + attempt.status;
        setErrors({ general: msg });
        Alert.alert("Erreur de connexion", msg);
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      const rawMsg =
        err?.errors?.[0]?.longMessage || err?.message || "";

      // Session résiduelle détectée côté serveur : purge puis un seul essai de plus
      if (rawMsg.toLowerCase().includes("already signed in")) {
        try {
          await signOut();
          const retry = await signIn.create({
            identifier: emailTrimmed,
            password: passwordTrimmed,
          });
          if (retry.status === "complete") {
            await setActive({ session: retry.createdSessionId });
            router.replace(targetRoute as any);
            return;
          }
        } catch {
          // Le nouvel essai a échoué — message générique ci-dessous.
        }
      }

      const errMsg =
        rawMsg ||
        "Identifiants incorrects. Veuillez vérifier votre email et mot de passe.";
      setErrors({ general: errMsg });
      Alert.alert("Échec de connexion", errMsg);
    } finally {
      setSubmitting(false);
    }
  }, [isLoaded, form, role, signIn, setActive, signOut]);

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
              <View style={styles.heroOverlay}>
                <Text style={styles.heroTitle}>Bienvenue sur VORA</Text>
                <Text style={styles.heroSub}>Connectez-vous à votre compte</Text>
              </View>
            </View>

            {/* Bannière de session active — permet de changer de compte */}
            {isSignedIn && user && (
              <View style={styles.sessionBanner}>
                <View style={styles.sessionBannerInfo}>
                  <Text style={styles.sessionBannerTitle}>Session active</Text>
                  <Text style={styles.sessionBannerSub} numberOfLines={1}>
                    {user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "Compte connecté"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleSignOut}
                  style={styles.sessionBannerBtn}
                  disabled={signingOut}
                >
                  {signingOut
                    ? <ActivityIndicator size="small" color="#ffffff" />
                    : <Text style={styles.sessionBannerBtnText}>Changer</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

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

            {!!errors.general && (
              <View style={styles.generalErrorBanner}>
                <Ionicons name="alert-circle" size={20} color="#dc2626" style={{ marginRight: 8 }} />
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            )}

            <InputField
              label="Email"
              placeholder="Votre adresse email"
              icon={icons.email}
              textContentType="emailAddress"
              autoCapitalize="none"
              value={form.email}
              error={errors.email}
              onChangeText={(v) => {
                setForm({ ...form, email: v });
                if (errors.email || errors.general) {
                  setErrors({ ...errors, email: undefined, general: undefined });
                }
              }}
            />
            <InputField
              label="Mot de passe"
              placeholder="Votre mot de passe"
              icon={icons.lock}
              secureTextEntry
              textContentType="password"
              value={form.password}
              error={errors.password}
              onChangeText={(v) => {
                setForm({ ...form, password: v });
                if (errors.password || errors.general) {
                  setErrors({ ...errors, password: undefined, general: undefined });
                }
              }}
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
  generalErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#F87171",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  generalErrorText: {
    flex: 1,
    fontSize: 13,
    color: "#B91C1C",
    fontWeight: "600",
    fontFamily: "Jakarta-SemiBold",
  },
  sessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderBottomWidth: 1,
    borderBottomColor: "#FED7AA",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  sessionBannerInfo: {
    flex: 1,
  },
  sessionBannerTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionBannerSub: {
    fontSize: 13,
    color: "#B45309",
    fontWeight: "600",
    marginTop: 1,
  },
  sessionBannerBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 72,
    alignItems: "center",
  },
  sessionBannerBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
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
