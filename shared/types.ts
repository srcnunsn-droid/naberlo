export interface Club {
  id: string;
  name: string;
  country: string;
  region: string;
  city: string;
  stadium: string;
  aliases: string[];
  source: string;
  sourceRevision: string;
}
export type FactKey =
  'club' | 'stadium' | 'city' | 'colors' | 'symbol' | 'capacity' | 'geography' | 'crest' | 'player';
export interface Fact {
  value: string;
  sources: string[];
  status: 'unverified' | 'single-source' | 'verified';
  official: boolean;
  checkedAt?: string;
}
export interface Candidate {
  id: string;
  batch: number;
  sheet: number;
  cell: number;
  family: number;
  name: string;
  plan: string;
  roof: string;
  structure: string;
  facade: string;
  height: string;
  language: string;
  segmentation: string;
  entrance: string;
  materials: string[];
  mascot: 'figure' | 'motif';
  signature: string;
  seed: number;
}
export interface Asset {
  id: string;
  code: string;
  url: string;
  filename: string;
  status: 'review' | 'accepted' | 'rejected';
  origin: 'upload' | 'openai';
  createdAt: string;
  references: string[];
  checks: string[];
  prompt?: string;
  model?: string;
  width: number;
  height: number;
}
export interface Project {
  id: string;
  name: string;
  club: Club;
  createdAt: string;
  updatedAt: string;
  revision: number;
  referenceDate: string;
  facts: Record<FactKey, Fact>;
  camera: string;
  capacity: number;
  seed: number;
  batch: number;
  candidates: Candidate[];
  selectedId: string | null;
  assets: Asset[];
  variant: { removal: number; emergence: number; celebration: number };
  playerConsent: boolean;
  notes: string;
}
export interface Job {
  id: string;
  projectId: string;
  code: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  error?: string;
  assetId?: string;
  costNotice: string;
}
export interface CatalogStats {
  total: number;
  countries: number;
  regions: string[];
  source: string;
  revision: string;
  importedAt: string;
}
export interface Option {
  id: string;
  name: string;
  text: string;
}
