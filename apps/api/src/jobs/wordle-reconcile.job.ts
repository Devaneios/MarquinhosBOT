import type { Db } from '@marquinhos/database/client';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DB } from 'database/database.tokens';
import { WordleGalleryService } from 'services/wordle/WordleGalleryService';
import { WordleGoalsService } from 'services/wordle/WordleGoalsService';
import { WordleNotificationService } from 'services/wordle/WordleNotificationService';
import { logger } from 'utils/logger';

@Injectable()
export class WordleReconcileJob implements OnApplicationBootstrap {
  private reconciling = false;

  constructor(@Inject(DB) private readonly database: Db) {}

  onApplicationBootstrap(): void {
    void this.reconcile();
  }

  @Interval(30_000)
  async reconcileOnInterval(): Promise<void> {
    await this.reconcile();
  }

  private async reconcile(): Promise<void> {
    if (this.reconciling) return;
    this.reconciling = true;
    const notifications = new WordleNotificationService(this.database);
    const steps: [string, () => Promise<unknown>][] = [
      [
        'wordle.goal.scheduler_failed',
        () => new WordleGoalsService(this.database).processDue(),
      ],
      [
        'wordle.notification.reap_failed',
        () => notifications.reapStale(120_000),
      ],
      [
        'wordle.notification.weekly_failed',
        () => notifications.queueWeeklySummaries(),
      ],
      [
        'wordle.gallery.weekly_failed',
        () => new WordleGalleryService(this.database).queuePreviousWeek(),
      ],
    ];

    try {
      for (const [event, step] of steps) {
        try {
          await step();
        } catch (error) {
          logger.warn(event, { error });
        }
      }
    } finally {
      this.reconciling = false;
    }
  }
}
