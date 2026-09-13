import type { AuthAdapter } from './auth-adapter.js';
import type { Repository } from '../repositories/interfaces.js';
import { fail } from '../domain/errors.js';
import { idSchema } from '../validation/common.js';
export function demoAuth(
  repository: Repository,
  enabled: boolean,
  environment: string,
): AuthAdapter {
  if (!enabled || environment === 'production')
    throw new Error('Demo authentication is disabled');
  return {
    async authenticate(headers) {
      const result = idSchema.safeParse(headers['x-demo-user-id']);
      if (!result.success)
        fail(
          'UNAUTHENTICATED',
          'A valid x-demo-user-id header is required in demo mode',
          401,
        );
      const user = await repository.get('users', result.data);
      if (!user) fail('UNAUTHENTICATED', 'Unknown demo identity', 401);
      return user;
    },
  };
}
