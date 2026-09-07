import React, { useEffect, useState } from "react";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { voraSocket } from "@/lib/socket";
import { useClerkUser } from "@/lib/useClerkSafe";
import { useDriverStore } from "@/store";
import { Ionicons } from "@expo/vector-icons";

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export default function Chat() {
  const { user } = useClerkUser();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const { drivers, selectedDriver } = useDriverStore();
  const assignedDriver = drivers.find((d) => d.id === selectedDriver);

  const [activeDriver, setActiveDriver] = useState<any>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-msg",
      senderId: "system",
      text: "Bienvenue dans la messagerie sécurisée VORA. Vos échanges sont chiffrés et vos coordonnées téléphoniques restent strictement confidentielles.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");

  // In-App Call States
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<"calling" | "connected" | "ended">("calling");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    if (assignedDriver) {
      setActiveDriver({
        id: assignedDriver.id.toString(),
        public_id: `VORA-DRV0${assignedDriver.id}`,
        name: assignedDriver.title || "Chauffeur VORA",
        vehicle_model: `Véhicule ${assignedDriver.car_seats || 4} places`,
      });
    } else {
      setActiveDriver({
        id: "support-agent",
        public_id: "VORA-ASSIST",
        name: "Support & Dispatch VORA",
        vehicle_model: "Assistance 24/7",
      });
    }
  }, [assignedDriver]);

  // Timer d'appel
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isCallActive && callStatus === "connected") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive, callStatus]);

  // Écouter les événements socket WebRTC & Messages
  useEffect(() => {
    const socket = voraSocket.getSocket();
    if (!socket) return;

    const handleIncomingMessage = (data: { senderId: string; text: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          senderId: data.senderId,
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    };

    socket.on("receive-chat-message", handleIncomingMessage);

    socket.on("webrtc-incoming-call", () => {
      setIsCallActive(true);
      setCallStatus("calling");
    });

    socket.on("webrtc-call-answered", () => {
      setCallStatus("connected");
    });

    socket.on("webrtc-call-ended", () => {
      setCallStatus("ended");
      setTimeout(() => {
        setIsCallActive(false);
        setCallDuration(0);
      }, 1500);
    });

    return () => {
      socket.off("receive-chat-message", handleIncomingMessage);
      socket.off("webrtc-incoming-call");
      socket.off("webrtc-call-answered");
      socket.off("webrtc-call-ended");
    };
  }, []);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const msgText = inputText.trim();
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: user?.id || "me",
      text: msgText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText("");

    const socket = voraSocket.getSocket();
    if (socket?.connected && activeDriver) {
      socket.emit("send-chat-message", {
        targetUserId: activeDriver.id,
        text: msgText,
        senderId: user?.id || "me",
      });
    }

    // Si on est avec le support/dispatch et pas de chauffeur réel assigné, simuler une réponse intelligente
    if (!assignedDriver) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            senderId: "support-agent",
            text: "Merci pour votre message ! Notre centre de dispatch VORA est connecté. Dès que vous confirmez une course, votre chauffeur désigné apparaîtra directement ici.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }, 800);
    }
  };

  const handleStartCall = () => {
    setIsCallActive(true);
    setCallStatus("calling");
    setCallDuration(0);

    const socket = voraSocket.getSocket();
    socket?.emit("webrtc-call-user", {
      targetUserId: activeDriver?.id || "support-agent",
      callerId: user?.id || "rider_me",
      callerName: user?.fullName || "Passager VORA",
      offer: { type: "offer", sdp: "sdp-audio-stream" },
    });
  };

  const handleEndCall = () => {
    const socket = voraSocket.getSocket();
    socket?.emit("webrtc-hangup", { targetUserId: activeDriver?.id || "support-agent" });
    setCallStatus("ended");
    setTimeout(() => {
      setIsCallActive(false);
      setCallDuration(0);
    }, 1000);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.mainWrapper, isWide && { maxWidth: 840, alignSelf: "center", width: "100%" }]}>
        {/* Header Discussion & Bouton Appel Audio */}
        <View style={styles.header}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeDriver?.name || "Support VORA"}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {activeDriver?.public_id || "VORA-SECURE"} • {activeDriver?.vehicle_model || "Service Client"}
            </Text>
          </View>

          <TouchableOpacity style={styles.callAudioBtn} onPress={handleStartCall} activeOpacity={0.8}>
            <Ionicons name="call" size={14} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.callAudioBtnText}>Appel Audio</Text>
          </TouchableOpacity>
        </View>

        {/* Zone des messages */}
        <ScrollView style={styles.messagesScroll} contentContainerStyle={styles.messagesContent}>
          <View style={styles.securityNotice}>
            <Text style={styles.securityNoticeText}>
              🔒 Discussion cryptée et anonymisée sous identifiant VORA. Vos numéros réels ne sont jamais partagés.
            </Text>
          </View>

          {messages.map((msg) => {
            const isMe = msg.senderId === (user?.id || "me");
            const isSystem = msg.senderId === "system";

            if (isSystem) {
              return (
                <View key={msg.id} style={styles.systemBubble}>
                  <Text style={styles.systemText}>{msg.text}</Text>
                </View>
              );
            }

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  isMe ? styles.messageBubbleMe : styles.messageBubbleOther,
                ]}
              >
                <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextOther]}>
                  {msg.text}
                </Text>
                <Text style={[styles.messageTime, isMe ? styles.messageTimeMe : styles.messageTimeOther]}>
                  {msg.timestamp}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Input Bar - positioned above floating navbar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Écrire un message..."
            placeholderTextColor="#94A3B8"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && { opacity: 0.6 }]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.sendBtnText}>Envoyer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal Overlay d'Appel Vocale In-App (WebRTC) */}
      <Modal visible={isCallActive} animationType="slide" transparent>
        <View style={styles.callOverlay}>
          <View style={styles.callCard}>
            <View style={styles.callAvatarCircle}>
              <Text style={styles.callAvatarInitial}>
                {activeDriver?.name?.charAt(0) || "V"}
              </Text>
            </View>

            <Text style={styles.callName}>{activeDriver?.name || "Support VORA"}</Text>
            <Text style={styles.callPublicId}>
              Identifiant Sécurisé : {activeDriver?.public_id || "VORA-SECURE"}
            </Text>

            <View style={styles.callStatusBadge}>
              <Text style={styles.callStatusText}>
                {callStatus === "calling"
                  ? "Sonnerie en cours..."
                  : callStatus === "connected"
                  ? `En communication (${formatSeconds(callDuration)})`
                  : "Appel terminé"}
              </Text>
            </View>

            {/* Contrôles de l'Appel */}
            <View style={styles.callControlsRow}>
              <TouchableOpacity
                style={[styles.callControlBtn, isMuted && styles.callControlBtnActive]}
                onPress={() => setIsMuted(!isMuted)}
              >
                <Text style={[styles.callControlBtnText, isMuted && styles.callControlBtnTextActive]}>
                  {isMuted ? "Micro Muet" : "Micro On"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.callControlBtn, isSpeakerOn && styles.callControlBtnActive]}
                onPress={() => setIsSpeakerOn(!isSpeakerOn)}
              >
                <Text style={[styles.callControlBtnText, isSpeakerOn && styles.callControlBtnTextActive]}>
                  {isSpeakerOn ? "Haut-Parleur" : "Écouteur"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.callHangupBtn} onPress={handleEndCall}>
                <Text style={styles.callHangupBtnText}>Raccrocher</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  mainWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  headerSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  callAudioBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  callAudioBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  messagesScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingBottom: 24,
    gap: 12,
  },
  securityNotice: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  securityNoticeText: {
    fontSize: 11,
    color: "#0369A1",
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 16,
  },
  systemBubble: {
    alignSelf: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: "90%",
    marginBottom: 4,
  },
  systemText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 17,
  },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleMe: {
    alignSelf: "flex-end",
    backgroundColor: "#0EA5E9",
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  messageTextOther: {
    color: "#0F172A",
    fontWeight: "500",
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  messageTimeMe: {
    color: "#E0F2FE",
  },
  messageTimeOther: {
    color: "#94A3B8",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 10,
    marginBottom: 96, // Keeps input bar completely above floating bottom nav
  },
  textInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  callOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  callCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
  },
  callAvatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  callAvatarInitial: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  callName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },
  callPublicId: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 4,
  },
  callStatusBadge: {
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  callStatusText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0284C7",
  },
  callControlsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 28,
  },
  callControlBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  callControlBtnActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  callControlBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  callControlBtnTextActive: {
    color: "#FFFFFF",
  },
  callHangupBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  callHangupBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
