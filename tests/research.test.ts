import test from 'node:test';
import assert from 'node:assert/strict';
import { researchClub } from '../server/research';
const claim = (id: string, rank = 'normal') => ({
  rank,
  mainsnak: { datavalue: { value: { id } } },
});
test('live catalog research preserves source provenance and selects preferred venue', async () => {
  const entities: Record<string, unknown> = {
    Q1: {
      labels: { tr: { value: 'Test Kulübü' }, en: { value: 'Test Club' } },
      descriptions: { en: { value: 'association football club' } },
      claims: { P115: [claim('Q9', 'deprecated'), claim('Q3', 'preferred')], P17: [claim('Q2')] },
    },
    Q2: { labels: { en: { value: 'Turkey' } } },
    Q3: { labels: { tr: { value: 'Test Stadyumu' } }, claims: { P131: [claim('Q4')] } },
    Q4: { labels: { tr: { value: 'İstanbul' } } },
  };
  let calls = 0;
  const fake: typeof fetch = async (input) => {
    calls++;
    const u = new URL(String(input));
    assert.equal(u.hostname, 'www.wikidata.org');
    const ids = u.searchParams.get('ids')!.split('|');
    return new Response(
      JSON.stringify({ entities: Object.fromEntries(ids.map((id) => [id, entities[id]])) }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };
  const club = await researchClub('Q1', fake);
  assert.equal(club.name, 'Test Kulübü');
  assert.equal(club.stadium, 'Test Stadyumu');
  assert.equal(club.country, 'Turkey');
  assert.equal(club.city, 'İstanbul');
  assert.equal(club.source, 'https://www.wikidata.org/wiki/Q1');
  assert.equal(calls, 3);
});
test('research refuses invalid IDs and non-football entities', async () => {
  await assert.rejects(() => researchClub('../../etc/passwd'), /Geçersiz/);
  const fake: typeof fetch = async () =>
    new Response(
      JSON.stringify({ entities: { Q1: { descriptions: { en: { value: 'basketball team' } } } } }),
    );
  await assert.rejects(() => researchClub('Q1', fake), /futbol kulübü/);
});
