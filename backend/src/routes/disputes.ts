import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// Créer un nouveau litige (quand le client clique sur "Signaler un problème")
router.post('/', async (req: Request, res: Response) => {
  try {
    const { ride_id, rider_id, driver_id, reason } = req.body;

    if (!ride_id || !reason) {
      return res.status(400).json({ success: false, error: 'ride_id et reason requis' });
    }

    // 1. Mettre à jour le statut de la course à 'EN_LITIGE' (blocage du paiement automatique)
    await query(
      `UPDATE rides SET status = 'EN_LITIGE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [ride_id]
    );

    // 2. Insérer dans la table ride_disputes
    const insertRes = await query(
      `INSERT INTO ride_disputes (ride_id, rider_id, driver_id, reason, status)
       VALUES ($1, $2, $3, $4, 'A_TRAITER')
       RETURNING *`,
      [ride_id, rider_id || null, driver_id || null, reason]
    );

    return res.status(201).json({ success: true, dispute: insertRes.rows[0] });
  } catch (error) {
    console.error('Erreur création litige:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur lors de la création du litige' });
  }
});

// Obtenir la liste de tous les litiges pour le Super Admin
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT d.*, 
              r.origin_address, r.destination_address, r.fare_fcfa, r.payment_method,
              u1.name as rider_name, u1.phone as rider_phone,
              u2.name as driver_name, u2.phone as driver_phone
       FROM ride_disputes d
       LEFT JOIN rides r ON d.ride_id = r.id
       LEFT JOIN users u1 ON d.rider_id = u1.id
       LEFT JOIN drivers dr ON d.driver_id = dr.id
       LEFT JOIN users u2 ON dr.user_id = u2.id
       ORDER BY d.created_at DESC`
    );

    return res.json({ success: true, disputes: result.rows });
  } catch (error) {
    console.error('Erreur récupération litiges:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Mettre à jour le statut d'un litige (Super Admin: RESOLU / REJETE)
router.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await query(
      `UPDATE ride_disputes SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    return res.json({ success: true, dispute: result.rows[0] });
  } catch (error) {
    console.error('Erreur mise à jour litige:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
