import { Router, Request, Response } from 'express';
import { query } from '../db';

const router = Router();

// Basculer le mode simulation CamerPay (Super Admin)
router.post('/toggle-simulation', async (req: Request, res: Response) => {
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
      [value, adminEmail || 'superadmin@vora.cm']
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

// Tableau de bord Admin : Statistiques de la plateforme VORA
router.get('/dashboard-stats', async (req: Request, res: Response) => {
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
