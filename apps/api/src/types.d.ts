import type { DiscordUser } from 'services/discord';

export type LastfmSessionResponse = {
  sessionKey: string;
  userName: string;
};

export interface ApiResponse<T> {
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

declare module 'express' {
  export interface Request {
    user?: DiscordUser;
  }
}
