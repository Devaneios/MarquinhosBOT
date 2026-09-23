import type {
  ContractParsedRequest,
  ContractResponseInput,
  EndpointContract,
} from '@marquinhos/contracts/http/contract';
import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

type ContractPart = 'params' | 'query' | 'body';

const PARTS: ContractPart[] = ['params', 'query', 'body'];

function partIssues(
  contract: EndpointContract,
  req: Request,
): {
  parsed: Partial<Record<ContractPart, unknown>>;
  issues: z.core.$ZodIssue[];
} {
  const parsed: Partial<Record<ContractPart, unknown>> = {};
  const issues: z.core.$ZodIssue[] = [];
  for (const part of PARTS) {
    const schema = contract[part];
    if (!schema) continue;
    const result = schema.safeParse(req[part]);
    if (result.success) {
      parsed[part] = result.data;
    } else {
      issues.push(
        ...result.error.issues.map((issue) => ({
          ...issue,
          path: [part, ...issue.path],
        })),
      );
    }
  }
  return { parsed, issues };
}

export function parseRequest<C extends EndpointContract>(
  contract: C,
  req: Request,
): ContractParsedRequest<C> | null;
export function parseRequest(
  contract: EndpointContract,
  req: Request,
): Partial<Record<ContractPart, unknown>> | null {
  const { parsed, issues } = partIssues(contract, req);
  return issues.length === 0 ? parsed : null;
}

export function validateContract(contract: EndpointContract) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { issues } = partIssues(contract, req);
    if (issues.length === 0) return next();
    return res.status(400).json({
      message: 'Validation failed',
      errors: issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  };
}

export function sendContract<C extends EndpointContract>(
  res: Response,
  _contract: C,
  body: ContractResponseInput<C>,
  status = 200,
) {
  return res.status(status).json(body);
}
