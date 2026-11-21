// Ask AI orchestration: prompt -> structured filters (Firebase AI or local fallback) -> MCP search_rvs.
import { conditionLabel, featureLabel, rvTypeLabel, type McpSearchResult, type RvSearchFilter } from '../models/rv';
import { parsedQueryToFilter, parsedSummary, type AiCuratedDeckResult, type AiParsedQuery, type AskAiProvider } from './types';

/** Same chip list as AskAiRepository.runAgentSearch. */
export function buildCriteriaChips(filter: RvSearchFilter): string[] {
  const chips: string[] = [];
  filter.rvTypes.forEach((t) => chips.push(rvTypeLabel(t)));
  if (filter.make.trim()) chips.push(filter.make);
  if (filter.priceMaxUsd != null) chips.push(`Under $${Math.trunc(filter.priceMaxUsd)}`);
  if (filter.priceMinUsd != null) chips.push(`Min $${Math.trunc(filter.priceMinUsd)}`);
  if (filter.location.trim()) {
    chips.push(filter.radiusMiles != null ? `${filter.location} (${Math.trunc(filter.radiusMiles)}mi)` : filter.location);
  }
  if (filter.sleepsMin != null) chips.push(`Sleeps ${filter.sleepsMin}+`);
  if (filter.lengthMaxFt != null) chips.push(`<= ${Math.trunc(filter.lengthMaxFt)} ft`);
  if (filter.condition !== 'any') chips.push(conditionLabel(filter.condition));
  if (filter.fuelType) chips.push(filter.fuelType.charAt(0).toUpperCase() + filter.fuelType.slice(1));
  filter.desiredFeatures.forEach((f) => chips.push(featureLabel(f)));
  if (filter.query.trim()) chips.push(filter.query);
  return chips;
}

export interface ParseOutcome {
  parsed: AiParsedQuery;
  source: AskAiProvider['id'];
  fallbackReason: string | null;
}

/** Tries the primary provider (if available), falling back to the deterministic one on any failure. */
export async function parseWithFallback(
  prompt: string,
  primary: AskAiProvider | null,
  fallback: AskAiProvider,
): Promise<ParseOutcome> {
  let fallbackReason: string | null = null;
  if (primary && primary.isAvailable()) {
    try {
      const parsed = await primary.parse(prompt);
      return { parsed, source: primary.id, fallbackReason: null };
    } catch (e) {
      fallbackReason = e instanceof Error && e.message ? e.message : 'Firebase AI request failed';
    }
  } else if (primary) {
    fallbackReason = 'Firebase AI Logic is not configured in this build.';
  }
  const parsed = await fallback.parse(prompt);
  return { parsed, source: fallback.id, fallbackReason };
}

export async function runAgentSearch(
  userPrompt: string,
  deps: {
    primary: AskAiProvider | null;
    fallback: AskAiProvider;
    search: (filter: RvSearchFilter) => Promise<McpSearchResult>;
  },
): Promise<AiCuratedDeckResult> {
  const cleanPrompt = userPrompt.trim();
  if (!cleanPrompt) throw new Error("Tell MatchRV what kind of RV you're looking for.");
  const outcome = await parseWithFallback(cleanPrompt, deps.primary, deps.fallback);
  const filter = parsedQueryToFilter(outcome.parsed);
  const mcp = await deps.search(filter);
  const { agentSummary, outfitterTip } = parsedSummary(outcome.parsed);
  return {
    userPrompt: cleanPrompt,
    agentSummary,
    outfitterTip,
    appliedFilter: filter,
    appliedCriteriaChips: buildCriteriaChips(filter),
    curatedDeck: mcp.units,
    eligibleUnitsCount: mcp.eligibleUnitsCount,
    source: outcome.source,
    fallbackReason: outcome.fallbackReason,
  };
}
