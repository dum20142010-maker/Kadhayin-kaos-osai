import { pgTable, text, serial, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  username: text('username'),
  bio: text('bio'),
  hapticIntensity: text('haptic_intensity').default('Medium'),
  activeMood: text('active_mood').default('balanced'),
  isVip: boolean('is_vip').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const weatherVibeLogs = pgTable('weather_vibe_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id'),
  landmarkName: text('landmark_name').notNull(),
  zone: text('zone').notNull(),
  temperature: text('temperature').notNull(),
  humidity: text('humidity').notNull(),
  wind: text('wind'),
  vibeIndex: text('vibe_index').notNull(),
  vibeTitle: text('vibe_title').notNull(),
  moodCategory: text('mood_category').notNull(),
  trendData: jsonb('trend_data'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const savedPins = pgTable('saved_pins', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  lat: text('lat').notNull(),
  lng: text('lng').notNull(),
  note: text('note').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  weatherLogs: many(weatherVibeLogs),
  pins: many(savedPins),
}));

export const weatherLogsRelations = relations(weatherVibeLogs, ({ one }) => ({
  user: one(users, {
    fields: [weatherVibeLogs.userId],
    references: [users.uid],
  }),
}));

export const savedPinsRelations = relations(savedPins, ({ one }) => ({
  user: one(users, {
    fields: [savedPins.userId],
    references: [users.uid],
  }),
}));
