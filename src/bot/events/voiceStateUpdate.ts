import { BotEvent } from '@marquinhos/types';
import { VoiceState } from 'discord.js';

export const voiceStateUpdate: BotEvent = {
  name: 'voiceStateUpdate',
  execute: async (oldState: VoiceState, newState: VoiceState) => {
    // Voice XP is intentionally disabled (addVoiceXP was a no-op).
    // Re-implement here when voice XP is re-enabled.
    const joined = !oldState.channelId && newState.channelId;
    if (!joined || !newState.member || newState.member.user.bot) return;
  },
};
