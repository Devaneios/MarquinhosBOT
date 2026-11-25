import { z } from 'zod';
import { defineContract, envelope } from '../contract';

export const choose = defineContract({
  method: 'POST',
  path: '/api/emoji-reaction/choose',
  body: z.object({
    content: z.string().min(1),
    recentMessages: z
      .array(z.object({ author: z.string(), content: z.string() }))
      .max(10)
      .optional(),
  }),
  response: envelope(z.object({ emojis: z.array(z.string()) })),
  docs: {
    description:
      'Choose Discord reactions for a message using up to ten preceding messages as context. If the model call fails or returns no usable reaction, the API supplies its default reaction.',
    tags: ['Emoji reactions'],
    security: ['botBearer'],
    examples: {
      body: {
        content: 'Consegui resolver o Terminhos de hoje!',
        recentMessages: [
          { author: 'Bia', content: 'Já tentou a palavra de hoje?' },
        ],
      },
    },
    success: {
      200: {
        description: 'Reactable emoji values for the bot to apply.',
        example: { data: { emojis: ['👍'] } },
      },
    },
    errors: {
      400: {
        description:
          'The message or contextual history did not pass validation.',
        example: { message: 'Validation failed' },
      },
      401: {
        description: 'The bot credential was absent or invalid.',
        example: { message: 'Token not authorized' },
      },
      413: {
        description: 'The JSON body exceeded the API size limit.',
        example: { message: 'Request body too large' },
      },
      500: {
        description:
          'The API could not handle the request or the bot key is not configured.',
        example: { message: 'Unknown Error' },
      },
    },
  },
});
