import { Module } from '@nestjs/common';
import { HttpInfrastructureModule } from 'common/http/http-infrastructure.module';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { JobsModule } from 'jobs/jobs.module';
import { HealthModule } from 'modules/health/health.module';
import { PrivacyPolicyModule } from 'modules/privacy-policy/privacy-policy.module';
import { RealtimeModule } from 'realtime/realtime.module';
import { StartupModule } from 'startup/startup.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HttpInfrastructureModule,
    RealtimeModule,
    StartupModule,
    JobsModule,
    HealthModule,
    PrivacyPolicyModule,
  ],
})
export class AppModule {}
