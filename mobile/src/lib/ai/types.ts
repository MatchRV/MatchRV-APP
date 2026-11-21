// Ask AI provider contract. Both providers return the same JSON shape that the Kotlin
// AskAiRepository asks Gemini for (see querySchema), so one converter turns it into filters.
import {
  RV_FEATURE_OPTIONS,
  RV_SORT_OPTIONS,
  RV_TYPE_OPTIONS,
  conditionFromWire,
  emptyFilter,
  rvFeatureFromWire,
  rvTypeFromWire,
  sortFromWire,
  type RvFeature,
  type RvSearchFilter,
  type RvSummary,
  type RvType,
} from '../models/rv';
import { isObject, optArray, optNullableDouble, optNullableInt, optNullableString, optString, type JsonObject } from '../mcp/json';

export interface AiParsedQuery {
  agentSummary?: string;
  outfitterTip?: string;
  rvTypes?: string[];
  priceMinUsd?: number | null;
  priceMaxUsd?: number | null;
  location?: string | null;
  radiusMiles?: number | null;
  condition?: string;
  sleepsMin?: number | null;
  lengthMaxFt?: number | null;
  towVehicle?: string | null;
  truckTowRatingLbs?: number | null;
  desiredFeatures?: string[];
  fuelType?: string | null;
  make?: string | null;
  keywords?: string | null;
  sort?: string;
}

export type AskAiSource = 'firebase-ai' | 'local';

export interface AskAiProvider {
  readonly id: AskAiSource;
  readonly label: string;
  /** False when the provider can't run in this build (e.g. Firebase not configured). */
  isAvailable(): boolean;
  parse(prompt: string): Promise<AiParsedQuery>;
}

export interface AiCuratedDeckResult {
  userPrompt: string;
  agentSummary: string;
  outfitterTip: string;
  appliedFilter: RvSearchFilter;
  appliedCriteriaChips: string[];
  curatedDeck: RvSummary[];
  eligibleUnitsCount: number | null;
  source: AskAiSource;
  /** Set when Firebase AI was attempted but failed and the local parser was used instead. */
  fallbackReason: string | null;
}

export const RV_TYPE_WIRES = RV_TYPE_OPTIONS.map((o) => o.wireValue);
export const RV_FEATURE_WIRES = RV_FEATURE_OPTIONS.map((o) => o.wireValue);
export const RV_SORT_WIRES = RV_SORT_OPTIONS.map((o) => o.wireValue);

/** Same instruction text as AskAiRepository.runAgentSearch. */
export function buildAgentInstruction(cleanPrompt: string): string {
  return [
    "You are the MatchRV AI Shopping Agent translating a buyer's natural-language RV request into exact filter parameters for the MatchRV MCP `search_rvs` tool.",
    'Rules:',
    '- Extract ONLY facts the shopper explicitly stated. Never invent a location, tow vehicle, fuel type, or budget they did not mention.',
    '- If they say "Class C", map to ["class_c"]. If "motorhome", map to ["class_a", "class_b", "class_c"].',
    '- If they mention "slide-out" or "slideout", include "slide-out" in keywords.',
    '- Keep agentSummary crisp, helpful, and buyer-focused.',
    `- Shopper request: "${cleanPrompt}"`,
  ].join('\n');
}

/** Converts the AI JSON object into an RvSearchFilter exactly like the Kotlin repository does. */
export function parsedQueryToFilter(raw: AiParsedQuery | JsonObject): RvSearchFilter {
  const parsed = (isObject(raw) ? raw : {}) as JsonObject;
  const rvTypes = Array.from(
    new Set(
      (optArray(parsed, 'rvTypes') ?? [])
        .map((v) => rvTypeFromWire(typeof v === 'string' ? v : null))
        .filter((t): t is RvType => t != null),
    ),
  );
  const desiredFeatures = Array.from(
    new Set(
      (optArray(parsed, 'desiredFeatures') ?? [])
        .map((v) => rvFeatureFromWire(typeof v === 'string' ? v : null))
        .filter((t): t is RvFeature => t != null),
    ),
  );
  const fuel = optNullableString(parsed, 'fuelType')?.toLowerCase();
  return emptyFilter({
    rvTypes,
    priceMinUsd: optNullableDouble(parsed, 'priceMinUsd'),
    priceMaxUsd: optNullableDouble(parsed, 'priceMaxUsd'),
    location: optNullableString(parsed, 'location') ?? '',
    radiusMiles: optNullableDouble(parsed, 'radiusMiles'),
    condition: conditionFromWire(optNullableString(parsed, 'condition')),
    sleepsMin: optNullableInt(parsed, 'sleepsMin'),
    lengthMaxFt: optNullableDouble(parsed, 'lengthMaxFt'),
    towVehicle: optNullableString(parsed, 'towVehicle') ?? '',
    truckTowRatingLbs: optNullableDouble(parsed, 'truckTowRatingLbs'),
    desiredFeatures,
    fuelType: fuel === 'gas' || fuel === 'diesel' ? fuel : null,
    make: optNullableString(parsed, 'make') ?? '',
    query: optNullableString(parsed, 'keywords') ?? '',
    sort: sortFromWire(optNullableString(parsed, 'sort')),
  });
}

export function parsedSummary(raw: AiParsedQuery | JsonObject): { agentSummary: string; outfitterTip: string } {
  const parsed = (isObject(raw) ? raw : {}) as JsonObject;
  const s = optString(parsed, 'agentSummary');
  const t = optString(parsed, 'outfitterTip');
  return {
    agentSummary: s.trim() ? s : 'Curated live MatchRV dealer inventory for your criteria.',
    outfitterTip: t.trim() ? t : 'Confirm current lot availability and out-the-door pricing directly with the dealer.',
  };
}
