import { describe, expect, it } from 'vitest';
import { useTestDatabase, demoIds, resultFor } from './fixtures.js';
describe('feedback lifecycle', () => {
  const t = useTestDatabase();
  it('allows each engagement member to submit once, only after completion', async () => {
    const match = (
      await t.core.saveMatches(demoIds.requests[0]!, [
        resultFor(t.volunteer.id),
      ])
    )[0]!;
    const engagement = await t.core.createEngagement(t.volunteer, {
      match_id: match.id,
    });
    const input = {
      engagement_id: engagement.id,
      helpful: true,
      rating: 5,
      follow_up_requested: true,
    };
    await expect(
      t.core.createFeedback(t.participant, input),
    ).rejects.toMatchObject({ code: 'ENGAGEMENT_NOT_COMPLETED' });
    await t.core.updateEngagement(t.participant, engagement.id, {
      status: 'completed',
    });
    expect((await t.core.getRequest(match.request_id)).status).toBe(
      'completed',
    );
    await expect(
      t.core.createFeedback(t.otherParticipant, input),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const feedback = await t.core.createFeedback(t.participant, input);
    expect(feedback.submitted_by).toBe(t.participant.id);
    await expect(
      t.core.createFeedback(t.participant, input),
    ).rejects.toMatchObject({ code: 'DUPLICATE_FEEDBACK' });
    expect(
      (await t.core.createFeedback(t.volunteer, { ...input, rating: null }))
        .rating,
    ).toBeNull();
    await expect(
      t.core.createFeedback(t.volunteer, { ...input, rating: 6 }),
    ).rejects.toThrow();
  });
});
