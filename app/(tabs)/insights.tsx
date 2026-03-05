import { getFitbitDataFromAWS, syncFitbitDataToAWS } from "@/utils/aws-fitbit";
import {
  calculateTrends,
  getActivityGoals,
  getDevices,
  getWellnessData,
  type ActivityGoals,
  type TrendAnalysis,
  type WellnessData,
} from "@/utils/fitbit-api";
import { getFitbitStoredUserId, isFitbitConnected } from "@/utils/fitbit-auth";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Calendar,
  Footprints,
  Heart,
  Info,
  Moon,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Watch,
  Zap,
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
  const [wellnessData, setWellnessData] = useState<WellnessData[] | null>(null);
  const [goalsDaily, setGoalsDaily] = useState<ActivityGoals["goals"] | null>(null);
  const [goalsWeekly, setGoalsWeekly] = useState<ActivityGoals["goals"] | null>(null);
  const [devices, setDevices] = useState<{ lastSyncTime?: string; deviceVersion?: string }[]>([]);

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

      const [data, dailyRes, weeklyRes, devs] = await Promise.all([
        getWellnessData(startDateStr, endDateStr),
        getActivityGoals("daily"),
        getActivityGoals("weekly"),
        getDevices(),
      ]);
      setWellnessData(data);
      setGoalsDaily(dailyRes?.goals ?? null);
      setGoalsWeekly(weeklyRes?.goals ?? null);
      setDevices(
        (devs ?? []).map((d) => ({
          lastSyncTime: d.lastSyncTime,
          deviceVersion: d.deviceVersion,
        }))
      );

      const calculatedTrends = calculateTrends(data);
      setTrends(calculatedTrends);

      try {
        const userId = (await getFitbitStoredUserId()) || "test-user";
        await syncFitbitDataToAWS(userId, data);
        await getFitbitDataFromAWS(userId);
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
      if (metric === "sleep") return d?.sleep?.hours ?? 0;
      if (metric === "hrv") return d?.heartRate?.hrv ?? 0;
      if (metric === "restingHeartRate") return d?.heartRate?.resting ?? 0;
      if (metric === "activity") return d?.activity?.activeMinutes ?? 0;
      if (metric === "activeZoneMinutes") return d?.activity?.activeZoneMinutes ?? 0;
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

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const dataList = Array.isArray(wellnessData) ? wellnessData : [];
  const latestDay = dataList.length > 0 ? dataList[dataList.length - 1] : null;
  const last7Days = dataList.slice(-7);
  const last14Days = dataList.slice(-14).reverse();

  return (
    <View style={styles.container}>
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
            {latestDay && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: "#E0E7FF" }]}>
                    <Calendar size={24} color="#4F46E5" />
                  </View>
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle}>
                      {latestDay.date === new Date().toISOString().slice(0, 10) ? "Today" : "Latest day"}
                    </Text>
                    <Text style={styles.insightMeta}>{formatDate(latestDay.date)}</Text>
                  </View>
                </View>
                <View style={styles.detailGrid}>
                  {latestDay.sleep && (latestDay.sleep.hours > 0 || latestDay.sleep.timeInBedMinutes > 0) && (
                    <>
                      <Text style={styles.detailLabel}>Sleep</Text>
                      <Text style={styles.detailValue}>{formatTime(latestDay.sleep.hours)}</Text>
                      <Text style={styles.detailLabel}>Efficiency</Text>
                      <Text style={styles.detailValue}>{latestDay.sleep.efficiency}%</Text>
                      {(latestDay.sleep.deepSleepMinutes ?? 0) + (latestDay.sleep.remSleepMinutes ?? 0) + (latestDay.sleep.lightSleepMinutes ?? 0) > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Deep / REM / Light</Text>
                          <Text style={styles.detailValue}>
                            {latestDay.sleep.deepSleepMinutes ?? 0}m / {latestDay.sleep.remSleepMinutes ?? 0}m / {latestDay.sleep.lightSleepMinutes ?? 0}m
                          </Text>
                        </>
                      )}
                      {(latestDay.sleep.timeInBedMinutes ?? 0) > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Time in bed</Text>
                          <Text style={styles.detailValue}>{latestDay.sleep.timeInBedMinutes} min</Text>
                        </>
                      )}
                      {(latestDay.sleep.minutesToFallAsleep ?? 0) > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Time to fall asleep</Text>
                          <Text style={styles.detailValue}>{latestDay.sleep.minutesToFallAsleep} min</Text>
                        </>
                      )}
                    </>
                  )}
                  {latestDay.heartRate && ((latestDay.heartRate.resting ?? 0) > 0 || (latestDay.heartRate.hrv ?? 0) > 0) && (
                    <>
                      <Text style={styles.detailLabel}>Resting HR</Text>
                      <Text style={styles.detailValue}>{latestDay.heartRate.resting} bpm</Text>
                      <Text style={styles.detailLabel}>HRV</Text>
                      <Text style={styles.detailValue}>{latestDay.heartRate.hrv?.toFixed(0) ?? "—"} ms</Text>
                    </>
                  )}
                  {latestDay.activity && (
                    <>
                      <Text style={styles.detailLabel}>Steps</Text>
                      <Text style={styles.detailValue}>{(latestDay.activity.steps ?? 0).toLocaleString()}</Text>
                      <Text style={styles.detailLabel}>Active min</Text>
                      <Text style={styles.detailValue}>{latestDay.activity.activeMinutes ?? 0} min</Text>
                      {(latestDay.activity.calories ?? 0) > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Calories</Text>
                          <Text style={styles.detailValue}>{latestDay.activity.calories}</Text>
                        </>
                      )}
                      {(latestDay.activity.distance ?? 0) > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Distance</Text>
                          <Text style={styles.detailValue}>{latestDay.activity.distance} mi</Text>
                        </>
                      )}
                      {(latestDay.activity.floors ?? 0) > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Floors</Text>
                          <Text style={styles.detailValue}>{latestDay.activity.floors}</Text>
                        </>
                      )}
                      {(latestDay.activity.activeZoneMinutes ?? 0) > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Active Zone Min</Text>
                          <Text style={styles.detailValue}>{latestDay.activity.activeZoneMinutes} (Fat burn: {latestDay.activity.fatBurnActiveZoneMinutes ?? 0}, Cardio: {latestDay.activity.cardioActiveZoneMinutes ?? 0}, Peak: {latestDay.activity.peakActiveZoneMinutes ?? 0})</Text>
                        </>
                      )}
                      {((latestDay.activity.veryActiveMinutes ?? 0) + (latestDay.activity.fairlyActiveMinutes ?? 0) + (latestDay.activity.lightlyActiveMinutes ?? 0)) > 0 && (
                        <>
                          <Text style={styles.detailLabel}>Very / Fairly / Lightly active</Text>
                          <Text style={styles.detailValue}>
                            {latestDay.activity.veryActiveMinutes ?? 0} / {latestDay.activity.fairlyActiveMinutes ?? 0} / {latestDay.activity.lightlyActiveMinutes ?? 0} min
                          </Text>
                        </>
                      )}
                    </>
                  )}
                </View>
              </View>
            )}

            {(goalsDaily || goalsWeekly) && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: "#FEF3C7" }]}>
                    <Target size={24} color="#D97706" />
                  </View>
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle}>Goals</Text>
                    <Text style={styles.insightMeta}>Daily & weekly targets</Text>
                  </View>
                </View>
                <View style={styles.detailGrid}>
                  {goalsDaily?.steps != null && (
                    <>
                      <Text style={styles.detailLabel}>Daily steps</Text>
                      <Text style={styles.detailValue}>{goalsDaily.steps?.toLocaleString() ?? "—"}</Text>
                    </>
                  )}
                  {goalsDaily?.activeMinutes != null && (
                    <>
                      <Text style={styles.detailLabel}>Daily active min</Text>
                      <Text style={styles.detailValue}>{goalsDaily.activeMinutes ?? "—"}</Text>
                    </>
                  )}
                  {goalsDaily?.activeZoneMinutes != null && (
                    <>
                      <Text style={styles.detailLabel}>Daily AZM</Text>
                      <Text style={styles.detailValue}>{goalsDaily.activeZoneMinutes ?? "—"}</Text>
                    </>
                  )}
                  {goalsDaily?.caloriesOut != null && (
                    <>
                      <Text style={styles.detailLabel}>Daily calories</Text>
                      <Text style={styles.detailValue}>{goalsDaily.caloriesOut ?? "—"}</Text>
                    </>
                  )}
                  {goalsDaily?.distance != null && (
                    <>
                      <Text style={styles.detailLabel}>Daily distance</Text>
                      <Text style={styles.detailValue}>{goalsDaily.distance ?? "—"} mi</Text>
                    </>
                  )}
                  {goalsDaily?.floors != null && (
                    <>
                      <Text style={styles.detailLabel}>Daily floors</Text>
                      <Text style={styles.detailValue}>{goalsDaily.floors ?? "—"}</Text>
                    </>
                  )}
                  {goalsWeekly?.steps != null && (
                    <>
                      <Text style={styles.detailLabel}>Weekly steps</Text>
                      <Text style={styles.detailValue}>{goalsWeekly.steps?.toLocaleString() ?? "—"}</Text>
                    </>
                  )}
                  {goalsWeekly?.activeZoneMinutes != null && (
                    <>
                      <Text style={styles.detailLabel}>Weekly AZM</Text>
                      <Text style={styles.detailValue}>{goalsWeekly.activeZoneMinutes ?? "—"}</Text>
                    </>
                  )}
                  {goalsWeekly?.distance != null && (
                    <>
                      <Text style={styles.detailLabel}>Weekly distance</Text>
                      <Text style={styles.detailValue}>{goalsWeekly.distance ?? "—"} mi</Text>
                    </>
                  )}
                  {goalsWeekly?.floors != null && (
                    <>
                      <Text style={styles.detailLabel}>Weekly floors</Text>
                      <Text style={styles.detailValue}>{goalsWeekly.floors ?? "—"}</Text>
                    </>
                  )}
                </View>
              </View>
            )}

            {dataList.some((d) => (d.sleep?.hours ?? 0) > 0 || (d.sleep?.timeInBedMinutes ?? 0) > 0) && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: "#EDE9FE" }]}>
                    <Moon size={24} color="#5B21B6" />
                  </View>
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle}>Sleep & well-being</Text>
                    <Text style={styles.insightMeta}>How sleep supports your mental health</Text>
                  </View>
                </View>
                <Text style={styles.mentalHealthNote}>
                  Sleep quality and consistency strongly affect mood, focus, and stress resilience. Below is your full sleep picture so you can spot patterns.
                </Text>
                {latestDay?.sleep && (latestDay.sleep.hours > 0 || latestDay.sleep.timeInBedMinutes > 0) && (
                  <>
                    <Text style={styles.sleepSectionLabel}>Latest night</Text>
                    <View style={styles.detailGrid}>
                      <Text style={styles.detailLabel}>Total sleep</Text>
                      <Text style={styles.detailValue}>{formatTime(latestDay.sleep.hours)}</Text>
                      <Text style={styles.detailLabel}>Time in bed</Text>
                      <Text style={styles.detailValue}>{latestDay.sleep.timeInBedMinutes ?? 0} min</Text>
                      <Text style={styles.detailLabel}>Efficiency</Text>
                      <Text style={styles.detailValue}>{latestDay.sleep.efficiency}%</Text>
                      <Text style={styles.detailLabel}>Deep sleep</Text>
                      <Text style={styles.detailValue}>{latestDay.sleep.deepSleepMinutes ?? 0} min</Text>
                      <Text style={styles.detailLabel}>REM sleep</Text>
                      <Text style={styles.detailValue}>{latestDay.sleep.remSleepMinutes ?? 0} min</Text>
                      <Text style={styles.detailLabel}>Light sleep</Text>
                      <Text style={styles.detailValue}>{latestDay.sleep.lightSleepMinutes ?? 0} min</Text>
                      <Text style={styles.detailLabel}>Time awake (during night)</Text>
                      <Text style={styles.detailValue}>{latestDay.sleep.minutesAwake ?? 0} min</Text>
                      <Text style={styles.detailLabel}>Time to fall asleep</Text>
                      <Text style={styles.detailValue}>{latestDay.sleep.minutesToFallAsleep ?? 0} min</Text>
                    </View>
                  </>
                )}
                {last7Days.length > 0 && (
                  <>
                    <Text style={styles.sleepSectionLabel}>Last 7 nights (averages)</Text>
                    <View style={styles.detailGrid}>
                      <Text style={styles.detailLabel}>Avg sleep</Text>
                      <Text style={styles.detailValue}>
                        {formatTime(avg(last7Days.map((d) => d.sleep?.hours ?? 0)) || 0)}
                      </Text>
                      <Text style={styles.detailLabel}>Avg efficiency</Text>
                      <Text style={styles.detailValue}>
                        {(avg(last7Days.map((d) => d.sleep?.efficiency ?? 0)) || 0).toFixed(0)}%
                      </Text>
                      <Text style={styles.detailLabel}>Avg deep</Text>
                      <Text style={styles.detailValue}>
                        {(avg(last7Days.map((d) => d.sleep?.deepSleepMinutes ?? 0)) || 0).toFixed(0)} min
                      </Text>
                      <Text style={styles.detailLabel}>Avg REM</Text>
                      <Text style={styles.detailValue}>
                        {(avg(last7Days.map((d) => d.sleep?.remSleepMinutes ?? 0)) || 0).toFixed(0)} min
                      </Text>
                      <Text style={styles.detailLabel}>Avg time in bed</Text>
                      <Text style={styles.detailValue}>
                        {(avg(last7Days.map((d) => d.sleep?.timeInBedMinutes ?? 0)) || 0).toFixed(0)} min
                      </Text>
                      <Text style={styles.detailLabel}>Avg awake (during night)</Text>
                      <Text style={styles.detailValue}>
                        {(avg(last7Days.map((d) => d.sleep?.minutesAwake ?? 0)) || 0).toFixed(0)} min
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {(() => {
              const sleepTrend = getTrendOrFallback("sleep");
              const progress = Math.min(
                100,
                Math.max(0, (sleepTrend.current7DayAvg / 8) * 100)
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

            {(() => {
              const hrvTrend = getTrendOrFallback("hrv");
              const progress = Math.min(
                100,
                Math.max(0, (hrvTrend.current7DayAvg / 100) * 100)
              );

              return (
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
                        ? "No HRV data found yet. Some accounts/devices don't expose HRV daily RMSSD via API."
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
                        ? "No resting heart rate data found yet. Make sure Heart Rate scope is granted."
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

            {(() => {
              const azmTrend = getTrendOrFallback("activeZoneMinutes");
              if (azmTrend.current7DayAvg <= 0 && azmTrend.baseline30DayAvg <= 0) return null;
              const progress = Math.min(100, Math.max(0, (azmTrend.current7DayAvg / 30) * 100));
              return (
                <View style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: "#FCE7F3" }]}>
                      <Zap size={24} color="#DB2777" />
                    </View>
                    <View style={styles.insightTitleContainer}>
                      <Text style={styles.insightTitle}>Active Zone Minutes</Text>
                      <Text style={styles.insightMeta}>7-day vs 30-day baseline</Text>
                    </View>
                  </View>
                  <View style={styles.metricRow}>
                    <View style={styles.metric}>
                      <Text style={styles.metricValue}>{azmTrend.current7DayAvg.toFixed(0)} min</Text>
                      <Text style={styles.metricLabel}>7-day avg</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.metric}>
                      <View style={styles.changeContainer}>
                        {azmTrend.changeType === "increase" ? (
                          <TrendingUp size={16} color="#10B981" />
                        ) : azmTrend.changeType === "decrease" ? (
                          <TrendingDown size={16} color="#EF4444" />
                        ) : (
                          <TrendingUp size={16} color="#6B7280" />
                        )}
                        <Text
                          style={
                            azmTrend.changeType === "increase"
                              ? styles.metricValuePositive
                              : azmTrend.changeType === "decrease"
                              ? styles.metricValueNegative
                              : styles.metricValueNeutral
                          }
                        >
                          {formatChange(azmTrend.change)}
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
                            azmTrend.changeType === "increase"
                              ? "#10B981"
                              : azmTrend.changeType === "decrease"
                              ? "#EF4444"
                              : "#6B7280",
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })()}

            {last7Days.length > 0 && (
              <View style={styles.insightCard}>
                <Text style={styles.sectionTitle}>This week</Text>
                <View style={styles.detailGrid}>
                  <Text style={styles.detailLabel}>Steps (total)</Text>
                  <Text style={styles.detailValue}>
                    {last7Days.reduce((s, d) => s + (d.activity?.steps ?? 0), 0).toLocaleString()}
                  </Text>
                  <Text style={styles.detailLabel}>Active min (avg)</Text>
                  <Text style={styles.detailValue}>
                    {(avg(last7Days.map((d) => d.activity?.activeMinutes ?? 0)) || 0).toFixed(0)} min
                  </Text>
                  <Text style={styles.detailLabel}>AZM (total)</Text>
                  <Text style={styles.detailValue}>
                    {last7Days.reduce((s, d) => s + (d.activity?.activeZoneMinutes ?? 0), 0)}
                  </Text>
                  <Text style={styles.detailLabel}>Calories (avg)</Text>
                  <Text style={styles.detailValue}>
                    {(avg(last7Days.map((d) => d.activity?.calories ?? 0)) || 0).toFixed(0)}
                  </Text>
                  <Text style={styles.detailLabel}>Sleep (avg)</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(avg(last7Days.map((d) => d.sleep?.hours ?? 0)) || 0)}
                  </Text>
                  <Text style={styles.detailLabel}>HRV (avg)</Text>
                  <Text style={styles.detailValue}>
                    {(avg(last7Days.map((d) => d.heartRate?.hrv ?? 0)) || 0).toFixed(0)} ms
                  </Text>
                </View>
              </View>
            )}

            {last14Days.length > 0 && (
              <View style={styles.insightCard}>
                <Text style={styles.sectionTitle}>Day by day</Text>
                {last14Days.map((day) => (
                  <View key={day.date} style={styles.dayRow}>
                    <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                    <View style={styles.dayMetrics}>
                      {day.sleep && day.sleep.hours > 0 && (
                        <Text style={styles.dayMetric}>{formatTime(day.sleep.hours)} sleep</Text>
                      )}
                      {(day.activity?.steps ?? 0) > 0 && (
                        <Text style={styles.dayMetric}>{(day.activity?.steps ?? 0).toLocaleString()} steps</Text>
                      )}
                      {(day.heartRate?.resting ?? 0) > 0 && (
                        <Text style={styles.dayMetric}>{day.heartRate?.resting} bpm</Text>
                      )}
                      {(day.heartRate?.hrv ?? 0) > 0 && (
                        <Text style={styles.dayMetric}>HRV {(day.heartRate?.hrv ?? 0).toFixed(0)} ms</Text>
                      )}
                      {(day.activity?.activeZoneMinutes ?? 0) > 0 && (
                        <Text style={styles.dayMetric}>{day.activity?.activeZoneMinutes} AZM</Text>
                      )}
                      {(day.activity?.activeMinutes ?? 0) > 0 && (
                        <Text style={styles.dayMetric}>{day.activity?.activeMinutes} active min</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {devices.length > 0 && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: "#E5E7EB" }]}>
                    <Watch size={24} color="#374151" />
                  </View>
                  <View style={styles.insightTitleContainer}>
                    <Text style={styles.insightTitle}>Device</Text>
                    <Text style={styles.insightMeta}>Last sync</Text>
                  </View>
                </View>
                {devices.map((d, i) => (
                  <View key={i} style={styles.dayRow}>
                    <Text style={styles.detailLabel}>
                      {d.lastSyncTime
                        ? new Date(d.lastSyncTime).toLocaleString()
                        : "—"}
                    </Text>
                    {d.deviceVersion && (
                      <Text style={styles.detailValue}>{d.deviceVersion}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

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
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  detailLabel: {
    width: "48%",
    fontSize: 13,
    color: "#6B7280",
    marginTop: 8,
  },
  detailValue: {
    width: "48%",
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginTop: 8,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  mentalHealthNote: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 16,
  },
  sleepSectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
    marginBottom: 8,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  dayDate: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    minWidth: 100,
  },
  dayMetrics: {
    flex: 1,
    flexWrap: "wrap",
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  dayMetric: {
    fontSize: 12,
    color: "#6B7280",
  },
});
