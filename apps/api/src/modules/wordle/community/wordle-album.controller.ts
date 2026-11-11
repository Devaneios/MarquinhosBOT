import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import { Controller, Get, Param } from '@nestjs/common';
import { ActivityGuildMember } from 'common/decorators/auth.decorators';
import { WordleAlbumService } from 'modules/wordle/community/wordle-album.service';

@Controller('wordle')
export class WordleAlbumController {
  constructor(private readonly service: WordleAlbumService) {}

  @Get('album/:guildId')
  @ActivityGuildMember()
  async get(
    @Param('guildId') guildId: string,
  ): Promise<ContractResponseInput<typeof contract.getAlbum>> {
    return { data: await this.service.pages(guildId) };
  }
}
