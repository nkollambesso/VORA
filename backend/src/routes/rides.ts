import { Router, Request, Response } from 'express';
import { query } from '../db';
import { calculateAllCategories, calculateVoraFare } from '../utils/pricing';

const router = Router();

// Estimer les tarifs pour les 3 catégories (Moto, Taxi, Confort)
router.post('/estimate', (req: Request, res: Response) => {
  try {
    const {
      distance_km,
      luggage_count = 0,
      passenger_count = 1,
      pickup_address = '',
      destination_address = '',
    } = req.body;

    const dist = parseFloat(distance_km) || 3.5;
    const estimates = calculateAllCategories(
      dist,
      parseInt(luggage_count, 10),
      parseInt(passenger_count, 10),
      pickup_address,
      destination_address
    );

    return res.json({ success: true, estimates });
  } catch (error) {
    console.error('Erreur estimation tarifs:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors du calcul des tarifs' });
  }
});

// Créer une nouvelle demande de course
router.post('/', async (req: Request, res: Response) => {
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
      passenger_count = 1,
      luggage_count = 0,
      fare_fcfa,
      multiplier,
      surge_multiplier = 1.0,
      surge_reason,
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
        vehicle_type, passenger_count, luggage_count,
        fare_fcfa, multiplier, surge_multiplier, surge_reason, payment_method, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'SEARCHING')
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
      vehicle_type || 'taxi',
      passenger_count,
      luggage_count,
      fare_fcfa,
      multiplier || 1.0,
      surge_multiplier,
      surge_reason || null,
      payment_method || 'CASH',
    ]);

    return res.status(201).json({ success: true, ride: result.rows[0] });
  } catch (error) {
    console.error('Erreur création course:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la création de la course' });
  }
});

// Annulation de course avec pénalité de 500 FCFA si > 2 min après acceptation
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const { ride_id, rider_id, reason } = req.body;

    const rideRes = await query(`SELECT * FROM rides WHERE id = $1`, [ride_id]);
    if (rideRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course introuvable' });
    }

    const ride = rideRes.rows[0];
    let cancellationFee = 0;

    // Si la course était ACCEPTED et plus de 2 min se sont écoulées
    if (ride.status === 'ACCEPTED' && ride.updated_at) {
      const timeDiffMinutes = (Date.now() - new Date(ride.updated_at).getTime()) / (1000 * 60);
      if (timeDiffMinutes > 2) {
        cancellationFee = 500;
      }
    }

    // Mettre à jour le statut de la course
    await query(`UPDATE rides SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [ride_id]);

    // Appliquer la pénalité sur le portefeuille de l'utilisateur (solde pouvant devenir négatif)
    if (cancellationFee > 0 && rider_id) {
      await query(
        `UPDATE users 
         SET wallet_balance = wallet_balance - $1,
             cancellation_debt = cancellation_debt + $1
         WHERE id = $2`,
        [cancellationFee, rider_id]
      );
    }

    return res.json({
      success: true,
      message: cancellationFee > 0
        ? `Course annulée. Une pénalité de ${cancellationFee} FCFA a été appliquée à votre portefeuille.`
        : 'Course annulée sans frais.',
      cancellationFee,
    });
  } catch (error) {
    console.error('Erreur annulation course:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de l\'annulation' });
  }
});

// Récupérer les détails d'une course
router.get('/:id', async (req: Request, res: Response) => {
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
router.get('/user/:userId', async (req: Request, res: Response) => {
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
router.get('/driver/:driverId', async (req: Request, res: Response) => {
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

