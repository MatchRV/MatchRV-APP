// Small helpers mirroring the org.json `opt*` extension functions in MatchRvMcpClient.kt.
export type JsonObject = Record<string, unknown>;

export function isObject(v: unknown): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function optObject(o: JsonObject | null | undefined, key: string): JsonObject | null {
  const v = o?.[key];
  return isObject(v) ? v : null;
}

export function optArray(o: JsonObject | null | undefined, key: string): unknown[] | null {
  const v = o?.[key];
  return Array.isArray(v) ? v : null;
}

/** org.json optString semantics: "" when missing/null, otherwise String(value). */
export function optString(o: JsonObject | null | undefined, key: string): string {
  const v = o?.[key];
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

export function optNullableString(o: JsonObject | null | undefined, key: string): string | null {
  const v = optString(o, key);
  return v.trim().length > 0 && v !== 'null' ? v : null;
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function optNullableDouble(o: JsonObject | null | undefined, key: string): number | null {
  return toNumber(o?.[key]);
}

export function optNullableInt(o: JsonObject | null | undefined, key: string): number | null {
  const raw = o?.[key];
  if (typeof raw === 'string') {
    // Kotlin String.toIntOrNull(): only integer literals.
    return /^[-+]?\d+$/.test(raw.trim()) ? parseInt(raw, 10) : null;
  }
  const n = toNumber(raw);
  return n == null ? null : Math.trunc(n);
}

export function optBoolean(o: JsonObject | null | undefined, key: string, fallback = false): boolean {
  const v = o?.[key];
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

/** Spec fields are either plain values or `{ value, source, confidence }` objects. */
export function extractSpecDouble(o: JsonObject | null | undefined, key: string): number | null {
  const raw = o?.[key];
  if (isObject(raw)) return optNullableDouble(raw, 'value');
  return toNumber(raw);
}

export function extractSpecInt(o: JsonObject | null | undefined, key: string): number | null {
  const raw = o?.[key];
  if (isObject(raw)) return optNullableInt(raw, 'value');
  return optNullableInt(o, key);
}

export function extractSpecBoolean(o: JsonObject | null | undefined, key: string): boolean | null {
  const raw = o?.[key];
  if (isObject(raw)) return typeof raw.value === 'boolean' ? raw.value : null;
  return typeof raw === 'boolean' ? raw : null;
}

export function stringList(arr: unknown[] | null, predicate: (s: string) => boolean = (s) => s.trim().length > 0): string[] {
  if (!arr) return [];
  const out: string[] = [];
  for (const item of arr) {
    const s = typeof item === 'string' ? item : typeof item === 'number' ? String(item) : '';
    if (predicate(s)) out.push(s);
  }
  return out;
}

export const ifBlank = (s: string, fallback: () => string): string => (s.trim().length === 0 ? fallback() : s);

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
