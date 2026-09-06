import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { images } from "@/constants";

const Chat = () => {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isWide && { width: "100%", maxWidth: 840, alignSelf: "center" },
        ]}
      >
        <Text style={styles.title}>Discussion</Text>
        <View style={styles.emptyCenter}>
          <Image
            source={images.message}
            alt="message"
            style={styles.messageImage}
            resizeMode="contain"
          />
          <Text style={styles.emptyTitle}>
            Aucun message pour l'instant
          </Text>
          <Text style={styles.emptySub}>
            Commencez une conversation avec vos chauffeurs et amis.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Chat;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginVertical: 16,
  },
  emptyCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  messageImage: {
    width: "100%",
    height: 160,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
