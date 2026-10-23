import { useEffect, useRef, useState } from 'react';
import { Film, Upload, Download, Play, Check, Save } from 'lucide-react';
import type { Project } from '../../shared/types';
import { storyRecipes, storyRecipe } from '../../shared/story';
import { currentVideo, animaticSignature, previousContinuousCode } from '../../shared/video-state';
import { projectSignature } from '../../shared/automation';
import { api, post, authHeaders, download } from '../api';

function PrivateMedia({
  url,
  video = false,
  label,
  seek,
}: {
  url: string;
  video?: boolean;
  label: string;
  seek?: number;
}) {
  const videoElement = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (seek !== undefined) setOpened(true);
  }, [seek]);
  const [source, setSource] = useState(''),
    [opened, setOpened] = useState(!video),
    [error, setError] = useState('');
  useEffect(() => {
    if (!opened) return;
    setSource('');
    setError('');
    let alive = true,
      object = '';
    fetch(url, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw Error('Dosya açılamadı.');
        return r.blob();
      })
      .then((b) => {
        object = URL.createObjectURL(b);
        if (alive) setSource(object);
        else URL.revokeObjectURL(object);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [url, opened]);
  useEffect(() => {
    if (videoElement.current && seek !== undefined) videoElement.current.currentTime = seek;
  }, [seek, source]);
  return source ? (
    video ? (
      <video
        ref={videoElement}
        controls
        playsInline
        src={source}
        aria-label={label}
        onLoadedMetadata={() => {
          if (videoElement.current && seek !== undefined) videoElement.current.currentTime = seek;
        }}
      />
    ) : (
      <img src={source} alt={label} />
    )
  ) : (
    <button className="button" onClick={() => setOpened(true)}>
      <Play size={14} />
      {error || (opened ? 'Yükleniyor…' : label)}
    </button>
  );
}
const checks = [
  'Şehir ve kamera sabit',
  'Seçilen mimari korunuyor',
  'Temas ve fizik tutarlı',
  'Arma ve yazılar doğru',
  'Son kare sonraki sahneyle uyumlu',
];
export function StoryPanel({
  project: p,
  configured,
  onUpdate,
}: {
  project: Project;
  configured: boolean;
  onUpdate: (p: Project) => void;
}) {
  const [recipeId, setRecipeId] = useState(p.story?.recipeId || 'rebirth'),
    [title, setTitle] = useState(p.story?.title || ''),
    [closing, setClosing] = useState(p.story?.closing || ''),
    [audio, setAudio] = useState<'source' | 'mute'>(p.story?.audio || 'source'),
    [auto, setAuto] = useState(p.story?.autoAssemble ?? true),
    [continuity, setContinuity] = useState(p.story?.continuity ?? false),
    [autoQuality, setAutoQuality] = useState(p.story?.autoQuality ?? false),
    [previewFirst, setPreviewFirst] = useState(p.story?.previewFirst ?? false),
    [seekTimes, setSeekTimes] = useState<Record<string, number>>({}),
    [soundtrack, setSoundtrack] = useState(p.story?.soundtrackId || '');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [capable, setCapable] = useState<boolean | null>(null),
    [studies, setStudies] = useState<any[]>([]),
    [qc, setQc] = useState<Record<string, string[]>>({}),
    [trims, setTrims] = useState<Record<string, { in: number; out: number }>>({}),
    [billing, setBilling] = useState(false),
    [watchClips, setWatchClips] = useState(false);
  const callback = useRef(onUpdate);
  callback.current = onUpdate;
  useEffect(() => {
    void api<{ studies: any[] }>('/api/film/catalog')
      .then((r) => setStudies(r.studies))
      .catch((e) => setError(e.message));
    void api<{ available: boolean }>('/api/media/capabilities')
      .then((r) => setCapable(r.available))
      .catch(() => setCapable(false));
  }, []);
  const running =
    watchClips ||
    p.movie?.status === 'running' ||
    p.animatic?.status === 'running' ||
    p.videos?.some((v) => v.quality?.status === 'running') ||
    p.references?.some((r) => r.analysis?.status === 'running');
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const timer = setInterval(() => {
      void api<Project>(`/api/projects/${p.id}`)
        .then((next) => {
          if (alive) {
            callback.current(next);
            if (watchClips)
              void api<{ projectId: string; status: string }[]>('/api/jobs').then((jobs) => {
                if (
                  alive &&
                  !jobs.some(
                    (j) => j.projectId === p.id && ['queued', 'running'].includes(j.status),
                  )
                )
                  setWatchClips(false);
              });
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    }, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [p.id, running, watchClips]);
  async function action(fn: () => Promise<Project>) {
    setBusy(true);
    setError('');
    try {
      callback.current(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null, kind: 'references' | 'soundtracks') {
    if (!files?.length) return;
    await action(async () => {
      let next = p;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append(kind === 'references' ? 'video' : 'audio', file);
        next = await api<Project>(`/api/projects/${p.id}/${kind}`, { method: 'POST', body: form });
        callback.current(next);
      }
      return next;
    });
  }
  const recipe = storyRecipe(p),
    selected = storyRecipes.find((r) => r.id === recipeId)!;
  const clips = recipe?.shots.map(([code]) => currentVideo(p, code)) || [];
  let previewIssue = '',
    previewStale = false;
  try {
    previewStale = p.animatic?.configuration !== animaticSignature(p);
  } catch (e) {
    previewIssue = (e as Error).message;
    previewStale = true;
  }
  const movieStale =
    p.movie?.configuration !==
    JSON.stringify({
      project: projectSignature(p),
      story: p.story,
      sources: clips.map((v) => v?.id),
    });
  const dirty =
    recipeId !== p.story?.recipeId ||
    title !== (p.story?.title || '') ||
    closing !== (p.story?.closing || '') ||
    audio !== (p.story?.audio || 'source') ||
    auto !== (p.story?.autoAssemble ?? true) ||
    continuity !== (p.story?.continuity ?? false) ||
    autoQuality !== (p.story?.autoQuality ?? false) ||
    previewFirst !== (p.story?.previewFirst ?? false) ||
    soundtrack !== (p.story?.soundtrackId || '');
  return (
    <section className="panel story-panel">
      <div className="section-heading">
        <h2>
          <Film size={20} /> Referanstan final filme
        </h2>
        <span className="badge">9:16 · sahne planı · kurgu</span>
      </div>
      <p className="small muted">
        Gönderdiğin 10 videodan çıkarılan yapı: görünür temas, kontrollü dönüşüm, sabit şehir,
        okunabilir final. İzlenme sayısı başarı garantisi olarak kullanılmaz.
      </p>
      {capable === false && (
        <p role="alert" className="callout amber">
          Video araçları eksik. Codespaces terminalinde:{' '}
          <code>bash scripts/install-media-tools.sh</code>
        </p>
      )}
      <div className="story-settings">
        <label>
          Film akışı
          <select
            aria-label="Film akışı"
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
          >
            {storyRecipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.seconds} sn · {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Açılış yazısı
          <input
            value={title}
            maxLength={90}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="İsteğe bağlı, kurgu sırasında eklenir"
          />
        </label>
        <label>
          Final yazısı
          <input value={closing} maxLength={90} onChange={(e) => setClosing(e.target.value)} />
        </label>
        <label>
          Video sesi
          <select value={audio} onChange={(e) => setAudio(e.target.value as 'source' | 'mute')}>
            <option value="source">Kliplerin kendi sesi</option>
            <option value="mute">Klip seslerini kapat</option>
          </select>
        </label>
        <label>
          Ek ses / müzik
          <select value={soundtrack} onChange={(e) => setSoundtrack(e.target.value)}>
            <option value="">Ek ses yok</option>
            {p.soundtracks?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        {selected.note} Kaynak örnekler: {selected.references.join(', ')}.
      </p>
      <label className="automation-check">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Üretim bitince final MP4'ü otomatik birleştir
      </label>
      <label className="automation-check">
        <input
          type="checkbox"
          checked={continuity}
          onChange={(e) => setContinuity(e.target.checked)}
        />
        Aynı sahnenin devamında önceki klibin son karesini kullan
      </label>
      <label className="automation-check">
        <input
          type="checkbox"
          checked={previewFirst}
          onChange={(e) => setPreviewFirst(e.target.checked)}
        />
        Video üretiminden önce hareketli taslağı hazırla ve onayımı bekle
      </label>
      <label className="automation-check">
        <input
          type="checkbox"
          checked={autoQuality}
          onChange={(e) => setAutoQuality(e.target.checked)}
        />
        Her klipten sonra AI görsel kontrolü yap · ek API ücreti
      </label>
      <p className="small muted">
        Son kare aktarımı aynı kamera ve sahne için uygulanır; yeni çekimlerde kendi başlangıç
        görseli kullanılır. Devamlılık seçimini değiştirmek yeni video üretimi gerektirir; mevcut
        görseller korunur. AI kontrolünde bulgu çıkarsa sonraki üretim incelemeni bekler.
      </p>
      <button
        className="button primary"
        disabled={busy || !dirty || p.movie?.status === 'running'}
        onClick={() =>
          void action(() =>
            api<Project>(`/api/projects/${p.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                revision: p.revision,
                story: {
                  recipeId,
                  title,
                  closing,
                  audio,
                  autoAssemble: auto,
                  continuity,
                  autoQuality,
                  previewFirst,
                  ...(soundtrack ? { soundtrackId: soundtrack } : {}),
                },
              }),
            }),
          )
        }
      >
        <Save size={16} />
        Film akışını kaydet
      </button>
      <p className="small muted">
        Kaydettikten sonra aşağıdaki otomatik prodüksiyonda önizlemeleri üret, tasarım seç, ikinci
        aşamayı başlat. Yalnızca bu filme gereken sahneler üretilir. Referans videolar API'ye
        hareket dosyası olarak gönderilmez; desteklenen model başlangıç karesi ve yönlendirme
        kullanır.
      </p>
      {!!recipe && (
        <ol className="story-timeline">
          {recipe.shots.map(([code, seconds], i) => (
            <li key={code}>
              <strong>
                {i + 1}. {code}
              </strong>
              <span>{seconds} sn</span>
              <span>{clips[i] ? 'Klip hazır' : 'Üretim bekliyor'}</span>
            </li>
          ))}
        </ol>
      )}
      {!!recipe && (
        <div className="movie-result">
          <strong>Üretim öncesi hareketli taslak</strong>
          <p className="small">
            Mevcut başlangıç/final görsellerini sahne süreleriyle oynatır. Gerçek AI hareketini
            göstermez. Hazırlama ve indirme yeni API isteği oluşturmaz.
          </p>
          {previewIssue && <p className="small">{previewIssue}</p>}
          <button
            className="button"
            disabled={
              busy || dirty || !capable || !!previewIssue || p.animatic?.status === 'running'
            }
            onClick={() => void action(() => post<Project>(`/api/projects/${p.id}/animatic`))}
          >
            {p.animatic?.status === 'running' ? 'Taslak hazırlanıyor…' : 'Hareketli taslak oluştur'}
          </button>
          {p.animatic?.status === 'done' && p.animatic.url && (
            <>
              <p>
                {previewStale
                  ? 'Eski taslak: görsel veya ayarlar değişti.'
                  : `${p.animatic.seconds?.toFixed(1)} sn · güncel taslak`}
              </p>
              <PrivateMedia url={p.animatic.url} video label="Hareketli taslağı izle" />
              <button
                className="button"
                onClick={() =>
                  void download(p.animatic!.url!, 'naberlo-taslak.mp4').catch((e) =>
                    setError(e.message),
                  )
                }
              >
                Taslağı indir
              </button>
              <button
                className="button primary"
                disabled={busy || dirty || previewStale || !!p.animatic.approvedAt}
                onClick={() =>
                  void action(() =>
                    post<Project>(`/api/projects/${p.id}/animatic/${p.animatic!.id}/approve`),
                  )
                }
              >
                {p.animatic.approvedAt && !previewStale
                  ? 'Taslak onaylandı'
                  : 'Taslağı onayla · video aşamasına geç'}
              </button>
              <p className="small">
                Aktif üretim akışı taslak bekliyorsa onaydan sonra ücretli video aşamasına devam
                eder.
              </p>
            </>
          )}
          {p.animatic?.error && <p role="alert">{p.animatic.error}</p>}
        </div>
      )}
      <details>
        <summary>10 referansın analiz özeti ve sınırları</summary>
        <p className="small">
          Kare örnekleri incelendi. Ses içeriği dinlenmedi. Olay aralıkları kesin kesme ölçümü
          değildir. Dosyalar 478×850, 30 fps. Kaynakta görünen “4K” yazısı dosyanın 4K olduğunu
          göstermez.
        </p>
        {studies.map((s) => (
          <article className="research-fact" key={s.id}>
            <strong>
              {s.id} · {s.name} · {s.seconds.toFixed(1)} sn
            </strong>
            <p>{s.observation}</p>
            <span className="small muted">{s.intervals.join(' → ')}</span>
          </article>
        ))}
      </details>
      <details>
        <summary>Referans videolarım ({p.references?.length || 0})</summary>
        <p className="small">
          MP4/MOV, dosya başına en fazla 100 MB / 180 saniye. Yükleme ve kare çıkarma yereldir. AI
          kare analizi ayrıca API ücreti oluşturur ve sesi incelemez.
        </p>
        <label className="button">
          <Upload size={15} />
          Referans video ekle
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            multiple
            disabled={busy || !capable}
            onChange={(e) => {
              void upload(e.target.files, 'references');
              e.target.value = '';
            }}
          />
        </label>
        {p.references?.map((r) => (
          <article className="reference-video" key={r.id}>
            <strong>{r.name}</strong>
            <p className="small">
              {r.seconds.toFixed(2)} sn · {r.width}×{r.height} ·{' '}
              {r.hasAudio ? 'Ses kanalı var, dinlenmedi' : 'Ses kanalı yok'}
            </p>
            <PrivateMedia url={r.url} video label="Referans videoyu aç" />
            <div className="reference-frames">
              {r.frames.map((f) => (
                <figure key={f.url}>
                  <PrivateMedia url={f.url} label={`${f.time.toFixed(1)} saniye`} />
                  <figcaption>{f.time.toFixed(1)} sn</figcaption>
                </figure>
              ))}
            </div>
            <button
              className="button"
              disabled={busy || !configured || r.analysis?.status === 'running'}
              onClick={() =>
                void action(() => post<Project>(`/api/projects/${p.id}/references/${r.id}/analyze`))
              }
            >
              Kareleri AI ile analiz et · API
            </button>
            {r.analysis?.status === 'running' && <p>Örnek kareler analiz ediliyor…</p>}
            {r.analysis?.summary && (
              <>
                <p>{r.analysis.summary}</p>
                <button className="button" onClick={() => setRecipeId(r.analysis!.recipeId!)}>
                  Önerilen akışı seç
                </button>
                {r.analysis.beats?.map((b, i) => (
                  <p className="small" key={i}>
                    {b.from}–{b.to} sn: {b.observation} Kamera: {b.camera}. Kontrol: {b.risk}
                  </p>
                ))}
              </>
            )}
            {r.analysis?.error && <p role="alert">{r.analysis.error}</p>}
          </article>
        ))}
      </details>
      <details>
        <summary>Ses dosyası ekle</summary>
        <p className="small">
          Kullanma hakkın olan MP3/WAV/M4A dosyasını yükle. Ek sesi yukarıdan seçip film ayarlarını
          kaydet.
        </p>
        <input
          type="file"
          accept="audio/*"
          disabled={busy || !capable}
          onChange={(e) => {
            void upload(e.target.files, 'soundtracks');
            e.target.value = '';
          }}
        />
      </details>
      {!!recipe && (
        <details>
          <summary>Klipleri kontrol et ve kesme aralıklarını düzenle</summary>
          <label className="automation-check">
            <input
              type="checkbox"
              checked={billing}
              onChange={(e) => setBilling(e.target.checked)}
            />
            Tek sahneyi yeniden üretmenin veya AI görsel kontrolünün ayrıca API ücreti
            oluşturacağını biliyorum.
          </label>
          {recipe.shots.map(([code, seconds], i) => {
            const v = clips[i],
              range = v
                ? trims[v.id] ||
                  p.movie?.edits?.find((e) => e.videoId === v.id) || {
                    in: 0,
                    out: Math.min(seconds, v.seconds),
                  }
                : undefined;
            return (
              <article className="research-fact" key={code}>
                <strong>
                  {code} · {seconds} sn
                </strong>
                {v && (
                  <>
                    <PrivateMedia
                      url={v.url}
                      video
                      label={`${code} klibini izle`}
                      seek={seekTimes[v.id]}
                    />
                    <p className="small">
                      {v.continuity
                        ? 'Açılış: önceki klibin gerçek son karesi.'
                        : previousContinuousCode(p, code)
                          ? 'Son kare aktarımı bekleniyor.'
                          : 'Açılış: bu çekimin kendi görseli.'}
                    </p>
                    {v.endFrame && (
                      <details>
                        <summary>Aktarılacak son kare</summary>
                        <PrivateMedia url={v.endFrame.url} label={`${code} gerçek son kare`} />
                      </details>
                    )}
                    <button
                      className="button"
                      disabled={busy || !configured || !billing || v.quality?.status === 'running'}
                      onClick={() =>
                        void action(() =>
                          post<Project>(`/api/projects/${p.id}/videos/${v.id}/analyze`, {
                            confirmed: true,
                          }),
                        )
                      }
                    >
                      {v.quality?.status === 'running'
                        ? 'Klip kareleri inceleniyor…'
                        : 'AI ile klibi kontrol et · API'}
                    </button>
                    {v.quality?.summary && <p>{v.quality.summary}</p>}
                    {v.quality?.status === 'done' && !v.quality.findings?.length && (
                      <p className="small">
                        Örnek karelerde sorun bildirilmedi. Bu, insan kalite onayı değildir.
                      </p>
                    )}
                    {v.quality?.findings?.map((finding, index) => (
                      <article className="quality-finding" key={index}>
                        <button
                          className="button"
                          onClick={() => setSeekTimes({ ...seekTimes, [v.id]: finding.time })}
                        >
                          {finding.time.toFixed(2)} sn ·{' '}
                          {finding.severity === 'critical' ? 'Belirgin sorun' : 'İncelenmeli'}
                        </button>
                        <p>{finding.observation}</p>
                        <p className="small">Düzeltme önerisi: {finding.repair}</p>
                      </article>
                    ))}
                    {v.quality?.error && <p role="alert">{v.quality.error}</p>}
                    <p className="small muted">
                      AI kontrolü 12 örnek kare ve hedef görselleri karşılaştırır; sesi dinlemez ve
                      her hatayı yakalayamaz. Aşağıdaki insan kontrolünü otomatik doldurmaz.
                    </p>
                    <div className="story-settings">
                      <label>
                        Giriş (sn)
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={range!.in}
                          onChange={(e) =>
                            setTrims({
                              ...trims,
                              [v.id]: { ...range!, in: Number(e.target.value) },
                            })
                          }
                        />
                      </label>
                      <label>
                        Çıkış (sn)
                        <input
                          type="number"
                          min="0"
                          max={v.seconds}
                          step="0.1"
                          value={range!.out}
                          onChange={(e) =>
                            setTrims({
                              ...trims,
                              [v.id]: { ...range!, out: Number(e.target.value) },
                            })
                          }
                        />
                      </label>
                    </div>
                    {checks.map((check) => (
                      <label className="automation-check" key={check}>
                        <input
                          type="checkbox"
                          checked={(qc[v.id] || v.qc?.checks || []).includes(check)}
                          onChange={(e) => {
                            const list = qc[v.id] || v.qc?.checks || [];
                            setQc({
                              ...qc,
                              [v.id]: e.target.checked
                                ? [...list, check]
                                : list.filter((c) => c !== check),
                            });
                          }}
                        />
                        {check}
                      </label>
                    ))}
                    <div className="row">
                      <button
                        className="button"
                        disabled={busy || (qc[v.id] || v.qc?.checks || []).length !== checks.length}
                        onClick={() =>
                          void action(() =>
                            post<Project>(`/api/projects/${p.id}/videos/${v.id}/review`, {
                              status: 'accepted',
                              checks: qc[v.id] || v.qc?.checks || [],
                            }),
                          )
                        }
                      >
                        <Check size={14} />
                        Kontrolü kaydet
                      </button>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          void action(() =>
                            post<Project>(`/api/projects/${p.id}/videos/${v.id}/review`, {
                              status: 'rejected',
                              checks: [],
                            }),
                          )
                        }
                      >
                        Klibi reddet
                      </button>
                    </div>
                    <p className="small">
                      {v.qc?.status === 'accepted'
                        ? 'İnsan kontrolü tamamlandı'
                        : 'Kontrol bekliyor'}
                    </p>
                  </>
                )}
                <button
                  className="button"
                  disabled={busy || !configured || !billing}
                  onClick={() =>
                    void action(async () => {
                      await post(`/api/projects/${p.id}/videos/generate`, {
                        code,
                        confirmed: true,
                        useDraftReferences: true,
                      });
                      setWatchClips(true);
                      return api<Project>(`/api/projects/${p.id}`);
                    })
                  }
                >
                  Yalnızca {code} yeniden üret
                </button>
              </article>
            );
          })}
        </details>
      )}
      {!!recipe && (
        <button
          className="button primary"
          disabled={
            busy || !capable || dirty || p.movie?.status === 'running' || clips.some((v) => !v)
          }
          onClick={() =>
            void action(() =>
              post<Project>(`/api/projects/${p.id}/movie`, {
                clips: clips.map((v, i) => ({
                  videoId: v!.id,
                  ...(trims[v!.id] ||
                    p.movie?.edits?.find((e) => e.videoId === v!.id) || {
                      in: 0,
                      out: Math.min(v!.seconds, recipe.shots[i][1]),
                    }),
                })),
              }),
            )
          }
        >
          <Film size={16} />
          {p.movie?.status === 'running' ? 'Final video hazırlanıyor…' : 'Final MP4 oluştur'}
        </button>
      )}
      {p.movie?.status === 'done' && p.movie.url && (
        <div className="movie-result">
          <strong>
            {movieStale ? 'Önceki kurgu (ayar/klip değişti)' : 'Final video'} ·{' '}
            {p.movie.seconds?.toFixed(1)} sn · 1080×1920
          </strong>
          <p className="small">
            {p.movie.reviewed &&
            !movieStale &&
            p.movie.sourceIds.every(
              (id) => p.videos?.find((v) => v.id === id)?.qc?.status === 'accepted',
            )
              ? 'Kullanılan klipler insan kontrolünden geçti.'
              : 'Taslak kurgu: kliplerin görsel kontrolü bekliyor.'}{' '}
            Ayar veya klip değiştirirsen yeniden birleştir.
          </p>
          <PrivateMedia url={p.movie.url} video label="Final videoyu izle" />
          <button
            className="button"
            onClick={() =>
              void download(p.movie!.url!, 'naberlo-final.mp4').catch((e) => setError(e.message))
            }
          >
            <Download size={16} />
            Final MP4 indir
          </button>
        </div>
      )}
      {p.movie?.error && (
        <p role="alert" className="error-text">
          {p.movie.error}
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
