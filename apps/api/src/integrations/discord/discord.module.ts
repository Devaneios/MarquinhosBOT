import { Module } from '@nestjs/common';
import { ConfigModule } from 'config/config.module';
import { DiscordService } from 'integrations/discord/discord.service';

@Module({
  imports: [ConfigModule],
  providers: [DiscordService],
  exports: [DiscordService],
})
export class DiscordModule {}
