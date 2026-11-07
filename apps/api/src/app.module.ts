import { Module } from '@nestjs/common';
import { HttpInfrastructureModule } from 'common/http/http-infrastructure.module';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { JobsModule } from 'jobs/jobs.module';
import { AuthModule } from 'modules/auth/auth.module';
import { GamificationModule } from 'modules/gamification/gamification.module';
import { HealthModule } from 'modules/health/health.module';
import { MazeModule } from 'modules/maze/maze.module';
import { PrivacyPolicyModule } from 'modules/privacy-policy/privacy-policy.module';
import { ScrobbleModule } from 'modules/scrobble/scrobble.module';
import { UserModule } from 'modules/user/user.module';
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
    AuthModule,
    GamificationModule,
    HealthModule,
    MazeModule,
    PrivacyPolicyModule,
    ScrobbleModule,
    UserModule,
  ],
})
export class AppModule {}
