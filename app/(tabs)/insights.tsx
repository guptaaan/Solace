import { LinearGradient } from "expo-linear-gradient";
import {
  Footprints,
  Heart,
  Info,
  Moon,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function InsightsScreen() {
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient
        colors={["#3B82F6", "#2563EB"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.title}>Your Insights</Text>
        <Text style={styles.subtitle}>Personalized wellness trends</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* SLEEP INSIGHT */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={styles.iconContainer}>
              <Moon size={24} color="#6366F1" />
            </View>

            <View style={styles.insightTitleContainer}>
              <Text style={styles.insightTitle}>Sleep Trend</Text>
              <Text style={styles.insightMeta}>Last 7 days vs baseline</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>7.2 hrs</Text>
              <Text style={styles.metricLabel}>Average</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metric}>
              <View style={styles.changeContainer}>
                <TrendingUp size={16} color="#10B981" />
                <Text style={styles.metricValuePositive}>+18 min</Text>
              </View>
              <Text style={styles.metricLabel}>vs baseline</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: "75%" }]} />
          </View>

          <View style={styles.explainer}>
            <Info size={14} color="#6B7280" />
            <Text style={styles.explainerText}>
              Your sleep has improved by 4% this week. Keep up your evening
              routine.
            </Text>
          </View>
        </View>

        {/* HRV INSIGHT */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={[styles.iconContainer, { backgroundColor: "#FEE2E2" }]}>
              <Heart size={24} color="#EF4444" />
            </View>

            <View style={styles.insightTitleContainer}>
              <Text style={styles.insightTitle}>HRV Recovery</Text>
              <Text style={styles.insightMeta}>Heart Rate Variability</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>58 ms</Text>
              <Text style={styles.metricLabel}>7-day avg</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metric}>
              <View style={styles.changeContainer}>
                <TrendingDown size={16} color="#EF4444" />
                <Text style={styles.metricValueNegative}>-8%</Text>
              </View>
              <Text style={styles.metricLabel}>vs baseline</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: "45%", backgroundColor: "#EF4444" },
              ]}
            />
          </View>

          <View style={styles.explainer}>
            <Info size={14} color="#6B7280" />
            <Text style={styles.explainerText}>
              Your HRV is lower than usual. Consider rest or relaxation
              techniques.
            </Text>
          </View>
        </View>

        {/* ACTIVITY INSIGHT */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeader}>
            <View style={[styles.iconContainer, { backgroundColor: "#DBEAFE" }]}>
              <Footprints size={24} color="#3B82F6" />
            </View>

            <View style={styles.insightTitleContainer}>
              <Text style={styles.insightTitle}>Activity Momentum</Text>
              <Text style={styles.insightMeta}>Weekly progress</Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>32 min</Text>
              <Text style={styles.metricLabel}>Avg active time</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.metric}>
              <Text style={styles.metricValue}>5/7 days</Text>
              <Text style={styles.metricLabel}>Goal reached</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: "71%", backgroundColor: "#3B82F6" },
              ]}
            />
          </View>

          <View style={styles.explainer}>
            <Info size={14} color="#6B7280" />
            <Text style={styles.explainerText}>
              Great consistency! You maintained 20+ active minutes on 5 days
              this week.
            </Text>
          </View>
        </View>

        {/* CONNECT WEARABLE CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connect Wearable</Text>
          <Text style={styles.cardText}>
            Sync your Fitbit to unlock advanced insights based on your sleep,
            heart rate, and activity data.
          </Text>

          <View style={styles.connectButton}>
            <Text style={styles.connectButtonText}>Connect Fitbit</Text>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

//
// STYLES
//
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },

  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  title: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },

  subtitle: { fontSize: 16, color: "#FFFFFF", opacity: 0.9 },

  content: { flex: 1, paddingHorizontal: 20 },

  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  insightHeader: { flexDirection: "row", marginBottom: 20 },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  insightTitleContainer: { flex: 1 },

  insightTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },

  insightMeta: { fontSize: 14, color: "#6B7280", marginTop: 2 },

  metricRow: { flexDirection: "row", marginBottom: 16 },

  metric: { flex: 1 },

  metricValue: { fontSize: 24, fontWeight: "700", color: "#111827" },

  metricLabel: { fontSize: 13, color: "#6B7280" },

  metricValuePositive: { fontSize: 20, fontWeight: "700", color: "#10B981" },

  metricValueNegative: { fontSize: 20, fontWeight: "700", color: "#EF4444" },

  changeContainer: { flexDirection: "row", alignItems: "center" },

  divider: { width: 1, backgroundColor: "#E5E7EB", marginHorizontal: 16 },

  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    marginBottom: 16,
  },

  progressFill: { height: "100%", backgroundColor: "#10B981" },

  explainer: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
  },

  explainerText: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    marginLeft: 8,
    lineHeight: 18,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
    elevation: 2,
  },

  cardTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },

  cardText: { fontSize: 14, color: "#6B7280", marginBottom: 16 },

  connectButton: {
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  connectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
