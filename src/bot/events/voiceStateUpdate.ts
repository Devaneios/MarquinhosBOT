import { BotEvent } from '@marquinhos/types';
import { XPSystem } from '@marquinhos/utils/xpSystem';
import { VoiceState } from 'discord.js';

export const voiceStateUpdate: BotEvent = {
  name: 'voiceStateUpdate',
  execute: async (oldState: VoiceState, newState: VoiceState) => {
    // Only award XP when a user joins a voice channel (not on leave or move)
    const joined = !oldState.channelId && newState.channelId;
    if (!joined || !newState.member || newState.member.user.bot) return;

    await XPSystem.addVoiceXP(newState.member);
  },
};
