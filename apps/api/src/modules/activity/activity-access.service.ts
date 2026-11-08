import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  DiscordService,
  type DiscordUser,
} from 'integrations/discord/discord.service';

@Injectable()
export class ActivityAccessService {
  constructor(private readonly discord: DiscordService) {}

  async authenticate(accessToken: string): Promise<DiscordUser> {
    const user = await this.discord.getDiscordUser(accessToken);
    if (!user?.id) {
      throw new HttpException(
        { message: 'Invalid access token' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }

  async authenticateMember(
    accessToken: string,
    guildId: string,
  ): Promise<DiscordUser> {
    const user = await this.authenticate(accessToken);
    if (!(await this.discord.isGuildMember(accessToken, guildId))) {
      throw new HttpException(
        { message: 'Not a member of the specified guild' },
        HttpStatus.FORBIDDEN,
      );
    }
    return user;
  }
}

export function discordDisplayName(user: DiscordUser): string | undefined {
  if (typeof user.global_name === 'string' && user.global_name.length > 0) {
    return user.global_name;
  }
  if (typeof user.username === 'string' && user.username.length > 0) {
    return user.username;
  }
  return undefined;
}
