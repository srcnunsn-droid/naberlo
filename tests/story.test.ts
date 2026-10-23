import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, asset } from './fixtures';
import { storyRecipes, shotDuration, directorNotes } from '../shared/story';
import {
  automationPlan,
  referenceSignature,
  projectSignature,
  automationView,
} from '../shared/automation';
import { imagePrompt, videoPrompts, blockers } from '../shared/engine';

test('reference recipes generate only their required graph with native 4/8/12 second budgets', () => {
  for (const recipe of storyRecipes) {
    const p = fixture();
    p.story = { recipeId: recipe.id, autoAssemble: true, title: '', closing: '', audio: 'mute' };
    p.selectedId = 'C1-01';
    p.playerConsent = true;
    p.assets = ['SITE', 'CREST', 'PLAYER', 'R0', 'E0', 'C1'].map(asset);
    const plan = automationPlan(p, {
      phase: 'production',
      includeVideos: true,
      includePlayer: true,
    });
    assert.deepEqual(plan.issues, [], recipe.id);
    assert.deepEqual(
      plan.steps.filter((s) => s.kind === 'video').map((s) => s.code),
      recipe.shots.map(([id]) => id),
    );
    assert.equal(
      plan.videoSeconds,
      recipe.shots.reduce((total, [, n]) => total + n, 0),
    );
    for (const [id, n] of recipe.shots) assert.equal(shotDuration(p, id), n);
    assert.ok(plan.steps.filter((s) => s.kind === 'image').length < 19);
  }
});
test('cadde tifo keeps road geometry and enforces crest and explicit player references', () => {
  const p = fixture();
  p.story = {
    recipeId: 'road-player',
    autoAssemble: true,
    title: '',
    closing: '',
    audio: 'source',
  };
  p.selectedId = 'C1-01';
  p.assets = ['SITE', 'CREST', 'R0', 'E0', 'C1', 'D0', 'NB0', 'SF0', 'SF1', 'SF2'].map(asset);
  assert.match(imagePrompt(p, 'SF2'), /approach road/);
  assert.match(imagePrompt(p, 'SF2'), /physically supported cloth/);
  assert.ok(blockers(p, 'SF3').some((s) => s.includes('PLAYER')));
  assert.ok(blockers(p, 'SF3').some((s) => s.includes('açıkça')));
  p.playerConsent = true;
  p.assets.push(asset('PLAYER'), asset('SF3'));
  assert.deepEqual(blockers(p, 'SF5'), []);
  assert.match(videoPrompts(p).find((v) => v.id === 'VS3')!.prompt, /roll and unfurl/);
  assert.match(directorNotes(p, 'V2'), /exits before expansion/);
});
test('changing editorial recipe preserves source and collage generation signatures', () => {
  const p = fixture(),
    before = referenceSignature(p, 'C1');
  p.assets = ['SITE', 'CREST', 'R0', 'E0', 'C1'].map(asset);
  const preview = p.assets.find((a) => a.code === 'C1')!;
  preview.status = 'review';
  preview.origin = 'openai';
  p.variant = { removal: 7, emergence: 3, celebration: 5 };
  preview.configuration = projectSignature(p);
  p.story = { recipeId: 'epic', autoAssemble: true, title: '', closing: '', audio: 'mute' };
  p.variant = { removal: 1, emergence: 2, celebration: 0 };
  assert.equal(referenceSignature(p, 'C1'), before);
  assert.equal(automationView(p).assets.find((a) => a.id === preview.id)?.status, 'accepted');
  assert.equal(preview.status, 'review');
  p.capacity = 140000;
  assert.equal(automationView(p).assets.find((a) => a.id === preview.id)?.status, 'rejected');
});
