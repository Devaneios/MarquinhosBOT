import type { ContractResponseInput } from '@marquinhos/contracts/http/contract';
import * as contract from '@marquinhos/contracts/http/routes/maze';
import {
  MAZE_DIRECTIONS,
  MAZE_MODES,
  MAZE_SIZES,
} from '@marquinhos/contracts/http/routes/maze';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { BotAuth } from 'common/decorators/auth.decorators';
import { OnRouteError } from 'common/decorators/on-route-error.decorator';
import { MazeService } from 'modules/maze/maze.service';

@Controller('games/maze')
@BotAuth()
export class MazeController {
  constructor(private readonly service: MazeService) {}

  @Post('start')
  @HttpCode(200)
  @OnRouteError({
    event: 'maze.controller.start_failed',
    message: 'Unknown Error',
  })
  async startMaze(
    @Body() bodyInput: unknown,
  ): Promise<ContractResponseInput<typeof contract.startMaze>> {
    const body = contract.startMaze.body.safeParse(bodyInput);
    if (!body.success) {
      const field = body.error.issues[0]?.path[0];
      const message =
        field === 'mode'
          ? `mode must be one of: ${MAZE_MODES.join(', ')}`
          : field === 'size'
            ? `size must be one of: ${MAZE_SIZES.join(', ')}`
            : 'userId and guildId are required';
      throw new BadRequestException({ message });
    }

    const { userId, guildId, mode, size } = body.data;
    const data = await this.service.createMazeSession(
      userId,
      guildId,
      mode,
      size,
    );
    return { data };
  }

  @Post(':sessionId/move')
  @HttpCode(200)
  @OnRouteError({
    event: 'maze.controller.move_failed',
    message: 'Unknown Error',
  })
  async moveMaze(
    @Param() paramsInput: Record<string, string>,
    @Body() bodyInput: unknown,
  ): Promise<ContractResponseInput<typeof contract.moveMaze>> {
    const params = contract.getMaze.params.safeParse(paramsInput);
    if (!params.success) {
      throw new BadRequestException({ message: 'sessionId is required' });
    }
    const body = contract.moveMaze.body.safeParse(bodyInput);
    if (!body.success) {
      const message =
        body.error.issues[0]?.path[0] === 'direction'
          ? `direction must be one of: ${MAZE_DIRECTIONS.join(', ')}`
          : 'userId is required';
      throw new BadRequestException({ message });
    }

    const data = await this.service.processMazeMove(
      params.data.sessionId,
      body.data.userId,
      body.data.direction,
    );
    if (data === null) {
      throw new NotFoundException({
        message: 'Maze session not found or not active',
      });
    }
    return { data };
  }

  @Get(':sessionId')
  @OnRouteError({
    event: 'maze.controller.get_failed',
    message: 'Unknown Error',
  })
  async getMaze(
    @Param() paramsInput: Record<string, string>,
  ): Promise<ContractResponseInput<typeof contract.getMaze>> {
    const params = contract.getMaze.params.safeParse(paramsInput);
    if (!params.success) {
      throw new BadRequestException({ message: 'sessionId is required' });
    }
    const data = await this.service.getMazeSession(params.data.sessionId);
    if (data === null) {
      throw new NotFoundException({ message: 'Maze session not found' });
    }
    return { data };
  }

  @Delete(':sessionId')
  @HttpCode(200)
  @OnRouteError({
    event: 'maze.controller.abandon_failed',
    message: 'Unknown Error',
  })
  async abandonMaze(
    @Param() paramsInput: Record<string, string>,
    @Body() bodyInput: unknown,
  ): Promise<ContractResponseInput<typeof contract.abandonMaze>> {
    const params = contract.getMaze.params.safeParse(paramsInput);
    if (!params.success) {
      throw new BadRequestException({ message: 'sessionId is required' });
    }
    const body = contract.abandonMaze.body.safeParse(bodyInput);
    if (!body.success) {
      throw new BadRequestException({ message: 'userId is required' });
    }

    await this.service.abandonMazeSession(
      params.data.sessionId,
      body.data.userId,
    );
    return { message: 'Maze session abandoned' };
  }
}
