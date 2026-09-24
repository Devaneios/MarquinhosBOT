import { container } from '@sapphire/framework';
import { describe, expect, it, mock } from 'bun:test';
import { GuildMember } from 'discord.js';
import { DisconnectAllCommand } from '../src/commands/music/disconnectAll';

function member(voice: object) {
  const m = Object.create(GuildMember.prototype) as GuildMember;
  Object.defineProperty(m, 'voice', { value: voice });
  return m;
}

describe('/encerrar-chamada', () => {
  it('disconnects everyone it can and still answers when one fails', async () => {
    const setChannels = [
      mock(async () => {}),
      mock(async () => {
        throw new Error('Missing Permissions');
      }),
      mock(async () => {}),
    ];
    const inCall = setChannels.map((setChannel) => member({ setChannel }));
    const invoker = member({
      channel: { members: new Map(inCall.map((m, i) => [String(i), m])) },
    });
    const interaction = {
      member: invoker,
      reply: mock(async () => {}),
      deferReply: mock(async () => {}),
      editReply: mock(async () => {}),
    };
    (container as { client: unknown }).client = { user: null };
    const command = Object.create(
      DisconnectAllCommand.prototype,
    ) as DisconnectAllCommand;

    await command.chatInputRun(interaction as never);

    for (const setChannel of setChannels) {
      expect(setChannel).toHaveBeenCalledTimes(1);
    }
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
  });
});
