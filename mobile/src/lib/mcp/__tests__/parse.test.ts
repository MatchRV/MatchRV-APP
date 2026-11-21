import compareFixture from './fixtures/compare_rvs.json';
import getRvFixture from './fixtures/get_rv.json';
import towFixture from './fixtures/evaluate_tow_fit.json';
import {
  McpError,
  extractTextContent,
  parseCompare,
  parseInquiryPreview,
  parseInquiryReceipt,
  parseInquiryStatus,
  parseMcpPayload,
  parseRvDetail,
  parseSearchResult,
  parseTowFit,
  unwrapToolResponse,
} from '../parse';
import type { JsonObject } from '../json';

declare const __dirname: string; // provided by Jest (no @types/node in this project)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs') as { readFileSync(p: string, enc: string): string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path') as { join(...p: string[]): string };
const searchSse = fs.readFileSync(path.join(__dirname, 'fixtures', 'search_rvs.sse.txt'), 'utf8');

const tool = (fixture: unknown, name = 'tool') => unwrapToolResponse(name, fixture as JsonObject);

describe('parseMcpPayload', () => {
  it('parses a plain JSON body', () => {
    expect(parseMcpPayload('  {"jsonrpc":"2.0","id":1,"result":{}} ')).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
  });

  it('parses an SSE stream captured from the live server', () => {
    const json = parseMcpPayload(searchSse);
    expect(json?.id).toBe(3);
    expect((json?.result as JsonObject).structuredContent).toBeDefined();
  });

  it('takes the LAST data: JSON line and ignores garbage chunks', () => {
    const raw = ['event: message', 'data: {"id":1,"a":1}', '', 'data: not json', 'data: {"id":2,"a":2}', ''].join('\n');
    expect(parseMcpPayload(raw)).toEqual({ id: 2, a: 2 });
  });

  it('handles CRLF line endings', () => {
    expect(parseMcpPayload('event: message\r\ndata: {"ok":true}\r\n\r\n')).toEqual({ ok: true });
  });

  it('returns null for empty or unparseable bodies', () => {
    expect(parseMcpPayload('')).toBeNull();
    expect(parseMcpPayload('{broken')).toBeNull();
    expect(parseMcpPayload('event: ping\n\n')).toBeNull();
  });
});

describe('unwrapToolResponse', () => {
  it('throws the JSON-RPC error message', () => {
    expect(() => tool({ error: { code: -32602, message: 'Invalid params' } })).toThrow('Invalid params');
    expect(() => tool({ error: {} })).toThrow('MatchRV MCP error');
  });

  it('throws on isError with the text content', () => {
    expect(() => tool({ result: { isError: true, content: [{ type: 'text', text: 'Unknown unit' }] } })).toThrow('Unknown unit');
    expect(() => tool({ result: { isError: true } }, 'get_rv')).toThrow('Tool get_rv returned an error.');
  });

  it('throws when the result is missing', () => {
    expect(() => tool({ jsonrpc: '2.0' }, 'search_rvs')).toThrow(McpError);
  });

  it('falls back to parsing JSON from text content when structuredContent is absent', () => {
    const r = tool({ result: { content: [{ type: 'text', text: '{"summary":"hi"}' }] } });
    expect(r.structured).toEqual({ summary: 'hi' });
    expect(extractTextContent({ content: [{ text: 'a' }, { text: '' }, { text: 'b' }] })).toBe('a\nb');
  });
});

describe('parseSearchResult (live fixture)', () => {
  const { structured } = tool(parseMcpPayload(searchSse), 'search_rvs');
  const res = parseSearchResult(structured);

  it('reads the live eligible-units count from inventoryQuality.eligibleUnits', () => {
    const expected = ((structured.inventoryQuality as JsonObject).eligibleUnits as number);
    expect(typeof expected).toBe('number');
    expect(res.eligibleUnitsCount).toBe(expected);
  });

  it('maps result cards like the Kotlin client', () => {
    expect(res.units.length).toBe(2);
    const u = res.units[0];
    expect(u.unitId).toMatch(/^vin:/);
    expect(u.priceUsd).toBeGreaterThan(0);
    expect(u.dryWeightLbs).toBeGreaterThan(0);
    expect(u.sleeps).toBe(7);
    expect(u.floorplan).toBeNull(); // "unknown" is dropped
    expect(u.walkthroughUrl).toContain('youtube.com');
    expect(u.year).toBe(2025); // extracted from title
    expect(u.isHydrated).toBe(false);
    expect(res.scope).toBe('nationwide');
    expect(res.timingMs).toBeGreaterThan(0);
  });

  it('fills gaps from the detail cache and marks hydrated', () => {
    const { structured: g } = tool(getRvFixture);
    const detail = parseRvDetail(g, 'x');
    const hydrated = parseSearchResult(structured, (id) => (id === detail.unitId ? detail : undefined));
    expect(hydrated.units[0].isHydrated).toBe(true);
    expect(hydrated.units[0].thumbnailUrl).toBe(detail.images[0]);
    expect(hydrated.units[0].rvType).toBe('travel_trailer');
  });

  it('skips results without ids and defaults missing blocks', () => {
    const r = parseSearchResult({ results: [{ title: 'no id' }, { id: 'abc' }] });
    expect(r.units.map((u) => u.unitId)).toEqual(['abc']);
    expect(r.units[0].title).toBe('RV Listing');
    expect(r.eligibleUnitsCount).toBeNull();
    expect(r.scope).toBe('nationwide');
  });
});

describe('parseRvDetail (live fixture)', () => {
  const { structured } = tool(getRvFixture);
  const d = parseRvDetail(structured, 'requested');

  it('unwraps {value,...} spec objects and nested blocks', () => {
    expect(d.unitId).toMatch(/^vin:/);
    expect(d.priceUsd).toBeGreaterThan(0);
    expect(d.priceNote).toMatch(/listing/i);
    expect(d.msrpUsd).toBeNull();
    expect(d.lengthFt).toBeNull();
    expect(d.sleeps).toBe(7);
    expect(d.slideouts).toBe(1);
    expect(d.freshWaterGal).toBe(40);
    expect(d.bunkhouse).toBeNull();
    expect(d.dealerName).toBe('Camping World of Hamburg');
    expect(d.dealerState).toBe('NY');
    expect(d.images.length).toBe(3);
    expect(d.images.every((i) => i.startsWith('http'))).toBe(true);
    expect(d.status).toBe('available');
    expect(d.listingUrl).toContain('campingworld.com');
    expect(d.boondockingScore).toBe(30);
    expect(d.boondockingKnown.length).toBeGreaterThan(0);
    expect(d.walkthroughLabel).toBeTruthy();
  });

  it('throws when unit is missing', () => {
    expect(() => parseRvDetail({}, 'u1')).toThrow('Unit details unavailable for u1');
  });

  it('formats powertrain keys and plain booleans', () => {
    const p = parseRvDetail({ unit: { id: 'x', solar: true, powertrainAndTowing: { towRatingLbs: { value: 8000 }, fuelType: 'diesel', empty: { value: null } } } }, 'x');
    expect(p.solar).toBe(true);
    expect(p.powertrainSummary).toEqual([
      ['Tow Rating Lbs', '8000'],
      ['Fuel Type', 'diesel'],
    ]);
    expect(p.dealerName).toBe('Authorized RV Dealer');
  });
});

describe('parseTowFit (live fixture)', () => {
  it('reads the live `fits` + `payloadFits` arrays', () => {
    const { structured, text } = tool(towFixture);
    const r = parseTowFit(structured, text, ' 2022 Ford F-150 ');
    expect(r.vehicleLabel).toBe('2022 Ford F-150');
    expect(r.unitVerdicts).toHaveLength(1);
    expect(r.unitVerdicts[0].verdict).toBe('depends_on_config');
    expect(r.unitVerdicts[0].details.some((d) => d.startsWith('Payload (fits)'))).toBe(true);
    expect(r.summaryText).toMatch(/Verify the exact vehicle configuration/);
  });

  it('still supports the Kotlin-era `results` shape', () => {
    const r = parseTowFit({ results: [{ unitId: 'a', status: 'ok', notes: ['n1'], warnings: ['w1'], reason: 'r' }], summary: 'S' }, '', 'Truck');
    expect(r.unitVerdicts[0]).toEqual({ unitId: 'a', title: 'RV Unit', verdict: 'ok', details: ['r', 'n1', 'w1'] });
    expect(r.summaryText).toBe('S');
    expect(parseTowFit({}, '{"json":1}', 'Truck').summaryText).toBe('Tow-fit screening completed for Truck.');
  });
});

describe('parseCompare (live fixture)', () => {
  it('maps units with spec objects plus the server spec table', () => {
    const { structured, text } = tool(compareFixture);
    const r = parseCompare(structured, text);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].priceUsd).toBeGreaterThan(0);
    expect(r.rows[0].dealer).toBe('Camping World of Hamburg');
    expect(r.specRows[0].spec).toBe('price');
    expect(r.specRows[0].bestIndex).toBe(0);
    expect(r.summaryText).toBe('Comparison ready.');
  });
});

describe('dealer inquiry parsing (constructed payloads — never called live)', () => {
  const input = { name: 'Pat Doe', email: 'pat@example.com', phone: null, message: 'Is it available?' };

  it('extracts token and nested preview fields', () => {
    const p = parseInquiryPreview(
      {
        confirmation_token: 'tok_123',
        expires_at: '2026-11-21T10:00:00Z',
        preview: {
          dealer: { name: 'Lakeside RV', city: 'Austin', state: 'TX' },
          rv: { title: '2024 Test Trailer', stock_number: 'S1', price: 41000 },
          message: 'Is it available?',
          delivery: 'email',
        },
      },
      'Preview text',
      input,
    );
    expect(p).toMatchObject({
      confirmationToken: 'tok_123',
      dealerName: 'Lakeside RV',
      dealerLocation: 'Austin, TX',
      deliveryMethod: 'email',
      rvTitle: '2024 Test Trailer',
      stockNumber: 'S1',
      priceUsd: 41000,
      shopperName: 'Pat Doe',
      shopperEmail: 'pat@example.com',
      rawSummary: 'Preview text',
    });
  });

  it('throws without a confirmation token', () => {
    expect(() => parseInquiryPreview({ preview: {} }, '', input)).toThrow(/confirmation token/);
  });

  it('normalizes receipt status and dry-run flag', () => {
    const r = parseInquiryReceipt({ inquiryId: 'inq_1', statusToken: 'st', status: 'WEIRD' }, '', false);
    expect(r).toMatchObject({ inquiryId: 'inq_1', statusToken: 'st', status: 'queued_for_matchrv', dryRun: false });
    const dry = parseInquiryReceipt({}, '', true, () => 42);
    expect(dry).toMatchObject({ inquiryId: 'inq_42', statusToken: 'dry_run_token', status: 'dry_run', dryRun: true });
  });

  it('marks status as replied when a dealer reply exists', () => {
    expect(parseInquiryStatus({ status: 'delivered', reply: { body: 'Yes, still here' } }, '', 'i1')).toMatchObject({ status: 'replied', dealerReply: 'Yes, still here' });
    expect(parseInquiryStatus({ status: 'delivered' }, '', 'i1').status).toBe('delivered');
    expect(parseInquiryStatus({ status: 'bogus' }, '', 'i1').statusSummary).toBe('Current status: queued_for_matchrv');
  });
});
