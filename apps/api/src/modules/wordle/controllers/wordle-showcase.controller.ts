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
  InvalidWordleShowcase,
  WordleShowcaseService,
} from 'modules/wordle/services/wordle-showcase.service';

@Controller('wordle')
@ActivityAuth()
export class WordleShowcaseController {
  constructor(private readonly service: WordleShowcaseService) {}

  @Get('showcase')
  async get(
    @CurrentUser() user: DiscordUser,
  ): Promise<ContractResponseInput<typeof contract.getShowcase>> {
    return { data: await this.service.get(user.id) };
  }

  @Put('showcase')
  @HttpCode(200)
  async update(
    @CurrentUser() user: DiscordUser,
    @ContractInput(contract.updateShowcase, 'Invalid showcase')
    input: ContractInputValue<typeof contract.updateShowcase>,
  ): Promise<ContractResponseInput<typeof contract.updateShowcase>> {
    try {
      await this.service.replace(user.id, input.body.achievements);
    } catch (error) {
      if (error instanceof InvalidWordleShowcase) {
        throw new BadRequestException({ message: error.message });
      }
      throw error;
    }
    return { data: input.body.achievements };
  }
}
