import { ENDPOINTS } from "@/constants/aws-api";
import { LinearGradient } from "expo-linear-gradient";
import { Frown, Heart, Meh, Smile, TrendingUp } from "lucide-react-native";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function MoodScreen() {
  async function sendMood(mood: string) {
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
    } catch (err) {
      console.log("AWS ERROR ❌", err);
      Alert.alert("Error", "Could not submit your mood.");
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#10B981", "#059669"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.greeting}>Good afternoon</Text>
        <Text style={styles.title}>How are you feeling?</Text>

        <View style={styles.streakContainer}>
          <TrendingUp size={16} color="#FFF" />
          <Text style={styles.streakText}>7 day streak</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* RATE MOOD CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rate your mood</Text>
          <Text style={styles.cardSubtitle}>Quick daily check in</Text>

          <View style={styles.moodGrid}>
            <TouchableOpacity
              style={[styles.moodButton, styles.moodButtonGreat]}
              onPress={() => sendMood("great")}
            >
              <Smile size={32} color="#10B981" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Great</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moodButton, styles.moodButtonGood]}
              onPress={() => sendMood("good")}
            >
              <Heart size={32} color="#3B82F6" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Good</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moodButton, styles.moodButtonOkay]}
              onPress={() => sendMood("okay")}
            >
              <Meh size={32} color="#F59E0B" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Okay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.moodButton, styles.moodButtonLow]}
              onPress={() => sendMood("low")}
            >
              <Frown size={32} color="#EF4444" strokeWidth={2.5} />
              <Text style={styles.moodLabel}>Low</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WEEKLY CHART (RESTORED FULLY) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This Week</Text>

          <View style={styles.weekChart}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
              (day, index) => (
                <View key={day} style={styles.dayColumn}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        { height: [60, 80, 40, 70, 90, 85, 95][index] },
                      ]}
                    />
                  </View>
                  <Text style={styles.dayLabel}>{day}</Text>
                </View>
              )
            )}
          </View>
        </View>

        {/* QUICK ACTIONS (RESTORED FULLY) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>3-Minute Breathing Exercise</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>Grounding Technique</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionText}>Gentle Stretch</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },

  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  greeting: { fontSize: 16, color: "#FFF", opacity: 0.9 },
  title: { fontSize: 28, fontWeight: "700", color: "#FFF", marginBottom: 12 },

  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff33",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  streakText: { color: "#FFF", marginLeft: 6 },

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

  cardTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  cardSubtitle: { fontSize: 14, color: "#6B7280", marginBottom: 12 },

  moodGrid: { flexDirection: "row", justifyContent: "space-between", gap: 12 },

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

  moodLabel: { marginTop: 8, fontWeight: "600", color: "#374151" },

  weekChart: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    marginTop: 16,
  },

  dayColumn: { flex: 1, alignItems: "center" },

  barContainer: {
    flex: 1,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },

  bar: {
    width: 28,
    backgroundColor: "#10B981",
    borderRadius: 8,
  },

  dayLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
  },

  actionButton: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },

  actionText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
});
