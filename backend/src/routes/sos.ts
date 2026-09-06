import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// Enclencher une alerte SOS d'urgence
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { userId, userRole, lat, lng } = req.body;

    const result = await query(
      `INSERT INTO sos_alerts (user_id, user_role, lat, lng, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING *;`,
      [userId, userRole || 'PASSENGER', lat, lng]
    );

    console.log(`[SOS ALERTE SECOURS] Utilisateur ${userId} (${userRole}) aux coordonnées (${lat}, ${lng})`);

    return res.status(201).json({
      success: true,
      alert: result.rows[0],
      message: 'Alerte SOS d\'urgence transmise avec succès aux services de sécurité VORA.',
    });
  } catch (error) {
    console.error('Erreur alerte SOS:', error);
    return res.status(500).json({ success: false, error: 'Erreur alerte SOS' });
  }
});

// Liste des alertes SOS actives (pour le tableau de bord Admin)
router.get('/active', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT s.*, u.name, u.phone, u.email
       FROM sos_alerts s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.status = 'ACTIVE'
       ORDER BY s.created_at DESC`
    );
    return res.json({ success: true, alerts: result.rows });
  } catch (error) {
    console.error('Erreur récupération alertes SOS:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
