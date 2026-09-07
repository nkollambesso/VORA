import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

import { fetchAPI } from "@/lib/fetch";

export const tokenCache = {
  async getToken(key: string) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

export const googleOAuth = async (startOAuthFlow: any, role: string = "PASSENGER") => {
  try {
    const targetRoute =
      role === "DRIVER" ? "/(driver)/dashboard" : "/(root)/(tabs)/home";
    const redirectUrl = Linking.createURL(targetRoute, { scheme: "vora" });

    const { createdSessionId, setActive, signUp } = await startOAuthFlow({
      redirectUrl,
    });

    if (createdSessionId) {
      if (setActive) {
        await setActive({ session: createdSessionId });

        const name =
          `${signUp?.firstName || ""} ${signUp?.lastName || ""}`.trim() ||
          "Utilisateur Google";
        const email = signUp?.emailAddress || "";

        if (signUp?.createdUserId) {
          try {
            const backendUrl =
              process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";
            await fetch(`${backendUrl}/api/users`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: signUp.createdUserId,
                name,
                email,
                role,
              }),
            });
          } catch (syncErr) {
            console.warn("Google sync warning:", syncErr);
          }
        }

        return {
          success: true,
          code: "success",
          targetRoute,
          message: "Connexion Google réussie",
        };
      }
    }

    return {
      success: false,
      message: "Session Google non créée",
    };
  } catch (err: any) {
    console.error("Google OAuth error:", err);
    return {
      success: false,
      code: err?.code,
      message:
        err?.errors?.[0]?.longMessage ||
        err?.message ||
        "Échec de l'authentification Google",
    };
  }
};
