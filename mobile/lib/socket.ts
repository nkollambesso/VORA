import { io, Socket } from "socket.io-client";

class VoraSocketService {
  private socket: Socket | null = null;
  private backendUrl: string;

  constructor() {
    this.backendUrl = process.env.EXPO_PUBLIC_SOCKET_URL || "http://localhost:5000";
  }

  public connect(userId: string, role: "PASSENGER" | "DRIVER" | "ADMIN") {
    if (typeof window === "undefined") return null;
    if (this.socket && this.socket.connected) return this.socket;

    this.socket = io(this.backendUrl, {
      transports: ["websocket"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log(`[SOCKET VORA] Connecté au serveur Socket.io (ID: ${this.socket?.id})`);
      this.socket?.emit("join", { userId, role });
    });

    this.socket.on("disconnect", (reason) => {
      console.log(`[SOCKET VORA] Déconnecté: ${reason}`);
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public updateDriverLocation(driverId: number, lat: number, lng: number) {
    if (this.socket?.connected) {
      this.socket.emit("update-location-driver", { driverId, lat, lng });
    }
  }

  public requestRide(rideId: string) {
    if (this.socket?.connected) {
      this.socket.emit("request-ride", { rideId });
    }
  }

  public acceptRide(rideId: string, driverId: number) {
    if (this.socket?.connected) {
      this.socket.emit("accept-ride", { rideId, driverId });
    }
  }

  public declineRide(rideId: string, driverId: number) {
    if (this.socket?.connected) {
      this.socket.emit("decline-ride", { rideId, driverId });
    }
  }

  public startRideWithOTP(rideId: string, otpInput: string) {
    if (this.socket?.connected) {
      this.socket.emit("start-ride-otp", { rideId, otpInput });
    }
  }

  public endRide(rideId: string) {
    if (this.socket?.connected) {
      this.socket.emit("declare-arrival", { rideId });
    }
  }

  public declareArrival(rideId: string) {
    if (this.socket?.connected) {
      this.socket.emit("declare-arrival", { rideId });
    }
  }

  public confirmRideEnd(rideId: string, rating?: number) {
    if (this.socket?.connected) {
      this.socket.emit("confirm-ride-end", { rideId, rating });
    }
  }

  public disputeRide(rideId: string, riderId: string, driverId: number, reason: string) {
    if (this.socket?.connected) {
      this.socket.emit("dispute-ride", { rideId, riderId, driverId, reason });
    }
  }

  public sendSOS(userId: string, userRole: string, lat: number, lng: number) {
    if (this.socket?.connected) {
      this.socket.emit("sos-trigger", { userId, userRole, lat, lng });
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const voraSocket = new VoraSocketService();
