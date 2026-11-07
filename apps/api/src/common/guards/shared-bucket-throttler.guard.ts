import {
  HttpException,
  HttpStatus,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

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

  protected override async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      { message: 'Too many requests, please try again later.' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
