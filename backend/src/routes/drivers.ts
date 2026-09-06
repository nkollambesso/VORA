import { Router, Request, Response } from 'express';
import { query } from '../db';
import { formatDisplayName, generatePublicId } from '../utils/anonymize';

const router = Router();

// Inscrire ou mettre à jour un profil chauffeur
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { user_id, vehicle_type, vehicle_model, license_plate, color } = req.body;

    // 1. Mettre à jour le rôle dans la table users
    await query(`UPDATE users SET role = 'DRIVER' WHERE id = $1`, [user_id]);

    // 2. Insérer ou mettre à jour dans la table drivers
    const insertQuery = `
      INSERT INTO drivers (user_id, vehicle_type, vehicle_model, license_plate, color)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE
      SET vehicle_type = EXCLUDED.vehicle_type,
          vehicle_model = EXCLUDED.vehicle_model,
          license_plate = EXCLUDED.license_plate,
          color = EXCLUDED.color
      RETURNING *;
    `;

    const result = await query(insertQuery, [
      user_id,
      vehicle_type,
      vehicle_model,
      license_plate,
      color,
    ]);

    return res.status(201).json({ success: true, driver: result.rows[0] });
  } catch (error) {
    console.error('Erreur inscription chauffeur:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de l\'inscription du chauffeur' });
  }
});

// Basculer le statut en ligne / hors ligne
router.post('/toggle-online', async (req: Request, res: Response) => {
  try {
    const { driver_id, is_online, lat, lng } = req.body;

    if (is_online) {
      // Vérification du statut Didit KYC du chauffeur
      const kycCheck = await query(
        `SELECT u.verification_status, u.id 
         FROM users u 
         JOIN drivers d ON d.user_id = u.id 
         WHERE d.id = $1`,
        [driver_id]
      );

      const kycStatus = kycCheck.rows[0]?.verification_status;
      if (kycStatus !== 'verified') {
        return res.status(403).json({
          success: false,
          error: 'Vérification d\'identité Didit (KYC) requise. Votre profil doit être au statut "verified" pour passer en ligne.',
          kycStatus: kycStatus || 'unverified',
        });
      }
    }

    const result = await query(
      `UPDATE drivers SET is_online = $1, current_lat = $2, current_lng = $3 WHERE id = $4 RETURNING *`,
      [is_online, lat || null, lng || null, driver_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Chauffeur introuvable' });
    }

    return res.json({ success: true, driver: result.rows[0] });
  } catch (error) {
    console.error('Erreur toggle online:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Obtenir le profil chauffeur par userId
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await query(
      `SELECT d.*, u.name, u.email, u.phone, u.avatar_url, u.public_id
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       WHERE d.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profil chauffeur introuvable' });
    }

    const d = result.rows[0];
    const display_name = formatDisplayName(d.name);

    return res.json({
      success: true,
      driver: {
        ...d,
        display_name,
        public_id: d.public_id || generatePublicId(),
      },
    });
  } catch (error) {
    console.error('Erreur profil chauffeur:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Obtenir les chauffeurs en ligne (Données anonymisées pour la carte passager)
router.get('/online', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT d.id, d.vehicle_type, d.vehicle_model, d.license_plate, d.color, d.current_lat, d.current_lng, d.rating, u.public_id, u.name, u.avatar_url 
       FROM drivers d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.is_online = TRUE`
    );

    const anonymizedDrivers = result.rows.map((d: any) => ({
      ...d,
      display_name: formatDisplayName(d.name),
      public_id: d.public_id || generatePublicId(),
      name: undefined, // Supprime le nom complet pour la sécurité
    }));

    return res.json({ success: true, drivers: anonymizedDrivers });
  } catch (error) {
    console.error('Erreur chauffeurs en ligne:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Obtenir l'historique et statistiques des revenus par userId
router.get('/earnings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Trouver le driver_id associé à user_id
    const driverRes = await query(`SELECT id FROM drivers WHERE user_id = $1`, [userId]);
    const driverId = driverRes.rows[0]?.id;

    if (!driverId) {
      return res.json({
        success: true,
        earnings: {
          day: { amount: 0, ridesCount: 0, hoursOnline: 0, avgPerRide: 0 },
          week: { amount: 0, ridesCount: 0, hoursOnline: 0, avgPerRide: 0 },
          month: { amount: 0, ridesCount: 0, hoursOnline: 0, avgPerRide: 0 },
        },
      });
    }

    const dayRes = await query(
      `SELECT COALESCE(SUM(fare_fcfa), 0) as total, COUNT(*) as count 
       FROM rides 
       WHERE driver_id = $1 AND status = 'COMPLETED' AND created_at >= CURRENT_DATE`,
      [driverId]
    );

    const weekRes = await query(
      `SELECT COALESCE(SUM(fare_fcfa), 0) as total, COUNT(*) as count 
       FROM rides 
       WHERE driver_id = $1 AND status = 'COMPLETED' AND created_at >= NOW() - INTERVAL '7 days'`,
      [driverId]
    );

    const monthRes = await query(
      `SELECT COALESCE(SUM(fare_fcfa), 0) as total, COUNT(*) as count 
       FROM rides 
       WHERE driver_id = $1 AND status = 'COMPLETED' AND created_at >= NOW() - INTERVAL '30 days'`,
      [driverId]
    );

    const dayTotal = parseInt(dayRes.rows[0].total, 10);
    const dayCount = parseInt(dayRes.rows[0].count, 10);

    const weekTotal = parseInt(weekRes.rows[0].total, 10);
    const weekCount = parseInt(weekRes.rows[0].count, 10);

    const monthTotal = parseInt(monthRes.rows[0].total, 10);
    const monthCount = parseInt(monthRes.rows[0].count, 10);

    return res.json({
      success: true,
      earnings: {
        day: {
          amount: dayTotal,
          ridesCount: dayCount,
          hoursOnline: dayCount > 0 ? parseFloat((dayCount * 0.75).toFixed(1)) : 0,
          avgPerRide: dayCount > 0 ? Math.round(dayTotal / dayCount) : 0,
        },
        week: {
          amount: weekTotal,
          ridesCount: weekCount,
          hoursOnline: weekCount > 0 ? parseFloat((weekCount * 0.8).toFixed(1)) : 0,
          avgPerRide: weekCount > 0 ? Math.round(weekTotal / weekCount) : 0,
        },
        month: {
          amount: monthTotal,
          ridesCount: monthCount,
          hoursOnline: monthCount > 0 ? parseFloat((monthCount * 0.85).toFixed(1)) : 0,
          avgPerRide: monthCount > 0 ? Math.round(monthTotal / monthCount) : 0,
        },
      },
    });
  } catch (error) {
    console.error('Erreur backend earnings:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
