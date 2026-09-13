import { describe, expect, it } from 'vitest';
import { offerSchema } from '../validation/offers.js';
import { offer } from './fixtures.js';
describe('career-story rules', () => {
  it('accepts a 15-minute live offer', () => {
    expect(offerSchema.parse(offer).service_type).toBe('career_story');
  });
  it.each([
    { capacity: 0 },
    { capacity: -1 },
    { capacity: 1.5 },
    { mode: 'async' },
    { service_type: 'ask_me_anything' },
    { ends_at: '2030-01-09T10:30:00+08:00' },
    { status: 'full' },
  ])('rejects invalid offer %j', (patch) => {
    expect(offerSchema.safeParse({ ...offer, ...patch }).success).toBe(false);
  });
});
