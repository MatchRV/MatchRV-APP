// Tool argument builders — same shapes/clamps as MatchRvMcpClient.kt.
import type { RvSearchFilter } from '../models/rv';
import { clamp, type JsonObject } from './json';

const notBlank = (s: string | null | undefined): s is string => !!s && s.trim().length > 0;

export function buildSearchArgs(
  filter: RvSearchFilter,
  excludeModels: string[] = [],
  limit = 10,
): JsonObject {
  const args: JsonObject = {
    shopper_requested_results_now: true,
    shopper_words: 'just show me matching RVs',
    limit: clamp(Math.trunc(limit), 1, 10),
  };
  if (filter.rvTypes.length > 0) args.rv_types = [...filter.rvTypes];
  if (filter.priceMinUsd != null && filter.priceMinUsd > 0) {
    args.price_min_usd = clamp(filter.priceMinUsd, 0, 2_000_000);
  }
  if (filter.priceMaxUsd != null && filter.priceMaxUsd > 0) {
    args.price_max_usd = clamp(filter.priceMaxUsd, 0, 2_000_000);
  }
  if (notBlank(filter.location)) {
    args.location = filter.location.trim().slice(0, 80);
    if (filter.radiusMiles != null) args.radius_miles = clamp(filter.radiusMiles, 1, 3000);
  }
  if (filter.condition !== 'any') args.condition = filter.condition;
  if (filter.sleepsMin != null) args.sleeps_min = clamp(Math.trunc(filter.sleepsMin), 1, 14);
  if (filter.lengthMaxFt != null) args.length_max_ft = clamp(filter.lengthMaxFt, 8, 60);
  if (notBlank(filter.towVehicle)) args.tow_vehicle = filter.towVehicle.trim().slice(0, 120);
  if (filter.truckTowRatingLbs != null) {
    args.truck_tow_rating_lbs = clamp(filter.truckTowRatingLbs, 1000, 40000);
  }
  if (filter.desiredFeatures.length > 0) args.desired_features = [...filter.desiredFeatures];
  if (notBlank(filter.fuelType) && (filter.fuelType === 'gas' || filter.fuelType === 'diesel')) {
    args.fuel_type = filter.fuelType;
  }
  if (notBlank(filter.make)) args.make = filter.make.trim().slice(0, 60);
  if (notBlank(filter.query)) args.query = filter.query.trim().slice(0, 240);
  if (excludeModels.length > 0) args.exclude_models = excludeModels.slice(0, 6);
  args.sort = filter.sort;
  if (filter.lengthMinFt != null) {
    args.constraints = { lengthMinFt: clamp(filter.lengthMinFt, 8, 60) };
  }
  return args;
}

export function buildTowFitArgs(input: {
  unitIds: string[];
  vehicle: string;
  truckPayloadLbs?: number | null;
  passengersLbs?: number | null;
  cargoLbs?: number | null;
}): JsonObject {
  if (input.unitIds.length === 0) throw new Error('At least one RV unit is required');
  if (!notBlank(input.vehicle)) throw new Error('Please enter your tow vehicle');
  const args: JsonObject = {
    unit_ids: input.unitIds.slice(0, 6),
    vehicle: input.vehicle.trim().slice(0, 120),
  };
  if (input.truckPayloadLbs != null && input.truckPayloadLbs > 0) args.truck_payload_lbs = input.truckPayloadLbs;
  if (input.passengersLbs != null && input.passengersLbs >= 0) args.passengers_lbs = input.passengersLbs;
  if (input.cargoLbs != null && input.cargoLbs >= 0) args.cargo_lbs = input.cargoLbs;
  return args;
}

export function buildCompareArgs(unitIds: string[]): JsonObject {
  if (unitIds.length < 2 || unitIds.length > 4) throw new Error('Select 2 to 4 RVs to compare');
  return { unit_ids: [...unitIds] };
}

export function buildPrepareInquiryArgs(input: {
  unitId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  message: string;
}): JsonObject {
  if (!notBlank(input.name)) throw new Error('Please enter your name.');
  if (!notBlank(input.email) && !notBlank(input.phone)) {
    throw new Error('Please provide an email address or phone number.');
  }
  if (!notBlank(input.message)) throw new Error('Please include a message for the dealer.');
  const args: JsonObject = {
    unit_id: input.unitId,
    name: input.name.trim().slice(0, 100),
  };
  if (notBlank(input.email)) args.email = input.email.trim().slice(0, 120);
  if (notBlank(input.phone)) args.phone = input.phone.trim().slice(0, 40);
  args.message = input.message.trim().slice(0, 1800);
  return args;
}

export function buildSendInquiryArgs(confirmationToken: string, dryRun = false): JsonObject {
  if (!notBlank(confirmationToken)) throw new Error('Missing confirmation token.');
  const args: JsonObject = { confirmation_token: confirmationToken, confirmed: true };
  if (dryRun) args.dry_run = true;
  return args;
}

export function buildInquiryStatusArgs(inquiryId: string, statusToken: string): JsonObject {
  return { inquiry_id: inquiryId, status_token: statusToken };
}
