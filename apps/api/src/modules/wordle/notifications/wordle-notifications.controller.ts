import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import { Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { BotAuth } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { WordleNotificationService } from 'modules/wordle/notifications/wordle-notification.service';

@Controller('wordle/admin/notifications')
@BotAuth()
export class WordleNotificationsController {
  constructor(private readonly service: WordleNotificationService) {}

  @Get(':guildId')
  async config(
    @ContractInput(contract.getNotificationConfig, 'Invalid community')
    input: ContractInputValue<typeof contract.getNotificationConfig>,
  ): Promise<ContractResponseInput<typeof contract.getNotificationConfig>> {
    return { data: await this.service.getConfig(input.params.guildId) };
  }

  @Put(':guildId')
  @HttpCode(200)
  async configure(
    @ContractInput(contract.setNotificationConfig, 'Invalid configuration')
    input: ContractInputValue<typeof contract.setNotificationConfig>,
  ): Promise<ContractResponseInput<typeof contract.setNotificationConfig>> {
    await this.service.configure(input.params.guildId, input.body);
    return { data: input.body };
  }

  @Post(':guildId/claim')
  @HttpCode(200)
  async claim(
    @ContractInput(contract.claimNotification, 'Invalid community')
    input: ContractInputValue<typeof contract.claimNotification>,
  ): Promise<ContractResponseInput<typeof contract.claimNotification>> {
    return { data: await this.service.claim(input.params.guildId) };
  }

  @Post(':guildId/settle')
  @HttpCode(200)
  async settle(
    @ContractInput(contract.settleNotification, 'Invalid delivery')
    input: ContractInputValue<typeof contract.settleNotification>,
  ): Promise<ContractResponseInput<typeof contract.settleNotification>> {
    const { id, leaseId, result } = input.body;
    let recorded: boolean;
    if (result === 'delivered') {
      recorded = await this.service.confirm(
        input.params.guildId,
        id,
        leaseId,
        input.body.messageId,
      );
    } else if (result === 'ambiguous') {
      recorded = await this.service.ambiguous(
        input.params.guildId,
        id,
        leaseId,
      );
    } else {
      recorded = await this.service.release(
        input.params.guildId,
        id,
        leaseId,
        result,
      );
    }
    return { data: { recorded } };
  }

  @Get(':guildId/uncertain')
  async uncertain(
    @ContractInput(contract.listUncertainNotifications, 'Invalid community')
    input: ContractInputValue<typeof contract.listUncertainNotifications>,
  ): Promise<
    ContractResponseInput<typeof contract.listUncertainNotifications>
  > {
    return { data: await this.service.uncertain(input.params.guildId) };
  }

  @Post(':guildId/resolve')
  @HttpCode(200)
  async resolve(
    @ContractInput(contract.resolveNotification, 'Invalid reconciliation')
    input: ContractInputValue<typeof contract.resolveNotification>,
  ): Promise<ContractResponseInput<typeof contract.resolveNotification>> {
    const { id, result } = input.body;
    const recorded = await this.service.resolve(
      input.params.guildId,
      id,
      result,
      result === 'found' ? input.body.messageId : undefined,
    );
    return { data: { recorded } };
  }
}
