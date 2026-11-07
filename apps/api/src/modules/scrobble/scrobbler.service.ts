import type { PlaybackData } from '@marquinhos/contracts/http/routes/scrobble';
import { Injectable } from '@nestjs/common';
import { DiscordService } from 'integrations/discord/discord.service';
import { LastfmService } from 'integrations/lastfm/lastfm.service';
import { ParserService } from 'modules/scrobble/parser.service';

@Injectable()
export class ScrobblerService {
  constructor(
    private readonly discordService: DiscordService,
    private readonly lastfmService: LastfmService,
    private readonly parserService: ParserService,
  ) {}

  async addScrobbleToQueue(playbackData: PlaybackData) {
    const track = await this.parserService.parseTrack(playbackData);

    return await this.lastfmService.addToScrobbleQueue(track, playbackData);
  }

  async dispatchScrobble(id: string) {
    return await this.lastfmService.dispatchScrobbleFromQueue(id);
  }

  async removeUserFromScrobble(scrobbleId: string, userId: string) {
    return await this.lastfmService.removeUserFromScrobble(scrobbleId, userId);
  }

  async addUserToScrobble(scrobbleId: string, userId: string) {
    return await this.lastfmService.addUserToScrobble(scrobbleId, userId);
  }
}
