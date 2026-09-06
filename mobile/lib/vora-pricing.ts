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
    capacity: 1,
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
export function calculateVoraRidesFare(
  distanceKm: number,
  durationMin: number,
  luggageCount: number = 0,
  passengerCount: number = 1,
  customDate?: Date
): Record<"moto" | "taxi" | "confort", PricingDetail> {
  const peak = getVoraPricingMultiplier(customDate);
  const luggageFare = luggageCount * 300;

  const calculateForType = (
    type: "moto" | "taxi" | "confort"
  ): PricingDetail => {
    const rate = VORA_VEHICLE_RATES[type];
    const rawFare = rate.baseFare + distanceKm * rate.perKm + durationMin * rate.perMin + luggageFare;
    const multipliedFare = rawFare * peak.multiplier;
    const finalFare = Math.max(rate.baseFare, roundToNearest50(multipliedFare));

    return {
      vehicleType: type,
      label: rate.label,
      baseFare: rate.baseFare,
      distanceKm,
      durationMin,
      luggageFare,
      fareBeforeMultiplier: Math.round(rawFare),
      multiplier: peak.multiplier,
      multiplierReason: peak.label,
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

