import type { DiscordUser } from 'integrations/discord/discord.service';

export type LastfmSessionResponse = {
  sessionKey: string;
  userName: string;
};

declare module 'express' {
  export interface Request {
    user?: DiscordUser;
  }
}
