import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Put,
} from '@nestjs/common';
import { ActivityAuth } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import type { DiscordUser } from 'integrations/discord/discord.service';
import {
  InvalidWordleReward,
  WordleRewardsService,
} from 'modules/wordle/progression/wordle-rewards.service';

@Controller('wordle')
@ActivityAuth()
export class WordleRewardsController {
  constructor(private readonly service: WordleRewardsService) {}

  @Get('rewards')
  async get(
    @CurrentUser() user: DiscordUser,
  ): Promise<ContractResponseInput<typeof contract.getRewards>> {
    await this.service.reconcile(user.id);
    return { data: await this.service.get(user.id) };
  }

  @Put('rewards')
  @HttpCode(200)
  async update(
    @CurrentUser() user: DiscordUser,
    @ContractInput(contract.updateReward, 'Invalid reward')
    input: ContractInputValue<typeof contract.updateReward>,
  ): Promise<ContractResponseInput<typeof contract.updateReward>> {
    try {
      await this.service.reconcile(user.id);
      await this.service.equip(user.id, input.body.kind, input.body.rewardId);
    } catch (error) {
      if (error instanceof InvalidWordleReward) {
        throw new BadRequestException({ message: error.message });
      }
      throw error;
    }
    return { data: await this.service.get(user.id) };
  }
}
