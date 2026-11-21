// Signed-in user data: saved RVs (favorites), saved-search alerts, dealer inquiries.
// Action logic mirrors MatchRvViewModel.kt (save, price-drop check, alert check, inquiries).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { errorMessage } from '@/lib/format';
import { alertsToCheck, computeAlertCheck, newMatchesMessage } from '@/lib/logic/alerts';
import { computeSavedPriceUpdate, priceDropMessage, selectRvsForPriceCheck } from '@/lib/logic/price-drop';
import { alertToSearchFilter, type AnalyticsEventType, type DealerInquiryRecord, type SavedRvRecord, type SavedSearchAlertRecord } from '@/lib/models/firestore';
import type { DealerInquiryPreview, DealerInquiryReceipt, RvDetail, RvSearchFilter, RvSummary } from '@/lib/models/rv';
import { postAlertNotification } from '@/lib/notifications';

import { useAuth } from './auth';
import { getRepository, mcp } from './services';
import { useToast } from './toast';

type AnalyticsExtra = { unitId?: string | null; queryText?: string | null; rvType?: string | null; priceUsd?: number | null; metadata?: string | null };
type Loadable<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data: T; error?: string };

interface UserDataState {
  savedRvs: Loadable<SavedRvRecord[]>;
  alerts: Loadable<SavedSearchAlertRecord[]>;
  inquiries: Loadable<DealerInquiryRecord[]>;
  isSaved: (unitId: string) => boolean;
  saveRv: (rv: RvSummary, opts?: { fromSwipe?: boolean; detail?: RvDetail | null }) => Promise<boolean>;
  removeSavedRv: (savedId: string) => Promise<void>;
  saveAlert: (filter: RvSearchFilter, currentUnitIds: string[]) => Promise<void>;
  toggleAlert: (alertId: string, enabled: boolean) => Promise<void>;
  deleteAlert: (alertId: string) => Promise<void>;
  checkAlertsNow: () => Promise<void>;
  refreshPricesNow: () => Promise<void>;
  isCheckingAlerts: boolean;
  isCheckingPrices: boolean;
  recordInquiry: (unitId: string, preview: DealerInquiryPreview, receipt: DealerInquiryReceipt, detail: RvDetail | null) => Promise<void>;
  refreshInquiryStatus: (inq: DealerInquiryRecord) => Promise<void>;
  refreshingInquiryId: string | null;
  compareIds: string[];
  toggleCompare: (unitId: string) => void;
  clearCompare: () => void;
  track: (eventType: AnalyticsEventType, extra?: AnalyticsExtra) => void;
}

const Ctx = createContext<UserDataState | null>(null);
type Keyed<T> = { uid: string | null; value: Loadable<T> };
const NONE = { uid: null, value: { status: 'idle' as const, data: [] as never[] } };
function forUser<T>(k: Keyed<T[]>, uid: string | null, active: boolean): Loadable<T[]> {
  if (!active) return { status: 'idle', data: [] };
  return k.uid === uid ? k.value : { status: 'loading', data: [] };
}

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, requireSignIn } = useAuth();
  const toast = useToast();
  const repo = getRepository();
  const uid = user?.uid ?? null;

  // State is keyed by uid so signing out/in never shows another user's data and no
  // synchronous reset is needed inside the subscription effect.
  const [savedState, setSavedRvs] = useState<Keyed<SavedRvRecord[]>>(NONE);
  const [alertState, setAlerts] = useState<Keyed<SavedSearchAlertRecord[]>>(NONE);
  const [inquiryState, setInquiries] = useState<Keyed<DealerInquiryRecord[]>>(NONE);
  const active = !!repo && !!uid;
  const savedRvs = forUser(savedState, uid, active);
  const alerts = forUser(alertState, uid, active);
  const inquiries = forUser(inquiryState, uid, active);
  const [isCheckingAlerts, setCheckingAlerts] = useState(false);
  const [isCheckingPrices, setCheckingPrices] = useState(false);
  const [refreshingInquiryId, setRefreshingInquiryId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    if (!repo || !uid) return;
    const ok = <T,>(set: (k: Keyed<T>) => void) => (data: T) => set({ uid, value: { status: 'ready', data } });
    const fail = (set: (k: Keyed<never[]>) => void) => (e: Error) =>
      set({ uid, value: { status: 'error', data: [], error: e.message || 'Unable to sync data' } });
    const u1 = repo.observeSavedRvs(uid, ok(setSavedRvs), fail(setSavedRvs));
    const u2 = repo.observeSavedAlerts(uid, ok(setAlerts), fail(setAlerts));
    const u3 = repo.observeInquiries(uid, ok(setInquiries), fail(setInquiries));
    return () => {
      u1();
      u2();
      u3();
    };
  }, [repo, uid]);

  const track = useCallback<UserDataState['track']>(
    (eventType, extra) => {
      void repo?.trackAnalyticsEvent(uid, eventType, extra);
    },
    [repo, uid],
  );

  const isSaved = useCallback((unitId: string) => savedRvs.data.some((s) => s.unitId === unitId), [savedRvs.data]);

  const saveRv = useCallback<UserDataState['saveRv']>(
    async (rv, opts) => {
      const signedIn = requireSignIn('Saving RVs');
      if (!signedIn || !repo) return false;
      try {
        await repo.saveRv(signedIn, rv, opts?.detail ?? mcp.getCachedDetail(rv.unitId));
        toast(`Saved ${rv.title.slice(0, 36)}`);
        const extra = { unitId: rv.unitId, rvType: rv.rvType, priceUsd: rv.priceUsd };
        if (opts?.fromSwipe) void repo.trackAnalyticsEvent(signedIn, 'swipe_right', extra);
        void repo.trackAnalyticsEvent(signedIn, 'save', extra);
        return true;
      } catch (e) {
        toast(errorMessage(e, 'Failed to save RV'));
        return false;
      }
    },
    [repo, requireSignIn, toast],
  );

  const removeSavedRv = useCallback(
    async (savedId: string) => {
      if (!repo || !uid) return;
      try {
        await repo.removeSavedRv(uid, savedId);
        setCompareIds((ids) => ids.filter((id) => savedRvs.data.find((s) => s.id === savedId)?.unitId !== id));
        toast('Removed from Saved RVs');
      } catch {
        toast('Could not remove RV');
      }
    },
    [repo, uid, toast, savedRvs.data],
  );

  const saveAlert = useCallback(
    async (filter: RvSearchFilter, currentUnitIds: string[]) => {
      const signedIn = requireSignIn('Saving search alerts');
      if (!signedIn || !repo) return;
      try {
        await repo.saveSearchAlert(signedIn, filter, currentUnitIds.slice(0, 10));
        toast('Saved search alert created!');
      } catch {
        toast('Could not save search alert');
      }
    },
    [repo, requireSignIn, toast],
  );

  const toggleAlert = useCallback(
    async (alertId: string, enabled: boolean) => {
      if (!repo || !uid) return;
      try {
        await repo.toggleSearchAlert(uid, alertId, enabled);
      } catch (e) {
        toast(errorMessage(e, 'Could not update alert'));
      }
    },
    [repo, uid, toast],
  );

  const deleteAlert = useCallback(
    async (alertId: string) => {
      if (!repo || !uid) return;
      try {
        await repo.deleteSearchAlert(uid, alertId);
        toast('Search alert deleted');
      } catch (e) {
        toast(errorMessage(e, 'Could not delete alert'));
      }
    },
    [repo, uid, toast],
  );

  const refreshPricesNow = useCallback(async () => {
    if (!repo || !uid || savedRvs.status !== 'ready' || savedRvs.data.length === 0) {
      toast('Save RVs first to check live price drops');
      return;
    }
    setCheckingPrices(true);
    let dropCount = 0;
    try {
      for (const saved of selectRvsForPriceCheck(savedRvs.data)) {
        try {
          const detail = await mcp.getRv(saved.unitId, true);
          const update = computeSavedPriceUpdate(saved.savedPriceUsd, detail.priceUsd);
          if (!update) continue;
          await repo.updateSavedRvPrice(uid, saved.id, update.lastCheckedPriceUsd, update.hasPriceDrop, detail.images[0] ?? saved.imageUrl);
          if (update.hasPriceDrop) dropCount++;
        } catch (e) {
          if (__DEV__) console.warn('price check failed for', saved.unitId, e);
        }
      }
      const msg = priceDropMessage(dropCount);
      toast(msg);
      if (dropCount > 0) await postAlertNotification('MatchRV Price Drop Alert', msg);
    } finally {
      setCheckingPrices(false);
    }
  }, [repo, uid, savedRvs, toast]);

  const checkAlertsNow = useCallback(async () => {
    if (!repo || !uid || alerts.status !== 'ready' || alerts.data.length === 0) {
      toast('Save a search filter first to monitor new matches');
      return;
    }
    setCheckingAlerts(true);
    let total = 0;
    try {
      for (const alert of alertsToCheck(alerts.data)) {
        try {
          const result = await mcp.searchRvs(alertToSearchFilter(alert), [], 10);
          const update = computeAlertCheck(alert, result.units.map((u) => u.unitId));
          total += update.newMatchCount;
          await repo.updateAlertCheckResult(uid, alert.id, update);
        } catch (e) {
          if (__DEV__) console.warn('alert check failed for', alert.id, e);
        }
      }
      const msg = newMatchesMessage(total);
      toast(msg);
      if (total > 0) await postAlertNotification('MatchRV New Match Alert', msg);
    } finally {
      setCheckingAlerts(false);
    }
  }, [repo, uid, alerts, toast]);

  const recordInquiry = useCallback<UserDataState['recordInquiry']>(
    async (unitId, preview, receipt, detail) => {
      if (!repo || !uid) return;
      const priceUsd = preview.priceUsd ?? detail?.priceUsd ?? null;
      try {
        await repo.recordDealerInquiry(uid, {
          mcpInquiryId: receipt.inquiryId,
          statusToken: receipt.statusToken,
          unitId,
          rvTitle: preview.rvTitle.trim() ? preview.rvTitle : (detail?.title ?? 'RV Listing'),
          dealerName: preview.dealerName.trim() ? preview.dealerName : (detail?.dealerName ?? 'Dealership'),
          dealerLocation: preview.dealerLocation,
          status: receipt.status,
          message: preview.message,
          dryRun: receipt.dryRun,
          priceUsd,
          imageUrl: detail?.images[0] ?? null,
        });
      } catch (e) {
        if (__DEV__) console.warn('Inquiry sent via MCP but failed to save to Firestore', e);
      }
      void repo.trackAnalyticsEvent(uid, 'inquiry_sent', {
        unitId,
        rvType: detail?.rvType,
        priceUsd,
        metadata: receipt.dryRun ? `dry_run:${receipt.status}` : receipt.status,
      });
    },
    [repo, uid],
  );

  const refreshInquiryStatus = useCallback(
    async (inq: DealerInquiryRecord) => {
      if (!repo || !uid) return;
      setRefreshingInquiryId(inq.id);
      try {
        const res = await mcp.getDealerInquiryStatus(inq.mcpInquiryId, inq.statusToken);
        await repo.updateInquiryStatus(uid, inq.id, res.status, res.dealerReply);
        toast(`Status updated: ${res.status.replace(/_/g, ' ')}`);
      } catch (e) {
        toast(errorMessage(e, 'Unable to refresh inquiry status'));
      } finally {
        setRefreshingInquiryId(null);
      }
    },
    [repo, uid, toast],
  );

  const toggleCompare = useCallback(
    (unitId: string) => {
      setCompareIds((ids) => {
        if (ids.includes(unitId)) return ids.filter((i) => i !== unitId);
        if (ids.length >= 4) {
          toast('You can compare up to 4 RVs at once');
          return ids;
        }
        return [...ids, unitId];
      });
    },
    [toast],
  );
  const clearCompare = useCallback(() => setCompareIds([]), []);

  const value = useMemo<UserDataState>(
    () => ({
      savedRvs,
      alerts,
      inquiries,
      isSaved,
      saveRv,
      removeSavedRv,
      saveAlert,
      toggleAlert,
      deleteAlert,
      checkAlertsNow,
      refreshPricesNow,
      isCheckingAlerts,
      isCheckingPrices,
      recordInquiry,
      refreshInquiryStatus,
      refreshingInquiryId,
      compareIds,
      toggleCompare,
      clearCompare,
      track,
    }),
    [savedRvs, alerts, inquiries, isSaved, saveRv, removeSavedRv, saveAlert, toggleAlert, deleteAlert, checkAlertsNow, refreshPricesNow, isCheckingAlerts, isCheckingPrices, recordInquiry, refreshInquiryStatus, refreshingInquiryId, compareIds, toggleCompare, clearCompare, track],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUserData(): UserDataState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUserData must be used inside UserDataProvider');
  return ctx;
}
