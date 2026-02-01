// app/(tabs)/two.tsx
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Hash,
  LogIn,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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

type Group = {
  id: string;
  name: string;
  description: string;
  code: string; // join code
  members: number;
  category: "Anxiety" | "Stress" | "Study" | "Fitness" | "General";
  isMember: boolean;
};

type ChatMessage = {
  id: string;
  text: string;
  sender: "me" | "other";
  senderName: string;
  ts: number;
};

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function makeJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const BRAND_GREEN = "#10B981";
const BRAND_PURPLE = "#8B5CF6";
const CARD_BG = "#FFFFFF";
const PAGE_BG = "#F9FAFB";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const TEXT = "#111827";

export default function TabTwoScreen() {
  // --- View state: list vs chat
  const [view, setView] = useState<"groups" | "chat">("groups");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // --- Search
  const [query, setQuery] = useState("");

  // --- Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // --- Create group form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState<Group["category"]>("General");

  // --- Join form
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // --- Groups (local mock state)
  const [groups, setGroups] = useState<Group[]>([
    {
      id: "g1",
      name: "Calm Corner",
      description:
        "A small, supportive space for daily check-ins and grounding.",
      code: "CALM22",
      members: 18,
      category: "Anxiety",
      isMember: true,
    },
    {
      id: "g2",
      name: "Study & Stress Reset",
      description: "For students managing deadlines, burnout, and routines.",
      code: "STUDY7",
      members: 31,
      category: "Study",
      isMember: true,
    },
    {
      id: "g3",
      name: "Mindful Movers",
      description: "Motivation, gentle workouts, and habits that stick.",
      code: "MOVE88",
      members: 24,
      category: "Fitness",
      isMember: false,
    },
    {
      id: "g4",
      name: "Evening Wind-Down",
      description: "Night check-ins, sleep routines, and calming prompts.",
      code: "SLEEP9",
      members: 12,
      category: "Stress",
      isMember: false,
    },
  ]);

  // --- Chat state (local mock per group)
  const [messagesByGroup, setMessagesByGroup] = useState<
    Record<string, ChatMessage[]>
  >({
    g1: [
      {
        id: "m1",
        text: "Welcome to Calm Corner 🌿 Take a breath. How are you feeling today?",
        sender: "other",
        senderName: "Moderator",
        ts: Date.now() - 1000 * 60 * 18,
      },
      {
        id: "m2",
        text: "I’m a bit anxious. Trying to calm down before a presentation.",
        sender: "other",
        senderName: "Riya",
        ts: Date.now() - 1000 * 60 * 10,
      },
      {
        id: "m3",
        text: "You got this. Try 4-4-6 breathing with me: inhale 4, hold 4, exhale 6.",
        sender: "me",
        senderName: "You",
        ts: Date.now() - 1000 * 60 * 8,
      },
    ],
    g2: [
      {
        id: "m1",
        text: "Quick check-in: what’s one small task you can finish in 15 minutes?",
        sender: "other",
        senderName: "Aarav",
        ts: Date.now() - 1000 * 60 * 25,
      },
    ],
  });

  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) ?? null,
    [groups, activeGroupId],
  );

  const activeMessages = useMemo(() => {
    if (!activeGroupId) return [];
    return messagesByGroup[activeGroupId] ?? [];
  }, [messagesByGroup, activeGroupId]);

  // scroll to bottom when messages change
  useEffect(() => {
    if (view !== "chat") return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [activeMessages.length, view]);

  // ---- filter groups
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

  // ---- actions
  function openGroupChat(groupId: string) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;

    // require membership for chat
    if (!g.isMember) {
      setJoinError(null);
      setJoinCode(g.code);
      setShowJoin(true);
      return;
    }

    setActiveGroupId(groupId);
    setView("chat");
  }

  function handleBackFromChat() {
    setView("groups");
    setActiveGroupId(null);
    setDraft("");
    setIsTyping(false);
  }

  function sendMessage() {
    if (!activeGroupId) return;
    const text = draft.trim();
    if (!text) return;

    const newMsg: ChatMessage = {
      id: `${Date.now()}`,
      text,
      sender: "me",
      senderName: "You",
      ts: Date.now(),
    };

    setMessagesByGroup((prev) => {
      const arr = prev[activeGroupId] ?? [];
      return { ...prev, [activeGroupId]: [...arr, newMsg] };
    });

    setDraft("");

    // simulate someone typing + reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const reply: ChatMessage = {
        id: `${Date.now() + 1}`,
        text:
          text.toLowerCase().includes("help") ||
          text.toLowerCase().includes("stress")
            ? "I hear you. Want to try a quick grounding: name 5 things you can see, 4 you can feel, 3 you can hear?"
            : "Thanks for sharing. You’re not alone here.",
        sender: "other",
        senderName: "Peer",
        ts: Date.now(),
      };
      setMessagesByGroup((prev) => {
        const arr = prev[activeGroupId] ?? [];
        return { ...prev, [activeGroupId]: [...arr, reply] };
      });
    }, 900);
  }

  function joinGroupByCode(code: string) {
    setJoinError(null);
    setJoinLoading(true);

    setTimeout(() => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) {
        setJoinLoading(false);
        setJoinError("Enter a valid code.");
        return;
      }

      const match = groups.find((g) => g.code.toUpperCase() === normalized);
      if (!match) {
        setJoinLoading(false);
        setJoinError("No group found for this code.");
        return;
      }

      // mark as member
      setGroups((prev) =>
        prev.map((g) =>
          g.id === match.id
            ? { ...g, isMember: true, members: g.members + 1 }
            : g,
        ),
      );

      setJoinLoading(false);
      setShowJoin(false);
      setJoinCode("");

      // go to chat
      setActiveGroupId(match.id);
      setView("chat");
    }, 650);
  }

  function createGroup() {
    const name = newName.trim();
    const desc = newDesc.trim();

    if (!name) return;

    const id = `g_${Date.now()}`;
    const code = makeJoinCode();

    const g: Group = {
      id,
      name,
      description: desc || "A peer space for support and check-ins.",
      code,
      members: 1,
      category: newCategory,
      isMember: true,
    };

    setGroups((prev) => [g, ...prev]);
    setMessagesByGroup((prev) => ({
      ...prev,
      [id]: [
        {
          id: "welcome",
          text: `Welcome to ${name}. Start with a gentle check-in: how are you today?`,
          sender: "other",
          senderName: "Moderator",
          ts: Date.now(),
        },
      ],
    }));

    setShowCreate(false);
    setNewName("");
    setNewDesc("");
    setNewCategory("General");

    setActiveGroupId(id);
    setView("chat");
  }

  // ------------------ UI: Chat ------------------
  if (view === "chat" && activeGroup) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={handleBackFromChat} style={styles.backBtn}>
            <ArrowLeft size={20} color={TEXT} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.chatTitle}>{activeGroup.name}</Text>
            <View style={styles.chatSubRow}>
              <Users size={14} color={MUTED} />
              <Text style={styles.chatSubText}>
                {activeGroup.members} members
              </Text>
              <View style={styles.dot} />
              <Hash size={14} color={MUTED} />
              <Text style={styles.chatSubText}>{activeGroup.code}</Text>
            </View>
          </View>

          <View style={styles.safeBadge}>
            <ShieldCheck size={16} color={BRAND_GREEN} />
            <Text style={styles.safeBadgeText}>Safe space</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={activeMessages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          renderItem={({ item }) => {
            const mine = item.sender === "me";
            return (
              <View
                style={[
                  styles.msgRow,
                  mine ? styles.msgRowRight : styles.msgRowLeft,
                ]}
              >
                {!mine && (
                  <Text style={styles.senderName}>{item.senderName}</Text>
                )}
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMe : styles.bubbleOther,
                  ]}
                >
                  <Text
                    style={[
                      styles.msgText,
                      mine ? styles.msgTextMe : styles.msgTextOther,
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.msgTime,
                    mine ? styles.msgTimeRight : styles.msgTimeLeft,
                  ]}
                >
                  {formatTime(item.ts)}
                </Text>
              </View>
            );
          }}
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingRow}>
                <View style={styles.typingBubble}>
                  <ActivityIndicator size="small" color={BRAND_PURPLE} />
                  <Text style={styles.typingText}>Someone is typing…</Text>
                </View>
              </View>
            ) : null
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
          style={styles.composerWrap}
        >
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
            />
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!draft.trim()}
              style={[styles.sendBtn, !draft.trim() && { opacity: 0.5 }]}
            >
              <Send size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.composerHint}>
            Be kind. No personal info. If you feel unsafe, contact local
            emergency services.
          </Text>
        </KeyboardAvoidingView>
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
                Supportive group chats with people who get it.
              </Text>
            </View>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.pill}>
              <Sparkles size={14} color="#FFFFFF" />
              <Text style={styles.pillText}>Small, calm spaces</Text>
            </View>
            <View style={styles.pill}>
              <ShieldCheck size={14} color="#FFFFFF" />
              <Text style={styles.pillText}>Respect-first</Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => setShowCreate(true)}
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
                  onPress={() => openGroupChat(g.id)}
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

        {/* Create Modal */}
        <Modal
          visible={showCreate}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCreate(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create a group</Text>
                <Pressable
                  onPress={() => setShowCreate(false)}
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
                <Text style={styles.modalPrimaryBtnText}>
                  Create & enter chat
                </Text>
              </TouchableOpacity>

              <Text style={styles.modalFoot}>
                We’ll generate a join code automatically. You can share it with
                your team.
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
                placeholder="e.g., CALM22"
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
                  <Text style={styles.modalPrimaryBtnText}>
                    Join & enter chat
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.modalFoot}>
                Joining adds you to the group and opens the chat.
              </Text>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAGE_BG },

  // Hero
  hero: {
    margin: 16,
    borderRadius: 18,
    padding: 16,
  },
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

  // Sections
  sectionTitle: {
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 16,
    color: TEXT,
    fontSize: 16,
    fontWeight: "800",
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
  categoryChipActive: {
    borderColor: "#D1FAE5",
    backgroundColor: "#ECFDF5",
  },
  categoryChipText: { color: MUTED, fontWeight: "800", fontSize: 12 },
  categoryChipTextActive: { color: "#047857" },

  // Chat
  chatHeader: {
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
  chatTitle: { color: TEXT, fontWeight: "900", fontSize: 16 },
  chatSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  chatSubText: { color: MUTED, fontSize: 12, fontWeight: "700" },
  safeBadge: {
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
  safeBadgeText: { color: "#047857", fontWeight: "900", fontSize: 12 },

  msgRow: { marginBottom: 12, maxWidth: "88%" },
  msgRowLeft: { alignSelf: "flex-start" },
  msgRowRight: { alignSelf: "flex-end" },
  senderName: {
    color: MUTED,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 6,
    marginLeft: 6,
  },

  bubble: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16 },
  bubbleOther: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderTopLeftRadius: 6,
  },
  bubbleMe: {
    backgroundColor: BRAND_PURPLE,
    borderTopRightRadius: 6,
  },
  msgText: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  msgTextOther: { color: TEXT },
  msgTextMe: { color: "#fff" },

  msgTime: { color: "#9CA3AF", fontSize: 11, fontWeight: "700", marginTop: 4 },
  msgTimeLeft: { marginLeft: 8 },
  msgTimeRight: { marginRight: 8, textAlign: "right" },

  typingRow: { alignSelf: "flex-start", marginTop: 2 },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  typingText: { color: MUTED, fontWeight: "800", fontSize: 12 },

  composerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === "ios" ? 18 : 12,
  },
  composer: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: BRAND_PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  composerHint: {
    marginTop: 8,
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
});
