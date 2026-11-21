import { canShowPreviewBypass, formatThousands, welcomeHeadline } from '../gate';
import { NONCE_CHARSET, nonceFromBytes } from '../nonce';

describe('canShowPreviewBypass', () => {
  it('shows in dev builds', () => {
    expect(canShowPreviewBypass({ isDev: true, firebaseConfigured: true })).toBe(true);
    expect(canShowPreviewBypass({ isDev: true, firebaseConfigured: false })).toBe(true);
  });
  it('shows in production only when Firebase is not configured', () => {
    expect(canShowPreviewBypass({ isDev: false, firebaseConfigured: false })).toBe(true);
  });
  it('never shows in a production build with Firebase configured', () => {
    expect(canShowPreviewBypass({ isDev: false, firebaseConfigured: true })).toBe(false);
  });
});

describe('welcomeHeadline', () => {
  it('formats a live count with thousands separators', () => {
    expect(welcomeHeadline(12345)).toBe('Swipe 12,345 Live Dealer RVs');
    expect(welcomeHeadline(7)).toBe('Swipe 7 Live Dealer RVs');
    expect(welcomeHeadline(1234567)).toBe('Swipe 1,234,567 Live Dealer RVs');
  });
  it('omits the number when unknown or invalid', () => {
    expect(welcomeHeadline(null)).toBe('Swipe Live Dealer RVs');
    expect(welcomeHeadline(undefined)).toBe('Swipe Live Dealer RVs');
    expect(welcomeHeadline(0)).toBe('Swipe Live Dealer RVs');
    expect(welcomeHeadline(Number.NaN)).toBe('Swipe Live Dealer RVs');
  });
  it('formatThousands groups digits', () => {
    expect(formatThousands(999)).toBe('999');
    expect(formatThousands(1000)).toBe('1,000');
    expect(formatThousands(-4321)).toBe('-4,321');
  });
});

describe('nonceFromBytes', () => {
  it('maps every byte to one charset character', () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => i * 8);
    const nonce = nonceFromBytes(bytes);
    expect(nonce).toHaveLength(32);
    for (const c of nonce) expect(NONCE_CHARSET).toContain(c);
  });
  it('is deterministic for the same bytes and differs for different bytes', () => {
    expect(nonceFromBytes(Uint8Array.of(1, 2, 3))).toBe(nonceFromBytes(Uint8Array.of(1, 2, 3)));
    expect(nonceFromBytes(Uint8Array.of(1, 2, 3))).not.toBe(nonceFromBytes(Uint8Array.of(3, 2, 1)));
  });
});
