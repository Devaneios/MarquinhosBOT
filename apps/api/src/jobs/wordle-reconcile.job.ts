import {
  Injectable,
  Optional,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { logger } from 'common/logging/logger';
import { WordleAlbumService } from 'modules/wordle/community/wordle-album.service';
import { WordleGalleryService } from 'modules/wordle/community/wordle-gallery.service';
import { WordleGoalsService } from 'modules/wordle/community/wordle-goals.service';
import { WordleGlobalGameCoordinator } from 'modules/wordle/gameplay/wordle-global-game-coordinator';
import { WordleNotificationService } from 'modules/wordle/notifications/wordle-notification.service';
import { runExclusiveJob } from 'redis/job-lock';
import { RedisService } from 'redis/redis.service';

@Injectable()
export class WordleReconcileJob implements OnApplicationBootstrap {
  private readonly state = { running: false };

  constructor(
    private readonly notifications: WordleNotificationService,
    private readonly goals: WordleGoalsService,
    private readonly gallery: WordleGalleryService,
    private readonly game: WordleGlobalGameCoordinator,
    private readonly album: WordleAlbumService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  onApplicationBootstrap(): void {
    void this.reconcile();
  }

  @Interval(30_000)
  async reconcileOnInterval(): Promise<void> {
    await this.reconcile();
  }

  private async reconcile(): Promise<void> {
    await runExclusiveJob(
      this.state,
      this.redis,
      'jobs:wordle:reconcile',
      25_000,
      'wordle.reconcile_failed',
      async () => {
        const steps: [string, () => Promise<unknown>][] = [
          [
            'wordle.achievement.retry_failed',
            () => this.game.reconcilePending(),
          ],
          ['wordle.album.retry_failed', () => this.album.processPending()],
          ['wordle.goal.scheduler_failed', () => this.goals.processDue()],
          [
            'wordle.notification.reap_failed',
            () => this.notifications.reapStale(120_000),
          ],
          [
            'wordle.notification.weekly_failed',
            () => this.notifications.queueWeeklySummaries(),
          ],
          [
            'wordle.gallery.weekly_failed',
            () => this.gallery.queuePreviousWeek(),
          ],
        ];
        for (const [event, step] of steps) {
          try {
            await step();
          } catch (error) {
            logger.warn(event, { error });
          }
        }
      },
    );
  }
}
