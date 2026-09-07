import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { icons, onboarding } from "@/constants";

// Mock driver info for onboarding slides
const DRIVER_SLIDES_DATA = [
  {
    name: "Jean-Paul M.",
    role: "Chauffeur VORA",
    rating: "4.9",
    trips: "1 420 courses",
    seats: "4 places",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
  },
  {
    name: "Alain K.",
    role: "Chauffeur VORA",
    rating: "4.85",
    trips: "890 courses",
    seats: "4 places",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
  },
  {
    name: "Grace N.",
    role: "Chauffeur VORA",
    rating: "5.0",
    trips: "2 150 courses",
    seats: "4 places",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
  },
];

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

// Slide Indicator Dot
const Dot = ({ active }: { active: boolean }) => (
  <View
    style={[
      styles.dot,
      active ? styles.dotActive : styles.dotInactive,
    ]}
  />
);

// Driver Card Component for Onboarding
const OnboardingDriverCard = ({
  driver,
}: {
  driver: (typeof DRIVER_SLIDES_DATA)[0];
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <View style={styles.driverCard}>
      <View style={styles.driverAvatarContainer}>
        {!imgError ? (
          <Image
            source={{ uri: driver.avatar }}
            style={styles.driverAvatar}
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Image
              source={icons.person}
              style={styles.avatarIcon}
              resizeMode="contain"
            />
          </View>
        )}
      </View>
      <View style={styles.driverInfoGroup}>
        <View style={styles.driverNameRow}>
          <Text style={styles.driverName}>{driver.name}</Text>
          <View style={styles.badgePro}>
            <Text style={styles.badgeProText}>{driver.role}</Text>
          </View>
        </View>
        <View style={styles.driverDetailsRow}>
          <View style={styles.ratingRow}>
            <Image
              source={icons.star}
              style={styles.starIcon}
              resizeMode="contain"
            />
            <Text style={styles.ratingText}>{driver.rating}</Text>
          </View>
          <Text style={styles.dotSeparator}>•</Text>
          <Text style={styles.detailText}>{driver.trips}</Text>
          <Text style={styles.dotSeparator}>•</Text>
          <Text style={styles.detailText}>{driver.seats}</Text>
        </View>
      </View>
    </View>
  );
};

// Main Screen
const Welcome = () => {
  const { width, height } = useWindowDimensions();
  const flatRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Tablet/Desktop OR Landscape mode threshold
  const isWide = width >= 768 || (width > height && height < 550);
  const isLast = activeIndex === onboarding.length - 1;

  const currentSlide = onboarding[activeIndex];
  const currentDriver =
    DRIVER_SLIDES_DATA[activeIndex] || DRIVER_SLIDES_DATA[0];

  const goNext = () => {
    if (isLast) {
      router.replace("/(auth)/sign-up");
    } else {
      const next = activeIndex + 1;
      if (!isWide) {
        flatRef.current?.scrollToOffset({
          offset: next * width,
          animated: true,
        });
      }
      setActiveIndex(next);
    }
  };

  const onScroll = (e: any) => {
    if (width <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx >= 0 && idx < onboarding.length && idx !== activeIndex) {
      setActiveIndex(idx);
    }
  };

  return (
    <SafeAreaView style={isWide ? styles.rootWide : styles.rootMobile}>
      {/* Centered card for Wide view vs Full screen for Mobile view */}
      <View style={isWide ? styles.cardWrapperWide : styles.containerMobile}>
        {/* Header bar: Logo + Skip */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>VORA</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/sign-up")}
            style={styles.skipBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {isWide ? (
          /* ── TABLET / DESKTOP / LANDSCAPE LAYOUT (2 Columns) ── */
          <View style={styles.wideBody}>
            {/* Left Column: Driver Card + Title + Description + Dots + Button */}
            <View style={styles.wideLeftColumn}>
              <OnboardingDriverCard driver={currentDriver} />

              <View style={styles.wideTextGroup}>
                <RenderTextWithVora
                  text={currentSlide.title}
                  style={styles.slideTitleWide}
                />
                <RenderTextWithVora
                  text={currentSlide.description}
                  style={styles.slideDescWide}
                />
              </View>

              <View style={styles.wideControlsGroup}>
                <View style={styles.dotsRow}>
                  {onboarding.map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setActiveIndex(i)}
                      activeOpacity={0.8}
                    >
                      <Dot active={i === activeIndex} />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={goNext}
                  style={styles.btnWide}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnText}>
                    {isLast ? "Commencer →" : "Suivant →"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Column: Car Illustration Image */}
            <View style={styles.wideRightColumn}>
              <Image
                source={currentSlide.image}
                style={styles.imageWide}
                resizeMode="contain"
              />
            </View>
          </View>
        ) : (
          /* ── MOBILE PORTRAIT LAYOUT (Vertical Stack) ── */
          <View style={styles.mobileBody}>
            <View style={styles.slidesWrapperMobile}>
              <FlatList
                key="mobile-list"
                ref={flatRef}
                data={onboarding}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => (
                  <View style={[styles.slideMobile, { width: width }]}>
                    {/* Driver Card Badge */}
                    <View style={styles.mobileDriverWrapper}>
                      <OnboardingDriverCard
                        driver={
                          DRIVER_SLIDES_DATA[index] || DRIVER_SLIDES_DATA[0]
                        }
                      />
                    </View>

                    {/* Car Image */}
                    <View style={styles.imageContainerMobile}>
                      <Image
                        source={item.image}
                        style={styles.slideImageMobile}
                        resizeMode="contain"
                      />
                    </View>

                    {/* Title + Subtitle */}
                    <View style={styles.textContainerMobile}>
                      <RenderTextWithVora
                        text={item.title}
                        style={styles.slideTitleMobile}
                      />
                      <RenderTextWithVora
                        text={item.description}
                        style={styles.slideDescMobile}
                      />
                    </View>
                  </View>
                )}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                style={styles.flatListMobile}
                getItemLayout={(_, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
              />
            </View>

            {/* Footer controls: Dots + Button */}
            <View style={styles.footerMobile}>
              <View style={styles.dotsRow}>
                {onboarding.map((_, i) => (
                  <Dot key={i} active={i === activeIndex} />
                ))}
              </View>

              <TouchableOpacity
                onPress={goNext}
                style={styles.btnMobile}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>
                  {isLast ? "Commencer →" : "Suivant →"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default Welcome;

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Root Containers
  rootMobile: {
    flex: 1,
    backgroundColor: "#ffffff",
    width: "100%",
  },
  rootWide: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  containerMobile: {
    flex: 1,
    width: "100%",
    backgroundColor: "#ffffff",
  },
  cardWrapperWide: {
    width: "100%",
    maxWidth: 1080,
    height: "92%",
    maxHeight: 680,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 28,
    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.08)",
    elevation: 8,
    overflow: "hidden",
    justifyContent: "space-between",
  },

  // Header
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "web" ? 12 : 4,
    paddingBottom: 8,
  },
  logoBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0286FF",
    letterSpacing: 0.5,
  },
  skipBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },

  // Driver Card Preview Component
  driverCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
    marginVertical: 8,
  },
  driverAvatarContainer: {
    marginRight: 12,
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#0286FF20",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarIcon: {
    width: 24,
    height: 24,
    tintColor: "#0286FF",
  },
  driverInfoGroup: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  driverName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  badgePro: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeProText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284C7",
  },
  driverDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  starIcon: {
    width: 14,
    height: 14,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  dotSeparator: {
    fontSize: 12,
    color: "#94A3B8",
  },
  detailText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
  },

  // Wide / Desktop Body (2 Columns)
  wideBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 32,
    marginTop: 12,
  },
  wideLeftColumn: {
    flex: 1.1,
    justifyContent: "space-between",
    height: "100%",
    paddingVertical: 12,
  },
  wideTextGroup: {
    marginVertical: 16,
  },
  slideTitleWide: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 40,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  slideDescWide: {
    fontSize: 16,
    fontWeight: "500",
    color: "#64748B",
    lineHeight: 24,
  },
  wideControlsGroup: {
    gap: 20,
    marginTop: 12,
  },
  btnWide: {
    width: "100%",
    backgroundColor: "#0286FF",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  wideRightColumn: {
    flex: 0.9,
    height: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  imageWide: {
    width: "100%",
    height: "100%",
    maxHeight: 400,
  },

  // Mobile Body (Vertical Stack)
  mobileBody: {
    flex: 1,
    width: "100%",
    justifyContent: "space-between",
  },
  slidesWrapperMobile: {
    flex: 1,
    width: "100%",
  },
  flatListMobile: {
    flex: 1,
    width: "100%",
  },
  slideMobile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  mobileDriverWrapper: {
    width: "100%",
    marginTop: 4,
  },
  imageContainerMobile: {
    width: "100%",
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  slideImageMobile: {
    width: "100%",
    height: "100%",
  },
  textContainerMobile: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  slideTitleMobile: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 28,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  slideDescMobile: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },

  // Footer Mobile
  footerMobile: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 20 : 24,
    paddingTop: 8,
    alignItems: "center",
    gap: 16,
  },
  btnMobile: {
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

  // Shared Dots
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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

  // Brand highlight
  voraHighlight: {
    fontWeight: "800",
    color: "#0286FF",
  },
});
