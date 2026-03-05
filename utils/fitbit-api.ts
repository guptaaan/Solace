import { FITBIT_CONFIG } from '@/constants/fitbit';
import { getValidAccessToken } from './fitbit-auth';

export interface SleepData {
  dateOfSleep: string;
  duration: number;
  efficiency: number;
  minutesAsleep: number;
  minutesAwake: number;
  minutesToFallAsleep?: number;
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

async function fitbitRequest<T>(
  endpoint: string,
  options?: { baseUrl?: string }
): Promise<T> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error('Not connected to Fitbit. Please connect your Fitbit account.');
  }
  const base = options?.baseUrl ?? FITBIT_CONFIG.apiBaseUrl;
  const response = await fetch(`${base}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
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

/** HRV Summary by Interval — single call for date range (max 30 days). */
export async function getHeartRateVariabilityData(
  startDate: string,
  endDate: string
): Promise<{ hrv: HeartRateVariabilityData[] }> {
  return fitbitRequest<{ hrv: HeartRateVariabilityData[] }>(
    `/hrv/date/${startDate}/${endDate}.json`
  ).catch(() => ({ hrv: [] }));
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
): Promise<{ activities: ActivityData[] }> {
  const dates = listDates(startDate, endDate);
  const results = await Promise.all(
    dates.map(async (date) => {
      const data = await fitbitRequest<Omit<ActivityData, 'dateTime'>>(
        `/activities/date/${date}.json`
      );
      return { ...(data as any), dateTime: date } as ActivityData;
    })
  );
  return { activities: results };
}

/** Activity Time Series by Date Range — one resource per call (max 30 days for some). */
const ACTIVITY_TIME_SERIES_RESOURCES = [
  'steps',
  'calories',
  'distance',
  'minutesVeryActive',
  'minutesFairlyActive',
  'minutesLightlyActive',
  'minutesSedentary',
  'floors',
] as const;

export type ActivityTimeSeriesResource = (typeof ACTIVITY_TIME_SERIES_RESOURCES)[number];

interface ActivityTimeSeriesPoint {
  dateTime: string;
  value: string;
}

export async function getActivityTimeSeries(
  resource: ActivityTimeSeriesResource,
  startDate: string,
  endDate: string
): Promise<{ [key: string]: ActivityTimeSeriesPoint[] }> {
  const key = `activities-${resource}`;
  return fitbitRequest(`/activities/${resource}/date/${startDate}/${endDate}.json`).catch(() => ({
    [key]: [],
  })) as Promise<{ [key: string]: ActivityTimeSeriesPoint[] }>;
}

/** Fetch all activity time series in parallel for a date range. */
export async function getActivityTimeSeriesBatch(
  startDate: string,
  endDate: string
): Promise<Map<string, Record<string, number>>> {
  const results = await Promise.allSettled(
    ACTIVITY_TIME_SERIES_RESOURCES.map((r) => getActivityTimeSeries(r, startDate, endDate))
  );
  const dateMap = new Map<string, Record<string, number>>();
  const dates = listDates(startDate, endDate);
  dates.forEach((d) => dateMap.set(d, {}));

  results.forEach((settled, i) => {
    if (settled.status !== 'fulfilled') return;
    const resource = ACTIVITY_TIME_SERIES_RESOURCES[i];
    const key = `activities-${resource}`;
    const arr = settled.value[key] ?? [];
    arr.forEach((p: ActivityTimeSeriesPoint) => {
      const date = p.dateTime?.slice?.(0, 10) ?? p.dateTime;
      if (!dateMap.has(date)) dateMap.set(date, {});
      const row = dateMap.get(date)!;
      const num = parseFloat(p.value);
      row[resource] = isNaN(num) ? 0 : num;
    });
  });
  return dateMap;
}

/** Active Zone Minutes by date range (scope: activity). */
export interface ActiveZoneMinutesPoint {
  dateTime: string;
  value: {
    activeZoneMinutes: number;
    fatBurnActiveZoneMinutes: number;
    cardioActiveZoneMinutes: number;
    peakActiveZoneMinutes: number;
  };
}

export async function getActiveZoneMinutesData(
  startDate: string,
  endDate: string
): Promise<{ 'activities-active-zone-minutes': ActiveZoneMinutesPoint[] }> {
  const out: { 'activities-active-zone-minutes': ActiveZoneMinutesPoint[] } = {
    'activities-active-zone-minutes': [],
  };
  try {
    return await fitbitRequest(
      `/activities/active-zone-minutes/date/${startDate}/${endDate}.json`
    );
  } catch {
    return out;
  }
}

/** Daily or weekly activity goals (scope: activity). */
export interface ActivityGoals {
  goals: {
    activeMinutes?: number;
    activeZoneMinutes?: number;
    caloriesOut?: number;
    distance?: number;
    floors?: number;
    steps?: number;
  };
}

export async function getActivityGoals(
  period: 'daily' | 'weekly'
): Promise<ActivityGoals> {
  return fitbitRequest<ActivityGoals>(`/activities/goals/${period}.json`).catch(() => ({
    goals: {},
  }));
}

/** Devices paired to the user (for last sync). */
export interface FitbitDevice {
  id: string;
  deviceVersion: string;
  batteryLevel?: string;
  battery?: string;
  lastSyncTime?: string;
  type: string;
}

export async function getDevices(): Promise<FitbitDevice[]> {
  try {
    const res = await fitbitRequest<{ devices?: FitbitDevice[] }>('/devices.json');
    return res?.devices ?? [];
  } catch {
    return [];
  }
}

export interface WellnessData {
  date: string;
  sleep?: {
    hours: number;
    efficiency: number;
    deepSleepMinutes: number;
    remSleepMinutes: number;
    lightSleepMinutes: number;
    timeInBedMinutes: number;
    minutesAwake: number;
    minutesToFallAsleep: number;
  };
  heartRate?: {
    resting: number;
    hrv: number;
  };
  activity?: {
    steps: number;
    activeMinutes: number;
    calories: number;
    distance: number;
    floors: number;
    veryActiveMinutes: number;
    fairlyActiveMinutes: number;
    lightlyActiveMinutes: number;
    sedentaryMinutes: number;
    activeZoneMinutes: number;
    fatBurnActiveZoneMinutes: number;
    cardioActiveZoneMinutes: number;
    peakActiveZoneMinutes: number;
  };
}

export async function getWellnessData(
  startDate: string,
  endDate: string
): Promise<WellnessData[]> {
  try {
    const results = await Promise.allSettled([
      getSleepData(startDate, endDate),
      getRestingHeartRateData(startDate, endDate),
      getHeartRateVariabilityData(startDate, endDate),
      getActivityTimeSeriesBatch(startDate, endDate),
      getActiveZoneMinutesData(startDate, endDate),
    ]);

    const sleepData = results[0].status === 'fulfilled' ? results[0].value : null;
    const heartRateData = results[1].status === 'fulfilled' ? results[1].value : null;
    const hrvData = results[2].status === 'fulfilled' ? results[2].value : null;
    const activityTimeSeriesMap = results[3].status === 'fulfilled' ? results[3].value : null;
    const azmData = results[4].status === 'fulfilled' ? results[4].value : null;

    const errors = results
      .map((r) => (r.status === 'rejected' ? r.reason : null))
      .filter(Boolean);

    const dateMap = new Map<string, WellnessData>();
    listDates(startDate, endDate).forEach((date) => {
      dateMap.set(date, { date });
    });

    if (sleepData?.sleep) {
      sleepData.sleep.forEach((sleep) => {
        const date = sleep.dateOfSleep;
        if (!dateMap.has(date)) dateMap.set(date, { date });
        const entry = dateMap.get(date)!;
        const summary = sleep.levels?.summary;
        entry.sleep = {
          hours: sleep.minutesAsleep / 60,
          efficiency: sleep.efficiency,
          deepSleepMinutes: summary?.deep?.minutes ?? 0,
          remSleepMinutes: summary?.rem?.minutes ?? 0,
          lightSleepMinutes: summary?.light?.minutes ?? 0,
          timeInBedMinutes: sleep.timeInBed ?? 0,
          minutesAwake: sleep.minutesAwake ?? 0,
          minutesToFallAsleep: sleep.minutesToFallAsleep ?? 0,
        };
      });
    }

    if (heartRateData?.['activities-heart']) {
      heartRateData['activities-heart'].forEach((hr) => {
        const date = hr.dateTime;
        if (!dateMap.has(date)) dateMap.set(date, { date });
        const entry = dateMap.get(date)!;
        if (!entry.heartRate) entry.heartRate = { resting: 0, hrv: 0 };
        entry.heartRate.resting = hr.value?.restingHeartRate ?? 0;
      });
    }

    if (hrvData?.hrv) {
      hrvData.hrv.forEach((hrv) => {
        const date = hrv.dateTime?.includes?.('T') ? hrv.dateTime.split('T')[0] : hrv.dateTime;
        if (!dateMap.has(date)) dateMap.set(date, { date });
        const entry = dateMap.get(date)!;
        if (!entry.heartRate) entry.heartRate = { resting: 0, hrv: 0 };
        entry.heartRate.hrv = hrv.value?.dailyRmssd ?? hrv.value?.deepRmssd ?? 0;
      });
    }

    if (activityTimeSeriesMap) {
      activityTimeSeriesMap.forEach((row, date) => {
        if (!dateMap.has(date)) dateMap.set(date, { date });
        const entry = dateMap.get(date)!;
        const very = row.minutesVeryActive ?? 0;
        const fairly = row.minutesFairlyActive ?? 0;
        const lightly = row.minutesLightlyActive ?? 0;
        entry.activity = {
          steps: row.steps ?? 0,
          activeMinutes: very + fairly,
          calories: row.calories ?? 0,
          distance: row.distance ?? 0,
          floors: row.floors ?? 0,
          veryActiveMinutes: very,
          fairlyActiveMinutes: fairly,
          lightlyActiveMinutes: lightly,
          sedentaryMinutes: row.minutesSedentary ?? 0,
          activeZoneMinutes: entry.activity?.activeZoneMinutes ?? 0,
          fatBurnActiveZoneMinutes: entry.activity?.fatBurnActiveZoneMinutes ?? 0,
          cardioActiveZoneMinutes: entry.activity?.cardioActiveZoneMinutes ?? 0,
          peakActiveZoneMinutes: entry.activity?.peakActiveZoneMinutes ?? 0,
        };
      });
    }

    if (azmData?.['activities-active-zone-minutes']) {
      const defaultActivity = (): WellnessData['activity'] => ({
        steps: 0,
        activeMinutes: 0,
        calories: 0,
        distance: 0,
        floors: 0,
        veryActiveMinutes: 0,
        fairlyActiveMinutes: 0,
        lightlyActiveMinutes: 0,
        sedentaryMinutes: 0,
        activeZoneMinutes: 0,
        fatBurnActiveZoneMinutes: 0,
        cardioActiveZoneMinutes: 0,
        peakActiveZoneMinutes: 0,
      });
      azmData['activities-active-zone-minutes'].forEach((azm) => {
        const date = azm.dateTime?.slice?.(0, 10) ?? azm.dateTime;
        if (!dateMap.has(date)) dateMap.set(date, { date });
        const entry = dateMap.get(date)!;
        if (!entry.activity) entry.activity = defaultActivity();
        const act = entry.activity!;
        act.activeZoneMinutes = azm.value?.activeZoneMinutes ?? 0;
        act.fatBurnActiveZoneMinutes = azm.value?.fatBurnActiveZoneMinutes ?? 0;
        act.cardioActiveZoneMinutes = azm.value?.cardioActiveZoneMinutes ?? 0;
        act.peakActiveZoneMinutes = azm.value?.peakActiveZoneMinutes ?? 0;
      });
    }

    const out = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const hasAny =
      out.some((d) => (d.sleep?.hours ?? 0) > 0) ||
      out.some((d) => (d.heartRate?.resting ?? 0) > 0) ||
      out.some((d) => (d.heartRate?.hrv ?? 0) > 0) ||
      out.some((d) => (d.activity?.activeMinutes ?? 0) > 0) ||
      out.some((d) => (d.activity?.steps ?? 0) > 0);

    if (!hasAny && errors.length) {
      throw errors[0] as Error;
    }

    return out;
  } catch (error) {
    console.error('Error fetching wellness data:', error);
    throw error;
  }
}

/** Format wellness data as a text summary for the AI assistant (mental health context). */
export function formatWellnessDataForGemini(
  wellnessData: WellnessData[],
  options?: { goalsDaily?: ActivityGoals['goals']; goalsWeekly?: ActivityGoals['goals'] }
): string {
  if (!wellnessData?.length) return '';

  const lines: string[] = ['Current user wellness data (use to personalize mental health support):'];
  const last7 = wellnessData.slice(-7);
  const latest = wellnessData[wellnessData.length - 1];

  const fmt = (n: number, decimals = 0) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(decimals));
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  if (latest?.sleep) {
    const s = latest.sleep;
    lines.push(
      `Sleep (latest night): total ${fmt(s.hours, 1)}h, efficiency ${fmt(s.efficiency)}%, time in bed ${fmt(s.timeInBedMinutes)} min, deep ${fmt(s.deepSleepMinutes)} min, REM ${fmt(s.remSleepMinutes)} min, light ${fmt(s.lightSleepMinutes)} min, awake during night ${fmt(s.minutesAwake)} min, time to fall asleep ${fmt(s.minutesToFallAsleep)} min.`
    );
    const sleepHours = last7.map((d) => d.sleep?.hours ?? 0).filter((h) => h > 0);
    if (sleepHours.length) {
      lines.push(`Sleep last 7 nights avg: ${fmt(avg(sleepHours), 1)}h.`);
    }
  }

  if (latest?.heartRate) {
    const h = latest.heartRate;
    lines.push(
      `Heart: resting HR ${fmt(h.resting)} bpm, HRV ${fmt(h.hrv)} ms.`
    );
    const hrvArr = last7.map((d) => d.heartRate?.hrv ?? 0).filter((v) => v > 0);
    if (hrvArr.length) {
      lines.push(`HRV last 7 days avg: ${fmt(avg(hrvArr))} ms.`);
    }
  }

  if (latest?.activity) {
    const a = latest.activity;
    lines.push(
      `Activity (latest day): steps ${fmt(a.steps)}, active minutes ${fmt(a.activeMinutes)}, calories ${fmt(a.calories)}, distance ${fmt(a.distance)} mi, floors ${fmt(a.floors)}, Active Zone Minutes ${fmt(a.activeZoneMinutes)} (fat burn ${fmt(a.fatBurnActiveZoneMinutes)}, cardio ${fmt(a.cardioActiveZoneMinutes)}, peak ${fmt(a.peakActiveZoneMinutes)}), very/fairly/lightly active ${fmt(a.veryActiveMinutes)}/${fmt(a.fairlyActiveMinutes)}/${fmt(a.lightlyActiveMinutes)} min, sedentary ${fmt(a.sedentaryMinutes)} min.`
    );
    const stepsArr = last7.map((d) => d.activity?.steps ?? 0);
    const azmArr = last7.map((d) => d.activity?.activeZoneMinutes ?? 0);
    if (stepsArr.some((s) => s > 0)) {
      lines.push(`Steps last 7 days total: ${fmt(stepsArr.reduce((x, y) => x + y, 0))}, avg ${fmt(avg(stepsArr))}.`);
    }
    if (azmArr.some((z) => z > 0)) {
      lines.push(`Active Zone Minutes last 7 days avg: ${fmt(avg(azmArr))}.`);
    }
  }

  if (options?.goalsDaily && Object.keys(options.goalsDaily).length) {
    const g = options.goalsDaily;
    lines.push(
      `Daily goals: steps ${g.steps ?? '—'}, active min ${g.activeMinutes ?? '—'}, AZM ${g.activeZoneMinutes ?? '—'}, calories ${g.caloriesOut ?? '—'}, distance ${g.distance ?? '—'} mi, floors ${g.floors ?? '—'}.`
    );
  }
  if (options?.goalsWeekly && Object.keys(options.goalsWeekly).length) {
    const g = options.goalsWeekly;
    lines.push(
      `Weekly goals: steps ${g.steps ?? '—'}, AZM ${g.activeZoneMinutes ?? '—'}, distance ${g.distance ?? '—'}, floors ${g.floors ?? '—'}.`
    );
  }

  return lines.join('\n');
}

export interface TrendAnalysis {
  metric: string;
  current7DayAvg: number;
  baseline30DayAvg: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'stable';
}

export function calculateTrends(wellnessData: WellnessData[]): TrendAnalysis[] {
  if (wellnessData.length < 7) {
    return [];
  }

  const last7Days = wellnessData.slice(-7);
  const last30Days = wellnessData.slice(-30);

  const trends: TrendAnalysis[] = [];

  const sleep7Day = last7Days.map((d) => d.sleep?.hours || 0).filter((h) => h > 0);
  const sleep30Day = last30Days.map((d) => d.sleep?.hours || 0).filter((h) => h > 0);

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

  const hrv7Day = last7Days.map((d) => d.heartRate?.hrv || 0).filter((h) => h > 0);
  const hrv30Day = last30Days.map((d) => d.heartRate?.hrv || 0).filter((h) => h > 0);

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

  const rhr7Day = last7Days.map((d) => d.heartRate?.resting || 0).filter((h) => h > 0);
  const rhr30Day = last30Days.map((d) => d.heartRate?.resting || 0).filter((h) => h > 0);

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

  const activity7Day = last7Days.map((d) => d.activity?.activeMinutes || 0).filter((m) => m > 0);
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

  const azm7Day = last7Days.map((d) => d.activity?.activeZoneMinutes ?? 0).filter((m) => m > 0);
  const azm30Day = last30Days.map((d) => d.activity?.activeZoneMinutes ?? 0).filter((m) => m > 0);
  if (azm7Day.length > 0 && azm30Day.length > 0) {
    const avg7 = azm7Day.reduce((a, b) => a + b, 0) / azm7Day.length;
    const avg30 = azm30Day.reduce((a, b) => a + b, 0) / azm30Day.length;
    const change = avg30 > 0 ? ((avg7 - avg30) / avg30) * 100 : 0;
    trends.push({
      metric: 'activeZoneMinutes',
      current7DayAvg: avg7,
      baseline30DayAvg: avg30,
      change,
      changeType: change > 5 ? 'increase' : change < -5 ? 'decrease' : 'stable',
    });
  }

  return trends;
}
