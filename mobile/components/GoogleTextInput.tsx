// @ts-nocheck
import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { icons } from "@/constants";
import { searchLandmarks, CameroonLandmark } from "@/constants/cameroon-landmarks";
import { parseInformalCameroonianLocation, parseWithGeminiAI, AILocationResult } from "@/lib/aiLocationParser";
import { GoogleInputProps } from "@/types/type";

const geoapifyKey = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY || process.env.EXPO_PUBLIC_PLACES_API_KEY;

const GoogleTextInput = ({
  icon,
  initialLocation,
  containerStyle,
  textInputBackgroundColor,
  handlePress,
}: GoogleInputProps) => {
  const [inputText, setInputText] = useState("");
  const [landmarkMatches, setLandmarkMatches] = useState<CameroonLandmark[]>([]);
  const [geoapifyMatches, setGeoapifyMatches] = useState<any[]>([]);
  const [aiMatch, setAiMatch] = useState<AILocationResult | null>(null);

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

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!text || text.trim() === "") {
      setLandmarkMatches([]);
      setGeoapifyMatches([]);
      setAiMatch(null);
      return;
    }

    // 1. Local IA Natural Language Parser (0ms)
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
  };

  const clearSuggestions = () => {
    setLandmarkMatches([]);
    setGeoapifyMatches([]);
    setAiMatch(null);
  };

  return (
    <View style={styles.outerContainer}>
      <View style={styles.inputWrapper}>
        <View style={styles.leftIconContainer}>
          <Image
            source={icon ? icon : icons.search}
            style={styles.leftIcon}
            resizeMode="contain"
          />
        </View>
        <TextInput
          style={[styles.textInput, textInputBackgroundColor ? { backgroundColor: textInputBackgroundColor } : null]}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder={initialLocation ?? "Saisissez un quartier, repère (ex: derrière pharmacie Mvog-Ada)..."}
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Suggestion des Repères Locaux & Adresses */}
      {(aiMatch || landmarkMatches.length > 0 || geoapifyMatches.length > 0) && (
        <View style={styles.landmarkSuggestions}>
          <Text style={styles.landmarkHeader}>Lieux et repères suggérés</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }}>
            {/* AI Natural Language Resolved Item */}
            {aiMatch && (
              <TouchableOpacity
                onPress={() => {
                  const fullAddress = `${aiMatch.matchedLandmark} (${aiMatch.spatialRelation})`;
                  setInputText(fullAddress);
                  clearSuggestions();
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
              const fullAddress = props.formatted || title;
              return (
                <TouchableOpacity
                  key={`geo-${idx}`}
                  onPress={() => {
                    setInputText(fullAddress);
                    clearSuggestions();
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
            {landmarkMatches.map((item) => {
              const fullAddress = `${item.name}, ${item.zone} (${item.city})`;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    setInputText(fullAddress);
                    clearSuggestions();
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
              );
            })}
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
  inputWrapper: {
    position: "relative",
    justifyContent: "center",
    width: "100%",
  },
  leftIconContainer: {
    position: "absolute",
    left: 14,
    zIndex: 10,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  leftIcon: {
    width: 20,
    height: 20,
  },
  textInput: {
    backgroundColor: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    width: "100%",
    borderRadius: 14,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    color: "#0F172A",
    height: 52,
    paddingLeft: 46,
    paddingRight: 16,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
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
