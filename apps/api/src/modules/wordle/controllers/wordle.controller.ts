import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/wordle';
import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { BotAuth } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { WordlePlayerOverviewService } from 'modules/wordle/services/wordle-player-overview.service';
import { WordleShowcaseService } from 'modules/wordle/services/wordle-showcase.service';
import { WordleWordlistReviewService } from 'modules/wordle/services/wordle-wordlist-review.service';
import {
  GlobalWordleCannotForce,
  WordleService,
} from 'modules/wordle/wordle.service';

@Controller('wordle')
@BotAuth()
export class WordleController {
  constructor(
    private readonly service: WordleService,
    private readonly showcase: WordleShowcaseService,
    private readonly overview: WordlePlayerOverviewService,
    private readonly wordlistReview: WordleWordlistReviewService,
  ) {}

  @Post('presence')
  @HttpCode(200)
  @OnRouteError({
    event: 'wordle.controller.record_presence_failed',
    message: 'Erro interno.',
  })
  async recordPresence(
    @ContractInput(
      contract.recordPresence,
      'userId e guildId são obrigatórios.',
    )
    input: ContractInputValue<typeof contract.recordPresence>,
  ): Promise<ContractResponseInput<typeof contract.recordPresence>> {
    await this.service.recordParticipation(
      input.body.userId,
      input.body.guildId,
    );
    return { data: { recorded: true } };
  }

  @Get('achievements/:guildId/:userId')
  @OnRouteError({
    event: 'wordle.controller.get_achievements_failed',
    message: 'Erro interno.',
  })
  async getAchievements(
    @ContractInput(
      contract.getAchievements,
      'guildId e userId são obrigatórios.',
    )
    input: ContractInputValue<typeof contract.getAchievements>,
  ): Promise<ContractResponseInput<typeof contract.getAchievements>> {
    const { userId, guildId } = input.params;
    return {
      data: await this.overview.getPublicPlayerOverview(userId, guildId),
    };
  }

  @Post('guess')
  @HttpCode(200)
  @OnRouteError({
    event: 'wordle.controller.submit_guess_failed',
    message: 'Erro interno.',
  })
  async submitGuess(
    @ContractInput(
      contract.submitGuess,
      'userId, guildId e guess são obrigatórios.',
    )
    input: ContractInputValue<typeof contract.submitGuess>,
  ): Promise<ContractResponseInput<typeof contract.submitGuess>> {
    const { userId, guildId, guess } = input.body;
    const result = await this.service.submitGuess(userId, guildId, guess);
    if ('error' in result)
      throw new BadRequestException({ message: result.error });
    return { data: result };
  }

  @Post('draft')
  @HttpCode(200)
  @OnRouteError({
    event: 'wordle.controller.write_draft_failed',
    message: 'Erro interno.',
  })
  async writeDraft(
    @ContractInput(contract.writeDraft, 'Rascunho inválido.')
    input: ContractInputValue<typeof contract.writeDraft>,
  ): Promise<ContractResponseInput<typeof contract.writeDraft>> {
    const { userId, guildId, ...draft } = input.body;
    return { data: await this.service.writeDraft(userId, guildId, draft) };
  }

  @Get('stats/:guildId')
  @OnRouteError({
    event: 'wordle.controller.get_stats_failed',
    message: 'Erro interno.',
  })
  async getStats(
    @ContractInput(contract.getStats, 'guildId é obrigatório.')
    input: ContractInputValue<typeof contract.getStats>,
  ): Promise<ContractResponseInput<typeof contract.getStats>> {
    return { data: await this.service.getDailyStats(input.params.guildId) };
  }

  @Get('session/:userId/:guildId')
  @OnRouteError({
    event: 'wordle.controller.get_user_session_failed',
    message: 'Erro interno.',
  })
  async getUserSession(
    @ContractInput(
      contract.getUserSession,
      'userId e guildId são obrigatórios.',
    )
    input: ContractInputValue<typeof contract.getUserSession>,
  ): Promise<ContractResponseInput<typeof contract.getUserSession>> {
    const { userId, guildId } = input.params;
    return { data: await this.service.getUserSession(userId, guildId) };
  }

  @Get('day-guesses/:guildId')
  @OnRouteError({
    event: 'wordle.controller.get_day_guesses_failed',
    message: 'Erro interno.',
  })
  async getDayGuesses(
    @ContractInput(contract.getDayGuesses, 'guildId é obrigatório.')
    input: ContractInputValue<typeof contract.getDayGuesses>,
  ): Promise<ContractResponseInput<typeof contract.getDayGuesses>> {
    return {
      data: await this.service.getDayGuesses(
        input.params.guildId,
        input.query.date,
      ),
    };
  }

  @Post('admin/force-new-word')
  @HttpCode(200)
  @OnRouteError({
    event: 'wordle.controller.force_new_word_failed',
    message: 'Erro interno.',
  })
  async forceNewWord(
    @ContractInput(contract.forceNewWord, 'guildId é obrigatório.')
    input: ContractInputValue<typeof contract.forceNewWord>,
  ): Promise<ContractResponseInput<typeof contract.forceNewWord>> {
    const { guildId } = input.body;
    try {
      const result = await this.service.forceNewWord(guildId);
      const stats = await this.service.getDailyStats(guildId);
      return { data: { ...result, stats } };
    } catch (error) {
      if (error instanceof GlobalWordleCannotForce) {
        throw new ConflictException({ message: error.message });
      }
      throw error;
    }
  }

  @Post('rotate')
  @HttpCode(200)
  @OnRouteError({
    event: 'wordle.controller.rotate_daily_word_failed',
    message: 'Erro interno.',
  })
  async rotateDailyWord(
    @ContractInput(contract.rotateDailyWord, 'guildId é obrigatório.')
    input: ContractInputValue<typeof contract.rotateDailyWord>,
  ): Promise<ContractResponseInput<typeof contract.rotateDailyWord>> {
    return { data: await this.service.rotateDailyWord(input.body.guildId) };
  }

  @Get('leaderboard/:guildId')
  @OnRouteError({
    event: 'wordle.controller.get_leaderboard_failed',
    message: 'Erro interno.',
  })
  async getLeaderboard(
    @ContractInput(contract.getLeaderboard, 'guildId é obrigatório.')
    input: ContractInputValue<typeof contract.getLeaderboard>,
  ): Promise<ContractResponseInput<typeof contract.getLeaderboard>> {
    const { guildId } = input.params;
    const { period, date, offset } = input.query;
    const data = await this.service.getLeaderboard(
      guildId,
      10,
      period,
      date,
      offset,
    );
    const groupStreak = await this.service.getGroupStreak(guildId);
    const icons = await this.showcase.getIcons(
      data.map((entry) => entry.userId),
    );
    const entries = data.map((entry) => ({
      ...entry,
      ...(icons.has(entry.userId) ? { showcase: icons.get(entry.userId) } : {}),
    })) as typeof data;
    return { data: entries, groupStreak };
  }

  @Post('config')
  @HttpCode(200)
  @OnRouteError({
    event: 'wordle.controller.set_config_failed',
    message: 'Erro interno.',
  })
  async setConfig(
    @ContractInput(contract.setConfig, 'guildId e channelId são obrigatórios.')
    input: ContractInputValue<typeof contract.setConfig>,
  ): Promise<ContractResponseInput<typeof contract.setConfig>> {
    const { guildId, channelId } = input.body;
    await this.service.setConfig(guildId, channelId);
    return { message: 'Configuração salva.' };
  }

  @Get('validate/:guildId')
  @OnRouteError({
    event: 'wordle.controller.validate_guess_failed',
    message: 'Erro interno.',
  })
  async validateGuess(
    @ContractInput(contract.validateGuess, 'guildId e guess são obrigatórios.')
    input: ContractInputValue<typeof contract.validateGuess>,
  ): Promise<ContractResponseInput<typeof contract.validateGuess>> {
    return {
      data: await this.service.validateGuess(
        input.params.guildId,
        input.query.guess,
      ),
    };
  }

  @Get('config/:guildId')
  @OnRouteError({
    event: 'wordle.controller.get_config_failed',
    message: 'Erro interno.',
  })
  async getConfig(
    @ContractInput(contract.getConfig, 'guildId é obrigatório.')
    input: ContractInputValue<typeof contract.getConfig>,
  ): Promise<ContractResponseInput<typeof contract.getConfig>> {
    return { data: await this.service.getConfig(input.params.guildId) };
  }

  @Post('mark-announced')
  @HttpCode(200)
  @OnRouteError({
    event: 'wordle.controller.mark_announced_failed',
    message: 'Erro interno.',
  })
  async markAnnounced(
    @ContractInput(contract.markAnnounced, 'userId e guildId são obrigatórios.')
    input: ContractInputValue<typeof contract.markAnnounced>,
  ): Promise<ContractResponseInput<typeof contract.markAnnounced>> {
    const claimed = await this.service.markAnnounced(
      input.body.userId,
      input.body.guildId,
    );
    return { data: { claimed } };
  }

  @Get('unannounced/:guildId')
  @OnRouteError({
    event: 'wordle.controller.get_unannounced_wins_failed',
    message: 'Erro interno.',
  })
  async getUnannouncedWins(
    @ContractInput(contract.getUnannouncedWins, 'guildId é obrigatório.')
    input: ContractInputValue<typeof contract.getUnannouncedWins>,
  ): Promise<ContractResponseInput<typeof contract.getUnannouncedWins>> {
    return {
      data: await this.service.getUnannouncedWins(input.params.guildId),
    };
  }

  @Get('streak/:userId/:guildId')
  @OnRouteError({
    event: 'wordle.controller.get_streak_failed',
    message: 'Erro interno.',
  })
  async getStreak(
    @ContractInput(contract.getStreak, 'userId e guildId são obrigatórios.')
    input: ContractInputValue<typeof contract.getStreak>,
  ): Promise<ContractResponseInput<typeof contract.getStreak>> {
    const { userId, guildId } = input.params;
    return { data: await this.service.getStreak(userId, guildId) };
  }

  @Get('wordlist-pool-stats')
  @OnRouteError({
    event: 'wordle.controller.get_wordlist_pool_stats_failed',
    message: 'Erro interno.',
  })
  async getWordlistPoolStats(): Promise<
    ContractResponseInput<typeof contract.getWordlistPoolStats>
  > {
    return { data: await this.wordlistReview.getWordlistPoolStats() };
  }

  @Get('review/next')
  @OnRouteError({
    event: 'wordle.controller.get_next_review_word_failed',
    message: 'Erro interno.',
  })
  async getNextReviewWord(): Promise<
    ContractResponseInput<typeof contract.getNextReviewWord>
  > {
    return { data: await this.wordlistReview.getNextReviewWord() };
  }

  @Post('review/decision')
  @HttpCode(200)
  @OnRouteError({
    event: 'wordle.controller.submit_review_decision_failed',
    message: 'Erro interno.',
  })
  async submitReviewDecision(
    @ContractInput(
      contract.submitReviewDecision,
      'word e decision ("keep" ou "remove") são obrigatórios.',
    )
    input: ContractInputValue<typeof contract.submitReviewDecision>,
  ): Promise<ContractResponseInput<typeof contract.submitReviewDecision>> {
    return {
      data: await this.wordlistReview.submitReviewDecision(
        input.body.word,
        input.body.decision,
      ),
    };
  }
}
