import {
  TextInput,
  View,
  Text,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";

import { InputFieldProps } from "@/types/type";

const InputField = ({
  label,
  icon,
  secureTextEntry = false,
  labelStyle,
  containerStyle,
  inputStyle,
  iconStyle,
  className,
  ...props
}: InputFieldProps) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.wrapper}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputRow}>
          {icon && (
            <Image
              source={icon}
              style={styles.icon}
              resizeMode="contain"
            />
          )}
          <TextInput
            style={styles.input}
            secureTextEntry={secureTextEntry}
            placeholderTextColor="#9ca3af"
            {...props}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default InputField;

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
    width: "100%",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
    fontFamily: "Jakarta-SemiBold",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 4,
    minHeight: 52,
  },
  icon: {
    width: 20,
    height: 20,
    marginHorizontal: 12,
    tintColor: "#64748b",
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    paddingVertical: 14,
    paddingHorizontal: 8,
    fontFamily: "Jakarta-Medium",
    outlineStyle: "none", // web only
  } as any,
});
