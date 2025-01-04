import { GuildMember, VoiceState } from 'discord.js';

import { BotEvent } from '@marquinhos/types';

// WIP
export const voiceStateUpdate: BotEvent = {
  name: 'voiceStateUpdate',
  execute: async (oldState: VoiceState, newState: VoiceState) => {
    const member = oldState.member;
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (!member) {
      return;
    }

    if (!oldChannel && newChannel) {
      userJoinedVoiceChannel(member);
    } else if (oldChannel && !newChannel) {
      userLeftVoiceChannel(member);
    } else if (oldChannel && newChannel && newChannel.id !== oldChannel.id) {
      userChangedVoiceChannel(member);
    } else if (oldChannel && newChannel && newChannel.id === oldChannel.id) {
      userChangedVoiceState(member);
    }
  },
};

async function userJoinedVoiceChannel(member: GuildMember) {
  return;
}

async function userLeftVoiceChannel(member: GuildMember) {
  return;
}

async function userChangedVoiceChannel(member: GuildMember) {
  return;
}
async function userChangedVoiceState(member: GuildMember) {
  return;
}

async function arrestUser(member: GuildMember) {
  if (member.voice.channel?.id != member.guild.afkChannelId) {
    // a try/catch so if the person disconnect, Marquinhos don't break
    try {
      member.voice.setChannel(member.guild.afkChannelId);
      member.send('Você está preso! :(');
    } catch (error) {
      throw new Error('Error arresting user');
    }
  } else {
    // User is already in arrested's channel;
    return;
  }
}
