import * as contract from '@marquinhos/contracts/http/routes/wordle';
import {
  InvalidWordleReward,
  type WordleRewardsService,
} from 'services/wordle/WordleRewardsService';
import { sendContract } from 'utils/contract';

interface RewardsRequest {
  user?: { id: string };
  body?: unknown;
}
interface RewardsResponse {
  status(code: number): { json(payload: unknown): unknown };
}

export class WordleRewardsController {
  constructor(
    private readonly store: Pick<
      WordleRewardsService,
      'reconcile' | 'get' | 'equip'
    >,
  ) {}

  async get(req: RewardsRequest, res: RewardsResponse): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    await this.store.reconcile(req.user.id);
    sendContract(res, contract.getRewards, {
      data: await this.store.get(req.user.id),
    });
  }

  async update(req: RewardsRequest, res: RewardsResponse): Promise<void> {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const body = contract.updateReward.body.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ message: 'Invalid reward' });
      return;
    }
    try {
      await this.store.reconcile(req.user.id);
      await this.store.equip(req.user.id, body.data.kind, body.data.rewardId);
      sendContract(res, contract.updateReward, {
        data: await this.store.get(req.user.id),
      });
    } catch (error) {
      if (error instanceof InvalidWordleReward) {
        res.status(400).json({ message: error.message });
        return;
      }
      throw error;
    }
  }
}
