import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/activity';
import { roomListingSchema } from '@marquinhos/contracts/http/routes/activity';
import {
  isPongRulesetId,
  normalizePongMatchConfig,
} from '@marquinhos/domain/games/pong/PongRulesetRegistry';
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
import { logger } from 'common/logging/logger';
import {
  DiscordGuildMembershipError,
  DiscordService,
} from 'integrations/discord/discord.service';
import { ActivityDeepLinkService } from 'modules/activity/activity-deep-link.service';
import {
  ACTIVITY_ROOM_QUERY,
  type ActivityRoomQuery,
} from 'modules/activity/activity.tokens';
import { PongCompetitionService } from 'modules/activity/games/pong/pong-competition.service';
import { PongTournamentService } from 'modules/activity/games/pong/pong-tournament.service';
import { roomKey } from 'modules/activity/room-key';
import { mintWsSessionToken } from 'modules/activity/ws-session-token';
import { customAlphabet } from 'nanoid';

const generateRoomId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

@Controller('activities')
export class ActivityController {
  constructor(
    private readonly discordService: DiscordService,
    private readonly competition: PongCompetitionService,
    private readonly tournaments: PongTournamentService,
    private readonly deepLinks: ActivityDeepLinkService,
    @Inject(ACTIVITY_ROOM_QUERY)
    private readonly queryRooms: ActivityRoomQuery,
  ) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  async exchangeToken(
    @ContractInput(contract.exchangeToken)
    input: ContractInputValue<typeof contract.exchangeToken>,
  ): Promise<ContractResponseInput<typeof contract.exchangeToken>> {
    try {
      const data = await this.discordService.exchangeActivityCode(
        input.body.code,
      );
      return { data: { access_token: data.access_token } };
    } catch (error) {
      logger.error('activity.controller.exchange_token_failed', { error });
      throw this.httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unknown Error');
    }
  }

  @Post('ws-session')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  async getWsSessionToken(
    @ContractInput(contract.wsSession)
    input: ContractInputValue<typeof contract.wsSession>,
  ): Promise<ContractResponseInput<typeof contract.wsSession>> {
    try {
      const {
        accessToken,
        instanceId,
        guildId,
        mode,
        game,
        difficulty,
        winningScore,
        ruleset,
        options,
        roomId,
      } = input.body;
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        throw this.httpError(HttpStatus.UNAUTHORIZED, 'Invalid access token');
      }
      const requiresGuildMembership = mode === 'multi' || game === 'wordle';
      if (requiresGuildMembership) {
        const isMember = await this.discordService.isGuildMember(
          accessToken,
          guildId,
        );
        if (!isMember) {
          throw this.httpError(
            HttpStatus.FORBIDDEN,
            'Not a member of the specified guild',
          );
        }
      }
      if (game === 'pong') {
        if (ruleset !== undefined && !isPongRulesetId(ruleset)) {
          throw this.httpError(HttpStatus.BAD_REQUEST, 'Invalid Pong ruleset');
        }
        try {
          normalizePongMatchConfig({
            ruleset: isPongRulesetId(ruleset) ? ruleset : 'classic-1v1',
            ...(winningScore !== undefined
              ? { targetScore: winningScore }
              : {}),
            ...(options?.bestOf === 1 ||
            options?.bestOf === 3 ||
            options?.bestOf === 5
              ? { bestOf: options.bestOf }
              : {}),
            ...(typeof options?.ranked === 'boolean'
              ? { ranked: options.ranked }
              : {}),
          });
        } catch (error) {
          throw this.httpError(
            HttpStatus.BAD_REQUEST,
            error instanceof Error
              ? error.message
              : 'Invalid Pong configuration',
          );
        }
      }
      const displayName =
        typeof user.global_name === 'string' && user.global_name.length > 0
          ? user.global_name
          : typeof user.username === 'string' && user.username.length > 0
            ? user.username
            : undefined;
      const token = mintWsSessionToken({
        userId: user.id,
        ...(displayName !== undefined ? { displayName } : {}),
        instanceId,
        guildId,
        mode,
        game,
        ...(game === 'wordle' && mode !== 'multi'
          ? { guildMembershipVerified: true }
          : {}),
        ...(difficulty !== undefined ? { difficulty } : {}),
        ...(winningScore !== undefined ? { winningScore } : {}),
        ...(ruleset !== undefined ? { ruleset } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
      });
      const key = roomKey({
        instanceId,
        game,
        mode,
        userId: user.id,
        ...(ruleset !== undefined ? { ruleset } : {}),
        ...(roomId !== undefined ? { roomId } : {}),
      });
      return { data: { token, roomKey: key } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error('activity.controller.ws_session_failed', { error });
      throw this.httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unknown Error');
    }
  }

  @Post('pong/leaderboard')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  async getPongLeaderboard(
    @ContractInput(contract.pongLeaderboard)
    input: ContractInputValue<typeof contract.pongLeaderboard>,
  ): Promise<ContractResponseInput<typeof contract.pongLeaderboard>> {
    try {
      const { accessToken, guildId, pool, limit } = input.body;
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        throw this.httpError(HttpStatus.UNAUTHORIZED, 'Invalid access token');
      }
      const isMember = await this.discordService.isGuildMember(
        accessToken,
        guildId,
      );
      if (!isMember) {
        throw this.httpError(
          HttpStatus.FORBIDDEN,
          'Not a member of the specified guild',
        );
      }
      return { data: await this.competition.leaderboard(guildId, pool, limit) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error('activity.controller.pong_leaderboard_failed', { error });
      throw this.httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unknown Error');
    }
  }

  @Post('pong/tournaments/create')
  @ActivityRateLimit()
  async createPongTournament(
    @ContractInput(contract.createPongTournament)
    input: ContractInputValue<typeof contract.createPongTournament>,
  ): Promise<ContractResponseInput<typeof contract.createPongTournament>> {
    try {
      const values = input.body;
      const user = await this.discordService.getDiscordUser(values.accessToken);
      if (!user?.id) {
        throw this.httpError(HttpStatus.UNAUTHORIZED, 'Invalid access token');
      }
      if (
        !(await this.discordService.isGuildMember(
          values.accessToken,
          values.guildId,
        ))
      ) {
        throw this.httpError(
          HttpStatus.FORBIDDEN,
          'Not a member of the specified guild',
        );
      }
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
  async listPongTournaments(
    @ContractInput(contract.listPongTournaments)
    input: ContractInputValue<typeof contract.listPongTournaments>,
  ): Promise<ContractResponseInput<typeof contract.listPongTournaments>> {
    try {
      const { accessToken, guildId } = input.body;
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        throw this.httpError(HttpStatus.UNAUTHORIZED, 'Invalid access token');
      }
      if (!(await this.discordService.isGuildMember(accessToken, guildId))) {
        throw this.httpError(
          HttpStatus.FORBIDDEN,
          'Not a member of the specified guild',
        );
      }
      return { data: await this.tournaments.list(guildId) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error('activity.controller.pong_tournament_list_failed', {
        error,
      });
      throw this.httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unknown Error');
    }
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
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        throw this.httpError(HttpStatus.UNAUTHORIZED, 'Invalid access token');
      }
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
  async recordDeepLinkIntent(
    @ContractInput(contract.recordDeepLink)
    input: ContractInputValue<typeof contract.recordDeepLink>,
  ): Promise<ContractResponseInput<typeof contract.recordDeepLink>> {
    try {
      const { userId, guildId, game } = input.body;
      await this.deepLinks.record(userId, guildId, game);
      return { data: { ok: true } };
    } catch (error) {
      logger.error('activity.controller.record_deep_link_failed', { error });
      throw this.httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unknown Error');
    }
  }

  // Identity comes from re-validating accessToken with Discord, not the body.
  @Post('deep-link/claim')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  async claimDeepLinkIntent(
    @ContractInput(contract.claimDeepLink)
    input: ContractInputValue<typeof contract.claimDeepLink>,
  ): Promise<ContractResponseInput<typeof contract.claimDeepLink>> {
    try {
      const { accessToken, guildId } = input.body;
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        throw this.httpError(HttpStatus.UNAUTHORIZED, 'Invalid access token');
      }
      return { data: { game: await this.deepLinks.claim(user.id, guildId) } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      logger.error('activity.controller.claim_deep_link_failed', { error });
      throw this.httpError(HttpStatus.INTERNAL_SERVER_ERROR, 'Unknown Error');
    }
  }

  @Post('rooms')
  @HttpCode(HttpStatus.OK)
  @ActivityRateLimit()
  async createRoom(
    @ContractInput(contract.createRoom)
    input: ContractInputValue<typeof contract.createRoom>,
  ): Promise<ContractResponseInput<typeof contract.createRoom>> {
    try {
      const { accessToken, instanceId, guildId, game, queueEnabled } =
        input.body;
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        throw this.httpError(HttpStatus.UNAUTHORIZED, 'Invalid access token');
      }
      if (!(await this.discordService.isGuildMember(accessToken, guildId))) {
        throw this.httpError(
          HttpStatus.FORBIDDEN,
          'Not a member of the specified guild',
        );
      }

      const roomId = generateRoomId();
      const token = mintWsSessionToken({
        userId: user.id,
        ...(typeof user.global_name === 'string' && user.global_name.length > 0
          ? { displayName: user.global_name }
          : typeof user.username === 'string' && user.username.length > 0
            ? { displayName: user.username }
            : {}),
        instanceId,
        guildId,
        mode: 'multi',
        game,
        roomId,
        queueEnabled,
      });
      const key = roomKey({
        instanceId,
        game,
        mode: 'multi',
        userId: user.id,
        roomId,
      });
      return { data: { roomId, token, roomKey: key } };
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
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        throw this.httpError(HttpStatus.UNAUTHORIZED, 'Invalid access token');
      }
      if (!(await this.discordService.isGuildMember(accessToken, guildId))) {
        throw this.httpError(
          HttpStatus.FORBIDDEN,
          'Not a member of the specified guild',
        );
      }
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
