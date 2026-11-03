import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { Request, Response } from 'express';
import {
  InvalidWordleChallenge,
  type WordleChallengeService,
} from 'services/wordle/WordleChallengeService';
import { parseRequest, sendContract } from 'utils/contract';

export class WordleChallengesController {
  constructor(
    private readonly service: Pick<
      WordleChallengeService,
      'create' | 'join' | 'list'
    >,
  ) {}
  async list(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const input = parseRequest(contract.listChallenges, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid community' });
      return;
    }
    sendContract(res, contract.listChallenges, {
      data: await this.service.list(input.params.guildId, req.user.id),
    });
  }
  async create(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const input = parseRequest(contract.createChallenge, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid challenge' });
      return;
    }
    try {
      sendContract(
        res,
        contract.createChallenge,
        {
          data: await this.service.create(
            input.params.guildId,
            req.user.id,
            input.body.patternId,
            input.body.closesAt,
          ),
        },
        201,
      );
    } catch (error) {
      if (error instanceof InvalidWordleChallenge) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error;
    }
  }
  async join(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const input = parseRequest(contract.joinChallenge, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid challenge' });
      return;
    }
    try {
      await this.service.join(
        input.params.challengeId,
        input.params.guildId,
        req.user.id,
      );
      sendContract(res, contract.joinChallenge, { data: { joined: true } });
    } catch (error) {
      if (error instanceof InvalidWordleChallenge) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error;
    }
  }
}
