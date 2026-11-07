import { Module } from '@nestjs/common';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { AiChatModule } from 'modules/ai-chat/ai-chat.module';
import { EmojiReactionController } from 'modules/emoji-reaction/emoji-reaction.controller';
import { EmojiReactionService } from 'modules/emoji-reaction/emoji-reaction.service';

@Module({
  imports: [AiChatModule],
  controllers: [EmojiReactionController],
  providers: [BotAuthGuard, EmojiReactionService],
})
export class EmojiReactionModule {}
