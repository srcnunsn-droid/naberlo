import type { Project } from './types';
export const storyRecipes = [
  {
    id: 'rebirth',
    name: 'Sabit şehir · hızlı yeniden doğuş',
    seconds: 20,
    references: ['REF03'],
    removal: 'eraser',
    emergence: 'capsule',
    note: 'Silgi teması → kapsül → yeni mimari → gece finali.',
    shots: [
      ['V1', 4],
      ['V2', 8],
      ['V3', 4],
      ['V14', 4],
    ],
  },
  {
    id: 'epic',
    name: 'Mimarinin adım adım kurulması',
    seconds: 28,
    references: ['REF07', 'REF08', 'REF09', 'REF10'],
    removal: 'freeze',
    emergence: 'origami',
    note: 'Daha uzun söküm ve yapı kurulumu, kısa gece finali.',
    shots: [
      ['V1', 8],
      ['V2', 12],
      ['V3', 4],
      ['V14', 4],
    ],
  },
  {
    id: 'identity',
    name: 'Fırçadan arma ve tribün finaline',
    seconds: 24,
    references: ['REF02'],
    removal: 'brush',
    emergence: 'capsule',
    note: 'Yeni yapıdan gökyüzü armasına ve tribün tifosuna kesme.',
    shots: [
      ['V1', 4],
      ['V2', 8],
      ['V3', 4],
      ['V5', 4],
      ['V12b', 4],
    ],
  },
  {
    id: 'arrival',
    name: 'Şehirden taraftarın içine',
    seconds: 24,
    references: ['REF01', 'REF04', 'REF05'],
    removal: 'wash',
    emergence: 'capsule',
    note: 'Sabit hava görüntüsü ardından sokak ve drone gösterisi.',
    shots: [
      ['V1', 4],
      ['V2', 8],
      ['V3', 4],
      ['V10', 4],
      ['V5', 4],
    ],
  },
  {
    id: 'road',
    name: 'Cadde tifosu · renklerden armaya',
    seconds: 16,
    references: ['REF06'],
    removal: 'eraser',
    emergence: 'capsule',
    note: 'Söküm yok. Uzun kumaşın renk, arma ve kutlama değişimi.',
    shots: [
      ['VS1', 4],
      ['VS2', 4],
      ['VS4', 8],
    ],
  },
  {
    id: 'road-player',
    name: 'Cadde tifosu · oyuncu finali',
    seconds: 20,
    references: ['REF06'],
    removal: 'eraser',
    emergence: 'capsule',
    note: 'Oyuncu seçimi ve doğrulanmış PLAYER referansı gerektirir.',
    shots: [
      ['VS1', 4],
      ['VS2', 4],
      ['VS3', 4],
      ['VS5', 8],
    ],
  },
] as const;
export const storyRecipe = (p: Project) => storyRecipes.find((r) => r.id === p.story?.recipeId);
export function shotDuration(p: Project, code: string): 4 | 8 | 12 {
  return (storyRecipe(p)?.shots.find(([id]) => id === code)?.[1] || 12) as 4 | 8 | 12;
}
export function directorNotes(p: Project, code: string, still = false) {
  if (!storyRecipe(p)) return '';
  const base =
    'REFERENCE-LED DIRECTION: Preserve the same real street junctions, shoreline/mountain horizon and existing neighboring buildings. The reference films demonstrate a fictional transformation, not evidence about current club membership or real architecture. Keep one coherent selected new stadium across every shot. Club identities and player likenesses must come only from this project’s verified references. Never reproduce another club’s watermark or caption.';
  if (still)
    return `${base} This image is a single frozen state. Keep room for later editorial titles; do not bake opening/closing subtitles into the generated pixels.`;
  const action =
    code === 'V1'
      ? 'The giant tool is visible in the first half-second. Removal happens only behind visible contact. Do not spend the opening seconds on an empty establishing view. Hold the completely cleared plot briefly at the end.'
      : code === 'V2'
        ? 'Follow the chosen emergence mechanism exactly. If a hand places the initial object, show ground contact and release; the hand exits before expansion. Pitch/plaza first, supported seating rings next, facade and the selected roof last. No abrupt swap into a different finished stadium. End with a readable completed building.'
        : /^VS[1-5]$/.test(code)
          ? 'Locked elevated view along one continuous real approach road. Cloth is moved by visible supporters with a progressing fold/roll front, coherent tension and wind. No solid ground liquefaction, changing coastline or moving buildings. The stadium stays at the same vanishing point.'
          : 'Deliver one clear readable payoff, not several unrelated effects competing at once. Hold the final recognizable club identity for the last half-second.';
  return `${base}\n${action}\nUse natural action sound only when supported by the model. No invented commentary, anthem or background song. Audio choices will be applied in the final edit. Match timing to the actual requested clip duration.`;
}
