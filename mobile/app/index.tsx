import { Redirect } from "expo-router";
import React from "react";

// On web without ClerkProvider, always show welcome screen
const Page = () => {
  return <Redirect href="/(auth)/welcome" />;
};

export default Page;
