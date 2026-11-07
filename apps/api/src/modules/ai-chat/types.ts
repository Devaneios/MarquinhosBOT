import type {
  aiChatCategorySchema,
  aiChatResultSchema,
  aiResponseCategorySchema,
} from '@marquinhos/contracts/http/routes/aiChat';
import type { z } from 'zod';

export type MainCategory =
  'question' | 'social' | 'context_reaction' | 'agent_task' | 'unclear';

export type ResponseCategory = z.output<typeof aiResponseCategorySchema>;

export type AiChatCategory = z.output<typeof aiChatCategorySchema>;

export type ResponseFormat = 'embed' | 'text';

export interface AiChatRequest {
  userId: string;
  guildId: string;
  channelId: string;
  content: string;
  recentMessages: { author: string; content: string }[];
  repliedMessage?: { author: string; content: string };
}

export type AiChatResult = z.input<typeof aiChatResultSchema>;
