import type { Project, Fact, Asset } from '../shared/types';
import { createCandidates } from '../shared/engine';
export function fixture(): Project {
  const f: Fact = {
    value: 'Verified test value',
    sources: ['https://example.org/official'],
    status: 'verified',
    official: true,
  };
  return {
    id: 'test',
    name: 'Test',
    club: {
      id: 'club',
      name: 'Test club',
      country: 'Test',
      region: 'test',
      city: 'Test city',
      stadium: 'Test stadium',
      aliases: [],
      source: 'https://example.org',
      sourceRevision: 'test',
    },
    createdAt: '2026-10-23',
    updatedAt: '2026-10-23',
    revision: 0,
    referenceDate: '2026-10-23',
    facts: {
      club: { ...f, value: 'Test club' },
      stadium: { ...f },
      city: { ...f },
      colors: { ...f },
      symbol: { ...f },
      capacity: { ...f },
      geography: { ...f },
      crest: { ...f },
      player: { ...f },
    },
    camera: 'A',
    capacity: 100000,
    seed: 72,
    batch: 1,
    candidates: createCandidates(72),
    selectedId: null,
    assets: [],
    variant: { removal: 0, emergence: 0, celebration: 0 },
    playerConsent: false,
    notes: '',
  };
}
export const asset = (code: string): Asset => ({
  id: `asset-${code}`,
  code,
  url: `/media/${code}.png`,
  filename: `${code}.png`,
  status: 'accepted',
  origin: 'upload',
  createdAt: '2026-10-23',
  references: [],
  checks: [],
  width: 1024,
  height: 1536,
});
