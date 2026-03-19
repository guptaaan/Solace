import { ENDPOINTS } from "@/constants/aws-api";
import { auth } from "@/constants/firebase";
import { getLocales } from "expo-localization";

function getCountry() {
  try {
    const locales = getLocales();
    return locales?.[0]?.regionCode ?? "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}

export async function trackEvent(
  eventType: string,
  extra: Record<string, any> = {},
) {
  try {
    const userId = auth.currentUser?.uid || "anonymous-user";

    await fetch(ENDPOINTS.analytics, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        eventType,
        country: getCountry(),
        ...extra,
      }),
    });
  } catch (err) {
    console.log("analytics track failed", err);
  }
}
