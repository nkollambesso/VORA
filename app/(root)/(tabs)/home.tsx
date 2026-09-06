import { useClerkUser, useClerkAuth } from "@/lib/useClerkSafe";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
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
});
