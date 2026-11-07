import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { logger } from 'common/logging/logger';
import { WordleService } from 'modules/wordle/wordle.service';

@Injectable()
export class WordleDraftFinalizationJob {
  constructor(private readonly wordle: WordleService) {}

  @Interval(30_000)
  async finalizeExpiredDrafts(): Promise<void> {
    try {
      await this.wordle.finalizeExpiredDrafts();
    } catch (error) {
      logger.error('wordle.draft_finalization_failed', { error });
    }
  }
}
