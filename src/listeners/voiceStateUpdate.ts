import { Listener } from '@sapphire/framework';
import { Events, VoiceState } from 'discord.js';

export class VoiceStateUpdateListener extends Listener<
  typeof Events.VoiceStateUpdate
> {
  public constructor(context: Listener.LoaderContext) {
    super(context, { event: Events.VoiceStateUpdate });
  }

  override run(oldState: VoiceState, newState: VoiceState) {
    const joined = !oldState.channel && !!newState.channel;
    if (!joined) return;

    // XP wiring point: call addVoiceXP here when XP system is ready
    // apiService.addXP(newState.id, newState.guild.id, 'voice_join')
  }
}
