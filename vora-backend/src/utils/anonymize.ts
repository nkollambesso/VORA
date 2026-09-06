/**
 * Utility functions for user privacy & anonymization
 */

// Génère un ID public unique au format "VORA-XXXXXX"
export function generatePublicId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Caractères lisibles sans ambiguïté
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `VORA-${code}`;
}

// Formate le nom complet en Prénom + Initiale du nom (ex: "Jean-Paul Tchouamo" -> "Jean-Paul T.")
export function formatDisplayName(fullName?: string): string {
  if (!fullName || !fullName.trim()) return 'Utilisateur VORA';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts.slice(0, parts.length - 1).join(' ');
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// Masque le numéro de téléphone pour la sécurité (ex: "+237 699112233" -> "+237 6** ** ** 33")
export function maskPhoneNumber(phone?: string): string {
  if (!phone || phone.length < 6) return 'Masqué';
  const clean = phone.trim();
  const visiblePrefix = clean.substring(0, 7);
  const visibleSuffix = clean.substring(clean.length - 2);
  return `${visiblePrefix} ** ** ${visibleSuffix}`;
}
