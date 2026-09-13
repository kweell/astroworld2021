import {
  normalizeInterest,
  validInterest,
} from '../../src/core/domain/interests.js';

export function readInterests(
  data: FormData,
  name: string,
  required = false,
): string[] {
  const values = data.getAll(name).map(String);
  const custom = data.get(`${name}_custom`);
  if (custom !== null) values.push(String(custom));
  const normalized = [...new Set(values.map(normalizeInterest))];
  if (required && !normalized.length)
    throw new Error('Choose at least one topic.');
  if (normalized.length > 30)
    throw new Error('Choose no more than 30 interests.');
  if (normalized.some((value) => !validInterest(value)))
    throw new Error(
      'Enter a topic or industry of 1–80 characters. Replace Others with the actual name; do not include markup or commas.',
    );
  return normalized;
}
