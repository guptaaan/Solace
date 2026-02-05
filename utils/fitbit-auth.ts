import { FITBIT_CONFIG, FITBIT_STORAGE_KEYS } from '@/constants/fitbit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import 'react-native-get-random-values';

WebBrowser.maybeCompleteAuthSession();

function getRedirectUri(): string {
  if (FITBIT_CONFIG.redirectUri) return FITBIT_CONFIG.redirectUri;
  if (Platform.OS === 'web') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin ? `${origin}/` : '';
  }
  return Linking.createURL('');
}

function base64Encode(str: string): string {
  if (Platform.OS === 'web' && typeof btoa !== 'undefined') {
    return btoa(str);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64');
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let result = '';
  let i = 0;
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;
    const bitmap = (a << 16) | (b << 8) | c;
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < str.length ? chars.charAt(bitmap & 63) : '=';
  }
  return result;
}

export interface FitbitTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

export function getFitbitAuthUrl(redirectUri?: string): string {
  const params = new URLSearchParams({
    client_id: FITBIT_CONFIG.clientId || '',
    response_type: 'code',
    scope: FITBIT_CONFIG.scopes,
    redirect_uri: redirectUri || FITBIT_CONFIG.redirectUri || '',
  });

  return `${FITBIT_CONFIG.authorizationUri}?${params.toString()}`;
}

async function exchangeCodeForToken(code: string, redirectUri: string): Promise<FitbitTokens> {
  const credentials = `${FITBIT_CONFIG.clientId}:${FITBIT_CONFIG.clientSecret}`;
  const base64Credentials = base64Encode(credentials);

  const response = await fetch(FITBIT_CONFIG.tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${base64Credentials}`,
    },
    body: new URLSearchParams({
      client_id: FITBIT_CONFIG.clientId || '',
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }).toString(),
  }).catch((error) => {
    console.error('Network error during token exchange:', error);
    throw new Error('Failed to connect to Fitbit. Please check your internet connection.');
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    user_id: data.user_id,
  };
}

export async function refreshFitbitToken(): Promise<FitbitTokens> {
  const refreshToken = await AsyncStorage.getItem(FITBIT_STORAGE_KEYS.refreshToken);
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const clientId = FITBIT_CONFIG.clientId || '';
  const clientSecret = FITBIT_CONFIG.clientSecret || '';
  const credentials = `${clientId}:${clientSecret}`;
  const base64Credentials = base64Encode(credentials);

  const response = await fetch(FITBIT_CONFIG.tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${base64Credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
    user_id: data.user_id,
  };
}

export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = await AsyncStorage.getItem(FITBIT_STORAGE_KEYS.accessToken);
  const expiresAt = await AsyncStorage.getItem(FITBIT_STORAGE_KEYS.expiresAt);

  if (!accessToken) {
    return null;
  }

  if (expiresAt) {
    const expiresAtTime = parseInt(expiresAt, 10);
    const now = Date.now();
    const buffer = 5 * 60 * 1000;

    if (now >= expiresAtTime - buffer) {
      try {
        const newTokens = await refreshFitbitToken();
        await saveFitbitTokens(newTokens);
        return newTokens.access_token;
      } catch (error) {
        console.error('Failed to refresh token:', error);
        return null;
      }
    }
  }

  return accessToken;
}

export async function saveFitbitTokens(tokens: FitbitTokens): Promise<void> {
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  await AsyncStorage.multiSet([
    [FITBIT_STORAGE_KEYS.accessToken, tokens.access_token],
    [FITBIT_STORAGE_KEYS.refreshToken, tokens.refresh_token],
    [FITBIT_STORAGE_KEYS.expiresAt, expiresAt.toString()],
    [FITBIT_STORAGE_KEYS.userId, tokens.user_id],
  ]);
}

/**
 * Clear Fitbit tokens from storage
 */
export async function clearFitbitTokens(): Promise<void> {
  await AsyncStorage.multiRemove([
    FITBIT_STORAGE_KEYS.accessToken,
    FITBIT_STORAGE_KEYS.refreshToken,
    FITBIT_STORAGE_KEYS.expiresAt,
    FITBIT_STORAGE_KEYS.userId,
  ]);
}

export async function isFitbitConnected(): Promise<boolean> {
  const accessToken = await AsyncStorage.getItem(FITBIT_STORAGE_KEYS.accessToken);
  return !!accessToken;
}

export async function connectFitbit(): Promise<boolean> {
  try {
    const redirectUri = getRedirectUri();
    const authUrl = getFitbitAuthUrl(redirectUri);

    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      redirectUri
    );

    if (result.type === 'success' && result.url) {
      let code: string | null = null;

      if (Platform.OS === 'web') {
        const url = new URL(result.url);
        code = url.searchParams.get('code');
      } else {
        const parsed = Linking.parse(result.url);
        code = parsed.queryParams?.code as string | null;
      }

      if (code) {
        const tokens = await exchangeCodeForToken(code, redirectUri);
        await saveFitbitTokens(tokens);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Fitbit connection error:', error);
    throw error;
  }
}


export async function disconnectFitbit(): Promise<void> {
  await clearFitbitTokens();
}
