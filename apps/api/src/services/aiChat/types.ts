export type MainCategory =
  'question' | 'social' | 'context_reaction' | 'agent_task' | 'unclear';

export type ResponseCategory =
  | 'general_question'
  | 'code_technical_question'
  | 'trick_riddle'
  | 'bot_help_info'
  | 'casual_chat'
  | 'user_roast_provocation'
  | 'praise_thanks'
  | 'opinion_reference'
  | 'follow_up_on_bot'
  | 'off_topic_unclear';

export type AiChatCategory =
  ResponseCategory | 'guardrail_roast' | 'agent_task';

export type ResponseFormat = 'embed' | 'text';

export interface AiChatRequest {
  userId: string;
  guildId: string;
  channelId: string;
  content: string;
  recentMessages: { author: string; content: string }[];
  repliedMessage?: { author: string; content: string };
}

export interface AiChatResult {
  status: 'ok' | 'rate_limited' | 'error';
  category?: AiChatCategory;
  reply?: string;
  format?: ResponseFormat;
  embedTitle?: string;
  traceId?: string;
}
