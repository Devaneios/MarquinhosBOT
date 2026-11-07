import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { logger } from 'common/logging/logger';
import { WordleGalleryService } from 'modules/wordle/services/wordle-gallery.service';
import { WordleGoalsService } from 'modules/wordle/services/wordle-goals.service';
import { WordleNotificationService } from 'modules/wordle/services/wordle-notification.service';

@Injectable()
export class WordleReconcileJob implements OnApplicationBootstrap {
  private reconciling = false;

  constructor(
    private readonly notifications: WordleNotificationService,
    private readonly goals: WordleGoalsService,
    private readonly gallery: WordleGalleryService,
  ) {}

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
    const steps: [string, () => Promise<unknown>][] = [
      ['wordle.goal.scheduler_failed', () => this.goals.processDue()],
      [
        'wordle.notification.reap_failed',
        () => this.notifications.reapStale(120_000),
      ],
      [
        'wordle.notification.weekly_failed',
        () => this.notifications.queueWeeklySummaries(),
      ],
      ['wordle.gallery.weekly_failed', () => this.gallery.queuePreviousWeek()],
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
