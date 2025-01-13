import { MarquinhosApiService } from '@marquinhos/services/marquinhosApi';
import { PlaybackData } from '@marquinhos/types';
import { Track } from 'discord-player';
import { VoiceBasedChannel } from 'discord.js';

const marquinhosApi = new MarquinhosApiService();

export class Scrobble {
  playbackData: PlaybackData | null = null;
  private scrobbleId = '';

  async create(voiceChannel: VoiceBasedChannel, track: Track | null) {
    await voiceChannel.fetch();
    const listeningUsersId =
      voiceChannel.members.map((member) => member.id) ?? [];

    this.playbackData = {
      title: track?.title ?? '',
      url: track?.url ?? '',
      guildId: voiceChannel.guildId,
      timestamp: new Date(),
      channelId: voiceChannel.id,
      listeningUsersId: listeningUsersId,
      providerName: 'Marquinhos',
    };
  }

  async queue() {
    if (!this.playbackData) return;

    const response = await marquinhosApi.addToScrobbleQueue(this.playbackData);
    if (response) this.scrobbleId = response.data.id;
  }

  async dispatch() {
    if (!this.scrobbleId) return;
    await marquinhosApi.dispatchScrobbleQueue(this.scrobbleId);
  }
}
