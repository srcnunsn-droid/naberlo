import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { Club, Job, Project, AutomationRun } from '../shared/types';

export const dataDir = path.resolve(process.env.STADIUM_DATA_DIR || '.data');
export const mediaDir = path.join(dataDir, 'media');
fs.mkdirSync(mediaDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'studio.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS automations(id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS clubs(id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
export const store = {
  runs: () =>
    db
      .prepare('SELECT data FROM automations ORDER BY rowid DESC')
      .all()
      .map((r) => JSON.parse(r.data as string) as AutomationRun),
  run: (run: AutomationRun) => {
    run.updatedAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO automations VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
    ).run(run.id, JSON.stringify(run));
    return run;
  },
  projects: () =>
    db
      .prepare('SELECT data FROM projects ORDER BY rowid DESC')
      .all()
      .map((r) => JSON.parse(r.data as string) as Project),
  project: (id: string) => {
    const r = db.prepare('SELECT data FROM projects WHERE id=?').get(id);
    return r ? (JSON.parse(r.data as string) as Project) : undefined;
  },
  save: (p: Project) => {
    p.updatedAt = new Date().toISOString();
    p.revision++;
    db.prepare(
      'INSERT INTO projects VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
    ).run(p.id, JSON.stringify(p));
    return p;
  },
  delete: (id: string) => db.prepare('DELETE FROM projects WHERE id=?').run(id),
  jobs: () =>
    db
      .prepare('SELECT data FROM jobs ORDER BY rowid DESC')
      .all()
      .map((r) => JSON.parse(r.data as string) as Job),
  job: (j: Job) => {
    j.updatedAt = new Date().toISOString();
    db.prepare('INSERT INTO jobs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(
      j.id,
      JSON.stringify(j),
    );
    return j;
  },
  clubs: () =>
    db
      .prepare('SELECT data FROM clubs')
      .all()
      .map((r) => JSON.parse(r.data as string) as Club),
  addClubs: (clubs: Club[]) => {
    const stmt = db.prepare(
      'INSERT INTO clubs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
    );
    db.exec('BEGIN');
    try {
      for (const c of clubs) stmt.run(c.id, JSON.stringify(c));
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  },
};
// Never retry possibly billed requests after a process restart.
for (const j of store.jobs())
  if (['queued', 'running'].includes(j.status) && !(j.kind === 'video' && j.remoteId))
    store.job({
      ...j,
      status: 'failed',
      error:
        'Sunucu yeniden başladı. Önce sağlayıcının işlem kaydını kontrol edin; otomatik tekrar yapılmadı.',
    });
