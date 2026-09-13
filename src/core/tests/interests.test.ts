import { describe, expect, it } from 'vitest';
import { interestTags } from '../validation/common.js';
import { overlappingTopics } from '../domain/interests.js';
import {
  participantProfileSchema,
  volunteerProfileSchema,
} from '../validation/profiles.js';
import { readInterests } from '../../../web/src/interest-values.js';

describe('topic and industry selection validation', () => {
  it('normalizes, deduplicates, and supports custom topics on both profiles', () => {
    const topics = [' Python ', 'python', '  Quantum   robotics '];
    expect(interestTags.parse(topics)).toEqual(['python', 'quantum robotics']);
    expect(
      participantProfileSchema.parse({ topic_interests: topics })
        .topic_interests,
    ).toEqual(['python', 'quantum robotics']);
    expect(
      volunteerProfileSchema.parse({ expertise_tags: topics }).expertise_tags,
    ).toEqual(['python', 'quantum robotics']);
    expect(
      overlappingTopics(['QUANTUM ROBOTICS'], ['quantum   robotics']),
    ).toEqual(['quantum robotics']);
  });
  it('includes typed Others values on save, even if Add was not clicked', () => {
    const data = new FormData();
    data.append('topics', 'python');
    data.append('topics_custom', 'Robotics');
    expect(readInterests(data, 'topics', true)).toEqual(['python', 'robotics']);
  });
  it('rejects blank and placeholder custom values, requires a request topic, and limits length', () => {
    expect(() => readInterests(new FormData(), 'topics', true)).toThrow(
      'at least one topic',
    );
    for (const value of ['', '   ', 'Others', '<script>', 'x'.repeat(81)]) {
      const data = new FormData();
      data.append('topics_custom', value);
      expect(() => readInterests(data, 'topics', true)).toThrow();
      expect(interestTags.safeParse([value]).success).toBe(false);
    }
    expect(readInterests(new FormData(), 'industries')).toEqual([]);
    expect(interestTags.parse(['C++', '.NET', '设计'])).toEqual([
      'c++',
      '.net',
      '设计',
    ]);
  });
});
