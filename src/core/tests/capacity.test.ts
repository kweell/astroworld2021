import { describe, expect, it } from 'vitest';
import { useTestDatabase, demoIds, offer } from './fixtures.js';
describe('career-story booking transactions', () => {
  const t = useTestDatabase();
  it('concurrent participants cannot overbook the last seat', async () => {
    const outcomes = await Promise.allSettled(
      [t.participant, t.otherParticipant].map((actor) =>
        t.core.createEngagement(actor, { offer_id: demoIds.offers[0] }),
      ),
    );
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1);
    expect(
      await t.db.get('volunteer_offers', demoIds.offers[0]!),
    ).toMatchObject({ capacity: 0, status: 'full' });
    expect(
      await t.db.list('engagements', { offer_id: demoIds.offers[0]! }),
    ).toHaveLength(1);
  });
  it('cancelling a seat restores capacity exactly once', async () => {
    const engagement = await t.core.createEngagement(t.participant, {
      offer_id: demoIds.offers[0],
    });
    await t.core.updateEngagement(t.participant, engagement.id, {
      status: 'cancelled',
    });
    expect(
      await t.db.get('volunteer_offers', demoIds.offers[0]!),
    ).toMatchObject({ capacity: 1, status: 'open' });
    await expect(
      t.core.updateEngagement(t.participant, engagement.id, {
        status: 'cancelled',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(
      (
        await t.core.createEngagement(t.otherParticipant, {
          offer_id: demoIds.offers[0],
        })
      ).status,
    ).toBe('confirmed');
  });
  it('does not permit duplicate reservations', async () => {
    await t.core.createEngagement(t.participant, {
      offer_id: demoIds.offers[1],
    });
    await expect(
      t.core.createEngagement(t.participant, { offer_id: demoIds.offers[1] }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_BOOKING' });
    expect(
      (await t.db.get('volunteer_offers', demoIds.offers[1]!))!.capacity,
    ).toBe(1);
  });
  it('supports multiple participants at the same group story without double-counting volunteer minutes', async () => {
    await t.core.createEngagement(t.participant, {
      offer_id: demoIds.offers[1],
    });
    await t.core.createEngagement(t.otherParticipant, {
      offer_id: demoIds.offers[1],
    });
    expect(
      (await t.db.get('volunteer_offers', demoIds.offers[1]!))!.status,
    ).toBe('full');
  });
  it('negative capacity is rejected by Postgres', async () => {
    await expect(
      t.sql.query(
        'UPDATE micro_access.volunteer_offers SET capacity = -1 WHERE id = $1',
        [demoIds.offers[0]],
      ),
    ).rejects.toThrow();
  });
  it('booked offers cannot be rescheduled; cancellation cancels all confirmed seats', async () => {
    const engagement = await t.core.createEngagement(t.participant, {
      offer_id: demoIds.offers[0],
    });
    await expect(
      t.core.updateOffer(t.volunteer, demoIds.offers[0]!, { title: 'Changed' }),
    ).rejects.toMatchObject({ code: 'OFFER_HAS_BOOKINGS' });
    await t.core.updateOffer(t.volunteer, demoIds.offers[0]!, {
      status: 'cancelled',
    });
    expect((await t.db.get('engagements', engagement.id))!.status).toBe(
      'cancelled',
    );
    expect(
      (await t.db.get('volunteer_offers', demoIds.offers[0]!))!.status,
    ).toBe('cancelled');
  });
  it('draft offers cannot be booked until published', async () => {
    const draft = await t.core.createOffer(t.volunteer, {
      ...offer,
      status: 'draft',
    });
    await expect(
      t.core.createEngagement(t.participant, { offer_id: draft.id }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await t.core.updateOffer(t.volunteer, draft.id, { status: 'open' });
    expect(
      (await t.core.createEngagement(t.participant, { offer_id: draft.id }))
        .status,
    ).toBe('confirmed');
  });
  it('offer completion completes its confirmed engagements', async () => {
    const engagement = await t.core.createEngagement(t.participant, {
      offer_id: demoIds.offers[0],
    });
    t.now = new Date('2030-01-09T00:00:00Z');
    await t.core.updateOffer(t.volunteer, demoIds.offers[0]!, {
      status: 'completed',
    });
    expect((await t.db.get('engagements', engagement.id))!.status).toBe(
      'completed',
    );
  });
});
