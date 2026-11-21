import { MatchRvMcpClient } from '../client';
import { emptyFilter } from '../../models/rv';

type Call = { body: Record<string, unknown>; headers: Record<string, string> };

function sseResponse(obj: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(`event: message\ndata: ${JSON.stringify(obj)}\n\n`, {
    status,
    headers: { 'content-type': 'text/event-stream', ...headers },
  });
}

function makeFetch(handler: (call: Call, n: number) => Response) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (_url: unknown, init?: RequestInit) => {
    const call = { body: JSON.parse(String(init?.body)), headers: init?.headers as Record<string, string> };
    calls.push(call);
    return handler(call, calls.length);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const searchResult = (id: number) => ({
  jsonrpc: '2.0',
  id,
  result: { structuredContent: { results: [{ id: 'u1', title: '2024 Demo Trailer', price: 1000 }], inventoryQuality: { eligibleUnits: 4242 } } },
});

describe('MatchRvMcpClient', () => {
  it('initializes once, sends notifications/initialized, and reuses the session id header', async () => {
    const { fetchImpl, calls } = makeFetch((call) => {
      if (call.body.method === 'initialize') return sseResponse({ jsonrpc: '2.0', id: call.body.id, result: {} }, { 'Mcp-Session-Id': 'sess-1' });
      if (call.body.method === 'notifications/initialized') return new Response('', { status: 202 });
      return sseResponse(searchResult(call.body.id as number));
    });
    const client = new MatchRvMcpClient({ fetchImpl, endpoint: 'https://example.test/mcp' });
    const r1 = await client.searchRvs(emptyFilter());
    await client.searchRvs(emptyFilter());
    expect(r1.eligibleUnitsCount).toBe(4242);
    expect(calls.map((c) => c.body.method)).toEqual(['initialize', 'notifications/initialized', 'tools/call', 'tools/call']);
    expect(calls[0].body.params).toMatchObject({ protocolVersion: '2024-11-05', capabilities: {} });
    expect(calls[1].body.id).toBeUndefined();
    expect(calls[2].headers['Mcp-Session-Id']).toBe('sess-1');
    expect(calls[2].headers.Accept).toBe('application/json, text/event-stream');
    expect(calls[2].body.params).toMatchObject({ name: 'search_rvs', arguments: { shopper_requested_results_now: true, sort: 'best_match', limit: 10 } });
  });

  it('works with stateless servers (no session header)', async () => {
    const { fetchImpl, calls } = makeFetch((call) =>
      call.body.method === 'tools/call' ? sseResponse(searchResult(call.body.id as number)) : sseResponse({ result: {} }),
    );
    const client = new MatchRvMcpClient({ fetchImpl });
    await client.searchRvs(emptyFilter());
    expect(calls[2].headers['Mcp-Session-Id']).toBeUndefined();
  });

  it('re-initializes and retries once when the session expired', async () => {
    let inits = 0;
    let toolCalls = 0;
    const { fetchImpl, calls } = makeFetch((call) => {
      if (call.body.method === 'initialize') {
        inits++;
        return sseResponse({ result: {} }, { 'Mcp-Session-Id': `sess-${inits}` });
      }
      if (call.body.method === 'notifications/initialized') return new Response('', { status: 202 });
      toolCalls++;
      if (toolCalls === 1) return new Response('{"error":"Session not found"}', { status: 404 });
      return sseResponse(searchResult(call.body.id as number));
    });
    const client = new MatchRvMcpClient({ fetchImpl });
    const r = await client.searchRvs(emptyFilter());
    expect(r.units).toHaveLength(1);
    expect(inits).toBe(2);
    expect(calls[calls.length - 1].headers['Mcp-Session-Id']).toBe('sess-2');
  });

  it('surfaces HTTP errors', async () => {
    const { fetchImpl } = makeFetch((call) => (call.body.method === 'tools/call' ? new Response('boom', { status: 500 }) : sseResponse({ result: {} })));
    await expect(new MatchRvMcpClient({ fetchImpl }).searchRvs(emptyFilter())).rejects.toThrow('HTTP 500');
  });

  it('caches get_rv details unless forceRefresh', async () => {
    let gets = 0;
    const { fetchImpl } = makeFetch((call) => {
      if (call.body.method !== 'tools/call') return sseResponse({ result: {} });
      gets++;
      return sseResponse({ result: { structuredContent: { unit: { id: 'u1', title: 'T', priceUsd: { value: 100 + gets } } } } });
    });
    const client = new MatchRvMcpClient({ fetchImpl });
    expect((await client.getRv('u1')).priceUsd).toBe(101);
    expect((await client.getRv('u1')).priceUsd).toBe(101);
    expect((await client.getRv('u1', true)).priceUsd).toBe(102);
    expect(client.getCachedDetail('u1')?.priceUsd).toBe(102);
  });
});
