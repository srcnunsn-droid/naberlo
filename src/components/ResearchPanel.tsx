import { useEffect, useRef, useState } from 'react';
import { Globe2, RefreshCw } from 'lucide-react';
import type { Project } from '../../shared/types';
import { api, post } from '../api';
import { researchMessage } from '../../shared/research-message';

export function ResearchPanel({
  project,
  configured,
  onUpdate,
}: {
  project: Project;
  configured: boolean;
  onUpdate: (p: Project) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const callback = useRef(onUpdate);
  callback.current = onUpdate;
  const running = project.research?.status === 'running';
  useEffect(() => {
    if (!running) return;
    let active = true;
    const timer = setInterval(() => {
      void api<Project>(`/api/projects/${project.id}`)
        .then((p) => {
          if (active) callback.current(p);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [project.id, running]);
  const facts = Object.entries(project.facts).filter(([, f]) => f.verification === 'web-research');
  const site = project.assets.findLast((a) => a.code === 'SITE' && a.origin === 'research');
  return (
    <section className="panel research-panel">
      <div className="section-heading">
        <h2>
          <Globe2 size={20} /> Güncel bilgileri otomatik tamamla
        </h2>
        <span className="badge">{new Date().getFullYear()} · canlı kaynaklar</span>
      </div>
      <p className="small muted">
        Kulüp, güncel stadyum, şehir, konum ve çevre sabitleri internetten araştırılır. Gerçek SITE
        fotoğrafı ve bulunabilirse arma indirilip otomatik kontrol edilir. Araştırma ve görsel
        kontrolü OpenAI API ücreti oluşturabilir.
      </p>
      <button
        className="button primary"
        disabled={busy || running || !configured}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            callback.current(await post<Project>(`/api/projects/${project.id}/research`));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <RefreshCw size={16} />
        {running ? 'Kaynaklar araştırılıyor…' : 'İnternetten otomatik tamamla'}
      </button>
      {!configured && (
        <p className="small">Önce Stüdyo ayarlarından OpenAI API bağlantısını kur.</p>
      )}
      {project.research && (
        <div role="status">
          <p>{researchMessage(project.research.message)}</p>
          <span className="small muted">
            Araştırma: {new Date(project.research.startedAt).toLocaleString('tr-TR')} ·{' '}
            {project.research.status === 'running'
              ? 'Devam ediyor'
              : project.research.status === 'failed'
                ? 'Tamamlanamadı'
                : 'Tamamlandı'}
          </span>
        </div>
      )}
      {!!project.research?.warnings.length && (
        <details>
          <summary>Eksik veya çelişkili kaynaklar ({project.research.warnings.length})</summary>
          {project.research.warnings.map((w, i) => (
            <p className="small" key={i}>
              {w}
            </p>
          ))}
        </details>
      )}
      {!!facts.length && (
        <details>
          <summary>Bulunan bilgiler ve kaynaklar</summary>
          {facts.map(([key, fact]) => (
            <article className="research-fact" key={key}>
              <strong>
                {
                  (
                    {
                      club: 'Kulüp',
                      stadium: 'Stadyum',
                      city: 'Şehir',
                      geography: 'Konum ve çevre',
                      colors: 'Renkler',
                      symbol: 'Simge',
                      capacity: 'Mevcut kapasite',
                      crest: 'Arma',
                    } as Record<string, string>
                  )[key]
                }
              </strong>
              <p>{fact.value}</p>
              <span className="small">
                {fact.status === 'verified'
                  ? 'Otomatik kaynak kontrolü tamamlandı'
                  : 'Kaynak desteği yetersiz'}
              </span>
              <p className="small muted">{fact.evidence}</p>
              {fact.sources.map((s) => (
                <a key={s} href={s} target="_blank" rel="noreferrer">
                  {new URL(s).hostname} ↗
                </a>
              ))}
            </article>
          ))}
        </details>
      )}
      {site?.provenance && (
        <p className="small">
          SITE:{' '}
          {site.status === 'accepted'
            ? 'Otomatik kontrolden geçti; insan onayı değildir.'
            : 'Fotoğraf bulundu; uygunluğu belirsiz, inceleme bekliyor.'}{' '}
          <a href={site.provenance.page} target="_blank" rel="noreferrer">
            Fotoğraf kaynağı ↗
          </a>{' '}
          · {site.provenance.license} · Çekim tarihi:{' '}
          {site.provenance.capturedAt || 'Kaynakta belirtilmemiş'}
        </p>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}
