import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import type { Request, Response } from 'express';
import type { DiscordUser } from 'services/discord';
import { WordleService } from 'services/wordle';
import { parseRequest, sendContract } from 'utils/contract';

const service = new WordleService();

export interface WordleUserConfigStore {
  get(userId: string): WordleUserConfig;
  update(userId: string, config: WordleUserConfig): WordleUserConfig;
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

  getUserConfig(req: UserConfigRequest, res: UserConfigResponse): void {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    sendContract(res, contract.getUserConfig, {
      data: this.userConfig.get(req.user.id),
    });
  }

  updateUserConfig(req: UserConfigRequest, res: UserConfigResponse): void {
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
      data: this.userConfig.update(req.user.id, config.data),
    });
  }

  submitGuess(req: Request, res: Response): void {
    const input = parseRequest(contract.submitGuess, req);
    if (!input) {
      res
        .status(400)
        .json({ message: 'userId, guildId e guess são obrigatórios.' });
      return;
    }
    const { userId, guildId, guess } = input.body;

    try {
      const result = service.submitGuess(userId, guildId, guess);
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

  getStats(req: Request, res: Response): void {
    const input = parseRequest(contract.getStats, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;

    try {
      const stats = service.getDailyStats(guildId);
      sendContract(res, contract.getStats, { data: stats });
    } catch (err) {
      console.error('WordleController.getStats error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getUserSession(req: Request, res: Response): void {
    const input = parseRequest(contract.getUserSession, req);
    if (!input) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = input.params;

    try {
      const session = service.getUserSession(userId, guildId);
      sendContract(res, contract.getUserSession, { data: session });
    } catch (err) {
      console.error('WordleController.getUserSession error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getDayGuesses(req: Request, res: Response): void {
    const input = parseRequest(contract.getDayGuesses, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;

    try {
      const data = service.getDayGuesses(guildId);
      sendContract(res, contract.getDayGuesses, { data });
    } catch (err) {
      console.error('WordleController.getDayGuesses error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  forceNewWord(req: Request, res: Response): void {
    const input = parseRequest(contract.forceNewWord, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.body;

    try {
      const result = service.forceNewWord(guildId);
      const stats = service.getDailyStats(guildId);
      sendContract(res, contract.forceNewWord, { data: { ...result, stats } });
    } catch (err) {
      console.error('WordleController.forceNewWord error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getLeaderboard(req: Request, res: Response): void {
    const input = parseRequest(contract.getLeaderboard, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;
    const { period, date } = input.query;

    try {
      const data = service.getLeaderboard(guildId, 10, period, date);
      const groupStreak = service.getGroupStreak(guildId);
      sendContract(res, contract.getLeaderboard, { data, groupStreak });
    } catch (err) {
      console.error('WordleController.getLeaderboard error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  setConfig(req: Request, res: Response): void {
    const input = parseRequest(contract.setConfig, req);
    if (!input) {
      res
        .status(400)
        .json({ message: 'guildId e channelId são obrigatórios.' });
      return;
    }
    const { guildId, channelId } = input.body;

    try {
      service.setConfig(guildId, channelId);
      sendContract(res, contract.setConfig, { message: 'Configuração salva.' });
    } catch (err) {
      console.error('WordleController.setConfig error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  validateGuess(req: Request, res: Response): void {
    const input = parseRequest(contract.validateGuess, req);
    if (!input) {
      res.status(400).json({ message: 'guildId e guess são obrigatórios.' });
      return;
    }
    const { guildId } = input.params;
    const { guess } = input.query;

    try {
      const result = service.validateGuess(guildId, guess);
      sendContract(res, contract.validateGuess, { data: result });
    } catch (err) {
      console.error('WordleController.validateGuess error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getConfig(req: Request, res: Response): void {
    const input = parseRequest(contract.getConfig, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;

    try {
      const config = service.getConfig(guildId);
      sendContract(res, contract.getConfig, { data: config });
    } catch (err) {
      console.error('WordleController.getConfig error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  markAnnounced(req: Request, res: Response): void {
    const input = parseRequest(contract.markAnnounced, req);
    if (!input) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = input.body;

    try {
      const claimed = service.markAnnounced(userId, guildId);
      sendContract(res, contract.markAnnounced, { data: { claimed } });
    } catch (err) {
      console.error('WordleController.markAnnounced error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getUnannouncedWins(req: Request, res: Response): void {
    const input = parseRequest(contract.getUnannouncedWins, req);
    if (!input) {
      res.status(400).json({ message: 'guildId é obrigatório.' });
      return;
    }
    const { guildId } = input.params;

    try {
      const data = service.getUnannouncedWins(guildId);
      sendContract(res, contract.getUnannouncedWins, { data });
    } catch (err) {
      console.error('WordleController.getUnannouncedWins error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getStreak(req: Request, res: Response): void {
    const input = parseRequest(contract.getStreak, req);
    if (!input) {
      res.status(400).json({ message: 'userId e guildId são obrigatórios.' });
      return;
    }
    const { userId, guildId } = input.params;

    try {
      const streak = service.getStreak(userId, guildId);
      sendContract(res, contract.getStreak, { data: streak });
    } catch (err) {
      console.error('WordleController.getStreak error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getWordlistPoolStats(_req: Request, res: Response): void {
    try {
      const stats = service.getWordlistPoolStats();
      sendContract(res, contract.getWordlistPoolStats, { data: stats });
    } catch (err) {
      console.error('WordleController.getWordlistPoolStats error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  getNextReviewWord(_req: Request, res: Response): void {
    try {
      const data = service.getNextReviewWord();
      sendContract(res, contract.getNextReviewWord, { data });
    } catch (err) {
      console.error('WordleController.getNextReviewWord error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }

  submitReviewDecision(req: Request, res: Response): void {
    const input = parseRequest(contract.submitReviewDecision, req);
    if (!input) {
      res.status(400).json({
        message: 'word e decision ("keep" ou "remove") são obrigatórios.',
      });
      return;
    }
    const { word, decision } = input.body;

    try {
      const data = service.submitReviewDecision(word, decision);
      sendContract(res, contract.submitReviewDecision, { data });
    } catch (err) {
      console.error('WordleController.submitReviewDecision error:', err);
      res.status(500).json({ message: 'Erro interno.' });
    }
  }
}
