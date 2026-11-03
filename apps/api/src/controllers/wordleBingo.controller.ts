import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { Request, Response } from 'express';
import {
  InvalidWordleBingo,
  type WordleBingoService,
} from 'services/wordle/WordleBingoService';
import { parseRequest, sendContract } from 'utils/contract';

export class WordleBingoController {
  constructor(
    private readonly service: Pick<
      WordleBingoService,
      'createForDates' | 'list'
    >,
  ) {}
  async list(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.listBingo, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid community' });
      return;
    }
    sendContract(res, contract.listBingo, {
      data: await this.service.list(input.params.guildId),
    });
  }
  async create(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.createBingo, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid bingo' });
      return;
    }
    try {
      const { guildId, firstDate, lastDate, allowMulti } = input.body;
      sendContract(
        res,
        contract.createBingo,
        {
          data: await this.service.createForDates(
            guildId,
            firstDate,
            lastDate,
            allowMulti,
          ),
        },
        201,
      );
    } catch (error) {
      if (error instanceof InvalidWordleBingo) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error;
    }
  }
}
