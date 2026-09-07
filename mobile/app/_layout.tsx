import { ClerkProvider } from "@clerk/clerk-expo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { LogBox, Platform, View, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { tokenCache } from "@/lib/auth";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {});

const publishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "pk_test_c3RpcnJpbmctZHJha2UtNTI1MC5jbGVyay5hY2NvdW50cy5kZXYk";

if (typeof window !== "undefined" && window.localStorage) {
  try {
    const currentSavedKey = window.localStorage.getItem("vora_clerk_pub_key");
    if (!currentSavedKey || currentSavedKey !== publishableKey) {
      Object.keys(window.localStorage).forEach((k) => {
        if (k.includes("clerk") || k.includes("__clerk")) {
          window.localStorage.removeItem(k);
        }
      });
      // Purge all stale dev browser cookies (__clerk_db_jwt)
      if (document.cookie) {
        document.cookie.split(";").forEach((c) => {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        });
      }
      window.localStorage.setItem("vora_clerk_pub_key", publishableKey);
    }
  } catch (e) {}
}

LogBox.ignoreLogs([
  "Clerk:",
  "shadow*",
  "TouchableOpacity is deprecated",
  "focusable is deprecated",
  "props.pointerEvents is deprecated",
  "[Layout children]: No route named",
  "[Auth] Clerk",
  "This library cannot be used for the web",
]);

const isClerkKeyValid = (key?: string) => {
  if (!key || key.includes("sample") || key.length < 30) return false;
  return key.startsWith("pk_test_") || key.startsWith("pk_live_");
};

export default function RootLayout() {
  const [loaded] = useFonts({
    "Jakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "Jakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "Jakarta-ExtraLight": require("../assets/fonts/PlusJakartaSans-ExtraLight.ttf"),
    "Jakarta-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
    "Jakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    Jakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(root)" options={{ headerShown: false }} />
      <Stack.Screen name="(driver)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );

  const content = isClerkKeyValid(publishableKey) ? (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      {stack}
    </ClerkProvider>
  ) : (
    stack
  );

  if (Platform.OS === "web") {
    return (
      <SafeAreaProvider>
        <View style={styles.webContainer}>
          <View style={styles.webAppFrame}>{content}</View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>{content}</View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    width: "100%",
  },
  webAppFrame: {
    flex: 1,
    width: "100%",
    backgroundColor: "#ffffff",
  },
});
