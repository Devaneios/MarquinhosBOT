import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { Request, Response } from 'express';
import {
  InvalidWordleGoal,
  type WordleGoalsService,
} from 'services/wordle/WordleGoalsService';
import { parseRequest, sendContract } from 'utils/contract';

interface GoalResponse {
  status(code: number): { json(payload: unknown): unknown };
}

export class WordleGoalsController {
  constructor(
    private readonly store: Pick<
      WordleGoalsService,
      'listWithProgress' | 'createForDates'
    >,
  ) {}

  /** Membership is checked by `requireGuildMember` on the route. */
  async list(guildId: string, res: GoalResponse): Promise<void> {
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
