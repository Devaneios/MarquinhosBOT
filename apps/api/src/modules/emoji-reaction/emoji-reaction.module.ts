import { Module } from '@nestjs/common';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { LlmModule } from 'modules/ai-chat/llm/llm.module';
import { EmojiReactionController } from 'modules/emoji-reaction/emoji-reaction.controller';
import { EmojiReactionService } from 'modules/emoji-reaction/emoji-reaction.service';

@Module({
  imports: [LlmModule],
  controllers: [EmojiReactionController],
  providers: [BotAuthGuard, EmojiReactionService],
})
export class EmojiReactionModule {}
