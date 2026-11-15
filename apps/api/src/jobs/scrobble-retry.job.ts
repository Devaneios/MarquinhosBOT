import { Injectable, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { LastfmService } from 'integrations/lastfm/lastfm.service';
import { runExclusiveJob } from 'redis/job-lock';
import { RedisService } from 'redis/redis.service';

@Injectable()
export class ScrobbleRetryJob {
  private readonly state = { running: false };

  constructor(
    private readonly lastfm: LastfmService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  @Interval(30_000)
  async retryPendingScrobbles(): Promise<void> {
    await runExclusiveJob(
      this.state,
      this.redis,
      'jobs:scrobble:retry',
      25_000,
      'scrobble.retry_failed',
      () => this.lastfm.retryPendingScrobbles().then(() => undefined),
    );
  }
}
