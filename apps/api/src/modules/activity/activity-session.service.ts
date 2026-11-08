import type * as contract from '@marquinhos/contracts/http/routes/activity';
import {
  isPongRulesetId,
  normalizePongMatchConfig,
} from '@marquinhos/domain/games/pong/PongRulesetRegistry';
import { Injectable } from '@nestjs/common';
import type { ContractInputValue } from 'common/decorators/contract-input.decorator';
import type { DiscordUser } from 'integrations/discord/discord.service';
import { discordDisplayName } from 'modules/activity/activity-access.service';
import { roomKey } from 'modules/activity/room-key';
import { WsSessionTokenService } from 'modules/activity/ws-session-token';
import { customAlphabet } from 'nanoid';

export type WsSessionRequest = Omit<
  ContractInputValue<typeof contract.wsSession>['body'],
  'accessToken'
>;

export type RoomRequest = Omit<
  ContractInputValue<typeof contract.createRoom>['body'],
  'accessToken'
>;

export class InvalidActivitySessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActivitySessionError';
  }
}

const generateRoomId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

@Injectable()
export class ActivitySessionService {
  constructor(private readonly wsSessionTokens: WsSessionTokenService) {}

  issueSession(
    user: DiscordUser,
    request: WsSessionRequest,
  ): { token: string; roomKey: string } {
    const {
      instanceId,
      guildId,
      mode,
      game,
      difficulty,
      winningScore,
      ruleset,
      options,
      roomId,
    } = request;

    if (game === 'pong') {
      if (ruleset !== undefined && !isPongRulesetId(ruleset)) {
        throw new InvalidActivitySessionError('Invalid Pong ruleset');
      }
      try {
        normalizePongMatchConfig({
          ruleset: isPongRulesetId(ruleset) ? ruleset : 'classic-1v1',
          ...(winningScore !== undefined ? { targetScore: winningScore } : {}),
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
        throw new InvalidActivitySessionError(
          error instanceof Error ? error.message : 'Invalid Pong configuration',
        );
      }
    }

    const displayName = discordDisplayName(user);
    const token = this.wsSessionTokens.mint({
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
    return { token, roomKey: key };
  }

  createRoom(
    user: DiscordUser,
    request: RoomRequest,
  ): { roomId: string; token: string; roomKey: string } {
    const { instanceId, guildId, game, queueEnabled } = request;
    const roomId = generateRoomId();
    const displayName = discordDisplayName(user);
    const token = this.wsSessionTokens.mint({
      userId: user.id,
      ...(displayName !== undefined ? { displayName } : {}),
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
    return { roomId, token, roomKey: key };
  }
}
