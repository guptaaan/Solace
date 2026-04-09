// lib/awsOnboarding.ts
import { auth } from "@/constants/firebase";

const API_BASE = "https://l8rlryabbc.execute-api.us-east-1.amazonaws.com";
const API_BASE_WITH_STAGE = `${API_BASE}/prod`;

type DynamoAttr = {
  S?: string;
  N?: string;
  L?: DynamoAttr[];
  M?: Record<string, DynamoAttr>;
  BOOL?: boolean;
  NULL?: boolean;
};

type SleepOnboardingLike = {
  userId?: string;
  formId?: string;
  answers?: Record<string, any>;
  items?: unknown[];
  Items?: unknown[];
  Item?: {
    userId?: DynamoAttr;
    formId?: DynamoAttr;
    answers?: DynamoAttr;
  };
};

const QUESTION_LABELS: Record<string, string> = {
  q1_bedtime_weekdays: "Usual weekday bedtime",
  q2_wake_weekdays: "Usual weekday wake-up time",
  q3_weekend_difference: "Weekend sleep schedule difference",
  q4_fall_asleep_time: "Time to fall asleep",
  q5_avg_sleep_hours: "Average sleep hours",
  q6_wake_night: "Night awakenings",
  q7_rested: "Feel rested on waking",
  q8_experience_multi: "Sleep issues experienced",
  q9_phone_in_bed: "Phone use in bed",
  q10_caffeine_after_4: "Caffeine after 4 PM",
  q11_alcohol_before_sleep: "Alcohol before sleep",
  q12_irregular_schedule: "Irregular or night-shift schedule",
  q13_mood_when_poor_sleep: "Mood when sleep is poor",
  q14_stressed_scale: "Stress frequency (past 2 weeks)",
  q14_overwhelmed_scale: "Overwhelmed frequency (past 2 weeks)",
  q14_low_motivation_scale: "Low motivation frequency (past 2 weeks)",
  q15_exercise: "Exercise frequency",
  q16_sleep_aids: "Sleep aids used",
};

function decodeDynamoAttr(value: any): any {
  if (!value || typeof value !== "object") return value;

  if (typeof value.S === "string") return value.S;
  if (typeof value.N === "string") {
    const n = Number(value.N);
    return Number.isNaN(n) ? value.N : n;
  }
  if (Array.isArray(value.L)) return value.L.map(decodeDynamoAttr);
  if (value.M && typeof value.M === "object") {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value.M)) out[k] = decodeDynamoAttr(v);
    return out;
  }
  if (typeof value.BOOL === "boolean") return value.BOOL;
  if (value.NULL === true) return null;

  return value;
}

function decodeAnswers(rawAnswers: any): Record<string, any> {
  if (!rawAnswers) return {};
  const decoded = decodeDynamoAttr(rawAnswers);
  if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
    const asObj = decoded as Record<string, any>;
    const keys = Object.keys(asObj);
    // Handle map-of-Dynamo-attrs shape: { q1: {S:'x'}, q2: {N:'3'} }
    if (keys.some((k) => asObj[k] && typeof asObj[k] === "object" && ("S" in asObj[k] || "N" in asObj[k] || "L" in asObj[k] || "M" in asObj[k]))) {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(asObj)) out[k] = decodeDynamoAttr(v);
      return out;
    }
    return asObj;
  }
  return {};
}

function readableValue(value: any): string {
  if (value == null) return "not provided";
  if (Array.isArray(value)) return value.map((v) => readableValue(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/_/g, " ");
}

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");
  // true = forces refresh so Lambda always gets a valid token
  return await user.getIdToken(true);
}

async function parseResponseBody(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeUserId(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof value.S === "string") return value.S;
  return undefined;
}

function extractCandidates(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.Items)) return payload.Items;
  if (payload.Item) return [payload];
  return [payload];
}

function selectBestOnboardingRecord(payload: any): any {
  const currentUid = auth.currentUser?.uid;
  const candidates = extractCandidates(payload);
  if (!candidates.length) return payload;

  // Prefer sleep form first
  const sleepCandidates = candidates.filter((c) => {
    const formId = c?.formId ?? c?.Item?.formId ?? c?.item?.formId;
    const decoded = decodeDynamoAttr(formId);
    return decoded === "sleep" || decoded == null;
  });
  const pool = sleepCandidates.length ? sleepCandidates : candidates;

  // Prefer current Firebase user if available
  if (currentUid) {
    const matched = pool.find((c) => {
      const uid =
        normalizeUserId(c?.userId) ??
        normalizeUserId(c?.Item?.userId) ??
        normalizeUserId(c?.item?.userId);
      return uid === currentUid;
    });
    if (matched) return matched;
  }

  return pool[0];
}

export async function saveSleepOnboardingToAWS(answers: any) {
  const token = await getIdToken();

  const res = await fetch(`${API_BASE_WITH_STAGE}/onboarding/sleep`, {
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
  const token = await getIdToken().catch(() => null);
  const urls = [`${API_BASE}/onboarding/sleep`, `${API_BASE_WITH_STAGE}/onboarding/sleep`];

  let lastErr = "Failed to fetch onboarding";
  for (const url of urls) {
    // Try with auth token first when available.
    if (token) {
      const authedRes = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (authedRes.ok) return await parseResponseBody(authedRes);
      lastErr = String(await parseResponseBody(authedRes) || lastErr);
    }

    // Fallback to unauthenticated GET (as per API config).
    const publicRes = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (publicRes.ok) return await parseResponseBody(publicRes);
    lastErr = String(await parseResponseBody(publicRes) || lastErr);
  }

  throw new Error(lastErr);
}

export function formatSleepOnboardingForGemini(payload: unknown): string {
  const selected = selectBestOnboardingRecord(payload);
  const data = (selected ?? {}) as SleepOnboardingLike & {
    item?: SleepOnboardingLike["Item"];
    data?: SleepOnboardingLike;
    body?: SleepOnboardingLike;
  };

  const nested =
    (data.data as SleepOnboardingLike | undefined) ??
    (data.body as SleepOnboardingLike | undefined) ??
    ({} as SleepOnboardingLike);
  const item = data.Item ?? data.item ?? nested.Item;

  const userId =
    data.userId ??
    nested.userId ??
    (typeof item?.userId?.S === "string" ? item.userId.S : undefined);
  const formId =
    data.formId ??
    nested.formId ??
    (typeof item?.formId?.S === "string" ? item.formId.S : "sleep");
  const answers = decodeAnswers(data.answers ?? nested.answers ?? item?.answers);

  const keys = Object.keys(answers);
  if (!keys.length) return "";

  const lines: string[] = [
    "Onboarding data (sleep questionnaire): Use these answers to personalize support. Treat this as user-reported context, not diagnosis.",
    userId ? `User ID: ${userId}` : "User ID: unavailable",
    `Form ID: ${formId || "sleep"}`,
    "Answers:",
  ];

  for (const key of keys) {
    const label = QUESTION_LABELS[key] ?? key;
    lines.push(`- ${label}: ${readableValue(answers[key])}`);
  }

  return lines.join("\n");
}
