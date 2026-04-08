// import { auth, db } from "@/constants/firebase";
// import { useFrameworkReady } from "@/hooks/useFrameworkReady";
// import { Stack, useRouter, useSegments } from "expo-router";
// import { StatusBar } from "expo-status-bar";
// import { onAuthStateChanged } from "firebase/auth";
// import { doc, getDoc } from "firebase/firestore";
// import { useEffect, useRef, useState } from "react";
// import { ActivityIndicator, View } from "react-native";

// export default function RootLayout() {
//   useFrameworkReady();

//   const router = useRouter();
//   const segments = useSegments();

//   const [authReady, setAuthReady] = useState(false);
//   const [user, setUser] = useState<any>(null);

//   const isRouting = useRef(false);
//   const lastRoutedUid = useRef<string | null | undefined>(undefined);

//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, (u) => {
//       setUser(u);
//       setAuthReady(true);
//     });
//     return unsub;
//   }, []);

//   useEffect(() => {
//     if (!authReady) return;
//     if (isRouting.current) return;

//     const inAuthGroup = segments[0] === "(auth)";
//     const inOnboarding = inAuthGroup && segments[1] === "sleep-onboarding";
//     const inTabsGroup = segments[0] === "(tabs)";

//     // ── Not logged in ──────────────────────────────────────────────────────
//     if (!user) {
//       lastRoutedUid.current = null;
//       if (!inAuthGroup) {
//         isRouting.current = true;
//         router.replace("/(auth)" as any);
//         setTimeout(() => {
//           isRouting.current = false;
//         }, 500);
//       }
//       return;
//     }

//     // ── Already on the right screen ────────────────────────────────────────
//     if (inOnboarding) return;
//     if (inTabsGroup) return;

//     // ── Only route once per uid ────────────────────────────────────────────
//     if (lastRoutedUid.current === user.uid) return;
//     lastRoutedUid.current = user.uid;

//     isRouting.current = true;

//     // Check if this is a brand-new signup that needs onboarding.
//     // Use a SHORT timeout (1.5s) — if Firestore is slow or offline,
//     // just go to profile. Don't block sign-in on a Firestore round-trip.
//     const firestoreTimeout = new Promise<null>((resolve) =>
//       setTimeout(() => resolve(null), 1500),
//     );

//     Promise.race([getDoc(doc(db, "users", user.uid)), firestoreTimeout])
//       .then((snap) => {
//         // snap is null if Firestore timed out — safe to go to profile
//         if (snap && "exists" in snap && snap.exists()) {
//           const data = snap.data();
//           if (data?.onboardingComplete === false) {
//             router.replace("/(auth)/sleep-onboarding" as any);
//             return;
//           }
//         }
//         router.replace("/(tabs)/profile" as any);
//       })
//       .catch(() => {
//         // Firestore error — go straight to profile
//         router.replace("/(tabs)/profile" as any);
//       })
//       .finally(() => {
//         setTimeout(() => {
//           isRouting.current = false;
//         }, 500);
//       });
//   }, [authReady, user, segments]);

//   if (!authReady) {
//     return (
//       <View
//         style={{
//           flex: 1,
//           justifyContent: "center",
//           alignItems: "center",
//           backgroundColor: "#F0F4F8",
//         }}
//       >
//         <ActivityIndicator size="large" color="#7C3AED" />
//       </View>
//     );
//   }

//   return (
//     <>
//       <Stack screenOptions={{ headerShown: false }} />
//       <StatusBar style="auto" />
//     </>
//   );
// }
// app/_layout.tsx
import { auth, db } from "@/constants/firebase";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

// ─── Shared in-memory flag ────────────────────────────────────────────────────
// index.tsx sets this to true BEFORE calling createUserWithEmailAndPassword.
// The layout reads it when onAuthStateChanged fires for the new user.
// This avoids the race where getDoc runs before setDoc finishes writing.
let pendingNewSignup = false;
export function markNewSignup() {
  pendingNewSignup = true;
}
export function clearNewSignup() {
  pendingNewSignup = false;
}

export default function RootLayout() {
  useFrameworkReady();

  const router = useRouter();
  const segments = useSegments();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<any>(null);

  const isRouting = useRef(false);
  const lastRoutedUid = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (isRouting.current) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = inAuthGroup && segments[1] === "sleep-onboarding";
    const inTabsGroup = segments[0] === "(tabs)";

    // ── Not logged in ──────────────────────────────────────────────────────
    if (!user) {
      lastRoutedUid.current = null;
      if (!inAuthGroup) {
        isRouting.current = true;
        router.replace("/(auth)" as any);
        setTimeout(() => {
          isRouting.current = false;
        }, 500);
      }
      return;
    }

    // ── Already on the right screen ────────────────────────────────────────
    if (inOnboarding) return;
    if (inTabsGroup) return;

    // ── Only route once per uid ────────────────────────────────────────────
    if (lastRoutedUid.current === user.uid) return;
    lastRoutedUid.current = user.uid;
    isRouting.current = true;

    // ── NEW SIGNUP: flag set by index.tsx before account creation ──────────
    // Don't touch Firestore at all — the doc may not exist yet.
    if (pendingNewSignup) {
      clearNewSignup();
      router.replace("/(auth)/sleep-onboarding" as any);
      setTimeout(() => {
        isRouting.current = false;
      }, 500);
      return;
    }

    // ── RETURNING USER: check Firestore with short timeout ─────────────────
    const firestoreTimeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 1500),
    );

    Promise.race([getDoc(doc(db, "users", user.uid)), firestoreTimeout])
      .then((snap) => {
        if (snap && "exists" in snap && snap.exists()) {
          const data = snap.data();
          if (data?.onboardingComplete === false) {
            router.replace("/(auth)/sleep-onboarding" as any);
            return;
          }
        }
        router.replace("/(tabs)/profile" as any);
      })
      .catch(() => {
        router.replace("/(tabs)/profile" as any);
      })
      .finally(() => {
        setTimeout(() => {
          isRouting.current = false;
        }, 500);
      });
  }, [authReady, user, segments]);

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
