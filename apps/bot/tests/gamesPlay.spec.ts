import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { GamesCommand } from '../src/commands/games/games';
import { SlotsGame } from '../src/game/casino/slots';
import { GameManager } from '../src/game/core/GameManager';
import { GameType } from '../src/game/core/GameTypes';

function playInteraction(userId: string) {
  return {
    user: { id: userId, username: userId },
    guildId: 'guild-play',
    channelId: 'channel-play',
    options: {
      getSubcommand: () => 'play',
      getString: () => 'slots',
      getUser: () => null,
    },
    reply: mock(async () => ({})),
  };
}

afterEach(() => mock.restore());

describe('/games play', () => {
  // A leftover session blocks the player (and opponent) until it expires.
  it('ends the session when the game fails to start', async () => {
    spyOn(SlotsGame.prototype, 'start').mockRejectedValue(new Error('boom'));
    const command = Object.create(GamesCommand.prototype) as GamesCommand;

    await expect(
      command.chatInputRun(playInteraction('player-1') as never),
    ).rejects.toThrow('boom');

    const manager = GameManager.getInstance();
    expect(manager.getPlayerSession('player-1', 'guild-play')).toBeUndefined();
    expect(manager.canUserPlay('player-1', GameType.SLOTS)).toBe(true);
  });
});
