import 'dotenv/config';
import { z } from 'zod';
const configSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_MODE: z.enum(['local', 'supabase']).default('local'),
    LOCAL_DATABASE_PATH: z.string().min(1).default('.data/postgres'),
    DEMO_AUTH_MODE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    SUPABASE_DB_URL: z.string().optional(),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_DB_CA_PATH: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    if (
      v.NODE_ENV === 'production' &&
      (v.DEMO_AUTH_MODE || v.DATABASE_MODE === 'local')
    )
      issue('Production requires Supabase mode and DEMO_AUTH_MODE=false');
    if (v.DATABASE_MODE === 'supabase' && !v.SUPABASE_DB_URL)
      issue('SUPABASE_DB_URL is required for Supabase persistence');
    if (!v.DEMO_AUTH_MODE && (!v.SUPABASE_URL || !v.SUPABASE_SERVICE_ROLE_KEY))
      issue(
        'Supabase URL and server-side service role key are required for bearer authentication',
      );
  });
export type Config = z.output<typeof configSchema>;
export const readConfig = () => configSchema.parse(process.env);
