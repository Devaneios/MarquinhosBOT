import type {
  ContractParsedRequest,
  EndpointContract,
} from '@marquinhos/contracts/http/contract';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { ContractPipe } from 'common/pipes/contract.pipe';
import type { Request } from 'express';

const RawRequest = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<Request>(),
);

export function ContractInput<C extends EndpointContract>(
  contract: C,
  failureMessage?: string,
) {
  return RawRequest(undefined, new ContractPipe(contract, failureMessage));
}

export type ContractInputValue<C extends EndpointContract> =
  ContractParsedRequest<C>;
