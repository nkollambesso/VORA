import { Stack } from "expo-router";

export default function DriverLayout() {
  return (
    <Stack>
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="ride-request" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="navigation" options={{ headerShown: false }} />
      <Stack.Screen name="earnings" options={{ headerShown: false }} />
    </Stack>
  );
}
