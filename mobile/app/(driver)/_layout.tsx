import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useClerkAuth, useClerkUser } from "@/lib/useClerkSafe";

export default function DriverLayout() {
  const { isSignedIn, isLoaded: authLoaded } = useClerkAuth();
  const { user, isLoaded: userLoaded } = useClerkUser();

  // Attente du chargement de l'état d'authentification
  if (!authLoaded || !userLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  // Protection stricte de navigation : redirection si non inscrit / non connecté
  if (!isSignedIn && !user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="ride-request" options={{ headerShown: false, presentation: "transparentModal" }} />
      <Stack.Screen name="navigation" options={{ headerShown: false }} />
      <Stack.Screen name="earnings" options={{ headerShown: false }} />
    </Stack>
  );
}

