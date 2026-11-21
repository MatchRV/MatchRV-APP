// Ported from app/src/main/java/com/example/data/model/FirestoreModels.kt
// Field names and types must stay identical so the existing firestore.rules keep validating.
import {
  conditionFromWire,
  emptyFilter,
  rvTypeFromWire,
  sortFromWire,
  type RvSearchFilter,
  type RvType,
} from './rv';

export function sanitizeFirestoreDocId(raw: string, now: () => number = Date.now): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.trim().length === 0 ? `item_${now()}` : cleaned.slice(0, 120);
}

/** Firestore Timestamp-like value (seconds); kept loose so pure logic stays SDK-free. */
export interface TimestampLike {
  seconds: number;
}

export interface SavedRvRecord {
  id: string;
  userId: string;
  unitId: string;
  title: string;
  make: string;
  rvType: string;
  dealerName: string;
  dealerState: string;
  savedPriceUsd: number;
  lastCheckedPriceUsd: number;
  hasPriceDrop: boolean;
  imageUrl?: string | null;
  listingUrl?: string | null;
  lengthFt?: number | null;
  sleeps?: number | null;
  gvwrLbs?: number | null;
  dryWeightLbs?: number | null;
  condition?: string | null;
  year?: number | null;
  notes?: string | null;
  createdAt?: TimestampLike | null;
  updatedAt?: TimestampLike | null;
}

export function priceDropAmountUsd(r: Pick<SavedRvRecord, 'hasPriceDrop' | 'savedPriceUsd' | 'lastCheckedPriceUsd'>): number {
  return r.hasPriceDrop && r.savedPriceUsd > r.lastCheckedPriceUsd && r.lastCheckedPriceUsd > 0
    ? r.savedPriceUsd - r.lastCheckedPriceUsd
    : 0;
}

export interface SavedSearchAlertRecord {
  id: string;
  userId: string;
  label: string;
  alertsEnabled: boolean;
  matchCount: number;
  newMatchCount: number;
  rvTypes: string[];
  priceMinUsd?: number | null;
  priceMaxUsd?: number | null;
  location?: string | null;
  radiusMiles?: number | null;
  sleepsMin?: number | null;
  lengthMaxFt?: number | null;
  condition?: string | null;
  towVehicle?: string | null;
  truckTowRatingLbs?: number | null;
  sort?: string | null;
  lastCheckedUnitIds: string[];
  createdAt?: TimestampLike | null;
  updatedAt?: TimestampLike | null;
}

export function alertToSearchFilter(a: SavedSearchAlertRecord): RvSearchFilter {
  return emptyFilter({
    rvTypes: (a.rvTypes ?? []).map(rvTypeFromWire).filter((t): t is RvType => t != null),
    priceMinUsd: a.priceMinUsd ?? null,
    priceMaxUsd: a.priceMaxUsd ?? null,
    location: a.location ?? '',
    radiusMiles: a.radiusMiles ?? null,
    condition: conditionFromWire(a.condition),
    sleepsMin: a.sleepsMin != null ? Math.trunc(a.sleepsMin) : null,
    lengthMaxFt: a.lengthMaxFt ?? null,
    towVehicle: a.towVehicle ?? '',
    truckTowRatingLbs: a.truckTowRatingLbs ?? null,
    sort: sortFromWire(a.sort),
  });
}

export interface DealerInquiryRecord {
  id: string;
  userId: string;
  mcpInquiryId: string;
  statusToken: string;
  unitId: string;
  rvTitle: string;
  dealerName: string;
  dealerLocation?: string | null;
  status: string;
  message: string;
  dryRun: boolean;
  priceUsd?: number | null;
  dealerReply?: string | null;
  imageUrl?: string | null;
  createdAt?: TimestampLike | null;
  updatedAt?: TimestampLike | null;
}

export type AnalyticsEventType = 'swipe_right' | 'swipe_left' | 'save' | 'inquiry_sent' | 'agent_search';
export const ANALYTICS_EVENT_TYPES: readonly AnalyticsEventType[] = [
  'swipe_right',
  'swipe_left',
  'save',
  'inquiry_sent',
  'agent_search',
];
