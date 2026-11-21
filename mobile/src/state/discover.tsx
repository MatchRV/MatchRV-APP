// Discover deck state — mirrors DiscoverUiState + deck functions in MatchRvViewModel.kt.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { AiCuratedDeckResult } from '@/lib/ai/types';
import { errorMessage } from '@/lib/format';
import { PREFETCH_THRESHOLD, mergeFreshUnits, nextPageRequest, rememberModels } from '@/lib/logic/deck';
import { emptyFilter, type RvDetail, type RvSearchFilter, type RvSummary } from '@/lib/models/rv';

import { mcp } from './services';

export type BrowseMode = 'swipe' | 'grid';

export interface DiscoverState {
  deck: RvSummary[];
  passedStack: RvSummary[];
  filter: RvSearchFilter;
  browseMode: BrowseMode;
  isLoading: boolean;
  isPrefetching: boolean;
  errorMessage: string | null;
  /** Live count straight from search_rvs → inventoryQuality.eligibleUnits. Never hardcoded. */
  eligibleInventoryCount: number | null;
  aiCuratedSummary: string | null;
}

interface DiscoverApi extends DiscoverState {
  setBrowseMode: (m: BrowseMode) => void;
  applyFilter: (f: RvSearchFilter, aiSummary?: string | null) => void;
  resetFilters: () => void;
  reload: () => void;
  removeCard: (rv: RvSummary, addToPassed: boolean) => void;
  undoLastPass: () => void;
  prefetchNextBatch: () => void;
  /** Grid view "Load more" — same request as the deck prefetch, without the threshold. */
  loadMore: () => void;
  loadAiDeck: (r: AiCuratedDeckResult) => void;
  applyDetail: (unitId: string, detail: RvDetail) => void;
}

const Ctx = createContext<DiscoverApi | null>(null);

export function applyDetailToSummary(item: RvSummary, detail: RvDetail): RvSummary {
  return {
    ...item,
    thumbnailUrl: detail.images[0] ?? item.thumbnailUrl,
    rvType: detail.rvType ?? item.rvType,
    condition: detail.condition ?? item.condition,
    year: detail.year ?? item.year,
    priceUsd: detail.priceUsd ?? item.priceUsd,
    lengthFt: detail.lengthFt ?? item.lengthFt,
    dryWeightLbs: detail.dryWeightLbs ?? item.dryWeightLbs,
    gvwrLbs: detail.gvwrLbs ?? item.gvwrLbs,
    sleeps: detail.sleeps ?? item.sleeps,
    listingUrl: detail.listingUrl ?? item.listingUrl,
    isHydrated: true,
  };
}

/** Fetches get_rv for up to 8 cards (4 at a time) to add photos — same as hydrateDeckPhotos(). */
export async function hydrateUnits(units: RvSummary[], onDetail: (unitId: string, d: RvDetail) => void) {
  const queue = units.slice(0, 8).filter((u) => !(u.isHydrated && u.thumbnailUrl));
  const worker = async () => {
    for (let u = queue.shift(); u; u = queue.shift()) {
      try {
        onDetail(u.unitId, await mcp.getRv(u.unitId));
      } catch {
        // photo hydration is best effort
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

export function DiscoverProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiscoverState>({
    deck: [],
    passedStack: [],
    filter: emptyFilter(),
    browseMode: 'swipe',
    isLoading: true,
    isPrefetching: false,
    errorMessage: null,
    eligibleInventoryCount: null,
    aiCuratedSummary: null,
  });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const seenIds = useRef(new Set<string>());
  const seenModels = useRef<string[]>([]);
  const requestSeq = useRef(0);

  const applyDetail = useCallback((unitId: string, detail: RvDetail) => {
    setState((s) => ({ ...s, deck: s.deck.map((d) => (d.unitId === unitId ? applyDetailToSummary(d, detail) : d)) }));
  }, []);

  const remember = (units: RvSummary[]) => {
    units.forEach((u) => seenIds.current.add(u.unitId));
    seenModels.current = rememberModels(seenModels.current, units);
  };

  const loadInitialDeck = useCallback(
    async (filter: RvSearchFilter, aiSummary: string | null = null) => {
      const seq = ++requestSeq.current;
      setState((s) => ({ ...s, filter, isLoading: true, errorMessage: null, aiCuratedSummary: aiSummary, passedStack: [] }));
      try {
        const res = await mcp.searchRvs(filter, [], 10);
        if (seq !== requestSeq.current) return;
        seenIds.current = new Set();
        seenModels.current = [];
        remember(res.units);
        setState((s) => ({
          ...s,
          deck: res.units,
          isLoading: false,
          errorMessage: null,
          eligibleInventoryCount: res.eligibleUnitsCount ?? s.eligibleInventoryCount,
        }));
        void hydrateUnits(res.units, applyDetail);
      } catch (e) {
        if (seq !== requestSeq.current) return;
        setState((s) => ({
          ...s,
          isLoading: false,
          errorMessage: errorMessage(e, 'Unable to reach matchrv.com/mcp. Check your connection and retry.'),
        }));
      }
    },
    [applyDetail],
  );

  useEffect(() => {
    void loadInitialDeck(emptyFilter());
  }, [loadInitialDeck]);

  const prefetchNextBatch = useCallback(async (force = false) => {
    const s = stateRef.current;
    if (s.isLoading || s.isPrefetching || (!force && s.deck.length > PREFETCH_THRESHOLD)) return;
    const seq = requestSeq.current;
    setState((x) => ({ ...x, isPrefetching: true }));
    try {
      const req = nextPageRequest(s.filter, s.deck, seenModels.current);
      const res = await mcp.searchRvs(req.filter, req.excludeModels, 10);
      if (seq !== requestSeq.current) return;
      const fresh = mergeFreshUnits(seenIds.current, res.units);
      remember(fresh);
      setState((x) => ({ ...x, deck: fresh.length > 0 ? [...x.deck, ...fresh] : x.deck, isPrefetching: false }));
      if (fresh.length > 0) void hydrateUnits(fresh, applyDetail);
    } catch {
      setState((x) => ({ ...x, isPrefetching: false }));
    }
  }, [applyDetail]);

  const removeCard = useCallback(
    (rv: RvSummary, addToPassed: boolean) => {
      setState((s) => ({
        ...s,
        deck: s.deck.filter((d) => d.unitId !== rv.unitId),
        passedStack: addToPassed ? [...s.passedStack, rv].slice(-15) : s.passedStack,
      }));
      setTimeout(() => void prefetchNextBatch(), 0);
    },
    [prefetchNextBatch],
  );

  const undoLastPass = useCallback(() => {
    setState((s) => {
      const last = s.passedStack[s.passedStack.length - 1];
      if (!last) return s;
      return { ...s, deck: [last, ...s.deck], passedStack: s.passedStack.slice(0, -1) };
    });
  }, []);

  const loadAiDeck = useCallback(
    (r: AiCuratedDeckResult) => {
      requestSeq.current++;
      seenIds.current = new Set();
      seenModels.current = [];
      remember(r.curatedDeck);
      setState((s) => ({
        ...s,
        deck: r.curatedDeck,
        filter: r.appliedFilter,
        browseMode: 'swipe',
        isLoading: false,
        errorMessage: null,
        aiCuratedSummary: r.agentSummary,
        passedStack: [],
        eligibleInventoryCount: r.eligibleUnitsCount ?? s.eligibleInventoryCount,
      }));
      void hydrateUnits(r.curatedDeck, applyDetail);
    },
    [applyDetail],
  );

  const api = useMemo<DiscoverApi>(
    () => ({
      ...state,
      setBrowseMode: (m) => setState((s) => ({ ...s, browseMode: m })),
      applyFilter: (f, ai = null) => void loadInitialDeck(f, ai),
      resetFilters: () => void loadInitialDeck(emptyFilter()),
      reload: () => void loadInitialDeck(stateRef.current.filter, stateRef.current.aiCuratedSummary),
      removeCard,
      undoLastPass,
      prefetchNextBatch: () => void prefetchNextBatch(),
      loadMore: () => void prefetchNextBatch(true),
      loadAiDeck,
      applyDetail,
    }),
    [state, loadInitialDeck, removeCard, undoLastPass, prefetchNextBatch, loadAiDeck, applyDetail],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useDiscover(): DiscoverApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDiscover must be used inside DiscoverProvider');
  return ctx;
}
