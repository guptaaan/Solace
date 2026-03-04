// app/(auth)/index.tsx
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "@/constants/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

type Mode = "signin" | "signup";
const { width } = Dimensions.get("window");

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2500,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const validateEmailPass = () => {
    if (!email.trim()) return "Please enter your email.";
    if (!password) return "Please enter your password.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    return null;
  };

  const handlePrimary = async () => {
    setError(null);
    const baseErr = validateEmailPass();
    if (baseErr) {
      setError(baseErr);
      return;
    }

    setLoading(true);
    try {
      // ── SIGN IN ──────────────────────────────────────────────────────────
      if (mode === "signin") {
        const res = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password,
        );

        // Check onboarding status — but don't block sign-in if Firestore is slow
        try {
          const snap = await Promise.race([
            getDoc(doc(db, "users", res.user.uid)),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 4000),
            ),
          ]);

          if (snap && "exists" in snap && snap.exists()) {
            const data = snap.data();
            if (data?.onboardingComplete === false) {
              router.replace("/(auth)/sleep-onboarding" as any);
              return;
            }
          }
        } catch {
          // Firestore check failed — safe to continue to profile
        }

        router.replace("/(tabs)/profile" as any);
        return;
      }

      // ── SIGN UP ──────────────────────────────────────────────────────────
      const trimmedName = name.trim();
      if (!trimmedName) {
        setError("Please enter your name to sign up.");
        setLoading(false);
        return;
      }

      const parsedAge = age.trim() ? Number(age.trim()) : null;
      const parsedWeight = weight.trim() ? Number(weight.trim()) : null;

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

      // 1. Create the Firebase Auth user
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      // 2. Update display name
      await updateProfile(cred.user, { displayName: trimmedName });

      // 3. Write Firestore doc — fire and don't await (avoid timeout blocking navigation)
      //    We navigate immediately; onboarding screen will still find onboardingComplete: false
      //    even if the write hasn't finished yet because we route directly there.
      setDoc(
        doc(db, "users", cred.user.uid),
        {
          name: trimmedName,
          age: parsedAge,
          weight: parsedWeight,
          createdAt: serverTimestamp(),
          onboardingComplete: false,
        },
        { merge: true },
      ).catch(() => {
        // Non-blocking — layout will still route correctly
      });

      // 4. Go straight to onboarding — don't wait for Firestore
      router.replace("/(auth)/sleep-onboarding" as any);
    } catch (e: any) {
      const msg = e?.message ?? "";

      // Make Firebase errors friendlier
      if (msg.includes("email-already-in-use")) {
        setError("An account with this email already exists. Try signing in.");
      } else if (
        msg.includes("user-not-found") ||
        msg.includes("wrong-password") ||
        msg.includes("invalid-credential")
      ) {
        setError("Incorrect email or password.");
      } else if (msg.includes("network")) {
        setError("Network error. Please check your connection and try again.");
      } else {
        setError(
          msg || (mode === "signin" ? "Sign in failed." : "Sign up failed."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={styles.container}>
      {auth.currentUser && (
        <TouchableOpacity
          style={styles.debugSignOut}
          onPress={async () => {
            await signOut(auth);
            setError(null);
            setEmail("");
            setPassword("");
            setName("");
            setAge("");
            setWeight("");
          }}
        >
          <Text style={{ color: "#fff", fontSize: 12 }}>Sign Out</Text>
        </TouchableOpacity>
      )}

      <Animated.View
        style={[
          styles.bgCircle,
          styles.bgCircle1,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />
      <Animated.View
        style={[
          styles.bgCircle,
          styles.bgCircle2,
          { transform: [{ scale: pulseAnim }] },
        ]}
      />

      <Animated.View
        style={[
          styles.card,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.header}>
          <Animated.View
            style={[
              styles.shimmer,
              { transform: [{ translateX: shimmerTranslate }] },
            ]}
          />
          <Text style={styles.title}>Solace</Text>
          <Text style={styles.tagline}>Your journey to inner peace</Text>
        </View>

        <Text style={styles.subtitle}>
          {mode === "signin"
            ? "Welcome back, take a deep breath"
            : "Begin your wellness journey"}
        </Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, mode === "signin" && styles.toggleActive]}
            onPress={() => {
              setMode("signin");
              setError(null);
            }}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "signin" && styles.toggleTextActive,
              ]}
            >
              Sign in
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, mode === "signup" && styles.toggleActive]}
            onPress={() => {
              setMode("signup");
              setError(null);
            }}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "signup" && styles.toggleTextActive,
              ]}
            >
              Sign up
            </Text>
          </TouchableOpacity>
        </View>

        {mode === "signup" && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <TextInput
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!loading}
            />
            <View style={styles.row}>
              <TextInput
                placeholder="Age"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.halfInput]}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                editable={!loading}
              />
              <TextInput
                placeholder="Weight (lbs)"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.halfInput]}
                value={weight}
                onChangeText={setWeight}
                keyboardType="number-pad"
                editable={!loading}
              />
            </View>
          </Animated.View>
        )}

        <TextInput
          placeholder="Email address"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
          onPress={handlePrimary}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {mode === "signin" ? "Continue" : "Begin journey"}
            </Text>
          )}
        </TouchableOpacity>

        {error && (
          <Animated.View style={[styles.errorContainer, { opacity: fadeAnim }]}>
            <Text style={styles.error}>{error}</Text>
          </Animated.View>
        )}

        <Text style={styles.note}>
          Your mental health journey is private and secure. By continuing, you
          agree to our terms.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
    justifyContent: "center",
    padding: 24,
  },
  debugSignOut: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#EF4444",
    padding: 10,
    borderRadius: 8,
    zIndex: 999,
  },
  bgCircle: { position: "absolute", borderRadius: 999, opacity: 0.06 },
  bgCircle1: {
    width: 400,
    height: 400,
    backgroundColor: "#7C3AED",
    top: -150,
    right: -100,
  },
  bgCircle2: {
    width: 300,
    height: 300,
    backgroundColor: "#06B6D4",
    bottom: -100,
    left: -80,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    elevation: 8,
  },
  header: { alignItems: "center", marginBottom: 8, overflow: "hidden" },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(124, 58, 237, 0.1)",
    width: 100,
  },
  title: { fontSize: 36, fontWeight: "800", color: "#7C3AED" },
  tagline: { fontSize: 13, color: "#94A3B8", fontWeight: "500", marginTop: 2 },
  subtitle: {
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
    fontSize: 15,
    color: "#64748B",
  },
  toggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 5,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  toggleActive: { backgroundColor: "#FFFFFF", elevation: 3 },
  toggleText: { fontWeight: "600", color: "#94A3B8", fontSize: 15 },
  toggleTextActive: { color: "#7C3AED", fontWeight: "700" },
  row: { flexDirection: "row", gap: 12 },
  input: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    fontSize: 15,
    color: "#1E293B",
  },
  halfInput: { flex: 1 },
  primaryBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  errorContainer: {
    marginTop: 16,
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
  },
  error: { color: "#DC2626", fontSize: 13, fontWeight: "500" },
  note: {
    marginTop: 20,
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
  },
});
