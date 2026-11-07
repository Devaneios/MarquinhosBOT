import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/gamification';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { BotAuth } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { GamificationService } from 'modules/gamification/gamification.service';
import type {
  AddXpResult,
  UserAchievement,
  UserLevel,
} from 'modules/gamification/types';

// Transform helpers — convert snake_case DB rows to camelCase for bot/web consumers
function formatLevel(row: UserLevel) {
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    level: row.level,
    xp: row.xp,
    totalXp: row.total_xp,
    lastXpGain: row.last_xp_gain ? new Date(row.last_xp_gain) : null,
  };
}

function formatAchievement(row: UserAchievement) {
  return {
    userId: row.user_id,
    guildId: row.guild_id,
    achievementId: row.achievement_id,
    unlockedAt: new Date(row.unlocked_at),
    name: row.name,
    description: row.description,
    category: row.category,
    rarity: row.rarity,
    icon: row.icon,
    rewardXp: row.reward_xp,
  };
}

function formatAddXpResult(result: AddXpResult) {
  return {
    userLevel: formatLevel(result.userLevel),
    onCooldown: result.onCooldown,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
    unlockedAchievements: result.unlockedAchievements,
  };
}

@Controller('gamification')
@BotAuth()
export class GamificationController {
  constructor(private readonly service: GamificationService) {}

  @Get('xp-config')
  @OnRouteError({
    event: 'gamification.controller.get_xp_config_failed',
    message: 'Unknown Error',
  })
  async getXpConfig(): Promise<
    ContractResponseInput<typeof contract.getXpConfig>
  > {
    const data = await this.service.getXpConfig();
    return { data };
  }

  @Post('xp')
  @HttpCode(200)
  @OnRouteError({
    event: 'gamification.controller.add_xp_failed',
    message: 'Unknown Error',
  })
  async addXP(
    @ContractInput(
      contract.addXp,
      'userId, guildId, and eventType are required',
    )
    input: ContractInputValue<typeof contract.addXp>,
  ): Promise<ContractResponseInput<typeof contract.addXp>> {
    const { userId, guildId, eventType } = input.body;
    const result = await this.service.addXP(userId, guildId, eventType);
    return {
      data: formatAddXpResult(result),
      message: result.onCooldown ? 'On cooldown' : 'XP added',
    };
  }

  @Get('level/:userId/:guildId')
  @OnRouteError({
    event: 'gamification.controller.get_user_level_failed',
    message: 'Unknown Error',
  })
  async getUserLevel(
    @ContractInput(contract.getUserLevel, 'userId and guildId are required')
    input: ContractInputValue<typeof contract.getUserLevel>,
  ): Promise<ContractResponseInput<typeof contract.getUserLevel>> {
    const { userId, guildId } = input.params;
    const row = await this.service.getUserLevel(userId, guildId);
    return { data: formatLevel(row) };
  }

  @Get('leaderboard/:guildId')
  @OnRouteError({
    event: 'gamification.controller.get_leaderboard_failed',
    message: 'Unknown Error',
  })
  async getLeaderboard(
    @ContractInput(contract.getLeaderboard, 'guildId is required')
    input: ContractInputValue<typeof contract.getLeaderboard>,
  ): Promise<ContractResponseInput<typeof contract.getLeaderboard>> {
    const { guildId } = input.params;
    const limit = Math.min(input.query.limit, 25);
    const rows = await this.service.getLeaderboard(guildId, limit);
    return { data: rows.map(formatLevel) };
  }

  @Post('achievement/unlock')
  @HttpCode(200)
  @OnRouteError({
    event: 'gamification.controller.unlock_achievement_failed',
    message: 'Unknown Error',
  })
  async unlockAchievement(
    @ContractInput(
      contract.unlockAchievement,
      'userId, guildId, and achievementId are required',
    )
    input: ContractInputValue<typeof contract.unlockAchievement>,
  ): Promise<ContractResponseInput<typeof contract.unlockAchievement>> {
    const { userId, guildId, achievementId } = input.body;
    const unlocked = await this.service.unlockAchievement(
      userId,
      guildId,
      achievementId,
    );
    return {
      data: { unlocked },
      message: unlocked ? 'Achievement unlocked' : 'Already unlocked',
    };
  }

  @Get('achievements/:userId/:guildId')
  @OnRouteError({
    event: 'gamification.controller.get_user_achievements_failed',
    message: 'Unknown Error',
  })
  async getUserAchievements(
    @ContractInput(
      contract.getUserAchievements,
      'userId and guildId are required',
    )
    input: ContractInputValue<typeof contract.getUserAchievements>,
  ): Promise<ContractResponseInput<typeof contract.getUserAchievements>> {
    const { userId, guildId } = input.params;
    const rows = await this.service.getUserAchievements(userId, guildId);
    return { data: rows.map(formatAchievement) };
  }

  @Get('achievements')
  @OnRouteError({
    event: 'gamification.controller.get_all_achievements_failed',
    message: 'Unknown Error',
  })
  async getAllAchievements(): Promise<
    ContractResponseInput<typeof contract.getAllAchievements>
  > {
    const data = await this.service.getAllAchievements();
    return { data };
  }

  @Post('achievements')
  @HttpCode(201)
  @OnRouteError({
    event: 'gamification.controller.create_achievement_failed',
    message: 'Unknown Error',
  })
  async createAchievement(
    @ContractInput(contract.createAchievement, 'Invalid achievement')
    input: ContractInputValue<typeof contract.createAchievement>,
  ): Promise<ContractResponseInput<typeof contract.createAchievement>> {
    const data = await this.service.createAchievement(input.body);
    return { data, message: 'Achievement created' };
  }

  @Post('achievements/initialize')
  @HttpCode(200)
  @OnRouteError({
    event: 'gamification.controller.initialize_defaults_failed',
    message: 'Unknown Error',
  })
  async initializeDefaults(): Promise<
    ContractResponseInput<typeof contract.initializeDefaults>
  > {
    await this.service.initializeDefaults();
    return { message: 'Defaults initialized' };
  }

  @Post('game-result')
  @HttpCode(200)
  @OnRouteError({
    event: 'gamification.controller.record_game_result_failed',
    message: 'Unknown Error',
  })
  async recordGameResult(
    @ContractInput(
      contract.recordGameResult,
      'sessionId, guildId, gameType, and results are required',
    )
    input: ContractInputValue<typeof contract.recordGameResult>,
  ): Promise<ContractResponseInput<typeof contract.recordGameResult>> {
    await this.service.recordGameResult(input.body);
    return { message: 'Game result recorded' };
  }

  @Get('game-stats/:userId/:guildId')
  @OnRouteError({
    event: 'gamification.controller.get_user_game_stats_failed',
    message: 'Unknown Error',
  })
  async getUserGameStats(
    @ContractInput(contract.getUserGameStats, 'userId and guildId are required')
    input: ContractInputValue<typeof contract.getUserGameStats>,
  ): Promise<ContractResponseInput<typeof contract.getUserGameStats>> {
    const { userId, guildId } = input.params;
    const data = await this.service.getUserGameStats(userId, guildId);
    return { data };
  }

  @Get('game-leaderboard/:guildId/:gameType')
  @OnRouteError({
    event: 'gamification.controller.get_game_leaderboard_failed',
    message: 'Unknown Error',
  })
  async getGameLeaderboard(
    @ContractInput(
      contract.getGameLeaderboard,
      'guildId and gameType are required',
    )
    input: ContractInputValue<typeof contract.getGameLeaderboard>,
  ): Promise<ContractResponseInput<typeof contract.getGameLeaderboard>> {
    const { guildId, gameType } = input.params;
    const data = await this.service.getGameLeaderboard(guildId, gameType);
    return { data };
  }
}
