import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ActivityGuildMember } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import type { DiscordUser } from 'integrations/discord/discord.service';
import {
  InvalidWordleChallenge,
  WordleChallengeService,
} from 'modules/wordle/community/wordle-challenge.service';

@Controller('wordle')
export class WordleChallengesController {
  constructor(private readonly service: WordleChallengeService) {}

  @Get('challenges/:guildId')
  @ActivityGuildMember()
  async list(
    @CurrentUser() user: DiscordUser,
    @ContractInput(contract.listChallenges, 'Invalid community')
    input: ContractInputValue<typeof contract.listChallenges>,
  ): Promise<ContractResponseInput<typeof contract.listChallenges>> {
    return { data: await this.service.list(input.params.guildId, user.id) };
  }

  @Post('challenges/:guildId')
  @HttpCode(201)
  @ActivityGuildMember()
  async create(
    @CurrentUser() user: DiscordUser,
    @ContractInput(contract.createChallenge, 'Invalid challenge')
    input: ContractInputValue<typeof contract.createChallenge>,
  ): Promise<ContractResponseInput<typeof contract.createChallenge>> {
    try {
      return {
        data: await this.service.create(
          input.params.guildId,
          user.id,
          input.body.patternId,
          input.body.closesAt,
        ),
      };
    } catch (error) {
      if (error instanceof InvalidWordleChallenge) {
        throw new BadRequestException({ message: error.message });
      }
      throw error;
    }
  }

  @Post('challenges/:guildId/:challengeId/join')
  @HttpCode(200)
  @ActivityGuildMember()
  async join(
    @CurrentUser() user: DiscordUser,
    @ContractInput(contract.joinChallenge, 'Invalid challenge')
    input: ContractInputValue<typeof contract.joinChallenge>,
  ): Promise<ContractResponseInput<typeof contract.joinChallenge>> {
    try {
      await this.service.join(
        input.params.challengeId,
        input.params.guildId,
        user.id,
      );
      return { data: { joined: true } };
    } catch (error) {
      if (error instanceof InvalidWordleChallenge) {
        throw new BadRequestException({ message: error.message });
      }
      throw error;
    }
  }
}
