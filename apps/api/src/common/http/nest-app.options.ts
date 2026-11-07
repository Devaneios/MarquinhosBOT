import type { NestApplicationOptions } from '@nestjs/common';

export const NEST_APP_OPTIONS = {
  bufferLogs: true,
  bodyParser: false,
  routeResolutionStrategy: 'specificity',
  routeConflictPolicy: { duplicate: 'error', shadow: 'warn' },
} satisfies NestApplicationOptions;
