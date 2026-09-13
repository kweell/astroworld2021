import { describe, expect, it } from 'vitest';
import { applyHardFilters } from '../scoring/hard-filters.js';
import { volunteers } from '../fixtures/volunteers.js';
import {
  askMeAnythingRequest,
  teachMeSomethingRequest,
} from '../fixtures/requests.js';
import type { MatchRequest, VolunteerCandidate } from '../types/volunteer.js';

function findVolunteer(id: string): VolunteerCandidate {
  const volunteer = volunteers.find((v) => v.volunteerId === id);
  if (!volunteer) throw new Error(`fixture missing: ${id}`);
  return volunteer;
}

describe('applyHardFilters', () => {
  it('filters out an unverified volunteer', () => {
    const result = applyHardFilters(
      teachMeSomethingRequest,
      findVolunteer('vol-chen'),
    );
    expect(result.eligible).toBe(false);
    expect(result.failureReasons).toContain('Volunteer is not verified');
  });

  it('filters out a volunteer who does not support the requested service', () => {
    const result = applyHardFilters(
      teachMeSomethingRequest,
      findVolunteer('vol-devi'),
    );
    expect(result.eligible).toBe(false);
    expect(
      result.failureReasons.some((r) => r.includes('does not support')),
    ).toBe(true);
  });

  it('filters out a volunteer without enough remaining capacity', () => {
    const result = applyHardFilters(
      askMeAnythingRequest,
      findVolunteer('vol-erin'),
    );
    expect(result.eligible).toBe(false);
    expect(result.failureReasons).toContain(
      'Volunteer does not have enough remaining capacity',
    );
  });

  it('filters out a volunteer with no sufficient live availability overlap', () => {
    const result = applyHardFilters(
      teachMeSomethingRequest,
      findVolunteer('vol-ivan'),
    );
    expect(result.eligible).toBe(false);
    expect(result.failureReasons).toContain(
      'No sufficient availability overlap for a live interaction',
    );
  });

  it('does not require availability overlap for an async request', () => {
    const result = applyHardFilters(
      askMeAnythingRequest,
      findVolunteer('vol-gopal'),
    );
    expect(result.eligible).toBe(true);
    expect(result.liveRequired).toBe(false);
  });

  it('filters out a volunteer who cannot support any declared access requirement', () => {
    const request: MatchRequest = {
      ...askMeAnythingRequest,
      accessPreferences: ['wheelchair_access'],
    };
    const result = applyHardFilters(request, findVolunteer('vol-bilal'));
    expect(result.eligible).toBe(false);
    expect(
      result.failureReasons.some((r) => r.includes('access requirements')),
    ).toBe(true);
  });

  it('does not hard-filter on partial access support, only full mismatch', () => {
    const request: MatchRequest = {
      ...askMeAnythingRequest,
      accessPreferences: ['written_instructions', 'wheelchair_access'],
    };
    // vol-gopal supports written_instructions but not wheelchair_access: partial overlap, still eligible.
    const result = applyHardFilters(request, findVolunteer('vol-gopal'));
    expect(result.eligible).toBe(true);
  });

  it('never filters on fields outside the domain contract (no such fields exist)', () => {
    const candidate = findVolunteer('vol-alice');
    expect(candidate).not.toHaveProperty('school');
    expect(candidate).not.toHaveProperty('gpa');
    expect(candidate).not.toHaveProperty('disability');
    expect(candidate).not.toHaveProperty('income');
  });
});
