// @ts-nocheck
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

import { parseInformalCameroonianLocation, parseWithGeminiAI, AILocationResult } from "@/lib/aiLocationParser";

const geoapifyKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || googlePlacesApiKey;

const GoogleTextInput = ({
  icon,
  initialLocation,
  containerStyle,
  textInputBackgroundColor,
  handlePress,
}: GoogleInputProps) => {
  const [landmarkMatches, setLandmarkMatches] = useState<CameroonLandmark[]>([]);
  const [geoapifyMatches, setGeoapifyMatches] = useState<any[]>([]);
  const [aiMatch, setAiMatch] = useState<AILocationResult | null>(null);
  const googleRef = useRef<any>(null);

  const fetchGeoapifySuggestions = async (text: string) => {
    if (!geoapifyKey || text.length < 2) {
      setGeoapifyMatches([]);
      return;
    }
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&filter=countrycode:cm&apiKey=${geoapifyKey}`
      );
      const data = await res.json();
      if (data?.features && Array.isArray(data.features)) {
        setGeoapifyMatches(data.features.slice(0, 5));
      }
    } catch (e) {
      // ignore network error
    }
  };

  return (
    <View style={styles.outerContainer}>
      <GooglePlacesAutocomplete
        ref={googleRef}
        fetchDetails={true}
        placeholder="Rechercher une destination ou un repère..."
        debounce={200}
        requestUrl={WEB_REQUEST_URL}
        query={{
          key: googlePlacesApiKey,
          language: "fr",
        }}
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
          placeholder: initialLocation ?? "Saisissez un quartier, repère (ex: derrière pharmacie Mvog-Ada)...",
          onChangeText: (text) => {
            if (!text || text.trim() === "") {
              setLandmarkMatches([]);
              setGeoapifyMatches([]);
              setAiMatch(null);
              return;
            }
            // 1. Instant local NLP parsing
            const localParsed = parseInformalCameroonianLocation(text);
            setAiMatch(localParsed);

            // 2. Google Gemini API Call (live LLM)
            parseWithGeminiAI(text).then((geminiResult) => {
              if (geminiResult) setAiMatch(geminiResult);
            });

            // 3. Local Cameroon Landmarks
            const matches = searchLandmarks(text);
            setLandmarkMatches(matches);

            // 4. Geoapify API
            fetchGeoapifySuggestions(text);
          },
        }}
      />

      {/* Suggestion des Repères Locaux & Adresses */}
      {(aiMatch || landmarkMatches.length > 0 || geoapifyMatches.length > 0) && (
        <View style={styles.landmarkSuggestions}>
          <Text style={styles.landmarkHeader}>
            Lieux et repères suggérés
          </Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
            {/* AI Natural Language Resolved Item */}
            {aiMatch && (
              <TouchableOpacity
                onPress={() => {
                  setLandmarkMatches([]);
                  setGeoapifyMatches([]);
                  setAiMatch(null);
                  const fullAddress = `${aiMatch.matchedLandmark} (${aiMatch.spatialRelation})`;
                  try {
                    googleRef.current?.setAddressText(fullAddress);
                  } catch (e) {}
                  handlePress({
                    latitude: aiMatch.latitude,
                    longitude: aiMatch.longitude,
                    address: fullAddress,
                  });
                }}
                style={styles.aiItem}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.aiTitle}>{aiMatch.title}</Text>
                  <Text style={styles.aiDesc}>{aiMatch.subtitle}</Text>
                </View>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>Précis</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Geoapify Results */}
            {geoapifyMatches.map((feature: any, idx: number) => {
              const props = feature.properties;
              const title = props.name || props.formatted || props.city || "Lieu";
              const desc = [props.suburb, props.city, props.country].filter(Boolean).join(", ");
              return (
                <TouchableOpacity
                  key={`geo-${idx}`}
                  onPress={() => {
                    setLandmarkMatches([]);
                    setGeoapifyMatches([]);
                    setAiMatch(null);
                    const fullAddress = props.formatted || title;
                    try {
                      googleRef.current?.setAddressText(fullAddress);
                    } catch (e) {}
                    handlePress({
                      latitude: props.lat ?? 3.8856,
                      longitude: props.lon ?? 11.5162,
                      address: fullAddress,
                    });
                  }}
                  style={styles.landmarkItem}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.landmarkName}>{title}</Text>
                    <Text style={styles.landmarkDesc}>{desc}</Text>
                  </View>
                  <View style={styles.landmarkBadge}>
                    <Text style={styles.landmarkBadgeText}>GPS</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Local Landmark Matches */}
            {landmarkMatches.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  setLandmarkMatches([]);
                  setGeoapifyMatches([]);
                  setAiMatch(null);
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
  aiItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: "#f0f9ff",
    borderWidth: 1.5,
    borderColor: "#0284c7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  aiTitle: {
    fontWeight: "800",
    fontSize: 14,
    color: "#0369a1",
  },
  aiDesc: {
    fontSize: 12,
    color: "#0284c7",
    fontWeight: "600",
    marginTop: 3,
  },
  aiBadge: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },
});
