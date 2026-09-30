import { db } from './index.ts';
import { users, weatherVibeLogs, savedPins } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName ? { displayName } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed for getOrCreateUser:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function logWeatherVibe(data: {
  userId?: string;
  landmarkName: string;
  zone: string;
  temperature: string;
  humidity: string;
  wind?: string;
  vibeIndex: string;
  vibeTitle: string;
  moodCategory: string;
  trendData?: any;
}) {
  try {
    const result = await db
      .insert(weatherVibeLogs)
      .values({
        userId: data.userId || null,
        landmarkName: data.landmarkName,
        zone: data.zone,
        temperature: data.temperature,
        humidity: data.humidity,
        wind: data.wind || null,
        vibeIndex: data.vibeIndex,
        vibeTitle: data.vibeTitle,
        moodCategory: data.moodCategory,
        trendData: data.trendData || null,
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed for logWeatherVibe:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getRecentWeatherVibeLogs(limit = 10) {
  try {
    return await db.select().from(weatherVibeLogs).orderBy(desc(weatherVibeLogs.createdAt)).limit(limit);
  } catch (error) {
    console.error('Database query failed for getRecentWeatherVibeLogs:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
