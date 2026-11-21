import { buildFilterFromForm, formFromFilter, EMPTY_FORM } from '../../logic/filter-form';
import { emptyFilter } from '../../models/rv';
import {
  buildCompareArgs,
  buildPrepareInquiryArgs,
  buildSearchArgs,
  buildSendInquiryArgs,
  buildTowFitArgs,
} from '../args';

describe('buildSearchArgs (filter -> search_rvs arguments)', () => {
  it('sends only the base arguments for an empty filter', () => {
    expect(buildSearchArgs(emptyFilter())).toEqual({
      shopper_requested_results_now: true,
      shopper_words: 'just show me matching RVs',
      limit: 10,
      sort: 'best_match',
    });
  });

  it('maps every field with Kotlin clamps and truncation', () => {
    const args = buildSearchArgs(
      emptyFilter({
        rvTypes: ['class_c', 'travel_trailer'],
        priceMinUsd: 10_000,
        priceMaxUsd: 9_000_000,
        location: '  Austin, TX  ',
        radiusMiles: 5000,
        condition: 'used',
        sleepsMin: 20,
        lengthMinFt: 2,
        lengthMaxFt: 30,
        towVehicle: ' 2022 Ford F-150 ',
        truckTowRatingLbs: 500,
        desiredFeatures: ['solar', 'bunkhouse'],
        fuelType: 'diesel',
        make: ' Winnebago ',
        query: ' slide-out ',
        sort: 'price_asc',
      }),
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      25,
    );
    expect(args).toEqual({
      shopper_requested_results_now: true,
      shopper_words: 'just show me matching RVs',
      limit: 10,
      rv_types: ['class_c', 'travel_trailer'],
      price_min_usd: 10_000,
      price_max_usd: 2_000_000,
      location: 'Austin, TX',
      radius_miles: 3000,
      condition: 'used',
      sleeps_min: 14,
      length_max_ft: 30,
      tow_vehicle: '2022 Ford F-150',
      truck_tow_rating_lbs: 1000,
      desired_features: ['solar', 'bunkhouse'],
      fuel_type: 'diesel',
      make: 'Winnebago',
      query: 'slide-out',
      exclude_models: ['A', 'B', 'C', 'D', 'E', 'F'],
      sort: 'price_asc',
      constraints: { lengthMinFt: 8 },
    });
  });

  it('omits radius without location, zero prices, "any" condition and unknown fuel', () => {
    const args = buildSearchArgs(emptyFilter({ radiusMiles: 100, priceMinUsd: 0, fuelType: 'electric', limit: 0 } as never), [], 0);
    expect(args).not.toHaveProperty('radius_miles');
    expect(args).not.toHaveProperty('price_min_usd');
    expect(args).not.toHaveProperty('condition');
    expect(args).not.toHaveProperty('fuel_type');
    expect(args.limit).toBe(1);
  });
});

describe('other tool argument shapes', () => {
  it('evaluate_tow_fit', () => {
    expect(buildTowFitArgs({ unitIds: ['1', '2', '3', '4', '5', '6', '7'], vehicle: ' Ram 2500 ', truckPayloadLbs: 2000, passengersLbs: 0, cargoLbs: -1 })).toEqual({
      unit_ids: ['1', '2', '3', '4', '5', '6'],
      vehicle: 'Ram 2500',
      truck_payload_lbs: 2000,
      passengers_lbs: 0,
    });
    expect(() => buildTowFitArgs({ unitIds: [], vehicle: 'x' })).toThrow();
    expect(() => buildTowFitArgs({ unitIds: ['1'], vehicle: ' ' })).toThrow('Please enter your tow vehicle');
  });

  it('compare_rvs requires 2-4 ids', () => {
    expect(buildCompareArgs(['a', 'b'])).toEqual({ unit_ids: ['a', 'b'] });
    expect(() => buildCompareArgs(['a'])).toThrow();
    expect(() => buildCompareArgs(['a', 'b', 'c', 'd', 'e'])).toThrow();
  });

  it('prepare_dealer_inquiry validation and shape', () => {
    expect(buildPrepareInquiryArgs({ unitId: 'u', name: ' Pat ', email: ' p@example.com ', phone: '', message: ' Hi ' })).toEqual({
      unit_id: 'u',
      name: 'Pat',
      email: 'p@example.com',
      message: 'Hi',
    });
    expect(() => buildPrepareInquiryArgs({ unitId: 'u', name: 'Pat', message: 'Hi' })).toThrow(/email address or phone/);
    expect(() => buildPrepareInquiryArgs({ unitId: 'u', name: '', email: 'a@b.c', message: 'Hi' })).toThrow(/name/);
  });

  it('send_dealer_inquiry always sets confirmed and only sets dry_run when requested', () => {
    expect(buildSendInquiryArgs('tok')).toEqual({ confirmation_token: 'tok', confirmed: true });
    expect(buildSendInquiryArgs('tok', true)).toEqual({ confirmation_token: 'tok', confirmed: true, dry_run: true });
    expect(() => buildSendInquiryArgs(' ')).toThrow();
  });
});

describe('filter sheet form mapping', () => {
  it('round-trips and applies FilterBottomSheet rules', () => {
    const base = emptyFilter({ make: 'Jayco' });
    const f = buildFilterFromForm(base, {
      ...EMPTY_FORM,
      rvTypes: ['fifth_wheel'],
      priceMax: '60000',
      priceMin: '0',
      location: '',
      radiusMiles: 500,
      sleepsMin: 0,
      lengthMaxFt: 35,
      towRating: '',
    });
    expect(f).toMatchObject({ make: 'Jayco', rvTypes: ['fifth_wheel'], priceMaxUsd: 60000, priceMinUsd: null, radiusMiles: null, sleepsMin: null, lengthMaxFt: 35, truckTowRatingLbs: null });
    expect(formFromFilter(f)).toMatchObject({ priceMax: '60000', lengthMaxFt: 35, radiusMiles: 200 });
    expect(buildFilterFromForm(base, { ...EMPTY_FORM, location: 'Boise', radiusMiles: 100 }).radiusMiles).toBe(100);
  });
});
