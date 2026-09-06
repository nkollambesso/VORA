import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { onboarding } from "@/constants";

// ─── Slide indicator dot ─────────────────────────────────────────────────────
const Dot = ({ active }: { active: boolean }) => (
  <View
    style={[
      styles.dot,
      active ? styles.dotActive : styles.dotInactive,
    ]}
  />
);

// Helper to render text with VORA highlighted in bold blue
const RenderTextWithVora = ({ text, style }: { text: string; style: any }) => {
  if (!text.includes("VORA")) {
    return <Text style={style}>{text}</Text>;
  }
  const parts = text.split("VORA");
  return (
    <Text style={style}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <Text style={styles.voraHighlight}>VORA</Text>
          )}
        </React.Fragment>
      ))}
    </Text>
  );
};

// ─── Single onboarding slide ──────────────────────────────────────────────────
const Slide = ({
  item,
  slideWidth,
}: {
  item: (typeof onboarding)[0];
  slideWidth: number;
}) => (
  <View style={[styles.slide, { width: slideWidth }]}>
    <View style={styles.imageContainer}>
      <Image
        source={item.image}
        style={styles.slideImage}
        resizeMode="contain"
      />
    </View>
    <View style={styles.textContainer}>
      <RenderTextWithVora text={item.title} style={styles.slideTitle} />
      <RenderTextWithVora text={item.description} style={styles.slideDesc} />
    </View>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
const Welcome = () => {
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get("window").width
  );
  const flatRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const isLast = activeIndex === onboarding.length - 1;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  };

  const goNext = () => {
    if (isLast) {
      router.replace("/(auth)/sign-up");
    } else {
      const next = activeIndex + 1;
      flatRef.current?.scrollToOffset({
        offset: next * containerWidth,
        animated: true,
      });
      setActiveIndex(next);
    }
  };

  const onScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / containerWidth);
    if (idx !== activeIndex) setActiveIndex(idx);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.container} onLayout={onLayout}>
        {/* Skip button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/sign-up")}
            style={styles.skipBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Slides wrapper */}
        <View style={styles.slidesWrapper}>
          <FlatList
            ref={flatRef}
            data={onboarding}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <Slide item={item} slideWidth={containerWidth} />
            )}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            style={styles.flatList}
            getItemLayout={(_, index) => ({
              length: containerWidth,
              offset: containerWidth * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              flatRef.current?.scrollToOffset({
                offset: index * containerWidth,
                animated: true,
              });
            }}
          />
        </View>

        {/* Dots + Button */}
        <View style={styles.footer}>
          {/* Dot indicators */}
          <View style={styles.dots}>
            {onboarding.map((_, i) => (
              <Dot key={i} active={i === activeIndex} />
            ))}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            onPress={goNext}
            style={styles.btn}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {isLast ? "Commencer →" : "Suivant →"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Welcome;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
    width: "100%",
  },
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  header: {
    width: "100%",
    alignItems: "flex-end",
    paddingTop: Platform.OS === "web" ? 12 : 4,
    paddingRight: 12,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000000",
    letterSpacing: 0.2,
  },
  slidesWrapper: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
  },
  flatList: {
    flex: 1,
    width: "100%",
  },
  // ── Slide ──
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  imageContainer: {
    width: "100%",
    height: 300,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  slideImage: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    marginVertical: 8,
  },
  slideTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#000000",
    textAlign: "center",
    lineHeight: 32,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  slideDesc: {
    fontSize: 14,
    fontWeight: "500",
    color: "#858585",
    textAlign: "center",
    lineHeight: 20,
  },
  voraHighlight: {
    fontWeight: "800",
    color: "#0286FF",
  },
  // ── Footer ──
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    alignItems: "center",
    gap: 16,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 32,
    backgroundColor: "#0286FF",
  },
  dotInactive: {
    width: 14,
    backgroundColor: "#E2E8F0",
  },
  btn: {
    width: "100%",
    backgroundColor: "#0286FF",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#0286FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  btnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
