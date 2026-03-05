import { ENDPOINTS } from "@/constants/aws-api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import {
  Frown,
  Heart,
  Meh,
  Smile,
  Sparkles,
  Timer,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Exercise = {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  steps: string[]; // shown to user
  note?: string; // shown to user
  narration: string; // hidden voice script (NOT shown)
};

const STORAGE_KEYS = {
  WEEK_MINUTES: "solace_mood_week_minutes_v1",
  LAST_ACTIVE_DATE: "solace_last_active_date_v1",
  DAILY_EXERCISES_DATE: "solace_daily_exercises_date_v1",
  DAILY_EXERCISES_IDS: "solace_daily_exercises_ids_v1",
};

const QUOTES: string[] = [
  "One small step for your mind is still a step forward.",
  "You do not have to feel okay to be doing your best.",
  "Slow days still count. You showed up today.",
  "Your feelings are valid. You are allowed to take up space.",
  "Rest is productive when your mind is tired.",
  "You have gotten through 100% of your hardest days so far.",
  "Healing is not linear, but every check‑in is progress.",
  "Being gentle with yourself is a form of strength.",
];

const TORONTO_TZ = "America/Toronto";

function formatTorontoDateKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getTorontoHour(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TORONTO_TZ,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "12";
  return parseInt(hourStr, 10);
}

function getGreetingToronto(now = new Date()) {
  const hour = getTorontoHour(now);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hashStringToSeed(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seedStr: string) {
  const a = [...arr];
  const rand = mulberry32(hashStringToSeed(seedStr));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MoodScreen() {
  // -----------------------------
  // AWS mood submission (UNCHANGED LOGIC)
  // -----------------------------
  async function sendMood(mood: string) {
    const successMessageForMood = (m: string): string => {
      switch (m) {
        case "great":
          return "Love this energy — keep it up!";
        case "good":
          return "Nice, you’re doing well. Keep going.";
        case "okay":
          return "Thanks for checking in. Small steps still count.";
        case "low":
          return "Thank you for being honest. You’re not alone in this.";
        default:
          return "Mood saved. Thanks for checking in.";
      }
    };

    const payload = {
      userId: "test-user", // Later replace with Cognito ID
      date: new Date().toISOString().split("T")[0],
      mood,
      notes: null,
    };

    console.log("SENDING MOOD PAYLOAD >>>", payload);

    try {
      const response = await fetch(ENDPOINTS.mood, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("RESPONSE >>>", data);

      if (!response.ok) {
        Alert.alert("Error", data.error || "Something went wrong.");
        return;
      }

      Alert.alert("Success", `Mood '${mood}' submitted!`);
      const msg = successMessageForMood(mood);
      setMoodFeedback({ mood, message: msg });
      setTimeout(() => setMoodFeedback(null), 2000);
    } catch (err) {
      console.log("AWS ERROR ❌", err);
      Alert.alert("Error", "Could not submit your mood.");
    }
  }

  // -----------------------------
  // Local “time in app” tracking for this screen
  // -----------------------------
  const sessionStartRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const [weekMinutesMap, setWeekMinutesMap] = useState<Record<string, number>>(
    {},
  );
  const [greeting, setGreeting] = useState(getGreetingToronto());
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );
  const [quickActions, setQuickActions] = useState<Exercise[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const [moodFeedback, setMoodFeedback] = useState<{
    mood: string;
    message: string;
  } | null>(null);

  const todayKey = formatTorontoDateKey(new Date());
  const todaysQuote = useMemo(() => {
    if (!QUOTES.length) return "";
    const shuffled = seededShuffle(QUOTES, todayKey);
    return shuffled[0];
  }, [todayKey]);

  // Voice state
  const [isSpeaking, setIsSpeaking] = useState(false);

  function stopVoice() {
    try {
      Speech.stop();
    } catch {}
    setIsSpeaking(false);
  }

  async function toggleVoice(ex: Exercise | null) {
    if (!ex) return;

    const speakingNow = await Speech.isSpeakingAsync().catch(() => false);
    if (speakingNow || isSpeaking) {
      stopVoice();
      return;
    }

    setIsSpeaking(true);
    Speech.speak(ex.narration, {
      language: "en-CA",
      rate: 0.9,
      pitch: 1.0,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  // -----------------------------
  // 25 exercises (only 3 are shown daily)
  // narration is the "hidden script" for voice
  // -----------------------------
  const EXERCISES: Exercise[] = useMemo(
    () => [
      {
        id: "breathing_3",
        title: "3-Minute Breathing Reset",
        subtitle: "Slow your body down, gently",
        minutes: 3,
        steps: [
          "Sit comfortably, shoulders relaxed.",
          "Inhale 4 seconds.",
          "Hold 2 seconds.",
          "Exhale 6 seconds.",
          "Repeat 8–10 rounds.",
        ],
        note: "Keep it light. If you feel dizzy, shorten the counts.",
        narration:
          "Let’s do a three minute breathing reset. Sit comfortably and let your shoulders drop. We’ll do this slowly. Inhale through your nose for four seconds. One. Two. Three. Four. Hold for two. One. Two. Exhale softly for six. One. Two. Three. Four. Five. Six. Good. Let’s repeat. Inhale for four. One. Two. Three. Four. Hold two. One. Two. Exhale for six. One. Two. Three. Four. Five. Six. Keep going at your pace. If it feels too strong, make the breaths smaller. You’re doing this well.",
      },
      {
        id: "box_breathing",
        title: "Box Breathing",
        subtitle: "Steady focus in 2 minutes",
        minutes: 2,
        steps: ["Inhale 4.", "Hold 4.", "Exhale 4.", "Hold 4.", "Repeat."],
        note: "If 4 is too long, use 3.",
        narration:
          "We’ll do box breathing. Inhale for four. One. Two. Three. Four. Hold for four. One. Two. Three. Four. Exhale for four. One. Two. Three. Four. Hold for four. One. Two. Three. Four. Repeat that cycle. Keep the breath smooth, not forced. Each cycle is like drawing a calm square with your breath.",
      },
      {
        id: "grounding_54321",
        title: "5-4-3-2-1 Grounding",
        subtitle: "Come back to the present",
        minutes: 2,
        steps: [
          "5 things you can see.",
          "4 things you can feel.",
          "3 things you can hear.",
          "2 things you can smell.",
          "1 thing you can taste.",
        ],
        narration:
          "Let’s ground you using your senses. Look around and name five things you can see. Take your time. Now, four things you can feel, like your feet, your clothes, the air. Now, three things you can hear. Two things you can smell. One thing you can taste, or take a sip of water. Good. You are here, in this moment. You handled that.",
      },
      {
        id: "stretch_neck",
        title: "Neck & Shoulder Release",
        subtitle: "Drop tension safely",
        minutes: 4,
        steps: [
          "Shoulder rolls back 10 times.",
          "Shoulder rolls forward 10 times.",
          "Ear to shoulder: 20s each side.",
          "Slow head turns: 10s each side.",
          "Finish with 3 slow breaths.",
        ],
        note: "No pain. Keep it gentle.",
        narration:
          "Let’s release neck and shoulder tension. Roll your shoulders back slowly ten times. Now roll them forward ten times. Good. Gently tilt your right ear toward your right shoulder and breathe. Hold for twenty seconds. Now switch sides. Next, turn your head slowly to the right and pause. Now left and pause. Finish with three slow breaths. If anything hurts, stop and keep the movement smaller.",
      },
      {
        id: "micro_walk",
        title: "2-Minute Micro Walk",
        subtitle: "Reset with light movement",
        minutes: 2,
        steps: [
          "Stand up and walk slowly.",
          "Relax jaw and shoulders.",
          "Notice 3 objects clearly.",
          "Breathe naturally while walking.",
          "Stop and take one deep breath.",
        ],
        narration:
          "Stand up if you can. We’re doing a short micro walk. Walk slowly in your space. Let your jaw unclench and your shoulders drop. As you walk, notice three objects and describe them in your mind. Keep breathing normally. After two minutes, stop and take one comfortable deep breath. Well done.",
      },
      {
        id: "gratitude_30s",
        title: "30-Second Gratitude",
        subtitle: "A quick mood lift",
        minutes: 1,
        steps: [
          "Think of one small thing that was okay.",
          "Name why it mattered.",
          "Breathe and feel it for 5 seconds.",
        ],
        narration:
          "Think of one small thing that was okay today. It can be tiny. Now say why it mattered, even a little. Take a slow breath in. As you breathe out, stay with that feeling for five seconds. That’s enough. You did a good thing for your mind.",
      },

      // ---- 19 more (total 25) ----
      {
        id: "self_compassion_break",
        title: "Self-Compassion Break",
        subtitle: "Replace harsh self-talk",
        minutes: 2,
        steps: [
          "Hand on chest.",
          "Say: “This is a tough moment.”",
          "Say: “I’m not alone.”",
          "Say: “May I be kind to myself.”",
          "3 slow breaths.",
        ],
        narration:
          "Place a hand on your chest. Take a slow breath. Say: this is a tough moment. Say: I’m not alone in this, many people struggle sometimes. Say: may I be kind to myself right now. Take three slow breaths. Let your body feel that softness, even if it’s small.",
      },
      {
        id: "name_the_feeling",
        title: "Name the Feeling",
        subtitle: "Make emotions lighter",
        minutes: 1,
        steps: [
          "Pause and scan your body.",
          "Name the emotion in one word.",
          "Rate it 0 to 10.",
          "Say: “This is a feeling, not a fact.”",
        ],
        narration:
          "Pause. Scan your body. Name the emotion in one word. Sad. Tired. Anxious. Numb. Now rate it from zero to ten. Say: this is a feeling, not a fact. Feelings move. You don’t have to solve it right now.",
      },
      {
        id: "tiny_task",
        title: "One Tiny Task",
        subtitle: "Build momentum gently",
        minutes: 3,
        steps: [
          "Pick one task that takes 1–3 minutes.",
          "Do only that task.",
          "Stop when done.",
          "Acknowledge the win.",
        ],
        narration:
          "Pick one tiny task that takes one to three minutes. Something small. Start now and do only that. When it’s done, stop. Take a breath and say: I did one thing. That matters. Small wins rebuild momentum.",
      },
      {
        id: "hydration_pause",
        title: "Hydration Pause",
        subtitle: "Support your body",
        minutes: 1,
        steps: [
          "Take a few sips of water.",
          "Notice the sensation.",
          "Slow exhale.",
        ],
        narration:
          "Take a few slow sips of water. Notice the temperature and how it feels. Now breathe out slowly. This is a small reset for your body and brain.",
      },
      {
        id: "sunlight_minute",
        title: "One Minute of Light",
        subtitle: "Gentle energy support",
        minutes: 2,
        steps: [
          "Stand near daylight.",
          "Look toward light (not at sun).",
          "Breathe for 60 seconds.",
        ],
        narration:
          "If it’s safe, stand near a window or outside. Don’t stare at the sun. Just let daylight reach you. Breathe normally for one minute. You’re giving your brain a gentle daytime signal.",
      },
      {
        id: "music_anchor",
        title: "Music Anchor",
        subtitle: "Shift mood with sound",
        minutes: 5,
        steps: [
          "Pick one calming song.",
          "Sit with feet on floor.",
          "Notice 3 sounds in the music.",
          "Slow your breathing slightly.",
        ],
        narration:
          "Play one song that feels calming. Sit with your feet on the floor. Notice three sounds: a beat, a voice, an instrument. Let your breathing slow a little. Let the music carry you for a moment.",
      },
      {
        id: "progressive_muscle_short",
        title: "Mini Muscle Relaxation",
        subtitle: "Release tension fast",
        minutes: 3,
        steps: [
          "Clench fists 3 seconds, release.",
          "Tighten shoulders 3 seconds, release.",
          "Press feet 3 seconds, release.",
          "Two slow breaths.",
        ],
        narration:
          "Clench your fists for three seconds. One. Two. Three. Release. Tighten your shoulders for three. One. Two. Three. Release. Press your feet into the floor for three. One. Two. Three. Release. Now take two slow breaths. Notice any small drop in tension.",
      },
      {
        id: "4_7_8",
        title: "4-7-8 Breathing",
        subtitle: "Long exhale calm",
        minutes: 2,
        steps: ["Inhale 4.", "Hold 7.", "Exhale 8.", "Repeat 3–4 times."],
        note: "If it’s too strong, use 3-5-6.",
        narration:
          "Inhale for four. One. Two. Three. Four. Hold for seven. One. Two. Three. Four. Five. Six. Seven. Exhale for eight. One. Two. Three. Four. Five. Six. Seven. Eight. Repeat. Keep it gentle. The long exhale helps your body settle.",
      },
      {
        id: "temperature_reset",
        title: "Cool Water Reset",
        subtitle: "Fast sensory reset",
        minutes: 1,
        steps: [
          "Cool cloth or water on face.",
          "Slow breathing 20 seconds.",
          "Return to neutral.",
        ],
        narration:
          "Use cool water or a cool cloth on your face if you can. Breathe slowly for twenty seconds. Focus only on the sensation. This can help your mind come back to the present.",
      },
      {
        id: "thought_defusion",
        title: "Thought Defusion",
        subtitle: "Create space from thoughts",
        minutes: 2,
        steps: [
          "Notice a heavy thought.",
          "Say: “I’m having the thought that…”",
          "Repeat 3 times.",
          "Return to breathing.",
        ],
        narration:
          "Notice one heavy thought. Now say: I’m having the thought that… and then the thought. Repeat that three times, slowly. This helps you step back from it. Now return to your breathing for a few seconds.",
      },
      {
        id: "worry_container",
        title: "Worry Container",
        subtitle: "Park worries for later",
        minutes: 3,
        steps: [
          "Imagine a box or jar.",
          "Place one worry inside.",
          "Close the lid.",
          "Say: “Later, not now.”",
        ],
        narration:
          "Imagine a strong box in front of you. Take one worry and place it inside. Close the lid. Set it aside. Say: later, not now. You’re giving yourself a break, not ignoring it forever.",
      },
      {
        id: "three_okay_things",
        title: "Three Okay Things",
        subtitle: "Train attention gently",
        minutes: 3,
        steps: [
          "Name 3 things that were okay.",
          "Keep them small.",
          "Say why each mattered.",
        ],
        narration:
          "Name three things that were okay today. Small counts. For each one, say why it mattered, even a little. This is not forcing positivity. It’s widening your attention.",
      },
      {
        id: "hand_trace_breath",
        title: "Hand-Trace Breathing",
        subtitle: "Breath with a simple focus",
        minutes: 3,
        steps: [
          "Hold one hand open.",
          "Trace up a finger while inhaling.",
          "Trace down while exhaling.",
          "Repeat for all 5 fingers.",
        ],
        narration:
          "Hold one hand open. With your other finger, trace up your thumb as you inhale. Trace down as you exhale. Inhale going up, exhale going down. Move finger by finger. This keeps your mind steady while your breath slows.",
      },
      {
        id: "comfort_posture",
        title: "Comfort Posture Reset",
        subtitle: "Signal safety to your body",
        minutes: 2,
        steps: ["Back supported.", "Jaw unclenched.", "5 slower exhales."],
        narration:
          "Sit with your back supported. Unclench your jaw. Drop your shoulders. Take five breaths where the exhale is a little longer than the inhale. Let your body get the message: we can soften now.",
      },
      {
        id: "mini_plan_hour",
        title: "Mini Plan for Next Hour",
        subtitle: "Reduce uncertainty",
        minutes: 3,
        steps: [
          "Pick 1 need.",
          "Pick 1 tiny action.",
          "Pick 1 break.",
          "Stop there.",
        ],
        narration:
          "Let’s plan only the next hour. Choose one need: water, food, rest, shower, a message to someone. Choose one tiny action to support it. Then choose one break. That’s enough for now. One hour at a time.",
      },
      {
        id: "phone_pause",
        title: "2-Minute Phone Pause",
        subtitle: "Stop doom scrolling",
        minutes: 2,
        steps: [
          "Phone face down.",
          "10 slow breaths.",
          "Choose next action on purpose.",
        ],
        narration:
          "Put your phone face down for two minutes. Take ten slow breaths. One. Two. Three. Keep going. After ten, choose what you want to do next on purpose. You’re taking your attention back.",
      },
      {
        id: "gentle_phrase",
        title: "Gentle Phrase",
        subtitle: "Supportive self-talk",
        minutes: 1,
        steps: ["Pick a phrase.", "Repeat it 5 times slowly."],
        narration:
          "Pick one phrase that feels believable. For example: one step is enough. Repeat it five times, slowly. You’re building a calmer inner voice.",
      },
      {
        id: "safe_place",
        title: "Safe Place Visualization",
        subtitle: "Mental comfort",
        minutes: 4,
        steps: [
          "Picture a safe place.",
          "Notice 3 sights.",
          "2 sounds.",
          "1 comforting feeling.",
        ],
        narration:
          "Close your eyes or soften your gaze. Imagine a safe place. Notice three things you see there. Notice two sounds. Notice one comforting feeling in your body. Stay for a few breaths. You can return here anytime.",
      },
      {
        id: "values_tiny_action",
        title: "Values Tiny Action",
        subtitle: "Reconnect to meaning",
        minutes: 3,
        steps: [
          "Pick a value.",
          "Choose one tiny action that matches it.",
          "Do it today if possible.",
        ],
        narration:
          "Pick one value that matters to you, even on hard days: health, learning, kindness, family, growth. Now choose one tiny action that matches it. Small actions keep you connected to who you are.",
      },
      {
        id: "breath_counting",
        title: "Breath Counting",
        subtitle: "Quiet the mind gently",
        minutes: 3,
        steps: [
          "Count breaths to 10.",
          "Restart at 1.",
          "If you lose count, restart calmly.",
        ],
        narration:
          "Count your breaths. Inhale and exhale is one. Next breath is two. Go up to ten, then start again at one. If you lose track, just return to one without judging yourself.",
      },
      {
        id: "kind_message",
        title: "Send a Kind Message",
        subtitle: "Small connection",
        minutes: 2,
        steps: [
          "Pick someone you trust.",
          "Send: “Thinking of you.”",
          "No long talk needed.",
        ],
        narration:
          "Choose one person you trust. Send a short message like: thinking of you. You don’t need a long conversation. Small connection can reduce isolation.",
      },
      {
        id: "warm_drink",
        title: "Warm Drink Pause",
        subtitle: "Soothing sensory comfort",
        minutes: 5,
        steps: [
          "Make a warm drink.",
          "Feel warmth in hands.",
          "Take 5 slow sips.",
          "Slow exhale.",
        ],
        narration:
          "Make a warm drink if you can. Hold the cup and feel the warmth in your hands. Take five slow sips. After each sip, breathe out slowly. Let the warmth and the pace calm you.",
      },
    ],
    [],
  );

  // -----------------------------
  // Daily rotation: only 3 shown, changes when Toronto date changes
  // -----------------------------
  async function loadDailyQuickActions() {
    const today = formatTorontoDateKey(new Date());

    const storedDate = await AsyncStorage.getItem(
      STORAGE_KEYS.DAILY_EXERCISES_DATE,
    );
    const storedIdsRaw = await AsyncStorage.getItem(
      STORAGE_KEYS.DAILY_EXERCISES_IDS,
    );

    if (storedDate === today && storedIdsRaw) {
      try {
        const ids = JSON.parse(storedIdsRaw) as string[];
        const map = new Map(EXERCISES.map((e) => [e.id, e]));
        const picked = ids
          .map((id) => map.get(id))
          .filter(Boolean) as Exercise[];
        if (picked.length === 3) {
          setQuickActions(picked);
          return;
        }
      } catch {
        // fall through to regenerate
      }
    }

    const shuffled = seededShuffle(EXERCISES, `daily-${today}`);
    const picked = shuffled.slice(0, 3);
    setQuickActions(picked);

    await AsyncStorage.setItem(STORAGE_KEYS.DAILY_EXERCISES_DATE, today).catch(
      () => {},
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.DAILY_EXERCISES_IDS,
      JSON.stringify(picked.map((p) => p.id)),
    ).catch(() => {});
  }

  // Load stored stats + load today's 3 actions
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.WEEK_MINUTES);
        const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        if (!mounted) return;
        setWeekMinutesMap(parsed || {});
      } catch {
        if (!mounted) return;
        setWeekMinutesMap({});
      } finally {
        if (mounted) setLoadingStats(false);
      }

      if (mounted) await loadDailyQuickActions();
    })();

    return () => {
      mounted = false;
    };
  }, [EXERCISES]);

  // Greeting updates (Toronto time) + detect date change while app is open
  useEffect(() => {
    let lastDate = formatTorontoDateKey(new Date());

    const tick = async () => {
      setGreeting(getGreetingToronto(new Date()));
      const nowDate = formatTorontoDateKey(new Date());
      if (nowDate !== lastDate) {
        lastDate = nowDate;
        await loadDailyQuickActions();
      }
    };

    tick();
    const id = setInterval(() => {
      tick().catch(() => {});
    }, 60 * 1000);

    return () => clearInterval(id);
  }, []);

  // stop voice whenever modal closes / changes exercise
  useEffect(() => {
    stopVoice();
  }, [selectedExercise?.id]);

  // Session tracking
  async function addSessionMinutesIfAny(endTs: number) {
    const startTs = sessionStartRef.current;
    sessionStartRef.current = null;
    if (!startTs) return;

    const ms = endTs - startTs;
    if (ms <= 0) return;

    const minutes = ms / 60000;
    const todayKey = formatTorontoDateKey(new Date());

    setWeekMinutesMap((prev) => {
      const next = { ...prev };
      next[todayKey] = (next[todayKey] || 0) + minutes;
      AsyncStorage.setItem(
        STORAGE_KEYS.WEEK_MINUTES,
        JSON.stringify(next),
      ).catch(() => {});
      return next;
    });

    AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_DATE, todayKey).catch(
      () => {},
    );
  }

  useEffect(() => {
    sessionStartRef.current = Date.now();

    const onAppStateChange = async (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        prevState === "active" &&
        (nextState === "inactive" || nextState === "background")
      ) {
        stopVoice();
        await addSessionMinutesIfAny(Date.now());
      }

      if (
        (prevState === "inactive" || prevState === "background") &&
        nextState === "active"
      ) {
        sessionStartRef.current = Date.now();
        // on returning, refresh daily list if date changed
        await loadDailyQuickActions();
      }
    };

    const sub = AppState.addEventListener("change", onAppStateChange);

    return () => {
      stopVoice();
      addSessionMinutesIfAny(Date.now()).catch(() => {});
      sub.remove();
    };
  }, [EXERCISES]);

  // Weekly chart data (last 7 days)
  const weekDays = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(now.getTime() - (6 - idx) * 24 * 60 * 60 * 1000);
      const key = formatTorontoDateKey(d);
      const label = new Intl.DateTimeFormat("en-US", {
        timeZone: TORONTO_TZ,
        weekday: "short",
      }).format(d);
      return { key, label };
    });
  }, [weekMinutesMap]);

  const weekMinutes = useMemo(
    () => weekDays.map(({ key }) => weekMinutesMap[key] || 0),
    [weekDays, weekMinutesMap],
  );

  const totalWeekMinutes = useMemo(
    () => weekMinutes.reduce((a, b) => a + b, 0),
    [weekMinutes],
  );

  const chartHeights = useMemo(() => {
    const maxMin = Math.max(...weekMinutes, 1);
    return weekMinutes.map((m) =>
      clamp(Math.round((m / maxMin) * 92 + 18), 18, 110),
    );
  }, [weekMinutes]);

  // streak: consecutive days ending today where minutes >= 1
  const streak = useMemo(() => {
    const now = new Date();
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = formatTorontoDateKey(d);
      const mins = weekMinutesMap[key] || 0;
      if (mins >= 1) count++;
      else break;
    }
    return count;
  }, [weekMinutesMap]);

  function formatMinutes(mins: number) {
    const total = Math.round(mins);
    if (total < 60) return `${total}m`;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  const streakText = useMemo(() => {
    if (streak <= 0) return "Start a streak";
    if (streak === 1) return "1 day streak";
    return `${streak} day streak`;
  }, [streak]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#10B981", "#059669"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.title}>How are you feeling?</Text>

        <View style={styles.headerRow}>
          <View style={styles.streakContainer}>
            <TrendingUp size={16} color="#FFF" />
            <Text style={styles.streakText}>{streakText}</Text>
          </View>

          <View style={styles.weekChip}>
            <Timer size={16} color="#FFF" />
            <Text style={styles.weekChipText}>
              {loadingStats
                ? "…"
                : `${formatMinutes(totalWeekMinutes)} this week`}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!!todaysQuote && (
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>{todaysQuote}</Text>
          </View>
        )}

        {moodFeedback && (
          <View style={styles.moodToast}>
            <Sparkles size={16} color="#111827" />
            <Text style={styles.moodToastText}>{moodFeedback.message}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rate your mood</Text>
          <Text style={styles.cardSubtitle}>Quick daily check-in</Text>

          <View style={styles.moodGrid}>
            <TouchableOpacity
              style={[styles.moodButton, styles.moodButtonGreat]}
              onPress={() => sendMood("great")}
              activeOpacity={0.85}
            >
              <Smile size={32} color="#10B981" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Great</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moodButton, styles.moodButtonGood]}
              onPress={() => sendMood("good")}
              activeOpacity={0.85}
            >
              <Heart size={32} color="#3B82F6" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Good</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moodButton, styles.moodButtonOkay]}
              onPress={() => sendMood("okay")}
              activeOpacity={0.85}
            >
              <Meh size={32} color="#F59E0B" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Okay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moodButton, styles.moodButtonLow]}
              onPress={() => sendMood("low")}
              activeOpacity={0.85}
            >
              <Frown size={32} color="#EF4444" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Low</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* THIS WEEK */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>This Week</Text>
              <Text style={styles.cardSubtitle}>
                Time spent on this screen (auto-tracked)
              </Text>
            </View>

            <View style={styles.kpiPill}>
              <Sparkles size={14} color="#10B981" />
              <Text style={styles.kpiText}>
                {loadingStats ? "…" : formatMinutes(totalWeekMinutes)}
              </Text>
            </View>
          </View>

          <View style={styles.weekChart}>
            {weekDays.map((d, index) => (
              <View key={d.key} style={styles.dayColumn}>
                <View style={styles.barContainer}>
                  <View
                    style={[
                      styles.bar,
                      { height: loadingStats ? 22 : chartHeights[index] },
                    ]}
                  />
                </View>
                <Text style={styles.dayLabel}>{d.label}</Text>
                <Text style={styles.dayValue}>
                  {loadingStats ? "—" : formatMinutes(weekMinutes[index])}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* QUICK ACTIONS (ONLY 3, rotates daily) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Quick Actions</Text>
              <Text style={styles.cardSubtitle}>
                Today’s 3 exercises (auto-rotates daily)
              </Text>
            </View>
          </View>

          {quickActions.map((ex) => (
            <TouchableOpacity
              key={ex.id}
              style={styles.actionButton}
              activeOpacity={0.85}
              onPress={() => setSelectedExercise(ex)}
            >
              <View style={styles.actionLeft}>
                <View style={styles.actionIcon}>
                  <Timer size={16} color="#111827" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionText}>{ex.title}</Text>
                  <Text style={styles.actionSubtext}>
                    {ex.minutes} min • {ex.subtitle}
                  </Text>
                </View>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* EXERCISE MODAL */}
      <Modal
        visible={!!selectedExercise}
        transparent
        animationType="fade"
        onRequestClose={() => {
          stopVoice();
          setSelectedExercise(null);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            stopVoice();
            setSelectedExercise(null);
          }}
        />

        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{selectedExercise?.title}</Text>
              <Text style={styles.modalSubtitle}>
                {selectedExercise?.minutes} min • {selectedExercise?.subtitle}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                stopVoice();
                setSelectedExercise(null);
              }}
              style={styles.closeBtn}
              activeOpacity={0.85}
            >
              <X size={18} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalDivider} />

          {/* Voice controls (reads hidden narration only) */}
          <View style={styles.voiceRow}>
            <TouchableOpacity
              onPress={() => toggleVoice(selectedExercise)}
              style={[
                styles.voiceBtn,
                isSpeaking ? styles.voiceBtnActive : null,
              ]}
              activeOpacity={0.85}
            >
              {isSpeaking ? (
                <VolumeX size={18} color="#FFF" />
              ) : (
                <Volume2 size={18} color="#111827" />
              )}
              <Text
                style={[
                  styles.voiceBtnText,
                  isSpeaking ? styles.voiceBtnTextActive : null,
                ]}
              >
                {isSpeaking ? "Stop voice" : "Play voice guide"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.voiceHint}>
              Voice stops if you close this popup.
            </Text>
          </View>

          <ScrollView
            style={{ maxHeight: 320 }}
            showsVerticalScrollIndicator={false}
          >
            {(selectedExercise?.steps || []).map((s, idx) => (
              <View
                key={`${selectedExercise?.id}-${idx}`}
                style={styles.stepRow}
              >
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                </View>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}

            {selectedExercise?.note ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>{selectedExercise.note}</Text>
              </View>
            ) : null}

            <View style={{ height: 10 }} />
          </ScrollView>

          <TouchableOpacity
            style={styles.modalDone}
            onPress={() => {
              stopVoice();
              setSelectedExercise(null);
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.modalDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },

  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  greeting: { fontSize: 16, color: "#FFF", opacity: 0.9 },
  title: { fontSize: 28, fontWeight: "700", color: "#FFF", marginTop: 6 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 10,
  },

  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff33",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  streakText: { color: "#FFF", marginLeft: 6, fontWeight: "600" },

  quoteCard: {
    marginTop: 20,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: "#EFF6FF",
  },
  quoteText: {
    fontSize: 18,
    lineHeight: 24,
    color: "#1F2937",
    fontStyle: "italic",
    textAlign: "center",
  },

  moodToast: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#ECFDF3",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
    marginBottom: 4,
  },
  moodToastText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#166534",
  },

  weekChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff22",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  weekChipText: { color: "#FFF", marginLeft: 6, fontWeight: "600" },

  content: { paddingHorizontal: 20 },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  cardTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  cardSubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },

  kpiPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
  },
  kpiText: { fontSize: 13, fontWeight: "700", color: "#065F46" },

  moodGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
  },

  moodButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  moodButtonGreat: { backgroundColor: "#D1FAE5" },
  moodButtonGood: { backgroundColor: "#DBEAFE" },
  moodButtonOkay: { backgroundColor: "#FEF3C7" },
  moodButtonLow: { backgroundColor: "#FEE2E2" },

  moodLabel: { marginTop: 8, fontWeight: "700", color: "#374151" },

  weekChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 170,
    marginTop: 16,
    gap: 8,
  },

  dayColumn: { flex: 1, alignItems: "center" },

  barContainer: {
    flex: 1,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },

  bar: {
    width: 26,
    backgroundColor: "#10B981",
    borderRadius: 10,
  },

  dayLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    fontWeight: "700",
  },

  dayValue: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
    fontWeight: "600",
  },

  actionButton: {
    backgroundColor: "#F9FAFB",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },

  actionText: { fontSize: 15, color: "#111827", fontWeight: "800" },

  actionSubtext: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
    fontWeight: "600",
  },

  actionChevron: { fontSize: 22, color: "#9CA3AF", marginLeft: 10 },

  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  modalCard: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "16%",
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },

  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  modalSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "600",
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  modalDivider: {
    height: 1,
    backgroundColor: "#EEF2F7",
    marginTop: 14,
    marginBottom: 12,
  },

  voiceRow: { marginBottom: 10 },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
  },
  voiceBtnActive: { backgroundColor: "#10B981" },
  voiceBtnText: { fontSize: 13, fontWeight: "900", color: "#111827" },
  voiceBtnTextActive: { color: "#FFF" },
  voiceHint: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
    fontWeight: "600",
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },

  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    marginTop: 1,
  },

  stepBadgeText: { fontSize: 12, fontWeight: "900", color: "#065F46" },

  stepText: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    lineHeight: 20,
  },

  noteBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginTop: 4,
  },

  noteText: {
    fontSize: 13,
    color: "#92400E",
    fontWeight: "700",
    lineHeight: 18,
  },

  modalDone: {
    marginTop: 10,
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  modalDoneText: { color: "#FFF", fontSize: 15, fontWeight: "900" },
});
