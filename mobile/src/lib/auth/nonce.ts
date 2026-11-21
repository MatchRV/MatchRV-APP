// Sign in with Apple nonce helpers (pure). The raw nonce goes to Firebase; its SHA-256 hash goes to Apple.
export const NONCE_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';

/** Maps random bytes onto a URL-safe charset. Callers supply cryptographically secure bytes. */
export function nonceFromBytes(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += NONCE_CHARSET[b % NONCE_CHARSET.length];
  return out;
}
