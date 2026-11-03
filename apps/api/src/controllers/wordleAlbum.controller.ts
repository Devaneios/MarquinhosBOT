import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { WordleAlbumService } from 'services/wordle/WordleAlbumService';
import { sendContract } from 'utils/contract';

interface AlbumResponse {
  status(code: number): { json(payload: unknown): unknown };
}

export class WordleAlbumController {
  constructor(private readonly store: Pick<WordleAlbumService, 'pages'>) {}

  /** Membership is checked by `requireGuildMember` on the route. */
  async get(guildId: string, res: AlbumResponse): Promise<void> {
    sendContract(res, contract.getAlbum, {
      data: await this.store.pages(guildId),
    });
  }
}
