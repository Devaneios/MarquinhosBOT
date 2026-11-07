import { createLegacyAppConfig } from 'config/legacy-app-config';
import type { NextFunction, Request, Response } from 'express';
import { DiscordService } from 'integrations/discord/discord.service';
import { logger } from 'utils/logger';

const discordService = new DiscordService(createLegacyAppConfig());

export function createActivityDiscordTokenVerifier(
  activityDiscordService: Pick<DiscordService, 'getDiscordUser'>,
) {
  return async function verifyActivityDiscordToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const authorization = req.headers.authorization;
    const [scheme, accessToken] =
      typeof authorization === 'string' ? authorization.split(' ') : [];

    if (scheme !== 'Bearer' || !accessToken) {
      return res.status(401).json({ message: 'Token not provided' });
    }

    try {
      const discordUser =
        await activityDiscordService.getDiscordUser(accessToken);
      if (!discordUser?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      Object.defineProperty(req, 'user', { value: discordUser });
      next();
    } catch (error) {
      logger.error('user_auth.activity_token_verification_failed', { error });
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  };
}

export const verifyActivityDiscordToken =
  createActivityDiscordTokenVerifier(discordService);
