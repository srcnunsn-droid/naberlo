import type { Project, VideoAsset } from './types';
import { storyRecipe } from './story';
import { accepted, clipPairs } from './engine';
import { automationView, projectSignature } from './automation';

export function videoConfiguration(p: Project) {
  return p.story?.continuity ? `${projectSignature(p)}:last-frame-v1` : projectSignature(p);
}
export function previousContinuousCode(p: Project, code: string) {
  if (!p.story?.continuity) return undefined;
  const shots = storyRecipe(p)?.shots;
  const i = shots?.findIndex(([id]) => id === code) ?? -1;
  if (!shots || i < 1) return undefined;
  const previous = clipPairs.find((c) => c[0] === shots[i - 1][0]);
  const next = clipPairs.find((c) => c[0] === code);
  // A change from aerial to street/interior/fireworks camera is an editorial cut.
  return previous?.[3] === next?.[2] ? previous?.[0] : undefined;
}
export function currentVideo(p: Project, code: string): VideoAsset | undefined {
  const view = automationView(p),
    pair = clipPairs.find((v) => v[0] === code);
  const ids = pair?.slice(2).map((c) => accepted(view, c)?.id);
  const previous = previousContinuousCode(p, code);
  const parent = previous ? currentVideo(p, previous) : undefined;
  if (previous && !parent) return undefined;
  return p.videos?.findLast(
    (v) =>
      v.code === code &&
      v.qc?.status !== 'rejected' &&
      v.configuration === videoConfiguration(p) &&
      JSON.stringify(v.references) === JSON.stringify(ids) &&
      v.continuity?.sourceVideoId === parent?.id,
  );
}
export function animaticPlan(p: Project) {
  const recipe = storyRecipe(p);
  if (!recipe) throw new Error('Önce film akışını kaydedin.');
  const view = automationView(p);
  return recipe.shots.map(([code, seconds]) => {
    const pair = clipPairs.find((c) => c[0] === code)!;
    const start = accepted(view, pair[2]),
      end = accepted(view, pair[3]);
    if (!start || !end)
      throw new Error(
        `Taslak için ${!start ? pair[2] : pair[3]} görseli eksik. Önce görsel üretimini tamamlayın.`,
      );
    return { code, seconds, start, end };
  });
}
export function animaticSignature(p: Project) {
  return JSON.stringify({
    project: projectSignature(p),
    title: p.story?.title,
    closing: p.story?.closing,
    shots: animaticPlan(p).map((s) => [s.code, s.seconds, s.start.id, s.end.id]),
  });
}
