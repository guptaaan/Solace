// app/(auth)/sleep-onboarding.tsx
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "@/constants/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

type Option = { label: string; value: string };
type Question =
  | { id: string; title: string; type: "single"; options: Option[] }
  | { id: string; title: string; type: "multi"; options: Option[] }
  | {
      id: string;
      title: string;
      type: "scale";
      min: number;
      max: number;
      labels?: { minLabel?: string; maxLabel?: string };
    };

type Answers = Record<string, string | string[] | number>;

const API_BASE = "https://l8rlryabbc.execute-api.us-east-1.amazonaws.com/prod";

export default function SleepOnboardingScreen() {
  const router = useRouter();

  const questions: Question[] = useMemo(
    () => [
      {
        id: "q1_bedtime_weekdays",
        title: "1. What time do you usually go to bed on weekdays?",
        type: "single",
        options: [
          { label: "Before 9 PM", value: "before_9pm" },
          { label: "9–10 PM", value: "9_10pm" },
          { label: "10–11 PM", value: "10_11pm" },
          { label: "11 PM–12 AM", value: "11_12am" },
          { label: "After 12 AM", value: "after_12am" },
        ],
      },
      {
        id: "q2_wake_weekdays",
        title: "2. What time do you usually wake up on weekdays?",
        type: "single",
        options: [
          { label: "Before 6 AM", value: "before_6am" },
          { label: "6–7 AM", value: "6_7am" },
          { label: "7–8 AM", value: "7_8am" },
          { label: "8–9 AM", value: "8_9am" },
          { label: "After 9 AM", value: "after_9am" },
        ],
      },
      {
        id: "q3_weekend_difference",
        title: "3. On weekends, how different is your sleep schedule?",
        type: "single",
        options: [
          { label: "No difference", value: "no_difference" },
          { label: "1–2 hours later", value: "1_2_later" },
          { label: "3+ hours later", value: "3plus_later" },
        ],
      },
      {
        id: "q4_fall_asleep_time",
        title: "4. How long does it usually take you to fall asleep?",
        type: "single",
        options: [
          { label: "< 15 min", value: "lt_15" },
          { label: "15–30 min", value: "15_30" },
          { label: "30–60 min", value: "30_60" },
          { label: "1+ hour", value: "1plus_hour" },
        ],
      },
      {
        id: "q5_avg_sleep_hours",
        title: "5. How many hours of sleep do you get on average?",
        type: "single",
        options: [
          { label: "< 5", value: "lt_5" },
          { label: "5–6", value: "5_6" },
          { label: "6–7", value: "6_7" },
          { label: "7–8", value: "7_8" },
          { label: "8+", value: "8plus" },
        ],
      },
      {
        id: "q6_wake_night",
        title: "6. How often do you wake up during the night?",
        type: "single",
        options: [
          { label: "Never", value: "never" },
          { label: "1–2 times", value: "1_2" },
          { label: "3+ times", value: "3plus" },
          { label: "Many times", value: "many" },
        ],
      },
      {
        id: "q7_rested",
        title: "7. Do you feel rested when you wake up?",
        type: "single",
        options: [
          { label: "Always", value: "always" },
          { label: "Often", value: "often" },
          { label: "Sometimes", value: "sometimes" },
          { label: "Rarely", value: "rarely" },
          { label: "Never", value: "never" },
        ],
      },
      {
        id: "q8_experience_multi",
        title:
          "8. Do you experience any of the following? (Select all that apply)",
        type: "multi",
        options: [
          { label: "Night anxiety", value: "night_anxiety" },
          { label: "Racing thoughts", value: "racing_thoughts" },
          { label: "Nightmares", value: "nightmares" },
          { label: "Snoring", value: "snoring" },
          { label: "None", value: "none" },
        ],
      },
      {
        id: "q9_phone_in_bed",
        title: "9. Do you use your phone in bed?",
        type: "single",
        options: [
          { label: "No", value: "no" },
          { label: "Sometimes", value: "sometimes" },
          { label: "Always", value: "always" },
        ],
      },
      {
        id: "q10_caffeine_after_4",
        title: "10. Caffeine intake after 4 PM?",
        type: "single",
        options: [
          { label: "Never", value: "never" },
          { label: "1 cup", value: "1" },
          { label: "2+ cups", value: "2plus" },
        ],
      },
      {
        id: "q11_alcohol_before_sleep",
        title: "11. Alcohol before sleep?",
        type: "single",
        options: [
          { label: "Never", value: "never" },
          { label: "Occasionally", value: "occasionally" },
          { label: "Frequently", value: "frequently" },
        ],
      },
      {
        id: "q12_irregular_schedule",
        title: "12. Do you work night shifts or irregular schedules?",
        type: "single",
        options: [
          { label: "No", value: "no" },
          { label: "Sometimes", value: "sometimes" },
          { label: "Yes", value: "yes" },
        ],
      },
      {
        id: "q13_mood_when_poor_sleep",
        title: "13. When your sleep is poor, how does your mood change?",
        type: "single",
        options: [
          { label: "Irritable", value: "irritable" },
          { label: "Anxious", value: "anxious" },
          { label: "Low energy", value: "low_energy" },
          { label: "No change", value: "no_change" },
        ],
      },
      {
        id: "q14_stressed_scale",
        title:
          "14a. Over the past 2 weeks, how often have you felt stressed? (1–5)",
        type: "scale",
        min: 1,
        max: 5,
      },
      {
        id: "q14_overwhelmed_scale",
        title:
          "14b. Over the past 2 weeks, how often have you felt overwhelmed? (1–5)",
        type: "scale",
        min: 1,
        max: 5,
      },
      {
        id: "q14_low_motivation_scale",
        title:
          "14c. Over the past 2 weeks, how often have you felt low motivation? (1–5)",
        type: "scale",
        min: 1,
        max: 5,
      },
      {
        id: "q15_exercise",
        title: "15. Do you exercise regularly?",
        type: "single",
        options: [
          { label: "0 times/week", value: "0" },
          { label: "1–2 times", value: "1_2" },
          { label: "3–5 times", value: "3_5" },
          { label: "Daily", value: "daily" },
        ],
      },
      {
        id: "q16_sleep_aids",
        title: "16. Do you use any sleep aids?",
        type: "single",
        options: [
          { label: "None", value: "none" },
          { label: "Melatonin", value: "melatonin" },
          { label: "Prescription", value: "prescription" },
          { label: "Other", value: "other" },
        ],
      },
    ],
    [],
  );

  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);

  // Auth readiness guards
  const [authReady, setAuthReady] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUid(u?.uid ?? null);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!currentUid) router.replace("/(auth)" as any);
  }, [authReady, currentUid, router]);

  const setSingle = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const toggleMulti = (id: string, value: string) => {
    setAnswers((prev) => {
      const current = (prev[id] as string[]) || [];
      const has = current.includes(value);
      let next = has ? current.filter((v) => v !== value) : [...current, value];

      if (value === "none") next = ["none"];
      else next = next.filter((v) => v !== "none");

      return { ...prev, [id]: next };
    });
  };

  const setScale = (id: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const isComplete = useMemo(() => {
    for (const q of questions) {
      const v = answers[q.id];
      if (q.type === "single") {
        if (typeof v !== "string" || v.trim().length === 0) return false;
      }
      if (q.type === "multi") {
        if (!Array.isArray(v) || v.length === 0) return false;
      }
      if (q.type === "scale") {
        if (typeof v !== "number") return false;
      }
    }
    return true;
  }, [answers, questions]);

  const saveToAWS = async (payloadAnswers: Answers) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");

    const token = await user.getIdToken(); // no forced refresh
    const url = `${API_BASE}/onboarding/sleep`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ answers: payloadAnswers }),
    });

    if (!res.ok) {
      // try to extract best error text
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json().catch(() => null);
        const msg =
          j?.error || j?.message || JSON.stringify(j) || "AWS save failed";
        throw new Error(msg);
      } else {
        const t = await res.text().catch(() => "");
        throw new Error(t || `AWS save failed (${res.status})`);
      }
    }
  };

  const handleSubmit = async () => {
    if (!isComplete) {
      Alert.alert(
        "Complete all questions",
        "Please answer every question to continue.",
      );
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      router.replace("/(auth)" as any);
      return;
    }

    setSubmitting(true);

    // Same structure:
    // 1) save to AWS
    // 2) set onboardingComplete in Firestore (routing flag)
    const writeToAwsPromise = saveToAWS(answers);

    const writeComplete = setDoc(
      doc(db, "users", user.uid),
      {
        onboardingComplete: true,
        onboardingCompletedAt: serverTimestamp(),
      },
      { merge: true },
    );

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 8000));

    try {
      await Promise.race([
        Promise.all([writeToAwsPromise, writeComplete]),
        timeout,
      ]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save onboarding");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.replace("/(tabs)/profile" as any);
  };

  if (!authReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.centerText}>Loading...</Text>
      </View>
    );
  }

  if (!currentUid) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.centerText}>Redirecting...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep Onboarding</Text>
        <Text style={styles.subtitle}>Answer all questions to continue.</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {questions.map((q) => (
          <View key={q.id} style={styles.card}>
            <Text style={styles.qTitle}>{q.title}</Text>

            {q.type === "single" && (
              <View style={styles.optionsWrap}>
                {q.options.map((op) => {
                  const selected = answers[q.id] === op.value;
                  return (
                    <TouchableOpacity
                      key={op.value}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => setSingle(q.id, op.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {op.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {q.type === "multi" && (
              <View style={styles.optionsWrap}>
                {q.options.map((op) => {
                  const selected = Array.isArray(answers[q.id])
                    ? (answers[q.id] as string[]).includes(op.value)
                    : false;

                  return (
                    <TouchableOpacity
                      key={op.value}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => toggleMulti(q.id, op.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {op.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {q.type === "scale" && (
              <View style={styles.scaleRow}>
                {Array.from({ length: q.max - q.min + 1 }).map((_, idx) => {
                  const val = q.min + idx;
                  const selected = answers[q.id] === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.scaleBtn,
                        selected && styles.scaleBtnSelected,
                      ]}
                      onPress={() => setScale(q.id, val)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.scaleText,
                          selected && styles.scaleTextSelected,
                        ]}
                      >
                        {val}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[
            styles.submit,
            (!isComplete || submitting) && styles.submitDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!isComplete || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>Submit and Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F0F4F8",
  },
  centerText: { marginTop: 10, color: "#64748B" },

  container: { flex: 1, backgroundColor: "#F0F4F8" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  title: { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtitle: { marginTop: 6, color: "#64748B" },
  body: { flex: 1, padding: 16 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  qTitle: { fontWeight: "700", color: "#111827", marginBottom: 10 },

  optionsWrap: { gap: 10 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  optionSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "rgba(124,58,237,0.08)",
  },
  optionText: { color: "#1F2937", fontWeight: "600" },
  optionTextSelected: { color: "#7C3AED" },

  scaleRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  scaleBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  scaleBtnSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "rgba(124,58,237,0.08)",
  },
  scaleText: { fontWeight: "700", color: "#334155" },
  scaleTextSelected: { color: "#7C3AED" },

  submit: {
    marginTop: 12,
    backgroundColor: "#7C3AED",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: "#FFFFFF", fontWeight: "800" },
});
