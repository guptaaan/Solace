import { FITBIT_CONFIG } from '@/constants/fitbit';
import { getValidAccessToken } from './fitbit-auth';

export interface SleepData {
  dateOfSleep: string;
  duration: number;
  efficiency: number;
  minutesAsleep: number;
  minutesAwake: number;
  timeInBed: number;
  levels?: {
    summary?: {
      deep?: { minutes: number };
      light?: { minutes: number };
      rem?: { minutes: number };
      wake?: { minutes: number };
    };
  };
}

export interface HeartRateData {
  dateTime: string;
  value: {
    bpm: number;
    confidence: number;
  };
}

export interface HeartRateVariabilityData {
  dateTime: string;
  value: {
    dailyRmssd?: number;
    deepRmssd?: number;
  };
}

export interface RestingHeartRateData {
  dateTime: string;
  value: {
    restingHeartRate: number;
  };
}

export interface ActivityData {
  dateTime: string;
  value: string;
  activities: Array<{
    activityId: number;
    activityParentId: number;
    calories: number;
    description: string;
    distance?: number;
    duration: number;
    hasStartTime: boolean;
    isFavorite: boolean;
    lastModified: string;
    logId: number;
    name: string;
    startTime: string;
    steps?: number;
  }>;
  goals: {
    activeMinutes: number;
    caloriesOut: number;
    distance: number;
    floors: number;
    steps: number;
  };
  summary: {
    activeScore?: number;
    activityCalories: number;
    caloriesBMR: number;
    caloriesOut: number;
    distances: Array<{
      activity: string;
      distance: number;
    }>;
    fairlyActiveMinutes: number;
    floors: number;
    heartRateZones: Array<{
      caloriesOut: number;
      max: number;
      min: number;
      minutes: number;
      name: string;
    }>;
    lightlyActiveMinutes: number;
    marginalCalories: number;
    restingHeartRate?: number;
    sedentaryMinutes: number;
    steps: number;
    veryActiveMinutes: number;
  };
}

async function fitbitRequest<T>(endpoint: string): Promise<T> {
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    throw new Error('Not connected to Fitbit. Please connect your Fitbit account.');
  }

  const response = await fetch(`${FITBIT_CONFIG.apiBaseUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Fitbit token expired. Please reconnect your account.');
    }
    const error = await response.text();
    throw new Error(`Fitbit API error: ${error}`);
  }

  return response.json();
}

function listDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}


export async function getSleepData(
  startDate: string,
  endDate: string
): Promise<{ sleep: SleepData[] }> {
  return fitbitRequest(`/sleep/date/${startDate}/${endDate}.json`);
}

export async function getHeartRateData(
  startDate: string,
  endDate: string
): Promise<{ 'activities-heart': HeartRateData[] }> {
  return fitbitRequest(`/activities/heart/date/${startDate}/${endDate}.json`);
}


export async function getHeartRateVariabilityData(
  startDate: string,
  endDate: string
): Promise<{ 'hrv': HeartRateVariabilityData[] }> {
  const dates = listDates(startDate, endDate);
  const results = await Promise.all(
    dates.map((date) => fitbitRequest<{ hrv: HeartRateVariabilityData[] }>(`/hrv/date/${date}.json`).catch(() => ({ hrv: [] })))
  );
  return { hrv: results.flatMap((r) => r.hrv || []) };
}

export async function getRestingHeartRateData(
  startDate: string,
  endDate: string
): Promise<{ 'activities-heart': RestingHeartRateData[] }> {
  return fitbitRequest(`/activities/heart/date/${startDate}/${endDate}.json`);
}


export async function getActivityData(
  startDate: string,
  endDate: string
): Promise<{ 'activities': ActivityData[] }> {
  const dates = listDates(startDate, endDate);
  const results = await Promise.all(
    dates.map(async (date) => {
      const data = await fitbitRequest<Omit<ActivityData, 'dateTime'>>(`/activities/date/${date}.json`);
      return { ...(data as any), dateTime: date } as ActivityData;
    })
  );
  return { activities: results };
}

export interface WellnessData {
  date: string;
  sleep?: {
    hours: number;
    efficiency: number;
    deepSleepMinutes: number;
    remSleepMinutes: number;
  };
  heartRate?: {
    resting: number;
    hrv: number;
  };
  activity?: {
    steps: number;
    activeMinutes: number;
    calories: number;
  };
}

export async function getWellnessData(
  startDate: string,
  endDate: string
): Promise<WellnessData[]> {
  try {
    const [sleepData, heartRateData, hrvData, activityData] = await Promise.all([
      getSleepData(startDate, endDate).catch(() => null),
      getRestingHeartRateData(startDate, endDate).catch(() => null),
      getHeartRateVariabilityData(startDate, endDate).catch(() => null),
      getActivityData(startDate, endDate).catch(() => null),
    ]);


    const dateMap = new Map<string, WellnessData>();


    if (sleepData?.sleep) {
      sleepData.sleep.forEach((sleep) => {
        const date = sleep.dateOfSleep;
        if (!dateMap.has(date)) {
          dateMap.set(date, { date });
        }
        const entry = dateMap.get(date)!;
        entry.sleep = {
          hours: sleep.minutesAsleep / 60,
          efficiency: sleep.efficiency,
          deepSleepMinutes: sleep.levels?.summary?.deep?.minutes || 0,
          remSleepMinutes: sleep.levels?.summary?.rem?.minutes || 0,
        };
      });
    }

    if (heartRateData?.['activities-heart']) {
      heartRateData['activities-heart'].forEach((hr) => {
        const date = hr.dateTime;
        if (!dateMap.has(date)) {
          dateMap.set(date, { date });
        }
        const entry = dateMap.get(date)!;
        if (!entry.heartRate) {
          entry.heartRate = { resting: 0, hrv: 0 };
        }
        entry.heartRate.resting = hr.value?.restingHeartRate || 0;
      });
    }

    if (hrvData?.hrv) {
      hrvData.hrv.forEach((hrv) => {
        const date = hrv.dateTime.includes('T') ? hrv.dateTime.split('T')[0] : hrv.dateTime;
        if (!dateMap.has(date)) {
          dateMap.set(date, { date });
        }
        const entry = dateMap.get(date)!;
        if (!entry.heartRate) {
          entry.heartRate = { resting: 0, hrv: 0 };
        }
        entry.heartRate.hrv = hrv.value?.dailyRmssd || hrv.value?.deepRmssd || 0;
      });
    }

    if (activityData?.activities) {
      activityData.activities.forEach((activity) => {
        const date = activity.dateTime;
        if (!dateMap.has(date)) {
          dateMap.set(date, { date });
        }
        const entry = dateMap.get(date)!;
        entry.activity = {
          steps: activity.summary?.steps || 0,
          activeMinutes:
            (activity.summary?.veryActiveMinutes || 0) +
            (activity.summary?.fairlyActiveMinutes || 0),
          calories: activity.summary?.caloriesOut || 0,
        };
      });
    }

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  } catch (error) {
    console.error('Error fetching wellness data:', error);
    throw error;
  }
}

export interface TrendAnalysis {
  metric: string;
  current7DayAvg: number;
  baseline30DayAvg: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'stable';
}

export function calculateTrends(
  wellnessData: WellnessData[]
): TrendAnalysis[] {
  if (wellnessData.length < 7) {
    return [];
  }

  const last7Days = wellnessData.slice(-7);
  const last30Days = wellnessData.slice(-30);

  const trends: TrendAnalysis[] = [];

  const sleep7Day = last7Days
    .map((d) => d.sleep?.hours || 0)
    .filter((h) => h > 0);
  const sleep30Day = last30Days
    .map((d) => d.sleep?.hours || 0)
    .filter((h) => h > 0);

  if (sleep7Day.length > 0 && sleep30Day.length > 0) {
    const avg7 = sleep7Day.reduce((a, b) => a + b, 0) / sleep7Day.length;
    const avg30 = sleep30Day.reduce((a, b) => a + b, 0) / sleep30Day.length;
    const change = avg30 > 0 ? ((avg7 - avg30) / avg30) * 100 : 0;

    trends.push({
      metric: 'sleep',
      current7DayAvg: avg7,
      baseline30DayAvg: avg30,
      change,
      changeType: change > 5 ? 'increase' : change < -5 ? 'decrease' : 'stable',
    });
  }

  const hrv7Day = last7Days
    .map((d) => d.heartRate?.hrv || 0)
    .filter((h) => h > 0);
  const hrv30Day = last30Days
    .map((d) => d.heartRate?.hrv || 0)
    .filter((h) => h > 0);

  if (hrv7Day.length > 0 && hrv30Day.length > 0) {
    const avg7 = hrv7Day.reduce((a, b) => a + b, 0) / hrv7Day.length;
    const avg30 = hrv30Day.reduce((a, b) => a + b, 0) / hrv30Day.length;
    const change = avg30 > 0 ? ((avg7 - avg30) / avg30) * 100 : 0;

    trends.push({
      metric: 'hrv',
      current7DayAvg: avg7,
      baseline30DayAvg: avg30,
      change,
      changeType: change > 5 ? 'increase' : change < -5 ? 'decrease' : 'stable',
    });
  }

  const rhr7Day = last7Days
    .map((d) => d.heartRate?.resting || 0)
    .filter((h) => h > 0);
  const rhr30Day = last30Days
    .map((d) => d.heartRate?.resting || 0)
    .filter((h) => h > 0);

  if (rhr7Day.length > 0 && rhr30Day.length > 0) {
    const avg7 = rhr7Day.reduce((a, b) => a + b, 0) / rhr7Day.length;
    const avg30 = rhr30Day.reduce((a, b) => a + b, 0) / rhr30Day.length;
    const change = avg30 > 0 ? ((avg7 - avg30) / avg30) * 100 : 0;

    trends.push({
      metric: 'restingHeartRate',
      current7DayAvg: avg7,
      baseline30DayAvg: avg30,
      change,
      changeType: change < -5 ? 'increase' : change > 5 ? 'decrease' : 'stable',
    });
  }

  const activity7Day = last7Days
    .map((d) => d.activity?.activeMinutes || 0)
    .filter((m) => m > 0);
  const activity30Day = last30Days
    .map((d) => d.activity?.activeMinutes || 0)
    .filter((m) => m > 0);

  if (activity7Day.length > 0 && activity30Day.length > 0) {
    const avg7 = activity7Day.reduce((a, b) => a + b, 0) / activity7Day.length;
    const avg30 = activity30Day.reduce((a, b) => a + b, 0) / activity30Day.length;
    const change = avg30 > 0 ? ((avg7 - avg30) / avg30) * 100 : 0;

    trends.push({
      metric: 'activity',
      current7DayAvg: avg7,
      baseline30DayAvg: avg30,
      change,
      changeType: change > 5 ? 'increase' : change < -5 ? 'decrease' : 'stable',
    });
  }

  return trends;
}
