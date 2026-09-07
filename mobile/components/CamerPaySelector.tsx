import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface CamerPaySelectorProps {
  amountFcfa: number;
  selectedMethod: "CASH" | "MTN_MOMO" | "ORANGE_MONEY" | "WALLET";
  onSelectMethod: (method: "CASH" | "MTN_MOMO" | "ORANGE_MONEY" | "WALLET") => void;
  phoneNumber: string;
  onPhoneChange: (phone: string) => void;
}

export const CamerPaySelector: React.FC<CamerPaySelectorProps> = ({
  amountFcfa,
  selectedMethod,
  onSelectMethod,
  phoneNumber,
  onPhoneChange,
}) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Mode de Règlement</Text>
      <Text style={styles.amountSub}>
        Montant total de la course :{" "}
        <Text style={styles.amountBold}>{amountFcfa.toLocaleString()} FCFA</Text>
      </Text>

      {/* Options de paiement */}
      <View style={styles.optionsList}>
        {/* Espèces */}
        <TouchableOpacity
          onPress={() => onSelectMethod("CASH")}
          style={[styles.optionCard, selectedMethod === "CASH" && styles.optionCardActive]}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: "#DCFCE7" }]}>
              <Text style={[styles.iconText, { color: "#166534" }]}>CASH</Text>
            </View>
            <View>
              <Text style={styles.optionTitle}>Espèces</Text>
              <Text style={styles.optionSub}>Règlement direct auprès du chauffeur</Text>
            </View>
          </View>
          <View style={[styles.radioOuter, selectedMethod === "CASH" && styles.radioOuterActive]}>
            {selectedMethod === "CASH" && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* MTN Mobile Money */}
        <TouchableOpacity
          onPress={() => onSelectMethod("MTN_MOMO")}
          style={[styles.optionCard, selectedMethod === "MTN_MOMO" && styles.optionCardActive]}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: "#FEF3C7" }]}>
              <Text style={[styles.iconText, { color: "#B45309" }]}>MTN</Text>
            </View>
            <View>
              <Text style={styles.optionTitle}>MTN Mobile Money</Text>
              <Text style={styles.optionSub}>Paiement mobile instantané CamerPay</Text>
            </View>
          </View>
          <View style={[styles.radioOuter, selectedMethod === "MTN_MOMO" && styles.radioOuterActive]}>
            {selectedMethod === "MTN_MOMO" && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* Orange Money */}
        <TouchableOpacity
          onPress={() => onSelectMethod("ORANGE_MONEY")}
          style={[styles.optionCard, selectedMethod === "ORANGE_MONEY" && styles.optionCardActive]}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: "#FFEDD5" }]}>
              <Text style={[styles.iconText, { color: "#C2410C" }]}>OM</Text>
            </View>
            <View>
              <Text style={styles.optionTitle}>Orange Money</Text>
              <Text style={styles.optionSub}>Paiement mobile instantané CamerPay</Text>
            </View>
          </View>
          <View style={[styles.radioOuter, selectedMethod === "ORANGE_MONEY" && styles.radioOuterActive]}>
            {selectedMethod === "ORANGE_MONEY" && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>

        {/* Portefeuille VORA (Wallet) */}
        <TouchableOpacity
          onPress={() => onSelectMethod("WALLET")}
          style={[styles.optionCard, selectedMethod === "WALLET" && styles.optionCardActive]}
          activeOpacity={0.8}
        >
          <View style={styles.optionLeft}>
            <View style={[styles.iconCircle, { backgroundColor: "#E0F2FE" }]}>
              <Ionicons name="wallet-outline" size={18} color="#0284C7" />
            </View>
            <View>
              <Text style={styles.optionTitle}>Portefeuille In-App VORA</Text>
              <Text style={styles.optionSub}>Débit automatique sur votre solde VORA</Text>
            </View>
          </View>
          <View style={[styles.radioOuter, selectedMethod === "WALLET" && styles.radioOuterActive]}>
            {selectedMethod === "WALLET" && <View style={styles.radioInner} />}
          </View>
        </TouchableOpacity>
      </View>

      {/* Saisie Numéro MoMo si MTN ou Orange */}
      {(selectedMethod === "MTN_MOMO" || selectedMethod === "ORANGE_MONEY") && (
        <View style={styles.phoneInputContainer}>
          <Text style={styles.phoneInputLabel}>
            Numéro de Compte {selectedMethod === "MTN_MOMO" ? "MTN MoMo" : "Orange Money"} (9 chiffres) :
          </Text>
          <View style={styles.phoneInputRow}>
            <Text style={styles.phonePrefix}>+237</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="6XXXXXXXX"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={onPhoneChange}
              maxLength={9}
            />
          </View>
        </View>
      )}
    </View>
  );
};

export default CamerPaySelector;

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    marginTop: 14,
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  amountSub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 14,
  },
  amountBold: {
    fontWeight: "800",
    color: "#0EA5E9",
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
  },
  optionCardActive: {
    backgroundColor: "#F0F9FF",
    borderColor: "#0EA5E9",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: {
    fontSize: 11,
    fontWeight: "800",
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  optionSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  radioOuterActive: {
    borderColor: "#0EA5E9",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#0EA5E9",
  },
  phoneInputContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  phoneInputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  phonePrefix: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
});
