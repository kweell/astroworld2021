// Stable choices shared by the forms and API. Custom interests remain supported.
export const TOPICS = [
  'accounting',
  'career planning',
  'cybersecurity',
  'data analysis',
  'digital marketing',
  'excel',
  'graphic design',
  'healthcare careers',
  'illustration',
  'interview preparation',
  'javascript',
  'personal finance',
  'portfolio',
  'public speaking',
  'python',
  'resume',
  'study skills',
  'supply chain',
  'time management',
  'ux',
  'web development',
  'writing',
] as const;
export const INDUSTRIES = [
  'arts',
  'business',
  'design',
  'education',
  'engineering',
  'finance',
  'healthcare',
  'hospitality',
  'logistics',
  'manufacturing',
  'marketing',
  'media',
  'public service',
  'retail',
  'social services',
  'technology',
] as const;
export const normalizeInterest = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLowerCase();
export function validInterest(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 80 &&
    /[\p{L}\p{N}]/u.test(value) &&
    !/[<>,]/u.test(value) &&
    !Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    !['other', 'others'].includes(normalizeInterest(value))
  );
}
export function overlappingTopics(
  topics: string[],
  expertise: string[],
): string[] {
  const known = new Set(expertise.map(normalizeInterest));
  return [...new Set(topics.map(normalizeInterest))].filter((topic) =>
    known.has(topic),
  );
}
