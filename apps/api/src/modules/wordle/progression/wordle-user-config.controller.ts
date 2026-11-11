import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import type { WordleUserConfig } from '@marquinhos/contracts/wordle';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
} from '@nestjs/common';
import { ActivityAuth } from 'common/decorators/auth.decorators';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import type { DiscordUser } from 'integrations/discord/discord.service';
import { WordleUserConfigService } from 'modules/wordle/progression/wordle-user-config.service';

@Controller('wordle')
@ActivityAuth()
export class WordleUserConfigController {
  constructor(private readonly service: WordleUserConfigService) {}

  @Get('user-config')
  async getUserConfig(
    @CurrentUser() user: DiscordUser,
  ): Promise<ContractResponseInput<typeof contract.getUserConfig>> {
    return { data: await this.service.get(user.id) };
  }

  @Put('user-config')
  async updateUserConfig(
    @CurrentUser() user: DiscordUser,
    @Body() body: unknown,
  ): Promise<ContractResponseInput<typeof contract.updateUserConfig>> {
    const config = contract.updateUserConfig.body.safeParse(body);
    if (!config.success) {
      throw new BadRequestException({
        message:
          'Wordle config fields must be booleans, and arrow keys require space.',
      });
    }
    return {
      data: await this.service.update(user.id, config.data as WordleUserConfig),
    };
  }
}
