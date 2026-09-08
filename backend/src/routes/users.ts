import { Router, Request, Response } from 'express';
import { query } from '../db';
import { generatePublicId, formatDisplayName } from '../utils/anonymize';

const router = Router();

// Créer ou mettre à jour un utilisateur (Clerk Sync)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, email, phone, role, avatar_url } = req.body;
    const newPublicId = generatePublicId();

    // Vérifier si le compte est suspendu
    const existingCheck = await query(`SELECT is_blocked FROM users WHERE id = $1`, [id]);
    if (existingCheck.rows.length > 0 && existingCheck.rows[0].is_blocked) {
      return res.status(403).json({
        success: false,
        is_blocked: true,
        error: 'Votre compte a été suspendu par un administrateur VORA.',
      });
    }

    const upsertQuery = `
      INSERT INTO users (id, public_id, name, email, phone, role, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          role = COALESCE(EXCLUDED.role, users.role),
          avatar_url = EXCLUDED.avatar_url,
          public_id = COALESCE(users.public_id, EXCLUDED.public_id)
      RETURNING *;
    `;

    const result = await query(upsertQuery, [
      id,
      newPublicId,
      name,
      email,
      phone || null,
      role || 'PASSENGER',
      avatar_url || null,
    ]);

    const user = result.rows[0];
    const display_name = formatDisplayName(user.name);

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        wallet_balance: Number(user.wallet_balance) || 0,
        cancellation_debt: Number(user.cancellation_debt) || 0,
        display_name,
      },
    });
  } catch (error) {
    console.error('Erreur upsert user:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la sauvegarde utilisateur' });
  }
});

// Récupérer le profil utilisateur privé complet (pour le propriétaire lui-même)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let result = await query(`SELECT * FROM users WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      // Si l'utilisateur n'existe pas encore dans la BD, retourner un profil par défaut sans crash 500
      const defaultPublicId = generatePublicId();
      return res.status(200).json({
        success: true,
        user: {
          id,
          public_id: defaultPublicId,
          name: "Utilisateur VORA",
          email: "",
          phone: "",
          role: "PASSENGER",
          verification_status: "unverified",
          display_name: "Utilisateur VORA",
          wallet_balance: 0,
          cancellation_debt: 0,
        },
      });
    }

    let user = result.rows[0];

    // S'assurer qu'un public_id existe
    if (!user.public_id) {
      const pId = generatePublicId();
      try {
        const upRes = await query(`UPDATE users SET public_id = $1 WHERE id = $2 RETURNING *`, [pId, id]);
        if (upRes.rows.length > 0) user = upRes.rows[0];
      } catch (e) {
        user.public_id = pId;
      }
    }

    const display_name = formatDisplayName(user.name || 'Utilisateur');

    if (user.is_blocked) {
      return res.status(403).json({
        success: false,
        is_blocked: true,
        error: 'Votre compte a été suspendu par un administrateur VORA.',
        user: {
          ...user,
          is_blocked: true,
          display_name,
        },
      });
    }

    return res.json({
      success: true,
      user: {
        ...user,
        wallet_balance: Number(user.wallet_balance) || 0,
        cancellation_debt: Number(user.cancellation_debt) || 0,
        verification_status: user.verification_status || 'unverified',
        is_blocked: !!user.is_blocked,
        display_name,
      },
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    return res.status(200).json({
      success: true,
      user: {
        id: req.params.id,
        public_id: generatePublicId(),
        name: "Utilisateur VORA",
        verification_status: "unverified",
        display_name: "Utilisateur VORA",
        wallet_balance: 0,
        cancellation_debt: 0,
      },
    });
  }
});

// Recharger le portefeuille in-app VORA
router.post('/:id/topup', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, phone, operator } = req.body;
    const rechargeAmount = Math.max(0, parseInt(amount, 10) || 0);

    if (rechargeAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Montant de recharge invalide' });
    }

    // Tenter la mise à jour du solde
    const updateRes = await query(
      `UPDATE users 
       SET wallet_balance = COALESCE(wallet_balance, 0) + $1 
       WHERE id = $2 
       RETURNING *`,
      [rechargeAmount, id]
    );

    let newBalance = rechargeAmount;

    if (updateRes.rows.length === 0) {
      // Utilisateur non existant dans la base: l'insérer avec le nouveau solde
      const newPublicId = generatePublicId();
      const insertRes = await query(
        `INSERT INTO users (id, public_id, name, email, phone, role, wallet_balance)
         VALUES ($1, $2, 'Utilisateur VORA', $3, $4, 'PASSENGER', $5)
         RETURNING *`,
        [id, newPublicId, `${id}@vora.app`, phone || null, rechargeAmount]
      );
      if (insertRes.rows.length > 0) {
        newBalance = Number(insertRes.rows[0].wallet_balance) || rechargeAmount;
      }
    } else {
      newBalance = Number(updateRes.rows[0].wallet_balance) || 0;
    }

    console.log(`💰 [WALLET TOPUP] User ${id} rechargé de ${rechargeAmount} FCFA via ${operator || 'MoMo'}. Nouveau solde: ${newBalance} FCFA`);

    return res.status(200).json({
      success: true,
      wallet_balance: newBalance,
      amount: rechargeAmount,
      operator: operator || 'mtn',
      message: `Recharge de ${rechargeAmount.toLocaleString()} FCFA effectuée avec succès !`,
    });
  } catch (error: any) {
    console.error('Erreur recharge portefeuille:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Erreur serveur lors de la recharge' });
  }
});

// Récupérer uniquement le profil PUBLIC anonymisé (pour les autres utilisateurs)
router.get('/public/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(`SELECT id, public_id, name, avatar_url, role FROM users WHERE id = $1 OR public_id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Profil public introuvable' });
    }

    const u = result.rows[0];
    return res.json({
      success: true,
      publicProfile: {
        public_id: u.public_id || generatePublicId(),
        display_name: formatDisplayName(u.name),
        avatar_url: u.avatar_url,
        role: u.role,
      },
    });
  } catch (error) {
    console.error('Erreur profil public:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
