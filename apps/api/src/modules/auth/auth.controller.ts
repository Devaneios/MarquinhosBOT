import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/auth';
import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Query,
  Res,
} from '@nestjs/common';
import { TokenCipherService } from 'common/crypto';
import type { ContractInputValue } from 'common/decorators/contract-input.decorator';
import { ContractInput } from 'common/decorators/contract-input.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import type { Response } from 'express';
import { DiscordService } from 'integrations/discord/discord.service';
import { LastfmService } from 'integrations/lastfm/lastfm.service';
import { UserService } from 'modules/user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly discordService: DiscordService,
    private readonly lastfmService: LastfmService,
    private readonly userService: UserService,
    private readonly tokenCipher: TokenCipherService,
  ) {}

  @Get('login')
  @OnRouteError({
    event: 'auth.controller.login_failed',
    message: 'Internal Server Error',
  })
  async login(
    @ContractInput(contract.login, 'Code not provided')
    input: ContractInputValue<typeof contract.login>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ContractResponseInput<typeof contract.login>> {
    const tokens = await this.discordService.requestToken(input.query.code);
    const expiresAt = Date.now() + tokens.expires_in * 1000;
    const encryptedToken = this.tokenCipher.encryptToken(
      tokens.access_token,
      expiresAt,
    );
    const encryptedRefreshToken = this.tokenCipher.encryptToken(
      tokens.refresh_token,
    );

    if (!encryptedToken || !encryptedRefreshToken) {
      throw new InternalServerErrorException('Internal Server Error');
    }

    const discordUser = await this.discordService.getDiscordUser(
      tokens.access_token,
    );
    if (!discordUser)
      throw new BadGatewayException('Discord user lookup failed');

    if (!(await this.userService.exists(discordUser.id))) {
      await this.userService.create(discordUser.id);
    }

    response.setHeader('Created-At', new Date().toISOString());
    response.setHeader('Expires-In', tokens.expires_in.toString());
    response.setHeader('Authorization', `Bearer ${encryptedToken}`);
    response.setHeader('Refresh-Token', encryptedRefreshToken);
    response.setHeader(
      'Access-Control-Expose-Headers',
      'Authorization, Refresh-Token, Expires-In, Created-At',
    );
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Refresh-Token, Expires-In, Created-At',
    );

    return { message: 'Authenticated successfully' };
  }

  @Get('refresh_token')
  @OnRouteError({
    event: 'auth.controller.refresh_token_failed',
    message: 'Internal Server Error',
  })
  async refreshToken(
    @Headers('refresh-token') refreshToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ContractResponseInput<typeof contract.refreshToken>> {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token not found');
    }
    const decryptedRefreshToken = this.tokenCipher.decryptToken(refreshToken);
    if (!decryptedRefreshToken) {
      throw new InternalServerErrorException('Internal Server Error');
    }

    const tokens = await this.discordService.refreshToken(
      decryptedRefreshToken,
    );
    const refreshExpiresAt = Date.now() + tokens.expires_in * 1000;
    const encryptedToken = this.tokenCipher.encryptToken(
      tokens.access_token,
      refreshExpiresAt,
    );
    if (!encryptedToken) {
      throw new InternalServerErrorException('Internal Server Error');
    }

    const encryptedNewRefreshToken = tokens.refresh_token
      ? this.tokenCipher.encryptToken(tokens.refresh_token)
      : null;
    if (tokens.refresh_token && !encryptedNewRefreshToken) {
      throw new InternalServerErrorException('Internal Server Error');
    }

    response.setHeader('Created-At', new Date().toISOString());
    response.setHeader('Expires-In', tokens.expires_in.toString());
    response.setHeader('Authorization', `Bearer ${encryptedToken}`);
    if (encryptedNewRefreshToken) {
      response.setHeader('Refresh-Token', encryptedNewRefreshToken);
    }
    response.setHeader(
      'Access-Control-Expose-Headers',
      'Authorization, Refresh-Token, Expires-In, Created-At',
    );
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Authorization, Refresh-Token, Expires-In, Created-At',
    );
    return { message: 'Token refreshed' };
  }

  @Get('discordLoginUrl')
  discordLoginUrl(
    @Query('state') state: string | undefined,
  ): ContractResponseInput<typeof contract.discordLoginUrl> {
    return { data: this.discordService.getAuthorizationUrl(state) };
  }

  @Get('lastfmLoginUrl')
  lastfmLoginUrl(): ContractResponseInput<typeof contract.lastfmLoginUrl> {
    return { data: this.lastfmService.getAuthorizationUrl() };
  }
}

export default AuthController;
