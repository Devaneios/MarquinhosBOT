import { z } from 'zod';
import { defineContract } from '../contract';

export const health = defineContract({
  method: 'GET',
  path: '/api/health',
  response: z.object({ status: z.literal('ok') }),
});
