// Filter sheet form <-> RvSearchFilter mapping (same rules as buildFilter() in FilterBottomSheet.kt).
import type { RvCondition, RvFeature, RvSearchFilter, RvSort, RvType } from '../models/rv';

/** Pure: sheet form → filter (same rules as buildFilter() in FilterBottomSheet.kt). */
export function buildFilterFromForm(base: RvSearchFilter, form: FilterForm): RvSearchFilter {
  const min = Number(form.priceMin);
  const max = Number(form.priceMax);
  const rating = Number(form.towRating);
  return {
    ...base,
    rvTypes: form.rvTypes,
    priceMinUsd: form.priceMin && min > 0 ? min : null,
    priceMaxUsd: form.priceMax && max > 0 ? max : null,
    location: form.location.trim(),
    radiusMiles: form.location.trim() ? form.radiusMiles : null,
    condition: form.condition,
    sleepsMin: form.sleepsMin > 0 ? form.sleepsMin : null,
    lengthMaxFt: form.lengthMaxFt != null && form.lengthMaxFt >= 12 ? form.lengthMaxFt : null,
    towVehicle: form.towVehicle.trim(),
    truckTowRatingLbs: form.towRating && rating > 0 ? rating : null,
    desiredFeatures: form.features,
    sort: form.sort,
  };
}

export interface FilterForm {
  rvTypes: RvType[];
  priceMin: string;
  priceMax: string;
  location: string;
  radiusMiles: number;
  condition: RvCondition;
  sleepsMin: number;
  lengthMaxFt: number | null;
  towVehicle: string;
  towRating: string;
  features: RvFeature[];
  sort: RvSort;
}

export function formFromFilter(f: RvSearchFilter): FilterForm {
  return {
    rvTypes: f.rvTypes,
    priceMin: f.priceMinUsd != null ? String(Math.trunc(f.priceMinUsd)) : '',
    priceMax: f.priceMaxUsd != null ? String(Math.trunc(f.priceMaxUsd)) : '',
    location: f.location,
    radiusMiles: f.radiusMiles ?? 200,
    condition: f.condition,
    sleepsMin: f.sleepsMin ?? 0,
    lengthMaxFt: f.lengthMaxFt,
    towVehicle: f.towVehicle,
    towRating: f.truckTowRatingLbs != null ? String(Math.trunc(f.truckTowRatingLbs)) : '',
    features: f.desiredFeatures,
    sort: f.sort,
  };
}

export const EMPTY_FORM: FilterForm = {
  rvTypes: [], priceMin: '', priceMax: '', location: '', radiusMiles: 200, condition: 'any', sleepsMin: 0,
  lengthMaxFt: null, towVehicle: '', towRating: '', features: [], sort: 'best_match',
};

