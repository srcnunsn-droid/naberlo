import { z } from 'zod';

export const researchKeys = [
  'club',
  'stadium',
  'city',
  'geography',
  'colors',
  'symbol',
  'capacity',
  'crest',
] as const;
const factSchema = z.object({
  key: z.enum(researchKeys),
  value: z.string().max(3000),
  supported: z.boolean(),
  evidence: z.string().max(2000),
  sources: z.array(z.string().max(4000)).max(20),
});
export interface ResearchReport {
  clubQid: string;
  stadiumQid: string;
  summary: string;
  facts: z.infer<typeof factSchema>[];
}

// Handle fenced JSON / surrounding prose locally, without paying for another call.
// Balanced scanning preserves braces inside quoted evidence and URLs.
export function jsonObjects(text: string): unknown[] {
  const found: unknown[] = [];
  let start = -1,
    depth = 0,
    quoted = false,
    escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (start < 0) {
      if (c === '{') {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        found.push(JSON.parse(text.slice(start, i + 1)));
      } catch {
        /* Not JSON. */
      }
      start = -1;
    }
  }
  return found;
}

export function parseResearchReport(text: string): ResearchReport | undefined {
  for (const value of jsonObjects(text).reverse()) {
    const raw = value as Record<string, unknown>;
    const rows = Array.isArray(raw.facts)
      ? raw.facts
      : raw.facts && typeof raw.facts === 'object'
        ? Object.entries(raw.facts).map(([key, f]) =>
            f && typeof f === 'object' ? { ...f, key } : { key },
          )
        : [];
    const facts: ResearchReport['facts'] = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const parsed = factSchema.safeParse({
        ...row,
        // Never coerce strings such as "false" to a truthy boolean.
        supported: row.supported === true,
        evidence: row.evidence ?? '',
        sources: Array.isArray(row.sources)
          ? row.sources.filter((s: unknown) => typeof s === 'string').slice(0, 20)
          : typeof row.sources === 'string'
            ? [row.sources]
            : [],
      });
      if (parsed.success) facts.push(parsed.data);
    }
    if (facts.length)
      return {
        clubQid: typeof raw.clubQid === 'string' ? raw.clubQid : '',
        stadiumQid: typeof raw.stadiumQid === 'string' ? raw.stadiumQid : '',
        summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 3000) : '',
        facts,
      };
  }
}
