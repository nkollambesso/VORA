import { Redirect, Stack, useSegments } from "expo-router";
import React from "react";
import { useClerkAuth, useClerkUser } from "@/lib/useClerkSafe";

const Layout = () => {
  const { isSignedIn } = useClerkAuth();
  const { user } = useClerkUser();
  const segments = useSegments();

  // Determine the current auth sub-route (welcome, sign-in, sign-up)
  const currentScreen = segments[segments.length - 1];

  // If already signed in, only auto-redirect from the welcome screen.
  // On sign-in and sign-up pages, let the user proceed so they can explicitly
  // sign out and switch to a different account (e.g., passenger → driver).
  if (isSignedIn && user && currentScreen === "welcome") {
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
