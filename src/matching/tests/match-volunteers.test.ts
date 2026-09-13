import { describe, expect, it } from 'vitest';
import { matchVolunteers } from '../scoring/match-volunteers.js';
import { volunteers } from '../fixtures/volunteers.js';
import {
  askMeAnythingRequest,
  teachMeSomethingRequest,
  reviewMyWorkRequest,
} from '../fixtures/requests.js';
import type { MatchRequest, VolunteerCandidate } from '../types/volunteer.js';

describe('matchVolunteers', () => {
  it('ranks the best expertise match first', () => {
    const results = matchVolunteers(teachMeSomethingRequest, volunteers);
    expect(results[0]!.volunteerId).toBe('vol-alice');
    expect(results[0]!.reasons.some((r) => r.includes('cybersecurity'))).toBe(
      true,
    );
  });

  it('excludes candidates that do not support the requested service', () => {
    const results = matchVolunteers(teachMeSomethingRequest, volunteers);
    expect(results.some((r) => r.volunteerId === 'vol-devi')).toBe(false);
  });

  it('excludes an unverified volunteer', () => {
    const results = matchVolunteers(teachMeSomethingRequest, volunteers);
    expect(results.some((r) => r.volunteerId === 'vol-chen')).toBe(false);
  });

  it('excludes a volunteer with insufficient time overlap', () => {
    const results = matchVolunteers(teachMeSomethingRequest, volunteers);
    expect(results.some((r) => r.volunteerId === 'vol-ivan')).toBe(false);
    expect(results.some((r) => r.volunteerId === 'vol-farah')).toBe(false);
  });

  it('does not require overlap for an async review_my_work request', () => {
    const results = matchVolunteers(reviewMyWorkRequest, volunteers);
    const devi = results.find((r) => r.volunteerId === 'vol-devi');
    expect(devi).toBeDefined();
    expect(devi?.compatibleWindows).toEqual([]);
  });

  it('lets language overlap affect the score', () => {
    const base: MatchRequest = {
      ...askMeAnythingRequest,
      accessPreferences: [],
    };
    const candidate: VolunteerCandidate = {
      volunteerId: 'vol-x',
      supportedServices: ['ask_me_anything'],
      expertiseTags: ['cybersecurity'],
      industryTags: ['technology'],
      languages: ['mandarin'],
      availableWindows: [],
      supportedModes: ['async'],
      supportedAccessPreferences: [],
      livedExperienceTags: [],
      remainingWeeklyMinutes: 60,
      verified: true,
    };
    const withoutLanguage = matchVolunteers(base, [candidate])[0]!;
    const withLanguage = matchVolunteers(base, [
      { ...candidate, languages: ['english'] },
    ])[0]!;
    expect(withLanguage.score).toBeGreaterThan(withoutLanguage.score);
  });

  it('lets access requirement compatibility affect eligibility and score', () => {
    const request: MatchRequest = {
      ...askMeAnythingRequest,
      accessPreferences: ['written_instructions'],
    };
    const candidate: VolunteerCandidate = {
      volunteerId: 'vol-y',
      supportedServices: ['ask_me_anything'],
      expertiseTags: ['cybersecurity'],
      industryTags: ['technology'],
      languages: ['english'],
      availableWindows: [],
      supportedModes: ['async'],
      supportedAccessPreferences: [],
      livedExperienceTags: [],
      remainingWeeklyMinutes: 60,
      verified: true,
    };
    // No overlap at all on a declared access requirement: hard-filtered out.
    expect(matchVolunteers(request, [candidate])).toEqual([]);

    // Full support: scores the full access weight.
    const supported = {
      ...candidate,
      supportedAccessPreferences: ['written_instructions'],
    };
    const results = matchVolunteers(request, [supported]);
    expect(
      results[0]!.reasons.some((r) => r.includes('written_instructions')),
    ).toBe(true);
  });

  it('breaks ties deterministically by ascending volunteerId', () => {
    const identical = (id: string): VolunteerCandidate => ({
      volunteerId: id,
      supportedServices: ['ask_me_anything'],
      expertiseTags: ['cybersecurity'],
      industryTags: ['technology'],
      languages: ['english'],
      availableWindows: [],
      supportedModes: ['async'],
      supportedAccessPreferences: [],
      livedExperienceTags: [],
      remainingWeeklyMinutes: 60,
      verified: true,
    });
    const request: MatchRequest = {
      ...askMeAnythingRequest,
      accessPreferences: [],
      livedExperiencePreferences: [],
    };
    const results = matchVolunteers(request, [
      identical('vol-zeta'),
      identical('vol-aardvark'),
    ]);
    expect(results.map((r) => r.volunteerId)).toEqual([
      'vol-aardvark',
      'vol-zeta',
    ]);
  });

  it('returns at most 5 candidates by default, or options.limit', () => {
    const results = matchVolunteers(askMeAnythingRequest, volunteers);
    expect(results.length).toBeLessThanOrEqual(5);

    const limited = matchVolunteers(askMeAnythingRequest, volunteers, {
      limit: 1,
    });
    expect(limited.length).toBeLessThanOrEqual(1);
  });
});
