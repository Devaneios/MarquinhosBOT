export interface IUser {
  id: string;
  lastfmSessionToken?: string;
  lastfmUsername?: string;
  scrobblesOn?: boolean;
}

export interface IScrobble {
  id: string;
  track: Track;
  playbackData: PlaybackData;
}

export type LastfmSessionResponse = {
  sessionKey: string;
  userName: string;
};

export type PlaybackData = {
  title: string;
  url?: string;
  listeningUsersId: string[];
  timestamp: Date;
  guildId: string;
  channelId: string;
  providerName: string;
};

export type Track = {
  artist: string;
  name: string;
  durationInMillis: number;
  album?: string;
  coverArtUrl?: string;
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

export type LastfmTopListenedPeriod =
  '7day' | '1month' | '3month' | '6month' | '12month' | 'overall';

declare module 'express' {
  export interface Request {
    user?: IUser;
  }
}
