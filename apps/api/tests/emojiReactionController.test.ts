import { describe, expect, it } from 'bun:test';
import { EmojiReactionController } from 'modules/emoji-reaction/emoji-reaction.controller';
import { EmojiReactionService } from 'modules/emoji-reaction/emoji-reaction.service';
import {
  requestController,
  startNestControllerServer,
} from './helpers/nestControllerServer';

describe('EmojiReactionController.choose', () => {
  it('returns 200 with the emojis as data', async () => {
    const server = await startNestControllerServer({
      controllers: [EmojiReactionController],
      providers: [
        {
          provide: EmojiReactionService,
          useValue: {
            chooseReactions: async () => [
              '😀',
              'cavaloemoji:725868757779742787',
            ],
          },
        },
      ],
    });
    try {
      const response = await requestController(
        server,
        '/emoji-reaction/choose',
        {
          method: 'POST',
          body: { content: 'kkkkk', recentMessages: [] },
        },
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: { emojis: ['😀', 'cavaloemoji:725868757779742787'] },
      });
    } finally {
      await server.close();
    }
  });

  it('returns the route error response when the service throws', async () => {
    const server = await startNestControllerServer({
      controllers: [EmojiReactionController],
      providers: [
        {
          provide: EmojiReactionService,
          useValue: {
            chooseReactions: async () => {
              throw new Error('openai down');
            },
          },
        },
      ],
    });
    try {
      const response = await requestController(
        server,
        '/emoji-reaction/choose',
        {
          method: 'POST',
          body: { content: 'kkkkk', recentMessages: [] },
        },
      );
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Unknown Error' });
    } finally {
      await server.close();
    }
  });
});
