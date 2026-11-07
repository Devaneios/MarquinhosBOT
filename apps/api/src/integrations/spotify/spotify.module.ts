import { Module } from '@nestjs/common';
import { ConfigModule } from 'config/config.module';
import { SpotifyService } from 'integrations/spotify/spotify.service';

@Module({
  imports: [ConfigModule],
  providers: [SpotifyService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
