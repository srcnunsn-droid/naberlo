import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Club } from '../shared/types';

const root = process.argv[2];
if (!root || !fs.existsSync(path.join(root, 'LICENSE.md')))
  throw new Error('Usage: npm run catalog:import -- /path/to/openfootball-clubs');
const revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const clubs: Club[] = [];
const allowedRegions = new Set([
  'africa',
  'asia',
  'caribbean',
  'central-america',
  'europe',
  'middle-east',
  'north-america',
  'oceania',
  'south-america',
]);
const clean = (s: string) => s.replace(/\$\$/g, '').trim();
function scan(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (/^[\w-]+\.clubs\.txt$/.test(entry.name)) {
      const relative = path.relative(root, full).split(path.sep).join('/');
      const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
      const country =
        lines
          .find((l) => /^=\s+[A-Za-z]/.test(l))
          ?.replace(/^=\s+/, '')
          .trim() || path.basename(dir).replace(/-/g, ' ');
      let last: Club | undefined;
      for (const raw of lines) {
        const line = raw.split('#')[0].trim();
        if (!line || /^[=<>@]/.test(line)) continue;
        if (line.startsWith('|')) {
          if (last) last.aliases.push(...line.split('|').map(clean).filter(Boolean));
          continue;
        }
        if (/^\s/.test(raw) || !line.includes(',') || line.startsWith('[')) continue;
        const parts = line.split(',').map(clean);
        const name = parts[0];
        if (name.length < 2 || !/[\p{L}]/u.test(name)) continue;
        const stadium =
          parts
            .find((p) => p.startsWith('@'))
            ?.slice(1)
            .trim() || '';
        const city =
          parts
            .slice(1)
            .filter((p) => p && !p.startsWith('@') && !/^\d|^\(/.test(p))
            .at(-1) || '';
        const id = createHash('sha256')
          .update(country + ':' + name)
          .digest('hex')
          .slice(0, 16);
        last = {
          id,
          name,
          country,
          region: relative.split('/')[0],
          city,
          stadium,
          aliases: [],
          source: `https://github.com/openfootball/clubs/blob/${revision}/${relative}`,
          sourceRevision: revision,
        };
        clubs.push(last);
      }
    }
  }
}
for (const region of fs.readdirSync(root))
  if (allowedRegions.has(region)) scan(path.join(root, region));
const unique = [...new Map(clubs.map((c) => [c.id, c])).values()].sort((a, b) =>
  a.name.localeCompare(b.name),
);
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/clubs.json', JSON.stringify(unique));
fs.writeFileSync(
  'data/catalog-meta.json',
  JSON.stringify(
    {
      total: unique.length,
      countries: new Set(unique.map((c) => c.country)).size,
      regions: [...new Set(unique.map((c) => c.region))].sort(),
      source: 'https://github.com/openfootball/clubs',
      revision,
      importedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
fs.copyFileSync(path.join(root, 'LICENSE.md'), 'data/OPENFOOTBALL-LICENSE.md');
console.log(
  `Imported ${unique.length} club records from ${new Set(unique.map((c) => c.country)).size} countries. Historical data; verification required.`,
);
