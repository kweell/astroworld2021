import { z } from 'zod';
import type { NotificationItem, User } from '../domain/entities.js';
import { overlappingTopics } from '../domain/interests.js';
import { fail, requireFound } from '../domain/errors.js';
import { requireRole } from '../auth/permissions.js';
import type { Context } from './context.js';

export function notificationServices(ctx: Context) {
  return {
    async listNotifications(actor: User) {
      requireRole(actor, 'volunteer');
      const notifications = await ctx.db.list('notifications', {
        recipient_id: actor.id,
      });
      const profile = requireFound(
        await ctx.db.get('volunteer_profiles', actor.id),
        'Volunteer profile',
      );
      const visible: NotificationItem[] = [];
      for (const notification of notifications) {
        const request = await ctx.db.get(
          'service_requests',
          notification.request_id,
        );
        const match = await ctx.db.get('matches', notification.match_id);
        if (
          !request ||
          !match ||
          match.status !== 'suggested' ||
          !['open', 'matched'].includes(request.status) ||
          (request.deadline &&
            Date.parse(request.deadline) <= ctx.now().getTime())
        )
          continue;
        const topics = overlappingTopics(
          request.topic_tags,
          profile.expertise_tags,
        );
        if (!topics.length || profile.verification_status !== 'verified')
          continue;
        visible.push({
          ...notification,
          request_title: request.title,
          service_type: request.service_type,
          matching_topics: topics,
          duration_minutes: request.duration_minutes,
        });
      }
      return visible.sort(
        (a, b) =>
          b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
      );
    },
    async readNotification(actor: User, id: string, input: unknown) {
      requireRole(actor, 'volunteer');
      z.strictObject({ read: z.literal(true) }).parse(input);
      return ctx.db.transaction(async (repo) => {
        const notification = requireFound(
          await repo.get('notifications', id),
          'Notification',
        );
        if (notification.recipient_id !== actor.id)
          fail(
            'FORBIDDEN',
            'This notification belongs to another volunteer',
            403,
          );
        return repo.update('notifications', id, {
          read_at: notification.read_at ?? ctx.now().toISOString(),
        });
      });
    },
  };
}
