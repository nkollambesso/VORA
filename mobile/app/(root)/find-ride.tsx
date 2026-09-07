import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import CustomButton from "@/components/CustomButton";
import GoogleTextInput from "@/components/GoogleTextInput";
import RideLayout from "@/components/RideLayout";
import { icons } from "@/constants";
import { useLocationStore } from "@/store";
import { voraSocket } from "@/lib/socket";
import { getBackendUrl } from "@/lib/config";
import { useClerkUser } from "@/lib/useClerkSafe";

const FindRide = () => {
  const { user } = useClerkUser();
  const { rideId } = useLocalSearchParams();
  const {
    userAddress,
    destinationAddress,
    setDestinationLocation,
    setUserLocation,
  } = useLocationStore();

  const [isSearching, setIsSearching] = useState(!!rideId);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [extraTip, setExtraTip] = useState(200);
  const [cancelling, setCancelling] = useState(false);

  const executeCancel = async () => {
    setCancelling(true);
    try {
      if (rideId) {
        const backendUrl = getBackendUrl();
        await fetch(`${backendUrl}/api/rides/${rideId}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Annulé par le passager pendant la recherche" }),
        });
        const socket = voraSocket.getSocket();
        if (socket) {
          socket.emit("ride-cancelled", { rideId, cancelledBy: "passenger" });
        }
      }
    } catch (err) {
      console.warn("Cancel search error:", err);
    } finally {
      setCancelling(false);
      setIsSearching(false);
      router.replace("/(root)/(tabs)/home" as any);
    }
  };

  const handleCancelSearch = () => {
    if (Platform.OS === "web") {
      const confirmed = typeof window !== "undefined" ? window.confirm("Voulez-vous annuler la recherche de chauffeur ?") : true;
      if (confirmed) {
        executeCancel();
      }
      return;
    }
    Alert.alert(
      "Annuler la recherche",
      "Voulez-vous annuler la recherche de chauffeur ?",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: executeCancel,
        },
      ]
    );
  };

  useEffect(() => {
    const userId = user?.id || "rider_demo";
    const socket = voraSocket.connect(userId, "PASSENGER");
    if (socket && rideId) {
      voraSocket.joinRide(rideId as string);
    }

    const onRideAccepted = (data: any) => {
      setIsSearching(false);
      router.replace({
        pathname: "/(root)/confirm-ride",
        params: {
          rideId: data.ride?.id || data.rideId || (rideId as string),
          otpCode: data.otpCode || data.ride?.otp_code,
          rideData: JSON.stringify(data.ride || {}),
        },
      });
    };

    socket?.on("all-drivers-declined", () => {
      setIsSearching(false);
      setShowAdjustModal(true);
    });

    socket?.on("no-drivers-available", () => {
      setIsSearching(false);
      setShowAdjustModal(true);
    });

    socket?.on("ride-accepted", onRideAccepted);
    if (rideId) {
      socket?.on(`ride-accepted:${rideId}`, onRideAccepted);
    }

    return () => {
      socket?.off("all-drivers-declined");
      socket?.off("no-drivers-available");
      socket?.off("ride-accepted", onRideAccepted);
      if (rideId) {
        socket?.off(`ride-accepted:${rideId}`, onRideAccepted);
      }
    };
  }, [user, rideId]);

  // Fallback Polling ultra-résilient (vérifie toutes les 1.5s si la course a été acceptée en DB)
  useEffect(() => {
    if (!rideId || !isSearching) return;

    const interval = setInterval(async () => {
      try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/rides/${rideId}`);
        const data = await res.json();
        if (
          data.success &&
          data.ride &&
          ["ACCEPTED", "IN_TRANSIT", "ARRIVEE_SIGNALEE"].includes(data.ride.status)
        ) {
          setIsSearching(false);
          router.replace({
            pathname: "/(root)/confirm-ride",
            params: {
              rideId: data.ride.id,
              otpCode: data.ride.otp_code,
              rideData: JSON.stringify(data.ride),
            },
          });
        }
      } catch (err) {
        // Fallback silencieux en cas de micro-coupure réseau
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [rideId, isSearching]);

  const handleRetrySearchWithOffer = () => {
    setShowAdjustModal(false);
    setIsSearching(true);
    if (rideId) {
      voraSocket.requestRide(rideId as string);
    }
  };

  return (
    <RideLayout title="Trajet & Recherche">
      <View style={styles.inputSection}>
        <Text style={styles.label}>Départ</Text>
        <GoogleTextInput
          icon={icons.target}
          initialLocation={userAddress!}
          handlePress={(location) => setUserLocation(location)}
        />
      </View>

      <View style={styles.inputSection}>
        <Text style={styles.label}>Destination</Text>
        <GoogleTextInput
          icon={icons.map}
          initialLocation={destinationAddress!}
          handlePress={(location) => setDestinationLocation(location)}
        />
      </View>

      {isSearching ? (
        <View style={styles.searchingBox}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.searchingTitle}>Recherche d'un chauffeur en cours...</Text>
          <Text style={styles.searchingSub}>
            Transmis au chauffeur le plus proche. Patientez pendant sa confirmation.
          </Text>
          <TouchableOpacity
            style={styles.cancelSearchBtn}
            onPress={handleCancelSearch}
            disabled={cancelling}
          >
            {cancelling
              ? <ActivityIndicator size="small" color="#ef4444" />
              : <Text style={styles.cancelSearchText}>Annuler la recherche</Text>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginTop: 24 }}>
          <CustomButton
            title="Saisir les options & Réserver"
            onPress={() => router.push(`/(root)/book-ride`)}
          />
        </View>
      )}

      {/* Modal d'Ajustement d'Offre quand tous les chauffeurs ont décliné */}
      <Modal visible={showAdjustModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={[styles.modalTitle, { flex: 1 }]}>Aucun chauffeur n'a accepté</Text>
              <TouchableOpacity
                onPress={() => setShowAdjustModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#F1F5F9",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 8,
                }}
                accessibilityLabel="Fermer"
              >
                <Text style={{ fontSize: 18, color: "#64748B", fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Les chauffeurs à proximité sont actuellement occupés ou ont décliné. Vous pouvez réajuster votre offre avec un pourboire pour encourager la prise en charge.
            </Text>

            <Text style={styles.tipLabel}>AJOUTER UN BONUS TARIF / POURBOIRE</Text>
            <View style={styles.tipRow}>
              {[200, 500, 1000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[styles.tipBtn, extraTip === amount && styles.tipBtnSelected]}
                  onPress={() => setExtraTip(amount)}
                >
                  <Text style={[styles.tipBtnText, extraTip === amount && styles.tipBtnTextSelected]}>
                    +{amount} FCFA
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => {
                  setShowAdjustModal(false);
                  router.push("/(root)/book-ride");
                }}
              >
                <Text style={styles.cancelModalText}>Changer de Catégorie</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.retryBtn} onPress={handleRetrySearchWithOffer}>
                <Text style={styles.retryBtnText}>Relancer (+{extraTip} FCFA)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </RideLayout>
  );
};

export default FindRide;

const styles = StyleSheet.create({
  inputSection: {
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  searchingBox: {
    backgroundColor: "#F0F9FF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  searchingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0284C7",
    marginTop: 12,
  },
  searchingSub: {
    fontSize: 12,
    color: "#0369A1",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  cancelSearchBtn: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ef4444",
    backgroundColor: "#fff1f2",
    minWidth: 160,
    alignItems: "center",
  },
  cancelSearchText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ef4444",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  tipLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  tipBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  tipBtnSelected: {
    backgroundColor: "#E0F2FE",
    borderColor: "#0EA5E9",
  },
  tipBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
  },
  tipBtnTextSelected: {
    color: "#0284C7",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelModalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  cancelModalText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  retryBtn: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});

