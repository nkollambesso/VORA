import { Router, Request, Response } from 'express';
import { query } from '../db';
import * as crypto from 'crypto';
import bcrypt from 'bcrypt';

const router = Router();

// ─── Environment Configuration ──────────────────────────────────────────────
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_COMMISSION_RATE = parseFloat(process.env.ADMIN_COMMISSION_RATE || '0.10');

const activeSessions = new Map<string, { email: string; expiresAt: number }>();

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function ensureAdminTables() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS admin_accounts (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL DEFAULT 'Administrateur VORA', role VARCHAR(50) DEFAULT 'ADMIN', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`);
    await query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_image TEXT;`);
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;`);
    await query(`CREATE TABLE IF NOT EXISTS admin_wallet (id SERIAL PRIMARY KEY, admin_email VARCHAR(255) UNIQUE NOT NULL, total_commissions INT DEFAULT 0, commission_rate NUMERIC(5,4) DEFAULT 0.1000, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`);
    await query(`CREATE TABLE IF NOT EXISTS support_calls (id SERIAL PRIMARY KEY, user_id VARCHAR(255), user_name VARCHAR(255), user_role VARCHAR(50), reason TEXT NOT NULL, status VARCHAR(50) DEFAULT 'PENDING', assigned_to VARCHAR(255), ride_id VARCHAR(100) REFERENCES rides(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMP WITH TIME ZONE);`);
    await query(`ALTER TABLE support_calls DROP CONSTRAINT IF EXISTS support_calls_user_id_fkey;`);
    await query(`DELETE FROM drivers WHERE user_id IN ('driver-user-1', 'driver-user-2'); DELETE FROM users WHERE id IN ('driver-user-1', 'driver-user-2');`);
    // Insérer l'admin par défaut uniquement si les credentials sont configurés
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await query(`INSERT INTO admin_accounts (email, password_hash, name, role) VALUES ($1, $2, 'Super Administrateur VORA', 'SUPER_ADMIN') ON CONFLICT (email) DO NOTHING;`, [ADMIN_EMAIL, passwordHash]);
    }
    await query(`INSERT INTO admin_wallet (admin_email, total_commissions, commission_rate) VALUES ($1, 0, $2) ON CONFLICT (admin_email) DO NOTHING;`, [ADMIN_EMAIL || 'admin@vora.cm', ADMIN_COMMISSION_RATE]);
    console.log('[ADMIN DB] Tables initialisees.');
  } catch (err) { console.error('[ADMIN DB] Erreur init:', err); }
}
ensureAdminTables();

async function isKnownAdminEmail(email: string): Promise<boolean> {
  const clean = email.trim().toLowerCase();
  if (clean === ADMIN_EMAIL) return true;
  try { const res = await query('SELECT id FROM admin_accounts WHERE LOWER(email) = $1', [clean]); if (res.rows.length > 0) return true; } catch {}
  return false;
}

async function authenticateAdmin(email: string, password: string): Promise<{ valid: boolean; adminRecord?: any }> {
  const clean = email.trim().toLowerCase();
  try {
    const res = await query('SELECT * FROM admin_accounts WHERE LOWER(email) = $1', [clean]);
    if (res.rows.length > 0) {
      const admin = res.rows[0];
      // Vérifier avec bcrypt si le hash est un bcrypt hash, sinon fallback sha256 pour migration
      if (admin.password_hash.startsWith('$2')) {
        const match = await bcrypt.compare(password, admin.password_hash);
        if (match) return { valid: true, adminRecord: admin };
      } else {
        // Legacy sha256 — accepter mais on ne stocke plus en sha256
        const crypto = await import('crypto');
        const sha256 = (input: string) => crypto.createHash('sha256').update(input).digest('hex');
        if (admin.password_hash === sha256(password)) return { valid: true, adminRecord: admin };
      }
      return { valid: false };
    }
  } catch {}
  return { valid: false };
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, isAdmin: false, error: 'Email et mot de passe requis.' });
    const cleanEmail = email.trim().toLowerCase();
    if (!await isKnownAdminEmail(cleanEmail)) return res.status(401).json({ success: false, isAdmin: false, error: 'Identifiants administrateur non reconnus.' });
    await new Promise((r) => setTimeout(r, 400));
    const authResult = await authenticateAdmin(cleanEmail, password);
    if (!authResult.valid) return res.status(401).json({ success: false, isAdmin: true, error: 'Mot de passe administrateur incorrect.' });
    const token = generateSessionToken();
    activeSessions.set(token, { email: cleanEmail, expiresAt: Date.now() + 4 * 60 * 60 * 1000 });
    return res.json({ success: true, isAdmin: true, token, email: cleanEmail, name: authResult.adminRecord?.name || 'Administrateur', role: authResult.adminRecord?.role || 'ADMIN', expiresIn: '4h' });
  } catch (error) { return res.status(500).json({ success: false, error: 'Erreur serveur.' }); }
});

router.post('/verify-token', (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'Token requis.' });
  const session = activeSessions.get(token);
  if (!session) return res.status(401).json({ success: false, error: 'Token invalide.' });
  if (Date.now() > session.expiresAt) { activeSessions.delete(token); return res.status(401).json({ success: false, error: 'Session expiree.' }); }
  return res.json({ success: true, email: session.email });
});

router.post('/logout', (req: Request, res: Response) => {
  const { token } = req.body;
  if (token) activeSessions.delete(token);
  return res.json({ success: true });
});

function requireAdminAuth(req: Request, res: Response, next: any) {
  const token = (req.headers['x-admin-token'] as string) || req.body?.adminToken;
  if (!token) return res.status(401).json({ success: false, error: 'Token admin requis.' });
  const session = activeSessions.get(token);
  if (!session || Date.now() > session.expiresAt) { activeSessions.delete(token || ''); return res.status(401).json({ success: false, error: 'Session expiree.' }); }
  (req as any).adminEmail = session.email;
  (req as any).adminToken = token;
  next();
}

router.get('/admins', requireAdminAuth, async (req: Request, res: Response) => {
  try { const result = await query('SELECT id, email, name, role, created_at, updated_at FROM admin_accounts ORDER BY id ASC'); return res.json({ success: true, admins: result.rows }); }
  catch { return res.status(500).json({ success: false, error: 'Erreur chargement admins.' }); }
});

router.post('/admins', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
    if (password.length < 8) return res.status(400).json({ success: false, error: 'Mot de passe min 8 caracteres.' });
    const allowedRoles = ['ADMIN', 'SUPER_ADMIN', 'SOCIAL_ASSISTANT'];
    const safeRole = allowedRoles.includes(role) ? role : 'ADMIN';
    const cleanEmail = email.trim().toLowerCase();
    const existing = await query('SELECT id FROM admin_accounts WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) return res.status(400).json({ success: false, error: 'Email deja utilise.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(`INSERT INTO admin_accounts (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, created_at`, [cleanEmail, passwordHash, name?.trim() || 'Administrateur VORA', safeRole]);
    return res.status(201).json({ success: true, admin: result.rows[0] });
  } catch { return res.status(500).json({ success: false, error: 'Erreur creation.' }); }
});

router.delete('/admins/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const adminId = parseInt(req.params.id, 10);
    const currentAdminEmail = (req as any).adminEmail;
    const countRes = await query('SELECT COUNT(*) FROM admin_accounts');
    if (parseInt(countRes.rows[0].count, 10) <= 1) return res.status(400).json({ success: false, error: 'Dernier administrateur, suppression impossible.' });
    const target = await query('SELECT * FROM admin_accounts WHERE id = $1', [adminId]);
    if (target.rows.length === 0) return res.status(404).json({ success: false, error: 'Compte introuvable.' });
    if (target.rows[0].email.toLowerCase() === currentAdminEmail.toLowerCase()) return res.status(400).json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    await query('DELETE FROM admin_accounts WHERE id = $1', [adminId]);
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Erreur suppression.' }); }
});

router.put('/profile', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const currentAdminEmail = (req as any).adminEmail;
    const currentToken = (req as any).adminToken;
    const { newEmail, newName, currentPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ success: false, error: 'Mot de passe actuel requis.' });
    const authResult = await authenticateAdmin(currentAdminEmail, currentPassword);
    if (!authResult.valid) return res.status(401).json({ success: false, error: 'Mot de passe incorrect.' });
    const cleanNewEmail = newEmail ? newEmail.trim().toLowerCase() : currentAdminEmail;
    const cleanNewName = newName ? newName.trim() : null;
    if (cleanNewEmail !== currentAdminEmail) {
      const existing = await query('SELECT id FROM admin_accounts WHERE LOWER(email) = $1', [cleanNewEmail]);
      if (existing.rows.length > 0) return res.status(400).json({ success: false, error: 'Email deja utilise.' });
    }
    const result = await query(`UPDATE admin_accounts SET email = COALESCE($1, email), name = COALESCE($2, name), updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = $3 RETURNING id, email, name, role, updated_at`, [cleanNewEmail, cleanNewName, currentAdminEmail]);
    const session = activeSessions.get(currentToken);
    if (session) { session.email = cleanNewEmail; activeSessions.set(currentToken, session); }
    return res.json({ success: true, message: 'Profil mis a jour.', admin: result.rows[0] });
  } catch { return res.status(500).json({ success: false, error: 'Erreur mise a jour profil.' }); }
});

router.put('/change-password', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const currentAdminEmail = (req as any).adminEmail;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: 'Champs requis.' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, error: 'Min 8 caracteres.' });
    const authResult = await authenticateAdmin(currentAdminEmail, currentPassword);
    if (!authResult.valid) return res.status(401).json({ success: false, error: 'Mot de passe actuel incorrect.' });
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await query(`UPDATE admin_accounts SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = $2`, [newPasswordHash, currentAdminEmail]);
    return res.json({ success: true, message: 'Mot de passe modifie.' });
  } catch { return res.status(500).json({ success: false, error: 'Erreur changement mot de passe.' }); }
});

router.get('/accounts', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const usersResult = await query(`SELECT u.id, u.public_id, u.name, u.email, u.phone, u.role, u.verification_status, u.avatar_url, u.wallet_balance, u.is_blocked, u.created_at, d.id as driver_id, d.vehicle_type, d.vehicle_model, d.license_plate, d.color, d.vehicle_image, d.is_online, d.rating FROM users u LEFT JOIN drivers d ON d.user_id = u.id ORDER BY u.created_at DESC`);
    const adminsResult = await query('SELECT id, email, name, role, created_at, updated_at FROM admin_accounts ORDER BY id ASC');
    return res.json({ success: true, users: usersResult.rows, admins: adminsResult.rows });
  } catch { return res.status(500).json({ success: false, error: 'Erreur chargement comptes.' }); }
});

router.post('/users/:id/block', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const { block } = req.body;
    const shouldBlock = block === true || block === 'true';
    const userCheck = await query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ success: false, error: 'Utilisateur introuvable.' });
    await query('UPDATE users SET is_blocked = $1 WHERE id = $2', [shouldBlock, userId]);
    console.log(`[ADMIN] Compte ${userCheck.rows[0].email} ${shouldBlock ? 'bloque' : 'debloque'} par ${(req as any).adminEmail}`);
    return res.json({ success: true, message: `Compte ${shouldBlock ? 'bloque' : 'debloque'}.`, user: { id: userId, is_blocked: shouldBlock } });
  } catch { return res.status(500).json({ success: false, error: 'Erreur blocage.' }); }
});

router.get('/wallet', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const adminEmail = (req as any).adminEmail;
    let walletRes = await query('SELECT * FROM admin_wallet WHERE admin_email = $1', [adminEmail]);
    if (walletRes.rows.length === 0) walletRes = await query('SELECT * FROM admin_wallet ORDER BY id ASC LIMIT 1');
    const rate = parseFloat(walletRes.rows[0]?.commission_rate) || ADMIN_COMMISSION_RATE;
    const recent = await query(`SELECT r.id, r.fare_fcfa, r.created_at, u.name as rider_name FROM rides r LEFT JOIN users u ON u.id = r.rider_id WHERE r.status = 'COMPLETED' AND r.payment_status = 'PAID' ORDER BY r.created_at DESC LIMIT 20`);
    const recentWithCommission = recent.rows.map((r: any) => ({ ...r, commission_amount: Math.round((r.fare_fcfa || 0) * rate) }));
    return res.json({ success: true, wallet: walletRes.rows[0] || { total_commissions: 0, commission_rate: ADMIN_COMMISSION_RATE }, recent_commissions: recentWithCommission });
  } catch (err: any) { console.error('[ADMIN WALLET] Erreur:', err?.message); return res.status(500).json({ success: false, error: 'Erreur portefeuille.' }); }
});

router.put('/wallet/rate', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const adminEmail = (req as any).adminEmail;
    const parsedRate = parseFloat(req.body.rate);
    if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 0.5) return res.status(400).json({ success: false, error: 'Taux entre 0 et 50% requis.' });
    await query(`INSERT INTO admin_wallet (admin_email, total_commissions, commission_rate) VALUES ($1, 0, $2) ON CONFLICT (admin_email) DO UPDATE SET commission_rate = $2, updated_at = CURRENT_TIMESTAMP`, [adminEmail, parsedRate]);
    return res.json({ success: true, message: `Taux mis a jour a ${(parsedRate * 100).toFixed(1)}%.`, rate: parsedRate });
  } catch { return res.status(500).json({ success: false, error: 'Erreur mise a jour taux.' }); }
});

export async function creditAdminCommission(rideFare: number): Promise<void> {
  try {
    const walletRes = await query('SELECT commission_rate FROM admin_wallet ORDER BY id ASC LIMIT 1');
    const rate = parseFloat(walletRes.rows[0]?.commission_rate || String(ADMIN_COMMISSION_RATE));
    const commission = Math.round(rideFare * rate);
    if (commission <= 0) return;
    await query(`UPDATE admin_wallet SET total_commissions = total_commissions + $1, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM admin_wallet ORDER BY id ASC LIMIT 1)`, [commission]);
    console.log(`[ADMIN WALLET] Commission ${commission} FCFA creditee.`);
  } catch (err) { console.error('[ADMIN WALLET] Erreur:', err); }
}

router.get('/support-calls', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const result = await query(`SELECT sc.*, u.name as user_full_name, u.email as user_email, u.role as user_type FROM support_calls sc LEFT JOIN users u ON u.id = sc.user_id ORDER BY sc.created_at DESC`);
    return res.json({ success: true, calls: result.rows });
  } catch { return res.status(500).json({ success: false, error: 'Erreur chargement appels.' }); }
});

router.post('/support-calls', async (req: Request, res: Response) => {
  try {
    const { user_id, user_name, user_role, reason, ride_id } = req.body;
    if (!user_id || !reason || reason.trim().length < 5) return res.status(400).json({ success: false, error: 'user_id et reason requis.' });
    const result = await query(`INSERT INTO support_calls (user_id, user_name, user_role, reason, ride_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [user_id, user_name || 'Utilisateur', user_role || 'PASSENGER', reason.trim(), ride_id || null]);
    return res.status(201).json({ success: true, call: result.rows[0] });
  } catch (err) {
    console.error('Erreur creation appel:', err);
    return res.status(500).json({ success: false, error: 'Erreur creation appel.' });
  }
});

router.put('/support-calls/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const callId = parseInt(req.params.id, 10);
    const { status, assigned_to } = req.body;
    const adminEmail = (req as any).adminEmail;
    if (!['PENDING', 'ASSIGNED', 'RESOLVED', 'CLOSED'].includes(status)) return res.status(400).json({ success: false, error: 'Statut invalide.' });
    const isResolved = status === 'RESOLVED' || status === 'CLOSED';
    const result = await query(`UPDATE support_calls SET status = $1, assigned_to = COALESCE($2, assigned_to), resolved_at = ${isResolved ? 'CURRENT_TIMESTAMP' : 'resolved_at'} WHERE id = $3 RETURNING *`, [status, assigned_to || adminEmail, callId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Appel introuvable.' });
    return res.json({ success: true, call: result.rows[0] });
  } catch { return res.status(500).json({ success: false, error: 'Erreur mise a jour appel.' }); }
});

router.post('/toggle-simulation', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { enable, adminEmail } = req.body;
    const value = enable ? 'true' : 'false';
    const result = await query(`INSERT INTO platform_settings (key, value, updated_by, updated_at) VALUES ('payment_simulation_mode', $1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP RETURNING *;`, [value, adminEmail || 'admin@vora.cm']);
    return res.json({ success: true, isSimulation: value === 'true', setting: result.rows[0] });
  } catch { return res.status(500).json({ success: false, error: 'Erreur toggle simulation.' }); }
});

router.get('/dashboard-stats', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const [totalUsers, totalDrivers, onlineDrivers, totalRides, completedRides, totalRevenue, simSetting, blockedUsers, pendingSupport, adminWalletData] = await Promise.all([
      query(`SELECT COUNT(*) FROM users WHERE role != 'DRIVER'`),
      query(`SELECT COUNT(*) FROM drivers`),
      query(`SELECT COUNT(*) FROM drivers WHERE is_online = TRUE`),
      query(`SELECT COUNT(*) FROM rides`),
      query(`SELECT COUNT(*) FROM rides WHERE status = 'COMPLETED'`),
      query(`SELECT COALESCE(SUM(fare_fcfa), 0) as sum FROM rides WHERE status = 'COMPLETED'`),
      query(`SELECT value FROM platform_settings WHERE key = 'payment_simulation_mode'`),
      query(`SELECT COUNT(*) FROM users WHERE is_blocked = TRUE`),
      query(`SELECT COUNT(*) FROM support_calls WHERE status = 'PENDING'`),
      query(`SELECT total_commissions, commission_rate FROM admin_wallet ORDER BY id ASC LIMIT 1`),
    ]);
    return res.json({ success: true, stats: {
      totalUsers: parseInt(totalUsers.rows[0].count, 10),
      totalDrivers: parseInt(totalDrivers.rows[0].count, 10),
      onlineDrivers: parseInt(onlineDrivers.rows[0].count, 10),
      totalRides: parseInt(totalRides.rows[0].count, 10),
      completedRides: parseInt(completedRides.rows[0].count, 10),
      totalRevenueFcfa: parseInt(totalRevenue.rows[0].sum || '0', 10),
      isSimulationMode: simSetting.rows[0]?.value === 'true',
      blockedUsers: parseInt(blockedUsers.rows[0].count, 10),
      pendingSupportCalls: parseInt(pendingSupport.rows[0].count, 10),
      adminCommissions: parseInt(adminWalletData.rows[0]?.total_commissions || '0', 10),
      commissionRate: parseFloat(adminWalletData.rows[0]?.commission_rate || '0.10'),
    }});
  } catch (error) { console.error('Erreur stats admin:', error); return res.status(500).json({ success: false, error: 'Erreur serveur stats.' }); }
});
router.post('/reset-database', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    await query(`
      TRUNCATE TABLE support_calls, ride_disputes, sos_alerts, location_photos, rides CASCADE;
      DELETE FROM drivers;
      DELETE FROM users;
      UPDATE admin_wallet SET total_commissions = 0;
    `);
    console.log('[ADMIN] Base de données vidée à la demande de l\'administrateur.');
    return res.json({ success: true, message: 'Base de données réinitialisée avec succès (courses, chauffeurs, usagers vidés).' });
  } catch (err: any) {
    console.error('Erreur reset DB:', err);
    return res.status(500).json({ success: false, error: 'Erreur nettoyage base de données: ' + (err.message || err) });
  }
});

export default router;
