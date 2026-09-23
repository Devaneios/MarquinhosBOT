import * as contract from '@marquinhos/contracts/http/routes/auth';
import type { Request, Response } from 'express';
import { DiscordService } from 'services/discord';
import { LastfmService } from 'services/lastfm';
import { UserService } from 'services/user';
import { parseRequest, sendContract } from 'utils/contract';
import { decryptToken, encryptToken } from 'utils/crypto';

class AuthController {
  constructor(
    private discordService: DiscordService = new DiscordService(),
    private lastfmService: LastfmService = new LastfmService(),
    private userService: UserService = new UserService(),
  ) {}

  public async login(req: Request, res: Response): Promise<Response> {
    const input = parseRequest(contract.login, req);

    if (!input) {
      return res.status(400).json({
        message: 'Code not provided',
      });
    }

    try {
      const response = await this.discordService.requestToken(input.query.code);

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
      if (!discordUser) {
        return res.status(502).json({ message: 'Discord user lookup failed' });
      }

      if (!(await this.userService.exists(discordUser.id)))
        await this.userService.create(discordUser.id);

      return sendContract(res, contract.login, {
        message: 'Authenticated successfully',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  public async refreshToken(req: Request, res: Response): Promise<Response> {
    const refresh_token = req.get('Refresh-Token');

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

      return sendContract(res, contract.refreshToken, {
        message: 'Token refreshed',
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }

  public discordLoginUrl(req: Request, res: Response): Response {
    const state = parseRequest(contract.discordLoginUrl, req)?.query.state;
    return sendContract(res, contract.discordLoginUrl, {
      data: this.discordService.getAuthorizationUrl(state),
    });
  }

  public lastfmLoginUrl(req: Request, res: Response): Response {
    return sendContract(res, contract.lastfmLoginUrl, {
      data: this.lastfmService.getAuthorizationUrl(),
    });
  }
}

export default AuthController;
