export const FITBIT_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_FITBIT_CLIENT_ID,
  clientSecret: process.env.EXPO_PUBLIC_FITBIT_CLIENT_SECRET ,
  redirectUri: process.env.EXPO_PUBLIC_FITBIT_REDIRECT_URI,
  authorizationUri: 'https://www.fitbit.com/oauth2/authorize',
  tokenUri: 'https://api.fitbit.com/oauth2/token',
  apiBaseUrl: 'https://api.fitbit.com/1/user/-',
  scopes: [
    'activity',
    'heartrate',
    'sleep',
    'profile',
  ].join(' '),
};

export const FITBIT_STORAGE_KEYS = {
  accessToken: 'fitbit_access_token',
  refreshToken: 'fitbit_refresh_token',
  expiresAt: 'fitbit_expires_at',
  userId: 'fitbit_user_id',
};
