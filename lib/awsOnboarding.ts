// lib/awsOnboarding.ts
import { auth } from "@/constants/firebase";

const API_BASE = "https://l8rlryabbc.execute-api.us-east-1.amazonaws.com/prod";

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");
  // true = forces refresh so Lambda always gets a valid token
  return await user.getIdToken(true);
}

export async function saveSleepOnboardingToAWS(answers: any) {
  const token = await getIdToken();

  const res = await fetch(`${API_BASE}/onboarding/sleep`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ answers }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to save onboarding");
  }

  return await res.json();
}

export async function getSleepOnboardingFromAWS() {
  const token = await getIdToken();

  const res = await fetch(`${API_BASE}/onboarding/sleep`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch onboarding");
  }

  return await res.json();
}
