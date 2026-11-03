import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { Request, Response } from 'express';
import { WordleNotificationService } from 'services/wordle/WordleNotificationService';
import { parseRequest, sendContract } from 'utils/contract';

export class WordleNotificationsController {
  constructor(private readonly service: WordleNotificationService) {}
  async config(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.getNotificationConfig, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid community' });
      return;
    }
    sendContract(res, contract.getNotificationConfig, {
      data: await this.service.getConfig(input.params.guildId),
    });
  }
  async configure(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.setNotificationConfig, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid configuration' });
      return;
    }
    await this.service.configure(input.params.guildId, input.body);
    sendContract(res, contract.setNotificationConfig, { data: input.body });
  }
  async claim(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.claimNotification, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid community' });
      return;
    }
    sendContract(res, contract.claimNotification, {
      data: await this.service.claim(input.params.guildId),
    });
  }
  async settle(req: Request, res: Response): Promise<void> {
    const input = parseRequest(contract.settleNotification, req);
    if (!input) {
      res.status(400).json({ message: 'Invalid delivery' });
      return;
    }
    const { id, leaseId, result } = input.body;
    let recorded: boolean;
    if (result === 'delivered')
      recorded = await this.service.confirm(
        input.params.guildId,
        id,
        leaseId,
        input.body.messageId,
      );
    else if (result === 'not_sent')
      recorded = await this.service.release(input.params.guildId, id, leaseId);
    else
      recorded = await this.service.ambiguous(
        input.params.guildId,
        id,
        leaseId,
      );
    sendContract(res, contract.settleNotification, { data: { recorded } });
  }
}
