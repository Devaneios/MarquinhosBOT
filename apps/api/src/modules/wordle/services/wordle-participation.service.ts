import type { Db } from '@marquinhos/database/client';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from 'database/database.tokens';
import { WordleAlbumService } from 'modules/wordle/services/wordle-album.service';
import { recordWordlePresence } from 'modules/wordle/services/wordle-community.service';
import { WORDLE_NOW, WORDLE_TODAY } from 'modules/wordle/wordle.tokens';

@Injectable()
export class WordleParticipationService {
  constructor(
    @Inject(DB) private readonly database: Db,
    private readonly album: WordleAlbumService,
    @Inject(WORDLE_TODAY) private readonly today: () => string,
    @Inject(WORDLE_NOW) private readonly now: () => number,
  ) {}

  async record(userId: string, guildId: string): Promise<void> {
    await recordWordlePresence(
      this.database,
      this.album,
      userId,
      guildId,
      this.today(),
      Math.floor(this.now() / 1000),
    );
  }
}
