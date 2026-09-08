import { TouchableOpacity, Text, StyleSheet, View } from "react-native";

import { ButtonProps } from "@/types/type";

// Inline style maps (replaces NativeWind classNames that don't render on web)
const bgColors: Record<string, string> = {
  primary: "#0EA5E9",
  secondary: "#6b7280",
  danger: "#ef4444",
  success: "#22c55e",
  outline: "transparent",
};

const textColors: Record<string, string> = {
  default: "#ffffff",
  primary: "#0f172a",
  secondary: "#f3f4f6",
  danger: "#fee2e2",
  success: "#dcfce7",
};

const CustomButton = ({
  onPress,
  title,
  bgVariant = "primary",
  textVariant = "default",
  IconLeft,
  IconRight,
  className,
  style,
  ...props
}: ButtonProps & { style?: any }) => {
  const isOutline = bgVariant === "outline";

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.btn,
        {
          backgroundColor: bgColors[bgVariant] ?? "#0EA5E9",
          borderWidth: isOutline ? 1.5 : 0,
          borderColor: isOutline ? "#d1d5db" : "transparent",
          shadowColor: isOutline ? "transparent" : bgColors[bgVariant],
        },
        style,
      ]}
      activeOpacity={0.82}
      {...props}
    >
      {IconLeft && <IconLeft />}
      <Text
        style={[
          styles.btnText,
          { color: textColors[textVariant] ?? "#ffffff" },
        ]}
      >
        {title}
      </Text>
      {IconRight && <IconRight />}
    </TouchableOpacity>
  );
};

export default CustomButton;

const styles = StyleSheet.create({
  btn: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: 100,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    flexShrink: 1,
  },
});
