import { Injectable, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { WordleService } from 'modules/wordle/wordle.service';
import { runExclusiveJob } from 'redis/job-lock';
import { RedisService } from 'redis/redis.service';

@Injectable()
export class WordleDraftFinalizationJob {
  private readonly state = { running: false };

  constructor(
    private readonly wordle: WordleService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  @Interval(30_000)
  async finalizeExpiredDrafts(): Promise<void> {
    await runExclusiveJob(
      this.state,
      this.redis,
      'jobs:wordle:draft-finalization',
      25_000,
      'wordle.draft_finalization_failed',
      () => this.wordle.finalizeExpiredDrafts(),
    );
  }
}
