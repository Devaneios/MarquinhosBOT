import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { WordleService } from 'services/wordle';
import { logger } from 'utils/logger';

@Injectable()
export class WordleDraftFinalizationJob {
  @Interval(30_000)
  async finalizeExpiredDrafts(): Promise<void> {
    try {
      await new WordleService().finalizeExpiredDrafts();
    } catch (error) {
      logger.error('wordle.draft_finalization_failed', { error });
    }
  }
}
