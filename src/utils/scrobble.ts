import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { Track } from 'discord-player';
import { VoiceBasedChannel } from 'discord.js';

const marquinhosApi = new MarquinhosApiService();

export class Scrobble {
  title: string | null = null;
  url: string | null = null;
  duration = 0;
  guildId: string | null = null;
  timestamp = new Date();
  channelId: string | null = null;
  listeningUsersId: string[] = [];
  providerName = 'Marquinhos';

  async create(voiceChannel: VoiceBasedChannel, track: Track | null) {
    await voiceChannel.fetch();
    const listeningUsersId =
      voiceChannel.members.map((member) => member.id) ?? [];

    this.title = track?.title ?? null;
    this.url = track?.url ?? null;
    this.duration = track?.durationMS ?? 0;
    this.guildId = voiceChannel.guildId;
    this.timestamp = new Date();
    this.channelId = voiceChannel.id;
    this.listeningUsersId = listeningUsersId;
  }

  async queue() {
    if (!this.title || !this.duration || !this.listeningUsersId.length) return;

    const response = await marquinhosApi.addToScrobbleQueue(this);
    if (response) {
      const scrobbleId = response.data.id;
      const fourMinutesInMillis = 240000;

      const timeUntilScrobbling = Math.min(
        Math.floor(this.duration / 2),
        fourMinutesInMillis
      );
      setTimeout(() => {
        marquinhosApi.dispatchScrobbleQueue(scrobbleId);
      }, timeUntilScrobbling);
    }
  }
}
