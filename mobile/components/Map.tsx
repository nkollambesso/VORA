// @ts-nocheck
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { useDriverStore, useLocationStore } from "@/store";

// On web, react-native-maps doesn't work — use an iframe with OpenStreetMap embed
const MapWeb = ({ userLatitude, userLongitude }: { userLatitude?: number; userLongitude?: number }) => {
  // Default to Cameroon (Douala / Yaoundé) coordinates if location is pending
  const lat = userLatitude ?? 3.848;
  const lng = userLongitude ?? 11.502;

  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.03}%2C${lat - 0.03}%2C${lng + 0.03}%2C${lat + 0.03}&layer=mapnik&marker=${lat}%2C${lng}`;

  if (typeof document !== "undefined") {
    return (
      <View style={styles.iframeWrapper}>
        {/* @ts-ignore */}
        <iframe
          src={src}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 16 }}
          title="Votre position"
          loading="lazy"
        />
      </View>
    );
  }

  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Carte non disponible</Text>
    </View>
  );
};

// ─── Native Map (mobile only) ─────────────────────────────────────────────────
let NativeMap: React.ComponentType<any> | null = null;
if (Platform.OS !== "web") {
  try {
    const { default: MapView, Marker, PROVIDER_DEFAULT } = require("react-native-maps");
    const MapViewDirectionsRaw = require("react-native-maps-directions").default;
    const MapViewDirections = MapViewDirectionsRaw as any;

    const { icons } = require("@/constants");
    const { useFetch } = require("@/lib/fetch");
    const { calculateDriverTimes, calculateRegion, generateMarkersFromData } = require("@/lib/map");

    NativeMap = () => {
      const { userLongitude, userLatitude, destinationLatitude, destinationLongitude } = useLocationStore();
      const { selectedDriver, setDrivers } = useDriverStore();
      const { data: drivers, loading } = useFetch("/(api)/driver");
      const [markers, setMarkers] = useState<any[]>([]);

      useEffect(() => {
        if (Array.isArray(drivers) && userLatitude && userLongitude) {
          setMarkers(generateMarkersFromData({ data: drivers, userLatitude, userLongitude }));
        }
      }, [drivers, userLatitude, userLongitude]);

      useEffect(() => {
        if (markers.length > 0 && destinationLatitude && destinationLongitude) {
          calculateDriverTimes({ markers, userLatitude, userLongitude, destinationLatitude, destinationLongitude })
            .then((d: any) => setDrivers(d));
        }
      }, [markers, destinationLatitude, destinationLongitude]);

      const region = calculateRegion({ userLatitude, userLongitude, destinationLatitude, destinationLongitude });

      if (loading || (!userLatitude && !userLongitude)) {
        return (
          <View style={styles.placeholder}>
            <ActivityIndicator size="small" color="#0EA5E9" />
          </View>
        );
      }

      return (
        <MapView
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          mapType="mutedStandard"
          showsPointsOfInterest={false}
          initialRegion={region}
          showsUserLocation={true}
          userInterfaceStyle="light"
        >
          {markers.map((marker: any) => (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              title={marker.title}
              image={selectedDriver === +marker.id ? icons.selectedMarker : icons.marker}
            />
          ))}
          {destinationLatitude && destinationLongitude && (
            <>
              <Marker
                key="destination"
                coordinate={{ latitude: destinationLatitude, longitude: destinationLongitude }}
                title="Destination"
                image={icons.pin}
              />
              <MapViewDirections
                origin={{ latitude: userLatitude!, longitude: userLongitude! }}
                destination={{ latitude: destinationLatitude, longitude: destinationLongitude }}
                apikey={process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY}
                strokeColor="#0286FF"
                strokeWidth={2}
                onError={(err: any) => console.log("MapViewDirections info:", err)}
              />
            </>
          )}
        </MapView>
      );
    };
  } catch (e) {
    console.warn("react-native-maps not available", e);
  }
}

// ─── Exported Map ─────────────────────────────────────────────────────────────
const Map = () => {
  const { userLatitude, userLongitude } = useLocationStore();

  if (Platform.OS === "web") {
    return <MapWeb userLatitude={userLatitude} userLongitude={userLongitude} />;
  }

  if (NativeMap) return <NativeMap />;

  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Carte non disponible</Text>
    </View>
  );
};

export default Map;

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f9ff",
    borderRadius: 16,
    gap: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  iframeWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f0f9ff",
  },
});
