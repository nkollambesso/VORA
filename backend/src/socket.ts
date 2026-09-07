import { Server, Socket } from 'socket.io';
import { query } from './db';
import { formatDisplayName, generatePublicId } from './utils/anonymize';

interface DriverLocation {
  driverId: number;
  lat: number;
  lng: number;
}

// Map pour gérer les timers d'auto-confirmation des courses (key: rideId)
const autoConfirmTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface SequentialDispatchState {
  rideId: string;
  sanitizedRide: any;
  driversQueue: any[];
  currentIndex: number;
  timer: ReturnType<typeof setTimeout> | null;
}

// Map pour gérer les files de dispatch séquentiel (key: rideId)
const activeDispatches = new Map<string, SequentialDispatchState>();

// Helper distance Haversine en km
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function setupSocketIO(io: any) {
  // Envoie la demande de course au chauffeur suivant dans la file
  const sendToNextDriver = async (rideId: string) => {
    const dispatch = activeDispatches.get(rideId);
    if (!dispatch) return;

    if (dispatch.timer) {
      clearTimeout(dispatch.timer);
      dispatch.timer = null;
    }

    if (dispatch.currentIndex >= dispatch.driversQueue.length) {
      // Tous les chauffeurs ont décliné ou n'ont pas répondu sous 20s
      console.log(`❌ Tous les chauffeurs ont décliné pour la course ${rideId}`);
      io.to(dispatch.sanitizedRide.rider_id).emit('all-drivers-declined', {
        rideId,
        message: 'Tous les chauffeurs à proximité sont indisponibles. Vous pouvez réajuster votre offre tarifaire ou retenter la réservation.',
      });
      activeDispatches.delete(rideId);
      return;
    }

    const currentDriver = dispatch.driversQueue[dispatch.currentIndex];
    console.log(`➡️ Dispatch de la course ${rideId} au chauffeur ${currentDriver.user_id} (${dispatch.currentIndex + 1}/${dispatch.driversQueue.length})`);

    // Notifier uniquement ce chauffeur
    io.to(currentDriver.user_id).emit('new-ride-available', {
      ...dispatch.sanitizedRide,
      dispatchTimerSeconds: 20,
    });

    // Compte à rebours de 20 secondes
    dispatch.timer = setTimeout(() => {
      console.log(`⏱️ Timeout 20s dépassé pour le chauffeur ${currentDriver.user_id} sur la course ${rideId}`);
      dispatch.currentIndex += 1;
      sendToNextDriver(rideId);
    }, 20000);
  };

  io.on('connection', (socket: any) => {
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

    // Passager demande une nouvelle course (DISPATCH SÉQUENTIEL EN CASCADE AU PLUS PROCHE)
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

        // Récupérer les chauffeurs en ligne correspondant à la catégorie
        const driversRes = await query(
          `SELECT d.*, u.name, u.id as user_id 
           FROM drivers d 
           JOIN users u ON d.user_id = u.id 
           WHERE d.is_online = TRUE AND (d.vehicle_type = $1 OR $1 = 'taxi')`,
          [rawRide.vehicle_type || 'taxi']
        );

        let onlineDrivers = driversRes.rows;

        if (onlineDrivers.length === 0) {
          // Aucun chauffeur en ligne
          io.to(sanitizedRide.rider_id).emit('no-drivers-available', {
            rideId: rawRide.id,
            message: 'Aucun chauffeur n\'est disponible pour le moment. Veuillez réessayer dans quelques instants.',
          });
          return;
        }

        // Trier les chauffeurs par proximité croissante à la position de départ (Haversine)
        onlineDrivers.sort((a: any, b: any) => {
          const distA = haversineDistance(
            rawRide.origin_lat,
            rawRide.origin_lng,
            a.current_lat || 3.8667,
            a.current_lng || 11.5167
          );
          const distB = haversineDistance(
            rawRide.origin_lat,
            rawRide.origin_lng,
            b.current_lat || 3.8667,
            b.current_lng || 11.5167
          );
          return distA - distB;
        });

        // Enregistrer la file de dispatch
        activeDispatches.set(rawRide.id, {
          rideId: rawRide.id,
          sanitizedRide,
          driversQueue: onlineDrivers,
          currentIndex: 0,
          timer: null,
        });

        // Déclencher l'envoi au 1er chauffeur le plus proche
        sendToNextDriver(rawRide.id);
      } catch (err) {
        console.error('Erreur diffusion request-ride:', err);
      }
    });

    // Chauffeur refuse une course -> passage immédiat au chauffeur suivant
    socket.on('decline-ride', (data: { rideId: string; driverId: number }) => {
      const dispatch = activeDispatches.get(data.rideId);
      if (dispatch) {
        console.log(`🚫 Chauffeur ${data.driverId} a décliné la course ${data.rideId}`);
        dispatch.currentIndex += 1;
        sendToNextDriver(data.rideId);
      }
    });

    // Chauffeur accepte une course
    socket.on('accept-ride', async (data: { rideId: string; driverId: number }) => {
      try {
        // Stopper le timer de dispatch séquentiel s'il est actif
        const dispatch = activeDispatches.get(data.rideId);
        if (dispatch?.timer) {
          clearTimeout(dispatch.timer);
        }
        activeDispatches.delete(data.rideId);

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
            color: driverInfo.color,
            vehicle_image: driverInfo.vehicle_image,
            driver_avatar: driverInfo.driver_avatar,
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

    // =========================================================================
    // SIGNALISATION APPEL VOCAL IN-APP (WebRTC)
    // =========================================================================
    socket.on('webrtc-call-user', (data: { targetUserId: string; callerId: string; callerName: string; offer: any }) => {
      io.to(data.targetUserId).emit('webrtc-incoming-call', {
        callerId: data.callerId,
        callerName: data.callerName,
        offer: data.offer,
      });
    });

    socket.on('webrtc-answer-call', (data: { targetUserId: string; answer: any }) => {
      io.to(data.targetUserId).emit('webrtc-call-answered', {
        answer: data.answer,
      });
    });

    socket.on('webrtc-ice-candidate', (data: { targetUserId: string; candidate: any }) => {
      io.to(data.targetUserId).emit('webrtc-ice-candidate', {
        candidate: data.candidate,
      });
    });

    socket.on('webrtc-hangup', (data: { targetUserId: string }) => {
      io.to(data.targetUserId).emit('webrtc-call-ended', {});
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
        io.to(activeRide.rider_id).emit('passenger-picked-up', {
          ride: activeRide,
          message: 'Client pris en charge. En route vers la destination !',
        });
        socket.emit('ride-started-confirmed', activeRide);
        socket.emit('pickup-confirmed', {
          ride: activeRide,
          message: 'Client pris en charge. Navigation vers la destination en cours.',
        });
      } catch (err) {
        console.error('Erreur démarrage course OTP:', err);
      }
    });

    // CHAUFFEUR NOTIFIE DIRECTEMENT LA PRISE EN CHARGE ("pickup-passenger")
    socket.on('pickup-passenger', async (data: { rideId: string }) => {
      try {
        const updateRes = await query(
          `UPDATE rides SET status = 'IN_TRANSIT', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
          [data.rideId]
        );

        if (updateRes.rows.length > 0) {
          const activeRide = updateRes.rows[0];
          console.log(`🚖 Client pris en charge pour la course ${data.rideId}`);

          const payload = {
            ride: activeRide,
            message: 'Client pris en charge. En route vers la destination !',
          };

          io.to(activeRide.rider_id).emit('passenger-picked-up', payload);
          io.to(activeRide.rider_id).emit('ride-started', activeRide);
          socket.emit('pickup-confirmed', payload);
        }
      } catch (err) {
        console.error('Erreur notification prise en charge passager:', err);
      }
    });


    // CHAUFFEUR DÉCLARE L'ARRIVÉE À DESTINATION ("arrivee_signalee")
    socket.on('declare-arrival', async (data: { rideId: string }) => {
      try {
        const updateRes = await query(
          `UPDATE rides SET status = 'ARRIVEE_SIGNALEE', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
          [data.rideId]
        );

        if (updateRes.rows.length > 0) {
          const ride = updateRes.rows[0];

          socket.emit('arrival-declared-confirmed', {
            ride,
            message: 'Déclaration transmise au passager. En attente de sa confirmation...',
          });

          io.to(ride.rider_id).emit('arrival-declared', {
            ride,
            message: 'Votre chauffeur indique être arrivé à destination. Veuillez confirmer la fin de la course.',
          });

          const TIMEOUT_MS = process.env.AUTO_CONFIRM_TIMEOUT_MS ? parseInt(process.env.AUTO_CONFIRM_TIMEOUT_MS) : 60000;

          if (autoConfirmTimers.has(data.rideId)) {
            clearTimeout(autoConfirmTimers.get(data.rideId));
          }

          const timer = setTimeout(async () => {
            try {
              const currentRideRes = await query(`SELECT * FROM rides WHERE id = $1`, [data.rideId]);
              if (currentRideRes.rows.length > 0 && currentRideRes.rows[0].status === 'ARRIVEE_SIGNALEE') {
                const autoRes = await query(
                  `UPDATE rides SET status = 'COMPLETED', payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
                  [data.rideId]
                );

                if (autoRes.rows.length > 0) {
                  const completedRide = autoRes.rows[0];

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

    // PASSAGER CONFIRME LA FIN DE COURSE ("terminee")
    socket.on('confirm-ride-end', async (data: { rideId: string; rating?: number }) => {
      try {
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

          if (completedRide.driver_id) {
            await query(`UPDATE drivers SET total_rides = total_rides + 1 WHERE id = $1`, [completedRide.driver_id]);
          }

          const payload = {
            ride: completedRide,
            autoConfirmed: false,
            message: 'Course clôturée avec succès. Merci d\'avoir voyagé avec VORA !',
          };

          io.to(completedRide.rider_id).emit('ride-completed-mutual', payload);
          io.to('role:DRIVER').emit('ride-completed-mutual', payload);
          socket.emit('ride-completed-mutual', payload);
        }
      } catch (err) {
        console.error('Erreur confirmation fin de course:', err);
      }
    });

    // PASSAGER SIGNALE UN PROBLÈME ("en_litige")
    socket.on('dispute-ride', async (data: { rideId: string; riderId: string; driverId: number; reason: string }) => {
      try {
        if (autoConfirmTimers.has(data.rideId)) {
          clearTimeout(autoConfirmTimers.get(data.rideId));
          autoConfirmTimers.delete(data.rideId);
        }

        const updateRes = await query(
          `UPDATE rides SET status = 'EN_LITIGE', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
          [data.rideId]
        );

        if (updateRes.rows.length > 0) {
          const disputedRide = updateRes.rows[0];

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

          io.to(disputedRide.rider_id).emit('ride-disputed', payload);
          io.to('role:DRIVER').emit('ride-disputed', payload);
          io.to('role:ADMIN').emit('new-dispute-alert', payload);
        }
      } catch (err) {
        console.error('Erreur litige course:', err);
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

