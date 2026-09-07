export interface PricingDetail {
  vehicleType: "moto" | "taxi" | "confort";
  label: string;
  baseFare: number; // en FCFA
  distanceKm: number;
  durationMin: number;
  luggageFare: number;
  fareBeforeMultiplier: number;
  multiplier: number;
  multiplierReason: string;
  finalFare: number; // arrondi au 50 FCFA le plus proche
  capacity: number;
  icon: string;
}

/**
 * Valide les règles de capacité spécifiques à la MOTO (Bendskin).
 * - Max 1 passager si bagages ≥ 1
 * - Max 2 passagers si aucun bagage
 * Retourne null si OK, sinon un message d'erreur.
 */
export function validateMotoCapacity(passengerCount: number, luggageCount: number): string | null {
  if (luggageCount >= 1 && passengerCount > 1) {
    return "La MOTO (Bendskin) ne peut transporter qu'un seul passager lorsqu'il y a des bagages.";
  }
  if (passengerCount > 2) {
    return "La MOTO (Bendskin) peut transporter au maximum 2 passagers sans bagages.";
  }
  return null;
}

export interface PeakPricingStatus {
  multiplier: number;
  label: string;
  isPeak: boolean;
}

/**
 * Calcule le multiplicateur d'heure de pointe pour le Cameroun
 */
export function getVoraPricingMultiplier(date = new Date()): PeakPricingStatus {
  const hour = date.getHours();

  // Heure de pointe du matin : 6h30 à 9h00
  if (hour >= 6 && hour < 9) {
    return {
      multiplier: 1.4,
      label: "Pointe Matin (+40%)",
      isPeak: true,
    };
  }
  // Pause midi : 12h00 à 14h00
  if (hour >= 12 && hour < 14) {
    return {
      multiplier: 1.2,
      label: "Heure Déjeuner (+20%)",
      isPeak: true,
    };
  }
  // Heure de pointe du soir : 17h00 à 20h00
  if (hour >= 17 && hour < 20) {
    return {
      multiplier: 1.5,
      label: "Pointe Soir (+50%)",
      isPeak: true,
    };
  }
  // Nuit : 22h00 à 5h00 (sécurité nuit)
  if (hour >= 22 || hour < 5) {
    return {
      multiplier: 1.3,
      label: "Tarif Nuit (+30%)",
      isPeak: true,
    };
  }

  return {
    multiplier: 1.0,
    label: "Tarif Standard",
    isPeak: false,
  };
}

export const VORA_VEHICLE_RATES = {
  moto: {
    label: "VORA Moto (Bendskin)",
    baseFare: 500,
    perKm: 150,
    perMin: 10,
    capacity: 2, // 2 max sans bagages, 1 max avec bagages
    icon: "bike",
  },
  taxi: {
    label: "VORA Taxi Classique",
    baseFare: 1000,
    perKm: 250,
    perMin: 20,
    capacity: 4,
    icon: "car",
  },
  confort: {
    label: "VORA Berline Confort (Climatisé)",
    baseFare: 2000,
    perKm: 400,
    perMin: 35,
    capacity: 4,
    icon: "shield-checkmark",
  },
};

/**
 * Rond à la tranche de 50 FCFA supérieure (ex: 730 -> 750)
 */
function roundToNearest50(amount: number): number {
  return Math.ceil(amount / 50) * 50;
}

/**
 * Calcule le prix estimé d'une course pour tous les types de véhicules avec frais de bagages
 */
/**
 * Vérifie si la tarification nuit moto s'applique (après 18h)
 * Règle : les tarifs moto DOUBLENT après 18h00
 */
export function getMotoNightMultiplier(date = new Date()): { multiplier: number; reason: string } {
  const hour = date.getHours();
  // Tarif nuit moto : de 18h00 à 05h59 (le lendemain)
  if (hour >= 18 || hour < 6) {
    return { multiplier: 2.0, reason: "Tarif Nuit Moto (x2 après 18h)" };
  }
  return { multiplier: 1.0, reason: "" };
}

export function calculateVoraRidesFare(
  distanceKm: number,
  durationMin: number,
  luggageCount: number = 0,
  passengerCount: number = 1,
  customDate?: Date
): Record<"moto" | "taxi" | "confort", PricingDetail> {
  const now = customDate || new Date();
  const peak = getVoraPricingMultiplier(now);
  const motoNight = getMotoNightMultiplier(now);
  const luggageFare = luggageCount * 300;

  const calculateForType = (
    type: "moto" | "taxi" | "confort"
  ): PricingDetail => {
    const rate = VORA_VEHICLE_RATES[type];
    const rawFare = rate.baseFare + distanceKm * rate.perKm + durationMin * rate.perMin + luggageFare;

    // Pour MOTO : multiplier de pointe × multiplicateur nuit moto (x2 après 18h)
    let effectiveMultiplier = peak.multiplier;
    let multiplierReason = peak.label;
    if (type === "moto" && motoNight.multiplier > 1.0) {
      effectiveMultiplier = effectiveMultiplier * motoNight.multiplier;
      multiplierReason = motoNight.reason + (peak.isPeak ? ` + ${peak.label}` : "");
    }

    const multipliedFare = rawFare * effectiveMultiplier;
    const finalFare = Math.max(rate.baseFare, roundToNearest50(multipliedFare));

    return {
      vehicleType: type,
      label: rate.label,
      baseFare: rate.baseFare,
      distanceKm,
      durationMin,
      luggageFare,
      fareBeforeMultiplier: Math.round(rawFare),
      multiplier: effectiveMultiplier,
      multiplierReason,
      finalFare,
      capacity: rate.capacity,
      icon: rate.icon,
    };
  };

  return {
    moto: calculateForType("moto"),
    taxi: calculateForType("taxi"),
    confort: calculateForType("confort"),
  };
}

