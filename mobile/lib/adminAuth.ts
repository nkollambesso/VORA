import { getBackendUrl } from "@/lib/config";

const ADMIN_TOKEN_KEY = "vora_admin_token";

/**
 * Persist the admin session token.
 * Uses window.localStorage on web, or expo-secure-store / in-memory fallback on native.
 */
export async function saveAdminToken(token: string): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
      return;
    }
    const SecureStore = require("expo-secure-store");
    await SecureStore.setItemAsync(ADMIN_TOKEN_KEY, token);
  } catch (e) {
    console.warn("[AdminAuth] Could not save token to secure storage:", e);
  }
}

/**
 * Retrieve the active admin session token.
 */
export async function getAdminToken(): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(ADMIN_TOKEN_KEY);
    }
    const SecureStore = require("expo-secure-store");
    return await SecureStore.getItemAsync(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear the stored admin session token on logout or session expiry.
 */
export async function clearAdminToken(): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(ADMIN_TOKEN_KEY);
      return;
    }
    const SecureStore = require("expo-secure-store");
    await SecureStore.deleteItemAsync(ADMIN_TOKEN_KEY);
  } catch {}
}

/**
 * Attempt admin authentication against backend /api/admin/login.
 * Returns:
 *  - success: true, token: string (if valid admin credentials)
 *  - success: false, isAdmin: true, error: string (if admin email but wrong password)
 *  - success: false, isAdmin: false (if not an admin account - safe to continue normal user login)
 */
export async function tryAdminLogin(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; isAdmin?: boolean; error?: string }> {
  try {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await res.json();

    if (res.ok && data.success && data.token) {
      await saveAdminToken(data.token);
      return { success: true, token: data.token, isAdmin: true };
    }

    return {
      success: false,
      isAdmin: !!data.isAdmin,
      error: data.error || "Identifiants invalides.",
    };
  } catch (err: any) {
    // Network or server unreachable: not an admin match
    return { success: false, isAdmin: false, error: err.message };
  }
}
