import { Router, Request, Response } from 'express';
import { query } from '../db';
import * as crypto from 'crypto';

const router = Router();

// ─── Environment Fallbacks ──────────────────────────────────────────────────
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@vora.cm').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'VoraAdmin2025!';

// In-memory session store: token -> { email: string, expiresAt: number }
const activeSessions = new Map<string, { email: string; expiresAt: number }>();

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Database Initialization & Migrations for Admin & Drivers ───────────────
async function ensureAdminTables() {
  try {
    // 1. Create admin_accounts table
    await query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT 'Administrateur VORA',
        role VARCHAR(50) DEFAULT 'SUPER_ADMIN',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ensure vehicle_image column exists on drivers table
    await query(`
      ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_image TEXT;
    `);

    // 3. Purge mock demo drivers from database
    await query(`
      DELETE FROM drivers WHERE user_id IN ('driver-user-1', 'driver-user-2');
      DELETE FROM users WHERE id IN ('driver-user-1', 'driver-user-2');
    `);

    // 4. Seed initial default admin if table is empty
    const defaultHash = sha256(ADMIN_PASSWORD);
    await query(`
      INSERT INTO admin_accounts (email, password_hash, name, role)
      VALUES ($1, $2, 'Super Administrateur VORA', 'SUPER_ADMIN')
      ON CONFLICT (email) DO NOTHING;
    `, [ADMIN_EMAIL, defaultHash]);

    console.log('[ADMIN DB] Tables d\'administration et schema chauffeur initialisés.');
  } catch (err) {
    console.error('[ADMIN DB] Erreur lors de l\'initialisation des tables admin:', err);
  }
}
ensureAdminTables();

// ─── Verify if an email belongs to an Admin ─────────────────────────────────
async function isKnownAdminEmail(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (clean === ADMIN_EMAIL) return true;

  try {
    const res = await query('SELECT id FROM admin_accounts WHERE LOWER(email) = $1', [clean]);
    if (res.rows.length > 0) return true;
  } catch {}

  const credJson = process.env.ADMIN_CREDENTIALS;
  if (credJson) {
    try {
      const creds: Array<{ email: string }> = JSON.parse(credJson);
      return creds.some((c) => c.email?.trim().toLowerCase() === clean);
    } catch {}
  }

  return false;
}

// ─── Verify Admin Credentials ───────────────────────────────────────────────
async function authenticateAdmin(email: string, password: string): Promise<{ valid: boolean; adminRecord?: any }> {
  const clean = email.trim().toLowerCase();
  const passwordHash = sha256(password);

  // 1. Check database first (dynamic, allows changed passwords)
  try {
    const res = await query('SELECT * FROM admin_accounts WHERE LOWER(email) = $1', [clean]);
    if (res.rows.length > 0) {
      const admin = res.rows[0];
      if (admin.password_hash === passwordHash) {
        return { valid: true, adminRecord: admin };
      }
      return { valid: false };
    }
  } catch {}

  // 2. Fallback to process.env credentials
  if (clean === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    return { valid: true, adminRecord: { email: ADMIN_EMAIL, name: 'Super Admin', role: 'SUPER_ADMIN' } };
  }

  // 3. Fallback to ADMIN_CREDENTIALS json
  const credJson = process.env.ADMIN_CREDENTIALS;
  if (credJson) {
    try {
      const creds: Array<{ email: string; password?: string; passwordHash?: string }> = JSON.parse(credJson);
      const match = creds.find((c) => {
        if (c.email?.trim().toLowerCase() !== clean) return false;
        if (c.passwordHash) return passwordHash === c.passwordHash;
        if (c.password) return c.password === password;
        return false;
      });
      if (match) return { valid: true, adminRecord: match };
    } catch {}
  }

  return { valid: false };
}

// ─── POST /api/admin/login ────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, isAdmin: false, error: 'Email et mot de passe requis.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if this email is a configured admin email
    const isAdminCandidate = await isKnownAdminEmail(cleanEmail);
    if (!isAdminCandidate) {
      return res.status(401).json({
        success: false,
        isAdmin: false,
        error: 'Identifiants administrateur non reconnus.',
      });
    }

    // Email belongs to an admin — apply brute-force delay
    await new Promise((r) => setTimeout(r, 400));

    const authResult = await authenticateAdmin(cleanEmail, password);
    if (!authResult.valid) {
      console.warn(`[ADMIN AUTH] Mot de passe invalide pour admin: ${cleanEmail}`);
      return res.status(401).json({
        success: false,
        isAdmin: true,
        error: 'Mot de passe administrateur incorrect.',
      });
    }

    // Create 4-hour session token
    const token = generateSessionToken();
    const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4h
    activeSessions.set(token, { email: cleanEmail, expiresAt });

    console.log(`[ADMIN AUTH] Connexion réussie pour admin: ${cleanEmail}`);

    return res.json({
      success: true,
      isAdmin: true,
      token,
      email: cleanEmail,
      name: authResult.adminRecord?.name || 'Administrateur',
      role: authResult.adminRecord?.role || 'ADMIN',
      expiresIn: '4h',
      message: 'Authentification administrateur réussie.',
    });
  } catch (error) {
    console.error('Erreur login admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

// ─── POST /api/admin/verify-token ────────────────────────────────────────────
router.post('/verify-token', (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: 'Token requis.' });
  }

  const session = activeSessions.get(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Token invalide ou expiré.' });
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
  }

  return res.json({ success: true, email: session.email });
});

// ─── POST /api/admin/logout ───────────────────────────────────────────────────
router.post('/logout', (req: Request, res: Response) => {
  const { token } = req.body;
  if (token) activeSessions.delete(token);
  return res.json({ success: true, message: 'Déconnexion admin effectuée.' });
});

// ─── Middleware: validate admin token for protected routes ────────────────────
function requireAdminAuth(req: Request, res: Response, next: any) {
  const token = (req.headers['x-admin-token'] as string) || req.body?.adminToken;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Accès non autorisé. Token admin requis.' });
  }
  const session = activeSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    activeSessions.delete(token || '');
    return res.status(401).json({ success: false, error: 'Session admin expirée.' });
  }
  (req as any).adminEmail = session.email;
  (req as any).adminToken = token;
  next();
}

// ─── GET /api/admin/admins (List all admin accounts) ─────────────────────────
router.get('/admins', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, created_at, updated_at FROM admin_accounts ORDER BY id ASC'
    );
    return res.json({ success: true, admins: result.rows });
  } catch (error) {
    console.error('Erreur liste admins:', error);
    return res.status(500).json({ success: false, error: 'Impossible de charger la liste des administrateurs.' });
  }
});

// ─── POST /api/admin/admins (Create new admin account) ───────────────────────
router.post('/admins', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit comporter au moins 8 caractères.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM admin_accounts WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Un compte administrateur avec cette adresse existe déjà.' });
    }

    const passwordHash = sha256(password);
    const result = await query(
      `INSERT INTO admin_accounts (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [cleanEmail, passwordHash, name?.trim() || 'Administrateur VORA', role || 'ADMIN']
    );

    console.log(`[ADMIN ACCOUNTS] Nouvel administrateur créé : ${cleanEmail}`);
    return res.status(201).json({ success: true, admin: result.rows[0], message: 'Compte administrateur créé.' });
  } catch (error) {
    console.error('Erreur création admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la création de l\'administrateur.' });
  }
});

// ─── DELETE /api/admin/admins/:id (Delete admin account) ─────────────────────
router.delete('/admins/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    const currentAdminEmail = (req as any).adminEmail;

    // Check count
    const countRes = await query('SELECT COUNT(*) FROM admin_accounts');
    const totalAdmins = parseInt(countRes.rows[0].count, 10);
    if (totalAdmins <= 1) {
      return res.status(400).json({ success: false, error: 'Impossible de supprimer le dernier compte administrateur.' });
    }

    // Check target admin
    const target = await query('SELECT * FROM admin_accounts WHERE id = $1', [adminId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Administrateur introuvable.' });
    }

    if (target.rows[0].email.toLowerCase() === currentAdminEmail.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte en cours d\'utilisation.' });
    }

    await query('DELETE FROM admin_accounts WHERE id = $1', [adminId]);
    console.log(`[ADMIN ACCOUNTS] Administrateur #${adminId} supprimé.`);
    return res.json({ success: true, message: 'Compte administrateur supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur suppression admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la suppression.' });
  }
});

// ─── PUT /api/admin/profile (Update current admin email / name) ──────────────
router.put('/profile', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const currentAdminEmail = (req as any).adminEmail;
    const currentToken = (req as any).adminToken;
    const { newEmail, newName, currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ success: false, error: 'Mot de passe actuel requis pour modifier votre profil.' });
    }

    // Authenticate current password
    const authResult = await authenticateAdmin(currentAdminEmail, currentPassword);
    if (!authResult.valid) {
      return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect.' });
    }

    const cleanNewEmail = newEmail ? newEmail.trim().toLowerCase() : currentAdminEmail;
    const cleanNewName = newName ? newName.trim() : null;

    // Check if changing email and email is taken
    if (cleanNewEmail !== currentAdminEmail) {
      const existing = await query('SELECT id FROM admin_accounts WHERE LOWER(email) = $1', [cleanNewEmail]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ success: false, error: 'Cette adresse email est déjà utilisée.' });
      }
    }

    const result = await query(
      `UPDATE admin_accounts
       SET email = COALESCE($1, email),
           name = COALESCE($2, name),
           updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(email) = $3
       RETURNING id, email, name, role, updated_at`,
      [cleanNewEmail, cleanNewName, currentAdminEmail]
    );

    // Update active session memory
    const session = activeSessions.get(currentToken);
    if (session) {
      session.email = cleanNewEmail;
      activeSessions.set(currentToken, session);
    }

    console.log(`[ADMIN PROFILE] Profil mis à jour : ${currentAdminEmail} -> ${cleanNewEmail}`);
    return res.json({
      success: true,
      message: 'Profil administrateur mis à jour avec succès.',
      admin: result.rows[0] || { email: cleanNewEmail, name: cleanNewName },
    });
  } catch (error) {
    console.error('Erreur mise à jour profil admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du profil.' });
  }
});

// ─── PUT /api/admin/change-password (Update current admin password) ──────────
router.put('/change-password', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const currentAdminEmail = (req as any).adminEmail;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Mot de passe actuel et nouveau mot de passe requis.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' });
    }

    // Verify current password
    const authResult = await authenticateAdmin(currentAdminEmail, currentPassword);
    if (!authResult.valid) {
      return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect.' });
    }

    const newHash = sha256(newPassword);

    await query(
      `UPDATE admin_accounts
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(email) = $2`,
      [newHash, currentAdminEmail]
    );

    console.log(`[ADMIN PASSWORD] Mot de passe mis à jour pour admin : ${currentAdminEmail}`);
    return res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
  } catch (error) {
    console.error('Erreur changement mot de passe admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors du changement de mot de passe.' });
  }
});

// ─── GET /api/admin/accounts (Unified User & Driver Accounts Management) ────
router.get('/accounts', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const usersResult = await query(
      `SELECT u.id, u.public_id, u.name, u.email, u.phone, u.role, u.verification_status, u.avatar_url, u.wallet_balance, u.created_at,
              d.id as driver_id, d.vehicle_type, d.vehicle_model, d.license_plate, d.color, d.vehicle_image, d.is_online, d.rating
       FROM users u
       LEFT JOIN drivers d ON d.user_id = u.id
       ORDER BY u.created_at DESC`
    );

    const adminsResult = await query(
      'SELECT id, email, name, role, created_at, updated_at FROM admin_accounts ORDER BY id ASC'
    );

    return res.json({
      success: true,
      users: usersResult.rows,
      admins: adminsResult.rows,
    });
  } catch (error) {
    console.error('Erreur listing comptes admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors du chargement des comptes.' });
  }
});

// ─── POST /api/admin/toggle-simulation (protected) ───────────────────────────
router.post('/toggle-simulation', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { enable, adminEmail } = req.body;
    const value = enable ? 'true' : 'false';

    const result = await query(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at)
       VALUES ('payment_simulation_mode', $1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *;`,
      [value, adminEmail || 'admin@vora.cm']
    );

    console.log(`[SUPER ADMIN] Mode simulation CamerPay basculé sur: ${value}`);

    return res.json({
      success: true,
      isSimulation: value === 'true',
      setting: result.rows[0],
      message: `Mode simulation CamerPay ${value === 'true' ? 'ACTIVÉ' : 'DÉSACTIVÉ'}.`,
    });
  } catch (error) {
    console.error('Erreur toggle simulation admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur admin' });
  }
});

// ─── GET /api/admin/dashboard-stats (protected) ──────────────────────────────
router.get('/dashboard-stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const totalUsers = await query(`SELECT COUNT(*) FROM users`);
    const totalDrivers = await query(`SELECT COUNT(*) FROM drivers`);
    const onlineDrivers = await query(`SELECT COUNT(*) FROM drivers WHERE is_online = TRUE`);
    const totalRides = await query(`SELECT COUNT(*) FROM rides`);
    const completedRides = await query(`SELECT COUNT(*) FROM rides WHERE status = 'COMPLETED'`);
    const totalRevenue = await query(`SELECT SUM(fare_fcfa) FROM rides WHERE status = 'COMPLETED'`);
    const simSetting = await query(`SELECT value FROM platform_settings WHERE key = 'payment_simulation_mode'`);

    return res.json({
      success: true,
      stats: {
        totalUsers: parseInt(totalUsers.rows[0].count, 10),
        totalDrivers: parseInt(totalDrivers.rows[0].count, 10),
        onlineDrivers: parseInt(onlineDrivers.rows[0].count, 10),
        totalRides: parseInt(totalRides.rows[0].count, 10),
        completedRides: parseInt(completedRides.rows[0].count, 10),
        totalRevenueFcfa: parseInt(totalRevenue.rows[0].sum || '0', 10),
        isSimulationMode: simSetting.rows[0]?.value === 'true',
      },
    });
  } catch (error) {
    console.error('Erreur stats admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur stats' });
  }
});

export default router;
