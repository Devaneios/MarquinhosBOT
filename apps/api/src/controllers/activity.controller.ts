import { matchMaker } from 'colyseus';
import type { Request, Response } from 'express';
import { customAlphabet } from 'nanoid';
import type { ActivityMode, GameId } from 'services/activity/gameId';
import type { BotDifficulty } from 'services/activity/pong/PongBotAI';
import {
  PongCompetitionService,
  type PongRatingPool,
} from 'services/activity/pong/PongCompetitionService';
import {
  isPongRulesetId,
  normalizePongMatchConfig,
} from 'services/activity/pong/PongRulesetRegistry';
import {
  PongTournamentService,
  type CreatePongTournamentInput,
} from 'services/activity/pong/PongTournamentService';
import { roomKey } from 'services/activity/roomKey';
import { mintWsSessionToken } from 'services/activity/wsSessionToken';
import { DiscordGuildMembershipError, DiscordService } from 'services/discord';
import { logger } from 'utils/logger';

const generateRoomId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

interface RoomListing {
  instanceId: string;
  roomId: string;
  game: GameId;
  hostUserId: string;
  playerCount: number;
  spectatorCount: number;
  queueDepth: number;
  queueEnabled: boolean;
  mode: ActivityMode;
}

class ActivityController {
  private discordService: DiscordService;
  private queryRooms: typeof matchMaker.query;

  constructor(
    discordService: DiscordService = new DiscordService(),
    queryRooms: typeof matchMaker.query = matchMaker.query,
  ) {
    this.discordService = discordService;
    this.queryRooms = queryRooms;
  }

  getPongLeaderboard = async (req: Request, res: Response) => {
    try {
      const { accessToken, guildId, pool, limit } = req.body as {
        accessToken: string;
        guildId: string;
        pool: PongRatingPool;
        limit?: number;
      };
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      const isMember = await this.discordService.isGuildMember(
        accessToken,
        guildId,
      );
      if (!isMember) {
        return res
          .status(403)
          .json({ message: 'Not a member of the specified guild' });
      }
      const data = new PongCompetitionService().leaderboard(
        guildId,
        pool,
        limit,
      );
      return res.status(200).json({ data });
    } catch (error) {
      logger.error('activity.controller.pong_leaderboard_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  createPongTournament = async (req: Request, res: Response) => {
    try {
      const input = req.body as Omit<CreatePongTournamentInput, 'createdBy'> & {
        accessToken: string;
      };
      const user = await this.discordService.getDiscordUser(input.accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      if (
        !(await this.discordService.isGuildMember(
          input.accessToken,
          input.guildId,
        ))
      ) {
        return res
          .status(403)
          .json({ message: 'Not a member of the specified guild' });
      }
      const data = new PongTournamentService().create({
        guildId: input.guildId,
        name: input.name,
        format: input.format,
        pool: input.pool,
        playerIds: input.playerIds,
        ...(input.swissRounds !== undefined
          ? { swissRounds: input.swissRounds }
          : {}),
        createdBy: user.id,
      });
      return res.status(201).json({ data });
    } catch (error) {
      logger.error('activity.controller.pong_tournament_create_failed', {
        error,
      });
      return res.status(400).json({
        message: error instanceof Error ? error.message : 'Invalid tournament',
      });
    }
  };

  listPongTournaments = async (req: Request, res: Response) => {
    try {
      const { accessToken, guildId } = req.body as {
        accessToken: string;
        guildId: string;
      };
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      if (!(await this.discordService.isGuildMember(accessToken, guildId))) {
        return res
          .status(403)
          .json({ message: 'Not a member of the specified guild' });
      }
      return res
        .status(200)
        .json({ data: new PongTournamentService().list(guildId) });
    } catch (error) {
      logger.error('activity.controller.pong_tournament_list_failed', {
        error,
      });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  reportPongTournamentMatch = async (req: Request, res: Response) => {
    try {
      const { accessToken, matchId, winnerId } = req.body as {
        accessToken: string;
        matchId: string;
        winnerId: string;
      };
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      const data = new PongTournamentService().report(
        matchId,
        winnerId,
        user.id,
      );
      return res.status(200).json({ data });
    } catch (error) {
      logger.error('activity.controller.pong_tournament_report_failed', {
        error,
      });
      return res.status(400).json({
        message: error instanceof Error ? error.message : 'Invalid result',
      });
    }
  };

  exchangeToken = async (req: Request, res: Response) => {
    try {
      const { code } = req.body as { code: string };
      const data = await this.discordService.exchangeActivityCode(code);
      return res
        .status(200)
        .json({ data: { access_token: data.access_token } });
    } catch (error) {
      logger.error('activity.controller.exchange_token_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  getWsSessionToken = async (req: Request, res: Response) => {
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
      } = req.body as {
        accessToken: string;
        instanceId: string;
        guildId: string;
        mode: ActivityMode;
        game: GameId;
        difficulty?: BotDifficulty;
        winningScore?: number;
        ruleset?: string;
        options?: Record<string, unknown>;
        roomId?: string;
      };
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      if (mode === 'multi') {
        const isMember = await this.discordService.isGuildMember(
          accessToken,
          guildId,
        );
        if (!isMember) {
          return res
            .status(403)
            .json({ message: 'Not a member of the specified guild' });
        }
      }
      if (game === 'pong') {
        if (ruleset !== undefined && !isPongRulesetId(ruleset)) {
          return res.status(400).json({ message: 'Invalid Pong ruleset' });
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
          return res.status(400).json({
            message:
              error instanceof Error
                ? error.message
                : 'Invalid Pong configuration',
          });
        }
      }
      const resolvedRoomId = mode === 'multi' ? (roomId ?? 'PONG') : roomId;
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
        ...(difficulty !== undefined ? { difficulty } : {}),
        ...(winningScore !== undefined ? { winningScore } : {}),
        ...(ruleset !== undefined ? { ruleset } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(resolvedRoomId !== undefined ? { roomId: resolvedRoomId } : {}),
      });
      const key = roomKey({
        instanceId,
        game,
        mode,
        userId: user.id,
        ...(ruleset !== undefined ? { ruleset } : {}),
        ...(resolvedRoomId !== undefined ? { roomId: resolvedRoomId } : {}),
      });
      return res.status(200).json({ data: { token, roomKey: key } });
    } catch (error) {
      logger.error('activity.controller.ws_session_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  // client.getAvailableRooms() has no client-side equivalent in the
  // installed @colyseus/sdk (its matchmaking API only exposes
  // joinOrCreate/create/join/joinById/reconnect), so room listing is served
  // over REST instead, backed by the same matchMaker.query() the SDK's
  // classic getAvailableRooms used server-side.
  listRooms = async (req: Request, res: Response) => {
    try {
      const { accessToken, instanceId, guildId } = req.body as {
        accessToken: string;
        instanceId: string;
        guildId: string;
      };
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      const isMember = await this.discordService.isGuildMember(
        accessToken,
        guildId,
      );
      if (!isMember) {
        return res
          .status(403)
          .json({ message: 'Not a member of the specified guild' });
      }
      const rooms = await this.queryRooms({
        name: 'match',
        instanceId,
        mode: 'multi',
        locked: false,
      });
      const data = rooms.map((room) => room.metadata as RoomListing);
      return res.status(200).json({ data });
    } catch (error) {
      logger.error('activity.controller.list_rooms_failed', { error });
      if (error instanceof DiscordGuildMembershipError) {
        return res
          .status(503)
          .json({ message: 'Discord membership service unavailable' });
      }
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  createRoom = async (req: Request, res: Response) => {
    try {
      const { accessToken, instanceId, guildId, game } = req.body as {
        accessToken: string;
        instanceId: string;
        guildId: string;
        game: GameId;
        queueEnabled: boolean;
      };
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
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
      });
      const key = roomKey({
        instanceId,
        game,
        mode: 'multi',
        userId: user.id,
        roomId,
      });
      return res.status(200).json({ data: { roomId, token, roomKey: key } });
    } catch (error) {
      logger.error('activity.controller.create_room_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };
}

export default ActivityController;
