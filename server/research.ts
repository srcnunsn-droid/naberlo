import type { Club } from '../shared/types';
type Entity = {
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, { rank: string; mainsnak: { datavalue?: { value: { id?: string } } } }[]>;
};
export async function researchClub(qid: string, request: typeof fetch = fetch): Promise<Club> {
  if (!/^Q[1-9]\d{0,11}$/.test(qid)) throw new Error('Geçersiz Wikidata kimliği.');
  async function entities(ids: string[]) {
    const url = new URL('https://www.wikidata.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'wbgetentities',
      ids: ids.join('|'),
      props: 'labels|descriptions|claims',
      languages: 'tr|en',
      format: 'json',
    }).toString();
    const r = await request(url, {
      signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'NaberloStadiumStudio/1.0 (club research)' },
    });
    if (!r.ok) throw new Error('Wikidata ayrıntı kaynağına erişilemedi.');
    return ((await r.json()) as { entities: Record<string, Entity> }).entities;
  }
  const pick = (e: Entity | undefined, key: string) => {
    const claims = e?.claims?.[key]?.filter((c) => c.rank !== 'deprecated') || [];
    return (claims.find((c) => c.rank === 'preferred') || claims[0])?.mainsnak.datavalue?.value.id;
  };
  const label = (e: Entity | undefined) => e?.labels?.tr?.value || e?.labels?.en?.value || '';
  const club = (await entities([qid]))[qid];
  const description = Object.values(club?.descriptions || {})
    .map((d) => d.value)
    .join(' ');
  if (!club || !/football|soccer|futbol/i.test(description))
    throw new Error('Bu kaydın futbol kulübü olduğu kaynakta belirlenemedi.');
  const stadiumId = pick(club, 'P115'),
    countryId = pick(club, 'P17'),
    cityId = pick(club, 'P131');
  const relatedIds = [stadiumId, countryId, cityId].filter((id): id is string => !!id);
  const related = relatedIds.length ? await entities([...new Set(relatedIds)]) : {};
  const venueCity = stadiumId ? pick(related[stadiumId], 'P131') : undefined;
  let city = label(cityId ? related[cityId] : undefined);
  if (!city && venueCity) city = label((await entities([venueCity]))[venueCity]);
  return {
    id: `wd-${qid}`,
    name: label(club),
    country: countryId
      ? related[countryId]?.labels?.en?.value || label(related[countryId]) || 'Unknown'
      : 'Unknown',
    city,
    region: 'custom',
    stadium: label(stadiumId ? related[stadiumId] : undefined),
    aliases: club.labels?.en?.value ? [club.labels.en.value] : [],
    source: `https://www.wikidata.org/wiki/${qid}`,
    sourceRevision: `wikidata-${new Date().toISOString().slice(0, 10)}`,
  };
}
