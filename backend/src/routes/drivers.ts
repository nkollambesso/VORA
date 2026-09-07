import { Router, Request, Response } from 'express';
import { query } from '../db';
import { formatDisplayName, generatePublicId } from '../utils/anonymize';
import { verifyDriverFace } from '../utils/aiVision';

const router = Router();

// ─── POST /api/drivers/verify-face (Analyse faciale IA de la photo chauffeur) ──
router.post('/verify-face', async (req: Request, res: Response) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({
        success: false,
        isPerson: false,
        reason: 'Image manquante pour l\'analyse.',
      });
    }

    const result = await verifyDriverFace(image);
    return res.json({
      success: true,
      isPerson: result.isPerson,
      confidence: result.confidence,
      label: result.label,
      reason: result.reason,
      message: result.isPerson
        ? 'Visage humain validé par l\'IA.'
        : result.reason || 'Visage humain non reconnu sur cette photo.',
    });
  } catch (err: any) {
    console.error('Erreur vérification faciale chauffeur:', err);
    return res.status(500).json({
      success: false,
      isPerson: false,
      reason: 'Erreur lors de l\'analyse IA de l\'image.',
    });
  }
});

// Inscrire ou mettre à jour un profil chauffeur
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      user_id,
      vehicle_type,
      vehicle_model,
      license_plate,
      color,
      vehicle_image,
      avatar_url,
      vehicle_documents,
    } = req.body;

    if (!vehicle_model?.trim() || !license_plate?.trim() || !color?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Toutes les informations sur le véhicule (modèle, immatriculation, couleur) sont requises.',
      });
    }

    // Validation obligatoire de la photo du véhicule
    if (!vehicle_image || typeof vehicle_image !== 'string' || vehicle_image.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error: 'La photo de votre véhicule est obligatoire pour permettre aux passagers de vous reconnaître facilement.',
      });
    }

    // Validation obligatoire de la photo de profil du chauffeur
    if (!avatar_url || typeof avatar_url !== 'string' || avatar_url.trim().length < 50) {
      return res.status(400).json({
        success: false,
        error: 'La photo de profil du chauffeur est obligatoire pour la sécurité de la communauté VORA.',
      });
    }

    // Analyse IA de la photo de profil
    const faceCheck = await verifyDriverFace(avatar_url);
    if (!faceCheck.isPerson) {
      return res.status(400).json({
        success: false,
        error: faceCheck.reason || 'La photo de profil fournie ne représente pas un visage humain valide. Veuillez fournir un selfie clair de face.',
      });
    }

    // 1. Mettre à jour le rôle et l'avatar dans la table users
    await query(
      `UPDATE users 
       SET role = 'DRIVER', 
           avatar_url = COALESCE($1, avatar_url) 
       WHERE id = $2`,
      [avatar_url.trim(), user_id]
    );

    // 2. Insérer ou mettre à jour dans la table drivers
    const insertQuery = `
      INSERT INTO drivers (user_id, vehicle_type, vehicle_model, license_plate, color, vehicle_image, vehicle_documents)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE
      SET vehicle_type = EXCLUDED.vehicle_type,
          vehicle_model = EXCLUDED.vehicle_model,
          license_plate = EXCLUDED.license_plate,
          color = EXCLUDED.color,
          vehicle_image = COALESCE(EXCLUDED.vehicle_image, drivers.vehicle_image),
          vehicle_documents = COALESCE(EXCLUDED.vehicle_documents, drivers.vehicle_documents)
      RETURNING *;
    `;

    const result = await query(insertQuery, [
      user_id,
      vehicle_type || 'taxi',
      vehicle_model.trim(),
      license_plate.trim().toUpperCase(),
      color.trim(),
      vehicle_image.trim(),
      vehicle_documents ? vehicle_documents.trim() : null,
    ]);

    console.log(`[DRIVER REGISTER] Chauffeur ${user_id} enregistré avec véhicule ${vehicle_model} et photo validée IA.`);
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
      `SELECT d.id, d.vehicle_type, d.vehicle_model, d.license_plate, d.color, d.vehicle_image, d.current_lat, d.current_lng, d.rating, u.public_id, u.name, u.avatar_url 
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
