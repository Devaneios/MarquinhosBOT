import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { WordleAlbumService } from 'services/wordle/WordleAlbumService';
import { sendContract } from 'utils/contract';

interface AlbumRequest {
  user?: { id: string };
  params: { guildId?: string };
  headers: { authorization?: string };
}
interface AlbumResponse {
  status(code: number): { json(payload: unknown): unknown };
}

export class WordleAlbumController {
  constructor(
    private readonly store: Pick<WordleAlbumService, 'pages'>,
    private readonly isMember: (
      token: string,
      guildId: string,
    ) => Promise<boolean>,
  ) {}

  async get(req: AlbumRequest, res: AlbumResponse): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const guildId = req.params.guildId;
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
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
    sendContract(res, contract.getAlbum, {
      data: await this.store.pages(guildId),
    });
  }
}
