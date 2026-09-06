import { Router } from 'express';
import { query } from '../db';

const router = Router();

// Créer une nouvelle demande de course
router.post('/', async (req, res) => {
  try {
    const {
      rider_id,
      origin_address,
      destination_address,
      origin_lat,
      origin_lng,
      dest_lat,
      dest_lng,
      vehicle_type,
      fare_fcfa,
      multiplier,
      payment_method,
    } = req.body;

    // Vérifier la validation KYC du passager
    if (rider_id) {
      const kycRes = await query(`SELECT verification_status FROM users WHERE id = $1`, [rider_id]);
      const kycStatus = kycRes.rows[0]?.verification_status;
      if (kycStatus && kycStatus !== 'verified') {
        return res.status(403).json({
          success: false,
          error: 'Vérification d\'identité Didit (KYC) requise avant de réserver une course.',
          kycStatus,
        });
      }
    }

    const rideId = `VORA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const insertQuery = `
      INSERT INTO rides (
        id, rider_id, origin_address, destination_address,
        origin_lat, origin_lng, dest_lat, dest_lng,
        vehicle_type, fare_fcfa, multiplier, payment_method, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'SEARCHING')
      RETURNING *;
    `;

    const result = await query(insertQuery, [
      rideId,
      rider_id,
      origin_address,
      destination_address,
      origin_lat,
      origin_lng,
      dest_lat,
      dest_lng,
      vehicle_type,
      fare_fcfa,
      multiplier || 1.0,
      payment_method || 'CASH',
    ]);

    return res.status(201).json({ success: true, ride: result.rows[0] });
  } catch (error) {
    console.error('Erreur création course:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la création de la course' });
  }
});

// Récupérer les détails d'une course
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT r.*, d.vehicle_model, d.license_plate, d.color, u.name as driver_name, u.phone as driver_phone
       FROM rides r
       LEFT JOIN drivers d ON r.driver_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course introuvable' });
    }

    return res.json({ success: true, ride: result.rows[0] });
  } catch (error) {
    console.error('Erreur récupération course:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Historique des courses d'un passager
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await query(
      `SELECT * FROM rides WHERE rider_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return res.json({ success: true, rides: result.rows });
  } catch (error) {
    console.error('Erreur historique passager:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Historique des courses d'un chauffeur
router.get('/driver/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const result = await query(
      `SELECT * FROM rides WHERE driver_id = $1 ORDER BY created_at DESC`,
      [driverId]
    );
    return res.json({ success: true, rides: result.rows });
  } catch (error) {
    console.error('Erreur historique chauffeur:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
