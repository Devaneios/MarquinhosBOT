import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { logger } from 'common/logging/logger';
import type { Request } from 'express';
import {
  DiscordService,
  type DiscordUser,
} from 'integrations/discord/discord.service';

type AuthenticatedRequest = Request & { user?: DiscordUser };

@Injectable()
export class ActivityAuthGuard implements CanActivate {
  constructor(private readonly discord: DiscordService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = req.headers.authorization;
    const [scheme, accessToken] =
      typeof authorization === 'string' ? authorization.split(' ') : [];

    if (scheme !== 'Bearer' || !accessToken) {
      throw new UnauthorizedException('Token not provided');
    }

    let user: DiscordUser | null;
    try {
      user = await this.discord.getDiscordUser(accessToken);
    } catch (error) {
      logger.error('user_auth.activity_token_verification_failed', { error });
      throw new InternalServerErrorException('Internal Server Error');
    }
    if (!user?.id) throw new UnauthorizedException('Unauthorized');
    Object.defineProperty(req, 'user', { value: user });
    return true;
  }
}
