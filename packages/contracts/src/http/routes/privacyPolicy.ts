import { z } from 'zod';
import { defineContract } from '../contract';

const titledTextSchema = z.object({ title: z.string(), body: z.string() });

export const privacyPolicy = defineContract({
  method: 'GET',
  path: '/api/privacy-policy',
  response: titledTextSchema.extend({
    date: z.string(),
    sections: z.array(titledTextSchema),
  }),
});
