import type { LastfmTopListenedPeriod } from 'types';
import { z } from 'zod';

const LASTFM_TOP_LISTENED_PERIODS = [
  '7day',
  '1month',
  '3month',
  '6month',
  '12month',
  'overall',
] as const satisfies readonly LastfmTopListenedPeriod[];

export const userIdParamsSchema = z.object({ id: z.string().min(1) });

export const userTopListenedParamsSchema = z.object({
  id: z.string().min(1),
  period: z.enum(LASTFM_TOP_LISTENED_PERIODS),
});

export const enableLastfmBodySchema = z.object({ token: z.string().min(1) });
