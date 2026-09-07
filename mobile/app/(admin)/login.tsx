import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { router } from "expo-router";

// Re-export token utilities for backward compatibility
export { getAdminToken, clearAdminToken, saveAdminToken } from "@/lib/adminAuth";

/**
 * No separate admin login screen: all roles log in via /(auth)/sign-in.
 * This route automatically redirects to the unified sign-in page.
 */
export default function AdminLoginRedirect() {
  useEffect(() => {
    router.replace("/(auth)/sign-in" as any);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0286FF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
});
