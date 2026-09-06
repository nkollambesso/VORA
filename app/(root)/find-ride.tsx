import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import CustomButton from "@/components/CustomButton";
import GoogleTextInput from "@/components/GoogleTextInput";
import RideLayout from "@/components/RideLayout";
import { icons } from "@/constants";
import { useLocationStore } from "@/store";

const FindRide = () => {
  const {
    userAddress,
    destinationAddress,
    setDestinationLocation,
    setUserLocation,
  } = useLocationStore();

  return (
    <RideLayout title="Trajet">
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

      <View style={{ marginTop: 24 }}>
        <CustomButton
          title="Rechercher des chauffeurs"
          onPress={() => router.push(`/(root)/confirm-ride`)}
        />
      </View>
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
});
