import React from "react";
import { Platform, View } from "react-native";

let StripeProviderComponent: React.ComponentType<any> = ({ children }: any) => (
  <View style={{ flex: 1 }}>{children}</View>
);

let useStripeHook: any = () => ({
  initPaymentSheet: async () => ({ error: null }),
  presentPaymentSheet: async () => ({ error: null }),
});

if (Platform.OS !== "web") {
  try {
    const Stripe = require("@stripe/stripe-react-native");
    StripeProviderComponent = Stripe.StripeProvider;
    useStripeHook = Stripe.useStripe;
  } catch (e) {
    console.warn("Stripe native module not loaded:", e);
  }
}

export const StripeProvider = StripeProviderComponent;
export const useStripe = useStripeHook;
