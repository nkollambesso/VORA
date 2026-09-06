import { useClerkUser } from "@/lib/useClerkSafe";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import RideCard from "@/components/RideCard";
import { images } from "@/constants";
import { useFetch } from "@/lib/fetch";
import { Ride } from "@/types/type";

const Rides = () => {
  const { user } = useClerkUser();

  const {
    data: recentRides,
    loading,
    error,
  } = useFetch<Ride[]>(`/(api)/ride/${user?.id}`);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={recentRides}
        renderItem={({ item }) => <RideCard ride={item} />}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.flatListContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            {!loading ? (
              <>
                <Image
                  source={images.noResult}
                  style={styles.emptyImage}
                  alt="Aucun trajet"
                  resizeMode="contain"
                />
                <Text style={styles.emptyText}>Aucun trajet trouvé</Text>
              </>
            ) : (
              <ActivityIndicator size="small" color="#0284c7" />
            )}
          </View>
        )}
        ListHeaderComponent={
          <Text style={styles.title}>Tous les Trajets</Text>
        }
      />
    </SafeAreaView>
  );
};

export default Rides;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  flatListContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginVertical: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
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
