import { Module } from '@nestjs/common';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { ConfigModule } from 'config/config.module';
import { DatabaseModule } from 'database/database.module';
import { MazeController } from 'modules/maze/maze.controller';
import { MazeService } from 'modules/maze/maze.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [MazeController],
  providers: [MazeService, BotAuthGuard],
  exports: [MazeService],
})
export class MazeModule {}
