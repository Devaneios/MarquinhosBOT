import { Injectable, Optional } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SandboxManager } from 'modules/ai-chat/sandbox/sandbox-manager.service';
import { runExclusiveJob } from 'redis/job-lock';
import { RedisService } from 'redis/redis.service';

@Injectable()
export class SandboxSweepJob {
  private readonly state = { running: false };

  constructor(
    private readonly sandbox: SandboxManager,
    @Optional() private readonly redis?: RedisService,
  ) {}

  @Interval(5 * 60_000)
  async sweepIdleSessions(): Promise<void> {
    await runExclusiveJob(
      this.state,
      this.redis,
      'jobs:sandbox:sweep',
      4 * 60_000,
      'sandbox.sweep_failed',
      () => this.sandbox.sweepIdleSessions(),
    );
  }
}
