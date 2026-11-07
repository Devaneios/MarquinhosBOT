import {
  HttpException,
  HttpStatus,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';

@Injectable()
export class SharedBucketThrottlerGuard extends ThrottlerGuard {
  protected override headerPrefix = 'RateLimit';

  protected override generateKey(
    _context: ExecutionContext,
    tracker: string,
    name: string,
  ): string {
    return `${name}-${tracker}`;
  }

  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const { res } = this.getRequestResponse(context);
    this.setResponseHeader(res, 'RateLimit-Limit', detail.limit);
    this.setResponseHeader(res, 'RateLimit-Remaining', 0);
    this.setResponseHeader(res, 'RateLimit-Reset', detail.timeToExpire);
    throw new HttpException(
      { message: 'Too many requests, please try again later.' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
