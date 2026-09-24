import { Identifiers, UserError } from '@sapphire/framework';
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { ChatInputCommandDeniedListener } from '../src/listeners/commandDenied';
import { ChatInputCommandErrorListener } from '../src/listeners/commandError';
import * as errorHandling from '../src/utils/errorHandling';

function fakeInteraction(state: { deferred?: boolean; replied?: boolean }) {
  return {
    deferred: state.deferred ?? false,
    replied: state.replied ?? false,
    user: { tag: 'user#0001', id: 'u1' },
    guildId: 'g1',
    channelId: 'c1',
    reply: mock(async () => {}),
    editReply: mock(async () => {}),
    followUp: mock(async () => {}),
  };
}

describe('ChatInputCommandErrorListener', () => {
  const reportErrorSpy = spyOn(errorHandling, 'reportError').mockImplementation(
    () => {},
  );
  const listener = Object.create(
    ChatInputCommandErrorListener.prototype,
  ) as ChatInputCommandErrorListener;

  beforeEach(() => reportErrorSpy.mockClear());

  it('replaces the "thinking" reply of a deferred command and reports the error', async () => {
    const interaction = fakeInteraction({ deferred: true });

    await listener.run(new Error('api down'), {
      command: { name: 'termo' },
      interaction: interaction as never,
    });

    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(reportErrorSpy).toHaveBeenCalledTimes(1);
  });

  it('answers a command that had not replied yet', async () => {
    const interaction = fakeInteraction({});

    await listener.run(new Error('boom'), {
      command: { name: 'anom' },
      interaction: interaction as never,
    });

    expect(interaction.reply).toHaveBeenCalledTimes(1);
  });
});

describe('ChatInputCommandDeniedListener', () => {
  const listener = Object.create(
    ChatInputCommandDeniedListener.prototype,
  ) as ChatInputCommandDeniedListener;

  it("shows the precondition's message", async () => {
    const interaction = fakeInteraction({});

    await listener.run(
      new UserError({
        identifier: 'UserInVoiceChannel',
        message:
          'Você precisa estar em um canal de voz para usar esse comando!',
      }),
      { interaction: interaction as never } as never,
    );

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content:
          'Você precisa estar em um canal de voz para usar esse comando!',
      }),
    );
  });

  it('says how long to wait on a cooldown', async () => {
    const interaction = fakeInteraction({});

    await listener.run(
      new UserError({
        identifier: Identifiers.PreconditionCooldown,
        context: { remaining: 4200 },
      }),
      { interaction: interaction as never } as never,
    );

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('5s') }),
    );
  });

  it('stays quiet when the precondition already answered', async () => {
    const interaction = fakeInteraction({ replied: true });

    await listener.run(
      new UserError({ identifier: 'DevelopmentChannel', message: 'x' }),
      { interaction: interaction as never } as never,
    );

    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
