import * as contract from '@marquinhos/contracts/http/routes/wordle';
import { InvalidWordleShowcase } from 'services/wordle/WordleShowcaseService';
import { sendContract } from 'utils/contract';

interface Store {
  get(userId: string): Promise<string[]>;
  replace(userId: string, ids: string[]): Promise<void>;
}
interface ShowcaseRequest {
  user?: { id: string };
  body?: unknown;
}
interface ShowcaseResponse {
  status(code: number): { json(payload: unknown): unknown };
}

export class WordleShowcaseController {
  constructor(private readonly store: Store) {}

  async get(req: ShowcaseRequest, res: ShowcaseResponse): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    sendContract(res, contract.getShowcase, {
      data: await this.store.get(req.user.id),
    });
  }

  async update(req: ShowcaseRequest, res: ShowcaseResponse): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const body = contract.updateShowcase.body.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ message: 'Invalid showcase' });
      return;
    }
    try {
      await this.store.replace(req.user.id, body.data.achievements);
      sendContract(res, contract.updateShowcase, {
        data: body.data.achievements,
      });
    } catch (error) {
      if (error instanceof InvalidWordleShowcase) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error;
    }
  }
}
