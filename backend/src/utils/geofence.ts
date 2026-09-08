/**
 * Backend Geofence Validator - Intra-City Transport Rule
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

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

function detectCity(text: string): string | null {
  if (!text) return null;
  const clean = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const city of CAMEROON_CITIES) {
    const cleanCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (clean.includes(cleanCity)) return city;
  }
  return null;
}

const MAX_URBAN_RADIUS_KM = 28.0;

export function validateIntraCity(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  originAddress: string = "",
  destAddress: string = ""
): { isValid: boolean; error?: string; distanceKm: number } {
  const dist = calculateDistanceKm(originLat, originLng, destLat, destLng);
  const cityOrigin = detectCity(originAddress);
  const cityDest = detectCity(destAddress);

  if (cityOrigin && cityDest && cityOrigin.toLowerCase() !== cityDest.toLowerCase()) {
    return {
      isValid: false,
      distanceKm: dist,
      error: `Course interurbaine non autorisée : Départ à ${cityOrigin} et Arrivée à ${cityDest}. Les courses VORA sont strictement réservées aux déplacements intra-urbains.`,
    };
  }

  if (dist > MAX_URBAN_RADIUS_KM) {
    return {
      isValid: false,
      distanceKm: dist,
      error: `Trajet hors périmètre urbain : La distance (${dist} km) dépasse le rayon urbain maximal autorisé (${MAX_URBAN_RADIUS_KM} km).`,
    };
  }

  return { isValid: true, distanceKm: dist };
}
