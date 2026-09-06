import { useClerkUser, useClerkAuth } from "@/lib/useClerkSafe";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
  Alert,
  Modal,
  TextInput,
  Text,
  View,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import GoogleTextInput from "@/components/GoogleTextInput";
import Map from "@/components/Map";
import RideCard from "@/components/RideCard";
import { icons, images } from "@/constants";
import { useFetch } from "@/lib/fetch";
import { useLocationStore } from "@/store";
import { Ride } from "@/types/type";
import { voraSocket } from "@/lib/socket";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const Home = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user } = useClerkUser();
  const { signOut } = useClerkAuth();

  const { setUserLocation, setDestinationLocation } = useLocationStore();

  const handleSignOut = () => {
    signOut();
    router.replace("/(auth)/sign-in");
  };

  const [hasPermission, setHasPermission] = useState<boolean>(false);

  const {
    data: recentRides,
    loading,
    error,
  } = useFetch<Ride[]>(`/(api)/ride/${user?.id}`);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setHasPermission(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});

      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords?.latitude!,
        longitude: location.coords?.longitude!,
      });

      setUserLocation({
        latitude: location.coords?.latitude,
        longitude: location.coords?.longitude,
        address: `${address[0]?.name ?? "Position"}, ${address[0]?.region ?? "Cameroun"}`,
      });
    })();
  }, []);

  const handleDestinationPress = (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => {
    setDestinationLocation(location);
    router.push("/(root)/find-ride");
  };

  // Socket listener for end-ride confirmation modal
  const [arrivalRide, setArrivalRide] = useState<any>(null);
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [rating, setRating] = useState(5);

  useEffect(() => {
    const socket = voraSocket.connect(user?.id || "rider_demo", "PASSENGER");

    socket?.on("arrival-declared", (data: any) => {
      setArrivalRide(data.ride);
      setShowArrivalModal(true);
    });

    socket?.on("ride-completed-mutual", (data: any) => {
      setShowArrivalModal(false);
      setShowDisputeModal(false);
      const autoMsg = data.autoConfirmed
        ? " (Confirmation automatique après délai de 5 min)"
        : "";
      Alert.alert(
        "Course Terminée !",
        `Merci d'avoir voyagé avec VORA ! Votre reçu de paiement a été généré.${autoMsg}`
      );
    });

    socket?.on("ride-disputed", () => {
      setShowArrivalModal(false);
      setShowDisputeModal(false);
      Alert.alert(
        "Litige Enregistré",
        "Votre réclamation a été transmise à notre service d'arbitrage VORA. Le paiement automatique a été suspendu."
      );
    });

    return () => {
      socket?.off("arrival-declared");
      socket?.off("ride-completed-mutual");
      socket?.off("ride-disputed");
    };
  }, [user]);

  const handleConfirmEndRide = () => {
    if (arrivalRide?.id) {
      voraSocket.confirmRideEnd(arrivalRide.id, rating);
      setShowArrivalModal(false);
    }
  };

  const handleSendDispute = () => {
    if (!disputeReason.trim()) {
      Alert.alert("Précisez le problème", "Veuillez indiquer brièvement la raison de votre litige.");
      return;
    }
    voraSocket.disputeRide(
      arrivalRide?.id || "VORA-DEMO",
      user?.id || "rider_demo",
      arrivalRide?.driver_id || 1,
      disputeReason
    );
    setShowDisputeModal(false);
    setDisputeReason("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={recentRides?.slice(0, 5)}
        renderItem={({ item }) => <RideCard ride={item} />}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={[
          styles.flatListContent,
          isWide && { width: "100%", maxWidth: 1080, alignSelf: "center" },
        ]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            {!loading ? (
              <>
                <Image
                  source={images.noResult}
                  style={styles.emptyImage}
                  alt="Aucun trajet récent"
                  resizeMode="contain"
                />
                <Text style={styles.emptyText}>Aucun trajet récent trouvé</Text>
              </>
            ) : (
              <ActivityIndicator size="small" color="#0284c7" />
            )}
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* User Greeting & Logout */}
            <View style={styles.greetingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subGreeting}>Ravi de vous revoir</Text>
                <Text style={styles.greetingTitle} numberOfLines={1}>
                  {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "Passager"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleSignOut}
                style={styles.logoutButton}
              >
                <Image source={icons.out} style={styles.logoutIcon} />
              </TouchableOpacity>
            </View>

            {/* Destination Search */}
            <GoogleTextInput
              icon={icons.search}
              handlePress={handleDestinationPress}
            />

            {/* Current Location Map Header */}
            <Text style={styles.sectionTitle}>
              Votre position actuelle
            </Text>

            {/* Map Box */}
            <View style={styles.mapCardContainer}>
              <Map />
            </View>

            <Text style={styles.sectionTitle}>
              Trajets Récents
            </Text>
          </View>
        }
      />

      {/* Modal Confirmation de Fin de Course */}
      <Modal
        visible={showArrivalModal && !showDisputeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowArrivalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalBadgeHeader}>
              <Text style={styles.modalBadgeText}>FIN DE COURSE VORA</Text>
            </View>
            <Text style={styles.modalTitle}>Chauffeur Arrivé à Destination</Text>
            <Text style={styles.modalSub}>
              Votre chauffeur indique être arrivé à destination. Confirmez-vous la fin de la course pour effectuer le paiement de {arrivalRide?.fare_fcfa || 1750} FCFA ?
            </Text>

            {/* Évaluation */}
            <Text style={styles.rateLabel}>Noter votre course :</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setRating(s)}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 26, color: s <= rating ? "#F59E0B" : "#CBD5E1" }}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleConfirmEndRide}
              style={styles.confirmEndBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmEndBtnText}>
                Confirmer la fin de la course
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDisputeModal(true)}
              style={styles.disputeTriggerBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.disputeTriggerText}>
                Signaler un problème
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Formulaire de Litige */}
      <Modal
        visible={showDisputeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisputeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalDisputeTitle}>Signaler un Problème</Text>
            <Text style={styles.modalSub}>
              Veuillez préciser le motif de votre litige. Le paiement sera immédiatement bloqué et soumis à l'arbitrage VORA :
            </Text>

            <TextInput
              style={styles.disputeInput}
              placeholder="Ex: Le chauffeur s'est arrêté trop loin de la destination, comportement inapproprié..."
              multiline
              numberOfLines={4}
              value={disputeReason}
              onChangeText={setDisputeReason}
            />

            <TouchableOpacity
              onPress={handleSendDispute}
              style={styles.sendDisputeBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.sendDisputeText}>
                Envoyer la Réclamation
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDisputeModal(false)}
              style={styles.cancelDisputeBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelDisputeText}>Retour</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  headerContainer: {
    marginBottom: 8,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 16,
  },
  subGreeting: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  logoutButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutIcon: {
    width: 18,
    height: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 20,
    marginBottom: 10,
  },
  mapCardContainer: {
    height: Math.max(280, SCREEN_HEIGHT * 0.32),
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyContainer: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  emptyImage: {
    width: 140,
    height: 140,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.2)",
    elevation: 8,
  },
  modalBadgeHeader: {
    alignSelf: "flex-start",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  modalBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0284C7",
    letterSpacing: 0.5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  modalDisputeTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#DC2626",
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 16,
  },
  rateLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 4,
  },
  starRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  confirmEndBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 10,
    elevation: 3,
  },
  confirmEndBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  disputeTriggerBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
  },
  disputeTriggerText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },
  disputeInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    color: "#0F172A",
    textAlignVertical: "top",
    verticalAlign: "top",
    marginBottom: 16,
    height: 100,
  },
  sendDisputeBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  sendDisputeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  cancelDisputeBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelDisputeText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },
});
