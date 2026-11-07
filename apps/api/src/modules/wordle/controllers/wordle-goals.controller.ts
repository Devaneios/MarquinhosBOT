import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import {
  ActivityGuildMember,
  BotAuth,
} from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import {
  InvalidWordleGoal,
  WordleGoalsService,
} from 'modules/wordle/services/wordle-goals.service';

@Controller('wordle')
export class WordleGoalsController {
  constructor(private readonly service: WordleGoalsService) {}

  @Get('goals/:guildId')
  @ActivityGuildMember()
  async list(
    @Param('guildId') guildId: string,
  ): Promise<ContractResponseInput<typeof contract.listGoals>> {
    return { data: await this.service.listWithProgress(guildId) };
  }

  @Post('admin/goals')
  @HttpCode(201)
  @BotAuth()
  async create(
    @ContractInput(contract.createGoal, 'Invalid goal')
    input: ContractInputValue<typeof contract.createGoal>,
  ): Promise<ContractResponseInput<typeof contract.createGoal>> {
    try {
      const { guildId, target, firstDate, lastDate } = input.body;
      return {
        data: await this.service.createForDates(
          guildId,
          target,
          firstDate,
          lastDate,
        ),
      };
    } catch (error) {
      if (error instanceof InvalidWordleGoal) {
        throw new BadRequestException({
          message: 'Invalid goal dates or target',
        });
      }
      throw error;
    }
  }
}
