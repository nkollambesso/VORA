export interface PaymentRequest {
  amount: number; // FCFA
  phone: string; // Numéro Mobile Money (MTN / Orange)
  operator: "mtn" | "orange" | "cash";
  rideId: string;
  description?: string;
}

export interface PaymentResponse {
  success: boolean;
  mode?: "simulation" | "live";
  transactionId?: string;
  operator?: string;
  amount?: number;
  phone?: string;
  message?: string;
  error?: string;
}

/**
 * Traite le paiement VORA via l'API backend CamerPay (Mode Réel ou Mode Simulation activé en Super Admin)
 */
export async function processCamerPayPayment(
  payload: PaymentRequest
): Promise<PaymentResponse> {
  // Cas paiement en espèces direct
  if (payload.operator === "cash") {
    return {
      success: true,
      mode: "live",
      transactionId: `CASH-${Date.now()}`,
      operator: "cash",
      amount: payload.amount,
      phone: payload.phone,
      message: "Paiement en espèces sélectionné. Le règlement s'effectuera auprès du chauffeur.",
    };
  }

  try {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";
    const response = await fetch(`${backendUrl}/api/camerpay/pay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data: PaymentResponse = await response.json();
    return data;
  } catch (error: any) {
    console.error("Erreur appel CamerPay:", error);
    return {
      success: false,
      error: error.message || "Impossible de contacter la passerelle de paiement CamerPay.",
    };
  }
}

/**
 * Obtenir l'état du mode simulation depuis le backend
 */
export async function fetchCamerPayMode(): Promise<{ isSimulation: boolean }> {
  try {
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";
    const res = await fetch(`${backendUrl}/api/camerpay/mode`);
    const data = await res.json();
    return { isSimulation: data.isSimulation ?? true };
  } catch {
    return { isSimulation: true };
  }
}
