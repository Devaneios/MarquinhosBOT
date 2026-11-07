import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DockerodeSandboxClient } from 'services/aiChat/sandbox/DockerodeSandboxClient';
import { SandboxManager } from 'services/aiChat/sandbox/SandboxManager';
import { logger } from 'utils/logger';

@Injectable()
export class SandboxSweepJob {
  private readonly sandbox = new SandboxManager(new DockerodeSandboxClient());

  @Interval(5 * 60_000)
  async sweepIdleSessions(): Promise<void> {
    try {
      await this.sandbox.sweepIdleSessions();
    } catch (error) {
      logger.error('sandbox.sweep_failed', { error });
    }
  }
}
