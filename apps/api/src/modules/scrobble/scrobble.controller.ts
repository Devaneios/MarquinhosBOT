import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/scrobble';
import { Controller, Delete, HttpCode, Post, UseGuards } from '@nestjs/common';
import type { ContractInputValue } from 'common/decorators/contract-input.decorator';
import { ContractInput } from 'common/decorators/contract-input.decorator';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { ScrobblerService } from 'modules/scrobble/scrobbler.service';

@Controller('scrobble')
export class ScrobbleController {
  constructor(private readonly scrobblerService: ScrobblerService) {}

  @Post('queue')
  @HttpCode(200)
  @UseGuards(BotAuthGuard)
  @OnRouteError({
    event: 'scrobble.controller.add_scrobble_to_queue_failed',
    message: 'Unknown Error',
  })
  async addScrobbleToQueue(
    @ContractInput(contract.addToQueue)
    input: ContractInputValue<typeof contract.addToQueue>,
  ): Promise<ContractResponseInput<typeof contract.addToQueue>> {
    const data = await this.scrobblerService.addScrobbleToQueue(
      input.body.playbackData,
    );
    return { data, message: 'Scrobble added to queue' };
  }

  @Post(':id')
  @HttpCode(200)
  @UseGuards(BotAuthGuard)
  @OnRouteError({
    event: 'scrobble.controller.dispatch_scrobble_failed',
    message: 'Unknown Error',
  })
  async dispatchScrobble(
    @ContractInput(contract.dispatch, 'id is required')
    input: ContractInputValue<typeof contract.dispatch>,
  ): Promise<ContractResponseInput<typeof contract.dispatch>> {
    const id = await this.scrobblerService.dispatchScrobble(input.params.id);
    return { data: id, message: 'Scrobbled' };
  }

  @Delete(':scrobbleId/:userId')
  @UseGuards(BotAuthGuard)
  @OnRouteError({
    event: 'scrobble.controller.remove_user_from_scrobble_failed',
    message: 'Unknown Error',
  })
  async removeUserFromScrobble(
    @ContractInput(contract.removeUser, 'scrobbleId and userId are required')
    input: ContractInputValue<typeof contract.removeUser>,
  ): Promise<ContractResponseInput<typeof contract.removeUser>> {
    const id = await this.scrobblerService.removeUserFromScrobble(
      input.params.scrobbleId,
      input.params.userId,
    );
    return { data: id, message: 'User removed' };
  }

  @Post(':scrobbleId/:userId')
  @HttpCode(200)
  @UseGuards(BotAuthGuard)
  @OnRouteError({
    event: 'scrobble.controller.add_user_to_scrobble_failed',
    message: 'Unknown Error',
  })
  async addUserToScrobble(
    @ContractInput(contract.addUser, 'scrobbleId and userId are required')
    input: ContractInputValue<typeof contract.addUser>,
  ): Promise<ContractResponseInput<typeof contract.addUser>> {
    const id = await this.scrobblerService.addUserToScrobble(
      input.params.scrobbleId,
      input.params.userId,
    );
    return { data: id, message: 'User added' };
  }
}

export default ScrobbleController;
