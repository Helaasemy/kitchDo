/** Crockford base32 without I, L, O, U — unambiguous to type aloud. */
export const JOIN_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const JOIN_CODE_LENGTH = 8;

const AMBIGUOUS: Record<string, string> = {
  I: '1',
  L: '1',
  O: '0',
};

export function formatJoinCode(code: string): string {
  const normalized = normalizeJoinCode(code) ?? code.replace(/[^0-9A-Z]/gi, '').toUpperCase();
  if (normalized.length !== JOIN_CODE_LENGTH) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function normalizeJoinCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[ILO]/g, (ch) => AMBIGUOUS[ch] ?? ch);
  if (compact.length !== JOIN_CODE_LENGTH) return null;
  for (const ch of compact) {
    if (!JOIN_CODE_ALPHABET.includes(ch)) return null;
  }
  return compact;
}

/** Typed code, dashed code, or kitchdo://join/<code> / ?code=. */
export function parseJoinPayload(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const fromQuery = /[?&]code=([^&]+)/i.exec(trimmed);
  if (fromQuery?.[1]) {
    return normalizeJoinCode(decodeURIComponent(fromQuery[1]));
  }
  const fromPath = /(?:kitchdo:\/\/join\/|\/join\/)([^/?#]+)/i.exec(trimmed);
  if (fromPath?.[1]) {
    return normalizeJoinCode(decodeURIComponent(fromPath[1]));
  }
  return normalizeJoinCode(trimmed);
}

export function joinDeepLink(code: string): string {
  const normalized = normalizeJoinCode(code) ?? code;
  return `kitchdo://join/${normalized}`;
}

export function generateJoinCode(randomBytes: (size: number) => Uint8Array): string {
  const bytes = randomBytes(JOIN_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    out += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length];
  }
  return out;
}
