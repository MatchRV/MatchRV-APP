// Pure response parsing for the MatchRV MCP server. Ported from MatchRvMcpClient.kt.
// Everything here is side-effect free so it can be unit tested with captured fixtures.
import {
  INQUIRY_STATUSES,
  type DealerInquiryPreview,
  type DealerInquiryReceipt,
  type DealerInquiryStatusResult,
  type InquiryStatus,
  type McpSearchResult,
  type RvComparisonItem,
  type RvComparisonResult,
  type RvComparisonSpecRow,
  type RvDetail,
  type RvSummary,
  type TowFitEvaluation,
  type TowFitUnitVerdict,
} from '../models/rv';
import {
  extractSpecBoolean,
  extractSpecDouble,
  extractSpecInt,
  ifBlank,
  isObject,
  optArray,
  optBoolean,
  optNullableDouble,
  optNullableInt,
  optNullableString,
  optObject,
  optString,
  stringList,
  type JsonObject,
} from './json';

export class McpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpError';
  }
}

/**
 * Parses a Streamable-HTTP MCP response body: either a plain JSON object or an
 * SSE stream, in which case the LAST `data:` line holding a JSON object wins.
 */
export function parseMcpPayload(raw: string): JsonObject | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('{')) {
    try {
      const v = JSON.parse(trimmed);
      return isObject(v) ? v : null;
    } catch {
      return null;
    }
  }
  let last: JsonObject | null = null;
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice('data:'.length).trim();
    if (!data.startsWith('{')) continue;
    try {
      const v = JSON.parse(data);
      if (isObject(v)) last = v;
    } catch {
      // ignore malformed chunk, same as Kotlin runCatching
    }
  }
  return last;
}

export function extractTextContent(result: JsonObject): string {
  const arr = optArray(result, 'content');
  if (!arr) return '';
  const parts: string[] = [];
  for (const item of arr) {
    if (!isObject(item)) continue;
    const text = optString(item, 'text');
    if (text.trim().length > 0) parts.push(text);
  }
  return parts.join('\n');
}

export interface ToolResult {
  structured: JsonObject;
  text: string;
}

/** Mirrors callTool(): JSON-RPC error -> throw, isError -> throw, structuredContent or JSON text. */
export function unwrapToolResponse(toolName: string, response: JsonObject): ToolResult {
  const err = response.error;
  if (err !== undefined && err !== null) {
    const msg = isObject(err) ? optString(err, 'message') : '';
    throw new McpError(ifBlank(msg, () => 'MatchRV MCP error'));
  }
  const result = optObject(response, 'result');
  if (!result) throw new McpError(`Empty MCP result for ${toolName}`);
  if (optBoolean(result, 'isError', false)) {
    throw new McpError(ifBlank(extractTextContent(result), () => `Tool ${toolName} returned an error.`));
  }
  const text = extractTextContent(result);
  let structured = optObject(result, 'structuredContent');
  if (!structured) {
    structured = {};
    if (text.trim().startsWith('{')) {
      try {
        const v = JSON.parse(text);
        if (isObject(v)) structured = v;
      } catch {
        structured = {};
      }
    }
  }
  return { structured, text };
}

/** Text content is often the JSON payload itself; don't show raw JSON to shoppers. */
function readableText(text: string, max: number): string {
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) return '';
  return t.slice(0, max);
}

export function extractYearFromTitle(title: string): number | null {
  const m = /\b(19[89]\d|20[0-3]\d)\b/.exec(title);
  return m ? parseInt(m[1], 10) : null;
}

export type DetailLookup = (unitId: string) => RvDetail | undefined;
const noCache: DetailLookup = () => undefined;

export function parseSearchResult(structured: JsonObject, cache: DetailLookup = noCache): McpSearchResult {
  const results = optArray(structured, 'results') ?? [];
  const units: RvSummary[] = [];
  for (const raw of results) {
    if (!isObject(raw)) continue;
    const obj = raw;
    const unitId = ifBlank(optString(obj, 'unit_id'), () => optString(obj, 'id'));
    if (unitId.trim().length === 0) continue;
    const walkthrough = optObject(obj, 'walkthrough');
    const cached = cache(unitId);
    const title = ifBlank(optString(obj, 'title'), () => 'RV Listing');
    const floorplan = optNullableString(obj, 'floorplan');
    units.push({
      unitId,
      title,
      make: ifBlank(optString(obj, 'make'), () => cached?.make ?? ''),
      priceUsd: optNullableDouble(obj, 'price') ?? cached?.priceUsd ?? null,
      lengthFt: optNullableDouble(obj, 'lengthFt') ?? cached?.lengthFt ?? null,
      dryWeightLbs: optNullableDouble(obj, 'dryLbs') ?? cached?.dryWeightLbs ?? null,
      gvwrLbs: optNullableDouble(obj, 'gvwrLbs') ?? cached?.gvwrLbs ?? null,
      sleeps: optNullableInt(obj, 'sleeps') ?? cached?.sleeps ?? null,
      distanceMi: optNullableDouble(obj, 'distanceMi'),
      dealer: ifBlank(optString(obj, 'dealer'), () => cached?.dealerName ?? ''),
      dealerState: ifBlank(optString(obj, 'dealerState'), () => cached?.dealerState ?? ''),
      matchScore: optNullableInt(obj, 'match'),
      verified: optBoolean(obj, 'verified', false),
      floorplan: floorplan === 'unknown' ? null : floorplan,
      walkthroughUrl: optNullableString(walkthrough, 'url'),
      walkthroughLabel: optNullableString(walkthrough, 'label'),
      listingUrl: optNullableString(obj, 'sleepsSourceUrl') ?? cached?.listingUrl ?? null,
      thumbnailUrl: cached?.images[0] ?? null,
      rvType: cached?.rvType ?? null,
      condition: cached?.condition ?? null,
      year: cached?.year ?? extractYearFromTitle(title),
      isHydrated: cached != null,
    });
  }
  const quality = optObject(structured, 'inventoryQuality');
  const coverage = optObject(structured, 'coverage');
  return {
    units,
    eligibleUnitsCount: optNullableInt(quality, 'eligibleUnits'),
    scope: ifBlank(optString(coverage, 'scope'), () => 'nationwide'),
    expandedRadiusMiles: optNullableDouble(coverage, 'expanded_radius_miles'),
    timingMs: optNullableInt(structured, 'timingMs'),
  };
}

function powertrainLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function parseRvDetail(structured: JsonObject, requestedUnitId: string): RvDetail {
  const unit = optObject(structured, 'unit');
  if (!unit) throw new McpError(`Unit details unavailable for ${requestedUnitId}`);
  const availability = optObject(structured, 'availability');
  const walkthrough = optObject(structured, 'walkthrough');
  const dealer = optObject(unit, 'dealer');
  const provenance = optObject(unit, 'provenance');
  const boondocking = optObject(unit, 'boondocking');

  const images = stringList(optArray(unit, 'images'), (u) => u.startsWith('http'));
  const features = stringList(optArray(unit, 'features'));
  const boondockingKnown = stringList(optArray(boondocking, 'knownInputs'));

  const powertrain: [string, string][] = [];
  const pt = optObject(unit, 'powertrainAndTowing') ?? optObject(structured, 'powertrainAndTowing');
  if (pt) {
    for (const [key, rawVal] of Object.entries(pt)) {
      let formatted: string | null = null;
      if (isObject(rawVal)) {
        const v = rawVal.value;
        formatted = v === undefined || v === null ? null : String(v);
      } else if (typeof rawVal === 'string' || typeof rawVal === 'number' || typeof rawVal === 'boolean') {
        formatted = String(rawVal);
      }
      if (formatted && formatted.trim().length > 0) powertrain.push([powertrainLabel(key), formatted]);
    }
  }

  return {
    unitId: ifBlank(optString(unit, 'id'), () => requestedUnitId),
    vin: optNullableString(unit, 'vin'),
    stockNumber: optNullableString(unit, 'stockNumber'),
    title: ifBlank(optString(unit, 'title'), () => 'RV Unit'),
    year: optNullableInt(unit, 'year'),
    make: optNullableString(unit, 'make'),
    model: optNullableString(unit, 'model'),
    trim: optNullableString(unit, 'trim'),
    floorplanCode: optNullableString(unit, 'floorplanCode'),
    rvType: optNullableString(unit, 'rvType'),
    condition: optNullableString(unit, 'condition'),
    status: optNullableString(availability, 'status') ?? optNullableString(unit, 'status'),
    priceUsd: extractSpecDouble(unit, 'priceUsd'),
    priceNote: optNullableString(optObject(unit, 'priceUsd'), 'note'),
    msrpUsd: extractSpecDouble(unit, 'msrpUsd'),
    lengthFt: extractSpecDouble(unit, 'lengthFt'),
    dryWeightLbs: extractSpecDouble(unit, 'dryWeightLbs'),
    gvwrLbs: extractSpecDouble(unit, 'gvwrLbs'),
    hitchWeightLbs: extractSpecDouble(unit, 'hitchWeightLbs'),
    sleeps: extractSpecInt(unit, 'sleeps'),
    slideouts: extractSpecInt(unit, 'slideouts'),
    freshWaterGal: extractSpecDouble(unit, 'freshWaterGal'),
    greyWaterGal: extractSpecDouble(unit, 'greyWaterGal'),
    blackWaterGal: extractSpecDouble(unit, 'blackWaterGal'),
    bunkhouse: extractSpecBoolean(unit, 'bunkhouse'),
    solar: extractSpecBoolean(unit, 'solar'),
    lithiumBattery: extractSpecBoolean(unit, 'lithiumBattery'),
    generator: extractSpecBoolean(unit, 'generator'),
    fourSeason: extractSpecBoolean(unit, 'fourSeason'),
    outdoorKitchen: extractSpecBoolean(unit, 'outdoorKitchen'),
    boondockingScore: optNullableInt(boondocking, 'score'),
    boondockingKnown,
    dealerName: ifBlank(optString(dealer, 'name'), () => 'Authorized RV Dealer'),
    dealerCity: optNullableString(dealer, 'city'),
    dealerState: optNullableString(dealer, 'state'),
    dealerWebsite: optNullableString(dealer, 'website'),
    images,
    description: optNullableString(unit, 'description'),
    features,
    listingUrl: optNullableString(availability, 'dealerListingUrl') ?? optNullableString(provenance, 'listingUrl'),
    lastSeenAt: optNullableString(availability, 'lastSeenAt') ?? optNullableString(provenance, 'lastSeenAt'),
    availabilityGuidance: optNullableString(availability, 'guidance'),
    walkthroughUrl: optNullableString(walkthrough, 'url'),
    walkthroughLabel: optNullableString(walkthrough, 'label'),
    powertrainSummary: powertrain,
  };
}

function collectStrings(obj: JsonObject, key: string, into: string[]) {
  for (const s of stringList(optArray(obj, key))) into.push(s);
}

/**
 * Kotlin reads `results` / `evaluations` / `units`. The live server (verified 2026-11) returns
 * `fits` plus `payloadFits`, so those are accepted too and payload details are merged per unit.
 */
export function parseTowFit(structured: JsonObject, text: string, vehicle: string): TowFitEvaluation {
  const arr =
    optArray(structured, 'results') ??
    optArray(structured, 'evaluations') ??
    optArray(structured, 'units') ??
    optArray(structured, 'fits') ??
    [];
  const payloadById = new Map<string, JsonObject>();
  for (const p of optArray(structured, 'payloadFits') ?? []) {
    if (!isObject(p)) continue;
    const id = ifBlank(optString(p, 'unit_id'), () => optString(p, 'unitId'));
    if (id) payloadById.set(id, p);
  }
  const verdicts: TowFitUnitVerdict[] = [];
  for (const raw of arr) {
    if (!isObject(raw)) continue;
    const item = raw;
    const details: string[] = [];
    const summary = optNullableString(item, 'summary');
    if (summary) details.push(summary);
    const reason = optNullableString(item, 'reason');
    if (reason) details.push(reason);
    const detail = optNullableString(item, 'detail');
    if (detail) details.push(detail);
    collectStrings(item, 'notes', details);
    collectStrings(item, 'warnings', details);
    const unitId = ifBlank(optString(item, 'unit_id'), () => optString(item, 'unitId'));
    const payload = payloadById.get(unitId);
    if (payload) {
      const pd = optNullableString(payload, 'detail');
      const pv = optNullableString(payload, 'verdict');
      if (pd) details.push(pv ? `Payload (${pv.replace(/_/g, ' ')}): ${pd}` : `Payload: ${pd}`);
    }
    verdicts.push({
      unitId,
      title: ifBlank(optString(item, 'title'), () => 'RV Unit'),
      verdict: ifBlank(ifBlank(optString(item, 'verdict'), () => optString(item, 'status')), () => 'Screening Complete'),
      details,
    });
  }
  const notes = [optNullableString(structured, 'payloadNote'), optNullableString(structured, 'safetyNotice')]
    .filter((s): s is string => !!s)
    .join('\n\n');
  const summaryText =
    optNullableString(structured, 'summary') ??
    optNullableString(structured, 'disclaimer') ??
    (notes.length > 0 ? notes : null) ??
    ifBlank(readableText(text, 800), () => `Tow-fit screening completed for ${vehicle}.`);
  return { vehicleLabel: vehicle.trim(), summaryText, unitVerdicts: verdicts };
}

export function parseCompare(structured: JsonObject, text: string, cache: DetailLookup = noCache): RvComparisonResult {
  const arr =
    optArray(structured, 'units') ??
    optArray(structured, 'comparison') ??
    optArray(structured, 'results') ??
    [];
  const rows: RvComparisonItem[] = [];
  for (const raw of arr) {
    if (!isObject(raw)) continue;
    const obj = raw;
    const uid = ifBlank(optString(obj, 'unit_id'), () => optString(obj, 'id'));
    const cached = cache(uid);
    const highlights: string[] = [];
    collectStrings(obj, 'highlights', highlights);
    collectStrings(obj, 'pros', highlights);
    rows.push({
      unitId: uid,
      title: ifBlank(optString(obj, 'title'), () => cached?.title ?? 'RV'),
      priceUsd: extractSpecDouble(obj, 'priceUsd') ?? optNullableDouble(obj, 'price') ?? cached?.priceUsd ?? null,
      lengthFt: extractSpecDouble(obj, 'lengthFt') ?? cached?.lengthFt ?? null,
      sleeps: extractSpecInt(obj, 'sleeps') ?? cached?.sleeps ?? null,
      dryWeightLbs:
        extractSpecDouble(obj, 'dryWeightLbs') ?? optNullableDouble(obj, 'dryLbs') ?? cached?.dryWeightLbs ?? null,
      gvwrLbs: extractSpecDouble(obj, 'gvwrLbs') ?? cached?.gvwrLbs ?? null,
      dealer: ifBlank(
        ifBlank(optString(obj, 'dealer'), () => optString(optObject(obj, 'dealer'), 'name')),
        () => cached?.dealerName ?? 'Dealer',
      ),
      highlights,
    });
  }
  const specRows: RvComparisonSpecRow[] = [];
  const comparison = optObject(structured, 'comparison');
  for (const raw of optArray(comparison, 'rows') ?? []) {
    if (!isObject(raw)) continue;
    const values = (optArray(raw, 'values') ?? []).map((v) =>
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : null,
    );
    specRows.push({
      spec: optString(raw, 'spec'),
      unit: optString(raw, 'unit'),
      values,
      bestIndex: optNullableInt(raw, 'bestIndex'),
    });
  }
  return {
    summaryText:
      optNullableString(structured, 'summary') ??
      ifBlank(readableText(text, 1000), () => 'Side-by-side comparison ready.'),
    rows,
    specRows,
  };
}

export function parseInquiryPreview(
  structured: JsonObject,
  text: string,
  input: { name: string; email?: string | null; phone?: string | null; message: string },
): DealerInquiryPreview {
  const previewObj = optObject(structured, 'preview') ?? structured;
  const token =
    optNullableString(structured, 'confirmation_token') ??
    optNullableString(structured, 'confirmationToken') ??
    optNullableString(previewObj, 'confirmation_token') ??
    optNullableString(previewObj, 'confirmationToken');
  if (!token) {
    throw new McpError('MatchRV did not return a confirmation token. Please check your contact details.');
  }
  const dealerObj = optObject(previewObj, 'dealer');
  const rvObj = optObject(previewObj, 'rv') ?? optObject(previewObj, 'unit');
  const shopperObj = optObject(previewObj, 'shopper');

  let dealerLocation: string | null;
  if (dealerObj) {
    const joined = [optNullableString(dealerObj, 'city'), optNullableString(dealerObj, 'state')]
      .filter((s): s is string => !!s)
      .join(', ');
    dealerLocation = joined.length > 0 ? joined : optNullableString(dealerObj, 'location');
  } else {
    dealerLocation = optNullableString(previewObj, 'dealerLocation');
  }

  return {
    confirmationToken: token,
    expiresAt: optNullableString(structured, 'expires_at') ?? optNullableString(structured, 'expiresAt'),
    dealerName:
      optNullableString(dealerObj, 'name') ??
      optNullableString(previewObj, 'dealerName') ??
      optNullableString(previewObj, 'dealer') ??
      'Dealership',
    dealerLocation,
    deliveryMethod:
      optNullableString(previewObj, 'deliveryMethod') ??
      optNullableString(previewObj, 'delivery') ??
      optNullableString(structured, 'deliveryMethod') ??
      'MatchRV Verified Dealer Delivery',
    rvTitle: optNullableString(rvObj, 'title') ?? optNullableString(previewObj, 'rvTitle') ?? 'RV Unit',
    vin: optNullableString(rvObj, 'vin') ?? optNullableString(previewObj, 'vin'),
    stockNumber:
      optNullableString(rvObj, 'stockNumber') ??
      optNullableString(rvObj, 'stock_number') ??
      optNullableString(previewObj, 'stockNumber'),
    priceUsd:
      optNullableDouble(rvObj, 'priceUsd') ?? optNullableDouble(rvObj, 'price') ?? optNullableDouble(previewObj, 'priceUsd'),
    shopperName: optNullableString(shopperObj, 'name') ?? input.name.trim(),
    shopperEmail: optNullableString(shopperObj, 'email') ?? input.email?.trim() ?? null,
    shopperPhone: optNullableString(shopperObj, 'phone') ?? input.phone?.trim() ?? null,
    message: optNullableString(previewObj, 'message') ?? input.message.trim(),
    rawSummary: text.trim().length > 0 ? text : null,
  };
}

export function normalizeInquiryStatus(raw: string | null | undefined, fallback: InquiryStatus): InquiryStatus {
  const lower = (raw ?? '').toLowerCase();
  return (INQUIRY_STATUSES as readonly string[]).includes(lower) ? (lower as InquiryStatus) : fallback;
}

export function parseInquiryReceipt(
  structured: JsonObject,
  text: string,
  dryRun: boolean,
  now: () => number = Date.now,
): DealerInquiryReceipt {
  const inquiryId =
    optNullableString(structured, 'inquiry_id') ?? optNullableString(structured, 'inquiryId') ?? `inq_${now()}`;
  const statusToken =
    optNullableString(structured, 'status_token') ?? optNullableString(structured, 'statusToken') ?? 'dry_run_token';
  const fallback: InquiryStatus = dryRun ? 'dry_run' : 'queued_for_matchrv';
  const status = normalizeInquiryStatus(optNullableString(structured, 'status') ?? fallback, fallback);
  return {
    inquiryId,
    statusToken,
    status,
    statusMessage:
      optNullableString(structured, 'message') ??
      optNullableString(structured, 'summary') ??
      ifBlank(readableText(text, 2000), () => `Inquiry recorded with status: ${status}`),
    dryRun: dryRun || status === 'dry_run',
  };
}

export function parseInquiryStatus(structured: JsonObject, text: string, inquiryId: string): DealerInquiryStatusResult {
  const replyObj = optObject(structured, 'reply') ?? optObject(structured, 'dealerReply');
  const replyText =
    optNullableString(replyObj, 'message') ??
    optNullableString(replyObj, 'body') ??
    optNullableString(structured, 'dealer_reply') ??
    optNullableString(structured, 'dealerReply');
  const rawStatus = optNullableString(structured, 'status') ?? 'queued_for_matchrv';
  const status: InquiryStatus = replyText ? 'replied' : normalizeInquiryStatus(rawStatus, 'queued_for_matchrv');
  return {
    inquiryId,
    status,
    dealerReply: replyText,
    statusSummary:
      optNullableString(structured, 'summary') ??
      ifBlank(readableText(text, 2000), () => `Current status: ${status}`),
  };
}
