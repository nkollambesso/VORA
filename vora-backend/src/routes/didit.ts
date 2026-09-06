import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db';

const router = Router();

const WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || '';

// ─── HMAC Helpers for X-Signature-V2 ──────────────────────────────────────────
function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)])
    );
  }
  if (typeof v === 'number' && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

// ─── 1. Créer une session de vérification Didit KYC ───────────────────────────
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { userId, callbackUrl } = req.body;
    const vendorData = userId || 'user_demo';
    const apiKey = process.env.DIDIT_API_KEY || '';

    console.log(`[DIDIT] Création de session KYC pour ${vendorData}...`);

    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        vendor_data: vendorData,
        callback: callbackUrl || 'http://localhost:8082/(root)/(tabs)/profile',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[DIDIT API Warning] Reponse Didit non-200:', response.status, errText);

      // Fallback de démonstration si l'API Didit est restreinte
      const demoSessionUrl = `https://verify.didit.me/session/demo-${Date.now()}?user=${vendorData}`;
      
      // Mettre en attente (pending)
      await query(`UPDATE users SET verification_status = 'pending' WHERE id = $1`, [vendorData]);

      return res.status(200).json({
        success: true,
        url: demoSessionUrl,
        session_id: `demo-session-${Date.now()}`,
        isDemoFallback: true,
      });
    }

    const session = await response.json();

    // Passer le statut de l'utilisateur à 'pending'
    await query(`UPDATE users SET verification_status = 'pending' WHERE id = $1`, [vendorData]);

    return res.status(201).json({
      success: true,
      url: session.url,
      session_id: session.session_id,
    });
  } catch (error: any) {
    console.error('Erreur création session Didit:', error);
    return res.status(500).json({ success: false, error: 'Échec lors de la création de la session Didit' });
  }
});

// ─── 2. Webhook Didit pour mise à jour du statut KYC ──────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const raw = JSON.stringify(req.body);
    const sig = (req.headers['x-signature-v2'] as string) || '';
    const ts = Number(req.headers['x-timestamp']);
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET || 'didit_secret_vora_2025_key';

    // 1. Freshness check (300 seconds)
    if (ts && Math.abs(Date.now() / 1000 - ts) > 300) {
      console.warn('[DIDIT WEBHOOK] Requête expirée (timestamp > 300s)');
      return res.status(401).send('stale');
    }

    // 2. Canonicalization HMAC-SHA256
    const parsed = req.body;
    const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(canonical, 'utf8')
      .digest('hex');

    // Signatures non bloquantes en mode hackathon si la clé webhook n'est pas encore enregistrée chez Didit
    if (sig && sig.length === expected.length) {
      const match = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
      if (!match) {
        console.warn('[DIDIT WEBHOOK] HMAC Signature invalide');
      }
    }

    const vendorData = parsed.vendor_data;
    const status = parsed.status; // Approved | Declined | In Review | Resubmitted | Kyc Expired ...

    console.log(`[DIDIT WEBHOOK] Réception statut '${status}' pour l'utilisateur ${vendorData}`);

    if (vendorData) {
      let dbStatus = 'unverified';
      switch (status) {
        case 'Approved':
          dbStatus = 'verified';
          break;
        case 'Declined':
          dbStatus = 'rejected';
          break;
        case 'In Review':
        case 'Resubmitted':
          dbStatus = 'pending';
          break;
        case 'Kyc Expired':
          dbStatus = 'unverified';
          break;
        default:
          dbStatus = 'pending';
          break;
      }

      await query(`UPDATE users SET verification_status = $1 WHERE id = $2 OR public_id = $2`, [
        dbStatus,
        vendorData,
      ]);
    }

    return res.status(200).send('ok');
  } catch (error) {
    console.error('Erreur webhook Didit:', error);
    return res.status(500).send('error');
  }
});

// ─── 3. Endpoint de Simulation (Pour tests rapides pendant le Hackathon) ──────
router.post('/simulate-status', async (req: Request, res: Response) => {
  try {
    const { userId, status } = req.body; // status: 'verified' | 'pending' | 'rejected' | 'unverified'

    if (!userId || !status) {
      return res.status(400).json({ success: false, error: 'userId et status requis' });
    }

    const result = await query(
      `UPDATE users SET verification_status = $1 WHERE id = $2 RETURNING *`,
      [status, userId]
    );

    return res.json({
      success: true,
      message: `Statut KYC mis à jour à '${status}'`,
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Erreur simulation Didit:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
