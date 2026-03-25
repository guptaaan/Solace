import { useRouter } from "expo-router";
import {
  ExternalLink,
  HelpCircle,
  LogOut,
  Shield,
  User,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "@/constants/firebase";
import { getFitbitDataFromAWS, syncFitbitDataToAWS } from "@/utils/aws-fitbit";
import { getWellnessData } from "@/utils/fitbit-api";
import {
  connectFitbit,
  disconnectFitbit,
  getFitbitStoredUserId,
  isFitbitConnected,
} from "@/utils/fitbit-auth";

import { signOut as fbSignOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

type UserProfile = {
  name?: string;
  fullName?: string;
  age?: number | null;
  weight?: number | null;
  height?: number | null;
  gender?: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();

  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [fitbitLoading, setFitbitLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setProfileEmail(user?.email ?? null);

      if (!user) {
        setProfileName(null);
        return;
      }

      if (user.displayName) {
        setProfileName(user.displayName);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as UserProfile) : null;
        setProfileName(data?.name ?? data?.fullName ?? null);
      } catch {
        setProfileName(null);
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    checkFitbitStatus();
  }, []);

  const checkFitbitStatus = async () => {
    const connected = await isFitbitConnected();
    setFitbitConnected(connected);
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fbSignOut(auth);

      setProfileEmail(null);
      setProfileName(null);

      router.replace("/");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Logout failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFitbitConnect = async () => {
    if (fitbitConnected) {
      setFitbitLoading(true);
      try {
        await disconnectFitbit();
        setFitbitConnected(false);
        Alert.alert("Success", "Fitbit disconnected successfully");
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to disconnect Fitbit");
      } finally {
        setFitbitLoading(false);
      }
    } else {
      setFitbitLoading(true);
      try {
        const success = await connectFitbit();
        if (success) {
          setFitbitConnected(true);
          Alert.alert("Success", "Fitbit connected successfully!");

          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 30);
          const endDateStr = endDate.toISOString().split("T")[0];
          const startDateStr = startDate.toISOString().split("T")[0];

          try {
            const data = await getWellnessData(startDateStr, endDateStr);
            const userId = (await getFitbitStoredUserId()) || "test-user";
            const write = await syncFitbitDataToAWS(userId, data);
            const read = await getFitbitDataFromAWS(userId);
            console.log("AWS Fitbit sync ok", {
              userId,
              write,
              readRecords: read.length,
            });
          } catch (syncError) {
            console.error("Failed to sync initial data:", syncError);
          }
        } else {
          Alert.alert("Cancelled", "Fitbit connection was cancelled");
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to connect Fitbit");
      } finally {
        setFitbitLoading(false);
      }
    }
  };

  const isLoggedIn = !!profileEmail;

  if (!isLoggedIn) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <User size={40} color="#6B7280" />
          </View>

          <Text style={styles.name}>
            {`Welcome${profileName ? `, ${profileName}` : ""}`}
          </Text>

          <Text style={styles.email}>{profileEmail}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/personal-information")}
          >
            <View style={styles.menuIcon}>
              <User size={20} color="#374151" />
            </View>
            <Text style={styles.menuText}>Personal Information</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/terms-and-conditions" as any)}
          >
            <View style={styles.menuIcon}>
              <Shield size={20} color="#374151" />
            </View>
            <Text style={styles.menuText}>Terms & Conditions</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connections</Text>

          <View style={styles.connectionCard}>
            <View style={styles.connectionHeader}>
              <Text style={styles.connectionTitle}>Fitbit</Text>
              <View
                style={[
                  styles.badge,
                  fitbitConnected && { backgroundColor: "#D1FAE5" },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    fitbitConnected && { color: "#065F46" },
                  ]}
                >
                  {fitbitConnected ? "Connected" : "Not Connected"}
                </Text>
              </View>
            </View>

            <Text style={styles.connectionText}>
              {fitbitConnected
                ? "Your Fitbit is connected. Sleep, heart rate, and activity data will sync automatically."
                : "Connect your Fitbit to sync sleep, heart rate, and activity data."}
            </Text>

            <TouchableOpacity
              style={[
                styles.connectButton,
                fitbitConnected && styles.disconnectButton,
                fitbitLoading && styles.connectButtonDisabled,
              ]}
              onPress={handleFitbitConnect}
              disabled={fitbitLoading}
            >
              {fitbitLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.connectButtonText}>
                  {fitbitConnected ? "Disconnect" : "Connect Now"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resources</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/find-clinicians" as any)}
          >
            <View style={styles.menuIcon}>
              <ExternalLink size={20} color="#374151" />
            </View>
            <Text style={styles.menuText}>Find Clinicians</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/help-support" as any)}
          >
            <View style={styles.menuIcon}>
              <HelpCircle size={20} color="#374151" />
            </View>
            <Text style={styles.menuText}>Help & Support</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            disabled={loading}
          >
            <LogOut size={20} color="#EF4444" />
            <Text style={styles.logoutText}>{loading ? "..." : "Log Out"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SOLACE v1.0.0</Text>
          <Text style={styles.footerText}>Made by Aanjaneya and Aditya</Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#111827" },
  content: { flex: 1 },

  profileCard: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    elevation: 2,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  name: { fontSize: 20, fontWeight: "700", marginBottom: 4, color: "#111827" },
  email: { fontSize: 14, color: "#6B7280" },

  section: { marginTop: 24, marginHorizontal: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  menuText: { flex: 1, fontSize: 15, fontWeight: "500", color: "#374151" },

  connectionCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    elevation: 1,
  },
  connectionHeader: { flexDirection: "row", justifyContent: "space-between" },
  connectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  badge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#B91C1C" },
  connectionText: { fontSize: 14, color: "#6B7280", marginVertical: 12 },
  connectButton: {
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
    marginTop: 10,
  },
  disconnectButton: { backgroundColor: "#EF4444" },
  connectButtonDisabled: { opacity: 0.6 },
  connectButtonText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },

  logoutButton: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
  },

  footer: { alignItems: "center", marginTop: 32, paddingBottom: 20 },
  footerText: { fontSize: 13, color: "#9CA3AF" },
});
