import type { NextFunction, Request, Response } from 'express';

/**
 * Admits only members of the `:guildId` community. Mount it after
 * `verifyActivityDiscordToken`, which has already checked the Bearer token.
 */
export function requireGuildMember(
  isMember: (token: string, guildId: string) => Promise<boolean>,
) {
  return async function verifyGuildMember(
    req: Request<{ guildId: string }>,
    res: Response,
    next: NextFunction,
  ) {
    const [, token] = (req.headers.authorization ?? '').split(' ');
    const guildId = req.params.guildId;
    if (!guildId || !token) {
      res.status(400).json({ message: 'Invalid request' });
      return;
    }
    let member: boolean;
    try {
      member = await isMember(token, guildId);
    } catch {
      res.status(503).json({ message: 'Discord membership unavailable' });
      return;
    }
    if (!member) {
      res.status(403).json({ message: 'Not a community member' });
      return;
    }
    next();
  };
}
