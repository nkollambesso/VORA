import { Platform } from "react-native";

export const getDocumentAsync = async (options?: any) => {
  if (Platform.OS === "web") {
    return { canceled: true, assets: [] };
  }
  try {
    const docPicker = require("expo-document-picker");
    return await docPicker.getDocumentAsync(options);
  } catch {
    return { canceled: true, assets: [] };
  }
};
