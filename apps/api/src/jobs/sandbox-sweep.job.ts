import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { logger } from 'common/logging/logger';
import { SandboxManager } from 'modules/ai-chat/sandbox/sandbox-manager.service';

@Injectable()
export class SandboxSweepJob {
  private running = false;

  constructor(private readonly sandbox: SandboxManager) {}

  @Interval(5 * 60_000)
  async sweepIdleSessions(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sandbox.sweepIdleSessions();
    } catch (error) {
      logger.error('sandbox.sweep_failed', { error });
    } finally {
      this.running = false;
    }
  }
}
