import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/activity';
import { roomListingSchema } from '@marquinhos/contracts/http/routes/activity';
import {
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ActivityRateLimit, BotAuth } from 'common/decorators/auth.decorators';
import {
  ContractInput,
  type ContractInputValue,
} from 'common/decorators/contract-input.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { logger } from 'common/logging/logger';
import {
  DiscordGuildMembershipError,
  DiscordService,
} from 'integrations/discord/discord.service';
import { ActivityAccessService } from 'modules/activity/activity-access.service';
import { ActivityDeepLinkService } from 'modules/activity/activity-deep-link.service';
import {
  ActivitySessionService,
  InvalidActivitySessionError,
} from 'modules/activity/activity-session.service';
import {
  ACTIVITY_ROOM_QUERY,
  type ActivityRoomQuery,
} from 'modules/activity/activity.tokens';
import { PongCompetitionService } from 'modules/activity/games/pong/pong-competition.service';
import { PongTournamentService } from 'modules/activity/games/pong/pong-tournament.service';

@Controller('activities')
export class ActivityController {
  constructor(
    private readonly discordService: DiscordService,
    private readonly access: ActivityAccessService,
    private readonly competition: PongCompetitionService,
    private readonly tournaments: PongTournamentService,
    private readonly deepLinks: ActivityDeepLinkService,
    private readonly sessions: ActivitySessionService,
    @Inject(ACTIVITY_ROOM_QUERY)
    private readonly queryRooms: ActivityRoomQuery,
  ) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  @OnRouteError({
    event: 'activity.controller.exchange_token_failed',
    message: 'Unknown Error',
  })
  async exchangeToken(
    @ContractInput(contract.exchangeToken)
    input: ContractInputValue<typeof contract.exchangeToken>,
  ): Promise<ContractResponseInput<typeof contract.exchangeToken>> {
    const data = await this.discordService.exchangeActivityCode(
      input.body.code,
    );
    return { data: { access_token: data.access_token } };
  }

  @Post('ws-session')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  @OnRouteError({
    event: 'activity.controller.ws_session_failed',
    message: 'Unknown Error',
  })
  async getWsSessionToken(
    @ContractInput(contract.wsSession)
    input: ContractInputValue<typeof contract.wsSession>,
  ): Promise<ContractResponseInput<typeof contract.wsSession>> {
    const { accessToken, ...request } = input.body;
    const requiresGuildMembership =
      request.mode === 'multi' || request.game === 'wordle';
    const user = requiresGuildMembership
      ? await this.access.authenticateMember(accessToken, request.guildId)
      : await this.access.authenticate(accessToken);
    try {
      return { data: this.sessions.issueSession(user, request) };
    } catch (error) {
      if (error instanceof InvalidActivitySessionError) {
        throw new HttpException(
          { message: error.message },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
  }

  @Post('pong/leaderboard')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  @OnRouteError({
    event: 'activity.controller.pong_leaderboard_failed',
    message: 'Unknown Error',
  })
  async getPongLeaderboard(
    @ContractInput(contract.pongLeaderboard)
    input: ContractInputValue<typeof contract.pongLeaderboard>,
  ): Promise<ContractResponseInput<typeof contract.pongLeaderboard>> {
    const { accessToken, guildId, pool, limit } = input.body;
    await this.access.authenticateMember(accessToken, guildId);
    return { data: await this.competition.leaderboard(guildId, pool, limit) };
  }

  @Post('pong/tournaments/create')
  @ActivityRateLimit()
  async createPongTournament(
    @ContractInput(contract.createPongTournament)
    input: ContractInputValue<typeof contract.createPongTournament>,
  ): Promise<ContractResponseInput<typeof contract.createPongTournament>> {
    try {
      const values = input.body;
      const user = await this.access.authenticateMember(
        values.accessToken,
        values.guildId,
      );
      const data = await this.tournaments.create({
        guildId: values.guildId,
        name: values.name,
        format: values.format,
        pool: values.pool,
        playerIds: values.playerIds,
        ...(values.swissRounds !== undefined
          ? { swissRounds: values.swissRounds }
          : {}),
        createdBy: user.id,
      });
      return { data };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error('activity.controller.pong_tournament_create_failed', {
        error,
      });
      throw this.httpError(
        HttpStatus.BAD_REQUEST,
        error instanceof Error ? error.message : 'Invalid tournament',
      );
    }
  }

  @Post('pong/tournaments/list')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  @OnRouteError({
    event: 'activity.controller.pong_tournament_list_failed',
    message: 'Unknown Error',
  })
  async listPongTournaments(
    @ContractInput(contract.listPongTournaments)
    input: ContractInputValue<typeof contract.listPongTournaments>,
  ): Promise<ContractResponseInput<typeof contract.listPongTournaments>> {
    const { accessToken, guildId } = input.body;
    await this.access.authenticateMember(accessToken, guildId);
    return { data: await this.tournaments.list(guildId) };
  }

  @Post('pong/tournaments/report')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  async reportPongTournamentMatch(
    @ContractInput(contract.reportPongTournamentMatch)
    input: ContractInputValue<typeof contract.reportPongTournamentMatch>,
  ): Promise<ContractResponseInput<typeof contract.reportPongTournamentMatch>> {
    try {
      const { accessToken, matchId, winnerId } = input.body;
      const user = await this.access.authenticate(accessToken);
      return {
        data: await this.tournaments.report(matchId, winnerId, user.id),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error('activity.controller.pong_tournament_report_failed', {
        error,
      });
      throw this.httpError(
        HttpStatus.BAD_REQUEST,
        error instanceof Error ? error.message : 'Invalid result',
      );
    }
  }

  // Called by the bot before launchActivity(), since Discord's interaction
  // response has no data field to tell the Activity which game to open.
  @Post('deep-link')
  @HttpCode(HttpStatus.OK)
  @BotAuth()
  @OnRouteError({
    event: 'activity.controller.record_deep_link_failed',
    message: 'Unknown Error',
  })
  async recordDeepLinkIntent(
    @ContractInput(contract.recordDeepLink)
    input: ContractInputValue<typeof contract.recordDeepLink>,
  ): Promise<ContractResponseInput<typeof contract.recordDeepLink>> {
    const { userId, guildId, game } = input.body;
    await this.deepLinks.record(userId, guildId, game);
    return { data: { ok: true } };
  }

  // Identity comes from re-validating accessToken with Discord, not the body.
  @Post('deep-link/claim')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  @OnRouteError({
    event: 'activity.controller.claim_deep_link_failed',
    message: 'Unknown Error',
  })
  async claimDeepLinkIntent(
    @ContractInput(contract.claimDeepLink)
    input: ContractInputValue<typeof contract.claimDeepLink>,
  ): Promise<ContractResponseInput<typeof contract.claimDeepLink>> {
    const { accessToken, guildId } = input.body;
    const user = await this.access.authenticate(accessToken);
    return { data: { game: await this.deepLinks.claim(user.id, guildId) } };
  }

  @Post('rooms')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  async createRoom(
    @ContractInput(contract.createRoom)
    input: ContractInputValue<typeof contract.createRoom>,
  ): Promise<ContractResponseInput<typeof contract.createRoom>> {
    try {
      const { accessToken, ...request } = input.body;
      const { guildId } = request;
      const user = await this.access.authenticateMember(accessToken, guildId);
      return { data: this.sessions.createRoom(user, request) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error('activity.controller.create_room_failed', { error });
      if (error instanceof DiscordGuildMembershipError) {
        throw this.httpError(
          HttpStatus.SERVICE_UNAVAILABLE,
          'Discord membership service unavailable',
        );
      }
      throw this.httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unknown Error');
    }
  }

  // The Colyseus SDK has no client-side room-listing equivalent, so this
  // serves the same matchMaker.query() used by the classic API.
  @Post('rooms/list')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  async listRooms(
    @ContractInput(contract.listRooms)
    input: ContractInputValue<typeof contract.listRooms>,
  ): Promise<ContractResponseInput<typeof contract.listRooms>> {
    try {
      const { accessToken, instanceId, guildId } = input.body;
      await this.access.authenticateMember(accessToken, guildId);
      const rooms = await this.queryRooms({
        name: 'match',
        instanceId,
        mode: 'multi',
        locked: false,
      });
      const data = rooms.flatMap((room) => {
        const listing = roomListingSchema.safeParse(room.metadata);
        return listing.success ? [listing.data] : [];
      });
      return { data };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error('activity.controller.list_rooms_failed', { error });
      if (error instanceof DiscordGuildMembershipError) {
        throw this.httpError(
          HttpStatus.SERVICE_UNAVAILABLE,
          'Discord membership service unavailable',
        );
      }
      throw this.httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unknown Error');
    }
  }

  private httpError(status: HttpStatus, message: string): HttpException {
    return new HttpException({ message }, status);
  }
}
