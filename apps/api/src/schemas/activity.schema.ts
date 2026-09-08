import { z } from 'zod';

export const activityTokenExchangeSchema = z.object({
  body: z.object({
    code: z.string().min(1),
  }),
});

const activityWsSessionBodySchema = z
  .object({
    accessToken: z.string().min(1),
    instanceId: z.string().min(1),
    guildId: z.string().min(1),
    mode: z.enum(['single', 'multi', 'local']),
    game: z.enum([
      'pong',
      'wordle',
      'cards',
      'tic-tac-toe',
      'connect-four',
      'hangman',
      'battleship',
      'checkers',
      'rock-paper-scissors',
      'wordle-race',
      'minesweeper-versus',
      'trivia-quiz',
      'dominoes-block',
      'word-search-race',
      'bingo-speed',
      'tower-unstable',
      'boggle-word-race',
      'word-chain',
      'snake-game',
    ]),
    difficulty: z.enum(['easy', 'normal', 'hard']).optional(),
    winningScore: z.number().int().min(1).max(99).optional(),
    ruleset: z.string().min(1).optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    roomId: z.string().min(1).optional(),
  })
  .superRefine((body, context) => {
    if (body.mode === 'multi' && !body.roomId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['roomId'],
        message: 'roomId is required for multi mode',
      });
    }
  });

export const activityWsSessionSchema = z.object({
  body: activityWsSessionBodySchema,
});

export const activityListRoomsSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1),
    instanceId: z.string().min(1),
    guildId: z.string().min(1),
  }),
});

export const activityCreateRoomSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1),
    instanceId: z.string().min(1),
    guildId: z.string().min(1),
    game: z.enum([
      'pong',
      'wordle',
      'cards',
      'tic-tac-toe',
      'connect-four',
      'hangman',
      'battleship',
      'checkers',
      'rock-paper-scissors',
      'wordle-race',
      'minesweeper-versus',
      'trivia-quiz',
      'dominoes-block',
      'word-search-race',
      'bingo-speed',
      'tower-unstable',
      'boggle-word-race',
      'word-chain',
      'snake-game',
    ]),
    queueEnabled: z.boolean(),
  }),
});

export const activityDeepLinkRecordSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    guildId: z.string().min(1),
    game: z.string().min(1),
  }),
});

export const activityDeepLinkClaimSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1),
    guildId: z.string().min(1),
  }),
});

export const pongLeaderboardSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1),
    guildId: z.string().min(1),
    pool: z.enum(['classic-1v1', 'quad-elimination']),
    limit: z.number().int().min(1).max(100).optional(),
  }),
});

export const pongTournamentCreateSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1),
    guildId: z.string().min(1),
    name: z.string().min(1).max(80),
    format: z.enum(['round-robin', 'double-elimination', 'swiss-playoff']),
    pool: z.enum(['classic-1v1', 'quad-elimination']),
    playerIds: z.array(z.string().min(1)).min(2).max(64),
    swissRounds: z.number().int().min(1).max(10).optional(),
  }),
});

export const pongTournamentListSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1),
    guildId: z.string().min(1),
  }),
});

export const pongTournamentReportSchema = z.object({
  body: z.object({
    accessToken: z.string().min(1),
    matchId: z.string().min(1),
    winnerId: z.string().min(1),
  }),
});
