import type { DiscordUser } from 'services/discord';

export type LastfmSessionResponse = {
  sessionKey: string;
  userName: string;
};

declare module 'express' {
  export interface Request {
    user?: DiscordUser;
  }
}
