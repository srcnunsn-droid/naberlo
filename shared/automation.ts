import { storyRecipe } from './story';
import type { Project, AutomationStep, Asset } from './types';
import { blockers, clipPairs, dependencies, isSheet, sheetCode, accepted } from './engine';

export function projectSignature(p: Project) {
  return JSON.stringify({
    facts: p.facts,
    camera: p.camera,
    capacity: p.capacity,
    selected: p.selectedId,
    notes: p.notes,
    date: p.referenceDate,
    playerConsent: p.playerConsent,
    variant: p.variant,
    story: p.story?.recipeId,
  });
}
export function referenceSignature(p: Project, code: string) {
  return projectSignature(
    ['R0', 'E0'].includes(code) || isSheet(code)
      ? {
          ...p,
          selectedId: null,
          story: undefined,
          variant: { removal: 0, emergence: 0, celebration: 0 },
        }
      : p,
  );
}
function referenceMatches(p: Project, a: Asset) {
  const expected = referenceSignature(p, a.code);
  if (a.configuration === expected) return true;
  // Older saved previews included motion settings, although these stills do not
  // use them. Reuse only when every other recorded setting still matches.
  if (a.configuration && (['R0', 'E0'].includes(a.code) || isSheet(a.code))) {
    try {
      const saved = JSON.parse(a.configuration);
      saved.selected = null;
      delete saved.story;
      saved.variant = { removal: 0, emergence: 0, celebration: 0 };
      return JSON.stringify(saved) === expected;
    } catch {
      return false;
    }
  }
  return false;
}
// A temporary reference view enables unattended chaining. Saved assets retain
// their true "review" status; this never records a human quality approval.
export function automationView(p: Project): Project {
  const candidates = new Map<string, Asset>();
  for (const a of p.assets) {
    if (
      a.status === 'accepted' ||
      (a.status === 'review' && a.origin === 'openai' && referenceMatches(p, a))
    )
      candidates.set(a.code, a);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [code, a] of candidates) {
      if (
        a.references.some((id) => {
          const ref = p.assets.find((r) => r.id === id);
          return !ref || candidates.get(ref.code)?.id !== id;
        })
      ) {
        candidates.delete(code);
        changed = true;
      }
    }
  }
  return {
    ...p,
    assets: p.assets.map((a) => ({
      ...a,
      status: candidates.get(a.code)?.id === a.id ? 'accepted' : 'rejected',
    })),
  };
}
export interface AutomationOptions {
  phase: 'previews' | 'production';
  includeVideos: boolean;
  includePlayer: boolean;
}
export function automationPlan(p: Project, options: AutomationOptions) {
  let images =
    options.phase === 'previews'
      ? ['R0', 'E0', ...Array.from({ length: 10 }, (_, i) => sheetCode(p.batch, i + 1))]
      : [
          'D0',
          'NB0',
          'N0',
          'ST0',
          'STF',
          'TF0',
          'TF1',
          'TF2',
          ...(options.includePlayer ? ['TF3'] : []),
          'DF0',
          'DFF',
          'LZ0',
          'LZF',
          'CT0',
          'CTF',
          'FW0',
          'FWF',
          'SH0',
          'SHF',
        ];
  const recipe = storyRecipe(p);
  if (recipe && options.phase === 'production') {
    const ordered: string[] = [];
    const visit = (code: string) => {
      if (
        ['SITE', 'CREST', 'PLAYER', 'R0', 'E0'].includes(code) ||
        isSheet(code) ||
        ordered.includes(code)
      )
        return;
      for (const dep of dependencies(p, code)) visit(dep);
      ordered.push(code);
    };
    for (const [id] of recipe.shots)
      for (const code of clipPairs.find((c) => c[0] === id)!.slice(2)) visit(code);
    images = ordered;
  }
  const view = automationView(p),
    planned = new Set(images);
  const issues = new Set(images.flatMap((code) => blockers(view, code, planned)));
  const videos =
    options.includeVideos && options.phase === 'production'
      ? recipe
        ? recipe.shots.map(([id]) => clipPairs.find((c) => c[0] === id)!)
        : clipPairs.filter(
            ([id]) => !/^VS[1-5]$/.test(id) && (options.includePlayer || id !== 'V12c'),
          )
      : [];
  for (const [, , start, end] of videos)
    for (const code of [start, end])
      if (!planned.has(code) && !accepted(view, code)) issues.add(`${code} video referansı eksik.`);
  const steps: AutomationStep[] = [
    ...images.map((code) => ({ kind: 'image' as const, code, status: 'pending' as const })),
    ...videos.map(([code]) => ({ kind: 'video' as const, code, status: 'pending' as const })),
  ];
  const imageRequests = images.filter((code) => !accepted(view, code)).length;
  return {
    steps,
    issues: [...issues],
    imageRequests,
    videoRequests: videos.length,
    videoSeconds: videos.length ? recipe?.seconds || videos.length * 12 : 0,
    reviewNotice:
      'Ara görseller otomatik olarak sonraki üretimde kullanılır. Sonuçlar insan tarafından kabul edilmiş sayılmaz; kontrol bekler.',
  };
}
