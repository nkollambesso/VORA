// @ts-nocheck
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { useDriverStore, useLocationStore } from "@/store";

export interface MapProps {
  userLatitude?: number | null;
  userLongitude?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  driverLatitude?: number | null;
  driverLongitude?: number | null;
  userAddress?: string | null;
  destinationAddress?: string | null;
  vehicleType?: "moto" | "taxi" | "confort";
  zoom?: number;
  routeMode?: "pickup" | "destination" | "full";
}

// On web, render an interactive zoomed-in OpenStreetMap / Leaflet map
const MapWeb = ({
  userLatitude,
  userLongitude,
  destinationLatitude,
  destinationLongitude,
  driverLatitude,
  driverLongitude,
  userAddress,
  destinationAddress,
  vehicleType = "taxi",
  zoom = 15,
  routeMode = "full",
}: MapProps) => {
  const store = useLocationStore();
  // Default coordinates to Cameroon (Yaoundé / Bastos)
  const pLat = userLatitude ?? 3.8667;
  const pLng = userLongitude ?? 11.5167;
  const dLat = destinationLatitude;
  const dLng = destinationLongitude;
  const drLat = driverLatitude;
  const drLng = driverLongitude;

  // Resolve display names: use passed props, then store, then fallback
  const pickupLabel = (userAddress || store.userAddress || "Ma position").replace(/'/g, "\\'");
  const destLabel = (destinationAddress || store.destinationAddress || "Destination").replace(/'/g, "\\'");

  // Build interactive Leaflet HTML inside srcDoc
  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #F1F5F9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .driver-pin {
      background: #0F172A;
      border: 2px solid #0EA5E9;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(14, 165, 233, 0.6);
      animation: driverPulse 2s infinite ease-in-out;
    }
    @keyframes driverPulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.8); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 14px rgba(14, 165, 233, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
    }
    .pickup-pin {
      background: #10B981;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
    }
    .dest-pin {
      background: #EF4444;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 3px 8px rgba(0,0,0,0.35);
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      padding: 4px;
      font-weight: 700;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .badge-label {
      position: absolute;
      top: -24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.85);
      color: #fff;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 800;
      white-space: nowrap;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    try {
      var map = L.map('map', {
        zoomControl: true,
        attributionControl: false
      }).setView([${pLat}, ${pLng}], ${zoom});

      // Tuiles OpenStreetMap standards détaillées
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      var points = [];

      // 1. Marqueur Point de départ / Prise en charge
      var pickupSvg = '<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"white\"><circle cx=\"12\" cy=\"12\" r=\"7\"/></svg>';
      var pickupIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="position:relative;"><div class="pickup-pin">' + pickupSvg + '</div><div class="badge-label">${pickupLabel}</div></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker([${pLat}, ${pLng}], { icon: pickupIcon }).addTo(map).bindPopup('<b>${pickupLabel}</b>');
      points.push([${pLat}, ${pLng}]);

      // 2. Marqueur Destination finale (si fournie)
      ${dLat && dLng ? `
      var destSvg = '<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"white\"><path d=\"M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z\"/></svg>';
      var destIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="position:relative;"><div class="dest-pin">' + destSvg + '</div><div class="badge-label">${destLabel}</div></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });
      L.marker([${dLat}, ${dLng}], { icon: destIcon }).addTo(map).bindPopup('<b>${destLabel}</b>');
      points.push([${dLat}, ${dLng}]);
      ` : ''}

      // 3. Marqueur Véhicule Chauffeur en temps réel (si fourni)
      ${drLat && drLng ? `
      var carSvg = '<svg viewBox=\"0 0 24 24\" width=\"20\" height=\"20\" fill=\"#38BDF8\"><path d=\"M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.04 3H5.81l1.04-3zM19 17H5v-4.66l.12-.34h13.77l.11.34V17z\"/><circle cx=\"7.5\" cy=\"14.5\" r=\"1.5\"/><circle cx=\"16.5\" cy=\"14.5\" r=\"1.5\"/></svg>';
      var driverIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style=\"position:relative;\"><div class=\"driver-pin\">' + carSvg + '</div><div class=\"badge-label\">Chauffeur VORA</div></div>',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      L.marker([${drLat}, ${drLng}], { icon: driverIcon }).addTo(map).bindPopup('<b>Chauffeur en approche</b>');
      points.push([${drLat}, ${drLng}]);
      ` : ''}


      // 4. Tracé d'itinéraire (Polyline)
      ${(drLat && drLng) ? `
      // Ligne Chauffeur -> Prise en charge
      L.polyline([[${drLat}, ${drLng}], [${pLat}, ${pLng}]], {
        color: '#0EA5E9',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.9
      }).addTo(map);
      ` : ''}

      ${(dLat && dLng) ? `
      // Ligne Prise en charge -> Destination
      L.polyline([[${pLat}, ${pLng}], [${dLat}, ${dLng}]], {
        color: '#0284C7',
        weight: 5,
        opacity: 0.85
      }).addTo(map);
      ` : ''}

      // Ajuster la vue si plusieurs points
      if (points.length > 1) {
        var bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    } catch(err) {
      console.error('Erreur Leaflet:', err);
    }
  </script>
</body>
</html>
`;

  // Fallback direct embed OpenStreetMap avec delta réduit (0.008 pour zoom quartier)
  const delta = 0.008;
  const fallbackSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${pLng - delta}%2C${pLat - delta}%2C${pLng + delta}%2C${pLat + delta}&layer=mapnik&marker=${pLat}%2C${pLng}`;

  if (typeof document !== "undefined") {
    return (
      <View style={styles.iframeWrapper}>
        <iframe
          srcDoc={leafletHtml}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: 16 }}
          title="Carte interactive VORA"
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
const Map = (props: MapProps = {}) => {
  const store = useLocationStore();
  const uLat = props.userLatitude !== undefined ? props.userLatitude : store.userLatitude;
  const uLng = props.userLongitude !== undefined ? props.userLongitude : store.userLongitude;
  const dLat = props.destinationLatitude !== undefined ? props.destinationLatitude : store.destinationLatitude;
  const dLng = props.destinationLongitude !== undefined ? props.destinationLongitude : store.destinationLongitude;

  if (Platform.OS === "web") {
    return (
      <MapWeb
        userLatitude={uLat}
        userLongitude={uLng}
        destinationLatitude={dLat}
        destinationLongitude={dLng}
        driverLatitude={props.driverLatitude}
        driverLongitude={props.driverLongitude}
        vehicleType={props.vehicleType}
        zoom={props.zoom || 15}
        routeMode={props.routeMode}
      />
    );
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
