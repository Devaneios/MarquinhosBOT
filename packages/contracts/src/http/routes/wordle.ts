import { z } from 'zod';
import {
  guessRowSchema,
  letterFeedbackSchema,
  wordleAchievementUpdateSchema,
  wordleAchievementsOverviewSchema,
  wordleDraftWriteResultSchema,
  wordleDraftWriteSchema,
  wordleGoalBadgeSchema,
  wordlePatternEvidenceSchema,
  wordleUserConfigSchema,
} from '../../wordle';
import { defineContract, envelope } from '../contract';

const requiredString = z.string().min(1);
const guildParams = z.object({ guildId: requiredString });
const userGuildParams = z.object({
  userId: requiredString,
  guildId: requiredString,
});

export const wordleGuessResultSchema = z.object({
  guess: z.string(),
  feedback: z.array(letterFeedbackSchema),
  guesses: z.array(guessRowSchema),
  solved: z.boolean(),
  attempts: z.number(),
  wordLength: z.number(),
  streak: z.number().optional(),
  achievementBaseline: z.array(z.string()).optional(),
  requestId: z.uuid().optional(),
  achievementUpdate: wordleAchievementUpdateSchema.optional(),
});
export type WordleGuessResult = z.output<typeof wordleGuessResultSchema>;

export const wordleDailyStatsSchema = z.object({
  wordDate: z.string(),
  wordLength: z.number(),
  playersCount: z.number(),
  winnersCount: z.number(),
  avgAttempts: z.number(),
});
export type WordleDailyStats = z.output<typeof wordleDailyStatsSchema>;

export const wordleDayGuessesSchema = z.object({
  word: z.string(),
  wordDate: z.string(),
  wordLength: z.number(),
  guesses: z.array(guessRowSchema),
});
export type WordleDayGuesses = z.output<typeof wordleDayGuessesSchema>;

export const wordleSessionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  guild_id: z.string(),
  word_date: z.string(),
  guesses: z.array(guessRowSchema),
  solved: z.boolean(),
  solved_from_draft: z.boolean(),
  attempts: z.number(),
  created_at: z.number(),
});

export const forceNewWordResultSchema = z.object({
  word: z.string(),
  wordDate: z.string(),
  wordLength: z.number(),
});

export const unannouncedWordleWinSchema = z.object({
  userId: z.string(),
  guesses: z.array(guessRowSchema),
  attempts: z.number(),
});
export type UnannouncedWordleWin = z.output<typeof unannouncedWordleWinSchema>;

export const wordleReviewWordResultSchema = z.object({
  word: z.string().nullable(),
  index: z.number(),
  total: z.number(),
  done: z.boolean(),
});

export const dailyLeaderboardEntrySchema = z.object({
  userId: z.string(),
  attempts: z.number(),
  solved: z.boolean(),
  showcase: z.array(z.string()).max(3).optional(),
});
export type DailyLeaderboardEntry = z.output<
  typeof dailyLeaderboardEntrySchema
>;

export const rankedLeaderboardEntrySchema = z.object({
  userId: z.string(),
  totalDays: z.number(),
  avgScore: z.number(),
  showcase: z.array(z.string()).max(3).optional(),
});
export type RankedLeaderboardEntry = z.output<
  typeof rankedLeaderboardEntrySchema
>;

export const wordleLeaderboardPeriodSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'all-time',
]);
export type WordleLeaderboardPeriod = z.output<
  typeof wordleLeaderboardPeriodSchema
>;

const messageOnly = z.object({ message: z.string() });

const playerTags = ['Wordle player profile'] as const;
const activitySecurity = ['discordActivityBearer'] as const;
const configExample = {
  invertActionKeys: false,
  enableSounds: false,
  enableSpaceKey: true,
  enableArrowKeys: true,
};
const showcaseExample = ['wordle_v2_wins_1'];
const rewardsExample = { owned: [], title: null, frame: null, badges: [] };
const playerReadErrors = {
  401: {
    description:
      'The Activity bearer token is missing or no longer resolves to a Discord user.',
    example: { message: 'Unauthorized' },
  },
  429: {
    description: 'The caller exceeded the API request limit.',
    example: { message: 'ThrottlerException: Too Many Requests' },
  },
  500: {
    description: 'Discord identity verification or persistence failed.',
    example: { message: 'Internal Server Error' },
  },
};
const playerBodyTooLarge = {
  description: 'The JSON request exceeded the API body size limit.',
  example: { message: 'Request body too large' },
};

export const getUserConfig = defineContract({
  method: 'GET',
  path: '/api/wordle/user-config',
  response: z.object({ data: wordleUserConfigSchema }),
  docs: {
    description:
      'Read the keyboard and sound preferences stored for the authenticated Activity user. New players receive defaults with all four options disabled.',
    tags: playerTags,
    security: activitySecurity,

    success: {
      200: {
        description: 'Current Terminhos input and audio preferences.',
        example: { data: configExample },
      },
    },
    errors: playerReadErrors,
  },
});

export const updateUserConfig = defineContract({
  method: 'PUT',
  path: '/api/wordle/user-config',
  body: wordleUserConfigSchema,
  response: z.object({ data: wordleUserConfigSchema }),
  docs: {
    description:
      'Replace the authenticated player’s keyboard and sound preferences. Arrow key navigation requires the space key option to be enabled.',
    tags: playerTags,
    security: activitySecurity,
    examples: { body: configExample },
    success: {
      200: {
        description: 'Saved input and audio preferences.',
        example: { data: configExample },
      },
    },
    errors: {
      ...playerReadErrors,
      400: {
        description:
          'Preferences must satisfy the keyboard option dependency and contain boolean values.',
        example: {
          message:
            'Wordle config fields must be booleans, and arrow keys require space.',
        },
      },
      413: playerBodyTooLarge,
    },
  },
});

export const getShowcase = defineContract({
  method: 'GET',
  path: '/api/wordle/showcase',
  response: envelope(z.array(requiredString).max(3)),
  docs: {
    description:
      'Read the authenticated player’s ordered achievement showcase. It can contain up to three unlocked achievements.',
    tags: playerTags,
    security: activitySecurity,

    success: {
      200: {
        description: 'Selected achievement IDs in display order.',
        example: { data: showcaseExample },
      },
    },
    errors: playerReadErrors,
  },
});

const rewardsStateSchema = z.object({
  owned: z.array(z.string()),
  title: z.string().nullable(),
  frame: z.string().nullable(),
  badges: z.array(wordleGoalBadgeSchema),
});
export const getRewards = defineContract({
  method: 'GET',
  path: '/api/wordle/rewards',
  response: envelope(rewardsStateSchema),
  docs: {
    description:
      'Reconcile the authenticated player’s eligible rewards, then read the owned IDs, equipped title and frame, and earned community goal badges.',
    tags: playerTags,
    security: activitySecurity,

    success: {
      200: {
        description: 'Current reward inventory and equipped items.',
        example: { data: rewardsExample },
      },
    },
    errors: playerReadErrors,
  },
});

const botSecurity = ['botBearer'] as const;
const exampleGuildId = '123456789012345678';
const exampleGuild = { guildId: exampleGuildId };
const exampleUserId = '234567890123456789';
const communityTags = ['Wordle communities'] as const;
const communityMemberErrors = {
  ...playerReadErrors,
  400: {
    description: 'The guild or operation input failed validation.',
    example: { message: 'Invalid request' },
  },
  403: {
    description: 'The Discord user is outside the requested community.',
    example: { message: 'Not a community member' },
  },
  503: {
    description: 'Discord guild membership could not be verified.',
    example: { message: 'Discord membership unavailable' },
  },
};
const communityBotErrors = {
  401: {
    description: 'The bot credential was absent or invalid.',
    example: { message: 'Token not authorized' },
  },
  500: {
    description:
      'The community operation failed or the bot key is unavailable.',
    example: { message: 'Internal Server Error' },
  },
};
const eventDatesExample = { firstDate: '2026-11-23', lastDate: '2026-11-29' };
const startsAt = 1795402800000;
const endsAt = 1796007600000;
const goalExample = {
  id: '22520fba-4be6-4b83-8755-5d45428ab1a2',
  guildId: exampleGuildId,
  target: 50,
  startsAt,
  endsAt,
  status: 'active',
};
const challengeId = '3fc2dc66-26e6-4609-af38-e77c9808a46a';
const challengeExample = {
  id: challengeId,
  guildId: exampleGuildId,
  creatorId: exampleUserId,
  patternId: 'letter_a',
  opensAt: startsAt,
  closesAt: startsAt + 86400000,
  status: 'open',
  participants: [exampleUserId],
  joined: true,
};
const galleryExample = { weekKey: '2026-11-16', entries: [] };

const goalSchema = z.object({
  id: requiredString,
  guildId: requiredString,
  target: z.number().int().positive(),
  startsAt: z.number(),
  endsAt: z.number(),
  status: z.enum(['scheduled', 'active', 'finalizing', 'completed', 'expired']),
});
export const listGoals = defineContract({
  method: 'GET',
  path: '/api/wordle/goals/:guildId',
  params: guildParams,
  response: envelope(
    z.array(
      goalSchema.extend({
        progress: z.object({
          count: z.number().int().nonnegative(),
          contributors: z.array(z.string()),
        }),
      }),
    ),
  ),
  docs: {
    description:
      'Read the guild’s collective goals with counted progress and contributing players. The authenticated caller must be a member of that guild.',
    tags: communityTags,
    security: activitySecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description: 'Community goals and progress per goal.',
        example: {
          data: [
            {
              ...goalExample,
              progress: { count: 1, contributors: [exampleUserId] },
            },
          ],
        },
      },
    },
    errors: communityMemberErrors,
  },
});

const challengeSchema = z.object({
  id: requiredString,
  guildId: requiredString,
  creatorId: z.string().nullable(),
  patternId: requiredString,
  opensAt: z.number(),
  closesAt: z.number(),
  status: z.enum(['open', 'closed']),
  participants: z.array(z.string()),
  joined: z.boolean(),
});
export const listChallenges = defineContract({
  method: 'GET',
  path: '/api/wordle/challenges/:guildId',
  params: guildParams,
  response: envelope(z.array(challengeSchema)),
  docs: {
    description:
      'Read a guild’s pattern challenges and whether the authenticated member has joined each one.',
    tags: communityTags,
    security: activitySecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description:
          'Challenge windows, participants, and the caller’s join state.',
        example: { data: [challengeExample] },
      },
    },
    errors: communityMemberErrors,
  },
});
export const createChallenge = defineContract({
  method: 'POST',
  path: '/api/wordle/challenges/:guildId',
  params: guildParams,
  body: z
    .object({
      patternId: requiredString,
      closesAt: z.number().int().positive(),
    })
    .strict(),
  response: envelope(challengeSchema),
  docs: {
    description:
      'Start a guild challenge for a pattern the authenticated member has unlocked. The API checks the closing time and applies limits to open challenges and recent challenges by that member.',
    tags: communityTags,
    security: activitySecurity,
    examples: {
      params: exampleGuild,
      body: {
        patternId: challengeExample.patternId,
        closesAt: challengeExample.closesAt,
      },
    },
    success: {
      201: {
        description: 'Created challenge and its membership state.',
        example: { data: challengeExample },
      },
    },
    errors: {
      ...communityMemberErrors,
      400: {
        description:
          'The pattern, closing time, ownership, or creation limit did not permit this challenge.',
        example: { message: 'Pattern not unlocked' },
      },
      413: playerBodyTooLarge,
    },
  },
});
export const joinChallenge = defineContract({
  method: 'POST',
  path: '/api/wordle/challenges/:guildId/:challengeId/join',
  params: z.object({ guildId: requiredString, challengeId: requiredString }),
  response: envelope(z.object({ joined: z.literal(true) })),
  docs: {
    description:
      'Enroll the authenticated guild member in an open pattern challenge. A repeated join is treated as the same membership.',
    tags: communityTags,
    security: activitySecurity,
    examples: { params: { ...exampleGuild, challengeId } },
    success: {
      200: {
        description: 'The member is enrolled in the challenge.',
        example: { data: { joined: true } },
      },
    },
    errors: {
      ...communityMemberErrors,
      400: {
        description:
          'The challenge was missing, closed, or invalid for this guild.',
        example: { message: 'Challenge closed or missing' },
      },
    },
  },
});

const bingoConditionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('participation'),
    target: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal('pattern'),
    family: requiredString,
    target: z.number().int().positive(),
  }),
]);
const bingoCardSchema = z.object({
  id: requiredString,
  guildId: requiredString,
  version: z.number().int().positive(),
  startsAt: z.number(),
  endsAt: z.number(),
  allowMulti: z.boolean(),
  status: z.enum(['scheduled', 'active', 'closed']),
  cells: z
    .array(z.object({ id: requiredString, condition: bingoConditionSchema }))
    .length(9),
  progress: z.object({
    counts: z.array(z.number().int().nonnegative()).length(9),
    filled: z.array(z.boolean()).length(9),
    lines: z.array(z.array(z.number().int().min(0).max(8)).length(3)),
    complete: z.boolean(),
  }),
});
const bingoExample = {
  id: '9da53a03-c7c0-4296-a3b6-d6c8d7a63c13',
  guildId: exampleGuildId,
  version: 1,
  startsAt,
  endsAt,
  allowMulti: false,
  status: 'active',
  cells: [
    { id: 'participation_1', condition: { kind: 'participation', target: 1 } },
    {
      id: 'letter_1',
      condition: { kind: 'pattern', family: 'letter', target: 1 },
    },
    { id: 'participation_3', condition: { kind: 'participation', target: 3 } },
    {
      id: 'digit_1',
      condition: { kind: 'pattern', family: 'digit', target: 1 },
    },
    {
      id: 'shape_1',
      condition: { kind: 'pattern', family: 'shape', target: 1 },
    },
    {
      id: 'tetromino_1',
      condition: { kind: 'pattern', family: 'tetromino', target: 1 },
    },
    { id: 'participation_5', condition: { kind: 'participation', target: 5 } },
    {
      id: 'letter_2',
      condition: { kind: 'pattern', family: 'letter', target: 2 },
    },
    { id: 'participation_7', condition: { kind: 'participation', target: 7 } },
  ],
  progress: {
    counts: Array.from({ length: 9 }, () => 0),
    filled: Array.from({ length: 9 }, () => false),
    lines: [],
    complete: false,
  },
};

export const listBingo = defineContract({
  method: 'GET',
  path: '/api/wordle/bingo/:guildId',
  params: guildParams,
  response: envelope(z.array(bingoCardSchema)),
  docs: {
    description:
      'Read the guild’s bingo cards, public cell conditions, and collective progress, including filled lines.',
    tags: communityTags,
    security: activitySecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description:
          'Cards for the guild with nine cells each and progress snapshots.',
        example: { data: [bingoExample] },
      },
    },
    errors: communityMemberErrors,
  },
});
export const createBingo = defineContract({
  method: 'POST',
  path: '/api/wordle/admin/bingo',
  body: z
    .object({
      guildId: requiredString,
      firstDate: z.iso.date(),
      lastDate: z.iso.date(),
      allowMulti: z.boolean(),
    })
    .strict(),
  response: envelope(bingoCardSchema),
  docs: {
    description:
      'Publish a new bingo card for an inclusive Wordle calendar date range. The allowMulti flag controls whether a single qualifying event may contribute to multiple cells.',
    tags: communityTags,
    security: botSecurity,
    examples: {
      body: { ...exampleGuild, ...eventDatesExample, allowMulti: false },
    },
    success: {
      201: {
        description: 'New card with generated conditions and current progress.',
        example: { data: bingoExample },
      },
    },
    errors: {
      ...communityBotErrors,
      400: {
        description: 'The guild, date range, or card options are invalid.',
        example: { message: 'Invalid bingo dates' },
      },
      413: playerBodyTooLarge,
    },
  },
});

const gallerySchema = z.object({
  weekKey: z.iso.date(),
  entries: z.array(
    z.object({
      userId: requiredString,
      family: requiredString,
      date: z.iso.date(),
      sourceAt: z.number(),
      patternId: requiredString,
      name: requiredString,
      evidence: wordlePatternEvidenceSchema,
    }),
  ),
});
export const getGallery = defineContract({
  method: 'GET',
  path: '/api/wordle/gallery/:guildId',
  params: guildParams,
  response: envelope(gallerySchema),
  docs: {
    description:
      'Read the pattern gallery for the most recent completed Wordle week in this guild. Access requires current Discord guild membership.',
    tags: communityTags,
    security: activitySecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description: 'Gallery for the completed week, which can be empty.',
        example: { data: galleryExample },
      },
    },
    errors: communityMemberErrors,
  },
});
export const getBotGallery = defineContract({
  method: 'GET',
  path: '/api/wordle/admin/gallery/:guildId',
  params: guildParams,
  query: z.object({ week: z.iso.date() }),
  response: envelope(gallerySchema),
  docs: {
    description:
      'Read pattern evidence for a selected completed Wordle week so the bot can render a guild recap. Use the Monday date as the week key.',
    tags: communityTags,
    security: botSecurity,
    examples: { params: exampleGuild, query: { week: galleryExample.weekKey } },
    success: {
      200: {
        description: 'Guild gallery for the selected week.',
        example: { data: galleryExample },
      },
    },
    errors: {
      ...communityBotErrors,
      400: {
        description:
          'The week key is invalid or the requested week has not closed.',
        example: { message: 'Gallery week is still open' },
      },
    },
  },
});
export const createGoal = defineContract({
  method: 'POST',
  path: '/api/wordle/admin/goals',
  body: z
    .object({
      guildId: requiredString,
      target: z.number().int().positive().max(100000),
      firstDate: z.iso.date(),
      lastDate: z.iso.date(),
    })
    .strict(),
  response: envelope(goalSchema),
  docs: {
    description:
      'Schedule a collective guild goal with a target and an inclusive Wordle calendar date range. The API stores the corresponding start and end instants.',
    tags: communityTags,
    security: botSecurity,
    examples: {
      body: {
        ...exampleGuild,
        ...eventDatesExample,
        target: goalExample.target,
      },
    },
    success: {
      201: {
        description: 'The created community goal.',
        example: { data: goalExample },
      },
    },
    errors: {
      ...communityBotErrors,
      400: {
        description:
          'The guild, target, or goal dates did not pass validation.',
        example: { message: 'Invalid goal dates or target' },
      },
      413: playerBodyTooLarge,
    },
  },
});

const notificationConfigSchema = z.object({
  channelId: z.string().min(1).nullable(),
  collective: z.boolean(),
  weekly: z.boolean(),
});
const exampleChannelId = '345678901234567890';
const notificationTags = ['Wordle notifications'] as const;
const notificationConfigExample = {
  channelId: exampleChannelId,
  collective: true,
  weekly: true,
};
const deliveryId = '24';
const leaseId = '89db4463-d60a-455c-a9ce-3d509e890a6b';
const notificationMessageId = '456789012345678901';
const weeklyEventKey = 'weekly:2026-11-16';
const notificationErrors = {
  401: {
    description: 'The bot credential was absent or invalid.',
    example: { message: 'Token not authorized' },
  },
  500: {
    description: 'The API failed to read or update the notification queue.',
    example: { message: 'Internal Server Error' },
  },
};
const notificationGuildInput = {
  description: 'The guild ID did not pass validation.',
  example: { message: 'Invalid community' },
};
const notificationBodyTooLarge = {
  description: 'The notification request exceeded the API JSON size limit.',
  example: { message: 'Request body too large' },
};

export const getNotificationConfig = defineContract({
  method: 'GET',
  path: '/api/wordle/admin/notifications/:guildId',
  params: guildParams,
  response: envelope(notificationConfigSchema),
  docs: {
    description:
      'Read the delivery channel and switches for collective milestones and weekly summaries. Unconfigured guilds return a null channel and both switches off.',
    tags: notificationTags,
    security: botSecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description: 'Current notification settings for the guild.',
        example: { data: notificationConfigExample },
      },
    },
    errors: { ...notificationErrors, 400: notificationGuildInput },
  },
});
export const setNotificationConfig = defineContract({
  method: 'PUT',
  path: '/api/wordle/admin/notifications/:guildId',
  params: guildParams,
  body: notificationConfigSchema,
  response: envelope(notificationConfigSchema),
  docs: {
    description:
      'Replace the guild’s notification settings. Individual delivery requires a channel and at least one enabled event category.',
    tags: notificationTags,
    security: botSecurity,
    examples: { params: exampleGuild, body: notificationConfigExample },
    success: {
      200: {
        description: 'The saved channel and delivery switches.',
        example: { data: notificationConfigExample },
      },
    },
    errors: {
      ...notificationErrors,
      400: {
        description: 'The guild or notification settings failed validation.',
        example: { message: 'Invalid configuration' },
      },
      413: notificationBodyTooLarge,
    },
  },
});
export const claimNotification = defineContract({
  method: 'POST',
  path: '/api/wordle/admin/notifications/:guildId/claim',
  params: guildParams,
  response: envelope(
    z
      .object({
        id: requiredString,
        eventKey: requiredString,
        kind: z.enum(['page', 'goal', 'weekly']),
        payload: z.record(z.string(), z.string()),
        status: z.literal('sending'),
        leaseId: requiredString,
        channelId: requiredString,
      })
      .nullable(),
  ),
  docs: {
    description:
      'Reserve one eligible pending notification for Discord delivery. The claim returns a lease ID that the worker must submit when settling the attempt.',
    tags: notificationTags,
    security: botSecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description:
          'A sending lease with its channel and event payload, or null when nothing is eligible.',
        example: {
          data: {
            id: deliveryId,
            eventKey: weeklyEventKey,
            kind: 'weekly',
            payload: { pages: '2', goals: '1', week: '2026-11-16' },
            status: 'sending',
            leaseId,
            channelId: exampleChannelId,
          },
        },
      },
    },
    errors: { ...notificationErrors, 400: notificationGuildInput },
  },
});
export const settleNotification = defineContract({
  method: 'POST',
  path: '/api/wordle/admin/notifications/:guildId/settle',
  params: guildParams,
  body: z.discriminatedUnion('result', [
    z.object({
      id: requiredString,
      leaseId: requiredString,
      result: z.literal('delivered'),
      messageId: requiredString,
    }),
    z.object({
      id: requiredString,
      leaseId: requiredString,
      result: z.enum(['not_sent', 'ambiguous', 'retry_later', 'skipped']),
    }),
  ]),
  response: envelope(z.object({ recorded: z.boolean() })),
  docs: {
    description:
      'Record a delivery outcome against the active lease. Delivered requires a Discord message ID, ambiguous moves the event to manual reconciliation, and not_sent releases it for another attempt. Retry-later and skip apply to weekly gallery deliveries.',
    tags: notificationTags,
    security: botSecurity,
    examples: {
      params: exampleGuild,
      body: {
        id: deliveryId,
        leaseId,
        result: 'delivered',
        messageId: notificationMessageId,
      },
    },
    success: {
      200: {
        description: 'True when the outcome changed a matching active lease.',
        example: { data: { recorded: true } },
      },
    },
    errors: {
      ...notificationErrors,
      400: {
        description:
          'The guild, lease, or result did not satisfy the settlement contract.',
        example: { message: 'Invalid delivery' },
      },
      413: notificationBodyTooLarge,
    },
  },
});

export const listUncertainNotifications = defineContract({
  method: 'GET',
  path: '/api/wordle/admin/notifications/:guildId/uncertain',
  params: guildParams,
  response: envelope(
    z.array(
      z.object({
        id: requiredString,
        kind: z.enum(['page', 'goal', 'weekly']),
        eventKey: requiredString,
        channelId: z.string().nullable(),
        startedAt: z.number().nullable(),
      }),
    ),
  ),
  docs: {
    description:
      'List deliveries whose Discord outcome is unknown so an operator can check the target channel before retrying.',
    tags: notificationTags,
    security: botSecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description:
          'Uncertain events with their kind, channel, and attempt start time.',
        example: {
          data: [
            {
              id: deliveryId,
              kind: 'weekly',
              eventKey: weeklyEventKey,
              channelId: exampleChannelId,
              startedAt: 1795629600000,
            },
          ],
        },
      },
    },
    errors: { ...notificationErrors, 400: notificationGuildInput },
  },
});
export const resolveNotification = defineContract({
  method: 'POST',
  path: '/api/wordle/admin/notifications/:guildId/resolve',
  params: guildParams,
  body: z.discriminatedUnion('result', [
    z.object({
      id: requiredString,
      result: z.literal('found'),
      messageId: requiredString,
    }),
    z.object({ id: requiredString, result: z.literal('confirmed_absent') }),
  ]),
  response: envelope(z.object({ recorded: z.boolean() })),
  docs: {
    description:
      'Reconcile an uncertain event after checking Discord. Found records the existing message ID. Confirmed absent puts the event back into the pending queue.',
    tags: notificationTags,
    security: botSecurity,
    examples: {
      params: exampleGuild,
      body: {
        id: deliveryId,
        result: 'found',
        messageId: notificationMessageId,
      },
    },
    success: {
      200: {
        description:
          'True when the event was still uncertain and the reconciliation was applied.',
        example: { data: { recorded: true } },
      },
    },
    errors: {
      ...notificationErrors,
      400: {
        description:
          'The guild or reconciliation result did not pass validation.',
        example: { message: 'Invalid reconciliation' },
      },
      413: notificationBodyTooLarge,
    },
  },
});
export const updateReward = defineContract({
  method: 'PUT',
  path: '/api/wordle/rewards',
  body: z
    .object({
      kind: z.enum(['title', 'frame']),
      rewardId: requiredString.nullable(),
    })
    .strict(),
  response: envelope(rewardsStateSchema),
  docs: {
    description:
      'Equip an owned title or frame of the requested kind. Supply a null reward ID to clear that slot. The API reconciles the reward inventory before applying the change.',
    tags: playerTags,
    security: activitySecurity,
    examples: { body: { kind: 'frame', rewardId: null } },
    success: {
      200: {
        description: 'Reward inventory and updated equipped items.',
        example: { data: rewardsExample },
      },
    },
    errors: {
      ...playerReadErrors,
      400: {
        description:
          'The reward is unknown, does not match the slot, or is not owned by the authenticated player.',
        example: { message: 'Reward not owned' },
      },
      413: playerBodyTooLarge,
    },
  },
});

export const getAlbum = defineContract({
  method: 'GET',
  path: '/api/wordle/album/:guildId',
  params: guildParams,
  response: envelope(
    z.array(
      z.object({
        patternId: requiredString,
        family: requiredString,
        name: z.string(),
        icon: z.string(),
        mask: z.array(z.string()),
        contributorCount: z.number().int().nonnegative(),
        contributors: z.array(z.string()),
        familyMilestone: z
          .object({
            family: z.string(),
            patternIds: z.array(z.string()),
            completedAt: z.number(),
            revisedAt: z.number().nullable(),
            status: z.enum(['completed', 'revised']),
          })
          .nullable(),
        firstContribution: z
          .object({
            occurrenceId: z.string(),
            patternId: z.string(),
            userId: z.string(),
            occurredAt: z.number(),
          })
          .nullable(),
      }),
    ),
  ),
  docs: {
    description:
      'Read the guild’s pattern album, including masks, contributors, first contributions, and family milestones where available.',
    tags: communityTags,
    security: activitySecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description:
          'Published album pages, or an empty list for a guild without pages.',
        example: { data: [] },
      },
    },
    errors: communityMemberErrors,
  },
});

export const updateShowcase = defineContract({
  method: 'PUT',
  path: '/api/wordle/showcase',
  body: z.object({ achievements: z.array(requiredString).max(3) }).strict(),
  response: envelope(z.array(requiredString).max(3)),
  docs: {
    description:
      'Replace the ordered showcase with up to three distinct achievements unlocked by the authenticated player. An empty list clears it.',
    tags: playerTags,
    security: activitySecurity,
    examples: { body: { achievements: showcaseExample } },
    success: {
      200: {
        description: 'Saved achievement IDs in display order.',
        example: { data: showcaseExample },
      },
    },
    errors: {
      ...playerReadErrors,
      400: {
        description:
          'The selection is malformed, contains duplicate IDs, or includes an achievement the player has not unlocked.',
        example: { message: 'Achievement not unlocked' },
      },
      413: playerBodyTooLarge,
    },
  },
});

const gameplayTags = ['Daily Wordle'] as const;
const exampleDate = '2026-11-25';
const examplePlayer = { guildId: exampleGuildId, userId: exampleUserId };
const exampleGuess = {
  guess: 'carta',
  feedback: ['correct', 'present', 'present', 'absent', 'correct'],
};
const exampleRequestId = 'e4307af4-82b1-4b6f-8ab0-08ae5b60bbbf';
const exampleDraft = {
  date: exampleDate,
  rowIndex: 1,
  cells: ['c', 'a', '', '', ''],
  activeIndex: 2,
};
const exampleStats = {
  wordDate: exampleDate,
  wordLength: 5,
  playersCount: 8,
  winnersCount: 4,
  avgAttempts: 3.5,
};
const wordleBotErrors = {
  401: {
    description: 'The bot credential was absent or invalid.',
    example: { message: 'Token not authorized' },
  },
  500: {
    description:
      'The Wordle operation failed unexpectedly or the bot key was unavailable.',
    example: { message: 'Erro interno.' },
  },
};
const wordleBodyTooLarge = {
  description: 'The JSON request exceeded the API body size limit.',
  example: { message: 'Request body too large' },
};
const wordleGuildInput = {
  description: 'The guild or other route input did not pass validation.',
  example: { message: 'guildId é obrigatório.' },
};
const wordlePlayerInput = {
  description: 'The user or guild identifier did not pass validation.',
  example: { message: 'userId e guildId são obrigatórios.' },
};

export const submitGuess = defineContract({
  method: 'POST',
  path: '/api/wordle/guess',
  body: z.object({
    userId: requiredString,
    guildId: requiredString,
    guess: requiredString,
    requestId: z.uuid().optional(),
    date: z.iso.date().optional(),
  }),
  response: envelope(wordleGuessResultSchema),
  docs: {
    description:
      'Submit a guess to the player’s shared daily round. Send the same request ID when retrying an accepted action so the API can replay its receipt. The optional date identifies the intended daily round.',
    tags: gameplayTags,
    security: botSecurity,
    examples: {
      body: {
        ...examplePlayer,
        guess: exampleGuess.guess,
        requestId: exampleRequestId,
        date: exampleDate,
      },
    },
    success: {
      200: {
        description:
          'Accepted guess, letter feedback, and updated round state.',
        example: {
          data: {
            ...exampleGuess,
            guesses: [exampleGuess],
            solved: false,
            attempts: 1,
            wordLength: 5,
            requestId: exampleRequestId,
          },
        },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: {
        description:
          'The input, guess, or selected round did not meet the gameplay rules.',
        example: {
          message: 'Palavra não encontrada na lista de palavras válidas.',
        },
      },
      413: wordleBodyTooLarge,
    },
  },
});

export const recordPresence = defineContract({
  method: 'POST',
  path: '/api/wordle/presence',
  body: z.object({ userId: requiredString, guildId: requiredString }),
  response: envelope(z.object({ recorded: z.literal(true) })),
  docs: {
    description:
      'Record that the user opened or played the daily round in this guild. The bot can call this before any guess is accepted.',
    tags: gameplayTags,
    security: botSecurity,
    examples: { body: examplePlayer },
    success: {
      200: {
        description:
          'Daily participation was recorded for the supplied user and guild.',
        example: { data: { recorded: true } },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: wordlePlayerInput,
      413: wordleBodyTooLarge,
    },
  },
});

export const writeDraft = defineContract({
  method: 'POST',
  path: '/api/wordle/draft',
  body: z
    .object({
      userId: requiredString,
      guildId: requiredString,
    })
    .merge(wordleDraftWriteSchema),
  response: envelope(wordleDraftWriteResultSchema),
  docs: {
    description:
      'Save the unfinished row for a dated round using its expected revision. Read the draft in a conflict response before sending a new write. A closed response means the round can no longer accept drafts.',
    tags: gameplayTags,
    security: botSecurity,
    examples: {
      body: { ...examplePlayer, ...exampleDraft, expectedRevision: 0 },
    },
    success: {
      200: {
        description:
          'Draft saved, a revision conflict detected, or draft writes closed for this round.',
        example: {
          data: { status: 'saved', draft: { ...exampleDraft, revision: 1 } },
        },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: {
        description:
          'The draft position, cell count, date, revision, or player identifiers failed validation.',
        example: { message: 'Rascunho inválido.' },
      },
      413: wordleBodyTooLarge,
    },
  },
});

export const getStats = defineContract({
  method: 'GET',
  path: '/api/wordle/stats/:guildId',
  params: guildParams,
  response: envelope(wordleDailyStatsSchema),
  docs: {
    description:
      'Read counts and average winning attempts for the current daily round in the supplied guild. The date follows the configured Wordle calendar.',
    tags: gameplayTags,
    security: botSecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description: 'Current round date, length, and participation summary.',
        example: { data: exampleStats },
      },
    },
    errors: { ...wordleBotErrors, 400: wordleGuildInput },
  },
});

export const getAchievements = defineContract({
  method: 'GET',
  path: '/api/wordle/achievements/:guildId/:userId',
  params: userGuildParams,
  response: envelope(wordleAchievementsOverviewSchema),
  docs: {
    description:
      'Read the player overview for display in Discord. Achievement evidence is filtered for public viewers and the response includes statistics, showcase, and equipped cosmetics.',
    tags: playerTags,
    security: botSecurity,
    examples: { params: examplePlayer },
    success: {
      200: {
        description: 'Public player overview in the requested guild context.',
        example: {
          data: {
            achievements: [],
            stats: {
              played: 0,
              wins: 0,
              winRate: 0,
              currentStreak: 0,
              bestStreak: 0,
              distribution: [0, 0, 0, 0, 0, 0, 0, 0],
            },
            showcase: [],
            cosmetics: { title: null, frame: null, badges: [] },
          },
        },
      },
    },
    errors: { ...wordleBotErrors, 400: wordlePlayerInput },
  },
});

export const getUserSession = defineContract({
  method: 'GET',
  path: '/api/wordle/session/:userId/:guildId',
  params: userGuildParams,
  response: envelope(wordleSessionSchema.nullable()),
  docs: {
    description:
      'Restore the player’s accepted rows for the current global daily Wordle round using the supplied guild context.',
    tags: gameplayTags,
    security: botSecurity,
    examples: { params: examplePlayer },
    success: {
      200: {
        description:
          'Current session or null when the player has no saved session.',
        example: {
          data: {
            id: 'a2f6d7af-93d8-4c31-9046-c224e4cef6c4',
            user_id: exampleUserId,
            guild_id: exampleGuildId,
            word_date: exampleDate,
            guesses: [exampleGuess],
            solved: false,
            solved_from_draft: false,
            attempts: 1,
            created_at: 1795629600000,
          },
        },
      },
    },
    errors: { ...wordleBotErrors, 400: wordlePlayerInput },
  },
});

export const getDayGuesses = defineContract({
  method: 'GET',
  path: '/api/wordle/day-guesses/:guildId',
  params: guildParams,
  query: z.object({ date: z.iso.date().optional() }),
  response: envelope(wordleDayGuessesSchema.nullable()),
  docs: {
    description:
      'Read the answer and accepted rows used by the bot to build a guild summary for the requested day. Omitting the date reads the current round.',
    tags: gameplayTags,
    security: botSecurity,
    examples: { params: exampleGuild, query: { date: exampleDate } },
    success: {
      200: {
        description:
          'Day answer and collected guess rows, or null if the day has no word.',
        example: {
          data: {
            word: 'crava',
            wordDate: exampleDate,
            wordLength: 5,
            guesses: [exampleGuess],
          },
        },
      },
    },
    errors: { ...wordleBotErrors, 400: wordleGuildInput },
  },
});

const wordleAdminTags = ['Wordle administration'] as const;
const exampleWord = { word: 'crava', wordDate: exampleDate, wordLength: 5 };
const exampleChannel = { channelId: exampleChannelId };

export const rotateDailyWord = defineContract({
  method: 'POST',
  path: '/api/wordle/rotate',
  body: z.object({ guildId: requiredString }),
  response: envelope(forceNewWordResultSchema),
  docs: {
    description:
      'Ensure the global word for the current Wordle calendar date exists. Repeated requests for that date reuse the stored word. The guild ID is accepted for bot compatibility.',
    tags: wordleAdminTags,
    security: botSecurity,
    examples: { body: exampleGuild },
    success: {
      200: {
        description: 'Current daily answer and its date and length.',
        example: { data: exampleWord },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: wordleGuildInput,
      413: wordleBodyTooLarge,
    },
  },
});

export const forceNewWord = defineContract({
  method: 'POST',
  path: '/api/wordle/admin/force-new-word',
  body: z.object({ guildId: requiredString }),
  response: envelope(
    forceNewWordResultSchema.extend({ stats: wordleDailyStatsSchema }),
  ),
  docs: {
    description:
      'In development, replace the current global word and reset the current round. Other environments reject the operation. A replacement affects the shared daily round across guilds.',
    tags: wordleAdminTags,
    security: botSecurity,
    examples: { body: exampleGuild },
    success: {
      200: {
        description:
          'Replacement word and current guild stats after replacement.',
        example: {
          data: {
            ...exampleWord,
            stats: {
              ...exampleStats,
              playersCount: 0,
              winnersCount: 0,
              avgAttempts: 0,
            },
          },
        },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: wordleGuildInput,
      409: {
        description:
          'Global Wordle replacement is unavailable outside development.',
        example: {
          message: 'A palavra global não pode ser trocada antes da virada.',
        },
      },
      413: wordleBodyTooLarge,
    },
  },
});

export const getLeaderboard = defineContract({
  method: 'GET',
  path: '/api/wordle/leaderboard/:guildId',
  params: guildParams,
  query: z.object({
    period: wordleLeaderboardPeriodSchema.catch('all-time'),
    offset: z.coerce.number().int().min(0).max(100000).optional(),
    // Daily only: the word date to rank instead of today, for the final
    // ranking posted just after midnight.
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  response: z.object({
    data: z.union([
      z.array(dailyLeaderboardEntrySchema),
      z.array(rankedLeaderboardEntrySchema),
    ]),
    groupStreak: z.number(),
  }),
  docs: {
    description:
      'Read ten ranking entries for a guild with an optional offset. Daily rankings can target a specific date and return attempts and solved state. Longer periods return days played and average score.',
    tags: gameplayTags,
    security: botSecurity,
    examples: {
      params: exampleGuild,
      query: { period: 'daily', date: exampleDate, offset: 0 },
    },
    success: {
      200: {
        description:
          'Ranking entries for the selected period and the guild’s group streak.',
        example: {
          data: [{ userId: exampleUserId, attempts: 3, solved: true }],
          groupStreak: 5,
        },
      },
    },
    errors: { ...wordleBotErrors, 400: wordleGuildInput },
  },
});

export const validateGuess = defineContract({
  method: 'GET',
  path: '/api/wordle/validate/:guildId',
  params: guildParams,
  query: z.object({ guess: requiredString }),
  response: envelope(
    z.object({
      valid: z.boolean(),
      wordLength: z.number(),
      message: z.string(),
    }),
  ),
  docs: {
    description:
      'Check the normalized guess against the current word length and the accepted word bank. This operation does not record a guess.',
    tags: gameplayTags,
    security: botSecurity,
    examples: { params: exampleGuild, query: { guess: exampleGuess.guess } },
    success: {
      200: {
        description:
          'Validity, expected word length, and a message suitable for the Discord interaction.',
        example: {
          data: {
            valid: true,
            wordLength: 5,
            message: '"carta" é uma palavra válida',
          },
        },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: {
        description: 'The guild ID or guess did not pass validation.',
        example: { message: 'guildId e guess são obrigatórios.' },
      },
    },
  },
});

export const setConfig = defineContract({
  method: 'POST',
  path: '/api/wordle/config',
  body: z.object({ guildId: requiredString, channelId: requiredString }),
  response: messageOnly,
  docs: {
    description:
      'Set the Discord channel for a guild’s Terminhos announcements. Saving another channel replaces the previous guild configuration.',
    tags: wordleAdminTags,
    security: botSecurity,
    examples: { body: { ...exampleGuild, ...exampleChannel } },
    success: {
      200: {
        description: 'The channel configuration was saved.',
        example: { message: 'Configuração salva.' },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: {
        description: 'A guild ID and channel ID are required.',
        example: { message: 'guildId e channelId são obrigatórios.' },
      },
      413: wordleBodyTooLarge,
    },
  },
});

export const getConfig = defineContract({
  method: 'GET',
  path: '/api/wordle/config/:guildId',
  params: guildParams,
  response: envelope(z.object({ channelId: z.string() }).nullable()),
  docs: {
    description:
      'Read the configured Terminhos announcement channel for a guild.',
    tags: wordleAdminTags,
    security: botSecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description:
          'Current announcement channel or null when no channel is configured.',
        example: { data: exampleChannel },
      },
    },
    errors: { ...wordleBotErrors, 400: wordleGuildInput },
  },
});

export const markAnnounced = defineContract({
  method: 'POST',
  path: '/api/wordle/mark-announced',
  body: z.object({ userId: requiredString, guildId: requiredString }),
  response: envelope(z.object({ claimed: z.boolean() })),
  docs: {
    description:
      'Atomically claim the right to announce a player’s current-day win in a guild. A player is eligible when they were present in the guild before or at the time of the solve.',
    tags: wordleAdminTags,
    security: botSecurity,
    examples: { body: examplePlayer },
    success: {
      200: {
        description:
          'True only when this call created the guild’s announcement claim.',
        example: { data: { claimed: true } },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: wordlePlayerInput,
      413: wordleBodyTooLarge,
    },
  },
});

export const getUnannouncedWins = defineContract({
  method: 'GET',
  path: '/api/wordle/unannounced/:guildId',
  params: guildParams,
  response: envelope(z.array(unannouncedWordleWinSchema)),
  docs: {
    description:
      'List current-day wins eligible for announcement in a guild that have no existing announcement claim. Claim each win before posting to avoid duplicate announcements.',
    tags: wordleAdminTags,
    security: botSecurity,
    examples: { params: exampleGuild },
    success: {
      200: {
        description:
          'Players and scored rows for wins still available to claim.',
        example: {
          data: [
            {
              userId: exampleUserId,
              attempts: 2,
              guesses: [
                exampleGuess,
                {
                  guess: 'crava',
                  feedback: [
                    'correct',
                    'correct',
                    'correct',
                    'correct',
                    'correct',
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    errors: { ...wordleBotErrors, 400: wordleGuildInput },
  },
});

export const getStreak = defineContract({
  method: 'GET',
  path: '/api/wordle/streak/:userId/:guildId',
  params: userGuildParams,
  response: envelope(
    z.object({ currentStreak: z.number(), maxStreak: z.number() }),
  ),
  docs: {
    description:
      'Read the current and longest consecutive victory sequences for the player.',
    tags: gameplayTags,
    security: botSecurity,
    examples: { params: examplePlayer },
    success: {
      200: {
        description: 'Current victory streak and recorded best.',
        example: { data: { currentStreak: 3, maxStreak: 8 } },
      },
    },
    errors: { ...wordleBotErrors, 400: wordlePlayerInput },
  },
});

export const getWordlistPoolStats = defineContract({
  method: 'GET',
  path: '/api/wordle/wordlist-pool-stats',
  response: envelope(
    z.object({ total: z.number(), used: z.number(), remaining: z.number() }),
  ),
  docs: {
    description:
      'Count answer candidates of supported length and previously used words. The reported remaining count is the difference, floored at zero.',
    tags: wordleAdminTags,
    security: botSecurity,

    success: {
      200: {
        description: 'Total candidates, used-word count, and remaining count.',
        example: { data: { total: 3500, used: 320, remaining: 3180 } },
      },
    },
    errors: wordleBotErrors,
  },
});

export const getNextReviewWord = defineContract({
  method: 'GET',
  path: '/api/wordle/review/next',
  response: envelope(wordleReviewWordResultSchema),
  docs: {
    description:
      'Seed the review queue from the answer list when needed, then return the earliest unreviewed word and progress through the queue.',
    tags: wordleAdminTags,
    security: botSecurity,

    success: {
      200: {
        description:
          'Current review word and counts, or a completed state with a null word.',
        example: {
          data: { word: 'crava', index: 413, total: 3500, done: false },
        },
      },
    },
    errors: wordleBotErrors,
  },
});

export const submitReviewDecision = defineContract({
  method: 'POST',
  path: '/api/wordle/review/decision',
  body: z.object({
    word: requiredString,
    decision: z.enum(['keep', 'remove']),
  }),
  response: envelope(wordleReviewWordResultSchema),
  docs: {
    description:
      'Record a keep or remove decision for the normalized candidate, update the active ban list, and return the next pending review item.',
    tags: wordleAdminTags,
    security: botSecurity,
    examples: { body: { word: 'crava', decision: 'keep' } },
    success: {
      200: {
        description: 'Review queue after recording the decision.',
        example: {
          data: { word: 'creme', index: 414, total: 3500, done: false },
        },
      },
    },
    errors: {
      ...wordleBotErrors,
      400: {
        description:
          'The request requires a word and a keep or remove decision.',
        example: {
          message: 'word e decision ("keep" ou "remove") são obrigatórios.',
        },
      },
      413: wordleBodyTooLarge,
    },
  },
});
