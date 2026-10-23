import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { fixture } from './fixtures';
import { blockers } from '../shared/engine';
import { researchMessage } from '../shared/research-message';

let dir: string, research: typeof import('../server/project-research');
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'naberlo-research-'));
  process.env.STADIUM_DATA_DIR = dir;
  process.env.STADIUM_OPENAI_API_KEY = 'test-placeholder';
  research = await import('../server/project-research');
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});
const keys = [
  'club',
  'stadium',
  'city',
  'geography',
  'colors',
  'symbol',
  'capacity',
  'crest',
] as const;
const urls = ['https://club.example/stadium/current', 'https://city.example/stadium'];
function report() {
  return {
    clubQid: 'Q1',
    stadiumQid: 'Q2',
    summary: 'Kaynaklar kontrol edildi.',
    facts: keys.map((key) => ({
      key,
      value: key === 'stadium' ? 'Test stadium' : `Current ${key}`,
      supported: true,
      evidence: 'Current official venue information, not a planned replacement.',
      sources: urls,
    })),
  };
}
function project() {
  const p = fixture();
  for (const key of keys)
    p.facts[key] = { value: '', sources: [], status: 'unverified', official: false };
  return p;
}
const value = (v: unknown) => ({ rank: 'normal', mainsnak: { datavalue: { value: v } } });
function output(content: unknown, web = false) {
  return Response.json({
    status: 'completed',
    output: [
      ...(web
        ? [
            {
              type: 'web_search_call',
              status: 'completed',
              action: { sources: urls.map((url) => ({ url })) },
            },
          ]
        : []),
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(content) }] },
    ],
  });
}

test('live-search contract fills facts and downloads screened real source photos without fake human checks', async () => {
  const p = project(),
    png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#e5e8eb' } })
      .png()
      .toBuffer();
  let searches = 0,
    visualChecks = 0,
    downloads = 0;
  const fake: typeof fetch = async (input, init) => {
    const u = new URL(String(input));
    if (u.hostname === 'api.openai.com') {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      if (body.tools) {
        searches++;
        assert.equal(body.tools[0].type, 'web_search');
        assert.match(body.input, new RegExp(new Date().getFullYear().toString()));
        return output(report(), true);
      }
      visualChecks++;
      assert.match(body.input[0].content[1].image_url, /^data:image\/png;base64,/);
      return output({ suitable: true, reason: 'Test source image screening.' });
    }
    if (u.hostname === 'www.wikidata.org') {
      const id = u.searchParams.get('ids')!;
      return Response.json({
        entities: {
          [id]:
            id === 'Q1'
              ? {
                  labels: { en: { value: 'Test club' } },
                  claims: {
                    P115: [value({ id: 'Q2' })],
                    P856: [value('https://club.example')],
                    P154: [value('Club.png')],
                  },
                }
              : {
                  labels: { en: { value: 'Test stadium' } },
                  claims: { P18: [value('Stadium.png')] },
                },
        },
      });
    }
    if (u.hostname === 'commons.wikimedia.org')
      return Response.json({
        query: {
          pages: {
            '1': {
              imageinfo: [
                {
                  thumburl: 'https://upload.wikimedia.org/image.png',
                  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Stadium.png',
                  extmetadata: {
                    LicenseShortName: { value: 'CC BY-SA 4.0' },
                    LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
                    Artist: { value: '<a>Photographer</a>' },
                    DateTimeOriginal: { value: '2024-06-01' },
                  },
                },
              ],
            },
          },
        },
      });
    if (u.hostname === 'upload.wikimedia.org') {
      downloads++;
      assert.equal(init?.redirect, 'error');
      return new Response(png, { headers: { 'content-type': 'image/png' } });
    }
    throw new Error('Unexpected destination');
  };
  const result = await research.researchProject(p, fake);
  assert.deepEqual(result.warnings, []);
  assert.equal(searches, 1);
  assert.equal(visualChecks, 2);
  assert.equal(downloads, 2);
  assert.ok(keys.every((key) => result.facts[key].status === 'verified'));
  p.facts = result.facts;
  p.assets = result.assets;
  assert.deepEqual(blockers(p, 'R0'), []);
  for (const a of result.assets) {
    assert.equal(a.origin, 'research');
    assert.equal(a.reviewMode, 'automatic');
    assert.equal(a.status, 'accepted');
    assert.deepEqual(a.checks, []);
    assert.equal(a.provenance?.capturedAt, '2024-06-01');
    assert.equal(a.provenance?.author, 'Photographer');
  }
});

test('fabricated citations, same-family sources and conflicting evidence cannot unlock facts', () => {
  const p = project(),
    r = report();
  r.facts[0].sources = ['https://invented.example/club'];
  r.facts[1].supported = false;
  r.facts[2].sources = ['https://en.wikipedia.org/wiki/City', 'https://www.wikidata.org/wiki/Q3'];
  const sources = new Set([...urls, ...r.facts[2].sources]);
  const warnings = research.applyEvidence(p, r, sources, [], new Date().toISOString());
  assert.equal(p.facts.club.status, 'unverified');
  assert.equal(p.facts.stadium.status, 'single-source');
  assert.equal(p.facts.city.status, 'single-source');
  assert.equal(p.facts.geography.status, 'verified');
  assert.equal(warnings.length, 3);
});

test('no actual web search means no verified data, and interrupted runs do not retry', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      research.researchProject(project(), async () => {
        calls++;
        return output(report());
      }),
    /Canlı web araması/,
  );
  assert.equal(calls, 1);
  const { store } = await import('../server/store');
  const p = project();
  p.research = {
    id: 'interrupted',
    status: 'running',
    startedAt: new Date().toISOString(),
    message: '',
    warnings: [],
  };
  store.save(p);
  research.recoverResearch();
  assert.equal(store.project(p.id)?.research?.status, 'failed');
});

test('persisted research starts once and leaves a visible failure instead of a background retry', async () => {
  const { store } = await import('../server/store');
  const p = project();
  p.id = 'background';
  store.save(p);
  const original = globalThis.fetch;
  let calls = 0,
    finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  globalThis.fetch = async () => {
    calls++;
    await pending;
    return output(report());
  };
  try {
    const started = research.startProjectResearch(p);
    assert.equal(started.research?.status, 'running');
    assert.equal(
      research.startProjectResearch(store.project(p.id)!).research?.id,
      started.research?.id,
    );
    assert.equal(calls, 1);
    finish();
    for (let i = 0; i < 100 && store.project(p.id)?.research?.status === 'running'; i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(store.project(p.id)?.research?.status, 'failed');
    assert.match(store.project(p.id)?.research?.message || '', /Canlı web araması/);
    assert.equal(calls, 1);
    assert.equal(store.project(p.id)?.facts.stadium.status, 'unverified');
  } finally {
    globalThis.fetch = original;
  }
});

test('mixed citation markers and malformed source strings do not abort valid research facts', async () => {
  const r = report();
  r.clubQid = '';
  r.stadiumQid = '';
  r.facts[0].sources = [`[Kulüp](${urls[0]})`, `<${urls[1]}>`];
  r.facts[1].sources = ['turn0search0', urls[1]];
  r.facts[2].sources = ['[1]', 'not a url', 'https://invented.example'];
  let calls = 0;
  const result = await research.researchProject(project(), async () => {
    calls++;
    const text = JSON.stringify(r),
      start = text.indexOf('turn0search0');
    return Response.json({
      status: 'completed',
      output: [
        {
          type: 'web_search_call',
          status: 'completed',
          action: { sources: urls.map((url) => ({ url })) },
        },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text,
              annotations: [
                {
                  type: 'url_citation',
                  url: urls[0],
                  start_index: start,
                  end_index: start + 'turn0search0'.length,
                },
              ],
            },
          ],
        },
      ],
    });
  });
  assert.equal(calls, 1, 'repair is local and does not buy another search');
  assert.equal(result.facts.club.status, 'verified');
  assert.equal(result.facts.stadium.status, 'verified');
  assert.equal(result.facts.city.status, 'unverified');
  assert.equal(result.facts.colors.status, 'verified');
  assert.ok(result.warnings.some((w) => w.includes('kaynak işareti')));
  assert.deepEqual(research.resolveResearchSources(['turn0search0'], new Set(urls)), []);
  assert.deepEqual(
    research.resolveResearchSources(
      ['turn0search0'],
      new Set(urls),
      new Map([['turn0search0', new Set(urls)]]),
    ),
    [],
  );
  const oldError =
    '[{"validation":"url","code":"invalid_string","message":"Invalid url","path":["facts",0,"sources",0]}]';
  assert.doesNotMatch(researchMessage(oldError), /invalid_string|"path"/);
  assert.match(researchMessage(oldError), /Mevcut|mevcut/);
});

test('malformed research structure returns a readable message instead of raw validation data', async () => {
  await assert.rejects(
    () => research.researchProject(project(), async () => output({ facts: 'broken' }, true)),
    (error) => {
      assert.match((error as Error).message, /beklenen bilgi biçiminde/);
      assert.doesNotMatch((error as Error).message, /invalid_type|"path"/);
      return true;
    },
  );
});
