import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/emojiReaction';
import { Controller, HttpCode, Post } from '@nestjs/common';
import { BotAuth } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { EmojiReactionService } from 'modules/emoji-reaction/emoji-reaction.service';

@Controller('emoji-reaction')
export class EmojiReactionController {
  constructor(private readonly service: EmojiReactionService) {}

  @Post('choose')
  @HttpCode(200)
  @BotAuth()
  @OnRouteError({
    event: 'emoji_reaction.controller.choose_failed',
    message: 'Unknown Error',
  })
  async choose(
    @ContractInput(contract.choose)
    input: ContractInputValue<typeof contract.choose>,
  ): Promise<ContractResponseInput<typeof contract.choose>> {
    const { content, recentMessages } = input.body;
    const emojis = await this.service.chooseReactions({
      content,
      recentMessages,
    });
    return { data: { emojis } };
  }
}
