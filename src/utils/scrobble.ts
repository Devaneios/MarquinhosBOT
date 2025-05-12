import { PlaybackData } from '@marquinhos/types';
import { Track } from 'discord-player';
import { VoiceBasedChannel } from 'discord.js';

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
  }

  async dispatch() {
    if (!this.scrobbleId) return;
  }
}
