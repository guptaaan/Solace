// // app/_layout.tsx
// import { auth, db } from "@/constants/firebase";
// import { useFrameworkReady } from "@/hooks/useFrameworkReady";
// import { Stack, useRouter, useSegments } from "expo-router";
// import { StatusBar } from "expo-status-bar";
// import { onAuthStateChanged } from "firebase/auth";
// import { doc, getDoc } from "firebase/firestore";
// import { useEffect, useRef, useState } from "react";
// import { ActivityIndicator, View } from "react-native";

// // ─── Shared in-memory flag ────────────────────────────────────────────────────
// // index.tsx sets this to true BEFORE calling createUserWithEmailAndPassword.
// // The layout reads it when onAuthStateChanged fires for the new user.
// // This avoids the race where getDoc runs before setDoc finishes writing.
// let pendingNewSignup = false;
// export function markNewSignup() {
//   pendingNewSignup = true;
// }
// export function clearNewSignup() {
//   pendingNewSignup = false;
// }

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

//     // ── NEW SIGNUP: flag set by index.tsx before account creation ──────────
//     // Don't touch Firestore at all — the doc may not exist yet.
//     if (pendingNewSignup) {
//       clearNewSignup();
//       router.replace("/(auth)/sleep-onboarding" as any);
//       setTimeout(() => {
//         isRouting.current = false;
//       }, 500);
//       return;
//     }

//     // ── RETURNING USER: check Firestore with short timeout ─────────────────
//     const firestoreTimeout = new Promise<null>((resolve) =>
//       setTimeout(() => resolve(null), 1500),
//     );

//     Promise.race([getDoc(doc(db, "users", user.uid)), firestoreTimeout])
//       .then((snap) => {
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
// app/_layout.tsx
import { auth, db } from "@/constants/firebase";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

// ─── Shared in-memory flag ────────────────────────────────────────────────────
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

  // True while the Fitbit OAuth browser is open
  const oauthInProgress = useRef(false);

  // ── AppState: set flag when app goes to background while logged in ─────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" && auth.currentUser) {
        oauthInProgress.current = true;
      }
      if (nextState === "active" && oauthInProgress.current) {
        // Keep flag true for 3s after returning so Firebase can rehydrate
        setTimeout(() => {
          oauthInProgress.current = false;
        }, 3000);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Auth state listener ───────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // KEY FIX: if Firebase emits null but auth.currentUser is still
      // populated (transient during OAuth redirect), ignore it entirely.
      if (!u && auth.currentUser) return;

      // Also ignore null during known OAuth browser flow
      if (!u && oauthInProgress.current) return;

      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // ── Routing logic (unchanged from your original) ──────────────────────────
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

    // ── NEW SIGNUP ──────────────────────────────────────────────────────────
    if (pendingNewSignup) {
      clearNewSignup();
      router.replace("/(auth)/sleep-onboarding" as any);
      setTimeout(() => {
        isRouting.current = false;
      }, 500);
      return;
    }

    // ── RETURNING USER ──────────────────────────────────────────────────────
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
