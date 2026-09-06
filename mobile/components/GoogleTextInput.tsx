import React, { useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";

import { icons } from "@/constants";
import { searchLandmarks, CameroonLandmark } from "@/constants/cameroon-landmarks";
import { GoogleInputProps } from "@/types/type";

const googlePlacesApiKey = process.env.EXPO_PUBLIC_PLACES_API_KEY;

// Static references to prevent infinite render loop in GooglePlacesAutocomplete useEffect
const WEB_REQUEST_URL = {
  useOnPlatform: "web" as const,
  url: "https://cors-anywhere.herokuapp.com/https://maps.googleapis.com/maps/api/place",
};

const SEARCH_QUERY = {
  key: googlePlacesApiKey,
  language: "fr",
};

const AUTOCOMPLETE_STYLES = {
  textInputContainer: {
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 16,
    position: "relative" as const,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  textInput: {
    backgroundColor: "#ffffff",
    fontSize: 15,
    fontWeight: "600" as const,
    width: "100%",
    borderRadius: 14,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    color: "#0F172A",
    height: 48,
    paddingLeft: 42,
  },
  listView: {
    backgroundColor: "white",
    position: "relative" as const,
    top: 0,
    width: "100%",
    borderRadius: 12,
    shadowColor: "#0EA5E9",
    elevation: 8,
    zIndex: 99,
  },
};

const GoogleTextInput = ({
  icon,
  initialLocation,
  containerStyle,
  textInputBackgroundColor,
  handlePress,
}: GoogleInputProps) => {
  const [landmarkMatches, setLandmarkMatches] = useState<CameroonLandmark[]>([]);
  const googleRef = useRef<any>(null);

  return (
    <View style={styles.outerContainer}>
      <GooglePlacesAutocomplete
        ref={googleRef}
        fetchDetails={true}
        placeholder="Rechercher une destination ou un repère..."
        debounce={200}
        requestUrl={WEB_REQUEST_URL}
        query={SEARCH_QUERY}
        styles={AUTOCOMPLETE_STYLES}
        onPress={(data, details = null) => {
          handlePress({
            latitude: details?.geometry?.location?.lat ?? 3.8856,
            longitude: details?.geometry?.location?.lng ?? 11.5162,
            address: data.description,
          });
        }}
        renderLeftButton={() => (
          <View style={styles.leftIconContainer}>
            <Image
              source={icon ? icon : icons.search}
              style={styles.leftIcon}
              resizeMode="contain"
            />
          </View>
        )}
        textInputProps={{
          placeholderTextColor: "#94A3B8",
          placeholder: initialLocation ?? "Saisissez un quartier, carrefour ou lieu...",
          onChangeText: (text) => {
            if (!text || text.trim() === "") {
              setLandmarkMatches([]);
              return;
            }
            const matches = searchLandmarks(text);
            setLandmarkMatches(matches);
          },
        }}
      />

      {/* Suggestion des Repères Locaux Camerounais */}
      {landmarkMatches.length > 0 && (
        <View style={styles.landmarkSuggestions}>
          <Text style={styles.landmarkHeader}>
            Repères Locaux Camerounais Reconnus
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 180 }}>
            {landmarkMatches.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  setLandmarkMatches([]);
                  const fullAddress = `${item.name}, ${item.zone} (${item.city})`;
                  try {
                    googleRef.current?.setAddressText(fullAddress);
                  } catch (e) {}
                  handlePress({
                    latitude: item.latitude,
                    longitude: item.longitude,
                    address: fullAddress,
                  });
                }}
                style={styles.landmarkItem}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.landmarkName}>{item.name}</Text>
                  <Text style={styles.landmarkDesc}>{item.description}</Text>
                </View>
                <View style={styles.landmarkBadge}>
                  <Text style={styles.landmarkBadgeText}>{item.zone}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default GoogleTextInput;

const styles = StyleSheet.create({
  outerContainer: {
    position: "relative",
    zIndex: 50,
    marginVertical: 8,
  },
  leftIconContainer: {
    position: "absolute",
    left: 12,
    zIndex: 10,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  leftIcon: {
    width: 20,
    height: 20,
  },
  landmarkSuggestions: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.3)",
    marginTop: 6,
    padding: 8,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  landmarkHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0284c7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  landmarkItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  landmarkName: {
    fontWeight: "700",
    fontSize: 14,
    color: "#1e293b",
  },
  landmarkDesc: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 2,
  },
  landmarkBadge: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  landmarkBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0369a1",
  },
});
