/** Normalize Supabase / PostgREST errors into a short user-facing string. */
export function rpcErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: string }).message ?? '').trim();
    if (msg) return msg;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: string }).code ?? '')
    : '';
}

/** PostgREST / schema-cache miss when an RPC is not deployed yet. */
export function isMissingRpcError(error: unknown): boolean {
  const code = errorCode(error);
  if (code === 'PGRST202' || code === '42883') return true;
  const msg = rpcErrorMessage(error, '').toLowerCase();
  return (
    msg.includes('could not find the function') ||
    (msg.includes('function public.') && msg.includes('does not exist'))
  );
}

/** PostgREST / Postgres miss when a newly added column is not in the schema cache. */
export function isMissingColumnError(error: unknown): boolean {
  const code = errorCode(error);
  if (code === 'PGRST204' || code === '42703') return true;
  const msg = rpcErrorMessage(error, '').toLowerCase();
  return (
    msg.includes('schema cache') ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}
