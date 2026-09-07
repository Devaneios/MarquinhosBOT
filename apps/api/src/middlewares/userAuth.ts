import type { NextFunction, Request, Response } from 'express';
import { DiscordService } from 'services/discord';
import { UserService } from 'services/user';
import { decryptTokenFull } from 'utils/crypto';

const logger = {
  error: (...args: unknown[]) => console.error('[userAuth]', ...args),
};

const discordService = new DiscordService();
const userService = new UserService();

export async function verifyDiscordToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers['authorization'] as string;
  const access_token = authorization && authorization.split(' ')[1];

  if (!access_token) {
    return res.status(401).json({ message: 'Token not provided' });
  }

  const payload = decryptTokenFull(access_token);

  if (!payload) {
    // Was 500 — decryption failure means invalid/expired/tampered token, not a server error
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  if (payload.expiresAt !== undefined && Date.now() > payload.expiresAt) {
    return res.status(401).json({ message: 'Token expired' });
  }

  try {
    const discordUser = await discordService.getDiscordUser(payload.token);

    // Null check BEFORE property assignment (previous code assigned .highestRole first,
    // making this guard unreachable dead code that always produced a 500 TypeError)
    if (!discordUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const highestRole = await discordService.getDiscordGuildUserHighestRole(
      payload.token,
    );

    discordUser.highestRole = highestRole;

    const user = await userService.exists(discordUser.id);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    Object.defineProperty(req, 'user', {
      value: discordUser,
    });
    next();
  } catch (error) {
    logger.error('Discord token verification failed:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
