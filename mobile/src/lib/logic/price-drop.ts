// Price-drop check — mirrors MatchRvViewModel.refreshSavedPricesNow + repository.updateSavedRvPrice.
import { clamp } from '../mcp/json';
import type { SavedRvRecord } from '../models/firestore';

/** Kotlin only re-checks the first 10 saved RVs per run. */
export const PRICE_CHECK_LIMIT = 10;

export interface SavedPriceUpdate {
  lastCheckedPriceUsd: number;
  hasPriceDrop: boolean;
}

/**
 * Returns the Firestore update for one saved RV given its live price, or null when the live price
 * is missing/non-positive (Kotlin skips the update in that case).
 */
export function computeSavedPriceUpdate(savedBaselinePriceUsd: number, livePriceUsd: number | null | undefined): SavedPriceUpdate | null {
  if (livePriceUsd == null || !(livePriceUsd > 0)) return null;
  const clamped = clamp(livePriceUsd, 0, 5_000_000);
  const dropped = savedBaselinePriceUsd > 0 && clamped > 0 && clamped < savedBaselinePriceUsd;
  return { lastCheckedPriceUsd: clamped, hasPriceDrop: dropped };
}

export function selectRvsForPriceCheck(saved: SavedRvRecord[]): SavedRvRecord[] {
  return saved.slice(0, PRICE_CHECK_LIMIT);
}

export function priceDropMessage(dropCount: number): string {
  return dropCount > 0
    ? `${dropCount} saved RV${dropCount > 1 ? 's' : ''} dropped in price!`
    : 'Prices checked against live MatchRV inventory — all up to date.';
}
