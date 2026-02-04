import { ENDPOINTS } from '@/constants/aws-api';
import { WellnessData } from './fitbit-api';

export async function syncFitbitDataToAWS(
  userId: string,
  wellnessData: WellnessData[]
): Promise<void> {
  try {
    const response = await fetch(ENDPOINTS.fitbit, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        wellnessData,
        syncedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to sync Fitbit data: ${error}`);
    }
  } catch (error) {
    console.error('Error syncing Fitbit data to AWS:', error);
    throw error;
  }
}

export async function getFitbitDataFromAWS(userId: string): Promise<WellnessData[]> {
  try {
    const response = await fetch(`${ENDPOINTS.fitbit}?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch Fitbit data: ${error}`);
    }

    const data = await response.json();
    return data.wellnessData || [];
  } catch (error) {
    console.error('Error fetching Fitbit data from AWS:', error);
    throw error;
  }
}
