import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/user';
import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ContractInputValue } from 'common/decorators/contract-input.decorator';
import { ContractInput } from 'common/decorators/contract-input.decorator';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { jsonNull } from 'common/http/json-null';
import type { DiscordUser } from 'integrations/discord/discord.service';
import { DiscordUserAuthGuard } from 'modules/user/user-auth.guard';
import { UserService } from 'modules/user/user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(DiscordUserAuthGuard)
  getProfile(
    @CurrentUser() user: DiscordUser | undefined,
  ): ContractResponseInput<typeof contract.getProfile> {
    if (!user) {
      throw new HttpException(
        'Internal Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return user;
  }

  @Get('exists/:id')
  @UseGuards(DiscordUserAuthGuard)
  @OnRouteError({
    event: 'user.controller.exists_failed',
    message: 'Unknown Error',
  })
  async exists(
    @ContractInput(contract.exists, 'id is required')
    input: ContractInputValue<typeof contract.exists>,
    @CurrentUser() user: DiscordUser | undefined,
  ): Promise<ContractResponseInput<typeof contract.exists>> {
    const currentUser = this.requireUser(user);
    if (currentUser.id !== input.params.id) {
      throw new ForbiddenException('Forbidden');
    }
    const existingUser = await this.userService.exists(input.params.id);
    return existingUser ?? jsonNull;
  }

  @Get('lastfm-status')
  @UseGuards(DiscordUserAuthGuard)
  @OnRouteError({
    event: 'user.controller.lastfm_status_failed',
    message: 'Unknown Error',
  })
  async lastfmStatus(
    @CurrentUser() user: DiscordUser | undefined,
  ): Promise<ContractResponseInput<typeof contract.lastfmStatus>> {
    const { id } = this.requireUser(user);
    const status = await this.userService.hasValidLastfmSessionToken(id);
    if (!status) throw new HttpException('Lastfm token not found', 404);
    return status;
  }

  @Post('enable-lastfm')
  @HttpCode(200)
  @UseGuards(DiscordUserAuthGuard)
  @OnRouteError({
    event: 'user.controller.enable_lastfm_failed',
    message: 'Unknown Error',
  })
  async enableLastfm(
    @ContractInput(contract.enableLastfm, 'Missing credentials')
    input: ContractInputValue<typeof contract.enableLastfm>,
    @CurrentUser() user: DiscordUser | undefined,
  ): Promise<ContractResponseInput<typeof contract.enableLastfm>> {
    await this.userService.enableLastfm(
      this.requireUser(user).id,
      input.body.token,
    );
    return { message: 'Lastfm enabled' };
  }

  @Delete('lastfm')
  @UseGuards(DiscordUserAuthGuard)
  @OnRouteError({
    event: 'user.controller.delete_lastfm_data_failed',
    message: 'Unknown Error',
  })
  async deleteLastfmData(
    @CurrentUser() user: DiscordUser | undefined,
  ): Promise<ContractResponseInput<typeof contract.deleteLastfmData>> {
    await this.userService.deleteLastfmData(this.requireUser(user).id);
    return { message: 'User deleted' };
  }

  @Delete()
  @UseGuards(DiscordUserAuthGuard)
  @OnRouteError({
    event: 'user.controller.delete_all_data_failed',
    message: 'Unknown Error',
  })
  async deleteAllData(
    @CurrentUser() user: DiscordUser | undefined,
  ): Promise<ContractResponseInput<typeof contract.deleteAllData>> {
    await this.userService.deleteAllData(this.requireUser(user).id);
    return { message: 'User deleted' };
  }

  @Patch('toggle-scrobble')
  @UseGuards(DiscordUserAuthGuard)
  @OnRouteError({
    event: 'user.controller.toggle_scrobbles_failed',
    message: 'Unknown Error',
  })
  toggleScrobbles(
    @CurrentUser() user: DiscordUser | undefined,
  ): Promise<ContractResponseInput<typeof contract.toggleScrobbles>> {
    return this.userService.toggleScrobbles(this.requireUser(user).id);
  }

  @Get('top-artists/:period/:id')
  @UseGuards(BotAuthGuard)
  @OnRouteError({
    event: 'user.controller.get_top_artists_failed',
    message: 'Unknown Error',
  })
  getTopArtists(
    @ContractInput(contract.getTopArtists, 'Invalid user id or period')
    input: ContractInputValue<typeof contract.getTopArtists>,
  ): ReturnType<UserService['getTopArtists']> {
    return this.userService.getTopArtists(input.params.id, input.params.period);
  }

  @Get('top-albums/:period/:id')
  @UseGuards(BotAuthGuard)
  @OnRouteError({
    event: 'user.controller.get_top_albums_failed',
    message: 'Unknown Error',
  })
  getTopAlbums(
    @ContractInput(contract.getTopAlbums, 'Invalid user id or period')
    input: ContractInputValue<typeof contract.getTopAlbums>,
  ): ReturnType<UserService['getTopAlbums']> {
    return this.userService.getTopAlbums(input.params.id, input.params.period);
  }

  @Get('top-tracks/:period/:id')
  @UseGuards(BotAuthGuard)
  @OnRouteError({
    event: 'user.controller.get_top_tracks_failed',
    message: 'Unknown Error',
  })
  getTopTracks(
    @ContractInput(contract.getTopTracks, 'Invalid user id or period')
    input: ContractInputValue<typeof contract.getTopTracks>,
  ): ReturnType<UserService['getTopTracks']> {
    return this.userService.getTopTracks(input.params.id, input.params.period);
  }

  private requireUser(user: DiscordUser | undefined): DiscordUser {
    if (!user) {
      throw new HttpException(
        'Internal Server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return user;
  }
}

export default UserController;
