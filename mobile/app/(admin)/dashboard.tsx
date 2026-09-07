import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
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
import { getBackendUrl } from "@/lib/config";
import { clearAdminToken, getAdminToken } from "@/lib/adminAuth";

const BACKEND_URL = getBackendUrl();

type DashboardTab = "OVERVIEW" | "WALLET" | "SUPPORT" | "ACCOUNTS" | "ADMINS" | "SECURITY";

export default function AdminDashboard() {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [activeTab, setActiveTab] = useState<DashboardTab>("OVERVIEW");

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isSimulation, setIsSimulation] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [adminName, setAdminName] = useState<string>("Administrateur VORA");

  // ─── Data: Admin Wallet & Commissions ──────────────────────────────────────
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [recentCommissions, setRecentCommissions] = useState<any[]>([]);
  const [rateInput, setRateInput] = useState<string>("10");
  const [updatingRate, setUpdatingRate] = useState<boolean>(false);
  const [showRateModal, setShowRateModal] = useState<boolean>(false);

  // ─── Data: Support Calls & Social Assistants ───────────────────────────────
  const [supportCalls, setSupportCalls] = useState<any[]>([]);
  const [loadingSupport, setLoadingSupport] = useState<boolean>(false);
  const [supportFilter, setSupportFilter] = useState<string>("ALL");

  // ─── Data: Accounts & Admins ───────────────────────────────────────────────
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // ─── Form: Add New Admin Modal ─────────────────────────────────────────────
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("ADMIN");
  const [submittingAdmin, setSubmittingAdmin] = useState(false);

  // ─── Form: Profile Update ──────────────────────────────────────────────────
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [profileCurrentPassword, setProfileCurrentPassword] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // ─── Form: Password Change ─────────────────────────────────────────────────
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const getAuthHeaders = async () => {
    const token = await getAdminToken();
    return {
      "Content-Type": "application/json",
      "x-admin-token": token || "",
    };
  };

  const handleLogout = async () => {
    try {
      const token = await getAdminToken();
      if (token) {
        await fetch(`${BACKEND_URL}/api/admin/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }
    } catch {}
    await clearAdminToken();
    router.replace("/(auth)/sign-in" as any);
  };

  // ─── Fetch Platform Stats & Disputes ───────────────────────────────────────
  const fetchStats = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/dashboard-stats`, { headers });
      if (res.status === 401) {
        await clearAdminToken();
        router.replace("/(auth)/sign-in" as any);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setIsSimulation(!!data.stats.isSimulationMode);
      }

      // Fetch disputes list
      const dispRes = await fetch(`${BACKEND_URL}/api/disputes`, { headers });
      const dispData = await dispRes.json();
      if (dispData.success && dispData.disputes) {
        setDisputes(dispData.disputes);
      }
    } catch (err) {
      console.error("Erreur chargement stats admin:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ─── Fetch Admins & Accounts ───────────────────────────────────────────────
  const fetchAccountsAndAdmins = async () => {
    setLoadingAccounts(true);
    try {
      const headers = await getAuthHeaders();

      // Fetch admin accounts
      const adminRes = await fetch(`${BACKEND_URL}/api/admin/admins`, { headers });
      const adminData = await adminRes.json();
      if (adminData.success) {
        setAdminsList(adminData.admins || []);
      }

      // Fetch all system accounts (users & drivers)
      const accRes = await fetch(`${BACKEND_URL}/api/admin/accounts`, { headers });
      const accData = await accRes.json();
      if (accData.success) {
        setUsersList(accData.users || []);
      }
    } catch (e) {
      console.error("Erreur chargement des comptes:", e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // ─── Fetch Admin Wallet & Commissions ──────────────────────────────────────
  const fetchWalletData = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/wallet`, { headers });
      const data = await res.json();
      if (data.success) {
        setWalletInfo(data.wallet);
        setRecentCommissions(data.recent_commissions || []);
        if (data.wallet?.commission_rate) {
          setRateInput(String(Math.round(parseFloat(data.wallet.commission_rate) * 100)));
        }
      }
    } catch (err) {
      console.error("Erreur chargement wallet:", err);
    }
  };

  // ─── Fetch Support Calls & Conflicts ───────────────────────────────────────
  const fetchSupportCalls = async () => {
    setLoadingSupport(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/support-calls`, { headers });
      const data = await res.json();
      if (data.success) {
        setSupportCalls(data.calls || []);
      }
    } catch (err) {
      console.error("Erreur chargement support calls:", err);
    } finally {
      setLoadingSupport(false);
    }
  };

  // ─── Update Commission Rate ────────────────────────────────────────────────
  const handleUpdateCommissionRate = async () => {
    const parsed = parseFloat(rateInput);
    if (isNaN(parsed) || parsed < 0 || parsed > 50) {
      Alert.alert("Taux invalide", "Veuillez saisir un pourcentage compris entre 0% et 50%.");
      return;
    }
    setUpdatingRate(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/wallet/rate`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ rate: parsed / 100 }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Taux mis à jour", data.message || `Commission fixée à ${parsed}%.`);
        setShowRateModal(false);
        fetchWalletData();
        fetchStats();
      } else {
        Alert.alert("Erreur", data.error || "Impossible de mettre à jour le taux.");
      }
    } catch {
      Alert.alert("Erreur", "Erreur réseau lors de la mise à jour du taux.");
    } finally {
      setUpdatingRate(false);
    }
  };

  // ─── Block / Unblock User Account ──────────────────────────────────────────
  const handleToggleBlockUser = (userId: string, shouldBlock: boolean, userName: string) => {
    Alert.alert(
      shouldBlock ? "Bloquer le compte" : "Débloquer le compte",
      `Êtes-vous certain de vouloir ${shouldBlock ? "suspendre" : "réactiver"} le compte de ${userName} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: shouldBlock ? "Bloquer" : "Débloquer",
          style: shouldBlock ? "destructive" : "default",
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}/block`, {
                method: "POST",
                headers,
                body: JSON.stringify({ block: shouldBlock }),
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert("Statut mis à jour", data.message);
                fetchAccountsAndAdmins();
                fetchStats();
              } else {
                Alert.alert("Erreur", data.error || "Action impossible.");
              }
            } catch {
              Alert.alert("Erreur", "Problème réseau lors du blocage.");
            }
          },
        },
      ]
    );
  };

  // ─── Support Call Status Update ────────────────────────────────────────────
  const handleUpdateSupportCallStatus = async (callId: number, newStatus: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/support-calls/${callId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: newStatus, assigned_to: adminEmail }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Succès", `Appel #${callId} mis à jour : ${newStatus}.`);
        fetchSupportCalls();
        fetchStats();
      } else {
        Alert.alert("Erreur", data.error || "Impossible de mettre à jour l'appel.");
      }
    } catch {
      Alert.alert("Erreur", "Erreur réseau lors de la mise à jour.");
    }
  };

  // ─── Reset / Wipe Database ─────────────────────────────────────────────────
  const handleResetDatabase = () => {
    Alert.alert(
      "Réinitialiser la Base de Données",
      "ATTENTION : Cette action supprimera toutes les courses, chauffeurs, litiges et comptes usagers de test. Voulez-vous continuer ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Vider la Base",
          style: "destructive",
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(`${BACKEND_URL}/api/admin/reset-database`, {
                method: "POST",
                headers,
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert("Base de données vidée", data.message);
                fetchStats();
                fetchAccountsAndAdmins();
                fetchWalletData();
                fetchSupportCalls();
              } else {
                Alert.alert("Erreur", data.error || "Échec de réinitialisation.");
              }
            } catch {
              Alert.alert("Erreur", "Erreur réseau.");
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    // Verify admin token on mount before loading data
    const init = async () => {
      const token = await getAdminToken();
      if (!token) {
        router.replace("/(auth)/sign-in" as any);
        return;
      }
      try {
        const res = await fetch(`${BACKEND_URL}/api/admin/verify-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!data.success) {
          await clearAdminToken();
          router.replace("/(auth)/sign-in" as any);
          return;
        }
        setAdminEmail(data.email || "");
        setEditEmail(data.email || "");
      } catch {}
      fetchStats();
      fetchAccountsAndAdmins();
      fetchWalletData();
      fetchSupportCalls();
    };
    init();
  }, []);

  const handleToggleSimulation = async (value: boolean) => {
    setUpdating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/toggle-simulation`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          enable: value,
          adminEmail: adminEmail || "admin@vora.cm",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSimulation(value);
        Alert.alert(
          "Paramètre Modifié",
          value
            ? "Mode Simulation CamerPay ACTIVÉ : paiements réussis automatiquement."
            : "Mode Réel CamerPay ACTIVÉ : requêtes directes vers l'opérateur."
        );
      }
    } catch {
      Alert.alert("Erreur", "Impossible de mettre a jour le mode simulation.");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateDisputeStatus = async (disputeId: number, newStatus: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/disputes/${disputeId}/status`, {
        method: "POST",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Statut Mis à Jour", `Litige #${disputeId} marqué '${newStatus}'.`);
        fetchStats();
      }
    } catch {
      Alert.alert("Erreur", "Impossible de mettre à jour le litige.");
    }
  };

  // ─── Create Admin Account ──────────────────────────────────────────────────
  const handleCreateAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminPassword.trim()) {
      Alert.alert("Champs requis", "Veuillez saisir l'adresse email et le mot de passe.");
      return;
    }
    if (newAdminPassword.length < 8) {
      Alert.alert("Mot de passe trop court", "Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    setSubmittingAdmin(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/admins`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: newAdminEmail.trim(),
          password: newAdminPassword,
          name: newAdminName.trim() || "Administrateur VORA",
          role: newAdminRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Succès", "Nouveau compte administrateur créé avec succès.");
        setIsAddAdminModalOpen(false);
        setNewAdminEmail("");
        setNewAdminPassword("");
        setNewAdminName("");
        fetchAccountsAndAdmins();
      } else {
        Alert.alert("Erreur", data.error || "Impossible de créer l'administrateur.");
      }
    } catch {
      Alert.alert("Erreur", "Erreur réseau lors de la création.");
    } finally {
      setSubmittingAdmin(false);
    }
  };

  // ─── Delete Admin Account ──────────────────────────────────────────────────
  const handleDeleteAdmin = (id: number, email: string) => {
    Alert.alert(
      "Confirmation de suppression",
      `Êtes-vous certain de vouloir supprimer le compte administrateur ${email} ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(`${BACKEND_URL}/api/admin/admins/${id}`, {
                method: "DELETE",
                headers,
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert("Supprimé", "Le compte administrateur a été retiré.");
                fetchAccountsAndAdmins();
              } else {
                Alert.alert("Erreur", data.error || "Impossible de supprimer ce compte.");
              }
            } catch {
              Alert.alert("Erreur", "Problème réseau lors de la suppression.");
            }
          },
        },
      ]
    );
  };

  // ─── Update Profile (Email / Name) ─────────────────────────────────────────
  const handleUpdateProfile = async () => {
    if (!profileCurrentPassword) {
      Alert.alert("Mot de passe requis", "Veuillez entrer votre mot de passe actuel pour valider ces modifications.");
      return;
    }

    setUpdatingProfile(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/profile`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          newEmail: editEmail.trim(),
          newName: editName.trim() || undefined,
          currentPassword: profileCurrentPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Profil mis à jour", "Vos informations administrateur ont été enregistrées.");
        setAdminEmail(data.admin?.email || editEmail.trim());
        setProfileCurrentPassword("");
        fetchAccountsAndAdmins();
      } else {
        Alert.alert("Erreur", data.error || "Échec de la mise à jour du profil.");
      }
    } catch {
      Alert.alert("Erreur", "Erreur réseau lors de la mise à jour.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  // ─── Change Password ───────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      Alert.alert("Champs requis", "Veuillez remplir tous les champs de mot de passe.");
      return;
    }
    if (pwNew !== pwConfirm) {
      Alert.alert("Non concordance", "Le nouveau mot de passe et sa confirmation ne correspondent pas.");
      return;
    }
    if (pwNew.length < 8) {
      Alert.alert("Mot de passe trop court", "Le nouveau mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${BACKEND_URL}/api/admin/change-password`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          currentPassword: pwCurrent,
          newPassword: pwNew,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Mot de passe modifié", "Votre nouveau mot de passe a été enregistré avec succès.");
        setPwCurrent("");
        setPwNew("");
        setPwConfirm("");
      } else {
        Alert.alert("Erreur", data.error || "Impossible de modifier le mot de passe.");
      }
    } catch {
      Alert.alert("Erreur", "Erreur réseau lors du changement de mot de passe.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const StatCard = ({
    label,
    value,
    sub,
    accent,
  }: {
    label: string;
    value: string | number;
    sub?: string;
    accent?: boolean;
  }) => (
    <View style={[styles.statCard, isWide && styles.statCardWide]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>
        {value}
      </Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isWide && { maxWidth: 1100, alignSelf: "center", width: "100%" },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchStats();
              fetchAccountsAndAdmins();
              fetchWalletData();
              fetchSupportCalls();
            }}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadgeRow}>
            <TouchableOpacity
              style={styles.backAppBtn}
              onPress={() => router.replace("/(root)/(tabs)/profile")}
              activeOpacity={0.8}
            >
              <Text style={styles.backAppBtnText}>← Retour App</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>VORA</Text>
              </View>
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>PANEL ADMINISTRATION</Text>
              </View>
            </View>
          </View>
          <Text style={styles.headerTitle}>Administration VORA</Text>
          <Text style={styles.headerSub}>
            {adminEmail ? `Session active : ${adminEmail}` : "Gestion plateforme, sécurité et comptes"}
          </Text>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutBtnText}>Déconnexion Admin</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === "OVERVIEW" && styles.tabItemActive]}
            onPress={() => setActiveTab("OVERVIEW")}
          >
            <Text style={[styles.tabText, activeTab === "OVERVIEW" && styles.tabTextActive]}>
              Aperçu & Litiges
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === "WALLET" && styles.tabItemActive]}
            onPress={() => setActiveTab("WALLET")}
          >
            <Text style={[styles.tabText, activeTab === "WALLET" && styles.tabTextActive]}>
              Commissions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === "SUPPORT" && styles.tabItemActive]}
            onPress={() => setActiveTab("SUPPORT")}
          >
            <Text style={[styles.tabText, activeTab === "SUPPORT" && styles.tabTextActive]}>
              Assistance ({supportCalls.filter((c: any) => c.status === "PENDING").length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === "ACCOUNTS" && styles.tabItemActive]}
            onPress={() => setActiveTab("ACCOUNTS")}
          >
            <Text style={[styles.tabText, activeTab === "ACCOUNTS" && styles.tabTextActive]}>
              Comptes Usagers ({usersList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === "ADMINS" && styles.tabItemActive]}
            onPress={() => setActiveTab("ADMINS")}
          >
            <Text style={[styles.tabText, activeTab === "ADMINS" && styles.tabTextActive]}>
              Équipe ({adminsList.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === "SECURITY" && styles.tabItemActive]}
            onPress={() => setActiveTab("SECURITY")}
          >
            <Text style={[styles.tabText, activeTab === "SECURITY" && styles.tabTextActive]}>
              Sécurité
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* TAB 1: OVERVIEW & DISPUTES */}
          {activeTab === "OVERVIEW" && (
            <>
              {/* Simulation CamerPay Toggle */}
              <View
                style={[
                  styles.simulCard,
                  {
                    borderColor: isSimulation
                      ? "rgba(14, 165, 233, 0.4)"
                      : "rgba(239, 68, 68, 0.3)",
                  },
                ]}
              >
                <View style={styles.simulRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.simulLabel}>PAIEMENTS CAMERPAY</Text>
                    <Text style={styles.simulTitle}>Mode Simulation</Text>
                  </View>
                  <Switch
                    value={isSimulation}
                    onValueChange={handleToggleSimulation}
                    disabled={updating}
                    trackColor={{ false: "#CBD5E1", true: "#0EA5E9" }}
                    thumbColor={isSimulation ? "#FFFFFF" : "#F1F5F9"}
                  />
                </View>

                <View
                  style={[
                    styles.simulInfoBox,
                    {
                      backgroundColor: isSimulation ? "#F0F9FF" : "#FFFBEB",
                      borderColor: isSimulation ? "#BAE6FD" : "#FDE68A",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.simulInfoText,
                      { color: isSimulation ? "#0369A1" : "#92400E" },
                    ]}
                  >
                    {isSimulation
                      ? "SIMULATION ACTIVÉE — Les transactions MTN & Orange Money réussiront automatiquement pour les tests de validation."
                      : "MODE RÉEL — Les transactions feront des requêtes en direct vers l'API CamerPay."}
                  </Text>
                </View>
              </View>

              {/* Stats Grid */}
              <Text style={styles.sectionTitle}>Aperçu de la Plateforme</Text>

              {loading ? (
                <View style={styles.loadingRow}>
                  <Text style={styles.loadingText}>Chargement des statistiques...</Text>
                </View>
              ) : (
                <View style={[styles.statsGrid, isWide && styles.statsGridWide]}>
                  <StatCard
                    label="UTILISATEURS"
                    value={stats?.totalUsers ?? 0}
                    sub="Comptes inscrits"
                  />
                  <StatCard
                    label="CHAUFFEURS"
                    value={stats?.totalDrivers ?? 0}
                    sub={`${stats?.onlineDrivers ?? 0} actuellement en ligne`}
                    accent
                  />
                  <StatCard
                    label="COURSES EFFECTUÉES"
                    value={stats?.completedRides ?? 0}
                    sub={`sur ${stats?.totalRides ?? 0} demandées`}
                  />
                  <StatCard
                    label="REVENUS CUMULÉS"
                    value={`${(stats?.totalRevenueFcfa ?? 0).toLocaleString()} FCFA`}
                    sub="Volume de la plateforme"
                    accent
                  />
                  <StatCard
                    label="COMMISSIONS ADMIN"
                    value={`${(stats?.adminCommissions ?? 0).toLocaleString()} FCFA`}
                    sub={`Taux actif : ${((stats?.commissionRate ?? 0.10) * 100).toFixed(0)}% par course`}
                    accent
                  />
                  <StatCard
                    label="APPELS D'AIDE"
                    value={stats?.pendingSupportCalls ?? 0}
                    sub="En attente d'arbitrage"
                  />
                  <StatCard
                    label="COMPTES BLOQUÉS"
                    value={stats?.blockedUsers ?? 0}
                    sub="Usagers suspendus"
                  />
                </View>
              )}

              {/* Quick Actions */}
              <Text style={styles.sectionTitle}>Actions Rapides</Text>
              <View style={[styles.actionsGrid, isWide && styles.actionsGridWide]}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => setActiveTab("WALLET")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionCardTitle}>Portefeuille Commissions</Text>
                  <Text style={styles.actionCardSub}>Gérer le solde & pourcentage</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => setActiveTab("SUPPORT")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionCardTitle}>Assistance & Conflits</Text>
                  <Text style={styles.actionCardSub}>Appels d'aide usagers</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => setActiveTab("ACCOUNTS")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionCardTitle}>Gestion des Comptes</Text>
                  <Text style={styles.actionCardSub}>Bloquer / Débloquer usagers</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionCard, { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }]}
                  onPress={handleResetDatabase}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionCardTitle, { color: "#DC2626" }]}>Vider la Base (Reset)</Text>
                  <Text style={[styles.actionCardSub, { color: "#991B1B" }]}>Réinitialiser les tests</Text>
                </TouchableOpacity>
              </View>

              {/* Section Litiges de Courses */}
              <Text style={styles.sectionTitle}>
                Litiges de Courses ({disputes.length})
              </Text>
              {disputes.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Aucun litige signalé pour le moment.
                  </Text>
                </View>
              ) : (
                <View style={styles.disputesList}>
                  {disputes.map((d: any) => (
                    <View key={d.id} style={styles.disputeItemCard}>
                      <View style={styles.disputeItemHeader}>
                        <Text style={styles.disputeItemTitle}>
                          Litige #{d.id} — {d.ride_id}
                        </Text>
                        <View
                          style={[
                            styles.badge,
                            d.status === "RESOLU" && styles.badgeSuccess,
                            d.status === "REJETE" && styles.badgeMuted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              d.status === "RESOLU" && styles.badgeTextSuccess,
                              d.status === "REJETE" && styles.badgeTextMuted,
                            ]}
                          >
                            {d.status}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.disputeReasonText}>
                        Motif : "{d.reason}"
                      </Text>
                      <Text style={styles.disputeMetaText}>
                        Passager : {d.rider_name || d.rider_id || "Passager"} • Chauffeur : {d.driver_name || `Chauffeur #${d.driver_id}` || "Chauffeur"}
                      </Text>
                      <Text style={styles.disputeMetaText}>
                        Montant : {d.fare_fcfa || 0} FCFA • Date : {new Date(d.created_at).toLocaleTimeString()}
                      </Text>

                      {d.status === "A_TRAITER" && (
                        <View style={styles.disputeActionsRow}>
                          <TouchableOpacity
                            style={styles.resolveBtn}
                            onPress={() => handleUpdateDisputeStatus(d.id, "RESOLU")}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.resolveBtnText}>Marquer Résolu</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.rejectBtn}
                            onPress={() => handleUpdateDisputeStatus(d.id, "REJETE")}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.rejectBtnText}>Rejeter</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* TAB: WALLET & COMMISSIONS */}
          {activeTab === "WALLET" && (
            <View>
              <Text style={styles.sectionTitle}>Portefeuille Commissions Administrateur</Text>
              <Text style={styles.sectionSubtitle}>
                Solde perçu automatiquement par prélèvement de votre pourcentage sur chaque course payée.
              </Text>

              {/* Commission Balance Hero Card */}
              <View style={styles.walletHeroCard}>
                <View style={styles.walletHeroHeader}>
                  <Text style={styles.walletHeroLabel}>SOLDE DES COMMISSIONS CUMULÉES</Text>
                  <TouchableOpacity
                    style={styles.editRateBtn}
                    onPress={() => setShowRateModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editRateBtnText}>
                      Modifier Taux ({((walletInfo?.commission_rate ? parseFloat(walletInfo.commission_rate) : (stats?.commissionRate ?? 0.10)) * 100).toFixed(0)}%)
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.walletHeroAmount}>
                  {((walletInfo?.total_commissions ?? stats?.adminCommissions) ?? 0).toLocaleString()} FCFA
                </Text>
                <Text style={styles.walletHeroSub}>
                  Prélèvement automatique configuré à {((walletInfo?.commission_rate ? parseFloat(walletInfo.commission_rate) : (stats?.commissionRate ?? 0.10)) * 100).toFixed(0)}% sur chaque paiement de chauffeur.
                </Text>
              </View>

              {/* Commissions Log */}
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Historique des Commissions Prélevées</Text>
              {recentCommissions.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    Aucune commission prélevée pour le moment. Les montants apparaîtront dès la clôture et le paiement d'une course.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {recentCommissions.map((c: any, idx: number) => (
                    <View key={c.id || idx} style={styles.commissionCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.commissionRideId}>Course #{c.ride_id || idx + 1}</Text>
                        <Text style={styles.commissionDate}>
                          {c.created_at ? new Date(c.created_at).toLocaleString() : "Date récente"}
                        </Text>
                        <Text style={styles.commissionMeta}>
                          Course : {(c.ride_fare ?? 0).toLocaleString()} FCFA • Taux : {((c.commission_rate ?? 0.1) * 100).toFixed(0)}%
                        </Text>
                      </View>
                      <View style={styles.commissionAmountBox}>
                        <Text style={styles.commissionAmountText}>
                          +{(c.commission_amount ?? 0).toLocaleString()} FCFA
                        </Text>
                        <Text style={styles.commissionBadge}>PERÇU</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB: SUPPORT & CONFLICTS */}
          {activeTab === "SUPPORT" && (
            <View>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.sectionTitle}>Appels d'Aide & Conflits Usagers</Text>
                  <Text style={styles.sectionSubtitle}>
                    Prise en charge des réclamations et assistance sociale en direct.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.refreshSupportBtn}
                  onPress={fetchSupportCalls}
                  activeOpacity={0.8}
                >
                  <Text style={styles.refreshSupportBtnText}>Actualiser</Text>
                </TouchableOpacity>
              </View>

              {/* Filter Pills */}
              <View style={styles.filterRow}>
                {["ALL", "PENDING", "ASSIGNED", "RESOLVED"].map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterPill, supportFilter === f && styles.filterPillActive]}
                    onPress={() => setSupportFilter(f)}
                  >
                    <Text style={[styles.filterPillText, supportFilter === f && styles.filterPillTextActive]}>
                      {f === "ALL" ? "Tous" : f === "PENDING" ? "En Attente" : f === "ASSIGNED" ? "En Cours" : "Résolus"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {loadingSupport ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text style={styles.loadingText}>Chargement des appels d'aide...</Text>
                </View>
              ) : supportCalls.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Aucun appel d'aide enregistré pour l'instant.</Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {supportCalls
                    .filter((c: any) => supportFilter === "ALL" || c.status === supportFilter)
                    .map((call: any) => (
                      <View key={call.id} style={styles.supportCard}>
                        <View style={styles.supportHeader}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                              <Text style={styles.supportUserName}>{call.user_name || call.user_full_name || "Usager VORA"}</Text>
                              <View style={[
                                styles.badge,
                                call.status === "PENDING" ? { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }
                                : call.status === "ASSIGNED" ? { backgroundColor: "#DBEAFE", borderColor: "#93C5FD" }
                                : { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }
                              ]}>
                                <Text style={[
                                  styles.badgeText,
                                  call.status === "PENDING" ? { color: "#D97706", fontWeight: "800" }
                                  : call.status === "ASSIGNED" ? { color: "#2563EB", fontWeight: "800" }
                                  : { color: "#16A34A", fontWeight: "800" }
                                ]}>
                                  {call.status === "PENDING" ? "EN ATTENTE" : call.status === "ASSIGNED" ? "EN COURS" : "RÉSOLU"}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.supportUserMeta}>
                              Rôle : {call.user_role || call.user_type || "PASSAGER"} • Tel : {call.caller_phone || "Non renseigné"} • Usager #{call.user_id}
                            </Text>
                            <Text style={styles.supportDate}>
                              {call.created_at ? new Date(call.created_at).toLocaleString() : "Récent"}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.supportReasonBox}>
                          <Text style={styles.supportReasonLabel}>MOTIF DU CONFLIT / APPEL :</Text>
                          <Text style={styles.supportReasonText}>{call.reason}</Text>
                        </View>

                        {call.assigned_to && (
                          <Text style={styles.supportAssignedText}>
                            Pris en charge par : {call.assigned_to}
                          </Text>
                        )}

                        {call.status !== "RESOLVED" && (
                          <View style={styles.supportActionsRow}>
                            {call.status === "PENDING" && (
                              <TouchableOpacity
                                style={styles.assignCallBtn}
                                onPress={() => handleUpdateSupportCallStatus(call.id, "ASSIGNED")}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.assignCallBtnText}>Prendre en charge</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.resolveCallBtn}
                              onPress={() => handleUpdateSupportCallStatus(call.id, "RESOLVED")}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.resolveCallBtnText}>Marquer Résolu</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 2: USERS & DRIVERS ACCOUNTS */}
          {activeTab === "ACCOUNTS" && (
            <View>
              <Text style={styles.sectionTitle}>Comptes Utilisateurs et Chauffeurs</Text>
              <Text style={styles.sectionSubtitle}>
                Supervision des passagers et des chauffeurs enregistrés sur VORA avec photos et conformité.
              </Text>

              {loadingAccounts ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#0284C7" />
                  <Text style={styles.loadingText}>Chargement des comptes...</Text>
                </View>
              ) : usersList.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Aucun compte utilisateur enregistré.</Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {usersList.map((u: any) => (
                    <View key={u.id} style={styles.accountCard}>
                      <View style={styles.accountHeader}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <Text style={styles.accountName}>{u.name || "Utilisateur"}</Text>
                            {u.is_blocked ? (
                              <View style={[styles.badge, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
                                <Text style={[styles.badgeText, { color: "#DC2626", fontWeight: "800" }]}>SUSPENDU</Text>
                              </View>
                            ) : (
                              <View style={[styles.badge, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
                                <Text style={[styles.badgeText, { color: "#16A34A", fontWeight: "800" }]}>ACTIF</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.accountEmail}>{u.email}</Text>
                          <Text style={styles.accountPhone}>
                            ID Public : {u.public_id || "N/A"} {u.phone ? `• Tel : ${u.phone}` : ""}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 8 }}>
                          <View
                            style={[
                              styles.badge,
                              u.role === "DRIVER" ? styles.badgePrimary : styles.badgeMuted,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                u.role === "DRIVER" ? styles.badgeTextPrimary : styles.badgeTextMuted,
                              ]}
                            >
                              {u.role}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.userBlockBtn,
                              u.is_blocked ? styles.userUnblockBtn : styles.userBlockBtnActive,
                            ]}
                            onPress={() => handleToggleBlockUser(u.id, !u.is_blocked, u.name || u.email)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.userBlockBtnText, u.is_blocked && { color: "#0284C7" }]}>
                              {u.is_blocked ? "Débloquer" : "Bloquer"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Driver Specific Info */}
                      {u.role === "DRIVER" && (
                        <View style={styles.driverAccountBox}>
                          <Text style={styles.driverAccountTitle}>DÉTAILS CHAUFFEUR & VÉHICULE</Text>
                          <Text style={styles.driverAccountDetails}>
                            Véhicule : {u.vehicle_model || "N/A"} ({u.vehicle_type?.toUpperCase() || "TAXI"}) • Plaque : {u.license_plate || "N/A"} • Couleur : {u.color || "N/A"}
                          </Text>
                          <Text style={styles.driverAccountDetails}>
                            Statut : {u.is_online ? "EN LIGNE" : "HORS LIGNE"} • Note : {u.rating || "5.0"}/5
                          </Text>

                          {/* Photos: Profile & Vehicle */}
                          <View style={styles.driverPhotosRow}>
                            {u.avatar_url ? (
                              <View style={styles.driverPhotoCol}>
                                <Text style={styles.photoColLabel}>Profil vérifié IA</Text>
                                <Image source={{ uri: u.avatar_url }} style={styles.photoThumbAvatar} resizeMode="cover" />
                              </View>
                            ) : null}
                            {u.vehicle_image ? (
                              <View style={styles.driverPhotoCol}>
                                <Text style={styles.photoColLabel}>Photo Véhicule</Text>
                                <Image source={{ uri: u.vehicle_image }} style={styles.photoThumbVehicle} resizeMode="cover" />
                              </View>
                            ) : null}
                          </View>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* TAB 3: ADMIN ACCOUNTS MANAGEMENT */}
          {activeTab === "ADMINS" && (
            <View>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.sectionTitle}>Comptes Administrateurs</Text>
                  <Text style={styles.sectionSubtitle}>
                    Gestion des droits d'accès à la console d'administration.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setIsAddAdminModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addBtnText}>+ Ajouter Admin</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 12, marginTop: 16 }}>
                {adminsList.map((adm: any) => (
                  <View key={adm.id} style={styles.adminCard}>
                    <View style={styles.adminCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adminCardName}>{adm.name}</Text>
                        <Text style={styles.adminCardEmail}>{adm.email}</Text>
                        <Text style={styles.adminCardDate}>
                          Créé le {new Date(adm.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[
                        styles.badge,
                        adm.role === "SOCIAL_ASSISTANT"
                          ? { backgroundColor: "#F3E8FF", borderColor: "#D8B4FE" }
                          : styles.badgePrimary,
                      ]}>
                        <Text style={[
                          styles.badgeText,
                          adm.role === "SOCIAL_ASSISTANT"
                            ? { color: "#7E22CE", fontWeight: "800" }
                            : styles.badgeTextPrimary,
                        ]}>
                          {adm.role === "SOCIAL_ASSISTANT" ? "ASSISTANT SOCIAL" : "ADMINISTRATEUR"}
                        </Text>
                      </View>
                    </View>

                    {adm.email.toLowerCase() !== adminEmail.toLowerCase() && (
                      <TouchableOpacity
                        style={styles.deleteAdminBtn}
                        onPress={() => handleDeleteAdmin(adm.id, adm.email)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.deleteAdminBtnText}>Supprimer ce compte</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* TAB 4: MY PROFILE & SECURITY */}
          {activeTab === "SECURITY" && (
            <View style={{ gap: 20 }}>
              {/* Card 1: Edit Email / Name */}
              <View style={styles.formCard}>
                <Text style={styles.formCardTitle}>Modifier mes Identifiants</Text>
                <Text style={styles.formCardSub}>
                  Modifiez votre adresse email de connexion ou votre nom d'administrateur.
                </Text>

                <Text style={styles.inputLabel}>ADRESSE EMAIL ADMINISTRATEUR</Text>
                <TextInput
                  style={styles.inputField}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="emailAddress"
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>NOM DE L'ADMINISTRATEUR</Text>
                <TextInput
                  style={styles.inputField}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Ex: Grégoire Admin"
                />

                <Text style={styles.inputLabel}>MOT DE PASSE ACTUEL (POUR CONFIRMER)</Text>
                <TextInput
                  style={styles.inputField}
                  value={profileCurrentPassword}
                  onChangeText={setProfileCurrentPassword}
                  secureTextEntry
                  placeholder="Votre mot de passe actuel"
                />

                <TouchableOpacity
                  style={[styles.saveBtn, updatingProfile && { opacity: 0.6 }]}
                  onPress={handleUpdateProfile}
                  disabled={updatingProfile}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>
                    {updatingProfile ? "Enregistrement..." : "Enregistrer les modifications"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Card 2: Change Password */}
              <View style={styles.formCard}>
                <Text style={styles.formCardTitle}>Modifier mon Mot de Passe</Text>
                <Text style={styles.formCardSub}>
                  Le nouveau mot de passe doit comporter au moins 8 caractères.
                </Text>

                <Text style={styles.inputLabel}>MOT DE PASSE ACTUEL</Text>
                <TextInput
                  style={styles.inputField}
                  value={pwCurrent}
                  onChangeText={setPwCurrent}
                  secureTextEntry
                  placeholder="Saisissez votre mot de passe actuel"
                />

                <Text style={styles.inputLabel}>NOUVEAU MOT DE PASSE</Text>
                <TextInput
                  style={styles.inputField}
                  value={pwNew}
                  onChangeText={setPwNew}
                  secureTextEntry
                  placeholder="Au moins 8 caractères"
                />

                <Text style={styles.inputLabel}>CONFIRMER LE NOUVEAU MOT DE PASSE</Text>
                <TextInput
                  style={styles.inputField}
                  value={pwConfirm}
                  onChangeText={setPwConfirm}
                  secureTextEntry
                  placeholder="Répétez le nouveau mot de passe"
                />

                <TouchableOpacity
                  style={[styles.saveBtn, updatingPassword && { opacity: 0.6 }]}
                  onPress={handleChangePassword}
                  disabled={updatingPassword}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>
                    {updatingPassword ? "Modification..." : "Mettre à jour mon mot de passe"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Modal: Add New Admin */}
      <Modal visible={isAddAdminModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Créer un Compte Administrateur</Text>
              <TouchableOpacity
                onPress={() => setIsAddAdminModalOpen(false)}
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
              Le nouvel administrateur pourra se connecter depuis la page de connexion unique avec ces identifiants.
            </Text>

            <Text style={styles.inputLabel}>ADRESSE EMAIL</Text>
            <TextInput
              style={styles.inputField}
              value={newAdminEmail}
              onChangeText={setNewAdminEmail}
              placeholder="ex: admin2@vora.cm"
              keyboardType="emailAddress"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>MOT DE PASSE (MIN. 8 CARACTÈRES)</Text>
            <TextInput
              style={styles.inputField}
              value={newAdminPassword}
              onChangeText={setNewAdminPassword}
              secureTextEntry
              placeholder="Mot de passe sécurisé"
            />

            <Text style={styles.inputLabel}>NOM COMPLET</Text>
            <TextInput
              style={styles.inputField}
              value={newAdminName}
              onChangeText={setNewAdminName}
              placeholder="ex: Jean Dupont"
            />

            <Text style={styles.inputLabel}>RÔLE DU COMPTE</Text>
            <View style={styles.modalRoleRow}>
              <TouchableOpacity
                style={[
                  styles.modalRoleBtn,
                  newAdminRole === "ADMIN" && styles.modalRoleBtnActive,
                ]}
                onPress={() => setNewAdminRole("ADMIN")}
              >
                <Text
                  style={[
                    styles.modalRoleBtnText,
                    newAdminRole === "ADMIN" && styles.modalRoleBtnTextActive,
                  ]}
                >
                  Administrateur
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalRoleBtn,
                  newAdminRole === "SOCIAL_ASSISTANT" && styles.modalRoleBtnActive,
                ]}
                onPress={() => setNewAdminRole("SOCIAL_ASSISTANT")}
              >
                <Text
                  style={[
                    styles.modalRoleBtnText,
                    newAdminRole === "SOCIAL_ASSISTANT" && styles.modalRoleBtnTextActive,
                  ]}
                >
                  Assistant Social
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddAdminModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, submittingAdmin && { opacity: 0.6 }]}
                onPress={handleCreateAdmin}
                disabled={submittingAdmin}
              >
                <Text style={styles.modalSubmitText}>
                  {submittingAdmin ? "Création..." : "Créer le compte"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Edit Commission Rate */}
      <Modal visible={showRateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={[styles.modalTitle, { flex: 1, marginBottom: 0 }]}>Modifier le Taux de Commission</Text>
              <TouchableOpacity
                onPress={() => setShowRateModal(false)}
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
              Définissez le pourcentage perçu par la plateforme VORA sur chaque course payée par les chauffeurs (entre 0% et 50%).
            </Text>

            <Text style={styles.inputLabel}>POURCENTAGE DE COMMISSION (%)</Text>
            <TextInput
              style={styles.inputField}
              value={rateInput}
              onChangeText={setRateInput}
              placeholder="Ex: 10"
              keyboardType="numeric"
              maxLength={3}
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRateModal(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, updatingRate && { opacity: 0.6 }]}
                onPress={handleUpdateCommissionRate}
                disabled={updatingRate}
              >
                <Text style={styles.modalSubmitText}>
                  {updatingRate ? "Mise à jour..." : "Enregistrer le Taux"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  header: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
  },
  headerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backAppBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  backAppBtnText: {
    color: "#BAE6FD",
    fontSize: 12,
    fontWeight: "700",
  },
  logoBadge: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  adminBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  adminBadgeText: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  headerSub: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 4,
  },
  logoutBtn: {
    marginTop: 16,
    alignSelf: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: "#0EA5E9",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#0EA5E9",
    fontWeight: "800",
  },
  body: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 16,
  },
  simulCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 20,
  },
  simulRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  simulLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  simulTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  simulInfoBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  simulInfoText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  statsGrid: {
    gap: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  statsGridWide: {
    flexDirection: "row",
  },
  statCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    flex: 1,
  },
  statCardWide: {
    minWidth: 180,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 4,
  },
  statValueAccent: {
    color: "#0EA5E9",
  },
  statSub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    marginBottom: 24,
  },
  actionsGridWide: {
    maxWidth: 600,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 16,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  actionCardSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 24,
    alignItems: "center",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
  },
  disputesList: {
    gap: 12,
    marginTop: 12,
  },
  disputeItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  disputeItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  disputeItemTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  disputeReasonText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
    marginBottom: 6,
  },
  disputeMetaText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  disputeActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  resolveBtn: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resolveBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  rejectBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectBtnText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgePrimary: {
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  badgeTextPrimary: {
    color: "#0284C7",
    fontSize: 10,
    fontWeight: "800",
  },
  badgeSuccess: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  badgeTextSuccess: {
    color: "#166534",
    fontSize: 10,
    fontWeight: "800",
  },
  badgeMuted: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  badgeTextMuted: {
    color: "#4B5563",
    fontSize: 10,
    fontWeight: "800",
  },
  accountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  accountHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  accountName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  accountEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  accountPhone: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  driverAccountBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  driverAccountTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0EA5E9",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  driverAccountDetails: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
    marginTop: 2,
  },
  driverPhotosRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  driverPhotoCol: {
    alignItems: "center",
  },
  photoColLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 4,
  },
  photoThumbAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: "#0EA5E9",
  },
  photoThumbVehicle: {
    width: 100,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  addBtn: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  adminCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  adminCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  adminCardName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  adminCardEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  adminCardDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  deleteAdminBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteAdminBtnText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 20,
  },
  formCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  formCardSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 10,
  },
  inputField: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
  },
  saveBtn: {
    backgroundColor: "#0EA5E9",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 18,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  modalSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
    marginBottom: 16,
  },
  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "700",
  },
  modalSubmitBtn: {
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  // ─── Block / Unblock Styles ───
  userBlockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  userBlockBtnActive: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  userUnblockBtn: {
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  userBlockBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#DC2626",
  },
  // ─── Wallet & Commission Styles ───
  walletHeroCard: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 16,
  },
  walletHeroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  walletHeroLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  editRateBtn: {
    backgroundColor: "rgba(14, 165, 233, 0.2)",
    borderWidth: 1,
    borderColor: "#0EA5E9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editRateBtnText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "800",
  },
  walletHeroAmount: {
    fontSize: 32,
    fontWeight: "900",
    color: "#38BDF8",
    marginBottom: 8,
  },
  walletHeroSub: {
    fontSize: 13,
    color: "#94A3B8",
  },
  commissionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  commissionRideId: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  commissionDate: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 4,
  },
  commissionMeta: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
  commissionAmountBox: {
    alignItems: "flex-end",
    gap: 4,
  },
  commissionAmountText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#16A34A",
  },
  commissionBadge: {
    fontSize: 9,
    fontWeight: "900",
    color: "#16A34A",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  // ─── Support & Conflict Styles ───
  refreshSupportBtn: {
    backgroundColor: "#0284C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  refreshSupportBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 14,
    flexWrap: "wrap",
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#0284C7",
    borderColor: "#0284C7",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  supportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  supportHeader: {
    marginBottom: 12,
  },
  supportUserName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  supportUserMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  supportDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  supportReasonBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#0284C7",
  },
  supportReasonLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748B",
    marginBottom: 4,
  },
  supportReasonText: {
    fontSize: 13,
    color: "#1E293B",
    lineHeight: 18,
  },
  supportAssignedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7E22CE",
    marginBottom: 10,
  },
  supportActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  assignCallBtn: {
    flex: 1,
    backgroundColor: "#DBEAFE",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#93C5FD",
  },
  assignCallBtnText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
  },
  resolveCallBtn: {
    flex: 1,
    backgroundColor: "#DCFCE7",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  resolveCallBtnText: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "800",
  },
  // ─── Modal Role Selector ───
  modalRoleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  modalRoleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  modalRoleBtnActive: {
    borderColor: "#0284C7",
    backgroundColor: "#F0F9FF",
  },
  modalRoleBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  modalRoleBtnTextActive: {
    color: "#0284C7",
    fontWeight: "900",
  },
});
