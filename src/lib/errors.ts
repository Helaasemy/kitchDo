import { t } from '@/i18n';

/** User-facing message for an unknown thrown value. */
export function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : t().common.errorGeneric;
}
