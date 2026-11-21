// Swipe-deck pagination helpers — mirrors MatchRvViewModel.prefetchNextBatchIfNeeded / extractModelToken.
import type { RvSearchFilter, RvSummary } from '../models/rv';

export const PREFETCH_THRESHOLD = 4;

export function extractModelToken(title: string): string | null {
  const tokens = title.split(' ').filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  const joined = tokens.slice(1, 3).join(' ');
  return joined.trim().length > 0 ? joined.slice(0, 50) : null;
}

export function rememberModels(seenModels: string[], units: RvSummary[]): string[] {
  const out = [...seenModels];
  for (const u of units) {
    const m = extractModelToken(u.title);
    if (m && !out.includes(m)) out.push(m);
  }
  return out;
}

/** When no model exclusions exist yet, step the price band past the priciest seen unit. */
export function nextPageRequest(
  filter: RvSearchFilter,
  deck: RvSummary[],
  seenModels: string[],
): { filter: RvSearchFilter; excludeModels: string[] } {
  const exclude = seenModels.slice(-6);
  if (exclude.length > 0) return { filter, excludeModels: exclude };
  const prices = deck.map((d) => d.priceUsd).filter((p): p is number => p != null);
  const maxSeen = prices.length > 0 ? Math.max(...prices) : null;
  if (maxSeen != null && filter.priceMinUsd == null) {
    return { filter: { ...filter, priceMinUsd: maxSeen + 500 }, excludeModels: [] };
  }
  return { filter, excludeModels: [] };
}

export function mergeFreshUnits(seenIds: Set<string>, units: RvSummary[]): RvSummary[] {
  return units.filter((u) => !seenIds.has(u.unitId));
}
