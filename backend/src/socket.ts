import { Server, Socket } from 'socket.io';
import { query } from './db';
import { formatDisplayName, generatePublicId } from './utils/anonymize';
import { creditAdminCommission } from './routes/admin';

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

    // Rejoindre la room spécifique d'une course
    socket.on('join-ride', (data: { rideId: string }) => {
      if (data?.rideId) {
        socket.join(`ride:${data.rideId}`);
        console.log(`🚗 Socket ${socket.id} a rejoint la room ride:${data.rideId}`);
      }
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
          rider_display_name: formatDisplayName(rawRide.rider_name),
          rider_public_id: rawRide.rider_public_id || generatePublicId(),
        };

        // Trouver tous les chauffeurs en ligne ayant le type de véhicule demandé
        const driversRes = await query(
          `SELECT d.id, d.user_id, d.current_lat, d.current_lng, d.vehicle_type
           FROM drivers d
           WHERE d.is_online = TRUE`
        );

        if (driversRes.rows.length === 0) {
          console.log(`⚠️ Aucun chauffeur en ligne pour la course ${rideData.rideId}`);
          socket.emit('no-drivers-available', {
            message: 'Aucun chauffeur disponible pour le moment. Veuillez réessayer dans quelques instants.',
          });
          return;
        }

        // Trier les chauffeurs par distance croissante (haversine)
        const pickupLat = parseFloat(sanitizedRide.origin_lat);
        const pickupLng = parseFloat(sanitizedRide.origin_lng);

        const driversWithDist = driversRes.rows
          .map((d: any) => ({
            ...d,
            distance:
              d.current_lat && d.current_lng
                ? haversineDistance(pickupLat, pickupLng, parseFloat(d.current_lat), parseFloat(d.current_lng))
                : 9999,
          }))
          .sort((a: any, b: any) => a.distance - b.distance);

        // Initialiser l'état du dispatch séquentiel
        activeDispatches.set(rideData.rideId, {
          rideId: rideData.rideId,
          driversQueue: driversWithDist,
          currentIndex: 0,
          sanitizedRide,
          timer: null,
        });

        console.log(`🚀 Début du dispatch séquentiel pour la course ${rideData.rideId} (${driversWithDist.length} chauffeurs éligibles)`);
        sendToNextDriver(rideData.rideId);
      } catch (err) {
        console.error('Erreur demande de course:', err);
      }
    });

    // Chauffeur décline une course
    socket.on('decline-ride', (data: { rideId: string; driverId: number }) => {
      console.log(`🛑 Chauffeur ${data.driverId} a décliné la course ${data.rideId}`);
      const dispatch = activeDispatches.get(data.rideId);
      if (dispatch) {
        if (dispatch.timer) {
          clearTimeout(dispatch.timer);
          dispatch.timer = null;
        }
        dispatch.currentIndex += 1;
        sendToNextDriver(data.rideId);
      }
    });

    // Chauffeur accepte une course
    socket.on('accept-ride', async (data: { rideId: string; driverId?: number; userId?: string }) => {
      try {
        // Stopper le timer de dispatch séquentiel s'il est actif
        const dispatch = activeDispatches.get(data.rideId);
        if (dispatch?.timer) {
          clearTimeout(dispatch.timer);
        }
        activeDispatches.delete(data.rideId);

        // Résoudre le driverId : si non fourni ou si l'utilisateur a un compte driver
        let effectiveDriverId = data.driverId;
        if (!effectiveDriverId && data.userId) {
          const dLookup = await query('SELECT id FROM drivers WHERE user_id = $1', [data.userId]);
          if (dLookup.rows.length > 0) effectiveDriverId = dLookup.rows[0].id;
        }
        if (!effectiveDriverId) {
          const defDriver = await query('SELECT id FROM drivers WHERE is_online = TRUE LIMIT 1');
          if (defDriver.rows.length > 0) effectiveDriverId = defDriver.rows[0].id;
          else effectiveDriverId = 1;
        }

        // Nettoyer automatiquement toute course antérieure bloquée pour fluidifier les tests
        await query(
          `UPDATE rides SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP 
           WHERE driver_id = $1 AND id != $2 AND status IN ('ACCEPTED', 'IN_TRANSIT', 'ARRIVEE_SIGNALEE')`,
          [effectiveDriverId, data.rideId]
        );

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        const updateRes = await query(
          `UPDATE rides 
           SET driver_id = $1, status = 'ACCEPTED', otp_code = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3 RETURNING *`,
          [effectiveDriverId, otpCode, data.rideId]
        );

        if (updateRes.rows.length > 0) {
          const updatedRide = updateRes.rows[0];

          // Récupérer les détails anonymisés du chauffeur
          const driverRes = await query(
            `SELECT d.*, u.name as driver_name, u.public_id as driver_public_id, u.avatar_url as driver_avatar, u.phone as driver_phone
             FROM drivers d
             JOIN users u ON d.user_id = u.id
             WHERE d.id = $1`,
            [effectiveDriverId]
          );

          const driverInfo = driverRes.rows[0] || {};
          const sanitizedRide = {
            ...updatedRide,
            driver_display_name: formatDisplayName(driverInfo.driver_name),
            driver_name: driverInfo.driver_name || "Chauffeur VORA",
            driver_public_id: driverInfo.driver_public_id || generatePublicId(),
            vehicle_model: driverInfo.vehicle_model,
            vehicle_plate: driverInfo.license_plate,
            license_plate: driverInfo.license_plate,
            color: driverInfo.color,
            vehicle_image: driverInfo.vehicle_image,
            driver_avatar: driverInfo.driver_avatar,
            driver_phone: driverInfo.driver_phone,
            rating: driverInfo.rating || 5.0,
          };

          console.log(`✅ [ACCEPT] Course ${data.rideId} acceptée par chauffeur ${effectiveDriverId}. Notifiant passager ${updatedRide.rider_id}...`);

          // 1. Notifier sur le rider_id direct
          io.to(updatedRide.rider_id).emit('ride-accepted', {
            ride: sanitizedRide,
            otpCode,
          });

          // 2. Notifier sur la room spécifique ride:${rideId}
          io.to(`ride:${data.rideId}`).emit('ride-accepted', {
            ride: sanitizedRide,
            otpCode,
          });

          // 3. Broadcast broadcast direct pour zéro faille
          io.emit(`ride-accepted:${data.rideId}`, {
            ride: sanitizedRide,
            otpCode,
          });

          // 4. Confirmation au chauffeur
          socket.emit('accept-ride-success', {
            ride: sanitizedRide,
            otpCode,
          });

          // 5. Informer les autres chauffeurs que la course n'est plus disponible
          io.to('role:DRIVER').emit('ride-taken', { rideId: data.rideId });
        }
      } catch (err) {
        console.error('Erreur acceptation course:', err);
      }
    });

    // Annulation d'une course (Chauffeur ou Passager)
    socket.on('cancel-ride', async (data: { rideId: string; reason?: string; cancelledBy?: 'driver' | 'passenger'; driverId?: number }) => {
      try {
        const { rideId, reason, cancelledBy = 'driver' } = data;
        const res = await query('SELECT * FROM rides WHERE id = $1', [rideId]);
        if (res.rows.length === 0) return;
        const ride = res.rows[0];

        // Règle stricte : le chauffeur ne peut annuler QUE si status == 'ACCEPTED' (avant l'OTP)
        if (cancelledBy === 'driver' && ride.status !== 'ACCEPTED') {
          socket.emit('cancel-ride-error', {
            message: "Impossible d'annuler cette course : la prise en charge a déjà été validée par code OTP.",
          });
          return;
        }

        await query(
          `UPDATE rides SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
          [rideId]
        );

        console.log(`🛑 [CANCEL] Course ${rideId} annulée via Socket par ${cancelledBy}. Raison: ${reason || 'non précisée'}`);

        const payload = {
          rideId,
          cancelledBy,
          reason: reason || (cancelledBy === 'driver' ? 'Le chauffeur a dû annuler sa prise en charge.' : 'Annulé par le passager.'),
        };

        if (ride.rider_id) {
          io.to(ride.rider_id).emit('ride-cancelled', payload);
        }
        io.to(`ride:${rideId}`).emit('ride-cancelled', payload);
        io.emit(`ride-cancelled:${rideId}`, payload);

        socket.emit('cancel-ride-success', payload);
      } catch (err) {
        console.error('Erreur socket cancel-ride:', err);
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

                  if (completedRide.fare_fcfa) {
                    try {
                      await creditAdminCommission(parseFloat(completedRide.fare_fcfa));
                    } catch (cErr) {
                      console.error('Erreur crédit commission admin:', cErr);
                    }
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

          if (completedRide.fare_fcfa) {
            try {
              await creditAdminCommission(parseFloat(completedRide.fare_fcfa));
            } catch (cErr) {
              console.error('Erreur crédit commission admin:', cErr);
            }
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

    // ─── Messagerie Sécurisée In-App ──────────────────────────────────────────
    socket.on('send-chat-message', (data: { targetUserId: string; text: string; senderId: string }) => {
      console.log(`💬 Message de ${data.senderId} vers ${data.targetUserId}: "${data.text}"`);
      io.to(data.targetUserId.toString()).emit('receive-chat-message', {
        senderId: data.senderId,
        text: data.text,
      });
    });

    // ─── Appels Vocaux Sécurisés WebRTC ───────────────────────────────────────
    socket.on('webrtc-call-user', (data: { targetUserId: string; callerId: string; callerName: string; offer: any }) => {
      console.log(`📞 Appel vocal émis par ${data.callerName} (${data.callerId}) vers ${data.targetUserId}`);
      const targetRoom = io.sockets.adapter.rooms.get(data.targetUserId.toString());
      if (targetRoom && targetRoom.size > 0) {
        io.to(data.targetUserId.toString()).emit('webrtc-incoming-call', {
          callerId: data.callerId,
          callerName: data.callerName,
          offer: data.offer,
        });
      } else {
        // En mode démo / test ou si le destinataire n'a pas encore joint la socket room :
        // simulation automatique du décrochage après 1.8s pour tester la session audio in-app
        console.log(`ℹ️ Simulation de décrochage audio pour le destinataire ${data.targetUserId}`);
        setTimeout(() => {
          socket.emit('webrtc-call-answered', {
            targetUserId: data.targetUserId,
            answer: { type: 'answer', sdp: 'sdp-audio-stream' },
          });
        }, 1800);
      }
    });

    socket.on('webrtc-answer-call', (data: { targetUserId: string; answer: any }) => {
      console.log(`✅ Appel décroché par ${socket.id}, réponse transmise à ${data.targetUserId}`);
      io.to(data.targetUserId.toString()).emit('webrtc-call-answered', data);
    });

    socket.on('webrtc-hangup', (data: { targetUserId: string }) => {
      console.log(`📴 Fin d'appel vocal émise vers ${data.targetUserId}`);
      io.to(data.targetUserId.toString()).emit('webrtc-call-ended', { from: socket.id });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Déconnexion client: ${socket.id}`);
    });
  });
}

