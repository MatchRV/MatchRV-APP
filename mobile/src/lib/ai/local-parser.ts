// Deterministic keyword/regex fallback for Ask AI. Used when Firebase AI Logic isn't configured
// or fails (e.g. App Check enforcement blocks the JS SDK). Produces the same JSON shape as Gemini.
// Follows the same rule as the Gemini prompt: extract only what the shopper explicitly said.
import type { RvFeature, RvSort, RvType } from '../models/rv';
import type { AiParsedQuery, AskAiProvider } from './types';

const TYPE_PATTERNS: [RegExp, RvType[]][] = [
  [/\bclass[\s-]?a\b/, ['class_a']],
  [/\bclass[\s-]?b\b|\bcamper ?vans?\b|\bsprinter\b/, ['class_b']],
  [/\bclass[\s-]?c\b/, ['class_c']],
  [/\b(fifth|5th)[\s-]?wheels?\b/, ['fifth_wheel']],
  [/\btoy[\s-]?haulers?\b/, ['toy_hauler']],
  [/\bpop[\s-]?ups?\b|\btent trailers?\b|\bpopup campers?\b/, ['popup_camper']],
  [/\btruck campers?\b/, ['truck_camper']],
  [/\b(travel trailers?|bumper[\s-]pull|destination trailers?)\b/, ['travel_trailer']],
];

const FEATURE_PATTERNS: [RegExp, RvFeature][] = [
  [/\bbunk(house|s| beds?)?\b/, 'bunkhouse'],
  [/\boutdoor kitchen|outside kitchen\b/, 'outdoor_kitchen'],
  [/\bsolar\b/, 'solar'],
  [/\blithium\b/, 'lithium'],
  [/\bgenerator\b/, 'generator'],
  [/\b(four|4|all)[\s-]?seasons?\b/, 'four_season'],
  [/\b(two|2) (entry )?doors\b/, 'two_entry_doors'],
];

export const KNOWN_MAKES = [
  'Airstream', 'Alliance', 'Brinkley', 'Casita', 'Coachmen', 'Cruiser RV', 'Dutchmen', 'East to West',
  'Entegra', 'Fleetwood', 'Forest River', 'Grand Design', 'Gulf Stream', 'Heartland', 'Highland Ridge',
  'Holiday Rambler', 'Jayco', 'Keystone', 'KZ', 'Lance', 'Leisure Travel', 'Nash', 'Newmar', 'Northwood',
  'Oliver', 'Palomino', 'Prime Time', 'Riverside', 'Shasta', 'Starcraft', 'Thor', 'Tiffin', 'Venture',
  'Winnebago', 'Coleman', 'Rockwood', 'Flagstaff', 'Grand Design RV', 'nuCamp', 'inTech', 'Pleasure-Way',
  'Storyteller', 'Regency', 'Midwest Automotive', 'Drake',
];

const TOW_MAKES = 'ford|chevy|chevrolet|ram|dodge|gmc|toyota|nissan|jeep|honda|hyundai|kia|subaru|tesla|rivian|lincoln|cadillac|lexus|volkswagen|vw|mazda|land rover';

/** Parses "$60k", "60,000", "1.2m", "$45000" → USD. */
export function parseMoney(raw: string): number | null {
  const m = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|thousand|m|mil|million)?$/i.exec(raw.trim());
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  const unit = m[2]?.toLowerCase();
  if (unit === 'k' || unit === 'thousand') n *= 1000;
  else if (unit === 'm' || unit === 'mil' || unit === 'million') n *= 1_000_000;
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Money token: requires $ or a k/m suffix, or a comma-grouped number of at least 4 digits.
const MONEY = String.raw`(\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|thousand|million)?|\d[\d,]*(?:\.\d+)?\s?(?:k|thousand|m\b|million)|\d{1,3}(?:,\d{3})+)`;
const NOT_UNIT = String.raw`(?!\s?(?:ft|feet|foot|'|lbs?|pounds|mi\b|miles))`;

function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

export function parseLocally(prompt: string): AiParsedQuery {
  const text = prompt.trim();
  const lower = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const out: AiParsedQuery = { rvTypes: [], desiredFeatures: [], condition: 'any', sort: 'best_match' };
  const matched: string[] = [];

  // --- RV types ---
  const types = new Set<RvType>();
  for (const [re, t] of TYPE_PATTERNS) if (re.test(lower)) t.forEach((x) => types.add(x));
  if (/\bmotor ?homes?\b|\bmotorcoach(es)?\b/.test(lower) && ![...types].some((t) => t.startsWith('class_'))) {
    ['class_a', 'class_b', 'class_c'].forEach((x) => types.add(x as RvType));
  }
  if (types.size === 0 && /\btrailers?\b/.test(lower)) types.add('travel_trailer');
  out.rvTypes = [...types];
  if (types.size > 0) matched.push('RV type');

  // --- Price ---
  const between = new RegExp(String.raw`(?:between|from)\s+${MONEY}\s*(?:and|to|-)\s*${MONEY}`, 'i').exec(lower) ??
    new RegExp(String.raw`${MONEY}\s*(?:-|to)\s*${MONEY}`, 'i').exec(lower);
  if (between) {
    const a = parseMoney(between[1]);
    const b = parseMoney(between[2]);
    if (a != null && b != null) {
      out.priceMinUsd = Math.min(a, b);
      out.priceMaxUsd = Math.max(a, b);
    }
  }
  if (out.priceMaxUsd == null) {
    const max = new RegExp(String.raw`(?:under|below|less than|up to|max(?:imum)?|no more than|at most|budget(?: is| of)?|<)\s*(?:of\s*)?${MONEY}${NOT_UNIT}`, 'i').exec(lower);
    if (max) out.priceMaxUsd = parseMoney(max[1]);
  }
  if (out.priceMinUsd == null) {
    const min = new RegExp(String.raw`(?:over|above|more than|at least|starting at|min(?:imum)?|>)\s*${MONEY}${NOT_UNIT}`, 'i').exec(lower);
    if (min) out.priceMinUsd = parseMoney(min[1]);
  }
  if (out.priceMinUsd == null && out.priceMaxUsd == null) {
    const around = new RegExp(String.raw`(?:around|about|roughly|~)\s*${MONEY}${NOT_UNIT}`, 'i').exec(lower);
    if (around) {
      const v = parseMoney(around[1]);
      if (v != null) {
        // "around X" is a rough target, not a hard range: ±15%.
        out.priceMinUsd = Math.round(v * 0.85);
        out.priceMaxUsd = Math.round(v * 1.15);
      }
    }
  }
  if (out.priceMinUsd != null || out.priceMaxUsd != null) matched.push('budget');

  // --- Length ---
  const lenMax = /(?:under|below|less than|shorter than|max(?:imum)?|no (?:longer|more) than|up to|at most|<)\s*(\d{2})\s*(?:ft|feet|foot|')/.exec(lower) ??
    /(\d{2})\s*(?:ft|feet|foot|')\s*(?:or (?:less|shorter|under)|max)/.exec(lower);
  if (lenMax) {
    const v = parseInt(lenMax[1], 10);
    if (v >= 8 && v <= 60) out.lengthMaxFt = v;
  }
  if (out.lengthMaxFt == null) {
    const fits = /(?:fit|fits) (?:in )?(?:a |my )?(\d{2})\s*(?:ft|feet|foot|')/.exec(lower);
    if (fits) out.lengthMaxFt = parseInt(fits[1], 10);
  }
  if (out.lengthMaxFt != null) matched.push('length');

  // --- Sleeps ---
  const sleeps =
    /\bsleeps?\s*(?:at least\s*)?(\d{1,2})\b/.exec(lower) ??
    /\bfor\s*(\d{1,2})\s*(?:people|persons|adults|of us|campers)\b/.exec(lower) ??
    /\bfamily of\s*(\d{1,2})\b/.exec(lower) ??
    /\b(\d{1,2})\s*(?:people|persons|sleeping spots|berths)\b/.exec(lower);
  if (sleeps) {
    const v = parseInt(sleeps[1], 10);
    if (v >= 1 && v <= 14) {
      out.sleepsMin = v;
      matched.push('sleeping capacity');
    }
  }

  // --- Radius ---
  const radius = /\bwithin\s*(\d{1,4})\s*(?:mi|miles)\b/.exec(lower) ?? /\b(\d{1,4})\s*(?:mi|miles)\s*(?:of|from|radius)\b/.exec(lower);
  if (radius) {
    const v = parseInt(radius[1], 10);
    if (v >= 1 && v <= 3000) out.radiusMiles = v;
  }

  // --- Location: ZIP first, then "near/in City, ST" ---
  const zipMatch = /(?:^|[^\d$,.])(\d{5})(?![\d,]|\s?(?:k|lbs?|pounds|ft|feet|mi|miles))/.exec(text);
  if (zipMatch) {
    out.location = zipMatch[1];
  } else {
    const city =
      /\b(?:near|in|around|close to|by|of)\s+([A-Za-z][A-Za-z.' -]{1,40}?,\s*[A-Za-z]{2})\b/.exec(text) ??
      /\b(?:near|in|around|close to)\s+([A-Z][a-zA-Z.'-]+(?:\s[A-Z][a-zA-Z.'-]+){0,2})\b/.exec(text);
    if (city) out.location = city[1].trim();
  }
  if (out.location) matched.push('location');

  // --- Tow rating & vehicle ---
  const rating =
    /(?:tow(?:ing)?\s*(?:capacity|rating|limit)?|rated(?:\s*(?:to|for|at))?|pull(?:s|ing)?)\s*(?:of|is|up to|:)?\s*(\d{1,2},?\d{3})\s*(?:lbs?|pounds)?/.exec(lower) ??
    /(\d{1,2},?\d{3})\s*(?:lbs?|pounds)\s*(?:tow|towing)/.exec(lower);
  if (rating) {
    const v = parseInt(rating[1].replace(/,/g, ''), 10);
    if (v >= 1000 && v <= 40000) out.truckTowRatingLbs = v;
  }
  const veh = new RegExp(
    String.raw`\b((?:19|20)\d{2}\s+)?(${TOW_MAKES})\s+([a-z0-9-]+(?:\s+(?!with\b|and\b|that\b|to\b|under\b|for\b)[a-z0-9.-]+){0,2})`,
    'i',
  ).exec(text);
  if (veh && /\b(tow|towing|pull|pulling|truck|suv|my|have a|drive)\b/i.test(text)) {
    out.towVehicle = `${veh[1] ?? ''}${titleCase(veh[2])} ${veh[3].toUpperCase() === veh[3] ? veh[3] : titleCase(veh[3])}`.trim();
  }
  if (out.towVehicle || out.truckTowRatingLbs != null) matched.push('tow vehicle');

  // --- Condition ---
  if (/\b(used|pre-?owned|second[\s-]hand)\b/.test(lower)) out.condition = 'used';
  else if (/\bnew\b(?!\s+to\b)/.test(lower)) out.condition = 'new'; // "newest" / "new to RVing" don't count
  if (out.condition !== 'any') matched.push('condition');

  // --- Features ---
  const features = new Set<RvFeature>();
  for (const [re, f] of FEATURE_PATTERNS) if (re.test(lower)) features.add(f);
  out.desiredFeatures = [...features];
  if (features.size > 0) matched.push('features');

  // --- Fuel (only if explicitly stated) ---
  if (/\bdiesel\b/.test(lower)) out.fuelType = 'diesel';
  else if (/\b(gas|gasoline)\b(?!\s+(grill|stove|range|oven|cooktop))/.test(lower)) out.fuelType = 'gas';

  // --- Make ---
  const make = KNOWN_MAKES.find((m) => new RegExp(String.raw`\b${m.replace(/[-]/g, '[- ]?')}\b`, 'i').test(text));
  if (make) {
    out.make = make;
    matched.push('brand');
  }

  // --- Keywords (same slide-out rule as the Gemini prompt) ---
  if (/\bslide[\s-]?outs?\b/.test(lower)) out.keywords = 'slide-out';

  // --- Sort ---
  let sort: RvSort = 'best_match';
  if (/\b(cheapest|lowest price|least expensive)\b/.test(lower)) sort = 'price_asc';
  else if (/\b(closest|nearest)\b/.test(lower)) sort = 'distance';
  else if (/\b(newest|latest model)\b/.test(lower)) sort = 'newest_model_year';
  else if (/\b(most expensive|highest price|luxury)\b/.test(lower)) sort = 'price_desc';
  out.sort = sort;

  out.agentSummary =
    matched.length > 0
      ? `Matched your request on ${matched.join(', ')} using MatchRV's on-device parser.`
      : "Couldn't pick out specific filters, so here are top live matches — try adding a type, budget, or ZIP.";
  out.outfitterTip = out.towVehicle || out.truckTowRatingLbs
    ? 'Payload usually runs out before tow rating — check your door-jamb sticker and compare it with the RV’s loaded tongue weight.'
    : out.lengthMaxFt != null
      ? 'Measure your storage spot and driveway turns; listed length often excludes the hitch and bumper.'
      : 'Confirm current lot availability and out-the-door pricing directly with the dealer.';
  return out;
}

export class LocalKeywordProvider implements AskAiProvider {
  readonly id = 'local' as const;
  readonly label = 'On-device keyword parser';
  isAvailable() {
    return true;
  }
  async parse(prompt: string): Promise<AiParsedQuery> {
    return parseLocally(prompt);
  }
}
