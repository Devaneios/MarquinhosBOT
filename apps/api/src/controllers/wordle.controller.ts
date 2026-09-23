import type { Request, Response } from 'express';
import {
  guildIdBodySchema,
  guildIdParamsSchema,
  leaderboardQuerySchema,
  reviewDecisionBodySchema,
  setConfigBodySchema,
  submitGuessBodySchema,
  userGuildBodySchema,
  userGuildParamsSchema,
  validateGuessQuerySchema,
} from 'schemas/wordle.schema';
import { WordleService } from 'services/wordle';
import type { WordleUserConfig } from 'services/wordleUserConfig';
import type { IUser } from 'types';

const service = new WordleService();

export interface WordleUserConfigStore {
  get(userId: string): WordleUserConfig;
  update(userId: string, config: WordleUserConfig): WordleUserConfig;
}

interface UserConfigRequest {
  body: unknown;
  user?: IUser;
}

interface UserConfigResponse {
  status(code: number): { json(payload: unknown): unknown };
}

function parseWordleUserConfig(value: unknown): WordleUserConfig | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('invertActionKeys' in value) ||
    !('enableSounds' in value) ||
    !('enableSpaceKey' in value) ||
    !('enableArrowKeys' in value) ||
    typeof value.invertActionKeys !== 'boolean' ||
    typeof value.enableSounds !== 'boolean' ||
    typeof value.enableSpaceKey !== 'boolean' ||
    typeof value.enableArrowKeys !== 'boolean' ||
    (!value.enableSpaceKey && value.enableArrowKeys)
  ) {
    return null;
  }

  const baseConfig = {
    invertActionKeys: value.invertActionKeys,
    enableSounds: value.enableSounds,
  };
  return value.enableSpaceKey
    ? {
        ...baseConfig,
        enableSpaceKey: true,
        enableArrowKeys: value.enableArrowKeys,
      }
    : { ...baseConfig, enableSpaceKey: false, enableArrowKeys: false };
}

export default class WordleController {
  constructor(private readonly userConfig: WordleUserConfigStore) {}

  getUserConfig(req: UserConfigRequest, res: UserConfigResponse): void {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    res.status(200).json({ data: this.userConfig.get(req.user.id) });
  }

  updateUserConfig(req: UserConfigRequest, res: UserConfigResponse): void {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const config = parseWordleUserConfig(req.body);
    if (!config) {
      res.status(400).json({
        message:
          'Wordle config fields must be booleans, and arrow keys require space.',
      });
      return;
    }

    res.status(200).json({ data: this.userConfig.update(req.user.id, config) });
  }

  submitGuess(req: Request, res: Response): void {
    const body = submitGuessBodySchema.safeParse(req.body);
    if (!body.success) {
      res
        .status(400)
        .json({ message: 'userId, guildId e guess são obrigatórios.' });
      return;
    }
    const { userId, guildId, guess } = body.data;

    try {
      const result = service.submitGuess(userId, guildId, guess);
      if ('error' in result) {
        res.status(400).json({ message: result.error });
        return;
      }
      res.json({ data: result });
    } catch (err) {
      console.error('WordleController.submitGuess error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getStats(req: Request, res: Response): void {
    const params = guildIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = params.data;

    try {
      const stats = service.getDailyStats(guildId);
      res.json({ data: stats });
    } catch (err) {
      console.error('WordleController.getStats error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getUserSession(req: Request, res: Response): void {
    const params = userGuildParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = params.data;

    try {
      const session = service.getUserSession(userId, guildId);
      res.json({ data: session });
    } catch (err) {
      console.error('WordleController.getUserSession error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getDayGuesses(req: Request, res: Response): void {
    const params = guildIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = params.data;

    try {
      const data = service.getDayGuesses(guildId);
      res.json({ data });
    } catch (err) {
      console.error('WordleController.getDayGuesses error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  forceNewWord(req: Request, res: Response): void {
    const body = guildIdBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = body.data;

    try {
      const result = service.forceNewWord(guildId);
      const stats = service.getDailyStats(guildId);
      res.json({ data: { ...result, stats } });
    } catch (err) {
      console.error('WordleController.forceNewWord error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getLeaderboard(req: Request, res: Response): void {
    const params = guildIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = params.data;

    const { period } = leaderboardQuerySchema.parse(req.query);

    try {
      const data = service.getLeaderboard(guildId, 10, period);
      const groupStreak = service.getGroupStreak(guildId);
      res.json({ data, groupStreak });
    } catch (err) {
      console.error('WordleController.getLeaderboard error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  setConfig(req: Request, res: Response): void {
    const body = setConfigBodySchema.safeParse(req.body);
    if (!body.success) {
      res
        .status(400)
        .json({ message: 'guildId e channelId são obrigatórios.' });
      return;
    }
    const { guildId, channelId } = body.data;

    try {
      service.setConfig(guildId, channelId);
      res.json({ message: 'Configuração salva.' });
    } catch (err) {
      console.error('WordleController.setConfig error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  validateGuess(req: Request, res: Response): void {
    const params = guildIdParamsSchema.safeParse(req.params);
    const query = validateGuessQuerySchema.safeParse(req.query);
    if (!params.success || !query.success) {
      res.status(400).json({ message: 'guildId e guess são obrigatórios.' });
      return;
    }
    const { guildId } = params.data;
    const { guess } = query.data;

    try {
      const result = service.validateGuess(guildId, guess);
      res.json({ data: result });
    } catch (err) {
      console.error('WordleController.validateGuess error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getConfig(req: Request, res: Response): void {
    const params = guildIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = params.data;

    try {
      const config = service.getConfig(guildId);
      res.json({ data: config });
    } catch (err) {
      console.error('WordleController.getConfig error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  markAnnounced(req: Request, res: Response): void {
    const body = userGuildBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = body.data;

    try {
      const claimed = service.markAnnounced(userId, guildId);
      res.json({ data: { claimed } });
    } catch (err) {
      console.error('WordleController.markAnnounced error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getUnannouncedWins(req: Request, res: Response): void {
    const params = guildIdParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = params.data;

    try {
      const data = service.getUnannouncedWins(guildId);
      res.json({ data });
    } catch (err) {
      console.error('WordleController.getUnannouncedWins error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getStreak(req: Request, res: Response): void {
    const params = userGuildParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = params.data;

    try {
      const streak = service.getStreak(userId, guildId);
      res.json({ data: streak });
    } catch (err) {
      console.error('WordleController.getStreak error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getWordlistPoolStats(_req: Request, res: Response): void {
    try {
      const stats = service.getWordlistPoolStats();
      res.json({ data: stats });
    } catch (err) {
      console.error('WordleController.getWordlistPoolStats error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getNextReviewWord(_req: Request, res: Response): void {
    try {
      const data = service.getNextReviewWord();
      res.json({ data });
    } catch (err) {
      console.error('WordleController.getNextReviewWord error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  submitReviewDecision(req: Request, res: Response): void {
    const body = reviewDecisionBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        message: 'word e decision ("keep" ou "remove") são obrigatórios.',
      });
      return;
    }
    const { word, decision } = body.data;

    try {
      const data = service.submitReviewDecision(word, decision);
      res.json({ data });
    } catch (err) {
      console.error('WordleController.submitReviewDecision error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }
}
