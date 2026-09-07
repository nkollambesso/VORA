import { Router, Request, Response } from 'express';
import { query } from '../db';
import * as crypto from 'crypto';

const router = Router();

// ─── Admin Credentials (env-based, never exposed client-side) ───────────────
// Set these in backend/.env:
//   ADMIN_EMAIL=admin@vora.cm
//   ADMIN_PASSWORD=VoraAdmin2025!  (plain text for comparison — use hashed in prod)
// Multiple admins can be defined via ADMIN_CREDENTIALS as JSON array:
//   ADMIN_CREDENTIALS=[{"email":"admin@vora.cm","passwordHash":"sha256hex"}]
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@vora.cm';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'VoraAdmin2025!';

// In-memory session store (replace with Redis/DB in production)
const activeSessions = new Map<string, { email: string; expiresAt: number }>();

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function isConfiguredAdminEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  const configured = (process.env.ADMIN_EMAIL || 'admin@vora.cm').trim().toLowerCase();
  if (clean === configured) return true;
  const credJson = process.env.ADMIN_CREDENTIALS;
  if (credJson) {
    try {
      const creds: Array<{ email: string }> = JSON.parse(credJson);
      return creds.some((c) => c.email?.trim().toLowerCase() === clean);
    } catch {}
  }
  return false;
}

function isValidAdminCredentials(email: string, password: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  // Support ADMIN_CREDENTIALS JSON array for multiple admins
  const credJson = process.env.ADMIN_CREDENTIALS;
  if (credJson) {
    try {
      const creds: Array<{ email: string; password?: string; passwordHash?: string }> = JSON.parse(credJson);
      return creds.some((c) => {
        if (c.email?.trim().toLowerCase() !== cleanEmail) return false;
        if (c.passwordHash) return sha256(password) === c.passwordHash;
        if (c.password) return c.password === password;
        return false;
      });
    } catch {
      // Fall through to default check
    }
  }
  const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@vora.cm').trim().toLowerCase();
  const defaultPassword = process.env.ADMIN_PASSWORD || 'VoraAdmin2025!';
  return cleanEmail === defaultEmail && password === defaultPassword;
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
    if (!isConfiguredAdminEmail(cleanEmail)) {
      return res.status(401).json({
        success: false,
        isAdmin: false,
        error: 'Identifiants administrateur non reconnus.',
      });
    }

    // Email belongs to an admin — apply brute-force delay
    await new Promise((r) => setTimeout(r, 400));

    if (!isValidAdminCredentials(cleanEmail, password)) {
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
  const token = req.headers['x-admin-token'] as string || req.body?.adminToken;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Accès non autorisé. Token admin requis.' });
  }
  const session = activeSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    activeSessions.delete(token || '');
    return res.status(401).json({ success: false, error: 'Session admin expirée.' });
  }
  next();
}

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

