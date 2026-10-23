import { useEffect, useRef, useState } from 'react';
import { Play, Square, Film, Download, RefreshCw } from 'lucide-react';
import type { AutomationRun, Job, Project, VideoAsset } from '../../shared/types';
import { automationPlan, projectSignature, type AutomationOptions } from '../../shared/automation';
import { api, authHeaders, download, post } from '../api';

function VideoPreview({ video, project }: { video: VideoAsset; project: Project }) {
  const [source, setSource] = useState(''),
    [error, setError] = useState(''),
    [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
    let active = true,
      url = '';
    fetch(video.url, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error('Video açılamadı.');
        return r.blob();
      })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (active) setSource(url);
        else URL.revokeObjectURL(url);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [video.url, opened]);
  const stale =
    video.configuration !== projectSignature(project) ||
    video.references.some((id) => project.assets.find((a) => a.id === id)?.status === 'rejected');
  return (
    <article className="video-output">
      {source ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={source}
          aria-label={`${video.code} üretilen video`}
        />
      ) : opened ? (
        <p>{error || 'Video yükleniyor…'}</p>
      ) : (
        <button className="button" onClick={() => setOpened(true)}>
          <Play size={18} />
          Videoyu aç
        </button>
      )}
      <strong>
        {video.code} · {video.seconds} saniye
      </strong>
      <span className="small muted">
        {stale ? 'Eski proje / referans sürümü' : 'Gerçek MP4 · kalite kontrolü bekliyor'}
      </span>
      <button
        className="button"
        onClick={() =>
          void download(video.url, `${video.code}.mp4`).catch((error) => setError(error.message))
        }
      >
        <Download size={14} />
        Videoyu indir
      </button>
    </article>
  );
}

export function AutomationPanel({
  project,
  configured,
  onUpdate,
  jobs,
}: {
  project: Project;
  configured: boolean;
  jobs: Job[];
  onUpdate: (p: Project, jobs: Job[]) => void;
}) {
  const [options, setOptions] = useState<AutomationOptions>({
    phase: 'previews',
    includeVideos: true,
    includePlayer: false,
  });
  const [runs, setRuns] = useState<AutomationRun[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const callback = useRef(onUpdate);
  callback.current = onUpdate;
  const lastRunning = useRef(false);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const data = await api<AutomationRun[]>(`/api/projects/${project.id}/automation`);
        if (!alive) return;
        setRuns(data);
        const active = data.some((r) => r.status === 'running');
        if (active || lastRunning.current) {
          const [p, jobs] = await Promise.all([
            api<Project>(`/api/projects/${project.id}`),
            api<Job[]>('/api/jobs'),
          ]);
          if (alive) callback.current(p, jobs);
        }
        lastRunning.current = active;
      } catch (error) {
        if (alive) setError((error as Error).message);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [project.id]);
  const plan = automationPlan(project, options),
    active = runs.find((r) => r.status === 'running'),
    latest = active || runs[0];
  const completed = latest?.steps.filter((s) => ['done', 'reused'].includes(s.status)).length || 0;
  async function start() {
    setBusy(true);
    setError('');
    try {
      const run = await post<AutomationRun>(`/api/projects/${project.id}/automation/start`, {
        ...options,
        confirmed: true,
        useDraftReferences: true,
      });
      setRuns((r) => [run, ...r.filter((x) => x.id !== run.id)]);
      lastRunning.current = true;
      setConfirmed(false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="automation-panel panel">
      <div className="section-heading">
        <h2>
          <Film size={20} />
          Otomatik prodüksiyon
        </h2>
        <span className="badge">OpenAI Images + Sora</span>
      </div>
      <p className="muted small">
        Önizlemeleri üret, gerçek tasarım kartlarından birini seç, ardından görsel ve video akışını
        başlat.
      </p>
      <div className="automation-options">
        <label>
          Aşama
          <select
            value={options.phase}
            disabled={!!active}
            onChange={(e) => {
              setOptions((o) => ({ ...o, phase: e.target.value as AutomationOptions['phase'] }));
              setConfirmed(false);
            }}
          >
            <option value="previews">1 · Gerçek tasarım önizlemeleri</option>
            <option value="production">2 · Seçilen tasarımın görselleri ve videoları</option>
          </select>
        </label>
        {options.phase === 'production' && (
          <>
            <label className="automation-check">
              <input
                type="checkbox"
                checked={options.includeVideos}
                disabled={!!active}
                onChange={(e) => {
                  setOptions((o) => ({ ...o, includeVideos: e.target.checked }));
                  setConfirmed(false);
                }}
              />
              Videoları da üret
            </label>
            {!project.story && (
              <label className="automation-check">
                <input
                  type="checkbox"
                  checked={options.includePlayer}
                  disabled={!!active}
                  onChange={(e) => {
                    setOptions((o) => ({ ...o, includePlayer: e.target.checked }));
                    setConfirmed(false);
                  }}
                />
                Oyuncu tifosunu dahil et
              </label>
            )}
          </>
        )}
      </div>
      {!configured && (
        <div className="callout amber">
          OpenAI anahtarı bağlı değil. Stüdyo ayarlarından API anahtarını bağla; anahtarın kendisini
          sohbetten paylaşma.
        </div>
      )}
      {plan.issues.length > 0 && !active && (
        <details className="automation-issues">
          <summary>Başlamak için tamamlanacak {plan.issues.length} koşul</summary>
          {plan.issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </details>
      )}
      <p className="small">
        En fazla <strong>{plan.imageRequests} görsel</strong> ve{' '}
        <strong>
          {project.story
            ? `${plan.videoRequests} klip · toplam ${plan.videoSeconds} saniye`
            : `${plan.videoRequests} adet 12 saniyelik video`}
        </strong>{' '}
        isteği. Mevcut geçerli çıktılar tekrar üretilmez. API ücretleri OpenAI hesabına yansır.
      </p>
      <p className="small muted">
        Ara görseller otomatik kullanılır; tamamlanan çıktılar kalite kontrolü bekler. Sora
        başlangıç karesini alır, final kareyi ayrı görsel olarak alamaz. Mimari doğruluk garanti
        edilmez.
      </p>
      {!active && (
        <label className="automation-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          İstek sayısını ve olası API ücretini gördüm; kontrol bekleyen ara görsellerle otomatik
          devam et.
        </label>
      )}
      <div className="row">
        <button
          className="button primary"
          disabled={busy || !!active || !configured || !confirmed || !!plan.issues.length}
          onClick={() => void start()}
        >
          <Play size={15} />
          Otomasyonu başlat
        </button>
        {active && (
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const run = await post<AutomationRun>(`/api/automation/${active.id}/cancel`);
                setRuns((r) => r.map((x) => (x.id === run.id ? run : x)));
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Square size={14} />
            Durdur
          </button>
        )}
      </div>
      {latest && (
        <div className="automation-progress">
          <strong>
            {latest.status === 'running'
              ? 'Üretim devam ediyor'
              : latest.status === 'done'
                ? 'Akış tamamlandı · sonuçları incele'
                : latest.status === 'cancelled'
                  ? 'Akış durduruldu'
                  : 'Akış durdu'}{' '}
            · {completed}/{latest.steps.length}
          </strong>
          <div className="progress-track">
            <i style={{ width: `${(100 * completed) / latest.steps.length}%` }} />
          </div>
          <div className="automation-steps">
            {latest.steps.map((step) => (
              <span
                className={`badge ${['done', 'reused'].includes(step.status) ? 'green' : step.status === 'failed' ? 'amber' : ''}`}
                key={`${step.kind}-${step.code}`}
              >
                {step.code} ·{' '}
                {step.status === 'reused'
                  ? 'mevcut'
                  : step.status === 'done'
                    ? 'hazır'
                    : step.status === 'running'
                      ? 'üretiliyor'
                      : step.status === 'failed'
                        ? 'hata'
                        : 'sırada'}
              </span>
            ))}
          </div>
          {latest.error && (
            <p role="alert" className="error-text">
              {latest.error}
            </p>
          )}
          {latest.status === 'failed' &&
            latest.steps.some((step) =>
              jobs.some(
                (job) =>
                  job.id === step.jobId &&
                  job.kind === 'video' &&
                  job.remoteId &&
                  job.status === 'failed',
              ),
            ) && (
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const run = await post<AutomationRun>(`/api/automation/${latest.id}/resume`);
                    setRuns((r) => r.map((x) => (x.id === run.id ? run : x)));
                    lastRunning.current = true;
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RefreshCw size={14} />
                Mevcut videonun takibini sürdür
              </button>
            )}
        </div>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!!project.videos?.length && (
        <div className="video-output-grid">
          {project.videos.map((video) => (
            <VideoPreview key={video.id} video={video} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}

export function OpenAIConnection({ onRefresh }: { onRefresh: () => void }) {
  const [key, setKey] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function check() {
    const result = await api<{
      message: string;
      imageModelListed: boolean;
      videoModelListed: boolean;
    }>('/api/provider/check');
    setMessage(
      `${result.message} Görsel modeli: ${result.imageModelListed ? 'listede' : 'listede görünmedi'}. Video modeli: ${result.videoModelListed ? 'listede' : 'listede görünmedi'}.`,
    );
    onRefresh();
  }
  return (
    <section className="panel api-connection">
      <h2>OpenAI API bağlantısı</h2>
      <p className="small muted">
        Anahtar sunucu belleğinde tutulur; tarayıcıya geri gönderilmez. Sunucu yeniden başlarsa
        yeniden bağlamak gerekir. Kalıcı kullanım için sunucunun ortam sırlarına
        STADIUM_OPENAI_API_KEY ekle.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            await post('/api/provider/key', { key });
            setKey('');
            await check();
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setKey('');
            setBusy(false);
          }
        }}
      >
        <label>
          OpenAI API anahtarı
          <input
            type="password"
            autoComplete="off"
            value={key}
            placeholder="sk-…"
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
        <button className="button primary" disabled={busy || !key.trim()}>
          Anahtarı bağla ve kontrol et
        </button>
      </form>
      <button
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await check();
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw size={14} />
        Mevcut bağlantıyı kontrol et
      </button>
      {message && (
        <p role="status" className="small">
          {message}
        </p>
      )}
    </section>
  );
}
