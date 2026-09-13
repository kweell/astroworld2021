export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 409,
  ) {
    super(message);
  }
}
export function fail(code: string, message: string, status = 409): never {
  throw new DomainError(code, message, status);
}
export function requireFound<T>(value: T | null | undefined, name: string): T {
  if (value == null) fail('NOT_FOUND', `${name} not found`, 404);
  return value;
}
