import { Router, Request, Response } from 'express';
import { query } from '../db';
import { calculateAllCategories, calculateVoraFare, validateMotoCapacity } from '../utils/pricing';
import { validateIntraCity } from '../utils/geofence';

const router = Router();

// Helper validation stricte numéro de téléphone camerounais (+237 ou 6xx/2xx 9 chiffres)
function isValidCameroonPhone(phone: string): boolean {
  if (!phone) return false;
  const clean = phone.replace(/\s+/g, '').replace(/^(\+237|00237|237)/, '');
  return /^(6[25789]\d{7}|2[2348]\d{7})$/.test(clean);
}

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
      booked_for_other = false,
      passenger_name,
      passenger_phone,
      fare_fcfa,
      multiplier,
      surge_multiplier = 1.0,
      surge_reason,
      payment_method = 'CASH',
    } = req.body;

    // 1. Validation du périmètre intra-urbain (Toutes les villes du Cameroun)
    if (origin_lat && origin_lng && dest_lat && dest_lng) {
      const geoCheck = validateIntraCity(
        parseFloat(origin_lat),
        parseFloat(origin_lng),
        parseFloat(dest_lat),
        parseFloat(dest_lng),
        origin_address,
        destination_address
      );
      if (!geoCheck.isValid) {
        return res.status(400).json({
          success: false,
          error: geoCheck.error,
        });
      }
    }

    // 2. Validation stricte de la capacité Moto (Bendskin)
    if (vehicle_type === 'moto') {
      const motoError = validateMotoCapacity(Number(passenger_count) || 1, Number(luggage_count) || 0);
      if (motoError) {
        return res.status(400).json({
          success: false,
          error: motoError,
        });
      }
    }

    // 3. Validation stricte réservation pour un tiers
    if (booked_for_other) {
      if (!passenger_name || passenger_name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Le nom du passager bénéficiaire est obligatoire (minimum 2 caractères).',
        });
      }
      if (!passenger_phone || !isValidCameroonPhone(passenger_phone)) {
        return res.status(400).json({
          success: false,
          error: 'Le numéro du passager bénéficiaire doit être un numéro camerounais valide (ex: 699 00 00 00).',
        });
      }
    }

    const effectiveRiderId = rider_id || 'user_demo';

    // S'assurer que l'utilisateur existe dans la BD pour respecter la contrainte clé étrangère
    await query(
      `INSERT INTO users (id, name, email, role, verification_status)
       VALUES ($1, 'Passager VORA', $2, 'PASSENGER', 'verified')
       ON CONFLICT (id) DO NOTHING`,
      [effectiveRiderId, `${effectiveRiderId}@vora.cm`]
    );

    // Si paiement par Portefeuille (WALLET), vérifier et déduire le solde
    let paymentStatus = 'PENDING';
    if (payment_method === 'WALLET') {
      const uRes = await query(`SELECT wallet_balance FROM users WHERE id = $1`, [effectiveRiderId]);
      const balance = Number(uRes.rows[0]?.wallet_balance) || 0;
      if (balance < fare_fcfa) {
        return res.status(400).json({
          success: false,
          error: `Solde portefeuille insuffisant (${balance.toLocaleString()} FCFA). Le montant requis est de ${fare_fcfa.toLocaleString()} FCFA. Veuillez recharger votre portefeuille ou choisir un autre moyen de paiement.`,
        });
      }
      await query(`UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2`, [fare_fcfa, effectiveRiderId]);
      paymentStatus = 'PAID';
    }

    const rideId = `VORA-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

    const insertQuery = `
      INSERT INTO rides (
        id, rider_id, origin_address, destination_address,
        origin_lat, origin_lng, dest_lat, dest_lng,
        vehicle_type, passenger_count, luggage_count,
        booked_for_other, passenger_name, passenger_phone,
        fare_fcfa, multiplier, surge_multiplier, surge_reason, 
        payment_method, payment_status, otp_code, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'SEARCHING')
      RETURNING *;
    `;

    const result = await query(insertQuery, [
      rideId,
      effectiveRiderId,
      origin_address || 'Carrefour Mokolo, Yaoundé',
      destination_address || 'Quartier Bastos, Yaoundé',
      origin_lat || 3.8667,
      origin_lng || 11.5167,
      dest_lat || 3.875,
      dest_lng || 11.52,
      vehicle_type || 'taxi',
      passenger_count,
      luggage_count,
      !!booked_for_other,
      passenger_name || null,
      passenger_phone || null,
      fare_fcfa || 1500,
      multiplier || 1.0,
      surge_multiplier,
      surge_reason || null,
      payment_method,
      paymentStatus,
      otpCode,
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
      `SELECT r.*, d.vehicle_model, d.license_plate, d.color, d.vehicle_image, d.rating as driver_rating,
              u.name as driver_name, u.phone as driver_phone, u.avatar_url as driver_avatar
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
      `SELECT r.*, d.vehicle_model, d.license_plate, d.color, d.vehicle_image,
              COALESCE(u.name, 'Chauffeur VORA') as driver_name,
              u.avatar_url as driver_avatar,
              COALESCE(d.rating, 5.0) as driver_rating
       FROM rides r
       LEFT JOIN drivers d ON r.driver_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE r.rider_id = $1
         AND (r.hidden_by_rider IS NULL OR r.hidden_by_rider = FALSE)
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return res.json({ success: true, rides: result.rows });
  } catch (error) {
    console.error('Erreur historique passager:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Effacer l'historique des courses d'un passager (soft-delete)
router.delete('/history/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    await query(
      `UPDATE rides SET hidden_by_rider = TRUE WHERE rider_id = $1 AND status IN ('COMPLETED', 'CANCELLED')`,
      [userId]
    );
    return res.json({ success: true, message: 'Historique effacé avec succès.' });
  } catch (error) {
    console.error('Erreur suppression historique passager:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Historique des courses d'un chauffeur
router.get('/driver/:driverId', async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const result = await query(
      `SELECT * FROM rides WHERE driver_id = $1
         AND (hidden_by_driver IS NULL OR hidden_by_driver = FALSE)
       ORDER BY created_at DESC`,
      [driverId]
    );
    return res.json({ success: true, rides: result.rows });
  } catch (error) {
    console.error('Erreur historique chauffeur:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Effacer l'historique des courses d'un chauffeur (soft-delete)
router.delete('/history/driver/:driverId', async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    await query(
      `UPDATE rides SET hidden_by_driver = TRUE WHERE driver_id = $1 AND status IN ('COMPLETED', 'CANCELLED')`,
      [driverId]
    );
    return res.json({ success: true, message: 'Historique effacé avec succès.' });
  } catch (error) {
    console.error('Erreur suppression historique chauffeur:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Noter un chauffeur à la fin d'une course (1 à 5 étoiles, feedback, badges de compliment)
router.post('/:id/rate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, feedback, badges } = req.body;

    const parsedRating = parseInt(rating, 10);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({
        success: false,
        error: 'La note doit être un entier compris entre 1 et 5 étoiles.',
      });
    }

    const rideRes = await query(`SELECT * FROM rides WHERE id = $1`, [id]);
    if (rideRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course introuvable.' });
    }

    const ride = rideRes.rows[0];

    // Combiner feedback et badges de compliment si présents
    let fullFeedback = (feedback || '').trim();
    if (Array.isArray(badges) && badges.length > 0) {
      const badgeText = `[Badges: ${badges.join(', ')}]`;
      fullFeedback = fullFeedback ? `${badgeText} ${fullFeedback}` : badgeText;
    }

    // Mettre à jour la note et le feedback sur la course
    const updatedRideRes = await query(
      `UPDATE rides 
       SET rating = $1, feedback = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING *`,
      [parsedRating, fullFeedback || null, id]
    );

    let updatedDriverRating = null;

    // Recalculer la réputation / notoriété du chauffeur
    if (ride.driver_id) {
      const avgRes = await query(
        `SELECT ROUND(AVG(rating), 2) as avg_rating, COUNT(rating) as rated_count 
         FROM rides 
         WHERE driver_id = $1 AND rating IS NOT NULL`,
        [ride.driver_id]
      );

      if (avgRes.rows.length > 0 && avgRes.rows[0].avg_rating !== null) {
        updatedDriverRating = parseFloat(avgRes.rows[0].avg_rating);
        await query(
          `UPDATE drivers SET rating = $1 WHERE id = $2`,
          [updatedDriverRating, ride.driver_id]
        );
        console.log(`⭐ Notoriété chauffeur #${ride.driver_id} mise à jour : ${updatedDriverRating}/5 (${avgRes.rows[0].rated_count} avis)`);
      }
    }

    return res.json({
      success: true,
      message: 'Merci pour votre évaluation ! La réputation du chauffeur a été mise à jour.',
      ride: updatedRideRes.rows[0],
      driverRating: updatedDriverRating,
    });
  } catch (error) {
    console.error('Erreur notation course:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de l\'enregistrement de la note.' });
  }
});


// Annulation par ID de course — endpoint RESTful (POST /api/rides/:id/cancel)
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, cancelledBy = 'passenger' } = req.body;

    const rideRes = await query(`SELECT * FROM rides WHERE id = $1`, [id]);
    if (rideRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course introuvable.' });
    }

    const ride = rideRes.rows[0];

    // Règle stricte demandée : le chauffeur ne peut annuler QUE s'il l'a acceptée et AVANT l'OTP (status === 'ACCEPTED')
    if (cancelledBy === 'driver' && ride.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: "Le chauffeur ne peut annuler la course qu'avant la validation du code OTP.",
      });
    }

    if (!['SEARCHING', 'ACCEPTED'].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cette course ne peut plus être annulée (elle est en cours ou déjà terminée).',
      });
    }

    let cancellationFee = 0;
    // Pénalité uniquement si annulé par le passager plus de 2 min après acceptation
    if (cancelledBy === 'passenger' && ride.status === 'ACCEPTED' && ride.updated_at) {
      const timeDiffMinutes = (Date.now() - new Date(ride.updated_at).getTime()) / (1000 * 60);
      if (timeDiffMinutes > 2) {
        cancellationFee = 500;
      }
    }

    await query(
      `UPDATE rides SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    if (cancellationFee > 0 && ride.rider_id) {
      await query(
        `UPDATE users SET wallet_balance = wallet_balance - $1, cancellation_debt = cancellation_debt + $1 WHERE id = $2`,
        [cancellationFee, ride.rider_id]
      );
    }

    console.log(`[CANCEL] Course ${id} annulée par ${cancelledBy}. Raison: ${reason || 'non précisée'}. Frais: ${cancellationFee} FCFA`);

    // Notifier le passager et les abonnés de la course via Socket.io
    const io = req.app.get('io');
    const cancelPayload = {
      rideId: id,
      cancelledBy,
      reason: reason || (cancelledBy === 'driver' ? 'Le chauffeur a dû annuler sa prise en charge.' : 'Annulé par le passager.'),
    };

    if (io) {
      if (ride.rider_id) {
        io.to(ride.rider_id).emit('ride-cancelled', cancelPayload);
      }
      io.to(`ride:${id}`).emit('ride-cancelled', cancelPayload);
      io.emit(`ride-cancelled:${id}`, cancelPayload);
    }

    return res.json({
      success: true,
      message: cancellationFee > 0
        ? `Course annulée. Une pénalité de ${cancellationFee} FCFA a été appliquée.`
        : 'Course annulée sans frais.',
      cancellationFee,
    });
  } catch (error) {
    console.error('Erreur annulation course par ID:', error);
    return res.status(500).json({ success: false, error: "Erreur lors de l'annulation de la course." });
  }
});

// Récupérer les détails d'une course par ID avec infos chauffeur
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rideRes = await query(
      `SELECT r.*, 
              d.user_id as driver_user_id,
              u.name as driver_name,
              u.public_id as driver_public_id,
              d.vehicle_model,
              d.vehicle_plate,
              d.vehicle_image,
              u.avatar_url as driver_avatar,
              d.rating as driver_rating,
              u.phone as driver_phone
       FROM rides r
       LEFT JOIN drivers d ON r.driver_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );
    if (rideRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Course introuvable' });
    }
    return res.json({ success: true, ride: rideRes.rows[0] });
  } catch (err) {
    console.error('Erreur get ride:', err);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupérer la course active d'un passager
router.get('/active/rider/:riderId', async (req: Request, res: Response) => {
  try {
    const { riderId } = req.params;
    const rideRes = await query(
      `SELECT r.*, 
              d.user_id as driver_user_id,
              u.name as driver_name,
              u.public_id as driver_public_id,
              d.vehicle_model,
              d.vehicle_plate,
              d.vehicle_image,
              u.avatar_url as driver_avatar,
              d.rating as driver_rating,
              u.phone as driver_phone
       FROM rides r
       LEFT JOIN drivers d ON r.driver_id = d.id
       LEFT JOIN users u ON d.user_id = u.id
       WHERE r.rider_id = $1 AND r.status IN ('SEARCHING', 'ACCEPTED', 'IN_TRANSIT', 'ARRIVEE_SIGNALEE')
       ORDER BY r.created_at DESC
       LIMIT 1`,
      [riderId]
    );
    if (rideRes.rows.length === 0) {
      return res.json({ success: true, ride: null });
    }
    return res.json({ success: true, ride: rideRes.rows[0] });
  } catch (err) {
    console.error('Erreur get active ride:', err);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
