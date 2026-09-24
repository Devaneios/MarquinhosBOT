import { container } from '@sapphire/framework';
import { describe, expect, it, mock } from 'bun:test';
import { PermissionsBitField } from 'discord.js';
import { AnomCommand } from '../src/commands/general/anom';

const botMember = { id: 'bot' };
const invoker = { id: 'user-1' };

function run(invokerCanSend: boolean) {
  const channel = {
    permissionsFor: (who: unknown) =>
      new PermissionsBitField(
        who === botMember || invokerCanSend
          ? [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
            ]
          : [PermissionsBitField.Flags.ViewChannel],
      ),
    send: mock(async () => {}),
  };
  const interaction = {
    options: { getChannel: () => channel, getString: () => 'hello' },
    guild: { members: { me: botMember } },
    user: invoker,
    reply: mock(async () => {}),
  };
  (container as { client: unknown }).client = { user: null };
  const command = Object.create(AnomCommand.prototype) as AnomCommand;
  return {
    channel,
    interaction,
    done: command.chatInputRun(interaction as any),
  };
}

describe('/anom', () => {
  it('does not post where the member cannot send messages', async () => {
    const { channel, interaction, done } = run(false);
    await done;
    expect(channel.send).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });

  it('posts where the member can send messages', async () => {
    const { channel, done } = run(true);
    await done;
    expect(channel.send).toHaveBeenCalledTimes(1);
  });
});
