import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

const EARTH_RADIUS_M = 6371000;

/** Haversine distance in meters between two GPS points. */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MAX_RADIUS_METERS = 5000;

interface LocationPhotoRow {
  id: number;
  user_id: string | null;
  place_name: string;
  lat: number;
  lng: number;
  image_url: string;
  created_at: string | Date;
  uploader_name?: string | null;
}

type LocationPhotoWithDistance = LocationPhotoRow & { distance_m: number };

// Téléverser / Assigner une photo à un lieu géolocalisé
// Si une photo existe déjà au même endroit (~75m), elle est mise à jour au lieu d'être dupliquée.
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, place_name, lat, lng, image_url } = req.body;

    if (!place_name || !lat || !lng || !image_url) {
      return res.status(400).json({
        success: false,
        error: 'Nom du lieu, coordonnées (lat/lng) et photo requises.',
      });
    }

    const newLat = parseFloat(lat);
    const newLng = parseFloat(lng);

    // Upsert : si un repère existe déjà à ~75m de ce point, on le met à jour
    const existing = await query('SELECT id, lat, lng FROM location_photos');
    const match = (existing.rows as { id: number; lat: number; lng: number }[]).find(
      (row) => distanceMeters(newLat, newLng, Number(row.lat), Number(row.lng)) <= 75
    );

    if (match) {
      const updateResult = await query(
        `UPDATE location_photos
         SET place_name = $2, image_url = $3, user_id = COALESCE($4, user_id), created_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [match.id, place_name.trim(), image_url, user_id || null]
      );
      return res.status(200).json({ success: true, locationPhoto: updateResult.rows[0], updated: true });
    }

    const insertQuery = `
      INSERT INTO location_photos (user_id, place_name, lat, lng, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const result = await query(insertQuery, [
      user_id || null,
      place_name.trim(),
      newLat,
      newLng,
      image_url,
    ]);

    return res.status(201).json({ success: true, locationPhoto: result.rows[0] });
  } catch (error) {
    console.error('Erreur enregistrement photo lieu:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la sauvegarde de la photo du lieu' });
  }
});

// Récupérer les photos de repères proches d'une position GPS (rayon ~5km)
// Triées par distance réelle, avec la distance incluse dans la réponse
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string) || 3.8667;
    const lng = parseFloat(req.query.lng as string) || 11.5167;

    const result = await query(
      `SELECT lp.*, u.name as uploader_name
       FROM location_photos lp
       LEFT JOIN users u ON lp.user_id = u.id`
    );

    const photos = (result.rows as LocationPhotoRow[])
      .map((row) => ({ ...row, distance_m: Math.round(distanceMeters(lat, lng, Number(row.lat), Number(row.lng))) }))
      .filter((row) => row.distance_m <= MAX_RADIUS_METERS)
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, 10);

    return res.json({ success: true, photos });
  } catch (error) {
    console.error('Erreur récupération photos lieux:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Trouver la photo déjà assignée à un lieu précis (même nom OU même position ~75m)
// Utilisé par l'app pour afficher la photo + infos d'un lieu qui en a déjà une.
router.get('/match', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const placeName = ((req.query.place_name as string) || '').trim();

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'Coordonnées (lat/lng) requises.' });
    }

    const result = await query(
      `SELECT lp.*, u.name as uploader_name
       FROM location_photos lp
       LEFT JOIN users u ON lp.user_id = u.id`
    );

    const normalized = placeName.toLowerCase();
    const match = (result.rows as LocationPhotoRow[])
      .map((row) => ({
        ...row,
        distance_m: Math.round(distanceMeters(lat, lng, Number(row.lat), Number(row.lng))),
      }))
      .filter(
        (row) =>
          row.distance_m <= 75 ||
          (normalized.length > 0 && (row.place_name || '').toLowerCase() === normalized)
      )
      .sort((a, b) => a.distance_m - b.distance_m)[0];

    if (!match) {
      return res.json({ success: true, photo: null });
    }

    return res.json({ success: true, photo: match });
  } catch (error) {
    console.error('Erreur recherche photo lieu:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
