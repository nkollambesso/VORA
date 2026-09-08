import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// Endpoint d'initiation et de traitement de paiement CamerPay
router.post('/pay', async (req: Request, res: Response) => {
  try {
    const { amount, phone, operator, rideId, description } = req.body;

    if (!amount || !phone || !operator || !rideId) {
      return res.status(400).json({ success: false, error: 'Paramètres de paiement manquants' });
    }

    // 1. Vérifier si le mode simulation est activé dans la plateforme
    const settingRes = await query(
      `SELECT value FROM platform_settings WHERE key = 'payment_simulation_mode'`
    );
    const isSimulation = settingRes.rows.length > 0 ? settingRes.rows[0].value === 'true' : true;

    if (isSimulation) {
      // ⚡ MODE SIMULATION ACTIVÉ (Hackathon / Démo Super Admin)
      console.log(`💳 [SIMULATION CAMERPAY] Traitement simulation pour ${phone} (${operator.toUpperCase()}) - ${amount} FCFA`);

      const transactionId = `SIM-CP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Mettre à jour le statut du paiement dans la table rides
      await query(
        `UPDATE rides SET payment_status = 'PAID', payment_method = $1 WHERE id = $2`,
        [operator === 'mtn' ? 'MTN_MOMO' : operator === 'orange' ? 'ORANGE_MONEY' : 'CASH', rideId]
      );

      return res.status(200).json({
        success: true,
        mode: 'simulation',
        transactionId,
        operator,
        phone,
        amount,
        message: `Paiement simulé réussi via ${operator === 'mtn' ? 'MTN Mobile Money' : 'Orange Money'} !`,
      });
    }

    // 💳 MODE RÉEL (API CamerPay Directe: https://camerpay.biz/api)
    console.log(`💳 [RÉEL CAMERPAY] Envoi requête API CamerPay pour ${phone} - ${amount} FCFA`);

    const camerPayApiKey = process.env.CAMERPAY_API_KEY || process.env.CAMERPAY_SECRET_KEY;
    const camerPayApiUrl = process.env.CAMERPAY_API_URL || 'https://camerpay.biz/api';

    if (!camerPayApiKey) {
      return res.status(500).json({
        success: false,
        error: 'Clé API CamerPay non configurée sur le serveur.',
      });
    }

    const camerPayResponse = await fetch(`${camerPayApiUrl}/v1/payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${camerPayApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        phone,
        operator,
        reference: rideId,
        description: description || `Paiement Course VORA ${rideId}`,
      }),
    });

    const data: any = await camerPayResponse.json();

    if (camerPayResponse.ok && data.status === 'SUCCESS') {
      await query(
        `UPDATE rides SET payment_status = 'PAID', payment_method = $1 WHERE id = $2`,
        [operator === 'mtn' ? 'MTN_MOMO' : 'ORANGE_MONEY', rideId]
      );

      return res.status(200).json({
        success: true,
        mode: 'live',
        transactionId: data.transactionId || `CP-${Date.now()}`,
        data,
      });
    } else {
      return res.status(400).json({
        success: false,
        mode: 'live',
        error: data.message || 'Échec du paiement CamerPay',
      });
    }
  } catch (error: any) {
    console.error('Erreur traitement CamerPay:', error);
    return res.status(500).json({ success: false, error: error.message || 'Erreur serveur CamerPay' });
  }
});

// Récupérer le statut actuel du mode simulation CamerPay
router.get('/mode', async (req: Request, res: Response) => {
  try {
    const settingRes = await query(
      `SELECT value, updated_by, updated_at FROM platform_settings WHERE key = 'payment_simulation_mode'`
    );

    const isSimulation = settingRes.rows.length > 0 ? settingRes.rows[0].value === 'true' : true;
    return res.json({
      success: true,
      isSimulation,
      updatedBy: settingRes.rows[0]?.updated_by || 'system',
      updatedAt: settingRes.rows[0]?.updated_at,
    });
  } catch (error) {
    console.error('Erreur récupération mode CamerPay:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
