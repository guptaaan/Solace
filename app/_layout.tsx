// app/_layout.tsx
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { Amplify } from "aws-amplify";
import "aws-amplify/auth";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { awsConfig } from "../aws-config";
// Configure Amplify ONCE
Amplify.configure(awsConfig);

export default function RootLayout() {
  useFrameworkReady();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}
