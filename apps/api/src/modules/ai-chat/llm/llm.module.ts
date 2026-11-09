import { Module } from '@nestjs/common';
import { AppConfig } from 'config/app.config';
import { ConfigModule } from 'config/config.module';
import {
  OPENAI_CLIENT,
  OPENAI_MODEL,
  OPENAI_REASONING_EFFORT,
  OPENAI_RESPONSES_CLIENT,
} from 'modules/ai-chat/ai-chat.tokens';
import { ResponsesClient } from 'modules/ai-chat/llm/responses.client';
import { OpenAiClient } from 'modules/ai-chat/openai.client';
import OpenAI from 'openai';

const OPENAI_REQUEST_TIMEOUT_MS = 30_000;
const RESPONSES_REQUEST_TIMEOUT_MS = 120_000;

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: (config: AppConfig) =>
        new OpenAI({
          apiKey: config.openAiApiKey,
          timeout: OPENAI_REQUEST_TIMEOUT_MS,
        }),
      inject: [AppConfig],
    },
    {
      provide: OPENAI_RESPONSES_CLIENT,
      useFactory: (config: AppConfig) =>
        new OpenAI({
          apiKey: config.openAiApiKey,
          timeout: RESPONSES_REQUEST_TIMEOUT_MS,
        }),
      inject: [AppConfig],
    },
    {
      provide: OPENAI_MODEL,
      useFactory: (config: AppConfig) => config.openAiModel,
      inject: [AppConfig],
    },
    {
      provide: OPENAI_REASONING_EFFORT,
      useFactory: (config: AppConfig) => config.openAiReasoningEffort,
      inject: [AppConfig],
    },
    OpenAiClient,
    ResponsesClient,
  ],
  exports: [OpenAiClient, ResponsesClient],
})
export class LlmModule {}
