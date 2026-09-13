import { createClient } from '@supabase/supabase-js';
import type { User } from '../domain/entities.js';
import { fail } from '../domain/errors.js';
import type { Repository } from '../repositories/interfaces.js';
export type Headers = Record<string, string | string[] | undefined>;
export interface AuthAdapter {
  authenticate(headers: Headers): Promise<User>;
}
export function supabaseAuth(
  repository: Repository,
  url: string,
  key: string,
): AuthAdapter {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async authenticate(headers) {
      const authorization = headers.authorization;
      if (
        typeof authorization !== 'string' ||
        !authorization.startsWith('Bearer ')
      )
        fail('UNAUTHENTICATED', 'A bearer token is required', 401);
      const { data, error } = await client.auth.getUser(authorization.slice(7));
      if (error || !data.user)
        fail('UNAUTHENTICATED', 'Invalid or expired bearer token', 401);
      const user = await repository.get('users', data.user.id);
      if (!user)
        fail(
          'FORBIDDEN',
          'This account has not been provisioned for the platform',
          403,
        );
      return user;
    },
  };
}
