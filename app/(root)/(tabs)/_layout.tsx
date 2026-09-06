import { Tabs } from "expo-router";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";

import { icons } from "@/constants";

const TabIcon = ({
  source,
  focused,
}: {
  source: ImageSourcePropType;
  focused: boolean;
}) => (
  <View style={[styles.iconContainer, focused && styles.focusedOuter]}>
    <View style={[styles.iconInner, focused && styles.focusedInner]}>
      <Image
        source={source}
        tintColor="white"
        resizeMode="contain"
        style={styles.icon}
      />
    </View>
  </View>
);

export default function Layout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "white",
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "#1e293b",
          borderRadius: 40,
          paddingBottom: 0,
          overflow: "hidden",
          marginHorizontal: 16,
          marginBottom: 16,
          height: 64,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexDirection: "row",
          position: "absolute",
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Accueil",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon source={icons.home} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "Trajets",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon source={icons.list} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Discussion",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon source={icons.chat} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon source={icons.profile} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 9999,
  },
  focusedOuter: {
    backgroundColor: "#0284c7",
  },
  iconInner: {
    borderRadius: 9999,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  focusedInner: {
    backgroundColor: "#0ea5e9",
  },
  icon: {
    width: 24,
    height: 24,
  },
});
