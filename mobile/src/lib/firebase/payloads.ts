// Pure Firestore payload builders. Field names, clamps, and truncation are copied from
// MatchRvFirestoreRepository.kt so documents satisfy the unchanged firestore.rules.
// Integer-typed rule fields (sleeps, year, matchCount, newMatchCount, sleepsMin) are rounded:
// the JS SDK stores safe integers as Firestore integers, which `is int` requires.
import { clamp } from '../mcp/json';
import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from '../models/firestore';
import { INQUIRY_STATUSES, type RvDetail, type RvSearchFilter, type RvSummary } from '../models/rv';
import { filterSummaryLabel } from '../models/rv';

type Payload = Record<string, unknown>;

function dropNullish(p: Payload): Payload {
  const out: Payload = {};
  for (const [k, v] of Object.entries(p)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

const ifBlank = (s: string, fb: string) => (s.trim().length === 0 ? fb : s);

export function buildSavedRvPayload(uid: string, rv: RvSummary, detail: RvDetail | null | undefined, ts: unknown): Payload {
  const price = clamp(detail?.priceUsd ?? rv.priceUsd ?? 0, 0, 5_000_000);
  const sleeps = detail?.sleeps ?? rv.sleeps;
  const year = detail?.year ?? rv.year;
  const length = detail?.lengthFt ?? rv.lengthFt;
  const gvwr = detail?.gvwrLbs ?? rv.gvwrLbs;
  const dry = detail?.dryWeightLbs ?? rv.dryWeightLbs;
  return dropNullish({
    userId: uid,
    unitId: rv.unitId.slice(0, 160),
    title: ifBlank(detail?.title ?? rv.title, 'RV Listing').slice(0, 240),
    make: (detail?.make ?? rv.make).slice(0, 80),
    rvType: (detail?.rvType ?? rv.rvType ?? '').slice(0, 60),
    dealerName: (detail?.dealerName ?? rv.dealer).slice(0, 180),
    dealerState: (detail?.dealerState ?? rv.dealerState).slice(0, 40),
    savedPriceUsd: price,
    lastCheckedPriceUsd: price,
    hasPriceDrop: false,
    imageUrl: (detail?.images[0] ?? rv.thumbnailUrl)?.slice(0, 1000),
    listingUrl: (detail?.listingUrl ?? rv.listingUrl)?.slice(0, 1000),
    lengthFt: length != null ? clamp(length, 0, 100) : null,
    sleeps: sleeps != null ? clamp(Math.round(sleeps), 0, 20) : null,
    gvwrLbs: gvwr != null ? clamp(gvwr, 0, 100_000) : null,
    dryWeightLbs: dry != null ? clamp(dry, 0, 100_000) : null,
    condition: (detail?.condition ?? rv.condition)?.slice(0, 30),
    year: year != null && year >= 1950 && year <= 2035 ? Math.round(year) : null,
    createdAt: ts,
    updatedAt: ts,
  });
}

export function buildSavedPriceUpdate(lastCheckedPriceUsd: number, hasPriceDrop: boolean, imageUrl: string | null | undefined, ts: unknown): Payload {
  return dropNullish({
    lastCheckedPriceUsd,
    hasPriceDrop,
    imageUrl: imageUrl?.slice(0, 1000),
    updatedAt: ts,
  });
}

export function buildSavedAlertPayload(
  uid: string,
  filter: RvSearchFilter,
  initialUnitIds: string[],
  ts: unknown,
  customLabel?: string | null,
): Payload {
  const label = (customLabel && customLabel.trim() ? customLabel : filterSummaryLabel(filter)).slice(0, 180);
  const types = filter.rvTypes.slice(0, 8);
  const loc = filter.location.trim().slice(0, 80);
  const tow = filter.towVehicle.trim().slice(0, 120);
  return dropNullish({
    userId: uid,
    label,
    alertsEnabled: true,
    matchCount: clamp(initialUnitIds.length, 0, 1_000_000),
    newMatchCount: 0,
    rvTypes: types.length > 0 ? types : null,
    priceMinUsd: filter.priceMinUsd != null ? clamp(filter.priceMinUsd, 0, 5_000_000) : null,
    priceMaxUsd: filter.priceMaxUsd != null ? clamp(filter.priceMaxUsd, 0, 5_000_000) : null,
    location: loc || null,
    radiusMiles: filter.radiusMiles != null ? clamp(filter.radiusMiles, 1, 3000) : null,
    sleepsMin: filter.sleepsMin != null ? clamp(Math.round(filter.sleepsMin), 1, 14) : null,
    lengthMaxFt: filter.lengthMaxFt != null ? clamp(filter.lengthMaxFt, 8, 60) : null,
    condition: filter.condition !== 'any' ? filter.condition : null,
    towVehicle: tow || null,
    truckTowRatingLbs: filter.truckTowRatingLbs != null ? clamp(filter.truckTowRatingLbs, 1000, 40000) : null,
    sort: filter.sort,
    lastCheckedUnitIds: initialUnitIds.slice(0, 10),
    createdAt: ts,
    updatedAt: ts,
  });
}

export function safeInquiryStatus(status: string): string {
  return (INQUIRY_STATUSES as readonly string[]).includes(status) ? status : 'queued_for_matchrv';
}

export function buildInquiryPayload(
  uid: string,
  input: {
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
    imageUrl?: string | null;
  },
  ts: unknown,
): Payload {
  const loc = input.dealerLocation?.slice(0, 120);
  return dropNullish({
    userId: uid,
    mcpInquiryId: input.mcpInquiryId.slice(0, 128),
    statusToken: input.statusToken.slice(0, 256),
    unitId: input.unitId.slice(0, 160),
    rvTitle: ifBlank(input.rvTitle, 'RV Unit').slice(0, 240),
    dealerName: ifBlank(input.dealerName, 'Dealership').slice(0, 180),
    dealerLocation: loc && loc.trim() ? loc : null,
    status: safeInquiryStatus(input.status),
    message: ifBlank(input.message, 'Dealer inquiry').slice(0, 2000),
    dryRun: input.dryRun,
    priceUsd: input.priceUsd != null ? clamp(input.priceUsd, 0, 5_000_000) : null,
    imageUrl: input.imageUrl?.slice(0, 1000),
    createdAt: ts,
    updatedAt: ts,
  });
}

export function buildInquiryStatusUpdate(status: string, dealerReply: string | null | undefined, ts: unknown): Payload {
  const reply = dealerReply?.slice(0, 2000);
  return dropNullish({ status: safeInquiryStatus(status), dealerReply: reply && reply.trim() ? reply : null, updatedAt: ts });
}

export function buildAnalyticsPayload(
  uid: string,
  eventType: AnalyticsEventType,
  extra: { unitId?: string | null; queryText?: string | null; rvType?: string | null; priceUsd?: number | null; metadata?: string | null },
  ts: unknown,
): Payload {
  if (!ANALYTICS_EVENT_TYPES.includes(eventType)) throw new Error(`Invalid analytics event type: ${eventType}`);
  return dropNullish({
    userId: uid,
    eventType,
    unitId: extra.unitId?.slice(0, 160),
    queryText: extra.queryText?.slice(0, 300),
    rvType: extra.rvType?.slice(0, 60),
    priceUsd: extra.priceUsd != null ? clamp(extra.priceUsd, 0, 5_000_000) : null,
    metadata: extra.metadata?.slice(0, 240),
    createdAt: ts,
  });
}
