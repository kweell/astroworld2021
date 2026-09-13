import { z } from 'zod';
import { idSchema } from '../../validation/common.js';
export function routeId(params: unknown, key = 'id'): string {
  return (
    z.record(z.string(), idSchema).parse(params)[key] ??
    idSchema.parse(undefined)
  );
}
