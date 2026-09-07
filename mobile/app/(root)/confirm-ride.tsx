import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { RideRatingModal } from "@/components/RideRatingModal";
import RideLayout from "@/components/RideLayout";
import { icons } from "@/constants";
import { getBackendUrl } from "@/lib/config";
import { voraSocket } from "@/lib/socket";
import { voraVoice } from "@/lib/voiceAssistant";

export default function ConfirmRide() {
  const params = useLocalSearchParams();
  const rideId = (params.rideId as string) || "";
  const initialOtp = (params.otpCode as string) || "";

  const [ride, setRide] = useState<any>(null);
  const [status, setStatus] = useState<
    "ACCEPTED" | "IN_TRANSIT" | "ARRIVEE_SIGNALEE" | "COMPLETED" | "EN_LITIGE"
  >("ACCEPTED");
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [otpCode, setOtpCode] = useState(initialOtp);

  // 1. Initialiser les données de la course
  useEffect(() => {
    if (params.rideData) {
      try {
        const parsed =
          typeof params.rideData === "string"
            ? JSON.parse(params.rideData)
            : params.rideData;
        setRide(parsed);
        if (parsed.otp_code) setOtpCode(parsed.otp_code);
        if (parsed.status) setStatus(parsed.status);
      } catch (err) {
        console.warn("Erreur parsing rideData:", err);
      }
    }

    // Récupération complète depuis l'API backend si rideId présent
    if (rideId) {
      const fetchRide = async () => {
        try {
          const backendUrl = getBackendUrl();
          const res = await fetch(`${backendUrl}/api/rides/${rideId}`);
          const data = await res.json();
          if (data.success && data.ride) {
            setRide(data.ride);
            if (data.ride.otp_code) setOtpCode(data.ride.otp_code);
            if (data.ride.status) setStatus(data.ride.status);
          }
        } catch (err) {
          console.error("Erreur chargement course:", err);
        }
      };
      fetchRide();
    }
  }, [rideId, params.rideData]);

  // 2. Annonce vocale d'accueil VORA dès l'arrivée sur l'écran
  useEffect(() => {
    if (ride) {
      const driverName = ride.driver_display_name || ride.driver_name || "Un chauffeur";
      voraVoice.speak(
        `${driverName} a accepté votre course. Le véhicule est en route vers votre point de prise en charge.`
      );
    }
  }, [ride?.id]);

  // 3. Socket.io : Suivi en temps réel de la géolocalisation et des statuts
  useEffect(() => {
    const socket = voraSocket.getSocket();
    if (!socket) return;

    const targetDriverId = ride?.driver_id || 1;

    // Écouter la position en direct du chauffeur
    const locationChannel = `driver-location:${targetDriverId}`;
    socket.on(locationChannel, (data: { driverId: number; lat: number; lng: number }) => {
      setDriverLocation({ lat: data.lat, lng: data.lng });
    });

    // Prise en charge effectuée par le chauffeur
    const onPickedUp = () => {
      setStatus("IN_TRANSIT");
      voraVoice.speak("Votre chauffeur vous a pris en charge. En route vers votre destination !");
      Alert.alert(
        "Prise en charge confirmée",
        "Votre trajet vers la destination finale a commencé."
      );
    };

    socket.on("passenger-picked-up", onPickedUp);
    socket.on("ride-started", onPickedUp);

    // Arrivée déclarée par le chauffeur
    socket.on("arrival-declared", () => {
      setStatus("ARRIVEE_SIGNALEE");
      voraVoice.speak(
        "Votre chauffeur signale être arrivé à destination. Veuillez confirmer la fin de la course."
      );
    });

    // Course clôturée mutuellement ou par expiration
    socket.on("ride-completed-mutual", () => {
      setStatus("COMPLETED");
      voraVoice.speak(
        "Course terminée. Merci d'avoir voyagé avec VORA. Veuillez noter votre chauffeur."
      );
      setShowRatingModal(true);
    });

    // Litige
    socket.on("ride-disputed", () => {
      setStatus("EN_LITIGE");
      voraVoice.speak("Un litige a été ouvert. Le support VORA traite votre réclamation.");
    });

    return () => {
      socket.off(locationChannel);
      socket.off("passenger-picked-up");
      socket.off("ride-started");
      socket.off("arrival-declared");
      socket.off("ride-completed-mutual");
      socket.off("ride-disputed");
    };
  }, [ride?.driver_id]);

  // Action : Confirmer la fin de la course
  const handleConfirmArrival = () => {
    if (rideId) {
      voraSocket.confirmRideEnd(rideId);
      setStatus("COMPLETED");
      voraVoice.speak("Merci d'avoir confirmé votre arrivée. Veuillez évaluer votre expérience.");
      setShowRatingModal(true);
    }
  };

  // Action : Annuler la course (uniquement pendant ACCEPTED)
  const [cancelling, setCancelling] = React.useState(false);
  const handleCancelRide = () => {
    Alert.alert(
      "Annuler la course",
      "Souhaitez-vous vraiment annuler cette course ? Le chauffeur sera notifié immédiatement.",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              const backendUrl = getBackendUrl();
              await fetch(`${backendUrl}/api/rides/${rideId}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Annulé par le passager" }),
              });
              // Notify driver via socket
              const socket = voraSocket.getSocket();
              if (socket) {
                socket.emit("ride-cancelled", { rideId, cancelledBy: "passenger" });
              }
              voraVoice.speak("Course annulée. Nous espérons vous retrouver très bientôt sur VORA.");
              router.replace("/(root)/(tabs)/home" as any);
            } catch (err) {
              console.error("Erreur annulation course:", err);
              Alert.alert("Erreur", "Impossible d'annuler la course. Veuillez contacter le support VORA.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // Action : Signaler un litige
  const handleReportDispute = () => {
    Alert.prompt
      ? Alert.prompt(
          "Signaler un problème",
          "Décrivez le motif du désaccord ou incident :",
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Envoyer réclamation",
              onPress: (text) => {
                voraSocket.disputeRide(
                  rideId,
                  ride?.rider_id || "rider_demo",
                  ride?.driver_id || 1,
                  text || "Problème signalé par le client"
                );
                setStatus("EN_LITIGE");
              },
            },
          ]
        )
      : Alert.alert(
          "Signaler un litige",
          "Voulez-vous signaler un problème sur cette course à l'assistance VORA ?",
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Signaler",
              style: "destructive",
              onPress: () => {
                voraSocket.disputeRide(
                  rideId,
                  ride?.rider_id || "rider_demo",
                  ride?.driver_id || 1,
                  "Problème signalé par le passager"
                );
                setStatus("EN_LITIGE");
              },
            },
          ]
        );
  };

  // Coordonnées pour la carte interactive
  const originLat = ride?.origin_lat || 3.8667;
  const originLng = ride?.origin_lng || 11.5167;
  const destLat = ride?.dest_lat || 3.875;
  const destLng = ride?.dest_lng || 11.52;

  // Position du chauffeur (suivi temps réel ou simulation d'approche)
  const currentDriverLat = driverLocation?.lat || originLat - 0.004;
  const currentDriverLng = driverLocation?.lng || originLng - 0.003;

  return (
    <RideLayout
      title="Suivi de Course en Direct"
      mapProps={{
        userLatitude: originLat,
        userLongitude: originLng,
        destinationLatitude: destLat,
        destinationLongitude: destLng,
        driverLatitude: currentDriverLat,
        driverLongitude: currentDriverLng,
        vehicleType: ride?.vehicle_type || "taxi",
        zoom: 15, // Zoom rapproché pour voir les quartiers
      }}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Statut Badge */}
        <View style={styles.statusHeader}>
          <View
            style={[
              styles.statusPill,
              status === "ACCEPTED" && styles.pillAccepted,
              status === "IN_TRANSIT" && styles.pillInTransit,
              status === "ARRIVEE_SIGNALEE" && styles.pillWaiting,
              status === "COMPLETED" && styles.pillCompleted,
              status === "EN_LITIGE" && styles.pillDispute,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                status === "ACCEPTED" && { backgroundColor: "#0284C7" },
                status === "IN_TRANSIT" && { backgroundColor: "#059669" },
                status === "ARRIVEE_SIGNALEE" && { backgroundColor: "#D97706" },
                status === "COMPLETED" && { backgroundColor: "#10B981" },
                status === "EN_LITIGE" && { backgroundColor: "#DC2626" },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                status === "ACCEPTED" && { color: "#0284C7" },
                status === "IN_TRANSIT" && { color: "#059669" },
                status === "ARRIVEE_SIGNALEE" && { color: "#D97706" },
                status === "COMPLETED" && { color: "#10B981" },
                status === "EN_LITIGE" && { color: "#DC2626" },
              ]}
            >
              {status === "ACCEPTED"
                ? "Chauffeur en approche"
                : status === "IN_TRANSIT"
                ? "Course en cours — À bord"
                : status === "ARRIVEE_SIGNALEE"
                ? "Arrivée signalée — Veuillez confirmer"
                : status === "COMPLETED"
                ? "Course terminée"
                : "Litige en cours"}
            </Text>
          </View>

          <Text style={styles.fareHighlight}>
            {(ride?.fare_fcfa || 1500).toLocaleString("fr-FR")} FCFA
          </Text>
        </View>

        {/* Bannière "Commande pour un tiers" si applicable */}
        {ride?.booked_for_other && (
          <View style={styles.otherBanner}>
            <Text style={styles.otherBannerTitle}>
              Course commandée pour une autre personne
            </Text>
            <Text style={styles.otherBannerSub}>
              Bénéficiaire : <Text style={{ fontWeight: "800" }}>{ride.passenger_name}</Text> ({ride.passenger_phone}).
              Vous conservez le suivi GPS en temps réel.
            </Text>
          </View>
        )}

        {/* Code OTP de Sécurité */}
        {status === "ACCEPTED" && otpCode && (
          <View style={styles.otpCard}>
            <Text style={styles.otpCardLabel}>CODE DE SÉCURITÉ OTP</Text>
            <Text style={styles.otpCardValue}>{otpCode}</Text>
            <Text style={styles.otpCardSub}>
              Communiquez ce code au chauffeur à son arrivée pour valider la prise en charge.
            </Text>
          </View>
        )}

        {/* Carte Chauffeur & Véhicule */}
        <View style={styles.driverCard}>
          <View style={styles.driverInfoRow}>
            {ride?.driver_avatar ? (
              <Image source={{ uri: ride.driver_avatar }} style={styles.driverAvatarImg} resizeMode="cover" />
            ) : (
              <View style={styles.driverAvatar}>
                <Text style={{ fontSize: 11, fontWeight: "900", color: "#0284C7" }}>
                  {ride?.vehicle_type === "moto" ? "MOTO" : "TAXI"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>
                {ride?.driver_display_name || ride?.driver_name || "Paul M. (Chauffeur VORA)"}
              </Text>
              <Text style={styles.vehicleDetails}>
                {ride?.vehicle_model || "Toyota Yaris"} • {ride?.color || "Jaune Taxi"}
              </Text>
              <View style={styles.ratingRow}>
                <Text style={styles.starText}>Note : {ride?.driver_rating || ride?.rating || "4.9"}/5</Text>
                <Text style={styles.ratingSub}>Notoriété vérifiée</Text>
              </View>
            </View>

            {/* Plaque d'immatriculation Cameroun */}
            <View style={styles.plateBadge}>
              <Text style={styles.plateCountry}>CMR</Text>
              <Text style={styles.plateText}>{ride?.license_plate || "LT-842-CA"}</Text>
            </View>
          </View>

          {/* Photo du véhicule pour identification visuelle rapide par le passager */}
          {ride?.vehicle_image && (
            <View style={styles.vehiclePhotoCard}>
              <View style={styles.vehiclePhotoHeader}>
                <Text style={styles.vehiclePhotoLabel}>VÉHICULE EN APPROCHE</Text>
                <Text style={styles.vehiclePhotoSub}>
                  {ride.vehicle_model} • {ride.color}
                </Text>
              </View>
              <Image
                source={{ uri: ride.vehicle_image }}
                style={styles.vehiclePhotoImg}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Boutons d'interaction */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              onPress={() => {
                if (ride?.driver_phone) {
                  Linking.openURL(`tel:${ride.driver_phone}`);
                } else {
                  Alert.alert("Appel Sécurisé", "Connexion vocale directe via VORA.");
                }
              }}
              style={styles.callButton}
              activeOpacity={0.8}
            >
              <Text style={styles.callButtonText}>Appeler le chauffeur</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => voraVoice.speak("Assistante VORA : Le chauffeur est en route.")}
              style={styles.voiceButton}
              activeOpacity={0.8}
            >
              <Text style={styles.voiceButtonText}>VORA Voix</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Résumé Trajet */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#10B981" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DÉPART</Text>
              <Text style={styles.routeAddress}>
                {ride?.origin_address || "Carrefour Mokolo, Yaoundé"}
              </Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: "#EF4444" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DESTINATION</Text>
              <Text style={styles.routeAddress}>
                {ride?.destination_address || "Quartier Bastos, Yaoundé"}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions selon Statut */}
        {status === "ARRIVEE_SIGNALEE" && (
          <View style={styles.arrivalPromptCard}>
            <Text style={styles.arrivalPromptTitle}>Arrivée signalée par le chauffeur</Text>
            <Text style={styles.arrivalPromptSub}>
              Le chauffeur indique être arrivé à bon port. Êtes-vous bien arrivé à destination ?
            </Text>
            <TouchableOpacity
              onPress={handleConfirmArrival}
              style={styles.confirmArrivalBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmArrivalBtnText}>
                Confirmer mon arrivée
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bouton d'annulation — visible uniquement si le chauffeur n'a pas encore pris en charge */}
        {status === "ACCEPTED" && (
          <TouchableOpacity
            onPress={handleCancelRide}
            style={[styles.cancelRideBtn, cancelling && styles.cancelRideBtnDisabled]}
            disabled={cancelling}
            activeOpacity={0.8}
          >
            {cancelling
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Text style={styles.cancelRideBtnText}>Annuler la course</Text>
            }
          </TouchableOpacity>
        )}

        {status === "COMPLETED" && !hasRated && (
          <TouchableOpacity
            onPress={() => setShowRatingModal(true)}
            style={styles.rateDriverBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.rateDriverBtnText}>
              Évaluer et Noter le Chauffeur
            </Text>
          </TouchableOpacity>
        )}

        {/* Bouton Litige & Retour */}
        <View style={styles.bottomFooter}>
          {status !== "COMPLETED" && (
            <TouchableOpacity onPress={handleReportDispute} style={styles.disputeBtn}>
              <Text style={styles.disputeBtnText}>Signaler un problème</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.replace("/(root)/(tabs)/home" as any)}
            style={styles.homeBtn}
          >
            <Text style={styles.homeBtnText}>Retour à l'Accueil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal d'évaluation et de notation du chauffeur */}
      <RideRatingModal
        visible={showRatingModal}
        rideId={rideId}
        driverName={ride?.driver_display_name || ride?.driver_name || "Chauffeur VORA"}
        vehicleModel={ride?.vehicle_model || "Véhicule VORA"}
        onClose={() => setShowRatingModal(false)}
        onRated={() => {
          setHasRated(true);
          setShowRatingModal(false);
        }}
      />
    </RideLayout>
  );
}

const styles = StyleSheet.create({
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  pillAccepted: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
  },
  pillInTransit: {
    backgroundColor: "#D1FAE5",
    borderColor: "#A7F3D0",
  },
  pillWaiting: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  pillCompleted: {
    backgroundColor: "#ECFDF5",
    borderColor: "#6EE7B7",
  },
  pillDispute: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  fareHighlight: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0EA5E9",
  },
  otherBanner: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  otherBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1D4ED8",
  },
  otherBannerSub: {
    fontSize: 12,
    color: "#3B82F6",
    marginTop: 2,
    lineHeight: 16,
  },
  otpCard: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  otpCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  otpCardValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#38BDF8",
    letterSpacing: 6,
    marginVertical: 4,
  },
  otpCardSub: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },
  driverCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  driverInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  driverAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: "#0EA5E9",
  },
  vehiclePhotoCard: {
    marginTop: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  vehiclePhotoHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  vehiclePhotoLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0369A1",
    letterSpacing: 0.5,
  },
  vehiclePhotoSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  vehiclePhotoImg: {
    width: "100%",
    height: 140,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  vehicleDetails: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  starText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#D97706",
  },
  ratingSub: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
  },
  plateBadge: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#0F172A",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
  },
  plateCountry: {
    fontSize: 8,
    fontWeight: "800",
    color: "#64748B",
  },
  plateText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  callButton: {
    flex: 1,
    backgroundColor: "#0EA5E9",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  voiceButton: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  voiceButtonText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  routeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
  },
  routeAddress: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 1,
  },
  routeDivider: {
    height: 16,
    borderLeftWidth: 2,
    borderLeftColor: "#E2E8F0",
    marginLeft: 4,
    marginVertical: 4,
  },
  arrivalPromptCard: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  arrivalPromptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B45309",
    marginBottom: 4,
  },
  arrivalPromptSub: {
    fontSize: 12,
    color: "#92400E",
    lineHeight: 16,
    marginBottom: 12,
  },
  confirmArrivalBtn: {
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmArrivalBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  cancelRideBtn: {
    borderWidth: 1.5,
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
    minHeight: 48,
    justifyContent: "center",
  },
  cancelRideBtnDisabled: {
    opacity: 0.6,
  },
  cancelRideBtnText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  rateDriverBtn: {
    backgroundColor: "#D97706",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  rateDriverBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  bottomFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  disputeBtn: {
    paddingVertical: 8,
  },
  disputeBtnText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "700",
  },
  homeBtn: {
    paddingVertical: 8,
  },
  homeBtnText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },
});
