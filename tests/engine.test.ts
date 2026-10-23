import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCandidates,
  decodeVariant,
  blockers,
  imagePrompt,
  videoPrompts,
  selectionBlockers,
} from '../shared/engine';
import { variantCounts } from '../shared/catalog';
import type { Project, Fact, Asset } from '../shared/types';
import { fixture, asset } from './fixtures';
test('100 structurally specified candidates, ten complete sheets and mascot quotas', () => {
  const list = createCandidates(72);
  assert.equal(list.length, 100);
  assert.equal(new Set(list.map((c) => c.id)).size, 100);
  assert.equal(new Set(list.map(({ signature, seed, id, ...c }) => JSON.stringify(c))).size, 100);
  for (let sheet = 1; sheet <= 10; sheet++) {
    const cells = list.filter((c) => c.sheet === sheet);
    assert.equal(cells.length, 10);
    assert.deepEqual(
      cells.map((c) => c.cell),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    );
    assert.ok(cells.filter((c) => c.mascot === 'figure').length >= (sheet === 3 ? 5 : 3));
    assert.equal(new Set(cells.map((c) => c.plan)).size, 10);
    assert.ok(cells.every((c) => c.materials.length >= 3));
  }
  assert.deepEqual(createCandidates(72), list);
  assert.notDeepEqual(
    createCandidates(72, 2).map((c) => [c.plan, c.structure, c.height]),
    list.map((c) => [c.plan, c.structure, c.height]),
  );
});
test('all 8192 advertised variations are distinct compiled instructions', () => {
  for (const type of Object.keys(variantCounts) as (keyof typeof variantCounts)[]) {
    const texts = Array.from(
      { length: variantCounts[type] },
      (_, i) => decodeVariant(type, i).text,
    );
    assert.equal(new Set(texts).size, variantCounts[type]);
  }
  assert.equal(
    Object.values(variantCounts).reduce((a, b) => a + b),
    8192,
  );
});
test('fact locks, parent assets and explicit player consent are mandatory', () => {
  const p = fixture();
  assert.ok(blockers(p, 'R0').some((x) => x.includes('SITE')));
  p.assets.push(asset('SITE'));
  assert.equal(blockers(p, 'R0').length, 0);
  p.facts.club.status = 'single-source';
  assert.ok(blockers(p, 'R0').some((x) => x.includes('Kulüp')));
  p.facts.club.status = 'verified';
  p.assets.push(asset('TF2'), asset('NB0'), asset('PLAYER'));
  assert.ok(blockers(p, 'TF3').some((x) => x.includes('Oyuncu seçimi')));
  p.playerConsent = true;
  assert.deepEqual(blockers(p, 'TF3'), []);
});
test('a stadium selection requires all ten accepted sheets in its own batch', () => {
  const p = fixture();
  assert.equal(selectionBlockers(p, p.candidates[0]).length, 10);
  for (let i = 1; i <= 9; i++) p.assets.push(asset(`C${i}`));
  assert.equal(selectionBlockers(p, p.candidates[0]).length, 1);
  p.assets.push(asset('C10'));
  assert.deepEqual(selectionBlockers(p, p.candidates[0]), []);
  assert.equal(selectionBlockers(p, createCandidates(72, 2)[0]).length, 10);
});
test('excavation, night continuity, ten-cell sheets and reference tags are compiled correctly', () => {
  const p = fixture();
  p.assets.push(asset('R0'), asset('E0'), asset('D0'), asset('NB0'));
  assert.match(imagePrompt(p, 'E0'), /ONE shallow layer/);
  assert.match(imagePrompt(p, 'NB0'), /60–90 minutes after sunset/);
  assert.match(imagePrompt(p, 'C1'), /exactly 2 columns by 5 rows/);
  for (let n = 1; n <= 10; n++)
    assert.match(imagePrompt(p, 'C1'), new RegExp(`C1-${String(n).padStart(2, '0')}`));
  const clips = videoPrompts(p);
  assert.match(clips[0].prompt, /@image-1 = R0.png/);
  assert.equal(clips[0].ready, true);
  assert.equal(clips.find((c) => c.id === 'V14')?.ready, false);
  assert.doesNotMatch(clips.find((c) => c.id === 'V14')!.prompt, /@image-[12]/);
});
test('unverified facts never enter compiled prompts', () => {
  const p = fixture();
  p.facts.crest = {
    value: 'WRONG_CREST_SENTINEL',
    sources: [],
    official: false,
    status: 'unverified',
  };
  assert.doesNotMatch(imagePrompt(p, 'D0'), /WRONG_CREST_SENTINEL/);
  assert.match(imagePrompt(p, 'D0'), /leave emblem panels blank/);
});
test('custom celebration selection affects its image and video pair', () => {
  const p = fixture();
  p.variant.celebration = 8;
  assert.match(imagePrompt(p, 'SHF'), /laser fans/);
  assert.match(videoPrompts(p).find((c) => c.id === 'VSHOW')!.prompt, /roof-mounted emitters/);
});
