import { Server as SocketIOServer, Socket } from 'socket.io';
import { query } from './db';
import { formatDisplayName, generatePublicId } from './utils/anonymize';

interface DriverLocation {
  driverId: number;
  lat: number;
  lng: number;
}

// Map pour gérer les timers d'auto-confirmation des courses (key: rideId)
const autoConfirmTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setupSocketIO(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`⚡ Client connecté: ${socket.id}`);

    // Join room (rider, driver, admin)
    socket.on('join', (data: { userId: string; role: string }) => {
      socket.join(data.userId);
      if (data.role) socket.join(`role:${data.role}`);
      console.log(`👤 Client ${data.userId} a rejoint la room (${data.role})`);
    });

    // Mettre à jour la localisation d'un chauffeur
    socket.on('update-location-driver', async (data: DriverLocation) => {
      try {
        const { driverId, lat, lng } = data;
        await query(
          `UPDATE drivers SET current_lat = $1, current_lng = $2, is_online = TRUE WHERE id = $3`,
          [lat, lng, driverId]
        );

        // Diffuser la nouvelle position aux abonnés de ce chauffeur
        io.emit(`driver-location:${driverId}`, { driverId, lat, lng });
      } catch (err) {
        console.error('Erreur mise à jour position chauffeur:', err);
      }
    });

    // Passager demande une nouvelle course (Données de sécurité anonymisées)
    socket.on('request-ride', async (rideData: { rideId: string }) => {
      try {
        const res = await query(
          `SELECT r.*, u.name as rider_name, u.public_id as rider_public_id, u.avatar_url as rider_avatar
           FROM rides r
           LEFT JOIN users u ON r.rider_id = u.id
           WHERE r.id = $1`,
          [rideData.rideId]
        );
        if (res.rows.length === 0) return;
        const rawRide = res.rows[0];

        const sanitizedRide = {
          ...rawRide,
          rider_name: formatDisplayName(rawRide.rider_name),
          rider_public_id: rawRide.rider_public_id || generatePublicId(),
        };

        // Alerter les chauffeurs en ligne correspondant au type de véhicule
        io.to('role:DRIVER').emit('new-ride-available', sanitizedRide);
      } catch (err) {
        console.error('Erreur diffusion request-ride:', err);
      }
    });

    // Chauffeur accepte une course (AVEC VÉRIFICATION SÉCURITÉ CHAUFFEUR OCCUPÉ + DONNÉES ANONYMISÉES)
    socket.on('accept-ride', async (data: { rideId: string; driverId: number }) => {
      try {
        // VÉRIFICATION : Le chauffeur a-t-il une course en cours non clôturée ?
        const busyCheck = await query(
          `SELECT id FROM rides WHERE driver_id = $1 AND status IN ('ACCEPTED', 'IN_TRANSIT', 'ARRIVEE_SIGNALEE')`,
          [data.driverId]
        );

        if (busyCheck.rows.length > 0) {
          socket.emit('driver-busy', {
            message: 'Vous avez déjà une course en cours non clôturée. Terminez-la avant d\'en accepter une nouvelle.',
          });
          return;
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        const updateRes = await query(
          `UPDATE rides 
           SET driver_id = $1, status = 'ACCEPTED', otp_code = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3 RETURNING *`,
          [data.driverId, otpCode, data.rideId]
        );

        if (updateRes.rows.length > 0) {
          const updatedRide = updateRes.rows[0];

          // Récupérer les détails anonymisés du chauffeur
          const driverRes = await query(
            `SELECT d.*, u.name as driver_name, u.public_id as driver_public_id, u.avatar_url as driver_avatar
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.id = $1`,
            [data.driverId]
          );

          const driverInfo = driverRes.rows[0] || {};
          const sanitizedRide = {
            ...updatedRide,
            driver_display_name: formatDisplayName(driverInfo.driver_name),
            driver_public_id: driverInfo.driver_public_id || generatePublicId(),
            vehicle_model: driverInfo.vehicle_model,
            license_plate: driverInfo.license_plate,
            rating: driverInfo.rating || 5.0,
          };

          // Notifier le passager que sa course est acceptée + lui fournir l'OTP
          io.to(updatedRide.rider_id).emit('ride-accepted', {
            ride: sanitizedRide,
            otpCode,
          });

          // Informer les autres chauffeurs que la course n'est plus disponible
          io.to('role:DRIVER').emit('ride-taken', { rideId: data.rideId });
        }
      } catch (err) {
        console.error('Erreur acceptation course:', err);
      }
    });

    // Chauffeur valide l'OTP pour démarrer la course
    socket.on('start-ride-otp', async (data: { rideId: string; otpInput: string }) => {
      try {
        const rideRes = await query(`SELECT * FROM rides WHERE id = $1`, [data.rideId]);
        if (rideRes.rows.length === 0) return;

        const ride = rideRes.rows[0];
        if (ride.otp_code !== data.otpInput) {
          socket.emit('otp-error', { message: 'Code OTP incorrect !' });
          return;
        }

        const updateRes = await query(
          `UPDATE rides SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
          [data.rideId]
        );

        const activeRide = updateRes.rows[0];
        io.to(activeRide.rider_id).emit('ride-started', activeRide);
        socket.emit('ride-started-confirmed', activeRide);
      } catch (err) {
        console.error('Erreur démarrage course OTP:', err);
      }
    });

    // =========================================================================
    // 1. CHAUFFEUR DÉCLARE L'ARRIVÉE À DESTINATION ("arrivee_signalee")
    // =========================================================================
    socket.on('declare-arrival', async (data: { rideId: string }) => {
      try {
        const updateRes = await query(
          `UPDATE rides SET status = 'ARRIVEE_SIGNALEE', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
          [data.rideId]
        );

        if (updateRes.rows.length > 0) {
          const ride = updateRes.rows[0];

          // 1. Confirmer au chauffeur
          socket.emit('arrival-declared-confirmed', {
            ride,
            message: 'Déclaration transmise au passager. En attente de sa confirmation...',
          });

          // 2. Notifier le passager
          io.to(ride.rider_id).emit('arrival-declared', {
            ride,
            message: 'Votre chauffeur indique être arrivé à destination. Veuillez confirmer la fin de la course.',
          });

          // 3. Démarrer le Timer d'Auto-Confirmation (5 min en prod / 60s pour tests)
          const TIMEOUT_MS = process.env.AUTO_CONFIRM_TIMEOUT_MS ? parseInt(process.env.AUTO_CONFIRM_TIMEOUT_MS) : 60000;

          // Annuler un timer existant s'il y en a un
          if (autoConfirmTimers.has(data.rideId)) {
            clearTimeout(autoConfirmTimers.get(data.rideId));
          }

          const timer = setTimeout(async () => {
            try {
              // Vérifier si la course est toujours en ARRIVEE_SIGNALEE
              const currentRideRes = await query(`SELECT * FROM rides WHERE id = $1`, [data.rideId]);
              if (currentRideRes.rows.length > 0 && currentRideRes.rows[0].status === 'ARRIVEE_SIGNALEE') {
                // Auto-confirmation implicite !
                const autoRes = await query(
                  `UPDATE rides SET status = 'COMPLETED', payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
                  [data.rideId]
                );

                if (autoRes.rows.length > 0) {
                  const completedRide = autoRes.rows[0];

                  // Mettre à jour total_rides dans drivers
                  if (completedRide.driver_id) {
                    await query(`UPDATE drivers SET total_rides = total_rides + 1 WHERE id = $1`, [completedRide.driver_id]);
                  }

                  const payload = {
                    ride: completedRide,
                    autoConfirmed: true,
                    message: 'Course clôturée automatiquement par délai dépassé (confirmation implicite).',
                  };

                  io.to(completedRide.rider_id).emit('ride-completed-mutual', payload);
                  io.to('role:DRIVER').emit('ride-completed-mutual', payload);
                  console.log(`⏰ Auto-confirmation de la course ${data.rideId}`);
                }
              }
            } catch (tErr) {
              console.error('Erreur auto-confirmation timer:', tErr);
            } finally {
              autoConfirmTimers.delete(data.rideId);
            }
          }, TIMEOUT_MS);

          autoConfirmTimers.set(data.rideId, timer);
        }
      } catch (err) {
        console.error('Erreur déclaration arrivée:', err);
      }
    });

    // =========================================================================
    // 2. PASSAGER CONFIRME LA FIN DE COURSE ("terminee")
    // =========================================================================
    socket.on('confirm-ride-end', async (data: { rideId: string; rating?: number }) => {
      try {
        // Annuler le timer d'auto-confirmation s'il est en cours
        if (autoConfirmTimers.has(data.rideId)) {
          clearTimeout(autoConfirmTimers.get(data.rideId));
          autoConfirmTimers.delete(data.rideId);
        }

        const updateRes = await query(
          `UPDATE rides 
           SET status = 'COMPLETED', payment_status = 'PAID', rating = COALESCE($1, rating), updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2 RETURNING *`,
          [data.rating || null, data.rideId]
        );

        if (updateRes.rows.length > 0) {
          const completedRide = updateRes.rows[0];

          // Mettre à jour total_rides dans la table drivers
          if (completedRide.driver_id) {
            await query(`UPDATE drivers SET total_rides = total_rides + 1 WHERE id = $1`, [completedRide.driver_id]);
          }

          const payload = {
            ride: completedRide,
            autoConfirmed: false,
            message: 'Course clôturée avec succès. Merci d\'avoir voyagé avec VORA !',
          };

          // Notifier le passager et le chauffeur
          io.to(completedRide.rider_id).emit('ride-completed-mutual', payload);
          io.to('role:DRIVER').emit('ride-completed-mutual', payload);
          socket.emit('ride-completed-mutual', payload);
        }
      } catch (err) {
        console.error('Erreur confirmation fin de course:', err);
      }
    });

    // =========================================================================
    // 3. PASSAGER SIGNALE UN PROBLÈME ("en_litige")
    // =========================================================================
    socket.on('dispute-ride', async (data: { rideId: string; riderId: string; driverId: number; reason: string }) => {
      try {
        // Annuler le timer d'auto-confirmation s'il est en cours
        if (autoConfirmTimers.has(data.rideId)) {
          clearTimeout(autoConfirmTimers.get(data.rideId));
          autoConfirmTimers.delete(data.rideId);
        }

        // 1. Mettre à jour le statut de la course à 'EN_LITIGE' (PAIEMENT BLOQUÉ)
        const updateRes = await query(
          `UPDATE rides SET status = 'EN_LITIGE', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
          [data.rideId]
        );

        if (updateRes.rows.length > 0) {
          const disputedRide = updateRes.rows[0];

          // 2. Insérer le litige dans la table ride_disputes
          const disputeRes = await query(
            `INSERT INTO ride_disputes (ride_id, rider_id, driver_id, reason, status)
             VALUES ($1, $2, $3, $4, 'A_TRAITER')
             RETURNING *`,
            [data.rideId, data.riderId || disputedRide.rider_id, data.driverId || disputedRide.driver_id, data.reason]
          );

          const payload = {
            ride: disputedRide,
            dispute: disputeRes.rows[0],
            message: 'Un problème a été signalé sur cette course. Le paiement est mis en attente d\'arbitrage.',
          };

          // Notifier le passager, le chauffeur et les administrateurs
          io.to(disputedRide.rider_id).emit('ride-disputed', payload);
          io.to('role:DRIVER').emit('ride-disputed', payload);
          io.to('role:ADMIN').emit('new-dispute-alert', payload);
        }
      } catch (err) {
        console.error('Erreur litige course:', err);
      }
    });

    // Legacy handler pour compatibilité
    socket.on('end-ride', async (data: { rideId: string }) => {
      const updateRes = await query(
        `UPDATE rides SET status = 'ARRIVEE_SIGNALEE', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [data.rideId]
      );
      if (updateRes.rows.length > 0) {
        const ride = updateRes.rows[0];
        io.to(ride.rider_id).emit('arrival-declared', {
          ride,
          message: 'Votre chauffeur indique être arrivé à destination. Veuillez confirmer la fin de la course.',
        });
        socket.emit('arrival-declared-confirmed', {
          ride,
          message: 'Déclaration transmise au passager. En attente de sa confirmation...',
        });
      }
    });

    // Alerte SOS
    socket.on('sos-trigger', async (data: { userId: string; userRole: string; lat: number; lng: number }) => {
      try {
        await query(
          `INSERT INTO sos_alerts (user_id, user_role, lat, lng) VALUES ($1, $2, $3, $4)`,
          [data.userId, data.userRole, data.lat, data.lng]
        );
        io.to('role:ADMIN').emit('sos-alert-received', data);
        console.log(`🚨 ALERTE SOS reçue de ${data.userId} (${data.userRole})`);
      } catch (err) {
        console.error('Erreur SOS trigger:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Déconnexion client: ${socket.id}`);
    });
  });
}
