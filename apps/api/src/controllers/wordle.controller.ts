import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import type { Request, Response } from 'express';
import type { DiscordUser } from 'services/discord';
import { WordleService } from 'services/wordle';
import { parseRequest, sendContract } from 'utils/contract';

const service = new WordleService();

export interface WordleUserConfigStore {
  get(userId: string): Promise<WordleUserConfig>;
  update(userId: string, config: WordleUserConfig): Promise<WordleUserConfig>;
}

interface UserConfigRequest {
  body: unknown;
  user?: DiscordUser;
}

interface UserConfigResponse {
  status(code: number): { json(payload: unknown): unknown };
}

export default class WordleController {
  constructor(private readonly userConfig: WordleUserConfigStore) {}

  async getUserConfig(
    req: UserConfigRequest,
    res: UserConfigResponse,
  ): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    sendContract(res, contract.getUserConfig, {
      data: await this.userConfig.get(req.user.id),
    });
  }

  async updateUserConfig(
    req: UserConfigRequest,
    res: UserConfigResponse,
  ): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const config = contract.updateUserConfig.body.safeParse(req.body);
    if (!config.success) {
      res.status(400).json({
        message:
          'Wordle config fields must be booleans, and arrow keys require space.',
      });
      return;
    }

    sendContract(res, contract.updateUserConfig, {
      data: await this.userConfig.update(req.user.id, config.data),
    });
  }

  async submitGuess(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.submitGuess, req);
    if (!input) {
      res
        .status(400)
        .json({ message: 'userId, guildId e guess são obrigatórios.' });
      return;
    }
    const { userId, guildId, guess } = input.body;

    try {
      const result = await service.submitGuess(userId, guildId, guess);
      if ('error' in result) {
        res.status(400).json({ message: result.error });
        return;
      }
      sendContract(res, contract.submitGuess, { data: result });
    } catch (err) {
      console.error('WordleController.submitGuess error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getStats(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getStats, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;

    try {
      const stats = await service.getDailyStats(guildId);
      sendContract(res, contract.getStats, { data: stats });
    } catch (err) {
      console.error('WordleController.getStats error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getUserSession(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getUserSession, req);
    if (!input) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = input.params;

    try {
      const session = await service.getUserSession(userId, guildId);
      sendContract(res, contract.getUserSession, { data: session });
    } catch (err) {
      console.error('WordleController.getUserSession error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getDayGuesses(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getDayGuesses, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;

    try {
      const data = await service.getDayGuesses(guildId);
      sendContract(res, contract.getDayGuesses, { data });
    } catch (err) {
      console.error('WordleController.getDayGuesses error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async forceNewWord(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.forceNewWord, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.body;

    try {
      const result = await service.forceNewWord(guildId);
      const stats = await service.getDailyStats(guildId);
      sendContract(res, contract.forceNewWord, { data: { ...result, stats } });
    } catch (err) {
      console.error('WordleController.forceNewWord error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getLeaderboard(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getLeaderboard, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;
    const { period, date } = input.query;

    try {
      const data = await service.getLeaderboard(guildId, 10, period, date);
      const groupStreak = await service.getGroupStreak(guildId);
      sendContract(res, contract.getLeaderboard, { data, groupStreak });
    } catch (err) {
      console.error('WordleController.getLeaderboard error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async setConfig(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.setConfig, req);
    if (!input) {
      res
        .status(400)
        .json({ message: 'guildId e channelId são obrigatórios.' });
      return;
    }
    const { guildId, channelId } = input.body;

    try {
      await service.setConfig(guildId, channelId);
      sendContract(res, contract.setConfig, { message: 'Configuração salva.' });
    } catch (err) {
      console.error('WordleController.setConfig error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async validateGuess(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.validateGuess, req);
    if (!input) {
      res.status(400).json({ message: 'guildId e guess são obrigatórios.' });
      return;
    }
    const { guildId } = input.params;
    const { guess } = input.query;

    try {
      const result = await service.validateGuess(guildId, guess);
      sendContract(res, contract.validateGuess, { data: result });
    } catch (err) {
      console.error('WordleController.validateGuess error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getConfig(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getConfig, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;

    try {
      const config = await service.getConfig(guildId);
      sendContract(res, contract.getConfig, { data: config });
    } catch (err) {
      console.error('WordleController.getConfig error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async markAnnounced(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.markAnnounced, req);
    if (!input) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = input.body;

    try {
      const claimed = await service.markAnnounced(userId, guildId);
      sendContract(res, contract.markAnnounced, { data: { claimed } });
    } catch (err) {
      console.error('WordleController.markAnnounced error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getUnannouncedWins(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getUnannouncedWins, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;

    try {
      const data = await service.getUnannouncedWins(guildId);
      sendContract(res, contract.getUnannouncedWins, { data });
    } catch (err) {
      console.error('WordleController.getUnannouncedWins error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getStreak(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getStreak, req);
    if (!input) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = input.params;

    try {
      const streak = await service.getStreak(userId, guildId);
      sendContract(res, contract.getStreak, { data: streak });
    } catch (err) {
      console.error('WordleController.getStreak error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getWordlistPoolStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await service.getWordlistPoolStats();
      sendContract(res, contract.getWordlistPoolStats, { data: stats });
    } catch (err) {
      console.error('WordleController.getWordlistPoolStats error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async getNextReviewWord(_req: Request, res: Response): Promise<void> {
    try {
      const data = await service.getNextReviewWord();
      sendContract(res, contract.getNextReviewWord, { data });
    } catch (err) {
      console.error('WordleController.getNextReviewWord error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  async submitReviewDecision(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.submitReviewDecision, req);
    if (!input) {
      res.status(400).json({
        message: 'word e decision ("keep" ou "remove") são obrigatórios.',
      });
      return;
    }
    const { word, decision } = input.body;

    try {
      const data = await service.submitReviewDecision(word, decision);
      sendContract(res, contract.submitReviewDecision, { data });
    } catch (err) {
      console.error('WordleController.submitReviewDecision error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }
}
