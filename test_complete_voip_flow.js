const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:5000";
const RIDE_ID = "ride_voip_test_99";
const RIDER_ID = "user_rider_1";
const DRIVER_ID = "user_driver_1";

async function runVoipTest() {
  console.log("🚀 Lancement du test complet VoIP In-App VORA...");

  const riderSocket = io(SERVER_URL, { transports: ["websocket"] });
  const driverSocket = io(SERVER_URL, { transports: ["websocket"] });

  await new Promise((resolve) => {
    let connectedCount = 0;
    const check = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    riderSocket.on("connect", () => {
      console.log("✅ Rider connecté:", riderSocket.id);
      riderSocket.emit("join", { userId: RIDER_ID, role: "PASSENGER" });
      riderSocket.emit("join-ride", { rideId: RIDE_ID });
      check();
    });
    driverSocket.on("connect", () => {
      console.log("✅ Driver connecté:", driverSocket.id);
      driverSocket.emit("join", { userId: DRIVER_ID, role: "DRIVER" });
      driverSocket.emit("join-ride", { rideId: RIDE_ID });
      check();
    });
  });

  // Test 1: Passager appelle Chauffeur -> Vérifier sonnerie chez Chauffeur
  console.log("\n--- TEST 1: Passager appelle Chauffeur (Passenger -> Driver Ringing) ---");
  const driverGotCallPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout: Chauffeur n'a pas reçu la sonnerie")), 4000);
    driverSocket.on("webrtc-incoming-call", (data) => {
      clearTimeout(timer);
      console.log("🔔 [CHAUFFEUR] Sonnerie reçue ! Appelant:", data.callerName, "Ride:", data.rideId);
      resolve(data);
    });
  });

  riderSocket.emit("webrtc-call-ride", {
    rideId: RIDE_ID,
    callerId: RIDER_ID,
    callerName: "Passager Test",
    targetUserId: DRIVER_ID,
    offer: { type: "offer", sdp: "dummy-offer-sdp" },
  });

  const callData = await driverGotCallPromise;
  if (!callData) throw new Error("Échec réception appel chez le chauffeur");

  // Test 2: Chauffeur répond -> Vérifier confirmation chez Passager
  console.log("\n--- TEST 2: Chauffeur répond (Answer -> Passenger) ---");
  const riderGotAnswerPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout: Passager n'a pas reçu l'acceptation")), 4000);
    riderSocket.on("webrtc-call-answered", (data) => {
      clearTimeout(timer);
      console.log("📞 [PASSAGER] Appel décroché par le chauffeur ! Ride:", data.rideId);
      resolve(data);
    });
  });

  driverSocket.emit("webrtc-answer-ride", {
    rideId: RIDE_ID,
    callerId: RIDER_ID,
    targetUserId: RIDER_ID,
    answer: { type: "answer", sdp: "dummy-answer-sdp" },
  });

  await riderGotAnswerPromise;

  // Test 3: Transmission de flux vocal en direct (Audio Chunks)
  console.log("\n--- TEST 3: Retransmission des paquets vocaux (Audio Chunks Bidirectionnels) ---");
  const riderGotAudioPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout: Audio chunk non reçu")), 4000);
    riderSocket.on("webrtc-audio-chunk", (data) => {
      clearTimeout(timer);
      console.log("🔊 [PASSAGER] Paquet audio reçu du chauffeur ! Taille base64:", data.audioBase64.length);
      resolve(data);
    });
  });

  driverSocket.emit("webrtc-audio-chunk", {
    rideId: RIDE_ID,
    audioBase64: "data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQ8USAElBQ==",
    targetUserId: RIDER_ID,
  });

  await riderGotAudioPromise;

  // Test 4: Passager raccroche -> Vérifier raccrochage immédiat chez le Chauffeur
  console.log("\n--- TEST 4: Passager raccroche (Hangup synchronization) ---");
  const driverGotHangupPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout: Chauffeur n'a pas reçu le raccrochage")), 4000);
    driverSocket.on("webrtc-call-ended", (data) => {
      clearTimeout(timer);
      console.log("📴 [CHAUFFEUR] Appel clôturé avec succès suite au raccrochage passager !");
      resolve(data);
    });
  });

  riderSocket.emit("webrtc-hangup-ride", {
    rideId: RIDE_ID,
    targetUserId: DRIVER_ID,
  });

  await driverGotHangupPromise;

  // Test 5: Sens Inverse - Chauffeur appelle Passager
  console.log("\n--- TEST 5: Chauffeur appelle Passager (Driver -> Passenger) ---");
  const riderGotCallPromise2 = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout: Passager n'a pas reçu l'appel du chauffeur")), 4000);
    riderSocket.on("webrtc-incoming-call", (data) => {
      clearTimeout(timer);
      console.log("🔔 [PASSAGER] Sonnerie reçue du chauffeur ! Appelant:", data.callerName);
      resolve(data);
    });
  });

  driverSocket.emit("webrtc-call-ride", {
    rideId: RIDE_ID,
    callerId: DRIVER_ID,
    callerName: "Chauffeur Test",
    targetUserId: RIDER_ID,
    offer: { type: "offer", sdp: "dummy-offer-driver" },
  });

  await riderGotCallPromise2;

  // Test 6: Chauffeur raccroche -> Passager reçoit fin d'appel
  console.log("\n--- TEST 6: Chauffeur raccroche ---");
  const riderGotHangupPromise2 = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout: Passager n'a pas reçu le raccrochage chauffeur")), 4000);
    riderSocket.on("webrtc-call-ended", (data) => {
      clearTimeout(timer);
      console.log("📴 [PASSAGER] Appel clôturé avec succès suite au raccrochage chauffeur !");
      resolve(data);
    });
  });

  driverSocket.emit("webrtc-hangup-ride", {
    rideId: RIDE_ID,
    targetUserId: RIDER_ID,
  });

  await riderGotHangupPromise2;

  console.log("\n🎉 TOUS LES TESTS VOIP & AUDIO SONT VALIDÉS À 100% SANS AUCUNE ERREUR !");
  riderSocket.disconnect();
  driverSocket.disconnect();
  process.exit(0);
}

runVoipTest().catch((err) => {
  console.error("❌ ERREUR TEST VOIP:", err);
  process.exit(1);
});
