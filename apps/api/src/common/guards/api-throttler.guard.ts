import { type ExecutionContext, Injectable } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BotAuthGuard } from 'common/guards/bot-auth.guard';
import { SharedBucketThrottlerGuard } from 'common/guards/shared-bucket-throttler.guard';

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(
    context: ExecutionContext,
  ): Promise<boolean> {
    if (await super.shouldSkip(context)) return true;
    const guards =
      this.reflector.getAllAndOverride<unknown[]>(GUARDS_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (
      guards.some(
        (guard) =>
          guard === BotAuthGuard || guard === SharedBucketThrottlerGuard,
      )
    ) {
      return true;
    }
    const req = context
      .switchToHttp()
      .getRequest<{ path?: string; url?: string }>();
    const path = req.path ?? req.url ?? '';
    return path === '/api/health' || path === '/health';
  }
}
