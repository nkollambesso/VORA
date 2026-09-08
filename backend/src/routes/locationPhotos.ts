import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// Téléverser / Assigner une photo à un lieu géolocalisé
router.post('/', async (req: Request, res: Response) => {
  try {
    const { user_id, place_name, lat, lng, image_url } = req.body;

    if (!place_name || !lat || !lng || !image_url) {
      return res.status(400).json({
        success: false,
        error: 'Nom du lieu, coordonnées (lat/lng) et photo requises.',
      });
    }

    const insertQuery = `
      INSERT INTO location_photos (user_id, place_name, lat, lng, image_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const result = await query(insertQuery, [
      user_id || null,
      place_name.trim(),
      parseFloat(lat),
      parseFloat(lng),
      image_url,
    ]);

    return res.status(201).json({ success: true, locationPhoto: result.rows[0] });
  } catch (error) {
    console.error('Erreur enregistrement photo lieu:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la sauvegarde de la photo du lieu' });
  }
});

// Récupérer les photos de repères proches d'une position GPS (rayon ~5km)
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string) || 3.8667;
    const lng = parseFloat(req.query.lng as string) || 11.5167;

    const result = await query(
      `SELECT lp.*, u.name as uploader_name
       FROM location_photos lp
       LEFT JOIN users u ON lp.user_id = u.id
       ORDER BY lp.created_at DESC
       LIMIT 10`
    );

    return res.json({ success: true, photos: result.rows });
  } catch (error) {
    console.error('Erreur récupération photos lieux:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
