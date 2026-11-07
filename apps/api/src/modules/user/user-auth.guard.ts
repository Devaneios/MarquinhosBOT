import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { TokenCipherService } from 'common/crypto';
import type { Request } from 'express';
import {
  DiscordService,
  type DiscordUser,
} from 'integrations/discord/discord.service';
import { UserService } from 'modules/user/user.service';
import { logger } from 'utils/logger';

type AuthenticatedRequest = Request & { user?: DiscordUser };

@Injectable()
export class DiscordUserAuthGuard implements CanActivate {
  constructor(
    private readonly tokenCipher: TokenCipherService,
    private readonly discord: DiscordService,
    private readonly users: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = req.headers.authorization;
    const accessToken = authorization?.split(' ')[1];
    if (!accessToken) throw new UnauthorizedException('Token not provided');

    const payload = this.tokenCipher.decryptTokenFull(accessToken);
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.expiresAt !== undefined && Date.now() > payload.expiresAt) {
      throw new UnauthorizedException('Token expired');
    }

    let discordUser: DiscordUser | null;
    try {
      discordUser = await this.discord.getDiscordUser(payload.token);
    } catch (error) {
      logger.error('user_auth.token_verification_failed', { error });
      throw new InternalServerErrorException('Internal Server Error');
    }
    if (!discordUser) throw new UnauthorizedException('Unauthorized');

    let exists: Awaited<ReturnType<UserService['exists']>>;
    try {
      discordUser.highestRole =
        await this.discord.getDiscordGuildUserHighestRole(payload.token);
      exists = await this.users.exists(discordUser.id);
    } catch (error) {
      logger.error('user_auth.token_verification_failed', { error });
      throw new InternalServerErrorException('Internal Server Error');
    }
    if (!exists) throw new UnauthorizedException('User not found');

    Object.defineProperty(req, 'user', { value: discordUser });
    return true;
  }
}
