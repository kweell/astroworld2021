import { fail, requireFound } from '../domain/errors.js';
import type { VolunteerCandidate } from '../domain/types.js';
import type { Context } from './context.js';
import {
  busyWindows,
  unreservedWindows,
  usedWeeklyMinutes,
} from './booking-rules.js';
export function candidateServices(ctx: Context) {
  return {
    async getMatchingCandidates(
      requestId: string,
    ): Promise<VolunteerCandidate[]> {
      const request = requireFound(
        await ctx.db.get('service_requests', requestId),
        'Request',
      );
      if (!['open', 'matched'].includes(request.status))
        fail(
          'INVALID_TRANSITION',
          'Candidates are available only for open or matched requests',
        );
      const instants = request.availability_windows.map((w) => w.start);
      if (
        !instants.length ||
        ['async', 'either'].includes(request.preferred_mode)
      )
        instants.push(ctx.now().toISOString());
      const candidates: VolunteerCandidate[] = [];
      for (const profile of await ctx.db.list('volunteer_profiles')) {
        const used = await Promise.all(
          instants.map((instant) =>
            usedWeeklyMinutes(ctx.db, profile.user_id, instant),
          ),
        );
        candidates.push({
          volunteerId: profile.user_id,
          supportedServices: profile.supported_services,
          expertiseTags: profile.expertise_tags,
          industryTags: profile.industry_tags,
          languages: profile.languages,
          availableWindows: unreservedWindows(
            profile.available_windows,
            await busyWindows(ctx.db, profile.user_id),
          ),
          supportedModes: profile.supported_modes,
          supportedAccessPreferences: profile.supported_access_preferences,
          livedExperienceTags: profile.lived_experience_tags,
          remainingWeeklyMinutes: Math.max(
            0,
            profile.max_weekly_minutes - Math.max(...used),
          ),
          verified: profile.verification_status === 'verified',
        });
      }
      return candidates;
    },
  };
}
