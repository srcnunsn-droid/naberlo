import { randomUUID } from 'node:crypto';
import type { Project, AutomationRun } from '../shared/types';
import { accepted } from '../shared/engine';
import {
  automationPlan,
  automationView,
  projectSignature,
  type AutomationOptions,
} from '../shared/automation';
import { cancelJob, enqueue, providerInfo } from './provider';
import { enqueueVideo, resumeVideo } from './video';
import { store } from './store';
import { startMovie, movieInputs, movieSignature } from './movie';
import { currentVideo, animaticSignature, videoConfiguration } from '../shared/video-state';
import { startAnimatic } from './animatic';
import { analyzeVideo } from './video-quality';

export function startAutomation(p: Project, options: AutomationOptions) {
  if (!providerInfo().configured) throw new Error('OpenAI API anahtarı bağlı değil.');
  const existing = store.runs().find((r) => r.projectId === p.id && r.status === 'running');
  if (existing) return existing;
  const plan = automationPlan(p, options);
  if (plan.issues.length) throw new Error(plan.issues.join(' '));
  const now = new Date().toISOString();
  const run: AutomationRun = {
    id: randomUUID(),
    projectId: p.id,
    phase: options.phase,
    status: 'running',
    steps: plan.steps,
    configuration: options.phase === 'previews' ? projectSignature(p) : videoConfiguration(p),
    createdAt: now,
    updatedAt: now,
  };
  store.run(run);
  return run;
}
export function cancelAutomation(id: string) {
  const run = store.runs().find((r) => r.id === id);
  if (!run) throw new Error('Üretim akışı bulunamadı.');
  if (run.status !== 'running') return run;
  for (const step of run.steps) if (step.jobId && step.status === 'running') cancelJob(step.jobId);
  run.status = 'cancelled';
  return store.run(run);
}
export function resumeAutomation(id: string) {
  const run = store.runs().find((r) => r.id === id);
  if (!run || run.status !== 'failed') throw new Error('Devam ettirilebilecek akış bulunamadı.');
  const p = store.project(run.projectId);
  if (
    !p ||
    (run.phase === 'previews' ? projectSignature(p) : videoConfiguration(p)) !== run.configuration
  )
    throw new Error('Proje ayarları değişti; bu akış sürdürülemez.');
  const step = run.steps.find((s) => s.status === 'failed');
  if (!step?.jobId || step.kind !== 'video')
    throw new Error('Yalnızca mevcut video işleminin takibi sürdürülebilir.');
  resumeVideo(step.jobId);
  step.status = 'running';
  run.status = 'running';
  run.error = undefined;
  return store.run(run);
}
function qualityReady(p: Project, code: string) {
  if (!p.story?.autoQuality) return true;
  const v = currentVideo(p, code);
  if (!v) throw new Error(`${code} güncel klibi bulunamadı.`);
  if (v.qc?.status === 'accepted') return true;
  if (!v.quality) {
    analyzeVideo(p, v.id);
    return false;
  }
  if (v.quality.status === 'running') return false;
  if (v.quality.status === 'failed')
    throw new Error(
      `${code} AI kontrolü tamamlanamadı. Klip kontrol panelinden inceleyin; otomatik ücretli tekrar yapılmadı.`,
    );
  if (v.quality.findings?.length)
    throw new Error(
      `${code} kontrolünde bulgular var. Klibi inceleyip kabul edin veya yeniden üretin, ardından üretim akışını tekrar başlatın. Geçerli klipler korunur.`,
    );
  return true;
}
export function tickAutomation() {
  for (const run of store.runs().filter((r) => r.status === 'running')) {
    try {
      const p = store.project(run.projectId);
      if (
        !p ||
        (run.phase === 'previews' ? projectSignature(p) : videoConfiguration(p)) !==
          run.configuration
      )
        throw new Error(
          'Proje ayarları değişti; otomasyon durduruldu. Yeni ayarlarla tekrar başlatın.',
        );
      const view = automationView(p);
      const step = run.steps.find((s) => !['done', 'reused'].includes(s.status));
      if (!step) {
        if (
          p.story?.autoAssemble &&
          run.phase === 'production' &&
          run.steps.some((s) => s.kind === 'video')
        ) {
          const signature = movieSignature(p, movieInputs(p));
          if (!(p.movie?.status === 'done' && p.movie.configuration === signature)) startMovie(p);
        }
        run.status = 'done';
        store.run(run);
        continue;
      }
      if (step.jobId) {
        const job = store.jobs().find((j) => j.id === step.jobId);
        if (!job || ['failed', 'cancelled'].includes(job.status)) {
          step.status = 'failed';
          throw new Error(job?.error || 'Üretim adımı tamamlanamadı.');
        }
        if (job.status === 'done') {
          if (step.kind === 'video' && !qualityReady(p, step.code)) continue;
          step.status = 'done';
          store.run(run);
        }
        continue;
      }
      if (step.kind === 'image' && accepted(view, step.code)) {
        step.status = 'reused';
        store.run(run);
        continue;
      }
      if (step.kind === 'video') {
        if (p.story?.previewFirst) {
          const signature = animaticSignature(p);
          if (!p.animatic || p.animatic.configuration !== signature) {
            if (p.animatic?.status !== 'running') startAnimatic(p);
            continue;
          }
          if (p.animatic.status === 'failed')
            throw new Error(p.animatic.error || 'Taslak hazırlanamadı.');
          if (p.animatic.status !== 'done' || !p.animatic.approvedAt) {
            run.error =
              'Hareketli taslak onayı bekleniyor. Referanstan final filme panelinde inceleyin.';
            store.run(run);
            continue;
          }
          run.error = undefined;
        }
        if (currentVideo(p, step.code)) {
          if (!qualityReady(p, step.code)) continue;
          step.status = 'reused';
          store.run(run);
          continue;
        }
      }
      const job =
        step.kind === 'image'
          ? enqueue(p, step.code, { allowDraftReferences: true, runId: run.id })
          : enqueueVideo(p, step.code, true, run.id);
      step.jobId = job.id;
      step.status = 'running';
      store.run(run);
    } catch (error) {
      for (const step of run.steps)
        if (step.jobId && step.status === 'running') cancelJob(step.jobId);
      run.status = 'failed';
      run.error = error instanceof Error ? error.message : 'Otomasyon tamamlanamadı.';
      store.run(run);
    }
  }
}
export function startAutomationWorker() {
  tickAutomation();
  return setInterval(tickAutomation, 1000).unref();
}
