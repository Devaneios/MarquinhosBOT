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

import { BaseGuildVoiceChannel, Message, TextChannel } from 'discord.js';
import dotenv from 'dotenv';
import { PlaybackData } from 'src/types';

dotenv.config();

export class TempoDataProvider {
  readonly providerName = 'Tempo Bot';
  readonly providerAdditionalInfo = 'Out-of-the-box support.';
  readonly titlePaddingIndex = 9;

  isHandleableMessage(message: Message): boolean {
    return (
      message.author.username.startsWith('Tempo') &&
      message?.embeds[0]?.title?.startsWith('Playing: ')
    );
  }

  async getPlaybackDataFromMessage(message: Message): Promise<PlaybackData> {
    const title = message?.embeds[0]?.title?.slice(this.titlePaddingIndex);

    const voiceChannelId = message.member.voice.channelId;
    const voiceChannel = (await message.guild.channels.fetch(
      voiceChannelId
    )) as BaseGuildVoiceChannel;
    const listeningUsersId = voiceChannel.members.map((member) => member.id);

    return {
      title,
      guildId: message.guild.id,
      timestamp: new Date(),
      channelId: message.member.voice.channelId,
      listeningUsersId,
      providerName: this.providerName,
    };
  }
}
