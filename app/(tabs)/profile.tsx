import { useRouter } from "expo-router";
import {
  Bell,
  ExternalLink,
  HelpCircle,
  LogOut,
  Settings,
  Shield,
  User,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

import {
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

type Mode = "signin" | "signup";

type UserProfile = {
  name: string;
  age?: number | null;
  weight?: number | null;
};

export default function ProfileScreen() {
  const router = useRouter();

  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  // ✅ Mode toggle (professional UI)
  const [mode, setMode] = useState<Mode>("signin");

  // Auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup-only fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [fitbitLoading, setFitbitLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setProfileEmail(user?.email ?? null);

      if (!user) {
        setProfileName(null);
        return;
      }

      // Prefer Auth displayName, fallback to Firestore
      if (user.displayName) {
        setProfileName(user.displayName);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.exists() ? (snap.data() as UserProfile) : null;
        setProfileName(data?.name ?? null);
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

  const isLoggedIn = !!profileEmail;

  // Small helper: clear error when mode changes
  useEffect(() => {
    setError(null);
  }, [mode]);

  const formTitle = useMemo(() => {
    return mode === "signin"
      ? "Sign in to Solace"
      : "Create your Solace account";
  }, [mode]);

  const formSubtitle = useMemo(() => {
    return mode === "signin"
      ? "Use your email and password to continue."
      : "Enter a few details to personalize your experience.";
  }, [mode]);

  const handleSignUp = async () => {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your name to sign up.");
      return;
    }

    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      // Store displayName (for welcome text)
      await updateProfile(cred.user, { displayName: trimmedName });

      const parsedAge = age.trim().length > 0 ? Number(age.trim()) : null;
      const parsedWeight =
        weight.trim().length > 0 ? Number(weight.trim()) : null;

      if (parsedAge !== null && Number.isNaN(parsedAge)) {
        setError("Age must be a number.");
        setLoading(false);
        return;
      }
      if (parsedWeight !== null && Number.isNaN(parsedWeight)) {
        setError("Weight must be a number.");
        setLoading(false);
        return;
      }

      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          name: trimmedName,
          age: parsedAge,
          weight: parsedWeight,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      setProfileName(trimmedName);
      // Optional: switch to sign-in mode after signup (not necessary because user is logged in)
    } catch (e: any) {
      setError(e?.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      setError(e?.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    setLoading(true);

    try {
      await fbSignOut(auth);

      // clear inputs
      setEmail("");
      setPassword("");
      setName("");
      setAge("");
      setWeight("");
      setProfileName(null);

      // back to sign in (professional default)
      setMode("signin");
    } catch (e: any) {
      setError(e?.message ?? "Logout failed");
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* TOP CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <User size={40} color="#6B7280" />
          </View>

          <Text style={styles.name}>
            {isLoggedIn
              ? `Welcome${profileName ? `, ${profileName}` : ""}`
              : "Welcome"}
          </Text>

          <Text style={styles.email}>
            {isLoggedIn ? profileEmail : "Manage your account and connections."}
          </Text>
        </View>

        {/* AUTH SECTION */}
        {!isLoggedIn && (
          <View style={styles.section}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  mode === "signin" && styles.modeBtnActive,
                ]}
                onPress={() => setMode("signin")}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    mode === "signin" && styles.modeBtnTextActive,
                  ]}
                >
                  Sign in
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  mode === "signup" && styles.modeBtnActive,
                ]}
                onPress={() => setMode("signup")}
                disabled={loading}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    mode === "signup" && styles.modeBtnTextActive,
                  ]}
                >
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formTitle}>{formTitle}</Text>
            <Text style={styles.formSubtitle}>{formSubtitle}</Text>

            {/* Signup-only fields */}
            {mode === "signup" && (
              <>
                <TextInput
                  placeholder="Name"
                  autoCapitalize="words"
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                />

                <TextInput
                  placeholder="Age (optional)"
                  keyboardType="number-pad"
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                />

                <TextInput
                  placeholder="Weight (optional)"
                  keyboardType="number-pad"
                  style={styles.input}
                  value={weight}
                  onChangeText={setWeight}
                />
              </>
            )}

            {/* Always for both modes */}
            <TextInput
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              placeholder="Password"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />

            {/* Single primary button */}
            <TouchableOpacity
              style={styles.primaryButtonFull}
              onPress={mode === "signin" ? handleSignIn : handleSignUp}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading
                  ? "..."
                  : mode === "signin"
                    ? "Sign in"
                    : "Create account"}
              </Text>
            </TouchableOpacity>

            {/* Switch hint */}
            <TouchableOpacity
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
              disabled={loading}
              style={{ marginTop: 10 }}
            >
              <Text style={styles.switchText}>
                {mode === "signin"
                  ? "Don’t have an account?  Sign up"
                  : "Already have an account?  Sign in"}
              </Text>
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        )}

        {/* ACCOUNT SECTION */}
        {isLoggedIn && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <User size={20} color="#374151" />
              </View>
              <Text style={styles.menuText}>Personal Information</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <Bell size={20} color="#374151" />
              </View>
              <Text style={styles.menuText}>Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIcon}>
                <Shield size={20} color="#374151" />
              </View>
              <Text style={styles.menuText}>Privacy & Security</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CONNECTIONS SECTION */}
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

        {/* RESOURCES SECTION */}
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

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <HelpCircle size={20} color="#374151" />
            </View>
            <Text style={styles.menuText}>Help & Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <Settings size={20} color="#374151" />
            </View>
            <Text style={styles.menuText}>App Settings</Text>
          </TouchableOpacity>
        </View>

        {/* LOGOUT */}
        {isLoggedIn && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              disabled={loading}
            >
              <LogOut size={20} color="#EF4444" />
              <Text style={styles.logoutText}>
                {loading ? "..." : "Log Out"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* FOOTER */}
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

  // ✅ Professional mode toggle
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  modeBtnActive: {
    backgroundColor: "#FFFFFF",
    elevation: 1,
  },
  modeBtnText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  modeBtnTextActive: { color: "#111827" },

  formTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  formSubtitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    color: "#6B7280",
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 10,
  },

  primaryButtonFull: {
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },

  switchText: { textAlign: "center", fontSize: 13, color: "#374151" },

  errorText: { marginTop: 10, color: "#B91C1C", fontSize: 13 },

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
