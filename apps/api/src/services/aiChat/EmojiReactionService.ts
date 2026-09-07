import {
  DEFAULT_FALLBACK_REACTABLE,
  resolveReactable,
} from 'services/aiChat/emojiCatalog';
import { OpenAiClient } from 'services/aiChat/OpenAiClient';
import {
  EMOJI_REACTION_SYSTEM_PROMPT,
  emojiChoiceSchema,
} from 'services/aiChat/prompts';
import { logger } from 'utils/logger';

export interface EmojiReactionRequest {
  content: string;
  recentMessages?: { author: string; content: string }[];
}

export class EmojiReactionService {
  constructor(private openAiClient: OpenAiClient = new OpenAiClient()) {}

  async chooseReactions(request: EmojiReactionRequest): Promise<string[]> {
    try {
      const result = await this.openAiClient.structured(
        [
          { role: 'system', content: EMOJI_REACTION_SYSTEM_PROMPT },
          { role: 'user', content: this.buildUserContent(request) },
        ],
        emojiChoiceSchema,
        'emoji_choice',
        { temperature: 0.4, maxTokens: 60, phase: 'emoji_choice' },
      );

      const resolved = result.emojis
        .map(resolveReactable)
        .filter((reactable): reactable is string => Boolean(reactable));

      return resolved.length > 0 ? resolved : [DEFAULT_FALLBACK_REACTABLE];
    } catch (error) {
      logger.error('emoji_reaction.choose_failed', { error });
      return [DEFAULT_FALLBACK_REACTABLE];
    }
  }

  private buildUserContent(request: EmojiReactionRequest): string {
    if (!request.recentMessages?.length) return request.content;

    const history = request.recentMessages
      .map((m) => `${m.author}: ${m.content}`)
      .join('\n');

    return `<chat_history>\n${history}\n</chat_history>\n\n<message>\n${request.content}\n</message>`;
  }
}
