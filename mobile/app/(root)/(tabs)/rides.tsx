import { useClerkUser } from "@/lib/useClerkSafe";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";

import RideCard from "@/components/RideCard";
import { images } from "@/constants";
import { useFetch } from "@/lib/fetch";
import { getBackendUrl } from "@/lib/config";
import { Ride } from "@/types/type";

const Rides = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const { user } = useClerkUser();
  const [clearing, setClearing] = useState(false);

  const {
    data: recentRides,
    loading,
    error,
    refetch,
  } = useFetch<Ride[]>(`/(api)/ride/${user?.id}`);


  const handleClearHistory = useCallback(async () => {
    const doDelete = async () => {
      setClearing(true);
      try {
        const backendUrl = getBackendUrl();
        const res = await fetch(`${backendUrl}/api/rides/history/user/${user?.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (data.success) {
          refetch();
        } else {
          Alert.alert("Erreur", data.error || "Impossible d'effacer l'historique.");
        }
      } catch (e) {
        Alert.alert("Erreur", "Connexion au serveur impossible.");
      } finally {
        setClearing(false);
      }
    };

    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Effacer tout votre historique de courses ?\n\nLes courses actives ou en recherche ne seront pas supprimées."
      );
      if (confirmed) await doDelete();
    } else {
      Alert.alert(
        "Effacer l'historique",
        "Êtes-vous sûr de vouloir effacer tout votre historique de courses ? Les courses actives ou en recherche ne seront pas supprimées.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Effacer",
            style: "destructive",
            onPress: doDelete,
          },
        ]
      );
    }
  }, [user?.id]);

  const hasRides = recentRides && recentRides.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={recentRides}
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
          <View style={styles.headerRow}>
            <Text style={styles.title}>Tous les Trajets</Text>
            {hasRides && (
              <TouchableOpacity
                style={[styles.clearBtn, clearing && { opacity: 0.6 }]}
                onPress={handleClearHistory}
                disabled={clearing}
                activeOpacity={0.75}
              >
                {clearing ? (
                  <ActivityIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <Text style={styles.clearBtnIcon}>🗑</Text>
                    <Text style={styles.clearBtnText}>Effacer</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  clearBtnIcon: {
    fontSize: 14,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ef4444",
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
