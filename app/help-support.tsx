import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function HelpSupportScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Help & Support</Text>
          <Text style={styles.subtitle}>
            Guidance on how to use Solace safely and properly.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Section
            title="Using the Chat Feature"
            body="The Chat feature is for supportive conversation, emotional reflection, motivation, coping ideas, and general wellness support. It can help users think through stress, routines, sleep habits, motivation, and daily emotional check-ins."
          />

          <Section
            title="What to Ask in Chat"
            body="Users can ask for calming ideas, reflection prompts, healthy habits, routine support, sleep hygiene tips, journaling prompts, encouragement, and non-clinical wellness guidance."
          />

          <Section
            title="What Not to Ask in Chat"
            body="Users should not use the chat for diagnosis, treatment plans, medication advice, emergencies, crisis handling, or urgent medical decisions. The chat is not a therapist, psychiatrist, doctor, or emergency service."
          />

          <Section
            title="Using PeerChat"
            body="PeerChat is meant for respectful, supportive peer conversation. Users can share general struggles, motivation, daily wellness concerns, academic stress, work stress, and healthy coping experiences in a safe and respectful way."
          />

          <Section
            title="What to Follow in PeerChat"
            body="Users should be respectful, kind, and supportive. Harmful, abusive, unsafe, threatening, sexual, or dangerous content should not be posted. Users should not pressure others, give risky advice, or present themselves as medical professionals."
          />

          <Section
            title="Find Clinicians"
            body="The Find Clinicians page helps users look for nearby providers when they want real professional support. It should be used when someone wants to find a doctor, therapist, counsellor, psychologist, or related provider near their location."
          />

          <Section
            title="Important Reminder"
            body="Solace is a wellness support platform only. It is not a medical or clinical service. For emergencies, crisis situations, or professional treatment, users should contact emergency services or a licensed healthcare professional."
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
  },
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    elevation: 1,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 23,
    color: "#374151",
  },
});
