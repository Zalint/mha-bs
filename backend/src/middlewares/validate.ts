import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Wrap d'un schéma Zod pour valider body/query/params.
 * En cas d'échec, la ZodError remonte au errorHandler qui renverra un 422 structuré.
 */
type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(result.error);
    }
    // Remplace par la valeur parsée (types narrowed)
    Object.assign(req, { [source]: result.data });
    next();
  };
}
