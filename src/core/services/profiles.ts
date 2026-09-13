import type { User } from '../domain/entities.js';
import { fail, requireFound } from '../domain/errors.js';
import { requireOwner } from '../auth/permissions.js';
import {
  participantProfileSchema,
  profilePatchSchema,
  volunteerProfileSchema,
} from '../validation/profiles.js';
import type { Context } from './context.js';
import { isEngagementMember } from './booking-rules.js';
export function profileServices(ctx: Context) {
  return {
    async getProfile(actor: User, userId: string) {
      const user = requireFound(await ctx.db.get('users', userId), 'User');
      const related = (await ctx.db.list('engagements')).some(
        (e) =>
          e.status !== 'cancelled' &&
          isEngagementMember(actor.id, e) &&
          isEngagementMember(userId, e),
      );
      const own = actor.id === userId;
      const { email, ...publicUser } = user;
      const visibleUser =
        own || related ? { ...publicUser, email } : publicUser;
      // Practical support preferences and time constraints stay private to the owner.
      if (user.role === 'participant')
        return {
          user: visibleUser,
          profile: own
            ? await ctx.db.get('participant_profiles', userId)
            : null,
        };
      const profile =
        user.role === 'volunteer'
          ? await ctx.db.get('volunteer_profiles', userId)
          : null;
      return { user: visibleUser, profile };
    },
    async updateProfile(actor: User, userId: string, input: unknown) {
      const patch = profilePatchSchema.parse(input);
      requireOwner(actor, userId);
      if (patch.verification_status !== undefined && actor.role !== 'admin')
        fail('FORBIDDEN', 'Only an administrator can verify volunteers', 403);
      return ctx.db.transaction(async (repo) => {
        const user = requireFound(await repo.get('users', userId), 'User');
        const { display_name, ...profilePatch } = patch;
        if (user.role === 'participant') {
          const existing = requireFound(
            await repo.get('participant_profiles', userId),
            'Participant profile',
          );
          const { user_id: _, ...fields } = existing;
          const data = participantProfileSchema.parse({
            ...fields,
            ...profilePatch,
          });
          await repo.update('participant_profiles', userId, data);
        } else if (user.role === 'volunteer') {
          const existing = requireFound(
            await repo.get('volunteer_profiles', userId),
            'Volunteer profile',
          );
          const { user_id: _, ...fields } = existing;
          const data = volunteerProfileSchema.parse({
            ...fields,
            ...profilePatch,
          });
          await repo.update('volunteer_profiles', userId, data);
        } else if (Object.keys(profilePatch).length)
          fail(
            'VALIDATION_ERROR',
            'This role has no participant or volunteer profile',
            400,
          );
        if (display_name) await repo.update('users', userId, { display_name });
        return { user_id: userId, updated: true };
      });
    },
  };
}
