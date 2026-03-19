// // app/(tabs)/Peerchat.tsx  — Real group chat with anonymous names + moderation
// import { auth } from "@/constants/firebase";
// import { LinearGradient } from "expo-linear-gradient";
// import {
//   ArrowLeft,
//   Hash,
//   LogIn,
//   Plus,
//   Search,
//   Send,
//   ShieldCheck,
//   Sparkles,
//   Users,
//   X,
// } from "lucide-react-native";
// import React, { useCallback, useEffect, useRef, useState } from "react";
// import {
//   ActivityIndicator,
//   FlatList,
//   KeyboardAvoidingView,
//   Modal,
//   Platform,
//   Pressable,
//   SafeAreaView,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";

// // ── Types ─────────────────────────────────────────────────────────────────────
// type Group = {
//   id: string;
//   name: string;
//   description: string;
//   code: string;
//   members: number;
//   category: string;
//   isMember: boolean;
// };

// type ChatMsg = {
//   id: string;
//   groupId: string;
//   authorName: string;
//   text: string;
//   createdAt: number;
// };

// // ── Config ────────────────────────────────────────────────────────────────────
// const API = "https://61zb01mm87.execute-api.us-east-1.amazonaws.com/prod";
// const GREEN = "#10B981";
// const PURPLE = "#8B5CF6";
// const WHITE = "#FFFFFF";
// const BG = "#F9FAFB";
// const MUTED = "#6B7280";
// const BORDER = "#E5E7EB";
// const TEXT = "#111827";
// const RED = "#EF4444";
// const POLL_MS = 6000; // poll for new messages every 6 s

// // ── Helpers ───────────────────────────────────────────────────────────────────
// function getUid() {
//   try {
//     return auth.currentUser?.uid ?? null;
//   } catch {
//     return null;
//   }
// }

// async function apiFetch<T>(
//   path: string,
//   method: "GET" | "POST",
//   body?: any,
// ): Promise<T> {
//   const res = await fetch(`${API}${path}`, {
//     method,
//     headers: { "Content-Type": "application/json" },
//     body: body ? JSON.stringify(body) : undefined,
//   });
//   let json: any = {};
//   try {
//     json = await res.json();
//   } catch {}
//   if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
//   return json as T;
// }

// function normGroup(r: any): Group {
//   return {
//     id: String(r?.id ?? ""),
//     name: String(r?.name ?? "Unnamed"),
//     description: String(r?.description ?? ""),
//     code: String(r?.code ?? "").toUpperCase(),
//     members: Number(r?.members ?? 0),
//     category: String(r?.category ?? "General"),
//     isMember: !!r?.isMember,
//   };
// }

// function normMsg(r: any, gid: string): ChatMsg {
//   return {
//     id: String(r?.id ?? Math.random().toString(36)),
//     groupId: gid,
//     authorName: String(r?.authorName ?? "Anonymous"),
//     text: String(r?.text ?? ""),
//     createdAt: Number(r?.createdAt ?? Date.now()),
//   };
// }

// function fmtTime(n: number) {
//   const d = new Date(n);
//   return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
// }

// function makeCode() {
//   const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
//   return Array.from(
//     { length: 4 },
//     () => c[Math.floor(Math.random() * c.length)],
//   ).join("");
// }

// // ── Component ─────────────────────────────────────────────────────────────────
// export default function Peerchat() {
//   const [view, setView] = useState<"groups" | "chat">("groups");
//   const [activeGroup, setActiveGroup] = useState<Group | null>(null);

//   // Groups state
//   const [groups, setGroups] = useState<Group[]>([]);
//   const [gLoad, setGLoad] = useState(false);
//   const [gErr, setGErr] = useState<string | null>(null);
//   const [query, setQuery] = useState("");

//   // Create group
//   const [showCreate, setShowCreate] = useState(false);
//   const [cName, setCName] = useState("");
//   const [cDesc, setCDesc] = useState("");
//   const [cCat, setCCat] = useState("General");

//   // Join group
//   const [showJoin, setShowJoin] = useState(false);
//   const [joinCode, setJoinCode] = useState("");
//   const [joinLoad, setJoinLoad] = useState(false);
//   const [joinErr, setJoinErr] = useState<string | null>(null);

//   // Chat state
//   const [messages, setMessages] = useState<ChatMsg[]>([]);
//   const [mLoad, setMLoad] = useState(false);
//   const [mErr, setMErr] = useState<string | null>(null);
//   const [draft, setDraft] = useState("");
//   const [sendLoad, setSendLoad] = useState(false);
//   const [sendErr, setSendErr] = useState<string | null>(null);

//   const [toast, setToast] = useState<string | null>(null);
//   const flatRef = useRef<FlatList>(null);
//   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
//   const lastTsRef = useRef<number>(0);

//   useEffect(() => {
//     if (!toast) return;
//     const t = setTimeout(() => setToast(null), 3000);
//     return () => clearTimeout(t);
//   }, [toast]);

//   // Load groups on mount
//   useEffect(() => {
//     loadGroups();
//   }, []);

//   async function loadGroups() {
//     setGLoad(true);
//     setGErr(null);
//     try {
//       const uid = getUid();
//       const d = await apiFetch<{ groups: any[] }>(
//         `/groups${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`,
//         "GET",
//       );
//       setGroups((d.groups ?? []).filter((g) => g?.id).map(normGroup));
//     } catch (e: any) {
//       setGErr(e.message ?? "Failed to load groups");
//     } finally {
//       setGLoad(false);
//     }
//   }

//   // ── Chat polling ────────────────────────────────────────────────────────────
//   const fetchMessages = useCallback(
//     async (groupId: string, initial = false) => {
//       if (initial) {
//         setMLoad(true);
//         setMErr(null);
//         setMessages([]);
//       }
//       try {
//         const d = await apiFetch<{ messages: any[] }>(
//           `/${groupId}/messages?limit=60`,
//           "GET",
//         );
//         const msgs = (d.messages ?? []).map((m) => normMsg(m, groupId));
//         setMessages(msgs);
//         if (msgs.length > 0)
//           lastTsRef.current = msgs[msgs.length - 1].createdAt;
//         if (initial)
//           setTimeout(
//             () => flatRef.current?.scrollToEnd({ animated: false }),
//             100,
//           );
//       } catch (e: any) {
//         if (initial) setMErr(e.message ?? "Failed to load messages");
//       } finally {
//         if (initial) setMLoad(false);
//       }
//     },
//     [],
//   );

//   function startPolling(groupId: string) {
//     stopPolling();
//     pollRef.current = setInterval(() => fetchMessages(groupId), POLL_MS);
//   }

//   function stopPolling() {
//     if (pollRef.current) {
//       clearInterval(pollRef.current);
//       pollRef.current = null;
//     }
//   }

//   function openChat(g: Group) {
//     setActiveGroup(g);
//     setView("chat");
//     setDraft("");
//     setSendErr(null);
//     fetchMessages(g.id, true);
//     startPolling(g.id);
//   }

//   function backToGroups() {
//     stopPolling();
//     setView("groups");
//     setActiveGroup(null);
//     setMessages([]);
//     setMErr(null);
//     setDraft("");
//     setSendErr(null);
//     loadGroups();
//   }

//   useEffect(() => () => stopPolling(), []);

//   // ── Create group ────────────────────────────────────────────────────────────
//   async function createGroup() {
//     if (!cName.trim()) return;
//     try {
//       const uid = getUid();
//       const r = await apiFetch<any>("/groups", "POST", {
//         uid,
//         name: cName.trim(),
//         description: cDesc.trim() || "Peer support space",
//         category: cCat,
//         code: makeCode(),
//       });
//       const g = normGroup(r?.group ?? r);
//       if (!g.id) throw new Error("Invalid response");
//       setGroups((prev) => [g, ...prev]);
//       setShowCreate(false);
//       setCName("");
//       setCDesc("");
//       setCCat("General");
//       openChat(g);
//       setToast("Group created!");
//     } catch (e: any) {
//       setToast(e.message ?? "Failed to create group");
//     }
//   }

//   // ── Join group ──────────────────────────────────────────────────────────────
//   async function joinGroup() {
//     setJoinErr(null);
//     setJoinLoad(true);
//     try {
//       const code = joinCode.trim().toUpperCase();
//       if (!code) throw new Error("Enter a join code");
//       const uid = getUid();
//       const r = await apiFetch<any>("/join", "POST", { uid, code });
//       const gid = String(r?.groupId ?? "");
//       if (!gid) throw new Error("Join failed");

//       setGroups((prev) =>
//         prev.map((g) =>
//           g.id === gid ? { ...g, isMember: true, members: g.members + 1 } : g,
//         ),
//       );
//       const joined =
//         groups.find((g) => g.id === gid) ?? normGroup(r?.group ?? {});
//       setShowJoin(false);
//       setJoinCode("");
//       if (joined?.id) openChat({ ...joined, isMember: true });
//       setToast("Joined!");
//     } catch (e: any) {
//       setJoinErr(e.message ?? "Join failed");
//     } finally {
//       setJoinLoad(false);
//     }
//   }

//   // ── Send message ─────────────────────────────────────────────────────────────
//   async function sendMessage() {
//     const text = draft.trim();
//     if (!text || !activeGroup) return;
//     setSendLoad(true);
//     setSendErr(null);
//     try {
//       const r = await apiFetch<any>(`/${activeGroup.id}/messages`, "POST", {
//         uid: getUid(),
//         text,
//       });
//       const msg = normMsg(r?.message ?? r, activeGroup.id);
//       if (!msg.id) throw new Error("Invalid response");
//       setMessages((prev) => [...prev, msg]);
//       setDraft("");
//       setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
//     } catch (e: any) {
//       setSendErr(e.message ?? "Failed to send");
//     } finally {
//       setSendLoad(false);
//     }
//   }

//   const myAnonName = getUid() ? undefined : undefined; // server assigns — just for bubble coloring

//   // ── Render: Chat ─────────────────────────────────────────────────────────────
//   if (view === "chat" && activeGroup) {
//     return (
//       <SafeAreaView style={s.safe}>
//         {/* Header */}
//         <View style={s.chatHeader}>
//           <TouchableOpacity onPress={backToGroups} style={s.backBtn}>
//             <ArrowLeft size={20} color={TEXT} />
//           </TouchableOpacity>
//           <View style={{ flex: 1 }}>
//             <Text style={s.chatHeaderTitle} numberOfLines={1}>
//               {activeGroup.name}
//             </Text>
//             <View style={s.chatHeaderMeta}>
//               <Users size={11} color={MUTED} />
//               <Text style={s.chatHeaderSub}>{activeGroup.members} members</Text>
//               <Text style={s.dot}>·</Text>
//               <Hash size={11} color={MUTED} />
//               <Text style={s.chatHeaderSub}>{activeGroup.code}</Text>
//             </View>
//           </View>
//           <View style={s.modBadge}>
//             <ShieldCheck size={13} color={GREEN} />
//             <Text style={s.modBadgeText}>Moderated</Text>
//           </View>
//         </View>

//         <KeyboardAvoidingView
//           style={{ flex: 1 }}
//           behavior={Platform.OS === "ios" ? "padding" : undefined}
//           keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
//         >
//           {/* Messages */}
//           {mLoad ? (
//             <View style={s.centerBox}>
//               <ActivityIndicator color={PURPLE} />
//               <Text style={s.centerText}>Loading chat…</Text>
//             </View>
//           ) : mErr ? (
//             <View style={s.centerBox}>
//               <Text style={s.errText}>{mErr}</Text>
//               <TouchableOpacity
//                 onPress={() => fetchMessages(activeGroup.id, true)}
//               >
//                 <Text style={s.retryText}>Retry</Text>
//               </TouchableOpacity>
//             </View>
//           ) : (
//             <FlatList
//               ref={flatRef}
//               data={messages}
//               keyExtractor={(m) => m.id}
//               contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
//               ListEmptyComponent={
//                 <View style={s.centerBox}>
//                   <Text style={s.centerText}>
//                     No messages yet. Start the conversation!
//                   </Text>
//                 </View>
//               }
//               ListHeaderComponent={
//                 <View style={s.safeNote}>
//                   <ShieldCheck size={13} color={MUTED} />
//                   <Text style={s.safeNoteText}>
//                     All messages are anonymous and AI-moderated. If you're in
//                     crisis, call or text 988.
//                   </Text>
//                 </View>
//               }
//               renderItem={({ item, index }) => {
//                 const prev = messages[index - 1];
//                 const showName = !prev || prev.authorName !== item.authorName;
//                 const isMe = false; // always show as "other" — fully anonymous
//                 return (
//                   <View style={[s.msgRow, isMe && s.msgRowMe]}>
//                     <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
//                       {showName && (
//                         <Text
//                           style={[s.bubbleName, isMe && { color: "#7C3AED" }]}
//                         >
//                           {item.authorName}
//                         </Text>
//                       )}
//                       <Text style={[s.bubbleText, isMe && { color: WHITE }]}>
//                         {item.text}
//                       </Text>
//                       <Text
//                         style={[
//                           s.bubbleTime,
//                           isMe && { color: "rgba(255,255,255,0.6)" },
//                         ]}
//                       >
//                         {fmtTime(item.createdAt)}
//                       </Text>
//                     </View>
//                   </View>
//                 );
//               }}
//             />
//           )}

//           {/* Input bar */}
//           <View style={s.inputBar}>
//             {sendErr ? (
//               <View style={s.sendErrBox}>
//                 <Text style={s.sendErrText} numberOfLines={3}>
//                   {sendErr}
//                 </Text>
//               </View>
//             ) : null}
//             <View style={s.inputRow}>
//               <TextInput
//                 style={s.input}
//                 value={draft}
//                 onChangeText={(v) => {
//                   setDraft(v);
//                   setSendErr(null);
//                 }}
//                 placeholder="Message the group…"
//                 placeholderTextColor="#9CA3AF"
//                 multiline
//                 maxLength={800}
//                 returnKeyType="default"
//               />
//               <TouchableOpacity
//                 style={[
//                   s.sendBtn,
//                   (!draft.trim() || sendLoad) && { opacity: 0.45 },
//                 ]}
//                 onPress={sendMessage}
//                 disabled={!draft.trim() || sendLoad}
//               >
//                 {sendLoad ? (
//                   <ActivityIndicator size="small" color={WHITE} />
//                 ) : (
//                   <Send size={17} color={WHITE} />
//                 )}
//               </TouchableOpacity>
//             </View>
//           </View>
//         </KeyboardAvoidingView>
//       </SafeAreaView>
//     );
//   }

//   // ── Render: Groups ────────────────────────────────────────────────────────────
//   const filtered = groups.filter((g) => {
//     const q = query.trim().toLowerCase();
//     if (!q) return true;
//     return (
//       g.name.toLowerCase().includes(q) ||
//       g.description.toLowerCase().includes(q) ||
//       g.category.toLowerCase().includes(q) ||
//       g.code.toLowerCase().includes(q)
//     );
//   });
//   const myGroups = filtered.filter((g) => g.isMember);
//   const otherGroups = filtered.filter((g) => !g.isMember);

//   return (
//     <SafeAreaView style={s.safe}>
//       <ScrollView
//         contentContainerStyle={{ paddingBottom: 40 }}
//         showsVerticalScrollIndicator={false}
//       >
//         {/* Hero */}
//         <LinearGradient
//           colors={[GREEN, "#059669"]}
//           start={{ x: 0, y: 0 }}
//           end={{ x: 1, y: 1 }}
//           style={s.hero}
//         >
//           <View style={s.heroTop}>
//             <View style={s.heroIcon}>
//               <Users size={22} color={WHITE} />
//             </View>
//             <View style={{ flex: 1 }}>
//               <Text style={s.heroTitle}>Peer Groups</Text>
//               <Text style={s.heroSub}>
//                 Anonymous, moderated group chat for students.
//               </Text>
//             </View>
//           </View>
//           <View style={s.heroPills}>
//             <View style={s.pill}>
//               <Sparkles size={12} color={WHITE} />
//               <Text style={s.pillText}>Anonymous</Text>
//             </View>
//             <View style={s.pill}>
//               <ShieldCheck size={12} color={WHITE} />
//               <Text style={s.pillText}>AI Moderated</Text>
//             </View>
//           </View>
//           <View style={s.heroBtns}>
//             <TouchableOpacity
//               style={s.hBtn1}
//               onPress={() => {
//                 setCName("");
//                 setCDesc("");
//                 setCCat("General");
//                 setShowCreate(true);
//               }}
//             >
//               <Plus size={15} color={WHITE} />
//               <Text style={s.hBtn1Text}>Create group</Text>
//             </TouchableOpacity>
//             <TouchableOpacity
//               style={s.hBtn2}
//               onPress={() => {
//                 setJoinCode("");
//                 setJoinErr(null);
//                 setShowJoin(true);
//               }}
//             >
//               <LogIn size={15} color={TEXT} />
//               <Text style={s.hBtn2Text}>Join with code</Text>
//             </TouchableOpacity>
//           </View>
//         </LinearGradient>

//         {/* Search */}
//         <View style={s.searchRow}>
//           <Search size={16} color={MUTED} />
//           <TextInput
//             style={s.searchInput}
//             value={query}
//             onChangeText={setQuery}
//             placeholder="Search groups…"
//             placeholderTextColor="#9CA3AF"
//           />
//         </View>

//         {gLoad && (
//           <View style={s.centerBox}>
//             <ActivityIndicator color={PURPLE} />
//             <Text style={s.centerText}>Loading groups…</Text>
//           </View>
//         )}
//         {gErr && (
//           <View style={[s.errBox, { margin: 16 }]}>
//             <Text style={s.errText}>{gErr}</Text>
//             <TouchableOpacity onPress={loadGroups}>
//               <Text style={s.retryText}>Retry</Text>
//             </TouchableOpacity>
//           </View>
//         )}

//         {/* My Groups */}
//         <Text style={s.sectionLabel}>Your groups</Text>
//         <View style={s.section}>
//           {myGroups.length === 0 ? (
//             <View style={s.emptyCard}>
//               <Text style={s.emptyCardText}>
//                 No groups yet — create or join one above.
//               </Text>
//             </View>
//           ) : (
//             myGroups.map((g) => (
//               <TouchableOpacity
//                 key={g.id}
//                 style={s.groupCard}
//                 onPress={() => openChat(g)}
//               >
//                 <View style={s.groupCardTop}>
//                   <Text style={s.groupName} numberOfLines={1}>
//                     {g.name}
//                   </Text>
//                   <View style={s.catTag}>
//                     <Text style={s.catTagText}>{g.category}</Text>
//                   </View>
//                 </View>
//                 <Text style={s.groupDesc} numberOfLines={2}>
//                   {g.description}
//                 </Text>
//                 <View style={s.groupMeta}>
//                   <Users size={11} color={MUTED} />
//                   <Text style={s.metaText}>{g.members} members</Text>
//                   <Text style={s.dot}>·</Text>
//                   <Hash size={11} color={MUTED} />
//                   <Text style={s.metaText}>{g.code}</Text>
//                 </View>
//               </TouchableOpacity>
//             ))
//           )}
//         </View>

//         {/* Discover */}
//         <Text style={s.sectionLabel}>Discover</Text>
//         <View style={s.section}>
//           {otherGroups.length === 0 ? (
//             <View style={s.emptyCard}>
//               <Text style={s.emptyCardText}>
//                 No other groups to discover yet.
//               </Text>
//             </View>
//           ) : (
//             otherGroups.map((g) => (
//               <View
//                 key={g.id}
//                 style={[
//                   s.groupCard,
//                   { flexDirection: "row", alignItems: "center", gap: 10 },
//                 ]}
//               >
//                 <View style={{ flex: 1 }}>
//                   <View style={s.groupCardTop}>
//                     <Text style={s.groupName} numberOfLines={1}>
//                       {g.name}
//                     </Text>
//                     <View
//                       style={[
//                         s.catTag,
//                         { borderColor: "#EDE9FE", backgroundColor: "#F5F3FF" },
//                       ]}
//                     >
//                       <Text style={[s.catTagText, { color: PURPLE }]}>
//                         {g.category}
//                       </Text>
//                     </View>
//                   </View>
//                   <Text style={s.groupDesc} numberOfLines={2}>
//                     {g.description}
//                   </Text>
//                   <View style={s.groupMeta}>
//                     <Users size={11} color={MUTED} />
//                     <Text style={s.metaText}>{g.members}</Text>
//                     <Text style={s.dot}>·</Text>
//                     <Hash size={11} color={MUTED} />
//                     <Text style={s.metaText}>{g.code}</Text>
//                   </View>
//                 </View>
//                 <TouchableOpacity
//                   style={s.joinBtn}
//                   onPress={() => {
//                     setJoinCode(g.code);
//                     setJoinErr(null);
//                     setShowJoin(true);
//                   }}
//                 >
//                   <Text style={s.joinBtnText}>Join</Text>
//                 </TouchableOpacity>
//               </View>
//             ))
//           )}
//         </View>
//       </ScrollView>

//       {/* Create Group Modal */}
//       <Modal
//         visible={showCreate}
//         transparent
//         animationType="fade"
//         onRequestClose={() => setShowCreate(false)}
//       >
//         <View style={s.overlay}>
//           <KeyboardAvoidingView
//             behavior={Platform.OS === "ios" ? "padding" : undefined}
//           >
//             <View style={s.modal}>
//               <View style={s.modalHdr}>
//                 <Text style={s.modalTitle}>Create a group</Text>
//                 <Pressable
//                   onPress={() => setShowCreate(false)}
//                   style={s.closeBtn}
//                 >
//                   <X size={17} color={TEXT} />
//                 </Pressable>
//               </View>
//               <Text style={s.modalLabel}>Group name *</Text>
//               <TextInput
//                 style={s.modalField}
//                 value={cName}
//                 onChangeText={setCName}
//                 placeholder="e.g. Calm After Class"
//                 placeholderTextColor="#9CA3AF"
//               />
//               <Text style={s.modalLabel}>Description</Text>
//               <TextInput
//                 style={[s.modalField, { height: 72, textAlignVertical: "top" }]}
//                 value={cDesc}
//                 onChangeText={setCDesc}
//                 placeholder="What's this group about?"
//                 placeholderTextColor="#9CA3AF"
//                 multiline
//               />
//               <Text style={s.modalLabel}>Category</Text>
//               <View style={s.catRow}>
//                 {["General", "Anxiety", "Stress", "Study", "Fitness"].map(
//                   (c) => (
//                     <TouchableOpacity
//                       key={c}
//                       onPress={() => setCCat(c)}
//                       style={[s.catChip, cCat === c && s.catChipOn]}
//                     >
//                       <Text
//                         style={[s.catChipText, cCat === c && s.catChipTextOn]}
//                       >
//                         {c}
//                       </Text>
//                     </TouchableOpacity>
//                   ),
//                 )}
//               </View>
//               <TouchableOpacity
//                 style={[s.modalBtn, !cName.trim() && { opacity: 0.5 }]}
//                 disabled={!cName.trim()}
//                 onPress={createGroup}
//               >
//                 <Text style={s.modalBtnText}>Create</Text>
//               </TouchableOpacity>
//               <Text style={s.hint}>
//                 A 4-letter join code is generated automatically.
//               </Text>
//             </View>
//           </KeyboardAvoidingView>
//         </View>
//       </Modal>

//       {/* Join Modal */}
//       <Modal
//         visible={showJoin}
//         transparent
//         animationType="fade"
//         onRequestClose={() => setShowJoin(false)}
//       >
//         <View style={s.overlay}>
//           <View style={s.modal}>
//             <View style={s.modalHdr}>
//               <Text style={s.modalTitle}>Join with code</Text>
//               <Pressable onPress={() => setShowJoin(false)} style={s.closeBtn}>
//                 <X size={17} color={TEXT} />
//               </Pressable>
//             </View>
//             <Text style={s.modalLabel}>Enter join code</Text>
//             <TextInput
//               style={s.modalField}
//               value={joinCode}
//               onChangeText={(v) => {
//                 setJoinCode(v);
//                 setJoinErr(null);
//               }}
//               placeholder="e.g. HS9D"
//               placeholderTextColor="#9CA3AF"
//               autoCapitalize="characters"
//               maxLength={6}
//             />
//             {joinErr ? <Text style={s.modalErr}>{joinErr}</Text> : null}
//             <TouchableOpacity
//               style={[
//                 s.modalBtn,
//                 (joinLoad || !joinCode.trim()) && { opacity: 0.5 },
//               ]}
//               disabled={joinLoad || !joinCode.trim()}
//               onPress={joinGroup}
//             >
//               {joinLoad ? (
//                 <ActivityIndicator color={WHITE} />
//               ) : (
//                 <Text style={s.modalBtnText}>Join</Text>
//               )}
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>

//       {toast ? (
//         <View style={s.toast}>
//           <Text style={s.toastText}>{toast}</Text>
//         </View>
//       ) : null}
//     </SafeAreaView>
//   );
// }

// // ── Styles ─────────────────────────────────────────────────────────────────────
// const s = StyleSheet.create({
//   safe: { flex: 1, backgroundColor: BG },

//   // Hero
//   hero: { margin: 16, borderRadius: 18, padding: 16 },
//   heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
//   heroIcon: {
//     width: 44,
//     height: 44,
//     borderRadius: 22,
//     backgroundColor: "rgba(255,255,255,0.22)",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   heroTitle: { color: WHITE, fontSize: 20, fontWeight: "800" },
//   heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
//   heroPills: { flexDirection: "row", gap: 8, marginTop: 12 },
//   pill: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 5,
//     backgroundColor: "rgba(255,255,255,0.18)",
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 999,
//   },
//   pillText: { color: WHITE, fontSize: 11, fontWeight: "700" },
//   heroBtns: { flexDirection: "row", gap: 10, marginTop: 14 },
//   hBtn1: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.18)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.3)",
//     borderRadius: 12,
//     paddingVertical: 11,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     gap: 7,
//   },
//   hBtn1Text: { color: WHITE, fontWeight: "800", fontSize: 13 },
//   hBtn2: {
//     flex: 1,
//     backgroundColor: WHITE,
//     borderRadius: 12,
//     paddingVertical: 11,
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     gap: 7,
//   },
//   hBtn2Text: { color: TEXT, fontWeight: "800", fontSize: 13 },

//   // Search
//   searchRow: {
//     marginHorizontal: 16,
//     marginBottom: 4,
//     backgroundColor: WHITE,
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: BORDER,
//     flexDirection: "row",
//     alignItems: "center",
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     gap: 8,
//   },
//   searchInput: { flex: 1, color: TEXT, fontSize: 14 },

//   // Section
//   sectionLabel: {
//     marginTop: 18,
//     marginBottom: 10,
//     paddingHorizontal: 16,
//     fontSize: 14,
//     fontWeight: "800",
//     color: TEXT,
//   },
//   section: { paddingHorizontal: 16 },

//   // Group cards
//   groupCard: {
//     backgroundColor: WHITE,
//     borderRadius: 14,
//     borderWidth: 1,
//     borderColor: BORDER,
//     padding: 13,
//     marginBottom: 10,
//   },
//   groupCardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
//   groupName: { flex: 1, fontSize: 14, fontWeight: "800", color: TEXT },
//   groupDesc: { color: MUTED, fontSize: 12, marginTop: 5, lineHeight: 17 },
//   groupMeta: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 5,
//     marginTop: 8,
//   },
//   metaText: { color: MUTED, fontSize: 11, fontWeight: "600" },
//   dot: { color: MUTED, fontSize: 11 },
//   catTag: {
//     borderWidth: 1,
//     borderColor: "#D1FAE5",
//     backgroundColor: "#ECFDF5",
//     paddingHorizontal: 8,
//     paddingVertical: 4,
//     borderRadius: 999,
//   },
//   catTagText: { color: "#047857", fontSize: 10, fontWeight: "800" },
//   joinBtn: {
//     backgroundColor: PURPLE,
//     paddingHorizontal: 14,
//     paddingVertical: 9,
//     borderRadius: 10,
//   },
//   joinBtnText: { color: WHITE, fontWeight: "800", fontSize: 13 },
//   emptyCard: {
//     backgroundColor: WHITE,
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: BORDER,
//     padding: 16,
//     alignItems: "center",
//   },
//   emptyCardText: { color: MUTED, fontSize: 13 },

//   // Chat header
//   chatHeader: {
//     backgroundColor: WHITE,
//     borderBottomWidth: 1,
//     borderBottomColor: BORDER,
//     paddingHorizontal: 14,
//     paddingVertical: 11,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },
//   backBtn: {
//     width: 36,
//     height: 36,
//     borderRadius: 10,
//     backgroundColor: "#F3F4F6",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   chatHeaderTitle: { fontSize: 15, fontWeight: "900", color: TEXT },
//   chatHeaderMeta: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 4,
//     marginTop: 2,
//   },
//   chatHeaderSub: { fontSize: 11, color: MUTED, fontWeight: "600" },
//   modBadge: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 5,
//     backgroundColor: "#ECFDF5",
//     borderWidth: 1,
//     borderColor: "#D1FAE5",
//     paddingHorizontal: 9,
//     paddingVertical: 6,
//     borderRadius: 999,
//   },
//   modBadgeText: { color: "#047857", fontSize: 10, fontWeight: "800" },

//   // Messages
//   msgRow: { marginBottom: 4, alignItems: "flex-start" },
//   msgRowMe: { alignItems: "flex-end" },
//   bubble: {
//     maxWidth: "78%",
//     borderRadius: 16,
//     paddingHorizontal: 12,
//     paddingVertical: 9,
//     paddingBottom: 6,
//   },
//   bubbleThem: {
//     backgroundColor: WHITE,
//     borderWidth: 1,
//     borderColor: BORDER,
//     borderBottomLeftRadius: 4,
//   },
//   bubbleMe: { backgroundColor: PURPLE, borderBottomRightRadius: 4 },
//   bubbleName: {
//     fontSize: 11,
//     fontWeight: "800",
//     color: GREEN,
//     marginBottom: 3,
//   },
//   bubbleText: { fontSize: 14, color: TEXT, lineHeight: 19 },
//   bubbleTime: { fontSize: 10, color: MUTED, marginTop: 4, textAlign: "right" },

//   // Safety note
//   safeNote: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     gap: 7,
//     backgroundColor: "#F0FDF4",
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: "#BBF7D0",
//     padding: 11,
//     marginBottom: 12,
//   },
//   safeNoteText: { flex: 1, color: "#166534", fontSize: 11, lineHeight: 16 },

//   // Input bar
//   inputBar: {
//     backgroundColor: WHITE,
//     borderTopWidth: 1,
//     borderTopColor: BORDER,
//     padding: 10,
//     paddingBottom: Platform.OS === "ios" ? 26 : 10,
//   },
//   sendErrBox: {
//     backgroundColor: "#FEF2F2",
//     borderRadius: 10,
//     padding: 10,
//     marginBottom: 8,
//     borderWidth: 1,
//     borderColor: "#FECACA",
//   },
//   sendErrText: {
//     color: "#991B1B",
//     fontSize: 12,
//     fontWeight: "700",
//     lineHeight: 17,
//   },
//   inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
//   input: {
//     flex: 1,
//     borderWidth: 1,
//     borderColor: BORDER,
//     borderRadius: 14,
//     paddingHorizontal: 13,
//     paddingVertical: 10,
//     color: TEXT,
//     fontSize: 14,
//     maxHeight: 110,
//     backgroundColor: "#F9FAFB",
//   },
//   sendBtn: {
//     width: 42,
//     height: 42,
//     borderRadius: 13,
//     backgroundColor: PURPLE,
//     alignItems: "center",
//     justifyContent: "center",
//   },

//   // Center / error states
//   centerBox: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     padding: 32,
//     gap: 10,
//   },
//   centerText: { color: MUTED, fontSize: 13, textAlign: "center" },
//   errBox: {
//     backgroundColor: "#FEF2F2",
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: "#FECACA",
//     padding: 14,
//     gap: 6,
//   },
//   errText: { color: "#991B1B", fontWeight: "700", fontSize: 13 },
//   retryText: {
//     color: "#991B1B",
//     fontWeight: "900",
//     textDecorationLine: "underline",
//     fontSize: 13,
//   },

//   // Modals
//   overlay: {
//     flex: 1,
//     backgroundColor: "rgba(17,24,39,0.45)",
//     justifyContent: "center",
//     padding: 16,
//   },
//   modal: {
//     backgroundColor: WHITE,
//     borderRadius: 18,
//     borderWidth: 1,
//     borderColor: BORDER,
//     padding: 16,
//   },
//   modalHdr: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     marginBottom: 2,
//   },
//   modalTitle: { fontSize: 16, fontWeight: "900", color: TEXT },
//   closeBtn: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     backgroundColor: "#F3F4F6",
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   modalLabel: {
//     fontSize: 12,
//     fontWeight: "800",
//     color: TEXT,
//     marginTop: 12,
//     marginBottom: 5,
//   },
//   modalField: {
//     borderWidth: 1,
//     borderColor: BORDER,
//     backgroundColor: "#F9FAFB",
//     borderRadius: 11,
//     paddingHorizontal: 12,
//     paddingVertical: 10,
//     color: TEXT,
//     fontSize: 14,
//   },
//   modalBtn: {
//     backgroundColor: GREEN,
//     borderRadius: 12,
//     paddingVertical: 13,
//     alignItems: "center",
//     marginTop: 14,
//   },
//   modalBtnText: { color: WHITE, fontWeight: "900", fontSize: 14 },
//   modalErr: { color: RED, fontSize: 12, fontWeight: "700", marginTop: 8 },
//   hint: { color: MUTED, fontSize: 11, marginTop: 8, lineHeight: 15 },

//   // Category chips
//   catRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 },
//   catChip: {
//     borderWidth: 1,
//     borderColor: BORDER,
//     backgroundColor: "#F9FAFB",
//     borderRadius: 999,
//     paddingHorizontal: 11,
//     paddingVertical: 7,
//   },
//   catChipOn: { borderColor: "#D1FAE5", backgroundColor: "#ECFDF5" },
//   catChipText: { color: MUTED, fontSize: 12, fontWeight: "700" },
//   catChipTextOn: { color: "#047857" },

//   // Toast
//   toast: {
//     position: "absolute",
//     bottom: 20,
//     left: 16,
//     right: 16,
//     backgroundColor: "rgba(17,24,39,0.9)",
//     borderRadius: 12,
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//     alignItems: "center",
//   },
//   toastText: { color: WHITE, fontWeight: "800", fontSize: 13 },
// });
import { auth } from "@/constants/firebase";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Hash,
  LogIn,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
  code: string;
  members: number;
  category: string;
  isMember: boolean;
};

type ChatMsg = {
  id: string;
  groupId: string;
  authorName: string;
  text: string;
  createdAt: number;
};

const API = "https://61zb01mm87.execute-api.us-east-1.amazonaws.com/prod";

const GREEN = "#10B981";
const PURPLE = "#8B5CF6";
const WHITE = "#FFFFFF";
const BG = "#F9FAFB";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const TEXT = "#111827";
const RED = "#EF4444";
const POLL_MS = 6000;

function getUid() {
  try {
    return auth.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

async function apiFetch<T>(
  path: string,
  method: "GET" | "POST",
  body?: any,
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Network error or CORS issue");
  }

  let json: any = {};
  try {
    json = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }

  return json as T;
}

function normGroup(r: any): Group {
  return {
    id: String(r?.id ?? ""),
    name: String(r?.name ?? "Unnamed"),
    description: String(r?.description ?? ""),
    code: String(r?.code ?? "").toUpperCase(),
    members: Number(r?.members ?? 0),
    category: String(r?.category ?? "General"),
    isMember: !!r?.isMember,
  };
}

function normMsg(r: any, gid: string): ChatMsg {
  return {
    id: String(r?.id ?? Math.random().toString(36)),
    groupId: gid,
    authorName: String(r?.authorName ?? "Anonymous"),
    text: String(r?.text ?? ""),
    createdAt: Number(r?.createdAt ?? Date.now()),
  };
}

function fmtTime(n: number) {
  const d = new Date(n);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => {
    return chars[Math.floor(Math.random() * chars.length)];
  }).join("");
}

export default function Peerchat() {
  const [view, setView] = useState<"groups" | "chat">("groups");
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [gLoad, setGLoad] = useState(false);
  const [gErr, setGErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cCat, setCCat] = useState("General");

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoad, setJoinLoad] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [mLoad, setMLoad] = useState(false);
  const [mErr, setMErr] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendLoad, setSendLoad] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const flatRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollErrorCountRef = useRef(0);

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  async function loadGroups() {
    setGLoad(true);
    setGErr(null);

    try {
      const uid = getUid();
      const result = await apiFetch<{ groups: any[] }>(
        `/groups${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`,
        "GET",
      );

      setGroups((result.groups ?? []).filter((g) => g?.id).map(normGroup));
    } catch (err: any) {
      setGErr(err?.message ?? "Failed to load groups");
    } finally {
      setGLoad(false);
    }
  }

  const fetchMessages = useCallback(
    async (groupId: string, initial = false) => {
      if (initial) {
        setMLoad(true);
        setMErr(null);
        setMessages([]);
      }

      try {
        const result = await apiFetch<{ messages: any[] }>(
          `/${groupId}/messages?limit=60`,
          "GET",
        );

        const msgs = (result.messages ?? []).map((m) => normMsg(m, groupId));
        setMessages(msgs);
        pollErrorCountRef.current = 0;

        if (initial) {
          setTimeout(() => {
            flatRef.current?.scrollToEnd({ animated: false });
          }, 100);
        }
      } catch (err: any) {
        const msg = err?.message ?? "Failed to load messages";

        if (initial) {
          setMErr(msg);
        }

        pollErrorCountRef.current += 1;

        if (pollErrorCountRef.current >= 3) {
          stopPolling();
          setSendErr("Chat connection stopped. Please retry.");
        }
      } finally {
        if (initial) {
          setMLoad(false);
        }
      }
    },
    [],
  );

  function startPolling(groupId: string) {
    stopPolling();
    pollErrorCountRef.current = 0;

    pollRef.current = setInterval(() => {
      fetchMessages(groupId, false);
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function openChat(group: Group) {
    setActiveGroup(group);
    setView("chat");
    setDraft("");
    setSendErr(null);
    setMErr(null);
    fetchMessages(group.id, true);
    startPolling(group.id);
  }

  function backToGroups() {
    stopPolling();
    setView("groups");
    setActiveGroup(null);
    setMessages([]);
    setMErr(null);
    setDraft("");
    setSendErr(null);
    loadGroups();
  }

  async function createGroup() {
    if (!cName.trim()) return;

    try {
      const uid = getUid();

      const result = await apiFetch<any>("/groups", "POST", {
        uid,
        name: cName.trim(),
        description: cDesc.trim() || "Peer support space",
        category: cCat,
        code: makeCode(),
      });

      const group = normGroup(result?.group ?? result);
      if (!group.id) throw new Error("Invalid response from server");

      setGroups((prev) => [group, ...prev]);

      setShowCreate(false);
      setCName("");
      setCDesc("");
      setCCat("General");

      openChat(group);
      setToast("Group created!");
    } catch (err: any) {
      setToast(err?.message ?? "Failed to create group");
    }
  }

  async function joinGroup() {
    setJoinErr(null);
    setJoinLoad(true);

    try {
      const code = joinCode.trim().toUpperCase();
      if (!code) throw new Error("Enter a join code");

      const uid = getUid();
      const result = await apiFetch<any>("/join", "POST", { uid, code });

      const joinedGroup = normGroup(result?.group ?? {});
      if (!joinedGroup.id) throw new Error("Join failed");

      setGroups((prev) => {
        const exists = prev.some((g) => g.id === joinedGroup.id);
        if (exists) {
          return prev.map((g) =>
            g.id === joinedGroup.id ? { ...joinedGroup, isMember: true } : g,
          );
        }
        return [{ ...joinedGroup, isMember: true }, ...prev];
      });

      setShowJoin(false);
      setJoinCode("");
      openChat({ ...joinedGroup, isMember: true });
      setToast("Joined!");
    } catch (err: any) {
      setJoinErr(err?.message ?? "Join failed");
    } finally {
      setJoinLoad(false);
    }
  }

  async function sendMessage() {
    const text = draft.trim();
    if (!text || !activeGroup) return;

    setSendLoad(true);
    setSendErr(null);

    try {
      const result = await apiFetch<any>(
        `/${activeGroup.id}/messages`,
        "POST",
        {
          uid: getUid(),
          text,
        },
      );

      const msg = normMsg(result?.message ?? result, activeGroup.id);
      if (!msg.id) throw new Error("Invalid response from server");

      setMessages((prev) => [...prev, msg]);
      setDraft("");

      setTimeout(() => {
        flatRef.current?.scrollToEnd({ animated: true });
      }, 80);
    } catch (err: any) {
      setSendErr(err?.message ?? "Failed to send");
    } finally {
      setSendLoad(false);
    }
  }

  const filtered = groups.filter((g) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    return (
      g.name.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q)
    );
  });

  const myGroups = filtered.filter((g) => g.isMember);
  const otherGroups = filtered.filter((g) => !g.isMember);

  if (view === "chat" && activeGroup) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.chatHeader}>
          <TouchableOpacity onPress={backToGroups} style={s.backBtn}>
            <ArrowLeft size={20} color={TEXT} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={s.chatHeaderTitle} numberOfLines={1}>
              {activeGroup.name}
            </Text>
            <View style={s.chatHeaderMeta}>
              <Users size={11} color={MUTED} />
              <Text style={s.chatHeaderSub}>{activeGroup.members} members</Text>
              <Text style={s.dot}>·</Text>
              <Hash size={11} color={MUTED} />
              <Text style={s.chatHeaderSub}>{activeGroup.code}</Text>
            </View>
          </View>

          <View style={s.modBadge}>
            <ShieldCheck size={13} color={GREEN} />
            <Text style={s.modBadgeText}>Moderated</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {mLoad ? (
            <View style={s.centerBox}>
              <ActivityIndicator color={PURPLE} />
              <Text style={s.centerText}>Loading chat…</Text>
            </View>
          ) : mErr ? (
            <View style={s.centerBox}>
              <Text style={s.errText}>{mErr}</Text>
              <TouchableOpacity
                onPress={() => {
                  setSendErr(null);
                  setMErr(null);
                  fetchMessages(activeGroup.id, true);
                  startPolling(activeGroup.id);
                }}
              >
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
              ListHeaderComponent={
                <View style={s.safeNote}>
                  <ShieldCheck size={13} color={MUTED} />
                  <Text style={s.safeNoteText}>
                    All messages are anonymous and AI-moderated. Crisis,
                    self-harm, violent, abusive, and unsafe content is blocked.
                  </Text>
                </View>
              }
              ListEmptyComponent={
                <View style={s.centerBox}>
                  <Text style={s.centerText}>
                    No messages yet. Start the conversation.
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const prev = messages[index - 1];
                const showName = !prev || prev.authorName !== item.authorName;

                return (
                  <View style={s.msgRow}>
                    <View style={[s.bubble, s.bubbleThem]}>
                      {showName ? (
                        <Text style={s.bubbleName}>{item.authorName}</Text>
                      ) : null}
                      <Text style={s.bubbleText}>{item.text}</Text>
                      <Text style={s.bubbleTime}>
                        {fmtTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          <View style={s.inputBar}>
            {sendErr ? (
              <View style={s.sendErrBox}>
                <Text style={s.sendErrText} numberOfLines={3}>
                  {sendErr}
                </Text>
              </View>
            ) : null}

            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                value={draft}
                onChangeText={(v) => {
                  setDraft(v);
                  setSendErr(null);
                }}
                placeholder="Message the group…"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={800}
              />

              <TouchableOpacity
                style={[
                  s.sendBtn,
                  (!draft.trim() || sendLoad) && { opacity: 0.45 },
                ]}
                onPress={sendMessage}
                disabled={!draft.trim() || sendLoad}
              >
                {sendLoad ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <Send size={17} color={WHITE} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[GREEN, "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTop}>
            <View style={s.heroIcon}>
              <Users size={22} color={WHITE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>Peer Groups</Text>
              <Text style={s.heroSub}>
                Anonymous, moderated group chat for students.
              </Text>
            </View>
          </View>

          <View style={s.heroPills}>
            <View style={s.pill}>
              <Sparkles size={12} color={WHITE} />
              <Text style={s.pillText}>Anonymous</Text>
            </View>
            <View style={s.pill}>
              <ShieldCheck size={12} color={WHITE} />
              <Text style={s.pillText}>AI Moderated</Text>
            </View>
          </View>

          <View style={s.heroBtns}>
            <TouchableOpacity
              style={s.hBtn1}
              onPress={() => {
                setCName("");
                setCDesc("");
                setCCat("General");
                setShowCreate(true);
              }}
            >
              <Plus size={15} color={WHITE} />
              <Text style={s.hBtn1Text}>Create group</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.hBtn2}
              onPress={() => {
                setJoinCode("");
                setJoinErr(null);
                setShowJoin(true);
              }}
            >
              <LogIn size={15} color={TEXT} />
              <Text style={s.hBtn2Text}>Join with code</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={s.searchRow}>
          <Search size={16} color={MUTED} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search groups…"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {gLoad ? (
          <View style={s.centerBox}>
            <ActivityIndicator color={PURPLE} />
            <Text style={s.centerText}>Loading groups…</Text>
          </View>
        ) : null}

        {gErr ? (
          <View style={[s.errBox, { margin: 16 }]}>
            <Text style={s.errText}>{gErr}</Text>
            <TouchableOpacity onPress={loadGroups}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={s.sectionLabel}>Your groups</Text>
        <View style={s.section}>
          {myGroups.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyCardText}>
                No groups yet. Create one or join with a code.
              </Text>
            </View>
          ) : (
            myGroups.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={s.groupCard}
                onPress={() => openChat(g)}
              >
                <View style={s.groupCardTop}>
                  <Text style={s.groupName} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <View style={s.catTag}>
                    <Text style={s.catTagText}>{g.category}</Text>
                  </View>
                </View>

                <Text style={s.groupDesc} numberOfLines={2}>
                  {g.description}
                </Text>

                <View style={s.groupMeta}>
                  <Users size={11} color={MUTED} />
                  <Text style={s.metaText}>{g.members} members</Text>
                  <Text style={s.dot}>·</Text>
                  <Hash size={11} color={MUTED} />
                  <Text style={s.metaText}>{g.code}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={s.sectionLabel}>Discover</Text>
        <View style={s.section}>
          {otherGroups.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyCardText}>
                No other groups to discover yet.
              </Text>
            </View>
          ) : (
            otherGroups.map((g) => (
              <View
                key={g.id}
                style={[
                  s.groupCard,
                  { flexDirection: "row", alignItems: "center", gap: 10 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={s.groupCardTop}>
                    <Text style={s.groupName} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <View
                      style={[
                        s.catTag,
                        {
                          borderColor: "#EDE9FE",
                          backgroundColor: "#F5F3FF",
                        },
                      ]}
                    >
                      <Text style={[s.catTagText, { color: PURPLE }]}>
                        {g.category}
                      </Text>
                    </View>
                  </View>

                  <Text style={s.groupDesc} numberOfLines={2}>
                    {g.description}
                  </Text>

                  <View style={s.groupMeta}>
                    <Users size={11} color={MUTED} />
                    <Text style={s.metaText}>{g.members}</Text>
                    <Text style={s.dot}>·</Text>
                    <Hash size={11} color={MUTED} />
                    <Text style={s.metaText}>{g.code}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={s.joinBtn}
                  onPress={() => {
                    setJoinCode(g.code);
                    setJoinErr(null);
                    setShowJoin(true);
                  }}
                >
                  <Text style={s.joinBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showCreate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={s.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={s.modal}>
              <View style={s.modalHdr}>
                <Text style={s.modalTitle}>Create a group</Text>
                <Pressable
                  onPress={() => setShowCreate(false)}
                  style={s.closeBtn}
                >
                  <X size={17} color={TEXT} />
                </Pressable>
              </View>

              <Text style={s.modalLabel}>Group name *</Text>
              <TextInput
                style={s.modalField}
                value={cName}
                onChangeText={setCName}
                placeholder="e.g. Calm After Class"
                placeholderTextColor="#9CA3AF"
              />

              <Text style={s.modalLabel}>Description</Text>
              <TextInput
                style={[s.modalField, { height: 72, textAlignVertical: "top" }]}
                value={cDesc}
                onChangeText={setCDesc}
                placeholder="What is this group about?"
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={s.modalLabel}>Category</Text>
              <View style={s.catRow}>
                {["General", "Anxiety", "Stress", "Study", "Fitness"].map(
                  (cat) => (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCCat(cat)}
                      style={[s.catChip, cCat === cat && s.catChipOn]}
                    >
                      <Text
                        style={[s.catChipText, cCat === cat && s.catChipTextOn]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <TouchableOpacity
                style={[s.modalBtn, !cName.trim() && { opacity: 0.5 }]}
                disabled={!cName.trim()}
                onPress={createGroup}
              >
                <Text style={s.modalBtnText}>Create</Text>
              </TouchableOpacity>

              <Text style={s.hint}>
                A short join code is generated automatically.
              </Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showJoin}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJoin(false)}
      >
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHdr}>
              <Text style={s.modalTitle}>Join with code</Text>
              <Pressable onPress={() => setShowJoin(false)} style={s.closeBtn}>
                <X size={17} color={TEXT} />
              </Pressable>
            </View>

            <Text style={s.modalLabel}>Enter join code</Text>
            <TextInput
              style={s.modalField}
              value={joinCode}
              onChangeText={(v) => {
                setJoinCode(v);
                setJoinErr(null);
              }}
              placeholder="e.g. HS9D"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              maxLength={6}
            />

            {joinErr ? <Text style={s.modalErr}>{joinErr}</Text> : null}

            <TouchableOpacity
              style={[
                s.modalBtn,
                (joinLoad || !joinCode.trim()) && { opacity: 0.5 },
              ]}
              disabled={joinLoad || !joinCode.trim()}
              onPress={joinGroup}
            >
              {joinLoad ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={s.modalBtnText}>Join</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toast ? (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

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
  heroTitle: { color: WHITE, fontSize: 20, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  heroPills: { flexDirection: "row", gap: 8, marginTop: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: { color: WHITE, fontSize: 11, fontWeight: "700" },
  heroBtns: { flexDirection: "row", gap: 10, marginTop: 14 },
  hBtn1: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  hBtn1Text: { color: WHITE, fontWeight: "800", fontSize: 13 },
  hBtn2: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  hBtn2Text: { color: TEXT, fontWeight: "800", fontSize: 13 },

  searchRow: {
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, color: TEXT, fontSize: 14 },

  sectionLabel: {
    marginTop: 18,
    marginBottom: 10,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "800",
    color: TEXT,
  },
  section: { paddingHorizontal: 16 },

  groupCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 13,
    marginBottom: 10,
  },
  groupCardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupName: { flex: 1, fontSize: 14, fontWeight: "800", color: TEXT },
  groupDesc: { color: MUTED, fontSize: 12, marginTop: 5, lineHeight: 17 },
  groupMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  metaText: { color: MUTED, fontSize: 11, fontWeight: "600" },
  dot: { color: MUTED, fontSize: 11 },
  catTag: {
    borderWidth: 1,
    borderColor: "#D1FAE5",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  catTagText: { color: "#047857", fontSize: 10, fontWeight: "800" },
  joinBtn: {
    backgroundColor: PURPLE,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  joinBtnText: { color: WHITE, fontWeight: "800", fontSize: 13 },
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    alignItems: "center",
  },
  emptyCardText: { color: MUTED, fontSize: 13 },

  chatHeader: {
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderTitle: { fontSize: 15, fontWeight: "900", color: TEXT },
  chatHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  chatHeaderSub: { fontSize: 11, color: MUTED, fontWeight: "600" },
  modBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modBadgeText: { color: "#047857", fontSize: 10, fontWeight: "800" },

  msgRow: { marginBottom: 4, alignItems: "flex-start" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    paddingBottom: 6,
  },
  bubbleThem: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleName: {
    fontSize: 11,
    fontWeight: "800",
    color: GREEN,
    marginBottom: 3,
  },
  bubbleText: { fontSize: 14, color: TEXT, lineHeight: 19 },
  bubbleTime: { fontSize: 10, color: MUTED, marginTop: 4, textAlign: "right" },

  safeNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 11,
    marginBottom: 12,
  },
  safeNoteText: { flex: 1, color: "#166534", fontSize: 11, lineHeight: 16 },

  inputBar: {
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    padding: 10,
    paddingBottom: Platform.OS === "ios" ? 26 : 10,
  },
  sendErrBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  sendErrText: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    color: TEXT,
    fontSize: 14,
    maxHeight: 110,
    backgroundColor: "#F9FAFB",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },

  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  centerText: { color: MUTED, fontSize: 13, textAlign: "center" },
  errBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 14,
    gap: 6,
  },
  errText: { color: "#991B1B", fontWeight: "700", fontSize: 13 },
  retryText: {
    color: "#991B1B",
    fontWeight: "900",
    textDecorationLine: "underline",
    fontSize: 13,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  modalHdr: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: TEXT },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: TEXT,
    marginTop: 12,
    marginBottom: 5,
  },
  modalField: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FAFB",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: TEXT,
    fontSize: 14,
  },
  modalBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  modalBtnText: { color: WHITE, fontWeight: "900", fontSize: 14 },
  modalErr: { color: RED, fontSize: 12, fontWeight: "700", marginTop: 8 },
  hint: { color: MUTED, fontSize: 11, marginTop: 8, lineHeight: 15 },

  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 4 },
  catChip: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FAFB",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  catChipOn: { borderColor: "#D1FAE5", backgroundColor: "#ECFDF5" },
  catChipText: { color: MUTED, fontSize: 12, fontWeight: "700" },
  catChipTextOn: { color: "#047857" },

  toast: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "rgba(17,24,39,0.9)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  toastText: { color: WHITE, fontWeight: "800", fontSize: 13 },
});
