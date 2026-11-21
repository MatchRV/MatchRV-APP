// Pure helpers for the welcome / sign-in gate. No React or Expo imports so they are unit-testable.

/**
 * The "Preview without sign-in (testing)" link is a developer escape hatch only.
 * It is visible in development builds (`__DEV__`) or when Firebase isn't configured at all
 * (sign-in is impossible, so the app would otherwise be unusable). A production build with
 * Firebase configured never shows it, and AuthProvider refuses to enter preview mode there.
 */
export function canShowPreviewBypass({ isDev, firebaseConfigured }: { isDev: boolean; firebaseConfigured: boolean }): boolean {
  return isDev || !firebaseConfigured;
}

/** 12345 -> "12,345". Manual grouping so output doesn't depend on the JS engine's Intl data. */
export function formatThousands(n: number): string {
  const [int, frac] = Math.trunc(Math.abs(n)).toString().split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

/**
 * Welcome headline. The count must come from the live search_rvs response
 * (inventoryQuality.eligibleUnits); when it's unknown we omit the number entirely.
 */
export function welcomeHeadline(liveCount: number | null | undefined): string {
  if (liveCount == null || !Number.isFinite(liveCount) || liveCount <= 0) return 'Swipe Live Dealer RVs';
  return `Swipe ${formatThousands(liveCount)} Live Dealer RVs`;
}
