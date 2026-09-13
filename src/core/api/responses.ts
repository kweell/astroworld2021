export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } };
export const success = <T>(data: T): ApiResponse<T> => ({ data, error: null });
export const failure = (code: string, message: string): ApiResponse<never> => ({
  data: null,
  error: { code, message },
});
