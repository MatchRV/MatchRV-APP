// JSON-RPC (MCP Streamable HTTP) client for https://matchrv.com/mcp.
// Faithful port of app/src/main/java/com/example/data/mcp/MatchRvMcpClient.kt.
import type {
  DealerInquiryPreview,
  DealerInquiryReceipt,
  DealerInquiryStatusResult,
  McpSearchResult,
  RvComparisonResult,
  RvDetail,
  RvSearchFilter,
  TowFitEvaluation,
} from '../models/rv';
import {
  buildCompareArgs,
  buildInquiryStatusArgs,
  buildPrepareInquiryArgs,
  buildSearchArgs,
  buildSendInquiryArgs,
  buildTowFitArgs,
} from './args';
import type { JsonObject } from './json';
import {
  McpError,
  parseCompare,
  parseInquiryPreview,
  parseInquiryReceipt,
  parseInquiryStatus,
  parseMcpPayload,
  parseRvDetail,
  parseSearchResult,
  parseTowFit,
  unwrapToolResponse,
  type ToolResult,
} from './parse';

export const DEFAULT_MCP_ENDPOINT = 'https://matchrv.com/mcp';
const PROTOCOL_VERSION = '2024-11-05';
const REQUEST_TIMEOUT_MS = 30_000;

class McpSessionExpiredError extends McpError {
  constructor() {
    super('MCP session expired');
  }
}

export interface McpClientOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  clientName?: string;
  userAgent?: string;
}

export class MatchRvMcpClient {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly clientName: string;
  private readonly userAgent: string;
  private sessionId: string | null = null;
  private initialized = false;
  private sessionPromise: Promise<string | null> | null = null;
  private requestId = 1;
  private readonly detailCache = new Map<string, RvDetail>();

  constructor(options: McpClientOptions = {}) {
    this.endpoint = options.endpoint?.trim() || DEFAULT_MCP_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.clientName = options.clientName ?? 'matchrv-expo';
    this.userAgent = options.userAgent ?? 'MatchRV-Expo/1.0';
  }

  getCachedDetail = (unitId: string): RvDetail | undefined => this.detailCache.get(unitId);

  private async ensureSession(forceReset = false): Promise<string | null> {
    if (!forceReset && this.initialized) return this.sessionId;
    if (!forceReset && this.sessionPromise) return this.sessionPromise;
    const run = async () => {
      const { sessionId } = await this.executeRawRpc(
        'initialize',
        {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: this.clientName, version: '1.0.0' },
        },
        null,
        true,
      );
      this.sessionId = sessionId;
      this.initialized = true;
      // Send initialized notification (best effort)
      try {
        await this.executeRawRpc('notifications/initialized', null, this.sessionId, false);
      } catch {
        // ignored, same as Kotlin runCatching
      }
      return this.sessionId;
    };
    this.sessionPromise = run().finally(() => {
      this.sessionPromise = null;
    });
    return this.sessionPromise;
  }

  private async executeRawRpc(
    method: string,
    params: JsonObject | null,
    currentSessionId: string | null,
    includeId: boolean,
  ): Promise<{ json: JsonObject; sessionId: string | null }> {
    const body: JsonObject = { jsonrpc: '2.0', method };
    if (includeId) body.id = this.requestId++;
    if (params != null) body.params = params;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'User-Agent': this.userAgent,
    };
    if (currentSessionId && currentSessionId.trim().length > 0) headers['Mcp-Session-Id'] = currentSessionId;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    let raw: string;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      raw = await response.text();
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') {
        throw new McpError('MatchRV request timed out. Check your connection and retry.');
      }
      throw new McpError('Unable to reach matchrv.com/mcp. Check your connection and retry.');
    } finally {
      clearTimeout(timer);
    }

    const returnedSid =
      response.headers.get('Mcp-Session-Id') ?? response.headers.get('mcp-session-id') ?? currentSessionId;

    if ((response.status === 400 || response.status === 404) && currentSessionId != null) {
      if (raw.toLowerCase().includes('session')) throw new McpSessionExpiredError();
    }
    if (!response.ok) {
      if (__DEV__) console.warn(`MCP HTTP ${response.status}: ${raw.slice(0, 400)}`);
      throw new McpError(`MatchRV server responded with HTTP ${response.status}`);
    }
    if (!includeId && raw.trim().length === 0) return { json: {}, sessionId: returnedSid };
    const parsed = parseMcpPayload(raw);
    if (!parsed) throw new McpError('Unable to parse response from MatchRV MCP');
    return { json: parsed, sessionId: returnedSid };
  }

  async callTool(toolName: string, args: JsonObject): Promise<ToolResult> {
    const sid = await this.ensureSession();
    const params = { name: toolName, arguments: args };
    let json: JsonObject;
    try {
      ({ json } = await this.executeRawRpc('tools/call', params, sid, true));
    } catch (e) {
      if (!(e instanceof McpSessionExpiredError)) throw e;
      const fresh = await this.ensureSession(true);
      ({ json } = await this.executeRawRpc('tools/call', params, fresh, true));
    }
    return unwrapToolResponse(toolName, json);
  }

  async searchRvs(filter: RvSearchFilter, excludeModels: string[] = [], limit = 10): Promise<McpSearchResult> {
    const { structured } = await this.callTool('search_rvs', buildSearchArgs(filter, excludeModels, limit));
    return parseSearchResult(structured, this.getCachedDetail);
  }

  async getRv(unitId: string, forceRefresh = false): Promise<RvDetail> {
    if (!forceRefresh) {
      const cached = this.detailCache.get(unitId);
      if (cached) return cached;
    }
    const { structured } = await this.callTool('get_rv', { unit_id: unitId });
    const detail = parseRvDetail(structured, unitId);
    this.detailCache.set(unitId, detail);
    return detail;
  }

  async evaluateTowFit(input: {
    unitIds: string[];
    vehicle: string;
    truckPayloadLbs?: number | null;
    passengersLbs?: number | null;
    cargoLbs?: number | null;
  }): Promise<TowFitEvaluation> {
    const { structured, text } = await this.callTool('evaluate_tow_fit', buildTowFitArgs(input));
    return parseTowFit(structured, text, input.vehicle);
  }

  async compareRvs(unitIds: string[]): Promise<RvComparisonResult> {
    const { structured, text } = await this.callTool('compare_rvs', buildCompareArgs(unitIds));
    return parseCompare(structured, text, this.getCachedDetail);
  }

  /** Sends nothing to the dealer: returns a preview + confirmation token. */
  async prepareDealerInquiry(input: {
    unitId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    message: string;
  }): Promise<DealerInquiryPreview> {
    const { structured, text } = await this.callTool('prepare_dealer_inquiry', buildPrepareInquiryArgs(input));
    return parseInquiryPreview(structured, text, input);
  }

  /** Delivers the inquiry. Only call after the shopper explicitly confirmed the preview. */
  async sendDealerInquiry(confirmationToken: string, dryRun = false): Promise<DealerInquiryReceipt> {
    const { structured, text } = await this.callTool('send_dealer_inquiry', buildSendInquiryArgs(confirmationToken, dryRun));
    return parseInquiryReceipt(structured, text, dryRun);
  }

  async getDealerInquiryStatus(inquiryId: string, statusToken: string): Promise<DealerInquiryStatusResult> {
    const { structured, text } = await this.callTool(
      'get_dealer_inquiry_status',
      buildInquiryStatusArgs(inquiryId, statusToken),
    );
    return parseInquiryStatus(structured, text, inquiryId);
  }
}
