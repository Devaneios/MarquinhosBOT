import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from 'database/database.module';
import { SandboxSweepJob } from 'jobs/sandbox-sweep.job';
import { WordleDraftFinalizationJob } from 'jobs/wordle-draft-finalization.job';
import { WordleReconcileJob } from 'jobs/wordle-reconcile.job';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule],
  providers: [WordleDraftFinalizationJob, WordleReconcileJob, SandboxSweepJob],
})
export class JobsModule {}
