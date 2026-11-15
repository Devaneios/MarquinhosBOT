import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LastfmModule } from 'integrations/lastfm/lastfm.module';
import { SandboxSweepJob } from 'jobs/sandbox-sweep.job';
import { ScrobbleRetryJob } from 'jobs/scrobble-retry.job';
import { WordleDraftFinalizationJob } from 'jobs/wordle-draft-finalization.job';
import { WordleReconcileJob } from 'jobs/wordle-reconcile.job';
import { AiChatModule } from 'modules/ai-chat/ai-chat.module';
import { WordleModule } from 'modules/wordle/wordle.module';

@Module({
  imports: [ScheduleModule.forRoot(), WordleModule, AiChatModule, LastfmModule],
  providers: [
    WordleDraftFinalizationJob,
    WordleReconcileJob,
    SandboxSweepJob,
    ScrobbleRetryJob,
  ],
})
export class JobsModule {}
