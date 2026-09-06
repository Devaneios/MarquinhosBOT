import type { Request, Response } from 'express';
import { WordleService } from 'services/wordle';

const service = new WordleService();

interface GuildIdParams {
  guildId: string;
}

interface UserGuildIdParams {
  userId: string;
  guildId: string;
}

export default class WordleController {
  submitGuess(req: Request, res: Response): void {
    const { userId, guildId, guess } = req.body as {
      userId?: string;
      guildId?: string;
      guess?: string;
    };

    if (!userId || !guildId || !guess) {
      res
        .status(400)
        .json({ message: 'userId, guildId e guess são obrigatórios.' });
      return;
    }

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

  getStats(
    req: Request<
      GuildIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { guildId } = req.params;
    if (!guildId) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }

    try {
      const stats = service.getDailyStats(guildId);
      res.json({ data: stats });
    } catch (err) {
      console.error('WordleController.getStats error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getUserSession(
    req: Request<
      UserGuildIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { userId, guildId } = req.params;
    if (!userId || !guildId) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }

    try {
      const session = service.getUserSession(userId, guildId);
      res.json({ data: session });
    } catch (err) {
      console.error('WordleController.getUserSession error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getDayGuesses(
    req: Request<
      GuildIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { guildId } = req.params;
    if (!guildId) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }

    try {
      const data = service.getDayGuesses(guildId);
      res.json({ data });
    } catch (err) {
      console.error('WordleController.getDayGuesses error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  forceNewWord(req: Request, res: Response): void {
    const { guildId } = req.body as { guildId?: string };
    if (!guildId) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }

    try {
      const result = service.forceNewWord(guildId);
      const stats = service.getDailyStats(guildId);
      res.json({ data: { ...result, stats } });
    } catch (err) {
      console.error('WordleController.forceNewWord error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getLeaderboard(
    req: Request<
      GuildIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { guildId } = req.params;
    if (!guildId) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }

    const rawPeriod = req.query.period as string | undefined;
    const period =
      rawPeriod === 'daily' ||
      rawPeriod === 'weekly' ||
      rawPeriod === 'monthly' ||
      rawPeriod === 'all-time'
        ? rawPeriod
        : 'all-time';

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
    const { guildId, channelId } = req.body as {
      guildId?: string;
      channelId?: string;
    };
    if (!guildId || !channelId) {
      res
        .status(400)
        .json({ message: 'guildId e channelId são obrigatórios.' });
      return;
    }

    try {
      service.setConfig(guildId, channelId);
      res.json({ message: 'Configuração salva.' });
    } catch (err) {
      console.error('WordleController.setConfig error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  validateGuess(
    req: Request<
      GuildIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { guildId } = req.params;
    const guess = req.query.guess as string | undefined;

    if (!guildId || !guess) {
      res.status(400).json({ message: 'guildId e guess são obrigatórios.' });
      return;
    }

    try {
      const result = service.validateGuess(guildId, guess);
      res.json({ data: result });
    } catch (err) {
      console.error('WordleController.validateGuess error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getConfig(
    req: Request<
      GuildIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { guildId } = req.params;
    if (!guildId) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }

    try {
      const config = service.getConfig(guildId);
      res.json({ data: config });
    } catch (err) {
      console.error('WordleController.getConfig error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getStreak(
    req: Request<
      UserGuildIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): void {
    const { userId, guildId } = req.params;
    if (!userId || !guildId) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }

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
    const { word, decision } = req.body as {
      word?: string;
      decision?: 'keep' | 'remove';
    };

    if (!word || (decision !== 'keep' && decision !== 'remove')) {
      res.status(400).json({
        message: 'word e decision ("keep" ou "remove") são obrigatórios.',
      });
      return;
    }

    try {
      const data = service.submitReviewDecision(word, decision);
      res.json({ data });
    } catch (err) {
      console.error('WordleController.submitReviewDecision error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }
}
