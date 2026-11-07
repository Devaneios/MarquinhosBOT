import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
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
  InvalidWordleBingo,
  WordleBingoService,
} from 'modules/wordle/services/wordle-bingo.service';

@Controller('wordle')
export class WordleBingoController {
  constructor(private readonly service: WordleBingoService) {}

  @Get('bingo/:guildId')
  @ActivityGuildMember()
  async list(
    @ContractInput(contract.listBingo, 'Invalid community')
    input: ContractInputValue<typeof contract.listBingo>,
  ): Promise<ContractResponseInput<typeof contract.listBingo>> {
    return { data: await this.service.list(input.params.guildId) };
  }

  @Post('admin/bingo')
  @HttpCode(201)
  @BotAuth()
  async create(
    @ContractInput(contract.createBingo, 'Invalid bingo')
    input: ContractInputValue<typeof contract.createBingo>,
  ): Promise<ContractResponseInput<typeof contract.createBingo>> {
    try {
      const { guildId, firstDate, lastDate, allowMulti } = input.body;
      return {
        data: await this.service.createForDates(
          guildId,
          firstDate,
          lastDate,
          allowMulti,
        ),
      };
    } catch (error) {
      if (error instanceof InvalidWordleBingo) {
        throw new BadRequestException({ message: error.message });
      }
      throw error;
    }
  }
}
