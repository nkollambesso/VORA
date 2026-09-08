// Stub web — expo-document-picker n'existe pas sur web
// On retourne toujours "annulé" car le web utilise <input type="file"> directement
export const getDocumentAsync = async (_opts?: any) => ({
  canceled: true,
  assets: [],
});
