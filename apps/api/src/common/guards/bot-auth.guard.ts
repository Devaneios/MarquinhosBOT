import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AppConfig } from 'config/app.config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class BotAuthGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authorization = req.headers.authorization;
    const token = authorization && authorization.split(' ')[1];
    if (!token) throw new UnauthorizedException('Token not provided');

    const expectedKey = this.config.marquinhosApiKey;
    if (!expectedKey) {
      throw new InternalServerErrorException('Server misconfiguration');
    }

    const tokenBuf = Buffer.from(token);
    const keyBuf = Buffer.from(expectedKey);
    if (
      tokenBuf.length !== keyBuf.length ||
      !timingSafeEqual(tokenBuf, keyBuf)
    ) {
      throw new UnauthorizedException('Token not authorized');
    }

    return true;
  }
}
