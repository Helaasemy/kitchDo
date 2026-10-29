import { en, type KitchenMode, type Strings, tone } from './en';

export { en, tone };
export type { KitchenMode, Strings };

/** Centralised copy — swap locale modules here later. */
export function t(): Strings {
  return en;
}
