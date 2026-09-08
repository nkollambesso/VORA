/**
 * VORA Configuration & Dynamic URL Resolver
 * Resolves localhost on web automatically to prevent network timeout errors on local dev.
 */
export const getBackendUrl = (): string => {
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5000";
    }
    if (host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.")) {
      return `http://${host}:5000`;
    }
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:5000";
};

export const getSocketUrl = (): string => {
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5000";
    }
    if (host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172.")) {
      return `http://${host}:5000`;
    }
  }
  return process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:5000";
};
