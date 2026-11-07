import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SandboxSweepJob } from 'jobs/sandbox-sweep.job';
import { WordleDraftFinalizationJob } from 'jobs/wordle-draft-finalization.job';
import { WordleReconcileJob } from 'jobs/wordle-reconcile.job';
import { AiChatModule } from 'modules/ai-chat/ai-chat.module';
import { WordleModule } from 'modules/wordle/wordle.module';

@Module({
  imports: [ScheduleModule.forRoot(), WordleModule, AiChatModule],
  providers: [WordleDraftFinalizationJob, WordleReconcileJob, SandboxSweepJob],
})
export class JobsModule {}
