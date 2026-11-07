import type {
  ContractParsedRequest,
  EndpointContract,
} from '@marquinhos/contracts/http/contract';
import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { Request } from 'express';

type Part = 'params' | 'query' | 'body';
const PARTS: Part[] = ['params', 'query', 'body'];

export class ContractPipe<C extends EndpointContract> implements PipeTransform<
  Request,
  ContractParsedRequest<C>
> {
  constructor(
    private readonly contract: C,
    private readonly failureMessage?: string,
  ) {}

  transform(req: Request): ContractParsedRequest<C> {
    const parsed: Partial<Record<Part, unknown>> = {};
    const errors: { path: string; message: string }[] = [];
    for (const part of PARTS) {
      const schema = this.contract[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) parsed[part] = result.data;
      else {
        errors.push(
          ...result.error.issues.map((issue) => ({
            path: [part, ...issue.path].join('.'),
            message: issue.message,
          })),
        );
      }
    }
    if (errors.length === 0) return parsed as ContractParsedRequest<C>;
    throw new BadRequestException(
      this.failureMessage
        ? { message: this.failureMessage }
        : { message: 'Validation failed', errors },
    );
  }
}
