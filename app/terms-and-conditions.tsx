import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function TermsAndConditionsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Terms & Conditions</Text>
          <Text style={styles.subtitle}>
            Please read these terms carefully before using Solace.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Section
            title="1. General Use"
            body="Solace is a self-support and wellness-focused application designed to help users reflect on mood, review wearable wellness trends, use supportive chat tools, and explore peer support features. Solace is provided for personal informational and general wellness purposes only."
          />
          <Section
            title="2. Not a Clinical or Medical App"
            body="Solace is not a clinical application, not a medical device, and not a healthcare provider. Nothing inside the app should be understood as medical advice, psychiatric advice, psychological treatment, diagnosis, crisis intervention, or emergency care. Any insights, summaries, chat responses, peer messages, or wellness trends shown inside the app are not a substitute for licensed professional support."
          />
          <Section
            title="3. No Emergency or Crisis Use"
            body="You must not use Solace for emergencies, crisis situations, or urgent mental health needs. If you are in danger or need immediate help, do not rely on this app. Contact local emergency services or a licensed healthcare professional immediately."
          />
          <Section
            title="4. User Responsibility"
            body="You are fully responsible for your own decisions, actions, communications, and conduct while using Solace. Any choices you make based on content, suggestions, trends, peer messages, or chat outputs are your own responsibility."
          />
          <Section
            title="5. No Liability for Outcomes"
            body="By using Solace, you agree that the app, its student creators, contributors, project members, and related parties are not liable for any loss, injury, harm, distress, misunderstanding, emotional upset, health-related outcome, personal decision, communication issue, or any direct or indirect consequence connected to the use or misuse of the app."
          />
          <Section
            title="6. AI Chat Limitations"
            body="The chat feature is intended only for supportive, non-clinical, informational conversation. The responses may be incomplete, inaccurate, general, delayed, or unsuitable for your exact situation. Chat responses must never be treated as diagnosis, treatment planning, medication guidance, legal advice, or emergency direction."
          />
          <Section
            title="7. PeerChat Limitations"
            body="PeerChat is a shared user space. Although moderation and safety controls may be used, Solace cannot guarantee that all user content will always be accurate, safe, supportive, complete, or appropriate. Solace is not responsible for user-generated content, peer advice, harmful suggestions, misunderstandings, or emotional effects caused by conversations between users."
          />
          <Section
            title="8. Wellness Data and Fitbit Data"
            body="Any sleep, activity, heart rate, HRV, or related wearable data shown by Solace is for general wellness awareness only. These summaries are not medical findings and should not be used to diagnose conditions or make healthcare decisions without consulting a qualified professional."
          />
          <Section
            title="9. Find Clinicians Resource"
            body="The clinicians resource page is provided only as a convenience to help users look for nearby healthcare professionals. Solace does not guarantee the quality, availability, credentials, treatment style, safety, or suitability of any listed provider."
          />
          <Section
            title="10. Acceptance of Terms"
            body="By continuing to use Solace, you confirm that you understand and accept that the application is a non-clinical wellness platform, that it does not replace professional care, and that responsibility for your personal decisions and actions remains with you."
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
