/**
 * Module de calcul des tarifs dynamiques VORA
 * Gère les 3 catégories de véhicules, les options passagers/bagages,
 * les tranches horaires (heures de pointe/nuit) et les zones à forte affluence.
 */

export interface PricingOptions {
  distanceKm: number;
  vehicleType: 'moto' | 'taxi' | 'confort';
  passengerCount?: number;
  luggageCount?: number;
  pickupAddress?: string;
  destinationAddress?: string;
  customTime?: Date;
}

export interface PricingResult {
  vehicleType: 'moto' | 'taxi' | 'confort';
  baseFare: number;
  distanceFare: number;
  luggageFare: number;
  surgeMultiplier: number;
  surgeReason: string | null;
  totalFareFCFA: number;
  formattedFare: string;
}

const HIGH_DEMAND_ZONES = [
  'bastos',
  'mokolo',
  'aeroport',
  'airport',
  'bonanjo',
  'akwa',
  'carrefour mokolo',
  'marche central',
  'marché central',
  'centre ville',
];

export function calculateVoraFare(options: PricingOptions): PricingResult {
  const {
    distanceKm,
    vehicleType,
    passengerCount = 1,
    luggageCount = 0,
    pickupAddress = '',
    destinationAddress = '',
    customTime = new Date(),
  } = options;

  // 1. Tarifs de base par catégorie
  let baseFare = 1000;
  let pricePerKm = 250;
  let categoryMultiplier = 1.0;

  if (vehicleType === 'moto') {
    baseFare = 500;
    pricePerKm = 150;
    categoryMultiplier = 0.7;
  } else if (vehicleType === 'confort') {
    baseFare = 2000;
    pricePerKm = 400;
    categoryMultiplier = 1.5;
  } else {
    // taxi standard
    baseFare = 1000;
    pricePerKm = 250;
    categoryMultiplier = 1.0;
  }

  // 2. Coût des bagages (300 FCFA par unité de bagage)
  const luggageFare = luggageCount * 300;

  // 3. Calcul Surge Horaires (Heures de pointe & Nuit)
  const hours = customTime.getHours();
  let timeSurge = 1.0;
  let surgeReason: string | null = null;

  if (hours >= 7 && hours < 9) {
    timeSurge = 1.2;
    surgeReason = 'Heures de pointe du matin (07h-09h)';
  } else if (hours >= 17 && hours < 20) {
    timeSurge = 1.3;
    surgeReason = 'Heures de pointe du soir (17h-20h)';
  } else if (hours >= 22 || hours < 5) {
    timeSurge = 1.25;
    surgeReason = 'Tarif de nuit (22h-05h)';
  }

  // Règle spécifique MOTO : les tarifs doublent après 18h (jusqu'à 6h)
  let motoNightMultiplier = 1.0;
  if (vehicleType === 'moto' && (hours >= 18 || hours < 6)) {
    motoNightMultiplier = 2.0;
    if (!surgeReason) {
      surgeReason = 'Tarif Nuit Moto (x2 après 18h)';
    } else {
      surgeReason += ' + Nuit Moto x2';
    }
  }

  // 4. Calcul Surge Zones à forte demande
  const isHighDemandZone = HIGH_DEMAND_ZONES.some(
    (zone) =>
      pickupAddress.toLowerCase().includes(zone) ||
      destinationAddress.toLowerCase().includes(zone)
  );

  let zoneSurge = 1.0;
  if (isHighDemandZone) {
    zoneSurge = 1.15;
    if (!surgeReason) {
      surgeReason = 'Zone à forte affluence';
    } else {
      surgeReason += ' + Zone à forte affluence';
    }
  }

  // Multiplicateur Surge combiné
  const surgeMultiplier = parseFloat((timeSurge * zoneSurge * motoNightMultiplier).toFixed(2));

  // 5. Coût de la distance
  const distanceFare = Math.round(distanceKm * pricePerKm);

  // 6. Sous-total avant surge
  const rawSubtotal = baseFare + distanceFare + luggageFare;

  // 7. Total final arrondi au multiple de 50 FCFA le plus proche
  let calculatedFare = Math.round(rawSubtotal * categoryMultiplier * surgeMultiplier);
  calculatedFare = Math.ceil(calculatedFare / 50) * 50;

  // Seuil de tarif minimum
  const minFare = vehicleType === 'moto' ? 500 : vehicleType === 'confort' ? 1500 : 800;
  const finalFareFCFA = Math.max(calculatedFare, minFare);

  return {
    vehicleType,
    baseFare,
    distanceFare,
    luggageFare,
    surgeMultiplier,
    surgeReason: surgeMultiplier > 1.0 ? surgeReason : null,
    totalFareFCFA: finalFareFCFA,
    formattedFare: `${finalFareFCFA.toLocaleString('fr-FR')} FCFA`,
  };
}

/**
 * Calcule l'estimation pour les 3 catégories en simultané
 */
export function calculateAllCategories(
  distanceKm: number,
  luggageCount: number = 0,
  passengerCount: number = 1,
  pickupAddress: string = '',
  destinationAddress: string = ''
) {
  const categories: ('moto' | 'taxi' | 'confort')[] = ['moto', 'taxi', 'confort'];
  return categories.map((vType) =>
    calculateVoraFare({
      distanceKm,
      vehicleType: vType,
      luggageCount,
      passengerCount,
      pickupAddress,
      destinationAddress,
    })
  );
}

/**
 * Valide les règles de capacité strictes MOTO (Bendskin) :
 * - Max 1 passager si bagages >= 1
 * - Max 2 passagers sans bagages
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
