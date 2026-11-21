import { buildAnalyticsPayload, buildInquiryPayload, buildSavedAlertPayload, buildSavedRvPayload } from '../../firebase/payloads';
import { alertToSearchFilter, priceDropAmountUsd, sanitizeFirestoreDocId, type SavedRvRecord, type SavedSearchAlertRecord } from '../../models/firestore';
import { activeFilterCount, emptyFilter, filterSummaryLabel, type RvSummary } from '../../models/rv';
import { alertsToCheck, computeAlertCheck, newMatchesMessage } from '../alerts';
import { extractModelToken, nextPageRequest } from '../deck';
import { computeSavedPriceUpdate, priceDropMessage, selectRvsForPriceCheck } from '../price-drop';

const saved = (over: Partial<SavedRvRecord> = {}): SavedRvRecord => ({
  id: 's1', userId: 'u', unitId: 'vin:1', title: 'T', make: '', rvType: '', dealerName: '', dealerState: '',
  savedPriceUsd: 50000, lastCheckedPriceUsd: 50000, hasPriceDrop: false, ...over,
});
const alert = (over: Partial<SavedSearchAlertRecord> = {}): SavedSearchAlertRecord => ({
  id: 'a1', userId: 'u', label: 'L', alertsEnabled: true, matchCount: 0, newMatchCount: 0, rvTypes: [], lastCheckedUnitIds: [], ...over,
});
const summary = (over: Partial<RvSummary> = {}): RvSummary => ({
  unitId: 'u1', title: '2024 Jayco Jay Flight 264BH', make: 'Jayco', priceUsd: 30000, lengthFt: null, dryWeightLbs: null, gvwrLbs: null,
  sleeps: 6.0, distanceMi: null, dealer: 'D', dealerState: 'TX', matchScore: null, verified: true, floorplan: null, walkthroughUrl: null,
  walkthroughLabel: null, listingUrl: null, thumbnailUrl: null, rvType: 'travel_trailer', condition: 'new', year: 2024, isHydrated: false, ...over,
});

describe('price-drop logic (mirrors refreshSavedPricesNow / updateSavedRvPrice)', () => {
  it('flags a drop only when the live price is below a positive baseline', () => {
    expect(computeSavedPriceUpdate(50000, 45000)).toEqual({ lastCheckedPriceUsd: 45000, hasPriceDrop: true });
    expect(computeSavedPriceUpdate(50000, 52000)).toEqual({ lastCheckedPriceUsd: 52000, hasPriceDrop: false });
    expect(computeSavedPriceUpdate(50000, 50000)?.hasPriceDrop).toBe(false);
    expect(computeSavedPriceUpdate(0, 45000)).toEqual({ lastCheckedPriceUsd: 45000, hasPriceDrop: false });
  });

  it('skips missing / non-positive live prices and clamps huge ones', () => {
    expect(computeSavedPriceUpdate(50000, null)).toBeNull();
    expect(computeSavedPriceUpdate(50000, 0)).toBeNull();
    expect(computeSavedPriceUpdate(50000, 9_000_000)?.lastCheckedPriceUsd).toBe(5_000_000);
  });

  it('computes the drop amount like SavedRvRecord.priceDropAmountUsd', () => {
    expect(priceDropAmountUsd(saved({ hasPriceDrop: true, lastCheckedPriceUsd: 47500 }))).toBe(2500);
    expect(priceDropAmountUsd(saved({ hasPriceDrop: false, lastCheckedPriceUsd: 47500 }))).toBe(0);
    expect(priceDropAmountUsd(saved({ hasPriceDrop: true, lastCheckedPriceUsd: 0 }))).toBe(0);
  });

  it('checks at most 10 saved RVs and builds messages', () => {
    expect(selectRvsForPriceCheck(Array.from({ length: 14 }, (_, i) => saved({ id: `s${i}` })))).toHaveLength(10);
    expect(priceDropMessage(1)).toBe('1 saved RV dropped in price!');
    expect(priceDropMessage(3)).toBe('3 saved RVs dropped in price!');
    expect(priceDropMessage(0)).toMatch(/all up to date/);
  });
});

describe('saved-search alert new-match logic (seen IDs)', () => {
  it('counts unseen IDs against lastCheckedUnitIds and stores the latest 10', () => {
    const latest = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
    const r = computeAlertCheck(alert({ lastCheckedUnitIds: ['a', 'b', 'z'] }), latest);
    expect(r.newMatchCount).toBe(9);
    expect(r.matchCount).toBe(11);
    expect(r.lastCheckedUnitIds).toEqual(latest.slice(0, 10));
  });

  it('reports zero new matches when everything was seen, and integer counts', () => {
    const r = computeAlertCheck(alert({ lastCheckedUnitIds: ['a', 'b'] }), ['b', 'a']);
    expect(r).toEqual({ matchCount: 2, newMatchCount: 0, lastCheckedUnitIds: ['b', 'a'] });
    expect(Number.isInteger(r.matchCount) && Number.isInteger(r.newMatchCount)).toBe(true);
  });

  it('only checks enabled alerts; messages pluralize', () => {
    expect(alertsToCheck([alert(), alert({ id: 'off', alertsEnabled: false })]).map((a) => a.id)).toEqual(['a1']);
    expect(newMatchesMessage(1)).toBe('1 new dealer RV match found for your alerts!');
    expect(newMatchesMessage(2)).toBe('2 new dealer RV matches found for your alerts!');
    expect(newMatchesMessage(0)).toMatch(/no unseen matches/);
  });

  it('restores a filter from a stored alert', () => {
    const f = alertToSearchFilter(alert({ rvTypes: ['class_c', 'bogus'], priceMaxUsd: 60000, condition: 'used', sort: 'price_asc', sleepsMin: 4 }));
    expect(f).toMatchObject({ rvTypes: ['class_c'], priceMaxUsd: 60000, condition: 'used', sort: 'price_asc', sleepsMin: 4, location: '' });
  });
});

describe('filter model helpers', () => {
  it('counts active filters and builds the summary label', () => {
    const f = emptyFilter({ rvTypes: ['class_c'], priceMaxUsd: 60000, location: 'Austin, TX', radiusMiles: 200, sleepsMin: 4 });
    expect(activeFilterCount(f)).toBe(4);
    expect(filterSummaryLabel(f)).toBe('Class C • under $60k • within 200mi of Austin, TX • sleeps 4+');
    expect(filterSummaryLabel(emptyFilter())).toBe('All RVs');
  });
});

describe('deck pagination', () => {
  it('extracts model tokens like Kotlin', () => {
    expect(extractModelToken('2024 Jayco Jay Flight 264BH')).toBe('Jay Flight');
    expect(extractModelToken('2024')).toBeNull();
  });
  it('excludes seen models, otherwise steps the price band', () => {
    expect(nextPageRequest(emptyFilter(), [], ['Jay Flight']).excludeModels).toEqual(['Jay Flight']);
    expect(nextPageRequest(emptyFilter(), [summary({ priceUsd: 30000 })], []).filter.priceMinUsd).toBe(30500);
  });
});

describe('Firestore payloads match firestore.rules', () => {
  const TS = { __ts: true };
  it('saved RV: required keys, int fields, no nulls', () => {
    const p = buildSavedRvPayload('uid1', summary({ sleeps: 6.4 }), null, TS);
    expect(Object.keys(p).sort()).toEqual(
      ['userId', 'unitId', 'title', 'make', 'rvType', 'dealerName', 'dealerState', 'savedPriceUsd', 'lastCheckedPriceUsd', 'hasPriceDrop', 'sleeps', 'condition', 'year', 'createdAt', 'updatedAt'].sort(),
    );
    expect(p.sleeps).toBe(6);
    expect(Object.values(p).includes(null)).toBe(false);
  });
  it('alert payload omits empty optional fields', () => {
    const p = buildSavedAlertPayload('uid1', emptyFilter({ sleepsMin: 3 }), ['a', 'b'], TS);
    expect(p).toMatchObject({ label: 'All RVs • sleeps 3+', alertsEnabled: true, matchCount: 2, newMatchCount: 0, sort: 'best_match', lastCheckedUnitIds: ['a', 'b'] });
    expect(p).not.toHaveProperty('rvTypes');
    expect(p).not.toHaveProperty('location');
  });
  it('inquiry payload sanitizes status; analytics validates event type', () => {
    const p = buildInquiryPayload('u', { mcpInquiryId: 'i', statusToken: 't', unitId: 'x', rvTitle: '', dealerName: '', status: 'weird', message: '', dryRun: true }, TS);
    expect(p).toMatchObject({ status: 'queued_for_matchrv', rvTitle: 'RV Unit', dealerName: 'Dealership', message: 'Dealer inquiry' });
    expect(() => buildAnalyticsPayload('u', 'bogus' as never, {}, TS)).toThrow();
  });
  it('sanitizes document ids', () => {
    expect(sanitizeFirestoreDocId('vin:ABC/123')).toBe('vin_ABC_123');
    expect(sanitizeFirestoreDocId('***', () => 5)).toBe('item_5');
  });
});
