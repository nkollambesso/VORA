import { Router, Request, Response } from 'express';
import { query } from '../db';
import { generatePublicId, formatDisplayName } from '../utils/anonymize';

const router = Router();

// Créer ou mettre à jour un utilisateur (Clerk Sync)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, email, phone, role, avatar_url } = req.body;
    const newPublicId = generatePublicId();

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
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
    }

    let user = result.rows[0];

    // S'assurer qu'un public_id existe
    if (!user.public_id) {
      const pId = generatePublicId();
      const upRes = await query(`UPDATE users SET public_id = $1 WHERE id = $2 RETURNING *`, [pId, id]);
      user = upRes.rows[0];
    }

    const display_name = formatDisplayName(user.name);

    return res.json({
      success: true,
      user: {
        ...user,
        display_name,
      },
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
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
