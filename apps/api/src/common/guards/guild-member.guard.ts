import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { DiscordService } from 'integrations/discord/discord.service';

@Injectable()
export class GuildMemberGuard implements CanActivate {
  constructor(private readonly discord: DiscordService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request<{ guildId: string }>>();
    const [, token] = (req.headers.authorization ?? '').split(' ');
    const { guildId } = req.params;
    if (!guildId || !token) throw new BadRequestException('Invalid request');

    let isMember: boolean;
    try {
      isMember = await this.discord.isGuildMember(token, guildId);
    } catch {
      throw new ServiceUnavailableException('Discord membership unavailable');
    }
    if (!isMember) throw new ForbiddenException('Not a community member');
    return true;
  }
}
