import type { Option } from './types';
const options = (items: [string, string, string][]): Option[] =>
  items.map(([id, name, text]) => ({ id, name, text }));
export const families = options([
  ['diagrid', 'Çapraz örgü', 'twisted steel diagrids and woven lattices'],
  ['origami', 'Origami kabuk', 'folded triangular plates and faceted shells'],
  [
    'mascot',
    'Anıtsal kimlik',
    'monumental verified club symbol integrated as occupied architecture',
  ],
  ['crown', 'Kaburgalı taç', 'radiating structural ribs and elevated blade crowns'],
  ['wave', 'Dalga & şerit', 'flowing club-color bands with deep overlapping volumes'],
  ['wing', 'Kanat & yaprak', 'interlocking petal and wing-shaped roof leaves'],
  ['media', 'Medya cephesi', 'daylight-visible LED mosaic and layered ETFE skins'],
  ['kinetic', 'Kinetik devler', 'retractable translucent mega-roofs with readable tracks'],
  ['cantilever', 'Cesur açıklıklar', 'colossal steel arches and balanced cantilever wings'],
  ['landmark', 'Yeni ikonlar', 'asymmetric interlocking futuristic landmark volumes'],
]);
export const cameras = options([
  [
    'A',
    'A · Dönüşüm ana kamera',
    'Fixed elevated corner three-quarter view, 24 mm equivalent, 25–30 degrees downward. Horizon 12–18% from the top. Existing stadium occupies 55–65% of frame width. Preserve camera pose, horizon, plot and at least five city anchors. No camera motion.',
  ],
  [
    'B',
    'B · Taraftar yaklaşımı',
    'Eye-level plaza view, 24–35 mm equivalent, supporters in foreground, the accepted facade in the middle distance and clear upper sky. Preserve a verified approach toward the entrance.',
  ],
  [
    'C',
    'C · Tribün köşesi',
    'A seating-corner position inside the stadium, 20–28 mm equivalent, looking across the regulation pitch with foreground supporters, the accepted tiers and roof, and clear show sky.',
  ],
  [
    'D-WIDE',
    'D · Geniş sokak',
    'Verified street pointing toward the stadium, 1.2–3 m high, 16–24 mm equivalent, 150–400 m from the stadium. Level verticals, supporters walking toward the entrance, clear upper sky.',
  ],
  [
    'D-TELE',
    'D · Tele sokak',
    'Verified straight street sightline, 70–135 mm equivalent, 600–1500 m away. The stadium towers above the street through optical compression. Do not invent streets.',
  ],
  [
    'E',
    'E · Şehir çatısı',
    'Verified rooftop 1–3 km away, 24–50 mm equivalent, city and stadium in context. Distant firework sound delayed about three seconds per kilometer.',
  ],
  [
    'F',
    'F · Alçak kahraman',
    'Forecourt camera 0.5–1.5 m high, 14–20 mm equivalent, looking upward with intentional converging verticals. Towering entrance, foreground supporters and upper show sky.',
  ],
  [
    'G',
    'G · FPV tek plan',
    'One continuous FPV flight from the approach street above the crowd, across the forecourt and through a verified open roof to the center circle. Only for a model with this capability; never fly through a closed roof.',
  ],
  [
    'H',
    'H · Hava turu',
    'Aerial orbit 300–600 m from the stadium, 150–300 m high, 35–70 mm equivalent, slowly covering 15–30 degrees. Coherent parallax and stable architecture.',
  ],
  [
    'C2',
    'C2 · Saha seviyesi',
    'Touchline camera about 1 m high, 20–24 mm equivalent, looking up at steep full stands, club tifo and the accepted roof.',
  ],
]);
export const removals = options([
  [
    'eraser',
    'Dev silgi',
    'A giant eraser contacts the building and removes only the stroked area. Granular residue travels with the stroke; a final sweep visibly clears it to the shallow plot.',
  ],
  [
    'freeze',
    'Dondur & kır',
    'Spray coats the intact stadium in frost. One visible hammer impact initiates brittle fracture. A visible suction follow-through clears fragments to the shallow plot.',
  ],
  [
    'scraper',
    'Sıyırıcı bıçak',
    'A supported blade enters at the building base and progressively peels material onto a clear exit route, revealing the lowered plot.',
  ],
  [
    'brush',
    'Dev fırça',
    'Bristles bend on contact, sweeping only contacted fragments out of the plot. The final pass clears the shallow floor.',
  ],
  [
    'vacuum',
    'Vakum',
    'A visible nozzle draws loosened material into its opening with coherent acceleration. Remaining dust settles after every fragment is visibly cleared.',
  ],
  [
    'magnet',
    'Manyetik kaldırma',
    'A giant fictional lifting magnet engages a structural rig. The complete structure rises with mass, attachment shadows and falling soil, then exits. This is a creative VFX premise.',
  ],
  [
    'wash',
    'Basınçlı su',
    'A coherent water jet removes only the contacted region with splash and runoff; visible suction clears the wet material. No frost.',
  ],
  [
    'pluck',
    'Tut & kaldır',
    'Giant fingers grip under the roof rim; the intact stadium lifts with weight and falling soil, exits the frame and reveals the shallow plot.',
  ],
  [
    'peel',
    'Etiket gibi soy',
    'A giant fingernail lifts an edge. The stadium and in-boundary base peel continuously as a flexible layer, curl up and are carried away. Intentional VFX.',
  ],
  [
    'slice',
    'Dilimle & çıkar',
    'A giant knife makes visible radial cuts; a server lifts the wedges out one by one, with supported cut faces and falling crumbs, until the shallow plot is clear.',
  ],
  [
    'scoop',
    'Kaşıkla kaldır',
    'A giant scoop curls contacted structure upward and carries it away. Repeated coherent scoops clear all remaining material.',
  ],
  [
    'hydraulic',
    'Hidrolik iniş',
    'A giant finger presses a site-edge button. The stadium descends on a supported platform; a soil-covered slab closes one shallow layer below street level.',
  ],
  [
    'fold',
    'Katla & paketle',
    'Giant hands fold four structural sides along visible creases into one package, lift it and carry it out. The plot remains one shallow layer deep.',
  ],
  [
    'implode',
    'İçe çöküş & temizlik',
    'The structure collapses inward in a fictional controlled demolition sequence. A visible giant nozzle removes debris and dust to reveal the clean shallow floor.',
  ],
  [
    'rewind',
    'Zamanı geri sar',
    'A hand turns a rewind dial. Roof and tiers disassemble in reverse construction order with supported cranes and vehicles carrying components out.',
  ],
  [
    'claw',
    'Vinç pençesi',
    'A gantry claw closes around the stadium, lifts it with a small weighted swing and carries it clear of the site.',
  ],
]);
export const emergences = options([
  [
    'capsule',
    'Dev kapsül',
    'A giant hand lowers a thick square-plan capsule onto the shallow floor; contact, weight settles, release, hand exits. The capsule unfolds into the regulation pitch first, plazas second, tiers and facade third, and the selected roof last.',
  ],
  [
    'underground',
    'Yerden yükseliş',
    'Guide rails lift the regulation pitch first, plazas extend to street level, then supported tier rings rise and lock. Roof panels complete the selected design last.',
  ],
  [
    'telescope',
    'Teleskopik yükseliş',
    'The pitch rolls out, the podium unfolds, nested tier rings extend on rails and the roof segments slide into the recorded roof state.',
  ],
  [
    'origami',
    'Origami açılımı',
    'A folded engineered metal sheet unfolds on real hinges into the pitch, plaza, supported tiers and selected roof in that order.',
  ],
  [
    'quarters',
    'Dört parçalı birleşim',
    'The pitch rolls out, plaza rails extend, four supported stadium quarters slide inward and join, and roof halves bridge last.',
  ],
  [
    'flower',
    'Mekanik çiçek',
    'Steel petals open to reveal the pitch, unfold to form the plaza and reconfigure on joints into supported tiers and roof.',
  ],
  [
    'model',
    'Maketten gerçeğe',
    'A giant hand places a model and withdraws. It expands from pitch to plaza to stadium at fixed city scale, with grounded contact throughout.',
  ],
  [
    'blueprint',
    'Plandan gerçeğe',
    'Club-colored projected lines draw the pitch, plaza and structure; each zone fills with real materials in the same order. Projectors remain visible.',
  ],
  [
    'robots',
    'Robotik inşa',
    'Supported robotic gantries lay the pitch, build the plaza, assemble the tiers and place the roof; equipment withdraws outside the final frame.',
  ],
  [
    'timelapse',
    'İnşaat zaman atlaması',
    'Compressed time-lapse: cranes and trucks prepare the pitch and surrounding plaza, erect tiers and facade, then install the roof; cranes leave before the final hold.',
  ],
]);
export const rhythms = options([
  ['sweep', 'Tek yönlü dalga', 'one continuous left-to-right activation wave'],
  ['rings', 'Merkezden dışarı', 'concentric zones progressing outward'],
  ['sequential', 'Bölüm bölüm', 'four consecutive structural zones activated in order'],
  ['pulse', 'Üç vuruş', 'three clearly separated pulses, each producing a new visible state'],
  ['diagonal', 'Çapraz akış', 'a diagonal front-to-back progression'],
  [
    'spiral',
    'Dairesel ilerleyiş',
    'a clockwise sequence of adjacent sections without twisting the building',
  ],
  ['paired', 'İkili simetri', 'opposed pairs activating with a short stagger'],
  [
    'crescendo',
    'Artan tempo',
    'a slow visible start followed by progressively faster coherent sections',
  ],
]);
export const entries = [
  'left side',
  'right side',
  'upper-left corner',
  'upper-right corner',
  'far side of the plot',
  'near side of the plot',
];
export const textures = [
  'restrained dry grit',
  'fine settling dust',
  'small weighted fragments',
  'soft ground vibration',
];
export const celebrationForms = options([
  ['flag', 'Bayrak denizi', 'coordinated flags on real poles'],
  ['scarves', 'Atkı koreografisi', 'raised scarves forming a continuous club-color band'],
  ['cards', 'Kart mozaik', 'supporters raising colored cards in coherent seating blocks'],
  [
    'fabric',
    'Dev kumaş tifo',
    'a large fabric tifo supported by hands, unfurling with folds and shared wind',
  ],
  ['ribbons', 'Şerit dalgası', 'long fabric ribbons traveling above supporter rows'],
  [
    'crest',
    'Arma mozaiği',
    'the verified crest formed by card sections, matching the actual crest reference',
  ],
  [
    'mascot',
    'Maskot figürü',
    'the verified club symbol rendered through coordinated supporter sections',
  ],
  ['drone', 'Drone figürü', 'a dense point-light drone formation above and behind the stadium'],
  [
    'laser',
    'Lazer tacı',
    'roof-mounted emitters projecting straight laser fans through local haze, entirely above people',
  ],
  [
    'peony',
    'Şakayık patlamaları',
    'varied peony fireworks with rising trails, gravity and downwind smoke',
  ],
  [
    'willow',
    'Söğüt finali',
    'hanging willow shells and smaller crossette bursts at varied heights',
  ],
  [
    'comet',
    'Kuyruklu yıldızlar',
    'staggered comet trails and varied chrysanthemum shells above the roof',
  ],
  [
    'flares',
    'Meşale dalgası',
    'supporters holding flares at arm length, local red light and downwind smoke',
  ],
  ['smoke', 'Renkli duman', 'ground-level club-color smoke drifting in one shared wind direction'],
  [
    'city',
    'Şehir kutlaması',
    'street crowds and car convoys, balcony flags and verified unchanged city landmarks',
  ],
  [
    'lights',
    'Telefon ışıkları',
    'irregular individual phone lights forming broad seating patterns',
  ],
  ['roof', 'Çatı ışık akışı', 'LED panel sequences constrained to the accepted roof and facade'],
  [
    'mosaic',
    'Çok katlı mozaik',
    'three distinct tier patterns combining into one legible club-color composition',
  ],
  [
    'wave',
    'Tribün dalgası',
    'supporters rising and lowering their arms in a continuous seating wave',
  ],
  [
    'finale',
    'Birleşik final',
    'a staggered sequence of scarf lifts, roof lights and varied fireworks with one final peak',
  ],
]);
export const venues = [
  'inside the accepted bowl',
  'at the forecourt',
  'on a verified approach street',
  'in clear sky above the roof',
  'across verified city viewpoints',
];
export const intensities = [
  'restrained opening',
  'building intensity',
  'match-night peak',
  'finale with a readable hold',
];
export const variantCounts = {
  removal: removals.length * rhythms.length * entries.length * textures.length,
  emergence: emergences.length * rhythms.length * entries.length * textures.length,
  celebration: celebrationForms.length * rhythms.length * venues.length * intensities.length,
};
export const reviewChecks = [
  'Kimlik ve yazılar doğru',
  'Kamera ve şehir devamlılığı korunuyor',
  'Mimari / saha geometrisi tutarlı',
  'Işık ve malzemeler fotoğrafik',
  'İnsanlar, bayraklar ve ölçek tutarlı',
  'İstenen durum ve panel sayısı doğru',
];
export const stages = [
  {
    id: 'R0',
    name: 'Orijinal stadyum',
    description: 'Gerçek fotoğraftan kimliği korunan ana referans.',
  },
  { id: 'E0', name: 'Boş arazi', description: 'Tek katmanlı sığ kazı. Aynı kamera, aynı şehir.' },
  {
    id: 'C',
    name: 'Tasarım kolajları',
    description: '10 kolaj, 100 farklı mimari. Yeni serilerle genişlet.',
  },
  {
    id: 'D0',
    name: 'Seçilen tasarım',
    description: 'Seçilen mimariyi ana kamera ve arsaya yerleştir.',
  },
  { id: 'NB0', name: 'Doğal gece', description: 'Efektsiz gece temeli; gerçek ışık kaynakları.' },
  { id: 'N0', name: 'Maç gecesi', description: 'Gece temelinden kutlama ve havai fişek.' },
  { id: 'ST0', name: 'Sokak başlangıcı', description: 'Yaklaşan taraftarlar, gökyüzü gösterisiz.' },
  {
    id: 'STF',
    name: 'Sokak kutlaması',
    description: 'Aynı sokakta bayraklar, meşaleler ve final.',
  },
  { id: 'TF0', name: 'Tifo başlangıcı', description: 'Tribün köşesinden açılmamış koreografi.' },
  {
    id: 'TF1',
    name: 'Bayrak tifo',
    description: 'Tribün bayrağı açılır; kamera ve tribünler sabit.',
  },
  { id: 'TF2', name: 'Arma tifo', description: 'Doğrulanmış arma koreografisi.' },
  {
    id: 'TF3',
    name: 'Oyuncu tifo',
    description: 'Yalnızca açık oyuncu seçimi ve doğrulanmış kimlikle.',
  },
  { id: 'DF0', name: 'Drone başlangıcı', description: 'Gece stadyumu, gösterisiz gökyüzü.' },
  {
    id: 'DFF',
    name: 'Drone gösterisi',
    description: 'Arma veya doğrulanmış simgeyi oluşturan ışık noktaları.',
  },
  {
    id: 'LZ0',
    name: 'Lazer başlangıcı',
    description: 'Çatı vericileri ve hafif pus, ışınlar kapalı.',
  },
  {
    id: 'LZF',
    name: 'Lazer gösterisi',
    description: 'Taraftarların üstünde düz ışınlar ve gökyüzü taraması.',
  },
  { id: 'CT0', name: 'Şehir başlangıcı', description: 'Doğrulanmış şehir açısından sıradan gece.' },
  { id: 'CTF', name: 'Şehir kutlaması', description: 'Sokaklar ve balkonlarda kutlama.' },
  {
    id: 'FW0',
    name: 'Final başlangıcı',
    description: 'Hava kamerasından gösterisiz gece stadyumu.',
  },
  {
    id: 'FWF',
    name: 'Havai fişek finali',
    description: 'Farklı yüksekliklerde patlamalar ve duman fiziği.',
  },
  {
    id: 'SH0',
    name: 'Özel gösteri başlangıcı',
    description: 'Varyasyon motorundaki seçili gösterinin açılışı.',
  },
  {
    id: 'SHF',
    name: 'Özel gösteri finali',
    description: 'Seçili kutlama kombinasyonunun eşleşmiş finali.',
  },
  ...[
    ['SF0', 'Cadde tifo başlangıcı'],
    ['SF1', 'Cadde renk tifosu'],
    ['SF2', 'Cadde arma tifosu'],
    ['SF3', 'Cadde oyuncu tifosu'],
    ['SF4', 'Cadde arma finali'],
    ['SF5', 'Cadde oyuncu finali'],
  ].map(([id, name]) => ({
    id,
    name,
    description: 'Aynı gerçek cadde, kumaş, taraftarlar ve sabit kamera.',
  })),
];
