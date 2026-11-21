// Ported from app/src/main/java/com/example/data/model/RvModels.kt

export interface WireOption<W extends string = string> {
  wireValue: W;
  displayLabel: string;
}

export const RV_TYPE_OPTIONS = [
  { wireValue: 'travel_trailer', displayLabel: 'Travel Trailer' },
  { wireValue: 'fifth_wheel', displayLabel: 'Fifth Wheel' },
  { wireValue: 'class_c', displayLabel: 'Class C' },
  { wireValue: 'class_a', displayLabel: 'Class A' },
  { wireValue: 'class_b', displayLabel: 'Class B' },
  { wireValue: 'toy_hauler', displayLabel: 'Toy Hauler' },
  { wireValue: 'popup_camper', displayLabel: 'Pop-Up' },
  { wireValue: 'truck_camper', displayLabel: 'Truck Camper' },
] as const satisfies readonly WireOption[];
export type RvType = (typeof RV_TYPE_OPTIONS)[number]['wireValue'];

export const RV_FEATURE_OPTIONS = [
  { wireValue: 'bunkhouse', displayLabel: 'Bunkhouse' },
  { wireValue: 'outdoor_kitchen', displayLabel: 'Outdoor Kitchen' },
  { wireValue: 'solar', displayLabel: 'Solar' },
  { wireValue: 'lithium', displayLabel: 'Lithium' },
  { wireValue: 'generator', displayLabel: 'Generator' },
  { wireValue: 'four_season', displayLabel: '4-Season' },
  { wireValue: 'two_entry_doors', displayLabel: '2 Entry Doors' },
] as const satisfies readonly WireOption[];
export type RvFeature = (typeof RV_FEATURE_OPTIONS)[number]['wireValue'];

export const RV_SORT_OPTIONS = [
  { wireValue: 'best_match', displayLabel: 'Best Match' },
  { wireValue: 'price_asc', displayLabel: 'Price: Low-High' },
  { wireValue: 'price_desc', displayLabel: 'Price: High-Low' },
  { wireValue: 'distance', displayLabel: 'Closest First' },
  { wireValue: 'newest_model_year', displayLabel: 'Newest Year' },
] as const satisfies readonly WireOption[];
export type RvSort = (typeof RV_SORT_OPTIONS)[number]['wireValue'];

export const RV_CONDITION_OPTIONS = [
  { wireValue: 'any', displayLabel: 'Any' },
  { wireValue: 'new', displayLabel: 'New' },
  { wireValue: 'used', displayLabel: 'Used' },
] as const satisfies readonly WireOption[];
export type RvCondition = (typeof RV_CONDITION_OPTIONS)[number]['wireValue'];

function findWire<T extends readonly WireOption[]>(
  options: T,
  value: string | null | undefined,
): T[number] | undefined {
  if (value == null) return undefined;
  const lower = value.toLowerCase();
  return options.find((o) => o.wireValue === lower);
}

export function rvTypeFromWire(value: string | null | undefined): RvType | undefined {
  return findWire(RV_TYPE_OPTIONS, value)?.wireValue;
}
export function rvFeatureFromWire(value: string | null | undefined): RvFeature | undefined {
  return findWire(RV_FEATURE_OPTIONS, value)?.wireValue;
}
export function sortFromWire(value: string | null | undefined): RvSort {
  return findWire(RV_SORT_OPTIONS, value)?.wireValue ?? 'best_match';
}
export function conditionFromWire(value: string | null | undefined): RvCondition {
  return findWire(RV_CONDITION_OPTIONS, value)?.wireValue ?? 'any';
}

export function rvTypeLabel(wire: string | null | undefined): string {
  const opt = findWire(RV_TYPE_OPTIONS, wire);
  if (opt) return opt.displayLabel;
  if (!wire) return 'RV';
  const spaced = wire.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
export function featureLabel(wire: string): string {
  return findWire(RV_FEATURE_OPTIONS, wire)?.displayLabel ?? wire;
}
export function sortLabel(wire: RvSort): string {
  return findWire(RV_SORT_OPTIONS, wire)?.displayLabel ?? wire;
}
export function conditionLabel(wire: RvCondition): string {
  return findWire(RV_CONDITION_OPTIONS, wire)?.displayLabel ?? wire;
}

export interface RvSearchFilter {
  rvTypes: RvType[];
  priceMinUsd: number | null;
  priceMaxUsd: number | null;
  location: string;
  radiusMiles: number | null;
  condition: RvCondition;
  sleepsMin: number | null;
  lengthMinFt: number | null;
  lengthMaxFt: number | null;
  towVehicle: string;
  truckTowRatingLbs: number | null;
  desiredFeatures: RvFeature[];
  fuelType: string | null;
  make: string;
  query: string;
  sort: RvSort;
}

export function emptyFilter(overrides: Partial<RvSearchFilter> = {}): RvSearchFilter {
  return {
    rvTypes: [],
    priceMinUsd: null,
    priceMaxUsd: null,
    location: '',
    radiusMiles: null,
    condition: 'any',
    sleepsMin: null,
    lengthMinFt: null,
    lengthMaxFt: null,
    towVehicle: '',
    truckTowRatingLbs: null,
    desiredFeatures: [],
    fuelType: null,
    make: '',
    query: '',
    sort: 'best_match',
    ...overrides,
  };
}

const isBlank = (s: string | null | undefined) => !s || s.trim().length === 0;

export function activeFilterCount(f: RvSearchFilter): number {
  let count = 0;
  if (f.rvTypes.length > 0) count++;
  if (f.priceMinUsd != null || f.priceMaxUsd != null) count++;
  if (!isBlank(f.location)) count++;
  if (f.condition !== 'any') count++;
  if (f.sleepsMin != null) count++;
  if (f.lengthMinFt != null || f.lengthMaxFt != null) count++;
  if (!isBlank(f.towVehicle) || f.truckTowRatingLbs != null) count++;
  if (f.desiredFeatures.length > 0) count++;
  if (!isBlank(f.fuelType)) count++;
  if (!isBlank(f.make)) count++;
  if (f.sort !== 'best_match') count++;
  return count;
}

function formatCompactCurrency(amount: number): string {
  return amount >= 1000 ? `${Math.trunc(amount / 1000)}k` : `${Math.trunc(amount)}`;
}

export function filterSummaryLabel(f: RvSearchFilter): string {
  const parts: string[] = [];
  if (f.rvTypes.length > 0) parts.push(f.rvTypes.map(rvTypeLabel).join('/'));
  else if (!isBlank(f.make)) parts.push(f.make.trim());
  else parts.push('All RVs');
  if (f.priceMaxUsd != null) parts.push(`under $${formatCompactCurrency(f.priceMaxUsd)}`);
  else if (f.priceMinUsd != null) parts.push(`from $${formatCompactCurrency(f.priceMinUsd)}`);
  if (!isBlank(f.location)) {
    if (f.radiusMiles != null) parts.push(`within ${Math.trunc(f.radiusMiles)}mi of ${f.location.trim()}`);
    else parts.push(`near ${f.location.trim()}`);
  }
  if (f.sleepsMin != null) parts.push(`sleeps ${f.sleepsMin}+`);
  if (f.lengthMaxFt != null) parts.push(`<=${Math.trunc(f.lengthMaxFt)}ft`);
  return parts.join(' • ').slice(0, 175);
}

export interface RvSummary {
  unitId: string;
  title: string;
  make: string;
  priceUsd: number | null;
  lengthFt: number | null;
  dryWeightLbs: number | null;
  gvwrLbs: number | null;
  sleeps: number | null;
  distanceMi: number | null;
  dealer: string;
  dealerState: string;
  matchScore: number | null;
  verified: boolean;
  floorplan: string | null;
  walkthroughUrl: string | null;
  walkthroughLabel: string | null;
  listingUrl: string | null;
  thumbnailUrl: string | null;
  rvType: string | null;
  condition: string | null;
  year: number | null;
  isHydrated: boolean;
}

export interface RvDetail {
  unitId: string;
  vin: string | null;
  stockNumber: string | null;
  title: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  floorplanCode: string | null;
  rvType: string | null;
  condition: string | null;
  status: string | null;
  priceUsd: number | null;
  priceNote: string | null;
  msrpUsd: number | null;
  lengthFt: number | null;
  dryWeightLbs: number | null;
  gvwrLbs: number | null;
  hitchWeightLbs: number | null;
  sleeps: number | null;
  slideouts: number | null;
  freshWaterGal: number | null;
  greyWaterGal: number | null;
  blackWaterGal: number | null;
  bunkhouse: boolean | null;
  solar: boolean | null;
  lithiumBattery: boolean | null;
  generator: boolean | null;
  fourSeason: boolean | null;
  outdoorKitchen: boolean | null;
  boondockingScore: number | null;
  boondockingKnown: string[];
  dealerName: string;
  dealerCity: string | null;
  dealerState: string | null;
  dealerWebsite: string | null;
  images: string[];
  description: string | null;
  features: string[];
  listingUrl: string | null;
  lastSeenAt: string | null;
  availabilityGuidance: string | null;
  walkthroughUrl: string | null;
  walkthroughLabel: string | null;
  powertrainSummary: [string, string][];
}

export interface McpSearchResult {
  units: RvSummary[];
  /** Live count of eligible inventory reported by the MCP server (inventoryQuality.eligibleUnits). */
  eligibleUnitsCount: number | null;
  scope: string;
  expandedRadiusMiles: number | null;
  timingMs: number | null;
}

export interface DealerInquiryPreview {
  confirmationToken: string;
  expiresAt: string | null;
  dealerName: string;
  dealerLocation: string | null;
  deliveryMethod: string;
  rvTitle: string;
  vin: string | null;
  stockNumber: string | null;
  priceUsd: number | null;
  shopperName: string;
  shopperEmail: string | null;
  shopperPhone: string | null;
  message: string;
  rawSummary: string | null;
}

export type InquiryStatus = 'delivered' | 'queued_for_matchrv' | 'failed' | 'dry_run' | 'replied';
export const INQUIRY_STATUSES: readonly InquiryStatus[] = [
  'delivered',
  'queued_for_matchrv',
  'failed',
  'dry_run',
  'replied',
];

export interface DealerInquiryReceipt {
  inquiryId: string;
  statusToken: string;
  status: InquiryStatus;
  statusMessage: string;
  dryRun: boolean;
}

export interface DealerInquiryStatusResult {
  inquiryId: string;
  status: InquiryStatus;
  dealerReply: string | null;
  statusSummary: string;
}

export interface TowFitUnitVerdict {
  unitId: string;
  title: string;
  verdict: string;
  details: string[];
}

export interface TowFitEvaluation {
  vehicleLabel: string;
  summaryText: string;
  unitVerdicts: TowFitUnitVerdict[];
}

export interface RvComparisonItem {
  unitId: string;
  title: string;
  priceUsd: number | null;
  lengthFt: number | null;
  sleeps: number | null;
  dryWeightLbs: number | null;
  gvwrLbs: number | null;
  dealer: string;
  highlights: string[];
}

/** Extra (not in Kotlin): the server's `comparison.rows` spec table, when present. */
export interface RvComparisonSpecRow {
  spec: string;
  unit: string;
  values: (string | number | boolean | null)[];
  bestIndex: number | null;
}

export interface RvComparisonResult {
  summaryText: string;
  rows: RvComparisonItem[];
  specRows: RvComparisonSpecRow[];
}
