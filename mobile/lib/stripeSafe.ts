import React from "react";
import { Platform } from "react-native";

let StripeProviderComponent: React.ComponentType<any> = ({ children }: any) => <>{children}</>;
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
