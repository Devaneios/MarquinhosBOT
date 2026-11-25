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
  docs: {
    description:
      'Read the Portuguese privacy policy as structured text for display in a client. The payload includes its update label and ordered sections.',
    tags: ['Privacy'],
    security: [],
    success: {
      200: {
        description:
          'Policy title, introductory text, update label, and sections.',
        example: {
          title: 'Política de Privacidade para MarquinhosBOT',
          date: 'Atualizado 19 de agosto de 2023',
          body: 'Esta Política de Privacidade descreve como coletamos, usamos e protegemos as suas informações pessoais em relação ao uso do nosso bot no Discord.',
          sections: [
            {
              title: '1. Coleta de Dados',
              body: 'A política descreve os dados coletados para fornecer os serviços do bot.',
            },
          ],
        },
      },
    },
    errors: {
      429: {
        description: 'The caller exceeded the public HTTP request limit.',
        example: { message: 'ThrottlerException: Too Many Requests' },
      },
      500: {
        description: 'The API could not serve the policy.',
        example: { message: 'Internal Server Error' },
      },
    },
  },
});
