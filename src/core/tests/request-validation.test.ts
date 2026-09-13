import { describe, expect, it } from 'vitest';
import { requestSchema } from '../validation/requests.js';
import { ama, review, teaching } from './fixtures.js';
describe('participant service validation', () => {
  it.each([ama, teaching, review])('accepts $service_type', (input) => {
    expect(requestSchema.safeParse(input).success).toBe(true);
  });
  it.each([
    [ama, 4],
    [ama, 11],
    [teaching, 19],
    [teaching, 31],
    [review, 9],
    [review, 16],
  ])('rejects invalid service duration', (input, duration) => {
    expect(
      requestSchema.safeParse({
        ...(input as object),
        duration_minutes: duration,
      }).success,
    ).toBe(false);
  });
  it('rejects career_story as a participant request', () => {
    expect(
      requestSchema.safeParse({ ...ama, service_type: 'career_story' }).success,
    ).toBe(false);
  });
  it('requires a text artifact or URL', () => {
    expect(
      requestSchema.safeParse({ ...review, artifact_text: null }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({
        ...review,
        artifact_text: null,
        artifact_url: 'https://example.com/work',
      }).success,
    ).toBe(true);
  });
  it('rejects blank artifacts, unsupported protocols and raw upload fields', () => {
    for (const patch of [
      { artifact_text: ' ' },
      { artifact_url: 'file:///private/work' },
      { artifact_url: 'javascript:alert(1)' },
      { file: 'raw-content' },
    ])
      expect(requestSchema.safeParse({ ...review, ...patch }).success).toBe(
        false,
      );
  });
  it('allows async requests without availability', () => {
    expect(requestSchema.parse(ama).availability_windows).toEqual([]);
    expect(requestSchema.parse(review).preferred_mode).toBe('async');
  });
  it('requires sufficient live availability', () => {
    expect(
      requestSchema.safeParse({ ...teaching, availability_windows: [] })
        .success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({
        ...teaching,
        availability_windows: [
          { start: '2030-01-07T02:00:00Z', end: '2030-01-07T02:10:00Z' },
        ],
      }).success,
    ).toBe(false);
  });
  it('requires teaching to be live with prior knowledge and a goal', () => {
    expect(
      requestSchema.safeParse({ ...teaching, preferred_mode: 'async' }).success,
    ).toBe(false);
    expect(
      requestSchema.safeParse({ ...teaching, desired_outcome: null }).success,
    ).toBe(false);
  });
  it('normalizes timestamps to UTC and rejects timezone-less or reversed windows', () => {
    expect(requestSchema.parse(teaching).availability_windows[0]!.start).toBe(
      '2030-01-07T02:00:00.000Z',
    );
    for (const start of ['2030-01-07T10:00:00', '2030-01-08T10:00:00Z'])
      expect(
        requestSchema.safeParse({
          ...teaching,
          availability_windows: [{ start, end: '2030-01-07T11:00:00+08:00' }],
        }).success,
      ).toBe(false);
  });
  it('rejects role injection and medical data fields', () => {
    expect(
      requestSchema.safeParse({
        ...ama,
        participant_id: 'spoofed',
        diagnosis: 'private',
      }).success,
    ).toBe(false);
  });
});
