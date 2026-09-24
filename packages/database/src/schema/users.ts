import { bigint, boolean, index, pgTable, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  lastfm_session_token: text('lastfm_session_token'),
  lastfm_username: text('lastfm_username'),
  scrobbles_on: boolean('scrobbles_on'),
  updated_at: bigint('updated_at', { mode: 'number' }),
});

export const scrobblesQueue = pgTable(
  'scrobbles_queue',
  {
    id: text('id').primaryKey(),
    track: text('track').notNull(),
    playback_data: text('playback_data').notNull(),
    created_at: bigint('created_at', { mode: 'number' }).notNull(),
  },
  (t) => [index('idx_scrobbles_queue_ttl').on(t.created_at)],
);
