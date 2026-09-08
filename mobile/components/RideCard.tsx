import { Image, StyleSheet, Text, View } from "react-native";

import { icons } from "@/constants";
import { formatDate, formatTime } from "@/lib/utils";
import { Ride } from "@/types/type";

const RideCard = ({ ride }: { ride: Ride }) => {
  const isPaid = ride.payment_status === "paid";

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Image
            source={{
              uri: `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=600&height=400&center=lonlat:${ride.destination_longitude},${ride.destination_latitude}&zoom=14&apiKey=${process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY}`,
            }}
            style={styles.mapThumb}
          />

          <View style={styles.addressCol}>
            <View style={styles.addressRow}>
              <Image source={icons.to} style={styles.icon} />
              <Text style={styles.addressText} numberOfLines={1}>
                {ride.origin_address}
              </Text>
            </View>

            <View style={styles.addressRow}>
              <Image source={icons.point} style={styles.icon} />
              <Text style={styles.addressText} numberOfLines={1}>
                {ride.destination_address}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date & Heure</Text>
            <Text style={styles.detailValueBold} numberOfLines={1}>
              {formatDate(ride.created_at)}, {formatTime(ride.ride_time)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Chauffeur</Text>
            <Text style={styles.detailValueBold}>
              {ride.driver?.first_name} {ride.driver?.last_name}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Places</Text>
            <Text style={styles.detailValueBold}>
              {ride.driver?.car_seats}
            </Text>
          </View>

          <View style={[styles.detailRow, { marginBottom: 0 }]}>
            <Text style={styles.detailLabel}>Statut du paiement</Text>
            <Text
              style={[
                styles.detailValueBold,
                { color: isPaid ? "#16a34a" : "#dc2626" },
              ]}
            >
              {isPaid ? "Payé" : "En attente"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default RideCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#64748b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  content: {
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mapThumb: {
    width: 76,
    height: 84,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  addressCol: {
    flex: 1,
    marginLeft: 14,
    gap: 12,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 18,
    height: 18,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1e293b",
    flex: 1,
  },
  detailsBox: {
    width: "100%",
    marginTop: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
});
