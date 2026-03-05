// app/(tabs)/Peerchat.tsx
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Hash,
  LogIn,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * POST-BASED VERSION (NON-LOCAL)
 *
 * THIS FILE IS ALIGNED TO YOUR ACTUAL API GATEWAY ROUTES:
 *   GET    /groups
 *   POST   /groups
 *   POST   /join
 *   GET    /{groupId}/posts
 *   POST   /{groupId}/posts
 *   POST   /{groupId}/posts/{postId}/react
 */

type Group = {
  id: string;
  name: string;
  description: string;
  code: string;
  members: number;
  category: "Anxiety" | "Stress" | "Study" | "Fitness" | "General";
  isMember: boolean;
};

type Post = {
  id: string;
  groupId: string;
  authorName: string;
  text: string;
  createdAt: number;
  reactions?: Record<string, number>;
  myReactions?: string[];
};

type SupportReply = {
  id: string;
  label: string;
  category:
    | "Empathy"
    | "Encouragement"
    | "Grounding"
    | "Practical"
    | "Perspective"
    | "Boundaries";
  message: string;
};

// Brand
const BRAND_GREEN = "#10B981";
const BRAND_PURPLE = "#8B5CF6";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#F9FAFB";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const TEXT = "#111827";

// API base
const API_BASE_URL =
  "https://61zb01mm87.execute-api.us-east-1.amazonaws.com/prod";

// IMPORTANT: build routes in ONE place to avoid any accidental /groups prefix
const routes = {
  groups: () => `/groups`,
  createGroup: () => `/groups`,
  join: () => `/join`,
  posts: (groupId: string) => `/${encodeURIComponent(groupId)}/posts`,
  react: (groupId: string, postId: string) =>
    `/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(postId)}/react`,
};

async function api<T>(
  path: string,
  method: "GET" | "POST",
  body?: any,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: any = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok) {
    const msg =
      typeof json?.message === "string"
        ? json.message
        : typeof json?.error === "string"
          ? json.error
          : "Request failed.";
    throw new Error(msg);
  }

  return json as T;
}

// Helpers
function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function makeJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeCategory(v: any): Group["category"] {
  const allowed: Group["category"][] = [
    "Anxiety",
    "Stress",
    "Study",
    "Fitness",
    "General",
  ];
  if (typeof v === "string" && allowed.includes(v as any))
    return v as Group["category"];
  return "General";
}

// Backend can return {members: []} or {members: number}
function normalizeGroup(raw: any): Group {
  const membersCount =
    typeof raw?.members === "number"
      ? raw.members
      : Array.isArray(raw?.members)
        ? raw.members.length
        : 0;

  return {
    id: String(raw?.id ?? ""),
    name: String(raw?.name ?? "Unnamed group"),
    description: String(raw?.description ?? "Peer support space"),
    code: String(raw?.code ?? ""),
    members: membersCount,
    category: normalizeCategory(raw?.category),
    // If backend doesn’t track membership, default to true so you can open group feed
    isMember: typeof raw?.isMember === "boolean" ? raw.isMember : true,
  };
}

function normalizePost(raw: any, groupId: string): Post {
  return {
    id: String(raw?.id ?? ""),
    groupId,
    authorName: String(raw?.authorName ?? "Anonymous"),
    text: String(raw?.text ?? ""),
    createdAt: typeof raw?.createdAt === "number" ? raw.createdAt : Date.now(),
    reactions:
      raw?.reactions && typeof raw.reactions === "object" ? raw.reactions : {},
    myReactions: Array.isArray(raw?.myReactions) ? raw.myReactions : [],
  };
}

// Deterministic shuffle
function hashStringToInt(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seededShuffle<T>(arr: T[], seed: number) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const j = Math.abs(s) % (i + 1);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// Predefined replies
const SUPPORT_REPLIES: SupportReply[] = [
  {
    id: "e1",
    category: "Empathy",
    label: "I hear you",
    message: "I hear you. That sounds really hard.",
  },
  {
    id: "e2",
    category: "Empathy",
    label: "That makes sense",
    message: "That makes sense. Anyone would feel a lot in that situation.",
  },
  {
    id: "e3",
    category: "Empathy",
    label: "Thanks for sharing",
    message: "Thanks for sharing this here. You didn’t have to carry it alone.",
  },
  {
    id: "e4",
    category: "Empathy",
    label: "You’re not alone",
    message: "You’re not alone. I’m here with you.",
  },
  {
    id: "e5",
    category: "Empathy",
    label: "That sounds exhausting",
    message: "That sounds exhausting. No wonder you feel drained.",
  },
  {
    id: "e6",
    category: "Empathy",
    label: "I get it",
    message:
      "I get it. Sometimes things feel heavy even when you try your best.",
  },
  {
    id: "e7",
    category: "Empathy",
    label: "Valid feelings",
    message: "Your feelings are valid. You don’t have to justify them.",
  },
  {
    id: "e8",
    category: "Empathy",
    label: "I’m listening",
    message: "I’m listening. Take your time.",
  },

  {
    id: "c1",
    category: "Encouragement",
    label: "One step",
    message: "One step at a time. You don’t have to solve it all today.",
  },
  {
    id: "c2",
    category: "Encouragement",
    label: "Small win",
    message: "Even posting here is a small win. Proud of you for that.",
  },
  {
    id: "c3",
    category: "Encouragement",
    label: "You can do today",
    message: "You can get through today. Just the next small part.",
  },
  {
    id: "c4",
    category: "Encouragement",
    label: "Gentle with yourself",
    message:
      "Be gentle with yourself. You’re doing your best with what you have.",
  },
  {
    id: "c5",
    category: "Encouragement",
    label: "Keep going",
    message: "Keep going. You’ve handled hard days before.",
  },
  {
    id: "c6",
    category: "Encouragement",
    label: "You matter",
    message: "You matter, and what you’re feeling matters.",
  },
  {
    id: "c7",
    category: "Encouragement",
    label: "Proud of you",
    message: "I’m proud of you for being honest about this.",
  },
  {
    id: "c8",
    category: "Encouragement",
    label: "Rooting for you",
    message:
      "I’m rooting for you. You’ve got more strength than you feel right now.",
  },

  {
    id: "g1",
    category: "Grounding",
    label: "4-6 breathing",
    message: "Try this: inhale 4 seconds, exhale 6 seconds. Repeat 5 times.",
  },
  {
    id: "g2",
    category: "Grounding",
    label: "Box breathing",
    message: "Inhale 4, hold 4, exhale 4, hold 4. Repeat 4 rounds.",
  },
  {
    id: "g3",
    category: "Grounding",
    label: "5-4-3-2-1",
    message: "Grounding: 5 see, 4 feel, 3 hear, 2 smell, 1 taste.",
  },
  {
    id: "g4",
    category: "Grounding",
    label: "Relax jaw",
    message:
      "Drop your shoulders, unclench your jaw, and take one slow breath.",
  },
  {
    id: "g5",
    category: "Grounding",
    label: "Feet on floor",
    message: "Put both feet on the floor. Press down gently for 10 seconds.",
  },
  {
    id: "g6",
    category: "Grounding",
    label: "Name 3 objects",
    message: "Look around and name 3 objects. Describe their color/shape.",
  },
  {
    id: "g7",
    category: "Grounding",
    label: "Cold reset",
    message:
      "If you can, hold something cold for 20–30 seconds to reset your focus.",
  },
  {
    id: "g8",
    category: "Grounding",
    label: "Slow exhale",
    message:
      "Make your exhale longer than your inhale. It helps your body calm down.",
  },

  {
    id: "p1",
    category: "Practical",
    label: "One tiny step",
    message: "What’s one tiny step you can do in 5 minutes that helps?",
  },
  {
    id: "p2",
    category: "Practical",
    label: "Write it out",
    message:
      "Try writing what’s stressing you, then circle what you can control.",
  },
  {
    id: "p3",
    category: "Practical",
    label: "Basic needs check",
    message: "Quick check: water, food, fresh air, rest. Any one missing?",
  },
  {
    id: "p4",
    category: "Practical",
    label: "Timer method",
    message:
      "Set a 10-minute timer and do the easiest part. Stop when it ends.",
  },
  {
    id: "p5",
    category: "Practical",
    label: "Ask for help",
    message:
      "If possible, ask someone: “Can you help me with one small thing?”",
  },
  {
    id: "p6",
    category: "Practical",
    label: "Break it down",
    message: "Can you break it into 3 small steps? Just pick step 1 for now.",
  },
  {
    id: "p7",
    category: "Practical",
    label: "Take a walk",
    message: "A 2-minute walk or stretch can shift your mind a little.",
  },
  {
    id: "p8",
    category: "Practical",
    label: "Plan next hour",
    message: "Plan only the next hour, not the whole day. Keep it simple.",
  },

  {
    id: "r1",
    category: "Perspective",
    label: "This can shift",
    message:
      "This feeling is real, but it can shift. It won’t stay the same forever.",
  },
  {
    id: "r2",
    category: "Perspective",
    label: "Name the feeling",
    message: "If you name the feeling, it can lose some power.",
  },
  {
    id: "r3",
    category: "Perspective",
    label: "Not a flaw",
    message: "What you’re facing is heavy. It’s not a character flaw.",
  },
  {
    id: "r4",
    category: "Perspective",
    label: "What would you tell a friend?",
    message: "If a friend posted this, what would you say to them?",
  },
  {
    id: "r5",
    category: "Perspective",
    label: "Zoom out gently",
    message: "What’s one thing that would make this 1% easier?",
  },
  {
    id: "r6",
    category: "Perspective",
    label: "Temporary moment",
    message: "This is a tough moment, not your whole story.",
  },
  {
    id: "r7",
    category: "Perspective",
    label: "You’re learning",
    message: "It’s okay to struggle. You’re learning how to handle real life.",
  },
  {
    id: "r8",
    category: "Perspective",
    label: "You’re doing a lot",
    message: "You’re doing a lot. Give yourself credit for carrying this.",
  },

  {
    id: "b1",
    category: "Boundaries",
    label: "It’s okay to pause",
    message:
      "It’s okay to pause. You don’t have to reply to everything right away.",
  },
  {
    id: "b2",
    category: "Boundaries",
    label: "Protect energy",
    message: "Protect your energy today. One boundary you can set?",
  },
  {
    id: "b3",
    category: "Boundaries",
    label: "Step away 2 minutes",
    message: "If it’s overwhelming, step away for 2 minutes. That’s allowed.",
  },
  {
    id: "b4",
    category: "Boundaries",
    label: "Say no kindly",
    message: "It’s okay to say no kindly. Your limits matter.",
  },
  {
    id: "b5",
    category: "Boundaries",
    label: "Less pressure",
    message:
      "Try lowering pressure: “I only need to do the minimum right now.”",
  },
  {
    id: "b6",
    category: "Boundaries",
    label: "Phone break",
    message: "If scrolling is making it worse, a short phone break can help.",
  },
  {
    id: "b7",
    category: "Boundaries",
    label: "Slow pace",
    message: "Slow your pace for a moment. Your body needs time to catch up.",
  },
  {
    id: "b8",
    category: "Boundaries",
    label: "Choose safe people",
    message: "Share with people who feel safe. You don’t owe everyone access.",
  },
];

function getRepliesForPost(postId: string) {
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = hashStringToInt(`${dayKey}:${postId}`);
  const shuffled = seededShuffle(SUPPORT_REPLIES, seed);

  const pick = (cat: SupportReply["category"], n: number) =>
    shuffled.filter((r) => r.category === cat).slice(0, n);

  const base = [
    ...pick("Empathy", 4),
    ...pick("Encouragement", 4),
    ...pick("Grounding", 4),
    ...pick("Practical", 4),
    ...pick("Perspective", 4),
    ...pick("Boundaries", 4),
  ];

  const extra = shuffled
    .filter((r) => !base.find((b) => b.id === r.id))
    .slice(0, 18);

  return seededShuffle([...base, ...extra], seed + 999);
}

export default function Peerchat() {
  const [view, setView] = useState<"groups" | "feed" | "post">("groups");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState<Group["category"]>("General");

  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);

  const [postDraft, setPostDraft] = useState("");
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const activeGroup = useMemo(() => {
    if (!activeGroupId) return null;
    return groups.find((g) => g.id === activeGroupId) ?? null;
  }, [groups, activeGroupId]);

  const activePost = useMemo(() => {
    if (!activePostId) return null;
    return posts.find((p) => p.id === activePostId) ?? null;
  }, [posts, activePostId]);

  // Load groups
  useEffect(() => {
    let alive = true;
    (async () => {
      setGroupsLoading(true);
      setGroupsError(null);
      try {
        const data = await api<{ groups: any[] }>(routes.groups(), "GET");
        if (!alive) return;
        const mapped = (data?.groups ?? [])
          .filter((g) => g && g.id)
          .map((g) => normalizeGroup(g));
        setGroups(mapped);
      } catch (e: any) {
        if (!alive) return;
        setGroupsError(e?.message ?? "Failed to load groups.");
      } finally {
        if (!alive) return;
        setGroupsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => {
      return (
        g.name.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q)
      );
    });
  }, [groups, query]);

  // CRITICAL: posts route is /{groupId}/posts (NOT /groups/{groupId}/posts)
  async function loadPosts(groupId: string) {
    setPostsLoading(true);
    setPostsError(null);
    try {
      const data = await api<{ posts: any[] }>(routes.posts(groupId), "GET");
      const mapped = (data?.posts ?? [])
        .filter((p) => p && p.id)
        .map((p) => normalizePost(p, groupId));
      setPosts(mapped);
    } catch (e: any) {
      setPosts([]);
      setPostsError(e?.message ?? "Request failed.");
    } finally {
      setPostsLoading(false);
    }
  }

  function openGroupFeed(groupId: string) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;

    if (!g.isMember) {
      setJoinError(null);
      setJoinCode(g.code);
      setShowJoin(true);
      return;
    }

    setActiveGroupId(groupId);
    setActivePostId(null);
    setView("feed");
    loadPosts(groupId);
  }

  function backFromFeed() {
    setView("groups");
    setActiveGroupId(null);
    setActivePostId(null);
    setPosts([]);
    setPostsError(null);
    setPostError(null);
  }

  function openPost(postId: string) {
    setActivePostId(postId);
    setView("post");
  }

  function backFromPost() {
    setView("feed");
    setActivePostId(null);
  }

  async function createGroup() {
    const name = newName.trim();
    const desc = newDesc.trim();
    if (!name) return;

    try {
      const code = makeJoinCode();
      const raw = await api<any>(routes.createGroup(), "POST", {
        name,
        description: desc || "Peer support space",
        category: newCategory,
        code,
      });

      const returned = raw?.group ? raw.group : raw;
      const g = normalizeGroup(returned);
      if (!g.id) throw new Error("Backend did not return a valid group id.");

      setGroups((prev) => [g, ...prev]);

      setShowCreateGroup(false);
      setNewName("");
      setNewDesc("");
      setNewCategory("General");

      setActiveGroupId(g.id);
      setView("feed");
      await loadPosts(g.id);
      setToast("Group created.");
    } catch (e: any) {
      setToast(e?.message ?? "Failed to create group.");
    }
  }

  async function joinGroupByCode(codeRaw: string) {
    setJoinError(null);
    setJoinLoading(true);

    try {
      const normalized = codeRaw.trim().toUpperCase();
      if (!normalized) throw new Error("Enter a valid code.");

      const raw = await api<any>(routes.join(), "POST", { code: normalized });

      const groupId = String(raw?.groupId ?? raw?.id ?? "");
      if (!groupId) throw new Error("Join failed.");

      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, isMember: true, members: g.members + 1 }
            : g,
        ),
      );

      setShowJoin(false);
      setJoinCode("");
      setActiveGroupId(groupId);
      setView("feed");
      await loadPosts(groupId);
      setToast("Joined.");
    } catch (e: any) {
      setJoinError(e?.message ?? "Join failed.");
    } finally {
      setJoinLoading(false);
    }
  }

  async function submitPost() {
    if (!activeGroupId) return;
    const text = postDraft.trim();
    if (!text) return;

    setPostError(null);
    setPostLoading(true);

    try {
      // CRITICAL: create post is POST /{groupId}/posts
      const raw = await api<any>(routes.posts(activeGroupId), "POST", {
        text,
        authorName: "You",
      });

      const returned = raw?.post ? raw.post : raw;
      const p = normalizePost(returned, activeGroupId);
      if (!p.id) throw new Error("Backend did not return a valid post id.");

      setPosts((prev) => [p, ...prev]);
      setPostDraft("");
      setShowCreatePost(false);
      setToast("Posted.");
    } catch (e: any) {
      setPostError(e?.message ?? "Request failed.");
    } finally {
      setPostLoading(false);
    }
  }

  async function sendPredefinedReply(replyId: string) {
    if (!activeGroupId || !activePostId) return;

    try {
      // CRITICAL: react is POST /{groupId}/posts/{postId}/react
      const raw = await api<any>(
        routes.react(activeGroupId, activePostId),
        "POST",
        {
          replyId,
        },
      );

      const returned = raw?.post ? raw.post : raw;
      const updated = normalizePost(returned, activeGroupId);
      if (!updated.id) throw new Error("Backend did not return updated post.");

      setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setToast("Sent support.");
    } catch (e: any) {
      setToast(e?.message ?? "Request failed.");
    }
  }

  // ------------------ UI: Post Detail ------------------
  if (view === "post" && activeGroup && activePost) {
    const repliesToShow = getRepliesForPost(activePost.id);
    const reactions = activePost.reactions ?? {};
    const my = new Set(activePost.myReactions ?? []);

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={backFromPost} style={styles.backBtn}>
            <ArrowLeft size={20} color={TEXT} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{activeGroup.name}</Text>
            <View style={styles.headerSubRow}>
              <Users size={14} color={MUTED} />
              <Text style={styles.headerSubText}>
                {activeGroup.members} members
              </Text>
              <View style={styles.dot} />
              <Hash size={14} color={MUTED} />
              <Text style={styles.headerSubText}>{activeGroup.code}</Text>
            </View>
          </View>

          <View style={styles.badge}>
            <ShieldCheck size={16} color={BRAND_GREEN} />
            <Text style={styles.badgeText}>Guided replies</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 22 }}>
          <View style={styles.postCard}>
            <View style={styles.postTop}>
              <Text style={styles.postAuthor}>{activePost.authorName}</Text>
              <Text style={styles.postTime}>
                {formatTime(activePost.createdAt)}
              </Text>
            </View>
            <Text style={styles.postText}>{activePost.text}</Text>
          </View>

          <Text style={styles.sectionTitle}>Supportive replies</Text>
          <Text style={styles.helperText}>
            Pick one. You’ll see lots of options so it doesn’t feel controlled.
          </Text>

          <View style={styles.replyGrid}>
            {repliesToShow.map((r) => {
              const count = reactions[r.id] ?? 0;
              const pressed = my.has(r.id);

              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => sendPredefinedReply(r.id)}
                  style={[
                    styles.replyChip,
                    pressed && {
                      borderColor: "#C7D2FE",
                      backgroundColor: "#EEF2FF",
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.replyLabel,
                        pressed && { color: BRAND_PURPLE },
                      ]}
                    >
                      {r.label}
                    </Text>
                    <Text style={styles.replyMeta}>{r.category}</Text>
                  </View>

                  <View style={styles.replyCountPill}>
                    <Text style={styles.replyCountText}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.safetyNote}>
            <Text style={styles.safetyNoteTitle}>Safety note</Text>
            <Text style={styles.safetyNoteText}>
              If you feel unsafe or in immediate danger, contact local emergency
              services or a trusted adult.
            </Text>
          </View>
        </ScrollView>

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  // ------------------ UI: Group Feed ------------------
  if (view === "feed" && activeGroup) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={backFromFeed} style={styles.backBtn}>
            <ArrowLeft size={20} color={TEXT} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{activeGroup.name}</Text>
            <View style={styles.headerSubRow}>
              <Users size={14} color={MUTED} />
              <Text style={styles.headerSubText}>
                {activeGroup.members} members
              </Text>
              <View style={styles.dot} />
              <Hash size={14} color={MUTED} />
              <Text style={styles.headerSubText}>{activeGroup.code}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.createPostBtn}
            onPress={() => {
              setPostError(null);
              setPostDraft("");
              setShowCreatePost(true);
            }}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.createPostBtnText}>Post</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
          <View style={styles.feedHeaderRow}>
            <View style={styles.badge}>
              <ShieldCheck size={16} color={BRAND_GREEN} />
              <Text style={styles.badgeText}>Moderated</Text>
            </View>
            <View style={styles.badge}>
              <Sparkles size={16} color={BRAND_PURPLE} />
              <Text style={styles.badgeText}>Support-first</Text>
            </View>
          </View>

          {postsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={BRAND_PURPLE} />
              <Text style={styles.loadingText}>Loading posts…</Text>
            </View>
          ) : postsError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{postsError}</Text>
              <TouchableOpacity
                onPress={() => loadPosts(activeGroup.id)}
                style={styles.retryBtn}
              >
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <MessageCircle size={18} color={MUTED} />
              <Text style={styles.emptyText}>
                No posts yet. Create the first check-in.
              </Text>
            </View>
          ) : (
            posts.map((p) => {
              const totalSupports = Object.values(p.reactions ?? {}).reduce(
                (a, b) => a + b,
                0,
              );
              return (
                <TouchableOpacity
                  key={p.id}
                  style={styles.postCard}
                  onPress={() => openPost(p.id)}
                >
                  <View style={styles.postTop}>
                    <Text style={styles.postAuthor}>{p.authorName}</Text>
                    <Text style={styles.postTime}>
                      {formatTime(p.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.postText} numberOfLines={4}>
                    {p.text}
                  </Text>

                  <View style={styles.postFooter}>
                    <Text style={styles.postFooterText}>
                      Tap to open replies
                    </Text>
                    <View style={styles.postFooterPill}>
                      <Text style={styles.postFooterPillText}>
                        {totalSupports} supports
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Create Post Modal */}
        <Modal
          visible={showCreatePost}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCreatePost(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New post</Text>
                <Pressable
                  onPress={() => setShowCreatePost(false)}
                  style={styles.modalClose}
                >
                  <X size={18} color={TEXT} />
                </Pressable>
              </View>

              <Text style={styles.modalLabel}>What’s on your mind?</Text>
              <TextInput
                value={postDraft}
                onChangeText={(v) => {
                  setPostError(null);
                  setPostDraft(v);
                }}
                placeholder="Share a check-in…"
                placeholderTextColor="#9CA3AF"
                style={[styles.modalInput, { height: 120 }]}
                multiline
              />

              {postError ? (
                <Text style={styles.modalError}>{postError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.modalPrimaryBtn,
                  (!postDraft.trim() || postLoading) && { opacity: 0.6 },
                ]}
                disabled={!postDraft.trim() || postLoading}
                onPress={submitPost}
              >
                {postLoading ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.modalPrimaryBtnText}>Posting…</Text>
                  </View>
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Post</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.modalFoot}>
                Posts are moderated before publishing. Replies are predefined to
                keep the space safe.
              </Text>
            </View>
          </View>
        </Modal>

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  // ------------------ UI: Groups ------------------
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 28 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[BRAND_GREEN, "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Users size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Peer Groups</Text>
              <Text style={styles.heroSub}>
                Post-based support with guided replies.
              </Text>
            </View>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.pill}>
              <Sparkles size={14} color="#FFFFFF" />
              <Text style={styles.pillText}>Variety of replies</Text>
            </View>
            <View style={styles.pill}>
              <ShieldCheck size={14} color="#FFFFFF" />
              <Text style={styles.pillText}>Moderated posts</Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => setShowCreateGroup(true)}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Create group</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => setShowJoin(true)}
            >
              <LogIn size={16} color={TEXT} />
              <Text style={styles.secondaryActionText}>Join with code</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Search size={18} color={MUTED} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search groups, categories, codes…"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>

        {groupsLoading ? (
          <View style={{ padding: 16 }}>
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={BRAND_PURPLE} />
              <Text style={styles.loadingText}>Loading groups…</Text>
            </View>
          </View>
        ) : groupsError ? (
          <View style={{ padding: 16 }}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{groupsError}</Text>
            </View>
          </View>
        ) : null}

        {/* My Groups */}
        <Text style={styles.sectionTitle}>Your groups</Text>
        <View style={{ paddingHorizontal: 16 }}>
          {filteredGroups.filter((g) => g.isMember).length === 0 ? (
            <View style={styles.emptyCard}>
              <MessageCircle size={18} color={MUTED} />
              <Text style={styles.emptyText}>
                No groups yet. Create one or join with a code.
              </Text>
            </View>
          ) : (
            filteredGroups
              .filter((g) => g.isMember)
              .map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.groupCard}
                  onPress={() => openGroupFeed(g.id)}
                >
                  <View style={styles.groupCardTop}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{g.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.groupDesc}>{g.description}</Text>
                  <View style={styles.groupMetaRow}>
                    <Users size={14} color={MUTED} />
                    <Text style={styles.groupMeta}>{g.members} members</Text>
                    <View style={styles.dot} />
                    <Hash size={14} color={MUTED} />
                    <Text style={styles.groupMeta}>{g.code}</Text>
                  </View>
                </TouchableOpacity>
              ))
          )}
        </View>

        {/* Discover */}
        <Text style={styles.sectionTitle}>Discover</Text>
        <View style={{ paddingHorizontal: 16 }}>
          {filteredGroups
            .filter((g) => !g.isMember)
            .map((g) => (
              <View key={g.id} style={styles.discoverCard}>
                <View style={{ flex: 1 }}>
                  <View style={styles.groupCardTop}>
                    <Text style={styles.groupName}>{g.name}</Text>
                    <View
                      style={[
                        styles.tag,
                        { borderColor: "#EDE9FE", backgroundColor: "#F5F3FF" },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: BRAND_PURPLE }]}>
                        {g.category}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.groupDesc}>{g.description}</Text>
                  <View style={styles.groupMetaRow}>
                    <Users size={14} color={MUTED} />
                    <Text style={styles.groupMeta}>{g.members} members</Text>
                    <View style={styles.dot} />
                    <Hash size={14} color={MUTED} />
                    <Text style={styles.groupMeta}>{g.code}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.joinBtn}
                  onPress={() => {
                    setJoinError(null);
                    setJoinCode(g.code);
                    setShowJoin(true);
                  }}
                >
                  <Text style={styles.joinBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
            ))}
        </View>

        {/* Create Group Modal */}
        <Modal
          visible={showCreateGroup}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCreateGroup(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create a group</Text>
                <Pressable
                  onPress={() => setShowCreateGroup(false)}
                  style={styles.modalClose}
                >
                  <X size={18} color={TEXT} />
                </Pressable>
              </View>

              <Text style={styles.modalLabel}>Group name</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g., Calm After Class"
                placeholderTextColor="#9CA3AF"
                style={styles.modalInput}
              />

              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="A small space for daily check-ins…"
                placeholderTextColor="#9CA3AF"
                style={[styles.modalInput, { height: 84 }]}
                multiline
              />

              <Text style={styles.modalLabel}>Category</Text>
              <View style={styles.categoryRow}>
                {(
                  ["General", "Anxiety", "Stress", "Study", "Fitness"] as const
                ).map((c) => {
                  const active = c === newCategory;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setNewCategory(c)}
                      style={[
                        styles.categoryChip,
                        active && styles.categoryChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          active && styles.categoryChipTextActive,
                        ]}
                      >
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.modalPrimaryBtn,
                  !newName.trim() && { opacity: 0.5 },
                ]}
                disabled={!newName.trim()}
                onPress={createGroup}
              >
                <Text style={styles.modalPrimaryBtnText}>Create</Text>
              </TouchableOpacity>

              <Text style={styles.modalFoot}>
                We’ll generate a join code automatically. You can share it with
                your friends.
              </Text>
            </View>
          </View>
        </Modal>

        {/* Join Modal */}
        <Modal
          visible={showJoin}
          transparent
          animationType="fade"
          onRequestClose={() => setShowJoin(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Join with code</Text>
                <Pressable
                  onPress={() => setShowJoin(false)}
                  style={styles.modalClose}
                >
                  <X size={18} color={TEXT} />
                </Pressable>
              </View>

              <Text style={styles.modalLabel}>Enter group code</Text>
              <TextInput
                value={joinCode}
                onChangeText={(v) => {
                  setJoinError(null);
                  setJoinCode(v);
                }}
                placeholder="e.g., HS9D"
                placeholderTextColor="#9CA3AF"
                style={styles.modalInput}
                autoCapitalize="characters"
              />

              {joinError ? (
                <Text style={styles.modalError}>{joinError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.modalPrimaryBtn,
                  joinLoading && { opacity: 0.7 },
                ]}
                onPress={() => joinGroupByCode(joinCode)}
                disabled={joinLoading}
              >
                {joinLoading ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.modalPrimaryBtnText}>Joining…</Text>
                  </View>
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Join</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.modalFoot}>
                Joining adds you to the group and opens the feed.
              </Text>
            </View>
          </View>
        </Modal>

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAGE_BG },

  // Hero
  hero: { margin: 16, borderRadius: 18, padding: 16 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.92)", marginTop: 2, fontSize: 13 },

  heroRow: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  heroActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryAction: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryActionText: { color: "#fff", fontWeight: "800" },
  secondaryAction: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionText: { color: TEXT, fontWeight: "800" },

  // Search
  searchWrap: {
    marginHorizontal: 16,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: { flex: 1, color: TEXT, fontSize: 14 },

  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: 16,
    fontWeight: "800",
  },
  helperText: {
    paddingHorizontal: 16,
    marginTop: -6,
    marginBottom: 12,
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },

  // Cards
  groupCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  discoverCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  groupCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  groupName: { flex: 1, color: TEXT, fontSize: 15, fontWeight: "800" },
  groupDesc: { color: MUTED, marginTop: 6, lineHeight: 18, fontSize: 13 },
  groupMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupMeta: { color: MUTED, fontSize: 12, fontWeight: "600" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" },

  tag: {
    borderWidth: 1,
    borderColor: "#D1FAE5",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: { color: "#047857", fontWeight: "800", fontSize: 12 },

  joinBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: BRAND_PURPLE,
  },
  joinBtnText: { color: "#fff", fontWeight: "800" },

  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  emptyText: { color: MUTED, fontSize: 13, lineHeight: 18, flex: 1 },

  // Header
  header: {
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: TEXT, fontWeight: "900", fontSize: 16 },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  headerSubText: { color: MUTED, fontSize: 12, fontWeight: "700" },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: { color: "#047857", fontWeight: "900", fontSize: 12 },

  feedHeaderRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },

  createPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: BRAND_PURPLE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  createPostBtnText: { color: "#fff", fontWeight: "900" },

  // Posts
  postCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  postTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postAuthor: { color: TEXT, fontWeight: "900", fontSize: 13 },
  postTime: { color: "#9CA3AF", fontSize: 12, fontWeight: "800" },
  postText: {
    color: TEXT,
    marginTop: 10,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
  },
  postFooter: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postFooterText: { color: MUTED, fontWeight: "800", fontSize: 12 },
  postFooterPill: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  postFooterPillText: { color: MUTED, fontWeight: "900", fontSize: 12 },

  // Replies
  replyGrid: { paddingHorizontal: 16, gap: 10 },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  replyLabel: { color: TEXT, fontWeight: "900", fontSize: 13 },
  replyMeta: { color: MUTED, fontWeight: "800", fontSize: 11, marginTop: 2 },
  replyCountPill: {
    minWidth: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
  },
  replyCountText: { color: MUTED, fontWeight: "900", fontSize: 12 },

  // Safety note
  safetyNote: {
    marginTop: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
  },
  safetyNoteTitle: { color: TEXT, fontWeight: "900", marginBottom: 6 },
  safetyNoteText: {
    color: MUTED,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
  },

  // Loading/error
  loadingBox: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: { color: MUTED, fontWeight: "800", fontSize: 13 },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 14,
    gap: 10,
  },
  errorText: { color: "#991B1B", fontWeight: "800" },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#991B1B",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryBtnText: { color: "#fff", fontWeight: "900" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { color: TEXT, fontWeight: "900", fontSize: 16 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalLabel: {
    marginTop: 12,
    marginBottom: 6,
    color: TEXT,
    fontWeight: "800",
    fontSize: 13,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT,
  },
  modalPrimaryBtn: {
    marginTop: 14,
    backgroundColor: BRAND_GREEN,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalPrimaryBtnText: { color: "#fff", fontWeight: "900" },
  modalFoot: { marginTop: 10, color: MUTED, fontSize: 12, lineHeight: 16 },
  modalError: {
    marginTop: 8,
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 12,
  },

  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  categoryChip: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FAFB",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  categoryChipActive: { borderColor: "#D1FAE5", backgroundColor: "#ECFDF5" },
  categoryChipText: { color: MUTED, fontWeight: "800", fontSize: 12 },
  categoryChipTextActive: { color: "#047857" },

  // Toast
  toast: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: Platform.OS === "ios" ? 20 : 14,
    backgroundColor: "rgba(17,24,39,0.92)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  toastText: { color: "#fff", fontWeight: "900" },
});
