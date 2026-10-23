import type { Asset, Candidate, Fact, FactKey, Project } from './types';
import {
  cameras,
  families,
  removals,
  emergences,
  rhythms,
  entries,
  textures,
  celebrationForms,
  intensities,
  variantCounts,
} from './catalog';

const plans = [
  'elongated hexagon',
  'rounded rectangle with four cut corners',
  'asymmetric eight-sided perimeter',
  'split oval with projecting entry wings',
  'diamond perimeter around a rectangular pitch',
  'triangular outer perimeter with a rectangular bowl',
  'interlocking four-lobed perimeter',
  'tapered elliptical perimeter',
  'offset twin-shell perimeter',
  'rounded pentagon perimeter',
];
const roofs = [
  'open roof with elevated wing canopies',
  'fully closed translucent roof',
  'retractable roof parked half open',
  'open roof with overlapping leaves',
  'fully closed faceted ETFE roof',
  'retractable roof fully open',
  'open roof with paired cantilevers',
  'fully closed translucent ribbed roof',
  'retractable roof half open on rails',
  'open roof with a raised diagonal crown',
];
const structures = [
  'cable-net on inclined perimeter masts',
  'branching steel supports with ground anchors',
  'deep steel space frame on paired cores',
  'external diagrid exoskeleton',
  'paired tied arches and tension hangers',
  'radial trusses with a compression ring',
  'four giant cantilever cores',
  'interlaced bowstring trusses',
  'folded plate shell on buttressed steel legs',
  'perimeter megaframe with suspended decks',
];
const facades = [
  'deep feather fins over glazing',
  'folded aluminum panels with inset LED mesh',
  'woven structural lattice and ETFE cushions',
  'overlapping curved ribbon bands',
  'perforated metallic scales over glass',
  'ceramic-fritted glass with exposed nodes',
  'three-layer LED mosaic and membrane',
  'inclined silver blades over a transparent base',
  'white GFRC folds with recessed glazing',
  'tensioned PTFE panels in a stepped frame',
];
const heights = [
  'one dominant north crown',
  'two unequal gateway peaks',
  'four ascending corner volumes',
  'a continuous undulating crown',
  'one sloped high-side grandstand',
  'alternating tall and short segments',
  'three projecting upper-tier wings',
];
const segments = [
  'four detached buttress volumes joined by bridges',
  'three nested offset shells',
  'six radiating volumes over a stepped base',
  'a continuous ring split by two deep gateways',
  'two interlocking crescents',
  'eight staggered segments on a raised concourse',
  'four rotated upper-tier blocks',
  'a single folded envelope with recessed atria',
];
const entrances = [
  'one monumental split portal',
  'four recessed corner atria',
  'two diagonal gateway bridges',
  'an elevated central canopy over broad stairs',
  'three vertical glazed entrance slots',
  'a terraced forecourt opening',
  'two sweeping wing entrances',
];
const materials = [
  'ETFE cushions on the roof',
  'brushed steel on primary supports',
  'perforated anodized aluminum on the facade',
  'structural glass at entrances',
  'smooth white GFRC on the plinth',
  'PTFE tension membrane on canopies',
  'LED mesh recessed within facade panels',
  'ceramic-fritted glazing on concourses',
];
export const totalArchitectureCombinations =
  plans.length *
  roofs.length *
  structures.length *
  facades.length *
  heights.length *
  segments.length *
  entrances.length *
  families.length;

export function createCandidates(seed: number, batch = 1): Candidate[] {
  return Array.from({ length: 100 }, (_, i) => {
    const sheet = Math.floor(i / 10) + 1,
      cell = (i % 10) + 1,
      family = sheet - 1;
    const uniqueIndex = ((seed >>> 0) * 997 + (batch - 1) * 100 + i) % 5488000;
    let n = uniqueIndex;
    const pick = (arr: string[]) => {
      const v = arr[n % arr.length];
      n = Math.floor(n / arr.length);
      return v;
    };
    const plan = plans[(cell - 1 + family + batch - 1) % plans.length];
    const roof = roofs[cell - 1];
    const structure = pick(structures),
      facade = pick(facades),
      height = pick(heights),
      segmentation = pick(segments),
      entrance = pick(entrances);
    const signature = [
      plan,
      roof,
      structure,
      facade,
      height,
      segmentation,
      entrance,
      families[family].id,
      uniqueIndex,
    ].join('|');
    return {
      id: `${batch > 1 ? `B${batch}-` : ''}C${sheet}-${String(cell).padStart(2, '0')}`,
      batch,
      sheet,
      cell,
      family,
      name: `${families[family].name} ${String(cell).padStart(2, '0')}`,
      plan,
      roof,
      structure,
      facade,
      height,
      language: families[family].text,
      segmentation,
      entrance,
      materials: [
        materials[(i + batch) % 8],
        materials[(i + batch + 2) % 8],
        materials[(i + batch + 5) % 8],
      ],
      mascot: cell <= (family === 2 ? 5 : 3) ? 'figure' : 'motif',
      signature,
      seed: uniqueIndex,
    };
  });
}
export const sheetCode = (batch: number, sheet: number) =>
  `${batch > 1 ? `B${batch}-` : ''}C${sheet}`;
export const accepted = (p: Project, code: string): Asset | undefined =>
  p.assets.findLast((a) => a.code === code && a.status === 'accepted');
export const isSheet = (code: string) => /^(B\d+-)?C([1-9]|10)$/.test(code);
export function parseSheet(code: string) {
  const m = code.match(/^(?:B(\d+)-)?C(\d+)$/);
  return m ? { batch: Number(m[1] || 1), sheet: Number(m[2]) } : null;
}
export const isVerified = (f: Fact) =>
  f.status === 'verified' &&
  !!f.value.trim() &&
  f.sources.length > 0 &&
  (f.official || new Set(f.sources.map((s) => new URL(s).hostname)).size >= 2);
export function dependencies(p: Project, code: string): string[] {
  if (code === 'R0') return ['SITE'];
  if (code === 'E0') return ['R0'];
  if (isSheet(code)) return ['R0', 'E0'];
  if (code === 'D0') {
    const c = p.candidates.find((c) => c.id === p.selectedId);
    return ['R0', 'E0', ...(c ? [sheetCode(c.batch, c.sheet)] : [])];
  }
  if (code === 'NB0') return ['D0'];
  if (code === 'N0') return ['NB0'];
  const pairs: Record<string, string[]> = {
    ST0: ['NB0'],
    STF: ['ST0', 'NB0'],
    TF0: ['NB0'],
    TF1: ['TF0', 'NB0'],
    TF2: ['TF1', 'NB0', 'CREST'],
    TF3: ['TF2', 'NB0', 'PLAYER'],
    DF0: ['NB0'],
    DFF: ['DF0', 'NB0'],
    LZ0: ['NB0'],
    LZF: ['LZ0', 'NB0'],
    CT0: ['NB0'],
    CTF: ['CT0', 'NB0'],
    FW0: ['NB0'],
    FWF: ['FW0', 'NB0'],
    SH0: ['NB0'],
    SHF: ['SH0', 'NB0'],
  };
  const result = pairs[code] || [];
  if (code === 'SHF' && decodeVariant('celebration', p.variant.celebration).method.id === 'crest')
    result.push('CREST');
  return result;
}
export function blockers(
  p: Project,
  code: string,
  planned: ReadonlySet<string> = new Set(),
): string[] {
  const out: string[] = [];
  const labels: Partial<Record<FactKey, string>> = {
    club: 'Kulüp adı',
    stadium: 'Stadyum',
    city: 'Şehir',
    colors: 'Kulüp renkleri',
    symbol: 'Maskot / simge',
    geography: 'Konum ve şehir sabitleri',
    crest: 'Arma',
    player: 'Oyuncu',
  };
  const needed: FactKey[] = ['club', 'stadium', 'city', 'geography'];
  if (code !== 'R0' && code !== 'E0') needed.push('colors', 'symbol');
  if (['TF2', 'TF3'].includes(code)) needed.push('crest');
  if (code === 'SHF' && decodeVariant('celebration', p.variant.celebration).method.id === 'crest')
    needed.push('crest');
  if (code === 'TF3') needed.push('player');
  for (const key of needed)
    if (!isVerified(p.facts[key])) out.push(`${labels[key]} kaynakla doğrulanmalı.`);
  for (const dep of dependencies(p, code))
    if (!accepted(p, dep) && !planned.has(dep))
      out.push(`${dep} görseli yüklenmeli / üretilmeli ve kalite kontrolünden geçmeli.`);
  if (code === 'D0' && !p.selectedId) out.push('Bir stadyum tasarımı seçilmeli.');
  if (code === 'TF3' && !p.playerConsent) out.push('Oyuncu seçimi açıkça onaylanmalı.');
  return out;
}
export function resolvedReferences(p: Project, code: string): Asset[] {
  if (['SITE', 'CREST', 'PLAYER'].includes(code)) return [];
  const refs = dependencies(p, code)
    .map((c) => accepted(p, c))
    .filter((a): a is Asset => !!a);
  const crest = isVerified(p.facts.crest) ? accepted(p, 'CREST') : undefined;
  if (crest && code !== 'E0' && !refs.some((a) => a.id === crest.id)) refs.push(crest);
  const real = accepted(p, 'R0');
  if (
    real &&
    !['R0', 'E0', 'D0'].includes(code) &&
    !isSheet(code) &&
    !refs.some((a) => a.id === real.id)
  )
    refs.push(real);
  return refs;
}
export function selectionBlockers(p: Project, candidate: Candidate): string[] {
  return Array.from({ length: 10 }, (_, i) => sheetCode(candidate.batch, i + 1))
    .filter((code) => !accepted(p, code))
    .map((code) => `${code} kolajı kabul edilmeli.`);
}
export function decodeVariant(type: keyof typeof variantCounts, value: number) {
  let n = ((Math.trunc(value) % variantCounts[type]) + variantCounts[type]) % variantCounts[type];
  const list = type === 'removal' ? removals : type === 'emergence' ? emergences : celebrationForms;
  const method = list[n % list.length];
  n = Math.floor(n / list.length);
  const rhythm = rhythms[n % rhythms.length];
  n = Math.floor(n / rhythms.length);
  const placement =
    type === 'celebration'
      ? [
          'a single central composition',
          'two balanced sections',
          'four alternating zones',
          'a layered foreground-to-background composition',
          'an asymmetric composition with clear negative space',
        ][n % 5]
      : entries[n % entries.length];
  n = Math.floor(n / (type === 'celebration' ? 5 : entries.length));
  const finish =
    type === 'celebration' ? intensities[n % intensities.length] : textures[n % textures.length];
  return {
    id: value,
    method,
    rhythm,
    placement,
    finish,
    title: `${method.name} · ${rhythm.name}`,
    text: `${method.text} Choreography: ${rhythm.text}; ${type === 'celebration' ? 'composition' : 'the first visible activation originates from'} ${placement}; ${finish}. This variation never changes the required pitch → plaza → stadium order, the method's contact physics or the approved end frame.`,
  };
}

const DAY =
  'An unedited full-scale architectural photograph. Soft natural daylight, a pale hazy sky, slightly muted true-to-life color, gradual atmospheric softness, grounded contact shadows and material-specific reflections. Preserve real surface joints, structural depth and distance-appropriate detail. No miniature appearance or artificial edge sharpening. Daylight facade panels do not emit visible bloom.';
const NIGHT =
  'An unedited night photograph taken 60–90 minutes after sunset. Expose for the stadium at approximately ISO 1600–3200, 1/30–1/60 s. Most of the city is dark; rooftops and trees remain in deep shadow. Only floodlights, facade LEDs, irregular streetlamp pools, some windows and vehicle lights illuminate the frame. Local mixed color temperatures, fine shadow noise, slight distance softness. Sky weather follows the day reference; no sunset band. Club-colored spill stays near the facade. Ground follows established weather. No uniform orange wash or mirror-like paving added by default.';
const PHOTO =
  'The full-scale structure and city share one physical camera, light direction, exposure and optical texture. A 105 by 68 m pitch with two goals establishes scale. Respect actual occlusion and ground contact. Keep the central subject clear of the bottom 20%, right 15% and top 10% social overlays. Fictional new stadium and celebrations are AI concepts, not real events or approved projects.';
function identity(p: Project) {
  return (
    Object.entries(p.facts)
      .filter(([k, f]) => k !== 'player' && isVerified(f))
      .map(([k, f]) => `${k}: ${f.value}`)
      .join('\n') || 'No identity fact is verified yet. This is a draft and cannot be rendered.'
  );
}
function architecture(c: Candidate, p: Project) {
  return `${c.id}: ${c.plan}; ${c.segmentation}; ${c.height}; ${c.roof}; supported by ${c.structure}; ${c.facade}; ${c.entrance}. Design language: ${c.language}. ${c.mascot === 'figure' ? 'A monumental verified mascot/symbol forms inhabited structural architecture' : 'The verified symbol is translated into architectural motifs'}. Materials and physical roles: ${c.materials.join('; ')}. Three deep steep tiers, dominant upper tier, proposed ${p.capacity.toLocaleString('en-US')} spectators; a full regulation pitch appears small inside the bowl. Integrated acoustic canopy, realistic daylight LED panels and solar surfaces. Club-pattern plaza, ground planting, fountains and entrance stairs. No building-surface vegetation, antique masonry, cartoons, pasted-on statues or resemblance to the old stadium.`;
}
export function imagePrompt(p: Project, code: string): string {
  const refs = resolvedReferences(p, code);
  const refText = refs.length
    ? refs
        .map(
          (a, i) =>
            `Image ${i + 1} (${a.code}, ${a.id}): ${a.code === 'NB0' ? 'night light and exposure authority' : a.code === 'SITE' || a.code === 'R0' ? 'real site, existing identity and camera authority' : isSheet(a.code) ? `selected architecture authority; use only ${p.selectedId}` : 'accepted geometry and scene-state reference'}.`,
        )
        .join('\n')
    : 'No image reference attached yet. Render is blocked until the required references are accepted.';
  const selected = p.candidates.find((c) => c.id === p.selectedId);
  const sheet = parseSheet(code);
  const show = decodeVariant('celebration', p.variant.celebration);
  const showCamera = ['city'].includes(show.method.id)
    ? 'E'
    : ['laser', 'flares', 'smoke'].includes(show.method.id)
      ? 'F'
      : ['drone', 'peony', 'willow', 'comet', 'finale', 'roof'].includes(show.method.id)
        ? 'H'
        : 'C';
  const cameraCode = code.startsWith('SH')
    ? showCamera
    : ['ST0', 'STF'].includes(code)
      ? p.camera.startsWith('D')
        ? p.camera
        : 'D-WIDE'
      : code.startsWith('TF')
        ? 'C'
        : code.startsWith('CT')
          ? 'E'
          : code.startsWith('FW')
            ? 'H'
            : code.startsWith('DF')
              ? 'B'
              : code.startsWith('LZ')
                ? 'F'
                : 'A';
  const camera = cameras.find((c) => c.id === cameraCode)!.text;
  let action = '';
  if (code === 'R0')
    action =
      'Edit the real site photograph into the requested Camera A reference. Preserve the authentic existing stadium, roof asymmetries, pitch orientation, actual capacity and at least five real city anchors. Do not redesign or enlarge the real stadium. No crowd additions, tools, capsule or show. If unseen geometry is not established by references, do not invent it as a verified reconstruction.';
  else if (code === 'E0')
    action =
      'Edit accepted R0 only within the redevelopment boundary. Completely remove the stadium, pitch and in-boundary remains. Reveal a broad flat excavation exactly ONE shallow layer below street level, one clean lip and a single soil band. Thin edge shadows establish depth. No terraces, second level, deep crater, tools, debris or construction equipment. Preserve every outside city anchor and the exact camera.';
  else if (sheet) {
    const cells = p.candidates.filter((c) => c.batch === sheet.batch && c.sheet === sheet.sheet);
    action = `Create ONE selection sheet, exactly 2 columns by 5 rows, ten distinct whole buildings. Badges 1–10 at each cell's upper left; no other captions. Portrait 9:16 composition with every panel safely framed. All cells share one real city backdrop, a 35–45 degree high aerial view, matching clear afternoon sunlight, busy plazas and packed bowls. Each building occupies 65–75% of its cell. The first ${sheet.sheet === 3 ? 5 : 3} cells integrate the verified symbol as monumental architecture. Use these ten distinct massing records:\n${cells.map((c) => architecture(c, p)).join('\n\n')}\nDo not copy the existing stadium shape. No clipped buildings, duplicated cells, missing numbers or arbitrary new crest.`;
  } else if (code === 'D0')
    action = `Place ONLY the selected design ${selected?.id || '(not selected)'} from its accepted collage cell onto the accepted E0 plot, reprojected to Camera A. ${selected ? architecture(selected, p) : 'Selection required.'} Preserve its exact visible silhouette, materials and roof state. Show the finished pitch, complete forecourt and grounded structure meeting street levels. The city stays fixed; no crowd or tools. No arbitrary expansion into protected city anchors.`;
  else if (code === 'NB0')
    action =
      'Edit D0 into a natural night base. Preserve the exact architecture, roof state, camera and city. Activate real stadium lights; supporters occupy coherent stands. No fireworks, lasers, drones or flares.';
  else if (code === 'N0')
    action =
      'Edit NB0 to add varied-height peony, willow and crossette fireworks above and behind the stadium. Visible rise, spherical bursts, gravity-decaying sparks and downwind smoke; local light on roof. No ring of identical vertical fountains. Keep all accepted architecture and camera.';
  else if (code === 'SH0')
    action = `The accepted night stadium from the camera appropriate to ${show.method.name}. Prepare the physical objects for ${show.method.text}, but no active effect yet: fabric folded, flags lowered, emitters off and sky clear. The image is only the opening still, not a temporal sequence.`;
  else if (code === 'SHF')
    action = `Edit SH0 into ONE frozen peak instant of the selected show: ${show.method.text}. Composition: ${show.placement}; intensity: ${show.finish}. Preserve SH0 camera, accepted architecture and city. Freeze the visible peak, do not illustrate a timed sequence in one still. Shared wind, real supporting hands for fabric, grounded crowds and real effect sources.`;
  else {
    const descriptions: Record<string, string> = {
      ST0: 'An arriving supporter crowd on the verified approach, accepted stadium beyond, clear show sky. No active fireworks or flares.',
      STF: 'Edit ST0 at the peak of street celebration: club flags and scarves, handheld flares held at arm length, varied fireworks above the roof. Shared wind, real foot contact; preserve the actual street.',
      TF0: 'A packed bowl from its seating corner before the tifo; fabric remains folded, flags lowered. Preserve the selected roof and tier geometry.',
      TF1: 'Edit TF0: the club-color flag tifo is fully unfurled across coherent seating blocks. Hands support the folds; one shared wind direction.',
      TF2: 'Edit TF1: a correct verified club crest replaces the flag pattern within the same supported tifo. Match the actual crest reference and star arrangement exactly.',
      TF3: `Edit TF2: the user-selected player tribute is fully open on the supported tifo. Verified player details: ${isVerified(p.facts.player) ? p.facts.player.value : 'NOT VERIFIED — DO NOT RENDER'}. Do not represent a former player as current. Preserve recorded era, number and kit.`,
      DF0: 'Accepted night stadium with supporters in the forecourt and empty upper sky; no active drone formation.',
      DFF: 'Edit DF0: a dense point-light drone formation of the verified club symbol sits 120–300 m above and behind the roof. Discrete lights form the silhouette; no solid hologram body.',
      LZ0: 'Accepted night stadium and light haze. Visible roof-mounted laser emitters remain off.',
      LZF: 'Edit LZ0: thin straight laser fans originate only from the roof emitters through haze and stay entirely above supporters. No bent beams or source in the sky.',
      CT0: 'The verified city rooftop viewpoint at ordinary night, accepted stadium in the distance. Preserve real landmarks, street network and dark rooftops.',
      CTF: 'Edit CT0: crowds and car convoys fill real streets, flags on balconies, fireworks above the accepted stadium. Preserve landmark forms and geography.',
      FW0: 'The accepted night stadium from the aerial orbit starting position, with empty show sky. Preserve architecture and city.',
      FWF: 'Edit FW0: a peak finale of peonies, willows, comets and crossettes at varied heights. Real trails, sparks falling with gravity and downwind accumulating smoke; every burst comes from a defined roof or forecourt position.',
    };
    action = descriptions[code] || 'Unsupported asset code.';
  }
  const night = !['R0', 'E0', 'D0'].includes(code) && !sheet;
  const crest =
    isVerified(p.facts.crest) && accepted(p, 'CREST')
      ? `Match official crest reference ${accepted(p, 'CREST')!.id} exactly; it is included among attached images.`
      : 'No verified crest image is attached: leave emblem panels blank; do not invent a crest or stars.';
  return `STADIUM PRODUCTION ENGINE v43 — ${code}\nSingle still image; ${sheet ? 'ten-panel selection sheet' : 'portrait social frame'}.\n\nVERIFIED IDENTITY\n${identity(p)}\nReference date: ${p.referenceDate}.\n\nACTUAL REFERENCES\n${refText}\n${crest}\n\nVISIBLE STATE\n${action}\n\nCAMERA\n${sheet ? 'Identical collage camera across all ten cells, separate from Camera A.' : camera}\n\nPHOTOGRAPHY\n${night ? NIGHT : DAY}\n${PHOTO}\n\nINVARIANTS\nDo not import another club, city, palette, roof or unrelated text from a reference. Preserve accepted designs. Only verified facts above may appear. ${p.notes ? `User production notes (subordinate to verified facts and continuity): ${p.notes}` : ''}`;
}
export const clipPairs = [
  ['V1', 'Söküm', 'R0', 'E0'],
  ['V2', 'Yeni stadyumun doğuşu', 'E0', 'D0'],
  ['V3', 'Gündüzden geceye', 'D0', 'NB0'],
  ['V10', 'Sokak kutlaması', 'ST0', 'STF'],
  ['V12a', 'Bayrak tifo', 'TF0', 'TF1'],
  ['V12b', 'Arma tifo', 'TF1', 'TF2'],
  ['V12c', 'Oyuncu tifo', 'TF2', 'TF3'],
  ['V5', 'Drone gösterisi', 'DF0', 'DFF'],
  ['V13', 'Lazer gösterisi', 'LZ0', 'LZF'],
  ['V11', 'Şehir kutlaması', 'CT0', 'CTF'],
  ['V14', 'Havai fişek finali', 'FW0', 'FWF'],
  ['VSHOW', 'Özel koreografi', 'SH0', 'SHF'],
];
export function videoPrompts(p: Project) {
  return clipPairs.map(([id, title, start, end]) => {
    const a = accepted(p, start),
      b = accepted(p, end);
    const ready = !!a && !!b;
    const method =
      id === 'VSHOW'
        ? decodeVariant('celebration', p.variant.celebration).text
        : id === 'V1'
          ? decodeVariant('removal', p.variant.removal).text
          : id === 'V2'
            ? decodeVariant('emergence', p.variant.emergence).text
            : id === 'V3'
              ? 'Daylight fades continuously into full night, real lights activate progressively and supporters arrive through real entrances. Weather and architecture persist.'
              : id === 'V10'
                ? 'Supporters move toward the stadium; flags respond to one wind; flares ignite progressively and varied fireworks begin above the roof.'
                : id.startsWith('V12')
                  ? 'Supporters physically unfurl the selected tifo from its opening state to the approved final pattern. Fabric folds, hand support and sequential seating activation remain readable.'
                  : id === 'V5'
                    ? 'Discrete drones rise from behind the roof, travel along separated paths and assemble into the approved point-light figure.'
                    : id === 'V13'
                      ? 'Visible roof emitters activate straight laser fans through haze, staying above people, then resolve into the approved final formation.'
                      : id === 'V11'
                        ? 'Verified streets gradually fill with flag-waving crowds and convoys. Fireworks remain above the stadium; distant sound follows flashes by about three seconds per kilometer.'
                        : 'Fireworks launch from visible defined positions, rise, burst at varied heights and decay under gravity; downwind smoke accumulates into the final frame.';
    const night = !['V1', 'V2'].includes(id);
    const extra = ['V10', 'V14'].includes(id)
      ? `Secondary choreography rhythm: ${decodeVariant('celebration', p.variant.celebration).rhythm.text}. Do not replace the required action or the accepted final image with a different effect.`
      : '';
    const prompt = `${ready ? `INPUTS: @image-1 = ${a!.filename} (${start}); @image-2 = ${b!.filename} (${end}).` : `DRAFT — Missing accepted ${!a ? start : ''}${!a && !b ? ' and ' : ''}${!b ? end : ''}; no model input tags assigned.`}\nTARGET: Seedance on Higgsfield; verify the account's actual model/version supports first/end frames, 10 seconds and 9:16 before rendering. This is a video prompt, not a rendered clip.\n\nFORMAT: 10-second 9:16 continuous shot. ${id === 'V14' ? 'Slow 15–30 degree aerial orbit only if the accepted endpoint perspective supports it; otherwise a locked camera.' : 'Camera locked to the accepted opening composition; no pan, zoom, tilt or shake.'}\nVERIFIED IDENTITY: ${identity(p)}\nOPENING: Exactly the accepted ${start} state and camera. FINAL: Exactly ${end}, with the same selected stadium geometry, roof state and city anchors.\nACTION: ${method} ${extra}\nTIMELINE: 0.0–0.8 s: first visible causal action. 0.8–6.5 s: ordered main progression with physical contact and supported parts. 6.5–8.5 s: complete the approved endpoint. 8.5–10.0 s: readable hold with only residual secondary motion. If all causes cannot be represented in the selected engine's duration, split at stable states; never hide missing cleanup or assembly behind a jump cut.\nLIGHT: ${night ? NIGHT : DAY}\nAUDIO: ${id === 'V1' ? 'contact-specific friction, weight, fragments and the selected clearing tool' : id === 'V2' ? 'weighted contact, joint clicks, sliding rails and final mechanical locks' : 'natural crowd roar, cloth movement and sound tied to visible effects'}. No copyrighted anthem, invented dialogue or unrequested captions.\nCONTINUITY: ${id === 'V2' ? 'Full-size pitch first, plaza second, stadium and roof last. Hand exits before expansion. ' : ''}Fixed city geometry, plausible human proportions, coherent shared wind. No identity swaps, crest mutation, floating roof, geometry flicker or instant morph. ${PHOTO}`;
    return { id, title, start, end, ready, prompt };
  });
}
