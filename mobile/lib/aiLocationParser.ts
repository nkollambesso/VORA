import { CAMEROON_LANDMARKS, CameroonLandmark } from "@/constants/cameroon-landmarks";

export interface AILocationResult {
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  confidence: number;
  originalQuery: string;
  matchedLandmark: string;
  spatialRelation: string;
}

// Mots-clés spatiaux camerounais fréquents
const SPATIAL_KEYWORDS = [
  { keywords: ["derriere", "arrière", "arriere", "dos de"], rel: "Derrière (~40m)", latOffset: -0.00035, lngOffset: -0.0001 },
  { keywords: ["en face", "face à", "vis-à-vis", "vis a vis"], rel: "En face (~40m)", latOffset: 0.00035, lngOffset: 0.0001 },
  { keywords: ["a cote", "à côté", "pres de", "près de", "cote de"], rel: "À côté (~50m)", latOffset: 0.00005, lngOffset: 0.00045 },
  { keywords: ["apres", "après", "dépassé", "depasse"], rel: "Après (~60m)", latOffset: 0.0004, lngOffset: 0.0004 },
  { keywords: ["avant", "non loin"], rel: "Avant (~50m)", latOffset: -0.0003, lngOffset: -0.0003 },
  { keywords: ["carrefour", "au carrefour", "rond-point", "rond point"], rel: "Carrefour", latOffset: 0, lngOffset: 0 },
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ");
}

/**
 * Nettoyage strict anti-JSON / anti-markdown pour l'interface utilisateur
 */
function cleanHumanText(str: any): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/[\{\}\[\]"']/g, "")
    .replace(/\b(landmark|spatialrelation|explanation|confidence|json)\b/gi, "")
    .replace(/:\s*/g, "")
    .trim();
}

/**
 * Moteur NLP Local (Rapide 0ms)
 */
export function parseInformalCameroonianLocation(query: string): AILocationResult | null {
  if (!query || query.trim().length < 4) return null;

  const normQuery = normalizeText(query);

  let detectedRelation = SPATIAL_KEYWORDS[5];
  for (const item of SPATIAL_KEYWORDS) {
    if (item.keywords.some((kw) => normQuery.includes(kw))) {
      detectedRelation = item;
      break;
    }
  }

  let bestLandmark: CameroonLandmark | null = null;
  let highestScore = 0;

  for (const landmark of CAMEROON_LANDMARKS) {
    const normName = normalizeText(landmark.name);
    const normZone = normalizeText(landmark.zone);

    let score = 0;
    const zoneTokens = normZone.split(" ").filter((t) => t.length > 2);
    for (const token of zoneTokens) {
      if (normQuery.includes(token)) score += 3;
    }

    const nameTokens = normName.split(" ").filter((t) => t.length > 2);
    for (const token of nameTokens) {
      if (normQuery.includes(token)) score += 4;
    }

    if (normQuery.includes(normName)) score += 10;
    if (normQuery.includes(normZone)) score += 8;

    if (score > highestScore) {
      highestScore = score;
      bestLandmark = landmark;
    }
  }

  if (!bestLandmark || highestScore < 3) return null;

  const finalLat = Number((bestLandmark.latitude + detectedRelation.latOffset).toFixed(6));
  const finalLng = Number((bestLandmark.longitude + detectedRelation.lngOffset).toFixed(6));

  return {
    title: detectedRelation.rel.startsWith("Carrefour") 
      ? bestLandmark.name 
      : `${bestLandmark.name} (${detectedRelation.rel.split(" ")[0]})`,
    subtitle: `${bestLandmark.zone}, ${bestLandmark.city}`,
    latitude: finalLat,
    longitude: finalLng,
    confidence: Math.min(98, 70 + highestScore * 3),
    originalQuery: query,
    matchedLandmark: `${bestLandmark.name}, ${bestLandmark.city}`,
    spatialRelation: detectedRelation.rel,
  };
}

/**
 * Traitement en arrière-plan via API LLM (enrichissement de repère)
 */
const geminiApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export async function parseWithGeminiAI(query: string): Promise<AILocationResult | null> {
  const localResult = parseInformalCameroonianLocation(query);

  if (!geminiApiKey || !query || query.trim().length < 4) {
    return localResult;
  }

  try {
    const prompt = `Tu es le moteur de recherche d'adresses et repères urbains pour les villes du Cameroun (Yaoundé, Douala, Bafoussam, Garoua, etc.).
L'utilisateur recherche un lieu ou un repère : "${query}".

Renvoie STRICTEMENT un objet JSON valide (sans aucun formatage markdown, sans backticks, sans texte additionnel) identifiant le lieu physique réel :
{
  "landmark": "Nom exact du lieu physique ou quartier",
  "zone": "Quartier ou commune",
  "city": "Yaoundé ou Douala ou autre ville du Cameroun",
  "spatialRelation": "derrière, en face de, à côté de, ou carrefour"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (textOutput) {
      const cleanJson = textOutput.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleanJson);

      const cleanLandmark = cleanHumanText(parsed.landmark);
      const cleanZone = cleanHumanText(parsed.zone);
      const cleanCity = cleanHumanText(parsed.city) || "Yaoundé";
      const cleanRelation = cleanHumanText(parsed.spatialRelation);

      if (localResult) {
        return {
          ...localResult,
          title: cleanLandmark || localResult.title,
          subtitle: `${cleanZone ? cleanZone + ", " : ""}${cleanCity}`,
        };
      }
    }
  } catch (err) {
    // quiet fallback to local result
  }

  return localResult;
}
