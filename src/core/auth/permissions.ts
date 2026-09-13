import type { User } from '../domain/entities.js';
import { fail } from '../domain/errors.js';
import type { UserRole } from '../domain/types.js';
export const isOperator = (actor: User) =>
  ['admin', 'facilitator'].includes(actor.role);
export function requireRole(actor: User, ...roles: UserRole[]): void {
  if (!roles.includes(actor.role))
    fail('FORBIDDEN', 'This account cannot perform that action', 403);
}
export function requireOwner(actor: User, ownerId: string): void {
  if (actor.id !== ownerId && actor.role !== 'admin')
    fail(
      'FORBIDDEN',
      'Only the owner or an administrator may change this resource',
      403,
    );
}
