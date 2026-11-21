import { buildCriteriaChips, parseWithFallback, runAgentSearch } from '../ask-ai';
import { LocalKeywordProvider, parseLocally, parseMoney } from '../local-parser';
import { buildAgentInstruction, parsedQueryToFilter, type AskAiProvider } from '../types';

const filterOf = (prompt: string) => parsedQueryToFilter(parseLocally(prompt));

describe('local Ask AI fallback parser', () => {
  it('parses money formats', () => {
    expect(parseMoney('$60k')).toBe(60000);
    expect(parseMoney('60,000')).toBe(60000);
    expect(parseMoney('1.2m')).toBe(1_200_000);
    expect(parseMoney('$45000')).toBe(45000);
    expect(parseMoney('abc')).toBeNull();
  });

  it('Class C under $60k within 200 miles of a ZIP with a slide-out', () => {
    const f = filterOf('Class C under $60k within 200 miles of 80202 with a slide-out');
    expect(f.rvTypes).toEqual(['class_c']);
    expect(f.priceMaxUsd).toBe(60000);
    expect(f.priceMinUsd).toBeNull();
    expect(f.location).toBe('80202');
    expect(f.radiusMiles).toBe(200);
    expect(f.query).toBe('slide-out');
  });

  it('motorhome maps to all motorized classes (same rule as the Gemini prompt)', () => {
    expect(filterOf('a diesel motorhome').rvTypes).toEqual(['class_a', 'class_b', 'class_c']);
    expect(filterOf('a diesel motorhome').fuelType).toBe('diesel');
  });

  it('travel trailer: sleeps, length and tow vehicle/rating', () => {
    const f = filterOf('Travel trailer that sleeps 6, under 30 ft, I tow with a 2021 Ford F-150 rated 9,000 lbs');
    expect(f.rvTypes).toEqual(['travel_trailer']);
    expect(f.sleepsMin).toBe(6);
    expect(f.lengthMaxFt).toBe(30);
    expect(f.priceMaxUsd).toBeNull(); // "under 30 ft" is length, not price
    expect(f.towVehicle).toMatch(/^2021 Ford F-150/);
    expect(f.truckTowRatingLbs).toBe(9000);
  });

  it('used fifth wheel with features, price range, city/state and brand', () => {
    const f = filterOf('Used Grand Design fifth wheel with a bunkhouse and outdoor kitchen between $40k and $55k near Boise, ID');
    expect(f.rvTypes).toEqual(['fifth_wheel']);
    expect(f.condition).toBe('used');
    expect(f.desiredFeatures.sort()).toEqual(['bunkhouse', 'outdoor_kitchen']);
    expect(f.priceMinUsd).toBe(40000);
    expect(f.priceMaxUsd).toBe(55000);
    expect(f.location).toBe('Boise, ID');
    expect(f.make).toBe('Grand Design');
  });

  it('does not invent facts or misread non-condition "new"', () => {
    const f = filterOf("I'm new to RVing, show me the newest toy hauler");
    expect(f.rvTypes).toEqual(['toy_hauler']);
    expect(f.condition).toBe('any');
    expect(f.sort).toBe('newest_model_year');
    expect(f.location).toBe('');
    expect(f.towVehicle).toBe('');
    expect(f.fuelType).toBeNull();
    expect(f.priceMaxUsd).toBeNull();
    expect(filterOf('outdoor kitchen with a gas grill').fuelType).toBeNull();
  });

  it('handles "over", "around" and family size', () => {
    expect(filterOf('class a over $200k').priceMinUsd).toBe(200000);
    const around = filterOf('pop-up around $20k for a family of 4');
    expect(around.rvTypes).toEqual(['popup_camper']);
    expect(around.priceMinUsd).toBe(17000);
    expect(around.priceMaxUsd).toBe(23000);
    expect(around.sleepsMin).toBe(4);
    expect(filterOf('new 4-season truck camper, cheapest first').desiredFeatures).toEqual(['four_season']);
    expect(filterOf('new 4-season truck camper, cheapest first').sort).toBe('price_asc');
    expect(filterOf('new 4-season truck camper, cheapest first').condition).toBe('new');
  });

  it('always returns a summary and tip', () => {
    const p = parseLocally('something nice');
    expect(p.agentSummary).toBeTruthy();
    expect(p.outfitterTip).toBeTruthy();
  });
});

describe('parsedQueryToFilter (Gemini JSON -> filter, mirrors Kotlin)', () => {
  it('validates enums and fuel type', () => {
    const f = parsedQueryToFilter({
      rvTypes: ['class_c', 'spaceship'],
      desiredFeatures: ['solar', 'jacuzzi'],
      condition: 'NEW',
      fuelType: 'Electric',
      sort: 'nope',
      sleepsMin: '4' as unknown as number,
      keywords: 'slide-out',
    });
    expect(f.rvTypes).toEqual(['class_c']);
    expect(f.desiredFeatures).toEqual(['solar']);
    expect(f.condition).toBe('new');
    expect(f.fuelType).toBeNull();
    expect(f.sort).toBe('best_match');
    expect(f.sleepsMin).toBe(4);
    expect(f.query).toBe('slide-out');
  });

  it('builds the same instruction text and chips as Kotlin', () => {
    expect(buildAgentInstruction('x')).toContain('- Shopper request: "x"');
    expect(buildCriteriaChips(parsedQueryToFilter({ rvTypes: ['class_c'], priceMaxUsd: 60000, location: 'Denver', radiusMiles: 200 }))).toEqual([
      'Class C',
      'Under $60000',
      'Denver (200mi)',
    ]);
  });
});

describe('provider fallback', () => {
  const local = new LocalKeywordProvider();
  const failing: AskAiProvider = { id: 'firebase-ai', label: 'x', isAvailable: () => true, parse: async () => Promise.reject(new Error('App Check token rejected')) };
  const unavailable: AskAiProvider = { ...failing, isAvailable: () => false };
  const working: AskAiProvider = { ...failing, parse: async () => ({ rvTypes: ['class_b'], agentSummary: 'AI says hi' }) };

  it('uses the primary when it works', async () => {
    const r = await parseWithFallback('van', working, local);
    expect(r.source).toBe('firebase-ai');
    expect(r.fallbackReason).toBeNull();
  });

  it('falls back with a reason when the primary fails or is unavailable', async () => {
    expect(await parseWithFallback('class c', failing, local)).toMatchObject({ source: 'local', fallbackReason: 'App Check token rejected' });
    expect((await parseWithFallback('class c', unavailable, local)).fallbackReason).toMatch(/not configured/);
  });

  it('runAgentSearch feeds the filter into search and returns the live count', async () => {
    const search = jest.fn(async () => ({ units: [], eligibleUnitsCount: 77, scope: 'nationwide', expandedRadiusMiles: null, timingMs: 1 }));
    const r = await runAgentSearch('  class c under $50k ', { primary: null, fallback: local, search });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ rvTypes: ['class_c'], priceMaxUsd: 50000 }));
    expect(r.eligibleUnitsCount).toBe(77);
    expect(r.userPrompt).toBe('class c under $50k');
    await expect(runAgentSearch('  ', { primary: null, fallback: local, search })).rejects.toThrow();
  });
});
