/**
 * VORA Geofencing & Intra-City Transport Rule
 * 
 * Règle stricte VORA : Une course ne peut JAMAIS sortir de la ville où elle a été prise.
 * S'applique à TOUTES les villes du Cameroun (Yaoundé, Douala, Bafoussam, Garoua, etc.).
 */

const CAMEROON_CITIES = [
  "Yaoundé",
  "Yaounde",
  "Douala",
  "Bafoussam",
  "Bamenda",
  "Garoua",
  "Maroua",
  "Kribi",
  "Limbe",
  "Buea",
  "Bertoua",
  "Ngaoundéré",
  "Ngaoundere",
  "Ebolowa",
  "Dschang",
  "Kumba",
  "Foumban",
  "Edéa",
  "Edea",
  "Mbalmayo",
  "Bafia",
];

// Distance Haversine en km
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

function detectCityFromText(text: string): string | null {
  if (!text) return null;
  const clean = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const city of CAMEROON_CITIES) {
    const cleanCity = city
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (clean.includes(cleanCity)) {
      return city;
    }
  }
  return null;
}

export interface GeofenceValidation {
  isValid: boolean;
  distanceKm: number;
  originCity?: string | null;
  destCity?: string | null;
  error?: string;
}

// Rayon urbain maximal autorisé au Cameroun (28 km)
const MAX_URBAN_RADIUS_KM = 28.0;

export function validateIntraCityRide(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  originAddress: string = "",
  destAddress: string = ""
): GeofenceValidation {
  const dist = calculateDistanceKm(originLat, originLng, destLat, destLng);
  const cityOrigin = detectCityFromText(originAddress);
  const cityDest = detectCityFromText(destAddress);

  // 1. Vérification par comparaison explicite des villes déclarées
  if (cityOrigin && cityDest && cityOrigin.toLowerCase() !== cityDest.toLowerCase()) {
    return {
      isValid: false,
      distanceKm: dist,
      originCity: cityOrigin,
      destCity: cityDest,
      error: `Course interurbaine non autorisée : Le départ est à ${cityOrigin} et l'arrivée à ${cityDest}. Les courses VORA sont strictement réservées aux trajets intra-urbains au sein de la même ville.`,
    };
  }

  // 2. Vérification par distance kilométrique (sortie du périmètre urbain)
  if (dist > MAX_URBAN_RADIUS_KM) {
    return {
      isValid: false,
      distanceKm: dist,
      originCity: cityOrigin,
      destCity: cityDest,
      error: `Trajet hors périmètre urbain : La distance de ce trajet (${dist} km) dépasse le périmètre maximal d'une course urbaine (max ${MAX_URBAN_RADIUS_KM} km). VORA ne dessert pas les courses interurbaines.`,
    };
  }

  return {
    isValid: true,
    distanceKm: dist,
    originCity: cityOrigin,
    destCity: cityDest,
  };
}

export const validateIntraCity = validateIntraCityRide;

