import { BotEvent } from '../types';
import ArrestedModel from '../schemas/arrested';
import { GuildMember, VoiceState } from 'discord.js';

// WIP
export const voiceStateUpdate: BotEvent = {
  name: 'voiceStateUpdate',
  execute: async (oldState: VoiceState, newState: VoiceState) => {
    const member = oldState.member;
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (oldChannel && !newChannel) {
      userJoinedVoiceChannel(member);
    } else if (!oldChannel && newChannel) {
      userLeftVoiceChannel(member);
    } else if (!oldChannel && !newChannel && newChannel.id !== oldChannel.id) {
      userChangedVoiceChannel(member);
    } else if (!oldChannel && !newChannel && newChannel.id === oldChannel.id) {
      userChangedVoiceState(member);
    }
  },
};

async function userJoinedVoiceChannel(member: GuildMember) {
  if (await isUserArrested(member)) {
    arrestUser(member);
  }
}

async function userLeftVoiceChannel(member: GuildMember) {
  return;
}

async function userChangedVoiceChannel(member: GuildMember) {
  if (await isUserArrested(member)) {
    arrestUser(member);
  }
}
async function userChangedVoiceState(member: GuildMember) {
  return;
}

async function isUserArrested(member: GuildMember) {
  return ArrestedModel.collection.findOne({
    id: member.id,
    tag: member.user.tag,
  });
}

async function arrestUser(member: GuildMember) {
  if (member.voice?.channel.id != member.guild.afkChannelId) {
    // a try/catch so if the person disconnect, Marquinhos don't break
    try {
      member.voice.setChannel(member.guild.afkChannelId);
      member.send('Você está preso! :(');
    } catch (error) {
      console.log(error);
    }
  } else {
    // User is already in arrested's channel;
    return;
  }
}
