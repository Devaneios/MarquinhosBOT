import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/evolutiveAchievements';
import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { BotAuth } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { EvolutiveAchievementsService } from 'modules/gamification/evolutive-achievements.service';

@Controller('evolutive-achievements')
@BotAuth()
export class EvolutiveAchievementsController {
  constructor(private readonly service: EvolutiveAchievementsService) {}

  @Post('evolve/:userId/:guildId')
  @HttpCode(200)
  @OnRouteError({
    event: 'evolutive_achievements.controller.check_and_evolve_failed',
    message: 'Failed to check evolution',
  })
  async checkAndEvolve(
    @ContractInput(contract.checkAndEvolve, 'userId and guildId are required')
    input: ContractInputValue<typeof contract.checkAndEvolve>,
  ): Promise<ContractResponseInput<typeof contract.checkAndEvolve>> {
    const { userId, guildId } = input.params;
    const evolutions = await this.service.checkAndEvolveAll(userId, guildId);
    return { data: evolutions };
  }

  @Get(':userId/:guildId')
  @OnRouteError({
    event: 'evolutive_achievements.controller.get_user_achievements_failed',
    message: 'Failed to get evolutive achievements',
  })
  async getUserEvolutiveAchievements(
    @ContractInput(
      contract.getUserEvolutiveAchievements,
      'userId and guildId are required',
    )
    input: ContractInputValue<typeof contract.getUserEvolutiveAchievements>,
  ): Promise<
    ContractResponseInput<typeof contract.getUserEvolutiveAchievements>
  > {
    const { userId, guildId } = input.params;
    const achievements = await this.service.getUserEvolutiveAchievements(
      userId,
      guildId,
    );
    return { data: achievements };
  }

  @Get('timeline/:userId/:guildId')
  @OnRouteError({
    event: 'evolutive_achievements.controller.get_timeline_failed',
    message: 'Failed to get evolution timeline',
  })
  async getEvolutionTimeline(
    @ContractInput(
      contract.getEvolutionTimeline,
      'userId and guildId are required',
    )
    input: ContractInputValue<typeof contract.getEvolutionTimeline>,
  ): Promise<ContractResponseInput<typeof contract.getEvolutionTimeline>> {
    const { userId, guildId } = input.params;
    const timeline = await this.service.getEvolutionTimeline(userId, guildId);
    return { data: timeline };
  }
}
