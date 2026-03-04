import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type SleepAnswers = Record<string, any>;

type Props = {
  visible: boolean;
  loading?: boolean;
  onSubmit: (answers: SleepAnswers) => Promise<void> | void;
};

type Question =
  | {
      id: string;
      type: "single";
      title: string;
      options: string[];
      required?: boolean;
    }
  | {
      id: string;
      type: "multi";
      title: string;
      options: string[];
      required?: boolean;
      minSelect?: number;
    }
  | {
      id: string;
      type: "scale";
      title: string;
      min: number;
      max: number;
      required?: boolean;
      labels?: { minLabel?: string; maxLabel?: string };
    };

const QUESTIONS: Question[] = [
  {
    id: "bedtime_weekdays",
    type: "single",
    title: "1. What time do you usually go to bed on weekdays?",
    options: [
      "Before 9 PM",
      "9–10 PM",
      "10–11 PM",
      "11 PM–12 AM",
      "After 12 AM",
    ],
    required: true,
  },
  {
    id: "wake_weekdays",
    type: "single",
    title: "2. What time do you usually wake up on weekdays?",
    options: ["Before 5 AM", "5–6 AM", "6–7 AM", "7–8 AM", "After 8 AM"],
    required: true,
  },
  {
    id: "weekend_difference",
    type: "single",
    title: "3. On weekends, how different is your sleep schedule?",
    options: ["No difference", "1–2 hours later", "3+ hours later"],
    required: true,
  },
  {
    id: "fall_asleep_time",
    type: "single",
    title: "4. How long does it usually take you to fall asleep?",
    options: ["< 15 min", "15–30 min", "30–60 min", "1+ hour"],
    required: true,
  },
  {
    id: "avg_sleep_hours",
    type: "single",
    title: "5. How many hours of sleep do you get on average?",
    options: ["<5", "5–6", "6–7", "7–8", "8+"],
    required: true,
  },
  {
    id: "wake_night",
    type: "single",
    title: "6. How often do you wake up during the night?",
    options: ["Never", "1–2 times", "3+ times", "Many times"],
    required: true,
  },
  {
    id: "rested_morning",
    type: "single",
    title: "7. Do you feel rested when you wake up?",
    options: ["Always", "Often", "Sometimes", "Rarely", "Never"],
    required: true,
  },
  {
    id: "night_experiences",
    type: "multi",
    title: "8. Do you experience any of the following? (Select all that apply)",
    options: [
      "Night anxiety",
      "Racing thoughts",
      "Nightmares",
      "Snoring",
      "None",
    ],
    required: true,
    minSelect: 1,
  },
  {
    id: "phone_in_bed",
    type: "single",
    title: "9. Do you use your phone in bed?",
    options: ["No", "Sometimes", "Always"],
    required: true,
  },
  {
    id: "caffeine_after_4",
    type: "single",
    title: "10. Caffeine intake after 4 PM?",
    options: ["Never", "1 cup", "2+ cups"],
    required: true,
  },
  {
    id: "alcohol_before_sleep",
    type: "single",
    title: "11. Alcohol before sleep?",
    options: ["Never", "Occasionally", "Frequently"],
    required: true,
  },
  {
    id: "irregular_schedule",
    type: "single",
    title: "12. Do you work night shifts or irregular schedules?",
    options: ["No", "Sometimes", "Yes"],
    required: true,
  },
  {
    id: "mood_when_poor_sleep",
    type: "single",
    title: "13. When your sleep is poor, how does your mood change?",
    options: ["Irritable", "Anxious", "Low energy", "No change"],
    required: true,
  },
  {
    id: "stress",
    type: "scale",
    title: "14a. Over the past 2 weeks, how often have you felt stressed?",
    min: 1,
    max: 5,
    required: true,
    labels: { minLabel: "Low", maxLabel: "High" },
  },
  {
    id: "overwhelmed",
    type: "scale",
    title: "14b. Over the past 2 weeks, how often have you felt overwhelmed?",
    min: 1,
    max: 5,
    required: true,
    labels: { minLabel: "Low", maxLabel: "High" },
  },
  {
    id: "low_motivation",
    type: "scale",
    title:
      "14c. Over the past 2 weeks, how often have you felt low motivation?",
    min: 1,
    max: 5,
    required: true,
    labels: { minLabel: "Low", maxLabel: "High" },
  },
  {
    id: "exercise",
    type: "single",
    title: "15. Do you exercise regularly?",
    options: ["0 times/week", "1–2 times", "3–5 times", "Daily"],
    required: true,
  },
  {
    id: "sleep_aids",
    type: "single",
    title: "16. Do you use any sleep aids?",
    options: ["None", "Melatonin", "Prescription", "Other"],
    required: true,
  },
];

export default function SleepOnboardingModal({
  visible,
  loading = false,
  onSubmit,
}: Props) {
  const [answers, setAnswers] = useState<SleepAnswers>({});
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [thankYou, setThankYou] = useState(false);

  const total = QUESTIONS.length;
  const q = QUESTIONS[step];

  const isAnswered = (question: Question, val: any) => {
    if (question.type === "multi") {
      return Array.isArray(val) && val.length >= (question.minSelect ?? 1);
    }
    return val !== undefined && val !== null && val !== "";
  };

  const currentValue = answers[q.id];

  const canGoNext = useMemo(() => {
    if (!q.required) return true;
    return isAnswered(q, currentValue);
  }, [q, currentValue]);

  const allRequiredAnswered = useMemo(() => {
    for (const question of QUESTIONS) {
      if (question.required) {
        const v = answers[question.id];
        if (!isAnswered(question, v)) return false;
      }
    }
    return true;
  }, [answers]);

  const setSingle = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setSubmitError(null);
  };

  const toggleMulti = (id: string, option: string) => {
    setAnswers((prev) => {
      const existing: string[] = Array.isArray(prev[id]) ? prev[id] : [];
      if (option === "None") {
        return { ...prev, [id]: ["None"] };
      }
      const withoutNone = existing.filter((x) => x !== "None");
      if (withoutNone.includes(option)) {
        return { ...prev, [id]: withoutNone.filter((x) => x !== option) };
      }
      return { ...prev, [id]: [...withoutNone, option] };
    });
    setSubmitError(null);
  };

  const setScale = (id: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setSubmitError(null);
  };

  const next = () => {
    if (!canGoNext) {
      setSubmitError("Please answer this question to continue.");
      return;
    }
    if (step < total - 1) setStep((s) => s + 1);
  };

  const back = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const submitAll = async () => {
    setSubmitError(null);

    if (!allRequiredAnswered) {
      setSubmitError("Please answer all questions before submitting.");
      return;
    }

    try {
      setThankYou(true);
      await onSubmit(answers);
    } catch (e: any) {
      setThankYou(false);
      setSubmitError(e?.message ?? "Failed to submit answers.");
    }
  };

  const renderSingle = (question: Extract<Question, { type: "single" }>) => {
    const selected = answers[question.id];
    return (
      <View style={{ marginTop: 10 }}>
        {question.options.map((opt) => {
          const active = selected === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => setSingle(question.id, opt)}
              disabled={loading || thankYou}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.optionText, active && styles.optionTextActive]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderMulti = (question: Extract<Question, { type: "multi" }>) => {
    const selected: string[] = Array.isArray(answers[question.id])
      ? answers[question.id]
      : [];
    return (
      <View style={{ marginTop: 10 }}>
        {question.options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => toggleMulti(question.id, opt)}
              disabled={loading || thankYou}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.optionText, active && styles.optionTextActive]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderScale = (question: Extract<Question, { type: "scale" }>) => {
    const selected = answers[question.id] as number | undefined;
    const buttons = [];
    for (let i = question.min; i <= question.max; i++) {
      const active = selected === i;
      buttons.push(
        <TouchableOpacity
          key={i}
          style={[styles.scaleBtn, active && styles.scaleBtnActive]}
          onPress={() => setScale(question.id, i)}
          disabled={loading || thankYou}
          activeOpacity={0.85}
        >
          <Text style={[styles.scaleText, active && styles.scaleTextActive]}>
            {i}
          </Text>
        </TouchableOpacity>,
      );
    }
    return (
      <View style={{ marginTop: 12 }}>
        <View style={styles.scaleRow}>{buttons}</View>
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLabelText}>
            {question.labels?.minLabel ?? ""}
          </Text>
          <Text style={styles.scaleLabelText}>
            {question.labels?.maxLabel ?? ""}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Sleep Onboarding</Text>
          <Text style={styles.progress}>
            Question {step + 1} of {total}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ marginTop: 10 }}
          >
            {!thankYou ? (
              <>
                <Text style={styles.questionTitle}>{q.title}</Text>

                {q.type === "single" && renderSingle(q)}
                {q.type === "multi" && renderMulti(q)}
                {q.type === "scale" && renderScale(q)}

                {submitError ? (
                  <Text style={styles.error}>{submitError}</Text>
                ) : null}

                <View style={{ height: 16 }} />
              </>
            ) : (
              <View style={{ paddingVertical: 24 }}>
                <Text style={styles.thanksTitle}>
                  Thanks for filling this out.
                </Text>
                <Text style={styles.thanksSub}>
                  Saving your answers and preparing your profile...
                </Text>
                <View style={{ marginTop: 18 }}>
                  <ActivityIndicator />
                </View>
              </View>
            )}
          </ScrollView>

          {!thankYou && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.secondaryBtn, step === 0 && { opacity: 0.4 }]}
                onPress={back}
                disabled={step === 0 || loading}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryText}>Back</Text>
              </TouchableOpacity>

              {step < total - 1 ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, !canGoNext && { opacity: 0.5 }]}
                  onPress={next}
                  disabled={!canGoNext || loading}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    !allRequiredAnswered && { opacity: 0.5 },
                  ]}
                  onPress={submitAll}
                  disabled={!allRequiredAnswered || loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Submit</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 18,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxHeight: "88%",
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  progress: { marginTop: 4, fontSize: 12, color: "#6B7280" },
  questionTitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  option: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    marginBottom: 10,
  },
  optionActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F3E8FF",
  },
  optionText: { color: "#111827", fontWeight: "600" },
  optionTextActive: { color: "#5B21B6" },

  scaleRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  scaleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },
  scaleBtnActive: {
    borderColor: "#7C3AED",
    backgroundColor: "#F3E8FF",
  },
  scaleText: { fontWeight: "800", color: "#111827" },
  scaleTextActive: { color: "#5B21B6" },
  scaleLabels: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scaleLabelText: { fontSize: 12, color: "#6B7280" },

  error: { marginTop: 8, color: "#B91C1C", fontSize: 13, fontWeight: "600" },

  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  secondaryText: { fontWeight: "800", color: "#111827" },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
    alignItems: "center",
  },
  primaryText: { fontWeight: "800", color: "#FFFFFF" },

  thanksTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  thanksSub: {
    marginTop: 8,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
});
