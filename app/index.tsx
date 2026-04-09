// //appinexx.tsx
// import { auth } from "@/constants/firebase";
// import { useRouter } from "expo-router";
// import { onAuthStateChanged } from "firebase/auth";
// import { useEffect, useState } from "react";
// import { ActivityIndicator, View } from "react-native";

// export default function Index() {
//   const router = useRouter();
//   const [checking, setChecking] = useState(true);

//   useEffect(() => {
//     const unsub = onAuthStateChanged(auth, (user) => {
//       if (user) {
//         router.replace("/(tabs)/insights" as any);
//       } else {
//         router.replace("/(auth)" as any);
//       }
//       setChecking(false);
//     });

//     return unsub;
//   }, [router]);

//   if (!checking) return null;

//   return (
//     <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
//       <ActivityIndicator />
//     </View>
//   );
// }
// app/index.tsx
import { auth } from "@/constants/firebase";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  // Track if we've received at least one auth state event
  const hasResolved = useRef(false);

  useEffect(() => {
    // Give Firebase up to 2s to rehydrate persisted auth before
    // treating a null user as "logged out". This prevents the OAuth
    // redirect-back from briefly seeing no user and bouncing to sign-in.
    const timeout = setTimeout(() => {
      if (!hasResolved.current) {
        // Firebase took too long — assume no user
        router.replace("/(auth)" as any);
        setChecking(false);
      }
    }, 2000);

    const unsub = onAuthStateChanged(auth, (user) => {
      hasResolved.current = true;
      clearTimeout(timeout);

      if (user) {
        router.replace("/(tabs)/insights" as any);
      } else {
        router.replace("/(auth)" as any);
      }
      setChecking(false);
    });

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, [router]);

  if (!checking) return null;

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
