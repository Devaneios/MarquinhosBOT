import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { WordleGalleryService } from 'services/wordle/WordleGalleryService';
import { sendContract } from 'utils/contract';

interface GalleryResponse {
  status(code: number): { json(payload: unknown): unknown };
}
export class WordleGalleryController {
  constructor(
    private readonly service: Pick<WordleGalleryService, 'previousWeek'>,
  ) {}
  async get(guildId: string, res: GalleryResponse): Promise<void> {
    sendContract(res, contract.getGallery, {
      data: await this.service.previousWeek(guildId),
    });
  }
}
