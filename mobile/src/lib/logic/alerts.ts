// Saved-search alert "check now" — mirrors MatchRvViewModel.checkSavedAlertsNow.
import type { SavedSearchAlertRecord } from '../models/firestore';

export interface AlertCheckUpdate {
  matchCount: number;
  newMatchCount: number;
  lastCheckedUnitIds: string[];
}

/** Compares the latest result IDs with the alert's seen IDs (lastCheckedUnitIds). */
export function computeAlertCheck(alert: Pick<SavedSearchAlertRecord, 'lastCheckedUnitIds'>, latestUnitIds: string[]): AlertCheckUpdate {
  const prev = new Set(alert.lastCheckedUnitIds ?? []);
  const unseenCount = latestUnitIds.filter((id) => !prev.has(id)).length;
  return {
    // Same clamps as MatchRvFirestoreRepository.updateAlertCheckResult (rules require ints).
    matchCount: Math.min(Math.max(latestUnitIds.length, 0), 1_000_000),
    newMatchCount: Math.min(Math.max(unseenCount, 0), 1000),
    lastCheckedUnitIds: latestUnitIds.slice(0, 10),
  };
}

export function alertsToCheck(alerts: SavedSearchAlertRecord[]): SavedSearchAlertRecord[] {
  return alerts.filter((a) => a.alertsEnabled);
}

export function newMatchesMessage(total: number): string {
  return total > 0
    ? `${total} new dealer RV match${total > 1 ? 'es' : ''} found for your alerts!`
    : 'All saved search alerts checked — no unseen matches yet.';
}
