import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { Request, Response } from 'express';
import {
  InvalidWordleGoal,
  type WordleGoalsService,
} from 'services/wordle/WordleGoalsService';
import { parseRequest, sendContract } from 'utils/contract';

interface GoalRequest {
  user?: { id: string };
  params: { guildId?: string };
  headers: { authorization?: string };
}
interface GoalResponse {
  status(code: number): { json(payload: unknown): unknown };
}

export class WordleGoalsController {
  constructor(
    private readonly store: Pick<
      WordleGoalsService,
      'listWithProgress' | 'createForDates'
    >,
    private readonly isMember: (
      token: string,
      guildId: string,
    ) => Promise<boolean>,
  ) {}

  async list(req: GoalRequest, res: GoalResponse): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    const guildId = req.params.guildId;
    if (!guildId || scheme !== 'Bearer' || !token) {
      res.status(400).json({ message: 'Invalid request' });
      return;
    }
    let member: boolean;
    try {
      member = await this.isMember(token, guildId);
    } catch {
      res.status(503).json({ message: 'Discord membership unavailable' });
      return;
    }
    if (!member) {
      res.status(403).json({ message: 'Not a community member' });
      return;
    }
    sendContract(res, contract.listGoals, {
      data: await this.store.listWithProgress(guildId),
    });
  }

  async create(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.createGoal, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid goal' });
      return;
    }
    try {
      const { guildId, target, firstDate, lastDate } = input.body;
      sendContract(
        res,
        contract.createGoal,
        {
          data: await this.store.createForDates(
            guildId,
            target,
            firstDate,
            lastDate,
          ),
        },
        201,
      );
    } catch (error) {
      if (error instanceof InvalidWordleGoal) {
        res.status(400).json({ message: 'Invalid goal dates or target' });
        return;
      }
      throw error;
    }
  }
}
