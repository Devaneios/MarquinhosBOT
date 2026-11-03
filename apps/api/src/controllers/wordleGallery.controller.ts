import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { Request, Response } from 'express';
import {
  InvalidWordleGallery,
  type WordleGalleryService,
} from 'services/wordle/WordleGalleryService';
import { parseRequest, sendContract } from 'utils/contract';

interface GalleryResponse {
  status(code: number): { json(payload: unknown): unknown };
}
export class WordleGalleryController {
  constructor(
    private readonly service: Pick<
      WordleGalleryService,
      'previousWeek' | 'forWeek'
    >,
  ) {}
  async get(guildId: string, res: GalleryResponse): Promise<void> {
    sendContract(res, contract.getGallery, {
      data: await this.service.previousWeek(guildId),
    });
  }
  async getForWeek(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getBotGallery, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid gallery week' });
      return;
    }
    try {
      sendContract(res, contract.getBotGallery, {
        data: await this.service.forWeek(
          input.params.guildId,
          input.query.week,
        ),
      });
    } catch (error) {
      if (error instanceof InvalidWordleGallery) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error;
    }
  }
}
