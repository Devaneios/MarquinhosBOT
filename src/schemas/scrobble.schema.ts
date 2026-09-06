import { z } from 'zod';

export const playbackDataSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
  listeningUsersId: z.array(z.string()),
  timestamp: z.string().or(z.date()), // Assuming JSON ISO string
  guildId: z.string(),
  channelId: z.string(),
  providerName: z.string(),
});

export const addScrobbleToQueueSchema = z.object({
  body: z.object({
    playbackData: playbackDataSchema,
  }),
});
