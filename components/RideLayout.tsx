import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import React, { useRef } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import Map from "@/components/Map";
import { icons } from "@/constants";

const RideLayout = ({
  title,
  snapPoints,
  children,
}: {
  title: string;
  snapPoints?: string[];
  children: React.ReactNode;
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);

  if (Platform.OS === "web") {
    return (
      <View style={styles.webContainer}>
        {/* Header */}
        <View style={styles.webHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Image source={icons.backArrow} resizeMode="contain" style={styles.backIcon} />
          </TouchableOpacity>
          <Text style={styles.webHeaderTitle}>{title || "Retour"}</Text>
        </View>

        {/* Map */}
        <View style={styles.webMapContainer}>
          <Map />
        </View>

        {/* Content Box */}
        <ScrollView style={styles.webContentBox} contentContainerStyle={{ padding: 20 }}>
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.nativeContainer}>
        <View style={styles.mapContainer}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Image
                source={icons.backArrow}
                resizeMode="contain"
                style={styles.backIcon}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {title || "Retour"}
            </Text>
          </View>

          <Map />
        </View>

        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={snapPoints || ["40%", "85%"]}
          index={0}
        >
          {title === "Choose a Rider" ? (
            <BottomSheetView style={{ flex: 1, padding: 20 }}>
              {children}
            </BottomSheetView>
          ) : (
            <BottomSheetScrollView style={{ flex: 1, padding: 20 }}>
              {children}
            </BottomSheetScrollView>
          )}
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
};

export default RideLayout;

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  webHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 12,
  },
  webHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  webMapContainer: {
    height: 260,
    backgroundColor: "#e2e8f0",
  },
  webContentBox: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  nativeContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#0284c7",
  },
  headerRow: {
    flexDirection: "row",
    position: "absolute",
    zIndex: 10,
    top: 50,
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
});
