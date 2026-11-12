export const AUTH_OTP_LENGTH = 6;

export function normalizeAuthOtp(raw: string): string | null {
  const cleaned = raw.replace(/\s/g, '');
  return new RegExp(`^\\d{${AUTH_OTP_LENGTH}}$`).test(cleaned) ? cleaned : null;
}

/** True when sign-up failed because this email already has an account. */
export function isExistingAccountAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already registered') ||
    lower.includes('already been registered') ||
    lower.includes('user already exists') ||
    lower.includes('email already') ||
    lower.includes('invalid login credentials')
  );
}

export function isInvalidCredentialsError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('invalid login') || lower.includes('invalid credentials');
}
