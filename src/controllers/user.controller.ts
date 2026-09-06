import type { Request, Response } from 'express';
import { DiscordService } from 'services/discord';
import { LastfmService } from 'services/lastfm';
import { UserService } from 'services/user';
import type { ApiResponse, LastfmTopListenedPeriod } from 'types';
import { decryptToken } from 'utils/crypto';

interface UserIdParams {
  id: string;
}

interface UserIdPeriodParams {
  id: string;
  period: string;
}

class UserController {
  userService: UserService;
  discordService: DiscordService;
  lastfmService: LastfmService;

  constructor() {
    this.userService = new UserService();
    this.discordService = new DiscordService();
    this.lastfmService = new LastfmService();
  }

  public async create(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<void>>> {
    try {
      const authorization = req.headers['authorization'] as string;
      const access_token = authorization && authorization.split(' ')[1];

      if (!access_token) {
        return res.status(401).json({ message: 'Token not provided' });
      }

      const decryptedToken = decryptToken(access_token);

      if (!decryptedToken) {
        return res.status(500).json({ message: 'Internal Server Error' });
      }

      const discordUser =
        await this.discordService.getDiscordUser(decryptedToken);
      await this.userService.create(discordUser.id);
    } catch (error: unknown) {
      console.error(error);

      if (error instanceof Error && error.message === 'User already exists') {
        return res.status(409).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Unknown Error' });
    }

    return res.status(200).json(req.user);
  }

  public async enableLastfm(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<void>>> {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    try {
      await this.userService.enableLastfm(req.user.id, token);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }

    return res.status(200).json({ message: 'Lastfm enabled' });
  }

  public async getProfile(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<void>>> {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      return res.status(200).json(req.user);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async toggleScrobbles(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<boolean>>> {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      return res
        .status(200)
        .json(await this.userService.toggleScrobbles(req.user.id));
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async deleteLastfmData(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<string>>> {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      await this.userService.deleteLastfmData(req.user.id);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }

    return res.status(200).json({ message: 'User deleted' });
  }

  public async deleteAllData(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<string>>> {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      await this.userService.deleteAllData(req.user.id);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }

    return res.status(200).json({ message: 'User deleted' });
  }

  public async exists(
    req: Request<
      UserIdParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): Promise<Response<ApiResponse<boolean>>> {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      return res.status(200).json(await this.userService.exists(req.params.id));
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async lastfmStatus(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<boolean>>> {
    if (!req.user) {
      return res.status(500).json({ message: 'Internal Server error' });
    }

    try {
      const lastfmStatus = await this.userService.hasValidLastfmSessionToken(
        req.user.id,
      );

      if (lastfmStatus) {
        return res.status(200).json(lastfmStatus);
      } else {
        return res.status(404).json({ message: 'Lastfm token not found' });
      }
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async getTopArtists(
    req: Request<
      UserIdPeriodParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): Promise<Response> {
    const id = req.params.id;
    const period = req.params.period as LastfmTopListenedPeriod;

    try {
      const topArtists = await this.userService.getTopArtists(id, period);

      return res.status(200).json(topArtists);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async getTopAlbums(
    req: Request<
      UserIdPeriodParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): Promise<Response> {
    const id = req.params.id;
    const period = req.params.period as LastfmTopListenedPeriod;

    try {
      const topAlbums = await this.userService.getTopAlbums(id, period);

      return res.status(200).json(topAlbums);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }

  public async getTopTracks(
    req: Request<
      UserIdPeriodParams,
      Record<string, unknown>,
      Record<string, unknown>
    >,
    res: Response,
  ): Promise<Response> {
    const id = req.params.id;
    const period = req.params.period as LastfmTopListenedPeriod;

    try {
      const topTracks = await this.userService.getTopTracks(id, period);

      return res.status(200).json(topTracks);
    } catch (error: unknown) {
      console.error(error);
      return res.status(500).json({ message: 'Unknown Error' });
    }
  }
}

export default UserController;
