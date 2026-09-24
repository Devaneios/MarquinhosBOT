import * as contract from '@marquinhos/contracts/http/routes/activity';
import { roomListingSchema } from '@marquinhos/contracts/http/routes/activity';
import {
  isPongRulesetId,
  normalizePongMatchConfig,
} from '@marquinhos/domain/games/pong/PongRulesetRegistry';
import { matchMaker } from 'colyseus';
import type { Request, Response } from 'express';
import { customAlphabet } from 'nanoid';
import { PongCompetitionService } from 'services/activity/pong/PongCompetitionService';
import { PongTournamentService } from 'services/activity/pong/PongTournamentService';
import { roomKey } from 'services/activity/roomKey';
import { mintWsSessionToken } from 'services/activity/wsSessionToken';
import { claimDeepLink, recordDeepLink } from 'services/activityDeepLink';
import { DiscordGuildMembershipError, DiscordService } from 'services/discord';
import { parseRequest, sendContract } from 'utils/contract';
import { logger } from 'utils/logger';

const generateRoomId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

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
      const input = parseRequest(contract.pongLeaderboard, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { accessToken, guildId, pool, limit } = input.body;
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
      return sendContract(res, contract.pongLeaderboard, { data });
    } catch (error) {
      logger.error('activity.controller.pong_leaderboard_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  createPongTournament = async (req: Request, res: Response) => {
    try {
      const parsed = parseRequest(contract.createPongTournament, req);
      if (!parsed) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const input = parsed.body;
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
      return sendContract(res, contract.createPongTournament, { data }, 201);
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
      const input = parseRequest(contract.listPongTournaments, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { accessToken, guildId } = input.body;
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      if (!(await this.discordService.isGuildMember(accessToken, guildId))) {
        return res
          .status(403)
          .json({ message: 'Not a member of the specified guild' });
      }
      return sendContract(res, contract.listPongTournaments, {
        data: new PongTournamentService().list(guildId),
      });
    } catch (error) {
      logger.error('activity.controller.pong_tournament_list_failed', {
        error,
      });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  reportPongTournamentMatch = async (req: Request, res: Response) => {
    try {
      const input = parseRequest(contract.reportPongTournamentMatch, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { accessToken, matchId, winnerId } = input.body;
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      const data = new PongTournamentService().report(
        matchId,
        winnerId,
        user.id,
      );
      return sendContract(res, contract.reportPongTournamentMatch, { data });
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
      const input = parseRequest(contract.exchangeToken, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { code } = input.body;
      const data = await this.discordService.exchangeActivityCode(code);
      return sendContract(res, contract.exchangeToken, {
        data: { access_token: data.access_token },
      });
    } catch (error) {
      logger.error('activity.controller.exchange_token_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  getWsSessionToken = async (req: Request, res: Response) => {
    try {
      const input = parseRequest(contract.wsSession, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
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
        return res.status(401).json({ message: 'Invalid access token' });
      }
      if (mode === 'multi') {
        if (!roomId) {
          return res
            .status(400)
            .json({ message: 'roomId is required for multi mode' });
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
      const resolvedRoomId = roomId;
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
      return sendContract(res, contract.wsSession, {
        data: { token, roomKey: key },
      });
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
      const input = parseRequest(contract.listRooms, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { accessToken, instanceId, guildId } = input.body;
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
      const data = rooms.flatMap((room) => {
        const listing = roomListingSchema.safeParse(room.metadata);
        return listing.success ? [listing.data] : [];
      });
      return sendContract(res, contract.listRooms, { data });
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

  // Called by the bot (checkToken bot-key auth) right before launchActivity(),
  // since Discord's LaunchActivity interaction response has no data field of
  // its own to tell the Activity which game to open.
  recordDeepLinkIntent = (req: Request, res: Response) => {
    const input = parseRequest(contract.recordDeepLink, req);
    if (!input) {
      return res.status(400).json({ message: 'Validation failed' });
    }
    const { userId, guildId, game } = input.body;
    try {
      recordDeepLink(userId, guildId, game);
      return sendContract(res, contract.recordDeepLink, { data: { ok: true } });
    } catch (error) {
      logger.error('activity.controller.record_deep_link_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  // Called by the Activity client once its Discord SDK auth handshake has
  // resolved. Identity is derived from re-validating accessToken against
  // Discord, not trusted from the request body, matching getWsSessionToken.
  claimDeepLinkIntent = async (req: Request, res: Response) => {
    try {
      const input = parseRequest(contract.claimDeepLink, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { accessToken, guildId } = input.body;
      const user = await this.discordService.getDiscordUser(accessToken);
      if (!user?.id) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      const game = claimDeepLink(user.id, guildId);
      return sendContract(res, contract.claimDeepLink, { data: { game } });
    } catch (error) {
      logger.error('activity.controller.claim_deep_link_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };

  createRoom = async (req: Request, res: Response) => {
    try {
      const input = parseRequest(contract.createRoom, req);
      if (!input) {
        return res.status(400).json({ message: 'Validation failed' });
      }
      const { accessToken, instanceId, guildId, game, queueEnabled } =
        input.body;
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
        queueEnabled,
      });
      const key = roomKey({
        instanceId,
        game,
        mode: 'multi',
        userId: user.id,
        roomId,
      });
      return sendContract(res, contract.createRoom, {
        data: { roomId, token, roomKey: key },
      });
    } catch (error) {
      logger.error('activity.controller.create_room_failed', { error });
      return res.status(500).json({ message: 'Unknown Error' });
    }
  };
}

export default ActivityController;
