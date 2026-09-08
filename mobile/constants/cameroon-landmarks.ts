export interface CameroonLandmark {
  id: string;
  name: string;
  city: "Yaoundé" | "Douala";
  zone: string;
  latitude: number;
  longitude: number;
  description: string;
}

export const CAMEROON_LANDMARKS: CameroonLandmark[] = [
  // ─── YAOUNDÉ ─────────────────────────────────────────────────────────────
  {
    id: "yde-1",
    name: "Quartier Bastos",
    city: "Yaoundé",
    zone: "Bastos",
    latitude: 3.8856,
    longitude: 11.5162,
    description: "Quartier résidentiel, diplomatique et restaurants (Bastos)",
  },
  {
    id: "yde-2",
    name: "Carrefour Bastos",
    city: "Yaoundé",
    zone: "Bastos",
    latitude: 3.8820,
    longitude: 11.5180,
    description: "Carrefour principal Bastos - Ambassade des États-Unis / Chine",
  },
  {
    id: "yde-3",
    name: "Marché Mokolo",
    city: "Yaoundé",
    zone: "Mokolo",
    latitude: 3.8776,
    longitude: 11.5069,
    description: "Grand marché populaire de vêtements et commerce",
  },
  {
    id: "yde-4",
    name: "Carrefour Mvog-Ada",
    city: "Yaoundé",
    zone: "Mvog-Ada",
    latitude: 3.8542,
    longitude: 11.5213,
    description: "Carrefour animé et restaurants de Yaoundé",
  },
  {
    id: "yde-5",
    name: "Rond-point Nlongkak",
    city: "Yaoundé",
    zone: "Nlongkak",
    latitude: 3.8821,
    longitude: 11.5156,
    description: "Nœud routier entre Bastos et le Centre-ville",
  },
  {
    id: "yde-6",
    name: "Marché Mfoundi",
    city: "Yaoundé",
    zone: "Centre",
    latitude: 3.8667,
    longitude: 11.5167,
    description: "Marché central au cœur de Yaoundé",
  },
  {
    id: "yde-7",
    name: "Stade Omnisports Ahmadou Ahidjo",
    city: "Yaoundé",
    zone: "Mfandena",
    latitude: 3.8834,
    longitude: 11.5404,
    description: "Stade national de football et complexe sportif",
  },
  {
    id: "yde-8",
    name: "Carrefour Obili",
    city: "Yaoundé",
    zone: "Obili",
    latitude: 3.8698,
    longitude: 11.4889,
    description: "Quartier universitaire proche de l'Université Yaoundé I",
  },
  {
    id: "yde-9",
    name: "Melen / CHU",
    city: "Yaoundé",
    zone: "Melen",
    latitude: 3.8610,
    longitude: 11.4980,
    description: "Centre Hospitalier Universitaire et quartier Melen",
  },
  {
    id: "yde-10",
    name: "Carrefour Biyem-Assi",
    city: "Yaoundé",
    zone: "Biyem-Assi",
    latitude: 3.8350,
    longitude: 11.4880,
    description: "Maison Blanche Biyem-Assi et grand carrefour commercial",
  },
  {
    id: "yde-11",
    name: "Carrefour Odza",
    city: "Yaoundé",
    zone: "Odza",
    latitude: 3.7920,
    longitude: 11.5310,
    description: "Sortie sud vers l'aéroport Nsimalen",
  },
  {
    id: "yde-12",
    name: "Gare Routière Mvan",
    city: "Yaoundé",
    zone: "Mvan",
    latitude: 3.8180,
    longitude: 11.5200,
    description: "Gare des agences de voyage pour Douala et l'Ouest",
  },
  {
    id: "yde-13",
    name: "Carrefour Nsam",
    city: "Yaoundé",
    zone: "Nsam",
    latitude: 3.8250,
    longitude: 11.5050,
    description: "SCDP Nsam et axe routier sud",
  },
  {
    id: "yde-14",
    name: "Poste Centrale",
    city: "Yaoundé",
    zone: "Centre-Ville",
    latitude: 3.8622,
    longitude: 11.5188,
    description: "Centre administratif et commercial de Yaoundé",
  },
  {
    id: "yde-15",
    name: "Palais des Congrès / Tsinga",
    city: "Yaoundé",
    zone: "Tsinga",
    latitude: 3.8910,
    longitude: 11.5050,
    description: "Palais des Congrès de Yaoundé et quartier Tsinga",
  },
  {
    id: "yde-16",
    name: "Marché Essos",
    city: "Yaoundé",
    zone: "Essos",
    latitude: 3.8923,
    longitude: 11.5401,
    description: "Marché et quartier populaire vivant Essos",
  },

  // ─── DOUALA ──────────────────────────────────────────────────────────────
  {
    id: "dla-1",
    name: "Akwa Boulevard de la Liberté",
    city: "Douala",
    zone: "Akwa",
    latitude: 4.0511,
    longitude: 9.6978,
    description: "Centre des affaires, commerces et banques à Akwa",
  },
  {
    id: "dla-2",
    name: "Bonanjo Plateau Administrative",
    city: "Douala",
    zone: "Bonanjo",
    latitude: 4.0433,
    longitude: 9.6895,
    description: "Quartier administratif, port et gouvernorat",
  },
  {
    id: "dla-3",
    name: "Rond-point Deido",
    city: "Douala",
    zone: "Deido",
    latitude: 4.0621,
    longitude: 9.7012,
    description: "Monument du Centenaire et carrefour vers le Pont Wouri",
  },
  {
    id: "dla-4",
    name: "Bonabéri Carrefour Mutuelle",
    city: "Douala",
    zone: "Bonabéri",
    latitude: 4.0810,
    longitude: 9.6650,
    description: "Zone industrielle et résidentielle rive droite Wouri",
  },
  {
    id: "dla-5",
    name: "Marché Central de Douala",
    city: "Douala",
    zone: "New Bell",
    latitude: 4.0385,
    longitude: 9.7081,
    description: "Grand marché commercial de Douala",
  },
  {
    id: "dla-6",
    name: "Makepe / Carrefour BM",
    city: "Douala",
    zone: "Makepe",
    latitude: 4.0780,
    longitude: 9.7420,
    description: "Quartier résidentiel et commercial Makepe",
  },
  {
    id: "dla-7",
    name: "Rond-point Bepanda",
    city: "Douala",
    zone: "Bepanda",
    latitude: 4.0689,
    longitude: 9.7234,
    description: "Omnisports Bepanda et zone commerçante",
  },
  {
    id: "dla-8",
    name: "Aéroport International de Douala",
    city: "Douala",
    zone: "Aéroport",
    latitude: 4.0150,
    longitude: 9.7190,
    description: "Aéroport principal du Cameroun",
  },
];

export const CAMEROON_CITIES = [
  { name: "Yaoundé", lat: 3.8667, lng: 11.5167 },
  { name: "Douala", lat: 4.0511, lng: 9.7679 },
  { name: "Bafoussam", lat: 5.4778, lng: 10.4176 },
  { name: "Garoua", lat: 9.3000, lng: 13.4000 },
  { name: "Maroua", lat: 10.5900, lng: 14.3200 },
  { name: "Bamenda", lat: 5.9600, lng: 10.1500 },
  { name: "Kribi", lat: 2.9400, lng: 9.9100 },
  { name: "Buea", lat: 4.1500, lng: 9.2400 },
  { name: "Limbe", lat: 4.0200, lng: 9.2100 },
];

export function detectCityFromCoords(
  lat?: number | null,
  lng?: number | null,
  address?: string | null
): string {
  // 1. Détection via l'adresse textuelle si disponible
  if (address) {
    const addrLower = address.toLowerCase();
    for (const city of CAMEROON_CITIES) {
      if (addrLower.includes(city.name.toLowerCase())) {
        return city.name;
      }
    }
  }

  // 2. Détection par calcul de distance GPS vers le centre urbain le plus proche
  if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
    let closestCity = "Yaoundé";
    let minDistance = Infinity;

    for (const city of CAMEROON_CITIES) {
      const dLat = lat - city.lat;
      const dLng = lng - city.lng;
      const distSq = dLat * dLat + dLng * dLng;
      if (distSq < minDistance) {
        minDistance = distSq;
        closestCity = city.name;
      }
    }
    return closestCity;
  }

  // Par défaut capitale politique
  return "Yaoundé";
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function searchLandmarks(query: string, cityFilter?: string): CameroonLandmark[] {
  if (!query || query.trim().length < 1) return [];
  const qNorm = normalize(query);
  const cityNorm = cityFilter ? normalize(cityFilter) : null;

  return CAMEROON_LANDMARKS.filter((item) => {
    // Si un filtre de ville est actif, exclure impérativement toute autre ville
    if (cityNorm && normalize(item.city) !== cityNorm) {
      return false;
    }

    const nameNorm = normalize(item.name);
    const zoneNorm = normalize(item.zone);
    const cityItemNorm = normalize(item.city);
    const descNorm = normalize(item.description);
    return (
      nameNorm.includes(qNorm) ||
      zoneNorm.includes(qNorm) ||
      cityItemNorm.includes(qNorm) ||
      descNorm.includes(qNorm)
    );
  });
}
