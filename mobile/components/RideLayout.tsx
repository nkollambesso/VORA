import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import React, { useRef } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import Map, { MapProps } from "@/components/Map";
import { icons } from "@/constants";

const GestureHandlerRootViewAny = GestureHandlerRootView as any;
const BottomSheetViewAny = BottomSheetView as any;

const RideLayout = ({
  title,
  snapPoints,
  children,
  mapProps,
}: {
  title?: string;
  snapPoints?: string[];
  children: React.ReactNode;
  mapProps?: MapProps;
}) => {
  const { width } = useWindowDimensions();

  const isWeb = Platform.OS === "web";
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Web fallback view: clean, responsive card layout
  if (isWeb) {
    return (
      <View style={styles.webContainer}>
        {/* Header */}
        <View style={styles.webHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Image
              source={icons.backArrow}
              resizeMode="contain"
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.webHeaderTitle}>{title || "Retour"}</Text>
        </View>

        {/* Responsive Body */}
        <View style={styles.webBody}>
          {width >= 768 ? (
            // Tablet / Desktop: 2-column layout (Map left, Content right)
            <View style={styles.splitRow}>
              <View style={styles.splitMap}>
                <Map {...mapProps} />
              </View>
              <ScrollView
                style={styles.splitContent}
                contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
              >
                <Text style={styles.contentHeader}>{title || "Course VORA"}</Text>
                {children}
              </ScrollView>
            </View>
          ) : (
            // Mobile Web: Map on top (fixed height), Content scrolls below
            <>
              <View style={styles.mobileWebMap}>
                <Map {...mapProps} />
              </View>
              <ScrollView
                style={styles.mobileWebContent}
                contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              >
                {children}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootViewAny style={{ flex: 1 }}>
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

          <Map {...mapProps} />
        </View>


        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={snapPoints || ["40%", "85%"]}
          index={0}
        >
          {title === "Choose a Rider" ? (
            <BottomSheetViewAny style={{ flex: 1, padding: 20 }}>
              {children}
            </BottomSheetViewAny>
          ) : (
            <BottomSheetScrollView style={{ flex: 1, padding: 20 }}>
              {children}
            </BottomSheetScrollView>
          )}
        </BottomSheet>
      </View>
    </GestureHandlerRootViewAny>
  );
};

export default RideLayout;

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },
  mobileWebWrapper: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  wideWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.06)",
  },
  webHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 14,
  },
  webHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  wideRow: {
    flex: 1,
    flexDirection: "row",
  },
  wideMapCol: {
    flex: 1.1,
    backgroundColor: "#e2e8f0",
  },
  wideContentCol: {
    flex: 0.9,
    backgroundColor: "#ffffff",
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
