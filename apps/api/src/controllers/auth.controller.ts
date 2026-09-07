import type { Request, Response } from 'express';
import { DiscordService } from 'services/discord';
import { LastfmService } from 'services/lastfm';
import { UserService } from 'services/user';
import type { ApiResponse } from 'types';
import { decryptToken, encryptToken } from 'utils/crypto';

class AuthController {
  private discordService: DiscordService;
  private lastfmService: LastfmService;
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
    this.discordService = new DiscordService();
    this.lastfmService = new LastfmService();
  }

  public async login(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<void>>> {
    const code = req?.query?.code as string | null;

    if (!code) {
      return res.status(400).json({
        message: 'Code not provided',
      });
    }

    try {
      const response = await this.discordService.requestToken(code);

      const expiresAt = Date.now() + response.expires_in * 1000;
      const encryptedToken = encryptToken(response.access_token, expiresAt);
      const encryptedRefreshToken = encryptToken(response.refresh_token);

      if (!encryptedToken || !encryptedRefreshToken) {
        return res.status(500).json({ message: 'Internal Server Error' });
      }

      res.set('Created-At', new Date().toISOString());
      res.set('Expires-In', response.expires_in.toString());
      res.set('Authorization', `Bearer ${encryptedToken}`);
      res.set('Refresh-Token', encryptedRefreshToken);

      res.set(
        'Access-Control-Expose-Headers',
        'Authorization, Refresh-Token, Expires-In, Created-At',
      );
      res.set(
        'Access-Control-Allow-Headers',
        'Authorization, Refresh-Token, Expires-In, Created-At',
      );

      const discordUser = await this.discordService.getDiscordUser(
        response.access_token,
      );

      if (!(await this.userService.exists(discordUser.id)))
        await this.userService.create(discordUser.id);

      return res.status(200).json({ message: 'Authenticated successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  public async refreshToken(
    req: Request,
    res: Response,
  ): Promise<Response<ApiResponse<void>>> {
    const refresh_token = req.headers['Refresh-Token'] as string;

    if (!refresh_token) {
      return res.status(400).json({ message: 'Refresh token not found' });
    }
    const decryptedRefreshToken = decryptToken(refresh_token);

    if (!decryptedRefreshToken) {
      return res.status(500).json({ message: 'Internal Server Error' });
    }

    try {
      const response = await this.discordService.refreshToken(
        decryptedRefreshToken,
      );

      const refreshExpiresAt = Date.now() + response.expires_in * 1000;
      const encryptedToken = encryptToken(
        response.access_token,
        refreshExpiresAt,
      );

      res.set('Authorization', `Bearer ${encryptedToken}`);
      res.set('Access-Control-Expose-Headers', 'Authorization');
      res.set('Access-Control-Allow-Headers', 'Authorization');

      return res.status(200).json({ message: 'Token refreshed' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  public discordLoginUrl(
    req: Request,
    res: Response,
  ): Response<ApiResponse<string>> {
    const state = req.query.state as string | undefined;
    return res.status(200).json({
      data: this.discordService.getAuthorizationUrl(state),
    });
  }

  public lastfmLoginUrl(
    req: Request,
    res: Response,
  ): Response<ApiResponse<string>> {
    return res.status(200).json({
      data: this.lastfmService.getAuthorizationUrl(),
    });
  }
}

export default AuthController;
