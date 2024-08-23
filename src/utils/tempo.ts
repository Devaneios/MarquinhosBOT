/**
MIT License

Copyright (c) 2020 Erick Almeida (https://github.com/Erick2280)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

import { GuildMember, Message, VoiceChannel } from 'discord.js';
import dotenv from 'dotenv';
import { PlaybackData } from '@marquinhos/types';

dotenv.config();

export class TempoDataProvider {
  readonly providerName = 'Tempo Bot';
  readonly providerAdditionalInfo = 'Out-of-the-box support.';
  readonly titlePaddingIndex = 9;

  isHandleableMessage(message: Message): boolean {
    return (
      message.author.username.startsWith('Tempo') &&
      !!message?.embeds[0]?.title?.startsWith('Playing: ')
    );
  }

  async getPlaybackDataFromMessage(
    message: Message
  ): Promise<PlaybackData | null> {
    const title = message?.embeds[0]?.title?.slice(this.titlePaddingIndex);
    const guildMember = await message.guild?.members.cache
      .get(message.author.id)
      ?.fetch(true);
    const voiceChannelId = guildMember?.voice.channelId;

    if (!voiceChannelId) return null;

    const voiceChannel = await (
      message.guild?.channels.cache.get(voiceChannelId) as VoiceChannel
    ).fetch(true);
    const listeningUsersId: string[] = [];
    voiceChannel.members?.forEach((member: GuildMember) => {
      listeningUsersId.push(member.id);
    });

    if (
      !title ||
      !message.guild ||
      !message.member?.voice.channelId ||
      !listeningUsersId.length
    ) {
      return null;
    }

    return {
      title,
      guildId: message.guild?.id,
      timestamp: new Date(),
      channelId: message.member?.voice.channelId,
      listeningUsersId,
      providerName: this.providerName,
    };
  }
}
