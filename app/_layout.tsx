// app/_layout.tsx
import { auth, db } from "@/constants/firebase";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function RootLayout() {
  useFrameworkReady();

  const router = useRouter();
  const segments = useSegments();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<any>(null);

  const isNavigating = useRef(false);
  // Track whether we've already routed this user session
  const hasRouted = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      // Reset routing lock whenever auth state changes (sign in / sign out)
      hasRouted.current = false;
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding =
      segments[0] === "(auth)" && segments[1] === "sleep-onboarding";
    const inTabsGroup = segments[0] === "(tabs)";

    // 1) Not logged in → send to auth, but not if already there
    if (!user) {
      if (!inAuthGroup) {
        isNavigating.current = true;
        router.replace("/(auth)" as any);
        setTimeout(() => (isNavigating.current = false), 300);
      }
      return;
    }

    // 2) Logged in and already on onboarding → leave them alone
    if (inOnboarding) return;

    // 3) Logged in and already in tabs → leave them alone
    if (inTabsGroup) return;

    // 4) Logged in and on auth index → decide where to send them
    //    But only do this ONCE per auth session to avoid racing with
    //    the signup handler's own router.replace call.
    if (inAuthGroup && !hasRouted.current) {
      hasRouted.current = true;

      // Check Firestore to see if onboarding is needed
      getDoc(doc(db, "users", user.uid))
        .then((snap) => {
          const data = snap.exists() ? snap.data() : null;

          // onboardingComplete is explicitly false → needs onboarding
          if (data?.onboardingComplete === false) {
            router.replace("/(auth)/sleep-onboarding" as any);
          } else {
            // true, missing, or any other value → go to profile
            router.replace("/(tabs)/profile" as any);
          }
        })
        .catch(() => {
          // Firestore failed → safe fallback
          router.replace("/(tabs)/profile" as any);
        });
    }
  }, [authReady, user, segments, router]);

  if (!authReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F0F4F8",
        }}
      >
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}
