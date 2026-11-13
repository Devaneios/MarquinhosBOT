import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { logger } from 'common/logging/logger';
import { WordleService } from 'modules/wordle/wordle.service';

@Injectable()
export class WordleDraftFinalizationJob {
  private running = false;

  constructor(private readonly wordle: WordleService) {}

  @Interval(30_000)
  async finalizeExpiredDrafts(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.wordle.finalizeExpiredDrafts();
    } catch (error) {
      logger.error('wordle.draft_finalization_failed', { error });
    } finally {
      this.running = false;
    }
  }
}
