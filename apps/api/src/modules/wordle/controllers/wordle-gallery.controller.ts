import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import {
  ActivityGuildMember,
  BotAuth,
} from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import {
  InvalidWordleGallery,
  WordleGalleryService,
} from 'modules/wordle/services/wordle-gallery.service';

@Controller('wordle')
export class WordleGalleryController {
  constructor(private readonly service: WordleGalleryService) {}

  @Get('gallery/:guildId')
  @ActivityGuildMember()
  async get(
    @Param('guildId') guildId: string,
  ): Promise<ContractResponseInput<typeof contract.getGallery>> {
    return { data: await this.service.previousWeek(guildId) };
  }

  @Get('admin/gallery/:guildId')
  @BotAuth()
  async getForWeek(
    @ContractInput(contract.getBotGallery, 'Invalid gallery week')
    input: ContractInputValue<typeof contract.getBotGallery>,
  ): Promise<ContractResponseInput<typeof contract.getBotGallery>> {
    try {
      return {
        data: await this.service.forWeek(
          input.params.guildId,
          input.query.week,
        ),
      };
    } catch (error) {
      if (error instanceof InvalidWordleGallery) {
        throw new BadRequestException({ message: error.message });
      }
      throw error;
    }
  }
}
