import { Redirect, Stack } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useClerkAuth, useClerkUser } from "@/lib/useClerkSafe";

const Layout = () => {
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
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="find-ride" options={{ headerShown: false }} />
      <Stack.Screen name="confirm-ride" options={{ headerShown: false }} />
      <Stack.Screen name="book-ride" options={{ headerShown: false }} />
    </Stack>
  );
};

export default Layout;

