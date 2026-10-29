export { AUTH_CALLBACK_URL, getSupabase, type KdoClient } from './client';
export { isMissingRpcError, rpcErrorMessage } from './errors';
export {
  readSupabaseConfig,
  tryReadSupabaseConfig,
  SupabaseConfigError,
  type SupabasePublicConfig,
} from './config';
