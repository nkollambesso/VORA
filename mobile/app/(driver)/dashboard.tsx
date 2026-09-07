import React, { useEffect, useState } from "react";
import { getBackendUrl } from "@/lib/config";

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import { useClerkUser, useClerkAuth } from "@/lib/useClerkSafe";
import { voraSocket } from "@/lib/socket";

export default function DriverDashboard() {
  const { user } = useClerkUser();
  const { signOut } = useClerkAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      if (typeof window !== "undefined" && window.localStorage) {
        Object.keys(window.localStorage).forEach((k) => {
          if (k.includes("clerk") || k.includes("__clerk")) {
            window.localStorage.removeItem(k);
          }
        });
      }
    } catch (e) {
      console.warn("Sign-out error:", e);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/sign-in";
      } else {
        router.replace("/(auth)/sign-in" as any);
      }
    }
  };
  const [isOnline, setIsOnline] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayRidesCount, setTodayRidesCount] = useState(0);

  // Modals et formulaires
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);

  // Form states pour l'enregistrement du véhicule
  const [vehicleType, setVehicleType] = useState<"taxi" | "confort" | "moto">("taxi");
  const [vehicleModel, setVehicleModel] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleImage, setVehicleImage] = useState<string>("");
  const [vehicleDocuments, setVehicleDocuments] = useState<string>("");
  const [vehicleDocumentName, setVehicleDocumentName] = useState<string>("");
  const [driverAvatar, setDriverAvatar] = useState<string>("");
  const [isAnalyzingFace, setIsAnalyzingFace] = useState(false);
  const [faceAnalysisResult, setFaceAnalysisResult] = useState<{ isPerson: boolean; message: string } | null>(null);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // Charger le profil chauffeur
  const fetchDriver = async () => {
    try {
      const backendUrl =
        getBackendUrl();
      const res = await fetch(
        `${backendUrl}/api/drivers/profile/${user?.id || "driver_demo"}`
      );
      const data = await res.json();
      if (data.success && data.driver) {
        setDriverProfile(data.driver);
        setIsOnline(!!data.driver.is_online);
        setVehicleType(data.driver.vehicle_type || "taxi");
        setVehicleModel(data.driver.vehicle_model || "");
        setLicensePlate(data.driver.license_plate || "");
        setVehicleColor(data.driver.color || "");
        if (data.driver.vehicle_image) setVehicleImage(data.driver.vehicle_image);
        if (data.driver.vehicle_documents) {
          setVehicleDocuments(data.driver.vehicle_documents);
          // Déduire le nom du fichier depuis l'URL si possible
          const docUrl: string = data.driver.vehicle_documents;
          const urlParts = docUrl.split("/");
          setVehicleDocumentName(urlParts[urlParts.length - 1] || "Document existant");
        }
        if (data.driver.avatar_url) setDriverAvatar(data.driver.avatar_url);

        if (data.driver.today_earnings !== undefined) {
          setTodayEarnings(data.driver.today_earnings);
        }
        if (data.driver.today_rides_count !== undefined) {
          setTodayRidesCount(data.driver.today_rides_count);
        }
      } else {
        // Pas encore inscrit comme chauffeur
        setIsRegisterModalOpen(true);
      }
    } catch (err) {
      console.error("Erreur profil chauffeur:", err);
    }
  };

  useEffect(() => {
    fetchDriver();
  }, [user]);

  // Choisir l'image du véhicule (Obligatoire)
  const handlePickVehicleImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setVehicleImage(dataUrl);
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'accéder aux photos pour le véhicule.");
    }
  };

  // Choisir les papiers du véhicule (Carte grise, assurance, permis) — image OU PDF/DOC
  const handlePickVehicleDocuments = async () => {
    // Sur le web, on utilise un input file HTML invisible
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,application/pdf,.doc,.docx";
      input.onchange = async (e: any) => {
        const file: File = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          setVehicleDocuments(reader.result as string);
          setVehicleDocumentName(file.name);
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    // Sur mobile : choix entre image ou document
    try {
      const docRes = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf", "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (docRes.canceled) return;
      const asset = docRes.assets?.[0];
      if (!asset) return;

      if (asset.mimeType?.startsWith("image/")) {
        // Image : convertir en base64
        const imgRes = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.6,
          base64: true,
        });
        if (!imgRes.canceled && imgRes.assets?.[0]) {
          const a = imgRes.assets[0];
          setVehicleDocuments(a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri);
          setVehicleDocumentName(a.fileName || "document.jpg");
        }
      } else {
        // PDF/DOC : stocker l'URI locale (sera envoyée au backend comme URI)
        setVehicleDocuments(asset.uri);
        setVehicleDocumentName(asset.name || "document.pdf");
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'accéder aux fichiers du véhicule.");
    }
  };

  // Choisir la photo de profil avec analyse faciale IA
  const handlePickDriverAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        setDriverAvatar(dataUrl);
        setFaceAnalysisResult(null);

        // Appel IA de vérification faciale
        setIsAnalyzingFace(true);
        try {
          const backendUrl = getBackendUrl();
          const verifyRes = await fetch(`${backendUrl}/api/drivers/verify-face`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          });
          const analysis = await verifyRes.json();
          if (analysis.isPerson) {
            setFaceAnalysisResult({
              isPerson: true,
              message: "Visage humain validé par l'IA.",
            });
          } else {
            setFaceAnalysisResult({
              isPerson: false,
              message: analysis.reason || "Aucun visage humain net détecté. Veuillez fournir un selfie clair.",
            });
          }
        } catch {
          setFaceAnalysisResult({
            isPerson: true,
            message: "Photo de profil sélectionnée.",
          });
        } finally {
          setIsAnalyzingFace(false);
        }
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'accéder aux photos de profil.");
    }
  };

  // Submit enregistrement véhicule & contrat
  const handleRegisterDriver = async () => {
    setRegistrationError(null);

    if (!vehicleModel.trim() || !licensePlate.trim() || !vehicleColor.trim()) {
      setRegistrationError("Veuillez remplir le modèle du véhicule, la plaque et la couleur.");
      return;
    }

    if (!vehicleImage) {
      setRegistrationError("Veuillez charger une photo de votre véhicule afin que vos passagers puissent le reconnaître facilement.");
      return;
    }

    if (!vehicleDocuments) {
      setRegistrationError("Veuillez ajouter une photo nette de votre carte grise, attestation d'assurance ou permis de conduire.");
      return;
    }

    if (!driverAvatar) {
      setRegistrationError("Une photo de votre visage est strictement obligatoire pour la sécurité de la plateforme VORA.");
      return;
    }

    if (faceAnalysisResult && !faceAnalysisResult.isPerson) {
      setRegistrationError(faceAnalysisResult.message || "La photo de profil fournie ne correspond pas à un visage humain. Veuillez charger un selfie valide.");
      return;
    }

    if (!contractAccepted) {
      setRegistrationError("Vous devez accepter les termes du Contrat de Partenariat Chauffeur VORA pour finaliser votre inscription.");
      return;
    }

    setIsSubmitting(true);
    try {
      const backendUrl = getBackendUrl();
      const userId = user?.id || "driver_demo";

      const res = await fetch(`${backendUrl}/api/drivers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          vehicle_type: vehicleType,
          vehicle_model: vehicleModel.trim(),
          license_plate: licensePlate.trim().toUpperCase(),
          color: vehicleColor.trim(),
          vehicle_image: vehicleImage,
          avatar_url: driverAvatar,
          vehicle_documents: vehicleDocuments,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setDriverProfile(data.driver);
        setRegistrationError(null);
        setIsRegisterModalOpen(false);
        Alert.alert(
          "Inscription Chauffeur Reussie",
          `Votre véhicule ${data.driver.vehicle_model} (${data.driver.license_plate}) a été enregistré avec succès !`
        );
        fetchDriver();
      } else {
        setRegistrationError(data.error || "Impossible d'enregistrer le véhicule. Réessayez.");
      }
    } catch (err) {
      console.error("Erreur enregistrement chauffeur:", err);
      setRegistrationError("Problème de connexion au serveur VORA. Vérifiez votre connexion internet.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initialiser Socket.io et écouter les demandes de course
  useEffect(() => {
    const userId = user?.id || "driver_demo";
    const socket = voraSocket.connect(userId, "DRIVER");

    socket?.on("new-ride-available", (ride: any) => {
      if (isOnline) {
        router.push({
          pathname: "/(driver)/ride-request" as any,
          params: { rideData: JSON.stringify(ride) },
        });
      }
    });

    return () => {
      socket?.off("new-ride-available");
    };
  }, [user, isOnline]);

  // Loop d'envoi GPS si EN LIGNE
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isOnline) {
      const sendGPS = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({});
            setCurrentLocation(loc.coords);
            if (driverProfile?.id) {
              voraSocket.updateDriverLocation(
                driverProfile.id,
                loc.coords.latitude,
                loc.coords.longitude
              );
            }
          }
        } catch (err) {
          console.error("Erreur GPS chauffeur:", err);
        }
      };

      sendGPS();
      interval = setInterval(sendGPS, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOnline, driverProfile]);

  const handleToggleOnline = async (value: boolean) => {
    if (!driverProfile) {
      Alert.alert(
        "Enregistrement requis",
        "Veuillez enregistrer votre véhicule et valider votre contrat chauffeur avant de passer en ligne.",
        [{ text: "Enregistrer", onPress: () => setIsRegisterModalOpen(true) }]
      );
      return;
    }

    if (value && driverProfile?.verification_status !== "verified") {
      Alert.alert(
        "Vérification Didit Requise",
        "Vous devez faire vérifier votre identité biométrique avec Didit KYC dans votre profil pour pouvoir passer En Ligne et recevoir des courses.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Vérifier avec Didit",
            onPress: () => router.push("/(root)/(tabs)/profile" as any),
          },
        ]
      );
      return;
    }
    setIsOnline(value);
    try {
      const backendUrl =
        getBackendUrl();
      await fetch(`${backendUrl}/api/drivers/toggle-online`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverProfile?.id || 1,
          is_online: value,
          lat: currentLocation?.latitude || 3.8667,
          lng: currentLocation?.longitude || 11.5167,
        }),
      });
    } catch (err) {
      console.error("Erreur toggle online:", err);
    }
  };

  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const isKycVerified = driverProfile?.verification_status === "verified";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scroll,
        isWide && { width: "100%", maxWidth: 1080, alignSelf: "center" },
      ]}
    >
      {/* Header Sky Blue Glass */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={() => router.replace("/(root)/(tabs)/profile")}
            style={styles.backModeBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.backModeBtnText}>← Mode Passager</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(driver)/earnings" as any)}
            style={styles.earningsBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.earningsBtnText}>Revenus</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignOut}
            style={[styles.earningsBtn, { backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.4)" }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.earningsBtnText, { color: "#fca5a5" }]}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTag}>ESPACE CHAUFFEUR PARTENAIRE VORA</Text>
          <Text style={styles.headerName}>
            {user?.fullName || user?.firstName || "Chauffeur VORA"}
          </Text>
          <Text style={styles.headerVehicle}>
            {driverProfile?.vehicle_model
              ? `${driverProfile.vehicle_model} (${driverProfile.license_plate}) • ${driverProfile.color}`
              : "Véhicule non enregistré — Cliquez pour configurer"}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* Card Enregistrement & Contrat Véhicule */}
        <View style={styles.vehicleCard}>
          <View style={styles.vehicleCardHeader}>
            <View>
              <Text style={styles.vehicleCardTitle}>VÉHICULE ENREGISTRÉ</Text>
              <Text style={styles.vehicleCardSub}>
                {driverProfile?.vehicle_model
                  ? `${driverProfile.vehicle_model} [${driverProfile.vehicle_type?.toUpperCase()}]`
                  : "Aucun véhicule configuré"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editVehicleBtn}
              onPress={() => setIsRegisterModalOpen(true)}
            >
              <Text style={styles.editVehicleBtnText}>
                {driverProfile ? "Modifier le Véhicule" : "Enregistrer Véhicule"}
              </Text>
            </TouchableOpacity>
          </View>

          {driverProfile && (
            <View style={styles.vehicleDetailsGrid}>
              <View style={styles.vehicleDetailItem}>
                <Text style={styles.vehicleDetailLabel}>IMMATRICULATION</Text>
                <Text style={styles.vehicleDetailValue}>{driverProfile.license_plate}</Text>
              </View>
              <View style={styles.vehicleDetailItem}>
                <Text style={styles.vehicleDetailLabel}>COULEUR</Text>
                <Text style={styles.vehicleDetailValue}>{driverProfile.color}</Text>
              </View>
              <View style={styles.vehicleDetailItem}>
                <Text style={styles.vehicleDetailLabel}>CONTRAT VORA</Text>
                <Text style={styles.vehicleDetailValueSuccess}>Signé & Valide (15%)</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.contractLinkBtn}
            onPress={() => setIsContractModalOpen(true)}
          >
            <Text style={styles.contractLinkText}>
              Consulter le Contrat de Partenariat Chauffeur VORA →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Banner Avertissement Didit KYC si non vérifié */}
        {!isKycVerified && (
          <View style={styles.kycWarnCard}>
            <Text style={styles.kycWarnTitle}>Identité non vérifiée (Didit KYC)</Text>
            <Text style={styles.kycWarnText}>
              Votre compte n'a pas encore valide la vérification biométrique Didit. Vous devez compléter votre KYC pour passer en ligne.
            </Text>
            <TouchableOpacity
              style={styles.kycWarnBtn}
              onPress={() => router.push("/(root)/(tabs)/profile" as any)}
            >
              <Text style={styles.kycWarnBtnText}>Faire la Vérification Didit →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Toggle statut Online / Offline */}
        <View
          style={[
            styles.statusCard,
            { borderColor: isOnline ? "#0EA5E9" : "#CBD5E1" },
          ]}
        >
          <View style={styles.statusRow}>
            <View style={styles.statusTextGroup}>
              <Text style={styles.statusLabel}>STATUT DE DISPONIBILITÉ</Text>
              <Text
                style={[
                  styles.statusValue,
                  { color: isOnline ? "#0284C7" : "#64748B" },
                ]}
              >
                {isOnline
                  ? "EN LIGNE — Prêt pour les courses"
                  : "HORS LIGNE — En pause"}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: "#CBD5E1", true: "#0EA5E9" }}
              thumbColor={isOnline ? "#FFFFFF" : "#F1F5F9"}
            />
          </View>

          <View
            style={[
              styles.infoBox,
              { backgroundColor: isOnline ? "#F0F9FF" : "#F8FAFC" },
            ]}
          >
            <Text
              style={[
                styles.infoText,
                { color: isOnline ? "#0369A1" : "#64748B" },
              ]}
            >
              {isOnline
                ? "Position GPS transmise au serveur toutes les 10 secondes. Vous recevrez les demandes de courses en direct."
                : "Activez l'interrupteur pour commencer à recevoir des demandes de courses à proximité."}
            </Text>
          </View>
        </View>

        {/* Résumé de la Journée */}
        <Text style={styles.sectionTitle}>Performances de la Journée</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>GAINS DU JOUR</Text>
            <Text style={styles.metricValuePrimary}>
              {todayEarnings.toLocaleString()} FCFA
            </Text>
            <Text style={styles.metricSub}>Paiements encaissés (Commission VORA 15% deduite)</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>COURSES EFFECTUÉES</Text>
            <Text style={styles.metricValueDark}>
              {todayRidesCount} courses
            </Text>
            <Text style={styles.metricSubSuccess}>Taux de succès 100%</Text>
          </View>
        </View>

        {/* Simulation Button */}
        <TouchableOpacity
          onPress={() => {
            const mockRide = {
              id: `VORA-REQ-${Date.now()}`,
              rider_name: "Emmanuel Nkoumou",
              origin_address: "Carrefour Mokolo, Yaoundé",
              destination_address: "Quartier Bastos, Yaoundé",
              fare_fcfa: 1750,
              vehicle_type: "taxi",
              multiplier: 1.2,
            };
            router.push({
              pathname: "/(driver)/ride-request" as any,
              params: { rideData: JSON.stringify(mockRide) },
            });
          }}
          style={styles.demoBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.demoBtnText}>
            Simuler une Demande de Course
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal 1: Registration Form & Contract Acceptance */}
      <Modal visible={isRegisterModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Enregistrement Véhicule & Chauffeur</Text>
              <TouchableOpacity
                onPress={() => setIsRegisterModalOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#F1F5F9",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 8,
                }}
                accessibilityLabel="Fermer"
              >
                <Text style={{ fontSize: 18, color: "#64748B", fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Veuillez saisir les informations de votre véhicule et accepter le contrat de partenariat VORA.
            </Text>

            <ScrollView style={styles.formScroll}>
              <Text style={styles.formLabel}>TYPE DE VÉHICULE</Text>
              <View style={styles.typeSelectorRow}>
                {(["taxi", "confort", "moto"] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeSelectorItem,
                      vehicleType === type && styles.typeSelectorItemSelected,
                    ]}
                    onPress={() => setVehicleType(type)}
                  >
                    <Text
                      style={[
                        styles.typeSelectorText,
                        vehicleType === type && styles.typeSelectorTextSelected,
                      ]}
                    >
                      {type.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.formLabel}>MARQUE ET MODÈLE DU VÉHICULE</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Toyota Yaris, Hyundai Accent..."
                placeholderTextColor="#94A3B8"
                value={vehicleModel}
                onChangeText={setVehicleModel}
              />

              <Text style={styles.formLabel}>PLAQUE D'IMMATRICULATION</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: CE 482 AA, LT 891 AK..."
                placeholderTextColor="#94A3B8"
                value={licensePlate}
                onChangeText={setLicensePlate}
                autoCapitalize="characters"
              />

              <Text style={styles.formLabel}>COULEUR DU VÉHICULE</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Jaune Taxi, Gris Métallisé..."
                placeholderTextColor="#94A3B8"
                value={vehicleColor}
                onChangeText={setVehicleColor}
              />

              {/* Photo Obligatoire du Véhicule */}
              <Text style={styles.formLabel}>PHOTO DU VÉHICULE (OBLIGATOIRE)</Text>
              <Text style={styles.formHelpText}>
                Cette photo permet aux clients de reconnaître votre véhicule lors de la prise de contact.
              </Text>
              <TouchableOpacity
                style={styles.uploadBox}
                onPress={handlePickVehicleImage}
                activeOpacity={0.8}
              >
                {vehicleImage ? (
                  <View style={styles.uploadedImgWrapper}>
                    <Image source={{ uri: vehicleImage }} style={styles.uploadedImgPreview} resizeMode="cover" />
                    <View style={styles.changeImgBadge}>
                      <Text style={styles.changeImgText}>Modifier la photo</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadPlaceholderTitle}>Ajouter la photo du véhicule</Text>
                    <Text style={styles.uploadPlaceholderSub}>Format JPG, PNG ou WebP</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Papiers du Véhicule (Carte grise / Assurance / Permis) */}
              <Text style={styles.formLabel}>PAPIERS DU VÉHICULE (CARTE GRISE, ASSURANCE, PERMIS)</Text>
              <Text style={styles.formHelpText}>
                Téléversez une photo nette de votre carte grise, attestation d'assurance ou permis de conduire pour validation réglementaire.
              </Text>
              <TouchableOpacity
                style={styles.uploadBox}
                onPress={handlePickVehicleDocuments}
                activeOpacity={0.8}
              >
                {vehicleDocuments ? (
                  vehicleDocuments.startsWith("data:image") || vehicleDocuments.match(/\.(jpg|jpeg|png|webp)/i) ? (
                    <View style={styles.uploadedImgWrapper}>
                      <Image source={{ uri: vehicleDocuments }} style={styles.uploadedImgPreview} resizeMode="cover" />
                      <View style={styles.changeImgBadge}>
                        <Text style={styles.changeImgText}>Modifier le document</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.uploadPlaceholder, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
                      <Text style={{ fontSize: 28, marginBottom: 6 }}>📄</Text>
                      <Text style={[styles.uploadPlaceholderTitle, { color: "#1D4ED8" }]}>
                        {vehicleDocumentName || "Document ajouté"}
                      </Text>
                      <Text style={[styles.uploadPlaceholderSub, { color: "#3B82F6" }]}>Appuyer pour changer</Text>
                    </View>
                  )
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadPlaceholderTitle}>Ajouter les papiers du véhicule</Text>
                    <Text style={styles.uploadPlaceholderSub}>Image, PDF ou document Word</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Photo Obligatoire de Profil Chauffeur avec Vérification IA */}
              <Text style={styles.formLabel}>PHOTO DE PROFIL CHAUFFEUR (OBLIGATOIRE — VÉRIFICATION IA)</Text>
              <Text style={styles.formHelpText}>
                Une analyse IA vérifie automatiquement la conformité de votre visage humain pour la sécurité des passagers.
              </Text>
              <TouchableOpacity
                style={styles.uploadBox}
                onPress={handlePickDriverAvatar}
                activeOpacity={0.8}
              >
                {driverAvatar ? (
                  <View style={styles.uploadedAvatarWrapper}>
                    <Image source={{ uri: driverAvatar }} style={styles.uploadedAvatarPreview} resizeMode="cover" />
                    <View style={styles.changeImgBadge}>
                      <Text style={styles.changeImgText}>Changer le selfie</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadPlaceholderTitle}>Prendre un selfie de profil</Text>
                    <Text style={styles.uploadPlaceholderSub}>Photo de face bien éclairée</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Indicateur de Statut IA */}
              {isAnalyzingFace && (
                <View style={styles.aiAnalyzingBox}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text style={styles.aiAnalyzingText}>Analyse faciale par l'IA en cours...</Text>
                </View>
              )}
              {faceAnalysisResult && !isAnalyzingFace && (
                <View
                  style={[
                    styles.aiResultBox,
                    faceAnalysisResult.isPerson ? styles.aiResultBoxSuccess : styles.aiResultBoxError,
                  ]}
                >
                  <Text
                    style={[
                      styles.aiResultText,
                      faceAnalysisResult.isPerson ? styles.aiResultTextSuccess : styles.aiResultTextError,
                    ]}
                  >
                    {faceAnalysisResult.message}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.readContractBtn}
                onPress={() => setIsContractModalOpen(true)}
              >
                <Text style={styles.readContractBtnText}>
                  Lire le Contrat de Partenariat Chauffeur VORA →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setContractAccepted(!contractAccepted)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    contractAccepted && styles.checkboxBoxChecked,
                  ]}
                >
                  {contractAccepted && <Text style={styles.checkboxCheckmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  J'accepte l'intégralité des termes et conditions du Contrat de Partenariat Chauffeur VORA (15% de commission, exigences de sécurité et protection des données passagers).
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {registrationError && (
              <View style={{
                backgroundColor: "rgba(239,68,68,0.12)",
                borderWidth: 1,
                borderColor: "rgba(239,68,68,0.35)",
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginTop: 12,
              }}>
                <Text style={{ color: "#fca5a5", fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
                  {registrationError}
                </Text>
              </View>
            )}

            <View style={styles.modalActionRow}>
              {driverProfile && (
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsRegisterModalOpen(false)}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  isSubmitting && { opacity: 0.6 },
                ]}
                onPress={handleRegisterDriver}
                disabled={isSubmitting}
              >
                <Text style={styles.modalSubmitText}>
                  {isSubmitting ? "Enregistrement..." : "Valider mon Inscription"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Contrat de Partenariat VORA (Full Text) */}
      <Modal visible={isContractModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "88%" }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Contrat de Partenariat Chauffeur VORA</Text>
              <TouchableOpacity
                onPress={() => setIsContractModalOpen(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#F1F5F9",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 8,
                }}
                accessibilityLabel="Fermer"
              >
                <Text style={{ fontSize: 18, color: "#64748B", fontWeight: "700" }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Convention cadre de mise en relation et de prestations de transport VORA Cameroun.
            </Text>

            <ScrollView style={styles.contractTextScroll}>
              <Text style={styles.contractSectionHeader}>ARTICLE 1 : OBJET DU PARTENARIAT</Text>
              <Text style={styles.contractParagraph}>
                Le présent contrat régit la relation de partenariat entre la plateforme VORA ("VORA Cameroun") et le Chauffeur Partenaire Indépendant. VORA fournit un service technologique de mise en relation en temps réel entre des passagers urbains et des chauffeurs professionnels enregistrés.
              </Text>

              <Text style={styles.contractSectionHeader}>ARTICLE 2 : COMMISSION DE LA PLATEFORME (15%)</Text>
              <Text style={styles.contractParagraph}>
                En contrepartie de l'utilisation de la plateforme technologique VORA, de la géolocalisation, de l'accès aux clients et du traitement sécurisé des paiements Mobile Money, VORA prélève une commission fixe de 15% sur le montant hors taxe de chaque course validée et effectuée.
                Le solde de 85% revient intégralement au Chauffeur Partenaire et est versé sur son portefeuille in-app ou son compte Mobile Money.
              </Text>

              <Text style={styles.contractSectionHeader}>ARTICLE 3 : OBLIGATIONS DU VÉHICULE ET SÉCURITÉ</Text>
              <Text style={styles.contractParagraph}>
                Le chauffeur s'engage à utiliser un véhicule en parfait état mécanique et d'hygiène, doté d'une immatriculation valide en République du Cameroun, d'une carte grise conforme, d'une assurance transport de personnes valide et d'un contrôle technique à jour.
              </Text>

              <Text style={styles.contractSectionHeader}>ARTICLE 4 : VÉRIFICATION BIOMÉTRIQUE OBLIGATOIRE (Didit KYC)</Text>
              <Text style={styles.contractParagraph}>
                Conformément à la réglementation de sécurité VORA, tout chauffeur partenaire doit faire valider son identité et son permis de conduire via la technologie Didit KYC. Aucun chauffeur ne pourra basculer son statut "En Ligne" sans validation biométrique préalable.
              </Text>

              <Text style={styles.contractSectionHeader}>ARTICLE 5 : PROTECTION ET CONFIDENTIALITÉ DES DONNÉES PASSAGERS</Text>
              <Text style={styles.contractParagraph}>
                Le chauffeur s'engage strictement à respecter la vie privée des passagers. Les identités des passagers sont anonymisées sous forme de code unique (ex: VORA-A8F29C). Il est formellement interdit de réutiliser ou divulguer les numéros de téléphone ou adresses des clients en dehors du strict cadre de la course.
              </Text>

              <Text style={styles.contractSectionHeader}>ARTICLE 6 : QUALITÉ DE SERVICE ET ANNULATIONS</Text>
              <Text style={styles.contractParagraph}>
                Le chauffeur s'interdit d'annuler des courses acceptées sans motif légitime (panne mécanique avérée, cas de force majeure). Des annulations réitérées ou injustifiées entraîneront la suspension temporaire ou définitive du compte chauffeur.
              </Text>

              <Text style={styles.contractSectionHeader}>ARTICLE 7 : LITIGES ET RÈGLEMENTS</Text>
              <Text style={styles.contractParagraph}>
                En cas de désaccord sur le tarif ou l'itinéraire à la fin d'une course, les deux parties peuvent soumettre un litige via le bouton "Signaler un litige" dans l'application. L'équipe support VORA arbitrera le litige sous 24h.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.contractAcceptBtn}
              onPress={() => {
                setContractAccepted(true);
                setIsContractModalOpen(false);
              }}
            >
              <Text style={styles.contractAcceptText}>Fermer et Accepter le Contrat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backModeBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  backModeBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  headerTextGroup: {
    marginTop: 4,
  },
  headerTag: {
    color: "#E0F2FE",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  headerName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
  },
  headerVehicle: {
    color: "#BAE6FD",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  earningsBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
  },
  earningsBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  vehicleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 18,
    marginBottom: 20,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  vehicleCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  vehicleCardTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0EA5E9",
    letterSpacing: 0.8,
  },
  vehicleCardSub: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  editVehicleBtn: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#0EA5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editVehicleBtnText: {
    color: "#0284C7",
    fontSize: 12,
    fontWeight: "700",
  },
  vehicleDetailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  vehicleDetailItem: {
    flex: 1,
  },
  vehicleDetailLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  vehicleDetailValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  vehicleDetailValueSuccess: {
    fontSize: 12,
    fontWeight: "800",
    color: "#10B981",
    marginTop: 2,
  },
  contractLinkBtn: {
    alignSelf: "flex-start",
  },
  contractLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284C7",
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  infoBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  infoText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#64748B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  metricValuePrimary: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0EA5E9",
    marginTop: 6,
  },
  metricValueDark: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 6,
  },
  metricSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  metricSubSuccess: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10B981",
    marginTop: 4,
  },
  demoBtn: {
    backgroundColor: "#E0F2FE",
    borderWidth: 1.5,
    borderColor: "#0EA5E9",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  demoBtnText: {
    color: "#0284C7",
    fontSize: 14,
    fontWeight: "800",
  },
  kycWarnCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    padding: 16,
    marginBottom: 20,
  },
  kycWarnTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#991B1B",
    marginBottom: 4,
  },
  kycWarnText: {
    fontSize: 13,
    color: "#B91C1C",
    lineHeight: 18,
    marginBottom: 12,
  },
  kycWarnBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  kycWarnBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    maxHeight: "90%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  formScroll: {
    maxHeight: 380,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: 8,
  },
  typeSelectorItem: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  typeSelectorItemSelected: {
    backgroundColor: "#E0F2FE",
    borderColor: "#0EA5E9",
  },
  typeSelectorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  typeSelectorTextSelected: {
    color: "#0284C7",
  },
  readContractBtn: {
    marginTop: 16,
    marginBottom: 12,
  },
  readContractBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0EA5E9",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 10,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  checkboxCheckmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  modalActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  modalCancelText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },
  modalSubmitBtn: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  contractTextScroll: {
    maxHeight: 400,
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  contractSectionHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0EA5E9",
    marginTop: 12,
    marginBottom: 4,
  },
  contractParagraph: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 18,
    marginBottom: 8,
  },
  contractAcceptBtn: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  contractAcceptText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  formHelpText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
    lineHeight: 16,
  },
  uploadBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  uploadedImgWrapper: {
    width: "100%",
    height: 160,
    position: "relative",
  },
  uploadedImgPreview: {
    width: "100%",
    height: "100%",
  },
  uploadedAvatarWrapper: {
    width: "100%",
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    position: "relative",
  },
  uploadedAvatarPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  changeImgBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeImgText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  uploadPlaceholder: {
    padding: 20,
    alignItems: "center",
  },
  uploadPlaceholderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0284C7",
    marginBottom: 4,
  },
  uploadPlaceholderSub: {
    fontSize: 12,
    color: "#94A3B8",
  },
  aiAnalyzingBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    gap: 8,
  },
  aiAnalyzingText: {
    fontSize: 12,
    color: "#0369A1",
    fontWeight: "600",
  },
  aiResultBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  aiResultBoxSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  aiResultBoxError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  aiResultText: {
    fontSize: 12,
    fontWeight: "700",
  },
  aiResultTextSuccess: {
    color: "#166534",
  },
  aiResultTextError: {
    color: "#991B1B",
  },
});

