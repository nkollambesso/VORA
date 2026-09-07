import { Redirect, Stack } from "expo-router";
import React from "react";
import { useClerkAuth, useClerkUser } from "@/lib/useClerkSafe";

const Layout = () => {
  const { isSignedIn } = useClerkAuth();
  const { user } = useClerkUser();

  // Si l'utilisateur est déjà authentifié, redirection vers l'accueil
  if (isSignedIn && user) {
    return <Redirect href="/(root)/(tabs)/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
    </Stack>
  );
};

export default Layout;

