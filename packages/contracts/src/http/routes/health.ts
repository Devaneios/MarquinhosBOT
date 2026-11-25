import { z } from 'zod';
import { defineContract } from '../contract';

export const health = defineContract({
  method: 'GET',
  path: '/api/health',
  response: z.object({ status: z.literal('ok') }),
  docs: {
    description:
      'Check API readiness by probing configured PostgreSQL and Redis connections. Both dependencies must be available in production.',
    tags: ['Operations'],
    security: [],
    success: {
      200: {
        description: 'All required dependencies are reachable.',
        example: { status: 'ok' },
      },
    },
    errors: {
      503: {
        description:
          'A required dependency is absent, failed its probe, or timed out.',
        schema: z.object({ status: z.literal('error') }),
        example: { status: 'error' },
      },
    },
  },
});
