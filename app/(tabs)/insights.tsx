import { getFitbitDataFromAWS, syncFitbitDataToAWS } from "@/utils/aws-fitbit";
import {
  calculateTrends,
  getWellnessData,
  type TrendAnalysis,
} from "@/utils/fitbit-api";
import { getFitbitStoredUserId, isFitbitConnected } from "@/utils/fitbit-auth";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Footprints,
  Heart,
  Info,
  Moon,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function InsightsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [trends, setTrends] = useState<TrendAnalysis[]>([]);
  const [wellnessData, setWellnessData] = useState<any>(null);

  useEffect(() => {
    checkConnectionAndLoadData();
  }, []);

  const checkConnectionAndLoadData = async () => {
    const isConnected = await isFitbitConnected();
    setConnected(isConnected);
    if (isConnected) {
      loadInsights();
    }
  };

  const loadInsights = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const endDateStr = endDate.toISOString().split("T")[0];
      const startDateStr = startDate.toISOString().split("T")[0];

      const data = await getWellnessData(startDateStr, endDateStr);
      setWellnessData(data);

      const calculatedTrends = calculateTrends(data);
      setTrends(calculatedTrends);

      try {
        const userId = (await getFitbitStoredUserId()) || "test-user";
        const write = await syncFitbitDataToAWS(userId, data);
        const read = await getFitbitDataFromAWS(userId);
        console.log("AWS Fitbit sync ok", { userId, write, readRecords: read.length });
      } catch (syncError) {
        console.error("Failed to sync to AWS:", syncError);
      }
    } catch (error: any) {
      console.error("Error loading insights:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to load Fitbit data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkConnectionAndLoadData();
    setRefreshing(false);
  };

  const getTrendForMetric = (metric: string): TrendAnalysis | undefined => {
    return trends.find((t) => t.metric === metric);
  };

  const avg = (values: number[]) => {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const computeFallbackTrend = (metric: string): TrendAnalysis => {
    const data: any[] = Array.isArray(wellnessData) ? wellnessData : [];
    const last7 = data.slice(-7);
    const last30 = data.slice(-30);

    const pick = (d: any) => {
      if (metric === "sleep") return d?.sleep?.hours || 0;
      if (metric === "hrv") return d?.heartRate?.hrv || 0;
      if (metric === "restingHeartRate") return d?.heartRate?.resting || 0;
      if (metric === "activity") return d?.activity?.activeMinutes || 0;
      return 0;
    };

    const v7 = last7.map(pick).filter((v) => v > 0);
    const v30 = last30.map(pick).filter((v) => v > 0);
    const a7 = avg(v7);
    const a30 = avg(v30);
    const change = a30 > 0 ? ((a7 - a30) / a30) * 100 : 0;
    const changeType = change > 5 ? "increase" : change < -5 ? "decrease" : "stable";
    return { metric, current7DayAvg: a7, baseline30DayAvg: a30, change, changeType };
  };

  const getTrendOrFallback = (metric: string): TrendAnalysis => {
    return getTrendForMetric(metric) || computeFallbackTrend(metric);
  };

  const formatChange = (change: number): string => {
    const sign = change > 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  const formatTime = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };
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

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && !wellnessData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingText}>Loading your insights...</Text>
          </View>
        ) : !connected ? (
          /* CONNECT WEARABLE CARD */
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connect Wearable</Text>
            <Text style={styles.cardText}>
              Sync your Fitbit to unlock advanced insights based on your sleep,
              heart rate, and activity data.
            </Text>

            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => {
                router.push("/(tabs)/profile");
              }}
            >
              <Text style={styles.connectButtonText}>Go to Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* SLEEP INSIGHT */}
            {(() => {
              const sleepTrend = getTrendOrFallback("sleep");

              const progress = Math.min(
                100,
                Math.max(
                  0,
                  (sleepTrend.current7DayAvg / 8) * 100
                )
              );

              return (
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={styles.iconContainer}>
                      <Moon size={24} color="#6366F1" />
                    </View>

                    <View style={styles.insightTitleContainer}>
                      <Text style={styles.insightTitle}>Sleep Trend</Text>
                      <Text style={styles.insightMeta}>
                        Last 7 days vs 30-day baseline
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>
                        {formatTime(sleepTrend.current7DayAvg)}
                      </Text>
                      <Text style={styles.metricLabel}>7-day average</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.metric}>
                      <View style={styles.changeContainer}>
                        {sleepTrend.changeType === "increase" ? (
                          <TrendingUp size={16} color="#10B981" />
                        ) : sleepTrend.changeType === "decrease" ? (
                          <TrendingDown size={16} color="#EF4444" />
                        ) : (
                          <TrendingUp size={16} color="#6B7280" />
                        )}
                        <Text
                          style={
                            sleepTrend.changeType === "increase"
                              ? styles.metricValuePositive
                              : sleepTrend.changeType === "decrease"
                              ? styles.metricValueNegative
                              : styles.metricValueNeutral
                          }
                        >
                          {formatChange(sleepTrend.change)}
                        </Text>
                      </View>
                      <Text style={styles.metricLabel}>vs baseline</Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progress}%`,
                          backgroundColor:
                            sleepTrend.changeType === "increase"
                              ? "#10B981"
                              : sleepTrend.changeType === "decrease"
                              ? "#EF4444"
                              : "#6B7280",
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.explainer}>
                    <Info size={14} color="#6B7280" />
                    <Text style={styles.explainerText}>
                      {sleepTrend.current7DayAvg <= 0
                        ? "No sleep data found yet. Make sure your Fitbit has recent sleep logs and the app has Sleep scope access."
                        : sleepTrend.changeType === "increase"
                        ? `Your sleep has improved by ${Math.abs(sleepTrend.change).toFixed(1)}% this week. Keep up your evening routine.`
                        : sleepTrend.changeType === "decrease"
                        ? `Your sleep is ${Math.abs(sleepTrend.change).toFixed(1)}% lower than your baseline. Consider improving your sleep hygiene.`
                        : "Your sleep is consistent with your baseline."}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* HRV INSIGHT */}
            {(() => {
              const hrvTrend = getTrendOrFallback("hrv");

              const progress = Math.min(
                100,
                Math.max(0, (hrvTrend.current7DayAvg / 100) * 100)
              ); // Normalize to 100ms

              return (
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: "#FEE2E2" }]}>
                      <Heart size={24} color="#EF4444" />
                    </View>

                    <View style={styles.insightTitleContainer}>
                      <Text style={styles.insightTitle}>HRV Recovery</Text>
                      <Text style={styles.insightMeta}>
                        Heart Rate Variability
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>
                        {hrvTrend.current7DayAvg.toFixed(0)} ms
                      </Text>
                      <Text style={styles.metricLabel}>7-day avg</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.metric}>
                      <View style={styles.changeContainer}>
                        {hrvTrend.changeType === "increase" ? (
                          <TrendingUp size={16} color="#10B981" />
                        ) : hrvTrend.changeType === "decrease" ? (
                          <TrendingDown size={16} color="#EF4444" />
                        ) : (
                          <TrendingUp size={16} color="#6B7280" />
                        )}
                        <Text
                          style={
                            hrvTrend.changeType === "increase"
                              ? styles.metricValuePositive
                              : hrvTrend.changeType === "decrease"
                              ? styles.metricValueNegative
                              : styles.metricValueNeutral
                          }
                        >
                          {formatChange(hrvTrend.change)}
                        </Text>
                      </View>
                      <Text style={styles.metricLabel}>vs baseline</Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progress}%`,
                          backgroundColor:
                            hrvTrend.changeType === "increase"
                              ? "#10B981"
                              : hrvTrend.changeType === "decrease"
                              ? "#EF4444"
                              : "#6B7280",
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.explainer}>
                    <Info size={14} color="#6B7280" />
                    <Text style={styles.explainerText}>
                      {hrvTrend.current7DayAvg <= 0
                        ? "No HRV data found yet. Some accounts/devices don’t expose HRV daily RMSSD via API; if so, we can hide this card or compute recovery from heart rate instead."
                        : hrvTrend.changeType === "increase"
                        ? `Your HRV has improved by ${Math.abs(hrvTrend.change).toFixed(1)}%. Great recovery!`
                        : hrvTrend.changeType === "decrease"
                        ? `Your HRV is ${Math.abs(hrvTrend.change).toFixed(1)}% lower than usual. Consider rest or relaxation techniques.`
                        : "Your HRV is consistent with your baseline."}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* RESTING HEART RATE INSIGHT */}
            {(() => {
              const rhrTrend = getTrendOrFallback("restingHeartRate");

              const progress = Math.min(
                100,
                Math.max(0, ((80 - rhrTrend.current7DayAvg) / 40) * 100)
              );

              return (
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: "#DBEAFE" }]}>
                      <Heart size={24} color="#3B82F6" />
                    </View>

                    <View style={styles.insightTitleContainer}>
                      <Text style={styles.insightTitle}>Resting Heart Rate</Text>
                      <Text style={styles.insightMeta}>7-day average</Text>
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>
                        {rhrTrend.current7DayAvg.toFixed(0)} bpm
                      </Text>
                      <Text style={styles.metricLabel}>7-day avg</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.metric}>
                      <View style={styles.changeContainer}>
                        {rhrTrend.changeType === "increase" ? (
                          <TrendingDown size={16} color="#10B981" />
                        ) : rhrTrend.changeType === "decrease" ? (
                          <TrendingUp size={16} color="#EF4444" />
                        ) : (
                          <TrendingUp size={16} color="#6B7280" />
                        )}
                        <Text
                          style={
                            rhrTrend.changeType === "increase"
                              ? styles.metricValuePositive
                              : rhrTrend.changeType === "decrease"
                              ? styles.metricValueNegative
                              : styles.metricValueNeutral
                          }
                        >
                          {formatChange(rhrTrend.change)}
                        </Text>
                      </View>
                      <Text style={styles.metricLabel}>vs baseline</Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progress}%`,
                          backgroundColor:
                            rhrTrend.changeType === "increase"
                              ? "#10B981"
                              : rhrTrend.changeType === "decrease"
                              ? "#EF4444"
                              : "#6B7280",
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.explainer}>
                    <Info size={14} color="#6B7280" />
                    <Text style={styles.explainerText}>
                      {rhrTrend.current7DayAvg <= 0
                        ? "No resting heart rate data found yet. Make sure Heart Rate scope is granted and your device has recent heart rate logs."
                        : rhrTrend.changeType === "increase"
                        ? `Your resting heart rate has decreased by ${Math.abs(rhrTrend.change).toFixed(1)}%. This indicates improved cardiovascular fitness.`
                        : rhrTrend.changeType === "decrease"
                        ? `Your resting heart rate has increased by ${Math.abs(rhrTrend.change).toFixed(1)}%. Consider more rest and recovery.`
                        : "Your resting heart rate is consistent with your baseline."}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* ACTIVITY INSIGHT */}
            {(() => {
              const activityTrend = getTrendOrFallback("activity");

              const progress = Math.min(
                100,
                Math.max(0, (activityTrend.current7DayAvg / 60) * 100)
              );

              return (
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
                      <Text style={styles.metricValue}>
                        {activityTrend.current7DayAvg.toFixed(0)} min
                      </Text>
                      <Text style={styles.metricLabel}>Avg active time</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.metric}>
                      <View style={styles.changeContainer}>
                        {activityTrend.changeType === "increase" ? (
                          <TrendingUp size={16} color="#10B981" />
                        ) : activityTrend.changeType === "decrease" ? (
                          <TrendingDown size={16} color="#EF4444" />
                        ) : (
                          <TrendingUp size={16} color="#6B7280" />
                        )}
                        <Text
                          style={
                            activityTrend.changeType === "increase"
                              ? styles.metricValuePositive
                              : activityTrend.changeType === "decrease"
                              ? styles.metricValueNegative
                              : styles.metricValueNeutral
                          }
                        >
                          {formatChange(activityTrend.change)}
                        </Text>
                      </View>
                      <Text style={styles.metricLabel}>vs baseline</Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progress}%`,
                          backgroundColor:
                            activityTrend.changeType === "increase"
                              ? "#10B981"
                              : activityTrend.changeType === "decrease"
                              ? "#EF4444"
                              : "#6B7280",
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.explainer}>
                    <Info size={14} color="#6B7280" />
                    <Text style={styles.explainerText}>
                      {activityTrend.current7DayAvg <= 0
                        ? "No activity data found yet. Make sure Activity scope is granted and your Fitbit has recent activity logs."
                        : activityTrend.changeType === "increase"
                        ? `Great progress! Your activity has increased by ${Math.abs(activityTrend.change).toFixed(1)}% this week.`
                        : activityTrend.changeType === "decrease"
                        ? `Your activity is ${Math.abs(activityTrend.change).toFixed(1)}% lower than your baseline. Try to stay active!`
                        : "Your activity level is consistent with your baseline."}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* REFRESH BUTTON */}
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={loadInsights}
              disabled={loading}
            >
              <RefreshCw
                size={16}
                color="#3B82F6"
                style={loading && { opacity: 0.5 }}
              />
              <Text style={styles.refreshButtonText}>
                {loading ? "Refreshing..." : "Refresh Data"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 24 }} />
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
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  metricValueNeutral: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6B7280",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 20,
    marginHorizontal: 20,
  },
  refreshButtonText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#3B82F6",
  },
});
