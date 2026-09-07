import type { NextFunction, Request, Response } from 'express';
import type { Schema } from 'zod';
import { ZodError } from 'zod';

export const validateRequest =
  (schema: Schema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: error.issues.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  };
