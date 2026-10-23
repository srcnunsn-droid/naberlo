import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  Search,
  Globe2,
  Layers3,
  Camera,
  Clapperboard,
  FolderOpen,
  Settings2,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCircle2,
  LockKeyhole,
  Upload,
  Download,
  Copy,
  X,
  Loader2,
  RefreshCw,
  Sparkles,
  Flag,
  Box,
  Sun,
  Moon,
  Eye,
  AlertCircle,
  ExternalLink,
  Trash2,
  Grid2X2,
  PanelLeftClose,
  Command,
  Image as ImageIcon,
  Play,
  SlidersHorizontal,
  BookOpen,
  ShieldCheck,
  FileJson,
  Clock3,
  Zap,
} from 'lucide-react';
import type {
  Club,
  Project,
  Candidate,
  Asset,
  Job,
  FactKey,
  Fact,
  CatalogStats,
} from '../shared/types';
import {
  cameras,
  families,
  stages,
  reviewChecks,
  variantCounts,
  removals,
  emergences,
  celebrationForms,
  rhythms,
} from '../shared/catalog';
import {
  accepted,
  blockers,
  decodeVariant,
  imagePrompt,
  sheetCode,
  videoPrompts,
  totalArchitectureCombinations,
  isVerified,
  selectionBlockers,
} from '../shared/engine';
import { api, post, download, ApiError, authHeaders } from './api';
import { Stadium } from './components/Stadium';
import { StandaloneBar } from './components/StandaloneBar';
import { AutomationPanel, OpenAIConnection } from './components/AutomationPanel';
import { automationView } from '../shared/automation';
const standalone = import.meta.env.VITE_STANDALONE === '1';

type Page = 'home' | 'clubs' | 'studio' | 'cameras' | 'variations' | 'assets' | 'settings';
type Status = {
  provider: {
    configured: boolean;
    model: string;
    provider: string;
    size: string;
    exportSize: string;
  };
  catalog: CatalogStats;
  variantCounts: typeof variantCounts;
};
type Summary = Omit<Project, 'candidates' | 'assets'> & {
  candidateCount: number;
  assetCount: number;
  acceptedCount: number;
  cover?: string;
};
const fmt = (n: number) => n.toLocaleString('tr-TR');
const countryNames: Record<string, string> = {
  Turkey: 'Türkiye',
  England: 'İngiltere',
  Germany: 'Almanya',
  Spain: 'İspanya',
  Italy: 'İtalya',
  France: 'Fransa',
  Brazil: 'Brezilya',
  Argentina: 'Arjantin',
  Portugal: 'Portekiz',
  Netherlands: 'Hollanda',
  Scotland: 'İskoçya',
};
const regions: Record<string, string> = {
  europe: 'Avrupa',
  asia: 'Asya',
  africa: 'Afrika',
  'south-america': 'Güney Amerika',
  'north-america': 'Kuzey Amerika',
  'central-america': 'Orta Amerika',
  caribbean: 'Karayipler',
  'middle-east': 'Orta Doğu',
  oceania: 'Okyanusya',
};
const factLabels: Record<FactKey, string> = {
  club: 'Resmi kulüp adı',
  stadium: 'Güncel stadyum adı',
  city: 'Şehir',
  colors: 'Resmi renkler / HEX',
  symbol: 'Maskot veya simge',
  capacity: 'Mevcut kapasite / tarih / düzen',
  geography: 'Konum, kamera yönü ve en az 5 şehir sabiti',
  crest: 'Arma sürümü ve yıldız düzeni',
  player: 'Oyuncu / dönem / forma numarası',
};
const pageTitles: Record<Page, string> = {
  home: 'Genel bakış',
  clubs: 'Kulüp atlası',
  studio: 'Tasarım stüdyosu',
  cameras: 'Kamera kütüphanesi',
  variations: 'Varyasyon motoru',
  assets: 'Varlık kütüphanesi',
  settings: 'Stüdyo ayarları',
};

function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'amber';
}) {
  return (
    <span className={`badge ${tone}`}>
      <span />
      {children}
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const el = ref.current;
    el?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const nodes = el.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, select, textarea, a[href], [tabindex="0"]',
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = old;
      prior?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span className="eyebrow">NABERLO / STUDIO</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Kapat" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function AssetImage({
  asset,
  ...props
}: {
  asset: { url: string; code?: string };
  className?: string;
}) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    let blob = '';
    if (!sessionStorage.getItem('studio-token')) {
      setSrc(asset.url);
      return;
    }
    fetch(asset.url, { headers: authHeaders() })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.blob();
      })
      .then((b) => {
        blob = URL.createObjectURL(b);
        if (active) setSrc(blob);
      })
      .catch(() => setSrc(''));
    return () => {
      active = false;
      if (blob) URL.revokeObjectURL(blob);
    };
  }, [asset.url]);
  return src ? (
    <img src={src} alt={`${asset.code || 'Proje'} görseli`} {...props} />
  ) : (
    <div className="image-placeholder">
      <ImageIcon />
    </div>
  );
}

function SheetPreview({ asset, cell }: { asset: Asset; cell: number }) {
  return (
    <div
      className="sheet-cell"
      style={
        {
          '--cell-column': (cell - 1) % 2,
          '--cell-row': Math.floor((cell - 1) / 2),
          aspectRatio: `${asset.width * 5} / ${asset.height * 2}`,
        } as CSSProperties
      }
    >
      <AssetImage asset={asset} className="sheet-cell-image" />
    </div>
  );
}
function previewAsset(p: Project, c: Candidate) {
  const usable = accepted(automationView(p), sheetCode(c.batch, c.sheet));
  if (usable) return p.assets.find((a) => a.id === usable.id);
  return p.assets.findLast(
    (a) => a.code === sheetCode(c.batch, c.sheet) && a.status !== 'rejected',
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('home'),
    [status, setStatus] = useState<Status | null>(null),
    [projects, setProjects] = useState<Summary[]>([]),
    [project, setProject] = useState<Project | null>(null),
    [jobs, setJobs] = useState<Job[]>([]),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [createOpen, setCreateOpen] = useState(false),
    [mobile, setMobile] = useState(false),
    [locked, setLocked] = useState(false);
  const [prompt, setPrompt] = useState<{ title: string; text: string } | null>(null),
    [review, setReview] = useState<Asset | null>(null),
    [candidate, setCandidate] = useState<Candidate | null>(null),
    [factsOpen, setFactsOpen] = useState(false),
    [generation, setGeneration] = useState<string | null>(null);
  const notify = (text: string) => {
    setToast(text);
  };
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const refresh = useCallback(async () => {
    const [s, p, j] = await Promise.all([
      api<Status>('/api/status'),
      api<Summary[]>('/api/projects'),
      api<Job[]>('/api/jobs'),
    ]);
    setStatus(s);
    setProjects(p);
    setJobs(j);
    setLocked(false);
  }, []);
  useEffect(() => {
    refresh().catch((e) => {
      if (e instanceof ApiError && e.status === 401) setLocked(true);
      else setError(e.message);
    });
  }, [refresh]);
  useEffect(() => {
    if (!jobs.some((j) => j.status === 'queued' || j.status === 'running')) return;
    const t = setInterval(() => {
      api<Job[]>('/api/jobs')
        .then((j) => {
          setJobs(j);
          if (project) api<Project>(`/api/projects/${project.id}`).then(setProject);
        })
        .catch(() => {});
    }, 2500);
    return () => clearInterval(t);
  }, [jobs, project?.id]);
  async function run<T>(fn: () => Promise<T>, done?: (v: T) => void) {
    setBusy(true);
    setError('');
    try {
      const v = await fn();
      done?.(v);
      return v;
    } catch (e) {
      const err = e as ApiError;
      setError(
        err.message + (err.blockers?.length ? ' ' + err.blockers.slice(0, 3).join(' ') : ''),
      );
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  async function openProject(id: string) {
    await run(
      () => api<Project>(`/api/projects/${id}`),
      (p) => {
        setProject(p);
        setPage('studio');
        setMobile(false);
      },
    );
  }
  async function save(patch: Partial<Project>) {
    if (!project) return;
    return run(
      () =>
        api<Project>(`/api/projects/${project.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ revision: project.revision, ...patch }),
        }),
      (p) => {
        setProject(p);
        notify('Proje kaydedildi');
        void refresh();
      },
    );
  }
  const navigate = (p: Page) => {
    if (['studio', 'cameras', 'variations', 'assets'].includes(p) && !project) {
      setCreateOpen(true);
      return;
    }
    setPage(p);
    setMobile(false);
  };
  const exportProject = () =>
    project &&
    run(
      () => download(`/api/projects/${project.id}/export`, `naberlo-${project.id.slice(0, 8)}.zip`),
      () => notify('Üretim paketi indirildi'),
    );
  async function upload(code: string, file: File) {
    if (!project) return;
    const data = new FormData();
    data.set('code', code);
    data.set('image', file);
    await run(
      () => api<Project>(`/api/projects/${project.id}/assets`, { method: 'POST', body: data }),
      (p) => {
        setProject(p);
        setReview(p.assets.at(-1)!);
        notify('Görsel yüklendi; kalite kontrolü bekliyor');
      },
    );
  }
  const goGenerate = (code: string) => {
    setGeneration(code);
  };
  const showPrompt = (code: string) => {
    if (project) setPrompt({ title: `${code} · Görsel promptu`, text: imagePrompt(project, code) });
  };
  const selected = project?.candidates.find((c) => c.id === project.selectedId);
  const genBatch = generation?.startsWith('BATCH-') ? Number(generation.slice(6)) : null;
  const genCodes =
    project && generation
      ? genBatch
        ? Array.from({ length: 10 }, (_, i) => sheetCode(genBatch, i + 1)).filter(
            (c) => !accepted(project, c),
          )
        : [generation]
      : [];
  const genIssues = project ? [...new Set(genCodes.flatMap((c) => blockers(project, c)))] : [];
  const closeCreate = useCallback(() => setCreateOpen(false), []),
    closeFacts = useCallback(() => setFactsOpen(false), []),
    closePrompt = useCallback(() => setPrompt(null), []),
    closeReview = useCallback(() => setReview(null), []),
    closeCandidate = useCallback(() => setCandidate(null), []),
    closeGeneration = useCallback(() => setGeneration(null), []);

  if (locked)
    return (
      <div className="login">
        <div className="brand-mark">
          <Layers3 />
        </div>
        <h1>Stüdyona giriş yap</h1>
        <p>Bu sunucu bir erişim anahtarıyla korunuyor.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get('token') as string;
            sessionStorage.setItem('studio-token', value);
            void run(refresh);
          }}
        >
          <input name="token" type="password" placeholder="Stüdyo erişim anahtarı" required />
          <button className="button primary">
            Bağlan <ArrowRight size={16} />
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <button className="brand" onClick={() => navigate('home')}>
          <span className="brand-mark">
            <Layers3 size={25} />
          </span>
          <span>
            NABERLO<small>STADIUM STUDIO</small>
          </span>
        </button>
        <div className="workspace-chip">
          <span className="workspace-avatar">N</span>
          <div>
            Prodüksiyon alanı<small>Kişisel stüdyo</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <span className="nav-label">ÇALIŞMA ALANI</span>
        <nav>
          {(
            [
              { id: 'home', icon: LayoutDashboard },
              { id: 'clubs', icon: Globe2 },
              { id: 'studio', icon: Layers3 },
              { id: 'cameras', icon: Camera },
              { id: 'variations', icon: Sparkles },
              { id: 'assets', icon: FolderOpen },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.id)}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
            >
              <n.icon size={19} />
              <span>{pageTitles[n.id]}</span>
              {n.id === 'variations' && <span className="tiny-pill">8K+</span>}
            </button>
          ))}
        </nav>
        <div className="nav-divider" />
        <div className="nav-label row">
          PROJELER{' '}
          <button
            className="icon-button"
            aria-label="Yeni proje"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="sidebar-projects">
          {projects.slice(0, 5).map((p) => (
            <button
              key={p.id}
              className={`project-link ${project?.id === p.id ? 'current' : ''}`}
              onClick={() => openProject(p.id)}
            >
              <span className="project-dot" />
              {p.club.aliases[0] || p.club.name}
            </button>
          ))}
          {!projects.length && <p className="muted small">İlk projen burada görünecek.</p>}
        </div>
        <div className="sidebar-bottom">
          <div className="engine-note">
            <span className="status-light" /> MASTER ENGINE <b>v43</b>
            <p>
              Kimlikten mimariye.
              <br />
              Tek bir üretim akışı.
            </p>
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Settings2 size={18} />
            Stüdyo ayarları
          </button>
          <div className="profile">
            <span className="avatar">S</span>
            <div>
              Yaratıcı stüdyo<small>Yerel çalışma alanı</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-toggle"
              aria-label="Menüyü aç"
              onClick={() => setMobile(!mobile)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span>Çalışma alanı</span>
            <ChevronRight size={13} />
            <strong>{pageTitles[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="version-label">STADIUM PRODUCTION ENGINE</span>
            <Badge tone={status?.provider.configured ? 'green' : 'neutral'}>
              {status?.provider.configured ? 'Görsel servisi bağlı' : 'Prompt stüdyosu aktif'}
            </Badge>
            <button
              className="icon-button"
              aria-label="Ayarlar"
              onClick={() => navigate('settings')}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>
        <main>
          {standalone && (
            <StandaloneBar
              onRestore={() => {
                setProject(null);
                setPage('home');
                void refresh();
              }}
            />
          )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={19} />
              <span>{error}</span>
              <button
                className="icon-button"
                onClick={() => setError('')}
                aria-label="Hata mesajını kapat"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!status && !error ? (
            <div className="loading">
              <Loader2 className="spin" />
              Stüdyo hazırlanıyor…
            </div>
          ) : (
            <>
              {page === 'home' && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        <span className="line" /> YENİ BİR FUTBOL MİMARİSİ
                      </div>
                      <h1>Bir kulüp. Sonsuz olasılık.</h1>
                      <p>Gerçek stadyumdan yeni bir ikona, tüm prodüksiyon tek yerde.</p>
                    </div>
                    <button className="button primary" onClick={() => setCreateOpen(true)}>
                      <Plus size={17} />
                      Yeni proje
                    </button>
                  </div>
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="hero-kicker">
                        <span /> STADIUM DESIGN LAB
                      </span>
                      <h2>
                        Hayal et.
                        <br />
                        <em>Tribünler yükselsin.</em>
                      </h2>
                      <p>
                        Kulübünün kimliğini keşfet. Mimarini tasarla.
                        <br />
                        Unutulmayacak bir maç gecesi yarat.
                      </p>
                      <button className="button primary" onClick={() => setCreateOpen(true)}>
                        İlk tasarımını oluştur <ArrowUpRight size={17} />
                      </button>
                      <div className="hero-bottom">
                        <span>01 / 03</span>
                        <div className="hero-progress">
                          <i />
                          <i />
                          <i />
                        </div>
                        <span>REFERANS → TASARIM → PRODÜKSİYON</span>
                      </div>
                    </div>
                    <div className="hero-art">
                      <Stadium large seed={4} />
                      <div className="art-tag">
                        <span className="crosshair">+</span> KAVRAMSAL MİMARİ ÇALIŞMASI{' '}
                        <span>AXO / 001</span>
                      </div>
                      <span className="diagram-label">
                        Şematik önizleme · üretilmiş görsel değildir
                      </span>
                    </div>
                  </section>
                  <div className="stats-grid">
                    {[
                      {
                        icon: Globe2,
                        title: 'Kulüp kataloğu',
                        value: fmt(status?.catalog.total || 0),
                        sub: `${status?.catalog.countries || 0} ülke · genişletilebilir açık veri`,
                      },
                      {
                        icon: Layers3,
                        title: 'Her tasarım serisinde',
                        value: '100',
                        sub: '10 tema × 10 özgün mimari plan',
                      },
                      {
                        icon: Sparkles,
                        title: 'Koreografi kombinasyonu',
                        value: fmt(Object.values(variantCounts).reduce((a, b) => a + b, 0)),
                        sub: 'Söküm, doğuş ve kutlama seçenekleri',
                      },
                      {
                        icon: Camera,
                        title: 'Kamera reçetesi',
                        value: '10',
                        sub: 'Sabit havadan FPV tek plana',
                      },
                    ].map((s) => (
                      <div className="stat-card" key={s.title}>
                        <div>
                          <span>{s.title}</span>
                          <s.icon size={18} />
                        </div>
                        <strong>{s.value}</strong>
                        <small>{s.sub}</small>
                      </div>
                    ))}
                  </div>
                  <section className="section">
                    <div className="section-heading">
                      <div>
                        <h2>
                          Projelerin <span className="count">{projects.length}</span>
                        </h2>
                        <p>Her stadyumun yeni bir hikâyesi var.</p>
                      </div>
                      <button className="text-button" onClick={() => setCreateOpen(true)}>
                        Proje oluştur <ArrowRight size={15} />
                      </button>
                    </div>
                    <div className="project-grid">
                      {projects.slice(0, 5).map((p) => (
                        <button
                          className="project-card"
                          key={p.id}
                          onClick={() => openProject(p.id)}
                        >
                          <div className="project-art">
                            {p.cover ? (
                              <AssetImage asset={{ url: p.cover }} />
                            ) : (
                              <Stadium seed={p.seed} />
                            )}
                            <Badge tone={p.acceptedCount ? 'green' : 'neutral'}>
                              {p.acceptedCount ? 'Üretimde' : 'Hazırlık'}
                            </Badge>
                          </div>
                          <div className="project-meta">
                            <h3>
                              {p.club.aliases[0] || p.club.name}
                              <ArrowUpRight size={17} />
                            </h3>
                            <p>
                              {countryNames[p.club.country] || p.club.country} ·{' '}
                              {p.club.city || 'Konum doğrulanacak'}
                            </p>
                            <footer>
                              <span>{p.candidateCount} tasarım planı</span>
                              <span>{p.assetCount} görsel</span>
                            </footer>
                          </div>
                        </button>
                      ))}
                      <button className="new-project-card" onClick={() => setCreateOpen(true)}>
                        <span>
                          <Plus size={25} />
                        </span>
                        <strong>Yeni bir vizyon başlat</strong>
                        <p>Kulübünü seç, hikâyeni tasarla.</p>
                      </button>
                    </div>
                  </section>
                  <section className="workflow-intro">
                    <div>
                      <span className="eyebrow">TEK AKIŞ. TAM KONTROL.</span>
                      <h2>Referanstan final karesine.</h2>
                    </div>
                    {[
                      {
                        n: '01',
                        title: 'Kimliği doğrula',
                        text: 'Kulüp, stadyum ve gerçek şehir.',
                      },
                      { n: '02', title: 'Mimarini seç', text: '100 tasarım, sınırsız yeni seri.' },
                      { n: '03', title: 'Sahneyi yönet', text: 'Kamera, dönüşüm ve kutlama.' },
                    ].map((s) => (
                      <div className="workflow-mini" key={s.n}>
                        <span>{s.n}</span>
                        <h3>{s.title}</h3>
                        <p>{s.text}</p>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {page === 'clubs' && (
                <ClubAtlas
                  onCreate={(c) =>
                    run(
                      () => post<Project>('/api/projects', { clubId: c.id }),
                      (p) => {
                        setProject(p);
                        setPage('studio');
                        void refresh();
                      },
                    )
                  }
                  total={status?.catalog.total || 0}
                  busy={busy}
                  onError={setError}
                  onRefresh={refresh}
                />
              )}
              {project && page === 'studio' && (
                <Studio
                  project={project}
                  selected={selected}
                  busy={busy}
                  configured={!!status?.provider.configured}
                  onAutomationUpdate={(p, jobs) => {
                    setProject(p);
                    setJobs(jobs);
                  }}
                  onFacts={() => setFactsOpen(true)}
                  onUpload={upload}
                  onReview={setReview}
                  onGenerate={goGenerate}
                  onPrompt={showPrompt}
                  onCandidate={setCandidate}
                  onBatch={() =>
                    run(() => post<Project>(`/api/projects/${project.id}/batches`), setProject)
                  }
                  onExport={exportProject}
                  onVideos={() =>
                    setPrompt({
                      title: 'Video üretim paketi',
                      text: videoPrompts(project)
                        .map((v) => `## ${v.id} — ${v.title}\n${v.prompt}`)
                        .join('\n\n---\n\n'),
                    })
                  }
                  onSave={save}
                  jobs={jobs.filter((j) => j.projectId === project.id)}
                  onCancel={(id) =>
                    run(
                      () => post(`/api/jobs/${id}/cancel`),
                      () => void refresh(),
                    )
                  }
                />
              )}
              {project && page === 'cameras' && (
                <CameraLibrary project={project} onSave={save} busy={busy} />
              )}
              {project && page === 'variations' && (
                <Variations project={project} onSave={save} onPrompt={setPrompt} busy={busy} />
              )}
              {project && page === 'assets' && (
                <Assets
                  project={project}
                  onReview={setReview}
                  onExport={exportProject}
                  onUpload={upload}
                  busy={busy}
                />
              )}
              {page === 'settings' && (
                <Settings
                  status={status}
                  onRefresh={() => run(refresh)}
                  onImport={() => setPage('clubs')}
                  busy={busy}
                />
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          <span>
            NABERLO <b>/</b> Hayal gücü, kulüp kimliğiyle buluşur.
          </span>
          <span>Konsept tasarımlar · Gerçek olay veya resmi proje değildir.</span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {createOpen && (
        <Modal title="Yeni bir hikâye başlat" onClose={closeCreate}>
          <ClubPicker
            onChoose={(c) =>
              run(
                () => post<Project>('/api/projects', { clubId: c.id }),
                (p) => {
                  setProject(p);
                  setPage('studio');
                  setCreateOpen(false);
                  void refresh();
                },
              )
            }
            busy={busy}
          />
        </Modal>
      )}
      {factsOpen && project && (
        <Modal title="Kulüp kimliği & kaynak doğrulama" onClose={closeFacts} wide>
          <FactEditor
            project={project}
            onSave={async (patch) => {
              const p = await save(patch);
              if (p) setFactsOpen(false);
            }}
            busy={busy}
          />
        </Modal>
      )}
      {prompt && (
        <Modal title={prompt.title} onClose={closePrompt} wide>
          <div className="modal-actions">
            <span className="muted small">
              Üretim dili: İngilizce · Prompt, üretilmiş medya değildir.
            </span>
            <button
              className="button"
              onClick={async () => {
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(prompt.text);
                  } else {
                    // Local Wi-Fi HTTP pages do not expose the modern clipboard API.
                    const field = document.querySelector<HTMLTextAreaElement>('.prompt-output');
                    if (!field) throw new Error('Prompt bulunamadı.');
                    field.focus();
                    field.select();
                    field.setSelectionRange(0, field.value.length);
                    if (!document.execCommand('copy')) throw new Error('Kopyalama desteklenmiyor.');
                  }
                  notify('Prompt kopyalandı');
                } catch {
                  setError('Kopyalama desteklenmiyor; metni seçerek kopyalayın.');
                }
              }}
            >
              <Copy size={16} />
              Kopyala
            </button>
          </div>
          <textarea
            className="prompt-output"
            value={prompt.text}
            readOnly
            aria-label="Üretim promptu"
          />
          <button
            className="button"
            onClick={() => {
              const blob = new Blob([prompt.text], { type: 'text/plain;charset=utf-8' });
              const u = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = u;
              a.download = 'naberlo-prompt.txt';
              a.click();
              setTimeout(() => URL.revokeObjectURL(u), 1000);
            }}
          >
            <Download size={16} />
            TXT indir
          </button>
        </Modal>
      )}
      {review && project && (
        <Modal title={`${review.code} · Görsel kalite kontrolü`} onClose={closeReview} wide>
          <Review
            asset={review}
            busy={busy}
            onSubmit={(state, checks) =>
              run(
                () =>
                  post<Project>(`/api/projects/${project.id}/assets/${review.id}/review`, {
                    status: state,
                    checks,
                  }),
                (p) => {
                  setProject(p);
                  setReview(null);
                  notify(state === 'accepted' ? 'Görsel kabul edildi' : 'Görsel reddedildi');
                  void refresh();
                },
              )
            }
          />
        </Modal>
      )}
      {candidate && project && (
        <Modal title={`${candidate.id} · ${candidate.name}`} onClose={closeCandidate} wide>
          <div className="candidate-detail">
            <div>
              {previewAsset(project, candidate) ? (
                <>
                  <SheetPreview asset={previewAsset(project, candidate)!} cell={candidate.cell} />
                  <span className="diagram-label static">
                    Gerçek kolaj önizlemesi · hücre {candidate.cell} ·{' '}
                    {previewAsset(project, candidate)!.status === 'accepted'
                      ? 'Kabul edilmiş'
                      : 'Kontrol bekliyor'}
                  </span>
                </>
              ) : (
                <>
                  <Stadium seed={candidate.seed} />
                  <span className="diagram-label static">
                    Parametrik şema · gerçek üretim değildir
                  </span>
                </>
              )}
            </div>
            <div>
              <Badge tone="green">{families[candidate.family].name}</Badge>
              <h2>{candidate.name}</h2>
              <p className="muted">
                {fmt(project.capacity)} kişilik öneri ·{' '}
                {candidate.mascot === 'figure' ? 'Anıtsal simge' : 'Mimari motif'}
              </p>
              <dl>
                {[
                  ['Plan', candidate.plan],
                  ['Çatı', candidate.roof],
                  ['Taşıyıcı', candidate.structure],
                  ['Cephe', candidate.facade],
                  ['Kütle', candidate.segmentation],
                  ['Giriş', candidate.entrance],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <div className="callout">
            <ShieldCheck size={18} />
            <span>
              {standalone
                ? 'Tasarım seçimi, serinin 10 kolajı kalite kontrolünden geçince açılır.'
                : 'Üretilmiş gerçek önizlemeden tasarımını seç. Bu seçimden sonra otomatik görsel ve video akışını başlatabilirsin; görsellerin kalite kontrolü ayrı tutulur.'}
            </span>
          </div>
          <div className="modal-actions">
            <button
              className="button"
              onClick={() => {
                showPrompt(sheetCode(candidate.batch, candidate.sheet));
                setCandidate(null);
              }}
            >
              <BookOpen size={16} />
              Kolaj promptu
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                (standalone
                  ? !!selectionBlockers(project, candidate).length
                  : !accepted(automationView(project), sheetCode(candidate.batch, candidate.sheet)))
              }
              onClick={() =>
                run(
                  () =>
                    post<Project>(
                      `/api/projects/${project.id}/${standalone ? 'select' : 'select-preview'}`,
                      {
                        candidateId: candidate.id,
                      },
                    ),
                  (p) => {
                    setProject(p);
                    setCandidate(null);
                    notify(`${candidate.id} mimarisi kilitlendi`);
                  },
                )
              }
            >
              <Check size={16} />
              Bu tasarımı seç
            </button>
          </div>
        </Modal>
      )}
      {generation && project && (
        <Modal
          title={`${genBatch ? `Seri ${genBatch} · ${genCodes.length} kolaj` : generation} · Görsel üretimi`}
          onClose={closeGeneration}
        >
          <div className="provider-card">
            <Sparkles size={24} />
            <div>
              <strong>{status?.provider.provider}</strong>
              <p>
                {status?.provider.model} · {status?.provider.size}
              </p>
            </div>
            <Badge tone={status?.provider.configured ? 'green' : 'amber'}>
              {status?.provider.configured ? 'Bağlı' : 'Bağlantı gerekli'}
            </Badge>
          </div>
          {!standalone && (
            <p>
              Bu işlem sağlayıcıya <strong>{genCodes.length} görsel düzenleme isteği</strong>{' '}
              gönderir ve hesabında ücret oluşturabilir. Sonuç otomatik kabul edilmez; görsel kalite
              kontrolüne gelir.
            </p>
          )}
          {!status?.provider.configured && (
            <div className="callout amber">
              <AlertCircle size={19} />
              <span>
                {standalone ? (
                  'Bu tek HTML sürümü otomatik AI görsel üretmez. Promptu kopyala, seçtiğin görsel aracında kullan ve sonucu buraya yükle.'
                ) : (
                  <>
                    Sunucuda <code>STADIUM_OPENAI_API_KEY</code> tanımla. Alternatif olarak promptu
                    dışarıda çalıştırıp görseli yükleyebilirsin.
                  </>
                )}
              </span>
            </div>
          )}
          {genIssues.length > 0 && (
            <div className="blocker-list">
              <strong>Önce tamamlanması gerekenler</strong>
              {genIssues.map((b, i) => (
                <p key={i}>
                  <LockKeyhole size={14} />
                  {b}
                </p>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button"
              onClick={() => {
                if (genCodes[0]) showPrompt(genCodes[0]);
                setGeneration(null);
              }}
            >
              Promptu aç
            </button>
            <button
              className="button primary"
              disabled={
                busy || !status?.provider.configured || genIssues.length > 0 || !genCodes.length
              }
              onClick={() =>
                run(
                  () =>
                    genBatch
                      ? post(`/api/projects/${project.id}/generate-batch`, { batch: genBatch })
                      : post(`/api/projects/${project.id}/generate`, { code: generation }),
                  () => {
                    setGeneration(null);
                    notify('Görsel üretim kuyruğuna eklendi');
                    void refresh();
                  },
                )
              }
            >
              <Sparkles size={16} />
              {genCodes.length === 1 ? '1 görsel üret' : `${genCodes.length} kolajı üret`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ClubPicker({ onChoose, busy }: { onChoose: (c: Club) => void; busy: boolean }) {
  const [query, setQuery] = useState(''),
    [clubs, setClubs] = useState<Club[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      api<{ items: Club[] }>(`/api/clubs?q=${encodeURIComponent(query || 'Turkey')}`, {
        signal: controller.signal,
      })
        .then((d) => {
          setClubs(d.items);
          setError('');
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);
  return (
    <>
      <p className="muted">
        Kulübünü seç. 100 tasarım planı ve tüm prodüksiyon aşamaları proje içinde hazırlanır.
      </p>
      <div className="search-box large-search">
        <Search size={19} />
        <input
          aria-label="Kulüp ara"
          placeholder="Kulüp, şehir veya ülke ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <div className="picker-list">
        {loading ? (
          <div className="loading">
            <Loader2 className="spin" />
            Kulüpler aranıyor…
          </div>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : clubs.length ? (
          clubs.slice(0, 30).map((c) => (
            <button disabled={busy} className="club-row" key={c.id} onClick={() => onChoose(c)}>
              <span className="club-monogram">{c.name.slice(0, 2).toLocaleUpperCase('tr')}</span>
              <div>
                <strong>{c.name}</strong>
                <small>
                  {countryNames[c.country] || c.country} · {c.city || 'Konum eksik'}
                </small>
              </div>
              <ArrowUpRight size={17} />
            </button>
          ))
        ) : (
          <div className="empty-inline">
            Bu aramada kayıt yok. Kulüp atlasından JSON ile ekleyebilirsin.
          </div>
        )}
      </div>
      <div className="subtle-note">
        <ShieldCheck size={15} />
        Katalog bilgileri kaynaklı taslaktır; üretimden önce doğrulanır.
      </div>
    </>
  );
}

function ClubAtlas({
  onCreate,
  total,
  busy,
  onError,
  onRefresh,
}: {
  onCreate: (c: Club) => void;
  total: number;
  busy: boolean;
  onError: (e: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState(''),
    [country, setCountry] = useState(''),
    [region, setRegion] = useState(''),
    [offset, setOffset] = useState(0),
    [data, setData] = useState<{ items: Club[]; total: number; countries: string[] }>({
      items: [],
      total: 0,
      countries: [],
    }),
    [loading, setLoading] = useState(true),
    [reload, setReload] = useState(0),
    [live, setLive] = useState<
      { id: string; label: string; description: string; source: string }[] | null
    >(null),
    [liveBusy, setLiveBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      api<typeof data>(
        `/api/clubs?${new URLSearchParams({ q: query, country, region, offset: String(offset) })}`,
        { signal: c.signal },
      )
        .then(setData)
        .catch((e) => {
          if (e.name !== 'AbortError') onError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [query, country, region, offset, reload]);
  async function importFile(file: File) {
    try {
      const items = JSON.parse(await file.text());
      const r = await post<{ imported: number }>('/api/clubs/import', items);
      setReload((x) => x + 1);
      await onRefresh();
      onError('');
      alert(`${r.imported} kulüp kaydı içe aktarıldı.`);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KÜRESEL KULÜP KATALOĞU</div>
          <h1>
            Kulüp atlası<span className="title-dot">.</span>
          </h1>
          <p>{fmt(total)} kaynaklı kayıt. Yeni kulüplerle genişleyen bir dünya.</p>
        </div>
        <label className="button">
          <Upload size={16} />
          JSON içe aktar
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div className="catalog-banner">
        <Globe2 size={35} />
        <div>
          <strong>Her kulübün bir hikâyesi var.</strong>
          <p>
            Yerel katalog çevrimdışı aranır. Tüm dünya kulüplerini kapsama garantisi yoktur; canlı
            arama ve kaynaklı içe aktarma ile genişletilir.
          </p>
        </div>
        <a
          href="https://github.com/openfootball/clubs"
          target="_blank"
          rel="noreferrer"
          className="text-button"
        >
          Veri kaynağı <ExternalLink size={14} />
        </a>
      </div>
      <div className="filter-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            aria-label="Atlas kulüp araması"
            value={query}
            placeholder="Kulüp veya şehir ara…"
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
        </div>
        <select
          aria-label="Kıta filtresi"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Tüm bölgeler</option>
          {Object.entries(regions).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Ülke filtresi"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Tüm ülkeler</option>
          {data.countries.map((c) => (
            <option key={c} value={c}>
              {countryNames[c] || c}
            </option>
          ))}
        </select>
        <button
          disabled={standalone || query.length < 2 || liveBusy}
          title={
            standalone
              ? 'Tek HTML sürümünde yerel katalog ve JSON içe aktarma kullanılır.'
              : undefined
          }
          className="button"
          onClick={async () => {
            setLiveBusy(true);
            try {
              const r = await api<{ items: typeof live }>(
                `/api/clubs/live?q=${encodeURIComponent(query)}`,
              );
              setLive(r.items);
            } catch (e) {
              onError((e as Error).message);
            } finally {
              setLiveBusy(false);
            }
          }}
        >
          {liveBusy ? <Loader2 className="spin" size={16} /> : <Globe2 size={16} />}Canlı araştır
        </button>
      </div>
      {live && (
        <div className="panel">
          <div className="section-heading">
            <h3>Wikidata araştırma sonuçları</h3>
            <button
              className="icon-button"
              onClick={() => setLive(null)}
              aria-label="Canlı sonuçları kapat"
            >
              <X size={17} />
            </button>
          </div>
          {live.length ? (
            live.map((c) => (
              <div key={c.source} className="club-row">
                <div>
                  <strong>{c.label}</strong>
                  <small>{c.description}</small>
                </div>
                <a
                  href={c.source}
                  target="_blank"
                  rel="noreferrer"
                  className="icon-button"
                  aria-label={`${c.label} kaynağı`}
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  className="button"
                  disabled={liveBusy}
                  onClick={async () => {
                    setLiveBusy(true);
                    try {
                      const club = await api<Club>(`/api/clubs/research/${c.id}`);
                      await post('/api/clubs/import', [club]);
                      setQuery(club.name);
                      setCountry('');
                      setRegion('');
                      setOffset(0);
                      setReload((x) => x + 1);
                      await onRefresh();
                      setLive(null);
                    } catch (e) {
                      onError((e as Error).message);
                    } finally {
                      setLiveBusy(false);
                    }
                  }}
                >
                  <Plus size={14} />
                  Kataloğa ekle
                </button>
              </div>
            ))
          ) : (
            <p>Sonuç yok. Kaynaklı JSON ile kulüp ekleyebilirsin.</p>
          )}
          <p className="muted small">
            Kataloğa ekleme kulüp, stadyum ve konum bilgisini kaynaktan alır. Bunlar tek kaynaklı
            taslaktır; üretimden önce ayrıca doğrulanır.
          </p>
        </div>
      )}
      <div className="section-heading">
        <span className="muted small">
          {fmt(data.total)} sonuç · {offset + 1}–{Math.min(offset + 60, data.total)}
        </span>
        <Badge>OpenFootball · CC0</Badge>
      </div>
      {loading ? (
        <div className="loading">
          <Loader2 className="spin" />
          Katalog yükleniyor…
        </div>
      ) : (
        <div className="club-grid">
          {data.items.map((c) => (
            <article className="club-card" key={c.id}>
              <div className="row">
                <span className="club-monogram">{c.name.slice(0, 2).toLocaleUpperCase('tr')}</span>
                <span className="country-label">{countryNames[c.country] || c.country}</span>
              </div>
              <h3>{c.name}</h3>
              <p>{c.city || 'Şehir bilgisi eklenecek'}</p>
              <div className="club-stadium">
                <Box size={14} />
                <span>{c.stadium || 'Stadyum doğrulanacak'}</span>
              </div>
              <footer>
                <a href={c.source} target="_blank" rel="noreferrer">
                  Kaynak <ExternalLink size={12} />
                </a>
                <button className="text-button" disabled={busy} onClick={() => onCreate(c)}>
                  Proje başlat <ArrowRight size={15} />
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {!loading && !data.items.length && (
        <div className="empty-state">
          <Search size={30} />
          <h3>Aradığın kulüp henüz katalogda yok.</h3>
          <p>Yazımı değiştir, canlı araştır veya kaynaklı JSON ekle.</p>
        </div>
      )}
      <div className="pagination">
        <button
          className="button"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 60))}
        >
          <ArrowLeft size={15} />
          Önceki
        </button>
        <span>
          {Math.floor(offset / 60) + 1} / {Math.max(1, Math.ceil(data.total / 60))}
        </span>
        <button
          className="button"
          disabled={offset + 60 >= data.total}
          onClick={() => setOffset(offset + 60)}
        >
          Sonraki
          <ArrowRight size={15} />
        </button>
      </div>
      <details className="panel">
        <summary>JSON içe aktarma biçimi</summary>
        <p className="muted">
          Kendi doğrulanabilir kaynağını ekle. Katalog kaydı üretim doğrulamasından ayrı tutulur.
        </p>
        <pre>
          {JSON.stringify(
            [
              {
                id: 'my-club',
                name: 'Kulüp adı',
                country: 'Turkey',
                city: 'Şehir',
                stadium: 'Stadyum',
                source: 'https://example.com/official-club',
              },
            ],
            null,
            2,
          )}
        </pre>
      </details>
    </>
  );
}

function Studio({
  project: p,
  selected,
  busy,
  onFacts,
  onUpload,
  onReview,
  onGenerate,
  onPrompt,
  onCandidate,
  onBatch,
  onExport,
  onVideos,
  onSave,
  jobs,
  onCancel,
  configured,
  onAutomationUpdate,
}: {
  project: Project;
  selected?: Candidate;
  busy: boolean;
  onFacts: () => void;
  onUpload: (code: string, file: File) => void;
  onReview: (a: Asset) => void;
  onGenerate: (code: string) => void;
  onPrompt: (code: string) => void;
  onCandidate: (c: Candidate) => void;
  onBatch: () => void;
  onExport: () => void;
  onVideos: () => void;
  onSave: (patch: Partial<Project>) => Promise<unknown>;
  jobs: Job[];
  onCancel: (id: string) => void;
  configured: boolean;
  onAutomationUpdate: (p: Project, jobs: Job[]) => void;
}) {
  const [active, setActive] = useState('C'),
    [sheet, setSheet] = useState(1),
    [batch, setBatch] = useState(p.batch),
    [capacity, setCapacity] = useState(p.capacity),
    [name, setName] = useState(p.name),
    [tab, setTab] = useState<'plan' | 'image'>('plan');
  useEffect(() => {
    setBatch(p.batch);
    setCapacity(p.capacity);
    setName(p.name);
  }, [p.id, p.batch, p.capacity, p.name]);
  const code = active === 'C' ? sheetCode(batch, sheet) : active;
  const asset = p.assets.findLast((a) => a.code === code),
    isAccepted = !!accepted(p, code);
  const current = p.candidates.filter((c) => c.batch === batch && c.sheet === sheet);
  const factsReady = Object.values(p.facts).filter(isVerified).length;
  const passed = p.assets.filter((a) => a.status === 'accepted').length;
  const workflow = [
    { id: 'R0', label: 'Orijinal', icon: Box },
    { id: 'E0', label: 'Boş arazi', icon: Grid2X2 },
    { id: 'C', label: 'Tasarım', icon: Layers3 },
    { id: 'D0', label: 'Seçilen yapı', icon: CheckCircle2 },
    { id: 'NB0', label: 'Gece', icon: Moon },
    { id: 'N0', label: 'Kutlama', icon: Sparkles },
  ];
  return (
    <>
      <div className="page-heading studio-heading">
        <div>
          <div className="eyebrow">
            PROJE / {countryNames[p.club.country] || p.club.country} / SERİ {batch}
          </div>
          <h1>
            {p.club.aliases[0] || p.club.name}
            <span className="title-dot">.</span>
          </h1>
          <p>
            {p.facts.stadium.value || 'Stadyum doğrulaması bekliyor'}{' '}
            <span className="separator">/</span>{' '}
            {selected ? `Seçili: ${selected.id}` : 'Yeni bir stadyum vizyonu'}
          </p>
        </div>
        <div className="heading-actions">
          <button className="button" onClick={onVideos}>
            <Clapperboard size={16} />
            Video promptları
          </button>
          <button className="button primary" onClick={onExport} disabled={busy}>
            <Download size={16} />
            Paketi indir
          </button>
        </div>
      </div>
      {!standalone && (
        <AutomationPanel
          key={p.id}
          project={p}
          configured={configured}
          onUpdate={onAutomationUpdate}
          jobs={jobs}
        />
      )}
      <div className="workflow-bar">
        {workflow.map((s, i) => (
          <button
            key={s.id}
            className={`${active === s.id ? 'active' : ''} ${s.id !== 'C' && accepted(p, s.id) ? 'complete' : ''}`}
            onClick={() => setActive(s.id)}
          >
            <span className="step-number">
              {s.id !== 'C' && accepted(p, s.id) ? (
                <Check size={14} />
              ) : (
                String(i + 1).padStart(2, '0')
              )}
            </span>
            <s.icon size={17} />
            {s.label}
            {i < workflow.length - 1 && <ChevronRight size={15} />}
          </button>
        ))}
      </div>
      <div className="studio-layout">
        <aside className="project-controls">
          <div className="control-section">
            <div className="row">
              <span className="eyebrow">KULÜP KİMLİĞİ</span>
              <ShieldCheck size={16} />
            </div>
            <div className="identity-club">
              <span className="club-monogram">
                {p.club.name.slice(0, 2).toLocaleUpperCase('tr')}
              </span>
              <div>
                <strong>{p.club.aliases[0] || p.club.name}</strong>
                <small>{p.facts.city.value || 'Şehir eklenecek'}</small>
              </div>
            </div>
            <div className="verification">
              <div>
                <span>Kaynak doğrulaması</span>
                <b>{factsReady} / 9</b>
              </div>
              <div className="progress-track">
                <i style={{ width: `${(factsReady / 9) * 100}%` }} />
              </div>
            </div>
            <button className="button full" onClick={onFacts}>
              <ShieldCheck size={15} />
              Kimliği doğrula
              <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="control-section">
            <span className="eyebrow">TASARIM PARAMETRELERİ</span>
            <label>
              Hedef kapasite <span>Konsept</span>
              <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
                {[100000, 110000, 120000, 150000, 180000, 200000, 250000].map((n) => (
                  <option key={n} value={n}>
                    {fmt(n)} seyirci
                  </option>
                ))}
              </select>
            </label>
            {capacity !== p.capacity && (
              <button
                className="button primary full"
                disabled={busy}
                onClick={() => onSave({ capacity })}
              >
                Kapasiteyi kaydet
              </button>
            )}
            <label>
              Çıktı formatı
              <div className="format-control">
                <span className="aspect-icon" />
                9:16 <small>Dikey sosyal</small>
                <LockKeyhole size={13} />
              </div>
            </label>
            <label>
              Üretim serisi
              <select
                value={batch}
                onChange={(e) => {
                  setBatch(Number(e.target.value));
                  setSheet(1);
                }}
              >
                {Array.from({ length: p.batch }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Seri {i + 1} · 100 tasarım
                  </option>
                ))}
              </select>
            </label>
            <div className="parameter-row">
              <span>Görsel dil</span>
              <strong>Fotoğrafik</strong>
            </div>
            <div className="parameter-row">
              <span>Mimari standart</span>
              <strong>Master v43</strong>
            </div>
            <div className="parameter-row">
              <span>Dönüşüm kamerası</span>
              <strong>A · Sabit</strong>
            </div>
          </div>
          <div className="control-section">
            <span className="eyebrow">REFERANS GÖRSELLERİ</span>
            {[
              { code: 'SITE', name: 'Gerçek stadyum / arsa' },
              { code: 'CREST', name: 'Resmi arma' },
              { code: 'PLAYER', name: 'Seçilen oyuncu' },
            ].map((r) => {
              const a = p.assets.findLast((a) => a.code === r.code);
              return (
                <div key={r.code} className="reference-item">
                  <div>
                    <ImageIcon size={15} />
                    <span>{r.name}</span>
                    {a && (
                      <button
                        className="icon-button"
                        aria-label={`${r.code} kontrol et`}
                        onClick={() => onReview(a)}
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </div>
                  <label className={`upload-mini ${a ? 'has-file' : ''}`}>
                    <Upload size={13} />
                    {a
                      ? `${a.status === 'accepted' ? 'Kabul edildi' : 'Kontrol bekliyor'} · değiştir`
                      : 'PNG / JPG / WebP yükle'}
                    <input
                      type="file"
                      hidden
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUpload(r.code, f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="control-section">
            <details>
              <summary>Proje bilgileri</summary>
              <label>
                Proje adı
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
              </label>
              <button
                className="button full"
                disabled={busy || !name.trim()}
                onClick={() => onSave({ name })}
              >
                Kaydet
              </button>
              <p className="small muted">
                {passed} kabul edilmiş görsel · {p.assets.length} sürüm
              </p>
            </details>
          </div>
        </aside>
        <section className="studio-canvas">
          <div className="canvas-toolbar">
            <div>
              <span className="eyebrow">
                {active === 'C'
                  ? `MİMARİ KOLEKSİYON / ${String(sheet).padStart(2, '0')}`
                  : 'ÜRETİM AŞAMASI'}
              </span>
              <h2>
                {active === 'C'
                  ? families[sheet - 1].name
                  : stages.find((s) => s.id === active)?.name || active}
              </h2>
            </div>
            <div className="segmented">
              <button className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>
                <Grid2X2 size={15} />
                Plan
              </button>
              <button className={tab === 'image' ? 'active' : ''} onClick={() => setTab('image')}>
                <ImageIcon size={15} />
                Görsel{asset && <span className="status-light" />}
              </button>
            </div>
          </div>
          {active === 'C' && (
            <div className="family-tabs">
              {families.map((f, i) => (
                <button
                  title={f.name}
                  key={f.id}
                  className={sheet === i + 1 ? 'active' : ''}
                  onClick={() => setSheet(i + 1)}
                >
                  C{i + 1}
                  <small>{f.name}</small>
                  {accepted(p, sheetCode(batch, i + 1)) && <CheckCircle2 size={12} />}
                </button>
              ))}
            </div>
          )}
          <div className="canvas-meta">
            <div>
              <span className="live-dot" />
              {active === 'C'
                ? `10 tasarım · ${fmt(p.capacity)}+ kapasite hedefi`
                : 'Referansa bağlı görsel üretimi'}
            </div>
            <span>
              {asset
                ? isAccepted
                  ? 'Görsel kabul edildi'
                  : 'Kalite kontrolü bekliyor'
                : 'Henüz görsel üretilmedi'}
            </span>
          </div>
          {tab === 'image' ? (
            <div className="render-view">
              {asset ? (
                <>
                  <AssetImage asset={asset} />
                  <button className="button" onClick={() => onReview(asset)}>
                    <Eye size={16} />
                    Görseli incele
                  </button>
                </>
              ) : (
                <div className="empty-state">
                  <ImageIcon size={36} />
                  <h3>{code} görseli henüz yok.</h3>
                  <p>Promptu dışarıda çalıştırıp yükle veya bağlı görsel servisiyle üret.</p>
                  <button className="button primary" onClick={() => onGenerate(code)}>
                    <Sparkles size={16} />
                    Üretim seçenekleri
                  </button>
                </div>
              )}
            </div>
          ) : active === 'C' ? (
            <>
              <div className="design-grid">
                {current.map((c) => (
                  <button
                    key={c.id}
                    className={`design-card ${p.selectedId === c.id ? 'selected' : ''}`}
                    onClick={() => onCandidate(c)}
                  >
                    <div className="design-art">
                      <span className="design-number">{String(c.cell).padStart(2, '0')}</span>
                      {previewAsset(p, c) ? (
                        <SheetPreview asset={previewAsset(p, c)!} cell={c.cell} />
                      ) : (
                        <Stadium seed={c.seed} />
                      )}
                      <span className="design-open">
                        <ArrowUpRight size={16} />
                      </span>
                      {c.mascot === 'figure' && (
                        <span className="design-symbol">
                          <Flag size={11} />
                          Anıtsal
                        </span>
                      )}
                    </div>
                    <div className="design-info">
                      <strong>{c.name}</strong>
                      <span>
                        {c.id}
                        <ArrowUpRight size={13} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="schematic-note">
                <Box size={14} />
                {asset && asset.status !== 'rejected'
                  ? 'Kartlar gerçek 2 sütun × 5 satırlı kolajdan kesilen önizlemelerdir. Hücre hizasını ve geometriyi tam kolajda da kontrol et.'
                  : 'Henüz gerçek render yok. Kartlar temsili şema; önizlemeler üretildiğinde gerçek tasarımlar burada görünür.'}
              </div>
            </>
          ) : (
            <div className="stage-preview">
              {asset ? (
                <AssetImage asset={asset} />
              ) : (
                <Stadium seed={selected?.seed || p.seed} large empty={active === 'E0'} />
              )}
              <div className="stage-overlay">
                <Badge tone={isAccepted ? 'green' : 'neutral'}>
                  {code} · {isAccepted ? 'Kabul edilmiş' : 'Hazırlık'}
                </Badge>
                <h2>{stages.find((s) => s.id === active)?.name}</h2>
                <p>{stages.find((s) => s.id === active)?.description}</p>
                {!asset && <span className="small">Temsili şema · stadyum fotoğrafı değildir</span>}
              </div>
            </div>
          )}
          <div className="canvas-actions">
            <button className="button" onClick={() => onPrompt(code)}>
              <BookOpen size={16} />
              Promptu aç
            </button>
            <label className="button">
              <Upload size={16} />
              Görsel yükle
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(code, f);
                  e.target.value = '';
                }}
              />
            </label>
            <button className="button primary" onClick={() => onGenerate(code)} disabled={busy}>
              <Sparkles size={16} />
              {active === 'C' ? 'Kolajı üret' : 'Görseli üret'}
              <ArrowUpRight size={15} />
            </button>
          </div>
          {active === 'C' && (
            <div className="new-series">
              <div>
                <RefreshCw size={20} />
                <div>
                  <strong>Başka bir mimari keşfet.</strong>
                  <p>Yeni bir seri, 10 yeni kolaj planı ve 100 yeni aday ekler.</p>
                </div>
              </div>
              <div className="batch-actions">
                <button
                  className="button"
                  onClick={() => onGenerate(`BATCH-${batch}`)}
                  disabled={busy}
                >
                  <Layers3 size={15} />
                  10 kolajı üret
                </button>
                <button className="button" onClick={onBatch} disabled={busy}>
                  <Plus size={15} />
                  Yeni seri
                </button>
              </div>
            </div>
          )}
          <div className="extended-stages">
            <div className="section-heading">
              <h3>Kutlama & final kareleri</h3>
              <span className="muted small">Açılış → final devamlılığı</span>
            </div>
            <div>
              {stages.slice(6).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={active === s.id ? 'active' : ''}
                >
                  <span>{s.id}</span>
                  {s.name}
                  {accepted(p, s.id) ? <CheckCircle2 size={13} /> : <ChevronRight size={13} />}
                </button>
              ))}
            </div>
          </div>
          {jobs.length > 0 && (
            <div className="panel jobs-panel">
              <h3>Üretim kuyruğu</h3>
              {jobs.slice(0, 8).map((j) => (
                <div className="job-row" key={j.id}>
                  {['running', 'queued'].includes(j.status) ? (
                    <Loader2 size={16} className="spin" />
                  ) : j.status === 'done' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <div>
                    <strong>{j.code}</strong>
                    <span>
                      {
                        {
                          queued: 'Sırada',
                          running: 'Üretiliyor',
                          done: 'Tamamlandı · kontrol bekliyor',
                          failed: 'Başarısız',
                          cancelled: 'İptal edildi',
                        }[j.status]
                      }
                    </span>
                    {j.error && <p className="small error-text">{j.error}</p>}
                  </div>
                  {['running', 'queued'].includes(j.status) && (
                    <button className="text-button" onClick={() => onCancel(j.id)}>
                      İptal
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function FactEditor({
  project: p,
  onSave,
  busy,
}: {
  project: Project;
  onSave: (patch: Partial<Project>) => void;
  busy: boolean;
}) {
  const [facts, setFacts] = useState(structuredClone(p.facts)),
    [date, setDate] = useState(p.referenceDate),
    [consent, setConsent] = useState(p.playerConsent),
    [notes, setNotes] = useState(p.notes);
  const change = (key: FactKey, patch: Partial<Fact>) =>
    setFacts((old) => ({ ...old, [key]: { ...old[key], ...patch } }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          facts: Object.fromEntries(
            Object.entries(facts).map(([k, f]) => [
              k,
              { ...f, sources: f.sources.map((s) => s.trim()).filter(Boolean) },
            ]),
          ) as Project['facts'],
          referenceDate: date,
          playerConsent: consent,
          notes,
        });
      }}
    >
      <div className="callout">
        <ShieldCheck size={20} />
        <span>
          Kritik bilgiler için resmi kaynak veya iki bağımsız kaynak gerekir. “Doğrulandı” seçimi
          senin kaynak kontrolünü kaydeder; uygulama kaynağın içeriğini otomatik doğrulamaz. Kimlik
          değişikliği mevcut çıktıları yeniden kontrole alır.
        </span>
      </div>
      <label className="date-field">
        Referans tarihi
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <div className="facts-grid">
        {(Object.keys(factLabels) as FactKey[]).map((key) => (
          <div className="fact-card" key={key}>
            <div className="row">
              <label htmlFor={`fact-${key}`}>{factLabels[key]}</label>
              <Badge tone={facts[key].status === 'verified' ? 'green' : 'amber'}>
                {facts[key].status === 'verified' ? 'Doğrulandı' : 'Kontrol gerekli'}
              </Badge>
            </div>
            <textarea
              id={`fact-${key}`}
              rows={key === 'geography' ? 3 : 2}
              value={facts[key].value}
              maxLength={3000}
              placeholder={
                key === 'geography'
                  ? 'Koordinatlar, saha yönü, kamera yönü; sabit yollar, yapılar ve sınırlar…'
                  : key === 'colors'
                    ? 'Ör. resmi kılavuzdaki renk adları ve HEX değerleri…'
                    : 'Kaynağın doğruladığı değer…'
              }
              onChange={(e) => change(key, { value: e.target.value, status: 'unverified' })}
            />
            <label>
              Kaynak URL’leri <small>Her satıra bir adres</small>
              <textarea
                rows={2}
                value={facts[key].sources.join('\n')}
                onChange={(e) =>
                  change(key, { sources: e.target.value.split('\n'), status: 'unverified' })
                }
                placeholder="https://kulup-resmi-sitesi…"
              />
            </label>
            <div className="fact-actions">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={facts[key].official}
                  onChange={(e) =>
                    change(key, { official: e.target.checked, status: 'unverified' })
                  }
                />
                Resmi kaynak kontrol edildi
              </label>
              <select
                aria-label={`${factLabels[key]} doğrulama durumu`}
                value={facts[key].status}
                onChange={(e) =>
                  change(key, {
                    status: e.target.value as Fact['status'],
                    sources: facts[key].sources.map((s) => s.trim()).filter(Boolean),
                    checkedAt: new Date().toISOString(),
                  })
                }
              >
                <option value="unverified">Doğrulanmadı</option>
                <option value="single-source">Tek kaynak</option>
                <option value="verified">Doğrulandı</option>
              </select>
            </div>
          </div>
        ))}
      </div>
      <label className="checkbox player-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Yukarıdaki oyuncuyu bu proje için açıkça seçiyorum. Dönem ve forma bilgilerini kontrol
        ettim.
      </label>
      <label>
        Prodüksiyon notları
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
          rows={3}
          placeholder="Arsa sınırı, yaratıcı genişletme kararı, korunacak yapılar…"
        />
      </label>
      <div className="modal-actions">
        <span className="muted small">
          Doğrulanmayan arma, oyuncu ve simge görsellere eklenmez.
        </span>
        <button className="button primary" disabled={busy}>
          <Check size={16} />
          Kimliği kaydet
        </button>
      </div>
    </form>
  );
}

function Review({
  asset,
  busy,
  onSubmit,
}: {
  asset: Asset;
  busy: boolean;
  onSubmit: (state: 'accepted' | 'rejected', checks: string[]) => void;
}) {
  const [checks, setChecks] = useState<string[]>(asset.checks);
  return (
    <>
      <div className="review-layout">
        <AssetImage asset={asset} />
        <div>
          <Badge tone={asset.status === 'accepted' ? 'green' : 'amber'}>
            {asset.status === 'accepted'
              ? 'Kabul edilmiş'
              : asset.status === 'rejected'
                ? 'Reddedilmiş'
                : 'İnceleme bekliyor'}
          </Badge>
          <h3>
            {asset.code} · {asset.width} × {asset.height}
          </h3>
          <p className="muted">
            {asset.origin === 'upload' ? 'Kullanıcı yüklemesi' : `${asset.model} üretimi`}. Görseli
            gerçekten inceleyip her maddeyi doğrula.
          </p>
          {reviewChecks.map((check) => (
            <label className="review-check" key={check}>
              <input
                type="checkbox"
                checked={checks.includes(check)}
                onChange={(e) =>
                  setChecks((old) =>
                    e.target.checked ? [...old, check] : old.filter((x) => x !== check),
                  )
                }
              />
              <span>{check}</span>
            </label>
          ))}
          <p className="small muted">
            Bir üst referans değişirse ona bağlı kabul edilmiş çıktılar yeniden kontrol gerektirir.
          </p>
        </div>
      </div>
      <div className="modal-actions">
        <button
          className="button danger"
          disabled={busy}
          onClick={() => onSubmit('rejected', checks)}
        >
          <X size={16} />
          Reddet
        </button>
        <button
          className="button primary"
          disabled={busy || checks.length !== 6}
          onClick={() => onSubmit('accepted', checks)}
        >
          <CheckCircle2 size={16} />
          Kontrol ettim, kabul et
        </button>
      </div>
    </>
  );
}

function CameraLibrary({
  project: p,
  onSave,
  busy,
}: {
  project: Project;
  onSave: (patch: Partial<Project>) => Promise<unknown>;
  busy: boolean;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KADRAJ & DEVAMLILIK</div>
          <h1>
            Hikâyenin açısını bul<span className="title-dot">.</span>
          </h1>
          <p>10 fiziksel kamera reçetesi. Aynı mimari, farklı bir bakış.</p>
        </div>
        <Badge tone="green">Ana dönüşüm: Kamera A</Badge>
      </div>
      <div className="callout">
        <Camera size={20} />
        <span>
          R0 → E0 → D0 → NB0 dönüşümünde Kamera A sabittir. Sokak, tribün, şehir ve final kareleri
          kendi eşleşmiş kameralarını kullanır. Aşağıdaki seçim sokak sahnelerinde geniş/tele
          tercihini kaydeder.
        </span>
      </div>
      <div className="camera-grid">
        {cameras.map((c, i) => (
          <article className={`camera-card ${p.camera === c.id ? 'selected' : ''}`} key={c.id}>
            <div className="camera-preview">
              <Stadium seed={i} />
              <div className="viewfinder">
                <span />
                <span />
                <span />
                <span />
              </div>
              <b>{c.id}</b>
              <span className="camera-angle">
                {
                  [
                    '24 mm / 25–30°',
                    '24–35 mm / eye level',
                    '20–28 mm / stand corner',
                    '16–24 mm / 1.2–3 m',
                    '70–135 mm / 600–1500 m',
                    '24–50 mm / 1–3 km',
                    '14–20 mm / low angle',
                    'FPV / continuous',
                    '35–70 mm / aerial',
                    '20–24 mm / pitch',
                  ][i]
                }
              </span>
            </div>
            <div className="camera-body">
              <h3>{c.name}</h3>
              <p>{c.text}</p>
              <footer>
                <span className="muted small">Kamera reçetesi · temsili şema</span>
                {['A', 'D-WIDE', 'D-TELE'].includes(c.id) ? (
                  <button
                    className="text-button"
                    disabled={busy || p.camera === c.id}
                    onClick={() => onSave({ camera: c.id })}
                  >
                    {p.camera === c.id ? 'Seçili' : 'Tercihi kaydet'}
                    {p.camera === c.id ? <Check size={15} /> : <ArrowRight size={15} />}
                  </button>
                ) : (
                  <Badge>Sahneye bağlı</Badge>
                )}
              </footer>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function Variations({
  project: p,
  onSave,
  onPrompt,
  busy,
}: {
  project: Project;
  onSave: (patch: Partial<Project>) => Promise<unknown>;
  onPrompt: (p: { title: string; text: string }) => void;
  busy: boolean;
}) {
  const [type, setType] = useState<keyof typeof variantCounts>('removal'),
    [value, setValue] = useState(p.variant.removal),
    [filter, setFilter] = useState(''),
    [offset, setOffset] = useState(0);
  const methods =
    type === 'removal' ? removals : type === 'emergence' ? emergences : celebrationForms;
  const selected = decodeVariant(type, value);
  function switchType(t: typeof type) {
    setType(t);
    setValue(p.variant[t]);
    setOffset(0);
    setFilter('');
  }
  const all = Array.from({ length: variantCounts[type] }, (_, i) => i).filter(
    (i) => !filter || decodeVariant(type, i).method.id === filter,
  );
  const page = all.slice(offset, offset + 24);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KOREOGRAFİ & FİZİK MOTORU</div>
          <h1>
            Tekrar etme. Yeniden yarat<span className="title-dot">.</span>
          </h1>
          <p>Yöntem, ritim, giriş düzeni ve finalden oluşan {fmt(8192)} kombinasyon.</p>
        </div>
        <button
          className="button"
          onClick={() => setValue(all[Math.floor(Math.random() * all.length)])}
        >
          <RefreshCw size={16} />
          Rastgele keşfet
        </button>
      </div>
      <div className="variation-tabs">
        {(['removal', 'emergence', 'celebration'] as const).map((t) => (
          <button key={t} onClick={() => switchType(t)} className={type === t ? 'active' : ''}>
            {t === 'removal' ? (
              <Box size={20} />
            ) : t === 'emergence' ? (
              <Layers3 size={20} />
            ) : (
              <Flag size={20} />
            )}
            <div>
              <strong>
                {t === 'removal'
                  ? 'Stadyum sökümü'
                  : t === 'emergence'
                    ? 'Yeniden doğuş'
                    : 'Tifo & kutlama'}
              </strong>
              <small>{fmt(variantCounts[t])} kombinasyon</small>
            </div>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      <div className="variation-feature">
        <div className="variation-symbol">
          {type === 'removal' ? (
            <Box size={70} />
          ) : type === 'emergence' ? (
            <Layers3 size={70} />
          ) : (
            <Flag size={70} />
          )}
          <span>V{String(value + 1).padStart(4, '0')}</span>
        </div>
        <div>
          <span className="eyebrow">SEÇİLİ VARYASYON / {type.toLocaleUpperCase('en')}</span>
          <h2>{selected.title}</h2>
          <p>{selected.text}</p>
          <div className="tag-row">
            <span>{selected.placement}</span>
            <span>{selected.finish}</span>
            <span>10 sn · 9:16</span>
          </div>
          <div className="row">
            <button
              className="button primary"
              disabled={busy}
              onClick={() => onSave({ variant: { ...p.variant, [type]: value } })}
            >
              <Check size={16} />
              Projeye uygula
            </button>
            <button
              className="button"
              onClick={() =>
                onPrompt({
                  title: 'Varyasyon yönlendirmesi',
                  text: `Creative concept / not a rendered clip.\n${selected.text}\nCamera: preserve the accepted opening and final frames. Fixed city anchors and exact selected architecture. Ten-second continuous shot: 0–0.8 s initiation, 0.8–6.5 s progression, 6.5–8.5 s completion, 8.5–10 s hold. For club imagery use only verified project facts. Real player depictions require an explicit player selection. Effects are creative VFX, not instructions for a real pyrotechnic display.`,
                })
              }
            >
              <BookOpen size={16} />
              Yönlendirmeyi aç
            </button>
          </div>
        </div>
      </div>
      <div className="filter-bar">
        <div>
          <h2>Varyasyon kütüphanesi</h2>
          <p className="muted small">
            Kombinasyonlar hazır videolar değildir; üretim yönlendirmesidir.
          </p>
        </div>
        <select
          value={filter}
          aria-label="Varyasyon yöntemi"
          onChange={(e) => {
            setFilter(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Tüm yöntemler</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <span className="muted small">{fmt(all.length)} seçenek</span>
      </div>
      <div className="variation-grid">
        {page.map((id) => {
          const v = decodeVariant(type, id);
          return (
            <button
              key={id}
              className={`variation-card ${value === id ? 'active' : ''}`}
              onClick={() => setValue(id)}
            >
              <span className="variation-id">
                V{String(id + 1).padStart(4, '0')} <ArrowUpRight size={14} />
              </span>
              <h3>{v.method.name}</h3>
              <p>{v.rhythm.name}</p>
              <div>
                <span>{v.placement}</span>
                {value === id && <CheckCircle2 size={16} />}
              </div>
            </button>
          );
        })}
      </div>
      <div className="pagination">
        <button
          className="button"
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 24))}
        >
          <ArrowLeft size={15} />
          Önceki
        </button>
        <span>
          {Math.floor(offset / 24) + 1} / {Math.ceil(all.length / 24)}
        </span>
        <button
          className="button"
          disabled={offset + 24 >= all.length}
          onClick={() => setOffset(offset + 24)}
        >
          Sonraki
          <ArrowRight size={15} />
        </button>
      </div>
    </>
  );
}

function Assets({
  project: p,
  onReview,
  onExport,
  onUpload,
  busy,
}: {
  project: Project;
  onReview: (a: Asset) => void;
  onExport: () => void;
  onUpload: (code: string, file: File) => void;
  busy: boolean;
}) {
  const [filter, setFilter] = useState('all');
  const items = p.assets.filter((a) => filter === 'all' || a.status === filter).toReversed();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PROJE ARŞİVİ / {p.club.name}</div>
          <h1>
            Ürettiğin her kare<span className="title-dot">.</span>
          </h1>
          <p>Gerçek dosyalar, referans zincirleri ve kalite kontrol kayıtları.</p>
        </div>
        <button className="button primary" disabled={busy} onClick={onExport}>
          <Download size={16} />
          Tam paketi indir
        </button>
      </div>
      <div className="filter-bar">
        <div className="segmented">
          {[
            ['all', 'Tümü'],
            ['accepted', 'Kabul edilen'],
            ['review', 'Kontrol bekleyen'],
            ['rejected', 'Reddedilen'],
          ].map(([k, v]) => (
            <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
              {v}
            </button>
          ))}
        </div>
        <span className="muted small">{items.length} görsel</span>
      </div>
      {items.length ? (
        <div className="asset-grid">
          {items.map((a) => (
            <button className="asset-card" key={a.id} onClick={() => onReview(a)}>
              <AssetImage asset={a} />
              <div>
                <h3>
                  {a.code}
                  <Eye size={16} />
                </h3>
                <Badge
                  tone={
                    a.status === 'accepted' ? 'green' : a.status === 'review' ? 'amber' : 'neutral'
                  }
                >
                  {a.status === 'accepted'
                    ? 'Kabul edildi'
                    : a.status === 'review'
                      ? 'Kontrol bekliyor'
                      : 'Reddedildi'}
                </Badge>
                <p>
                  {a.width} × {a.height} · {new Date(a.createdAt).toLocaleDateString('tr-TR')}
                </p>
                <small>
                  {a.origin === 'upload' ? 'Yüklenen görsel' : a.model} · {a.references.length}{' '}
                  referans
                </small>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state tall">
          <FolderOpen size={42} />
          <h3>Görsel arşivin burada oluşacak.</h3>
          <p>Gerçek stadyum fotoğrafını yükleyerek ilk referansı oluştur.</p>
          <label className="button primary">
            <Upload size={16} />
            Stadyum referansı yükle
            <input
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload('SITE', f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}
    </>
  );
}

function Settings({
  status,
  onRefresh,
  onImport,
  busy,
}: {
  status: Status | null;
  onRefresh: () => void;
  onImport: () => void;
  busy: boolean;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">BAĞLANTILAR & VERİ</div>
          <h1>
            Stüdyonun kontrol merkezi<span className="title-dot">.</span>
          </h1>
          <p>Üretim sağlayıcısı, kaynaklar ve çalışma alanı.</p>
        </div>
        <button className="button" onClick={onRefresh} disabled={busy}>
          <RefreshCw size={16} />
          Durumu yenile
        </button>
      </div>
      <div className="settings-grid">
        {!standalone && <OpenAIConnection onRefresh={onRefresh} />}
        {standalone ? (
          <section className="panel">
            <h2>
              <Sparkles size={20} /> Görsel ve prompt çalışma alanı
            </h2>
            <p>
              Bu dosya sunucusuz çalışır. Tasarım planlarını ve promptları hazırla; seçtiğin görsel
              aracında ürettiğin sonuçları PNG, JPEG veya WebP olarak yükle.
            </p>
            <p>
              Otomatik AI görsel üretimi ve canlı internet araştırması bu sürümde bulunmuyor. API
              anahtarı girmen gerekmez.
            </p>
            <Badge tone="green">Promptlar, görsel yükleme ve ZIP dışa aktarma aktif</Badge>
          </section>
        ) : (
          <section className="panel">
            <div className="section-heading">
              <h2>
                <Sparkles size={20} />
                Görsel üretimi
              </h2>
              <Badge tone={status?.provider.configured ? 'green' : 'amber'}>
                {status?.provider.configured ? 'Bağlı' : 'Anahtar gerekli'}
              </Badge>
            </div>
            <p>
              OpenAI Images düzenleme bağlantısı, kabul edilmiş referansları gerçek dosyalarıyla
              gönderir. Her üretim tek bir görseldir ve ayrıca kalite kontrolü gerektirir.
            </p>
            <dl className="settings-list">
              <div>
                <dt>Sağlayıcı</dt>
                <dd>OpenAI Images</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{status?.provider.model}</dd>
              </div>
              <div>
                <dt>Doğal çıktı</dt>
                <dd>{status?.provider.size}</dd>
              </div>
              <div>
                <dt>Dikey dışa aktarma</dt>
                <dd>1080 × 1920 · kırpmadan kenar doldurma</dd>
              </div>
            </dl>
            <div className="callout">
              <LockKeyhole size={18} />
              <span>
                API anahtarı sunucuda tutulur, tarayıcıya gönderilmez. Yerel kullanımda{' '}
                <code>.env</code> dosyasına; bulut kullanımında güvenli ortam ayarlarına ekle.
              </span>
            </div>
            <pre>STADIUM_OPENAI_API_KEY=…{'\n'}OPENAI_IMAGE_MODEL=gpt-image-1</pre>
            <p className="small muted">
              Modeli yalnızca hesabında çoklu görsel düzenleme ve seçili boyut destekleniyorsa
              değiştir. Ücretli üretim bu bağlantının testi için otomatik çalıştırılmaz.
            </p>
          </section>
        )}
        <section className="panel">
          <div className="section-heading">
            <h2>
              <Globe2 size={20} />
              Kulüp kataloğu
            </h2>
            <Badge>CC0</Badge>
          </div>
          <div className="settings-stat">
            <strong>{fmt(status?.catalog.total || 0)}</strong>
            <span>kulüp kaydı / {status?.catalog.countries || 0} ülke</span>
          </div>
          <p>
            OpenFootball kaynaklı yerel katalog. Tarihsel kayıtlar ve eski sponsor adları
            içerebilir. Üretimde kullanılacak bilgiler resmi kaynaklarla ayrıca doğrulanır.
          </p>
          <p>
            Dünyadaki bütün kulüplerin eksiksiz ve güncel olduğu iddia edilmez.{' '}
            {standalone
              ? 'JSON içe aktarma ile yeni kayıtlar eklenebilir.'
              : 'Canlı Wikidata araştırması ve JSON içe aktarma ile yeni kayıtlar eklenebilir.'}
          </p>
          <div className="row">
            <button className="button" onClick={onImport}>
              <FileJson size={16} />
              Kataloğu genişlet
            </button>
            <a
              href={status?.catalog.source || 'https://github.com/openfootball/clubs'}
              target="_blank"
              rel="noreferrer"
              className="text-button"
            >
              Kaynağı aç <ExternalLink size={15} />
            </a>
          </div>
          <p className="small muted">Kaynak revizyonu: {status?.catalog.revision.slice(0, 12)}</p>
        </section>
        <section className="panel">
          <h2>
            <Clapperboard size={20} />
            Video üretim akışı
          </h2>
          <p>
            Seedance / Higgsfield için 10 saniyelik İngilizce video promptları hazırlanır. Kabul
            edilmiş açılış ve final dosyaları varsa gerçek dosya adları <code>@image-1</code> ve{' '}
            <code>@image-2</code> ile eşlenir.
          </p>
          <p>
            {standalone
              ? 'Tek HTML sürümü video render etmez.'
              : 'Sunucu sürümü OpenAI Sora ile 12 saniyelik videoları üretir ve MP4 olarak saklar. Otomatik prodüksiyon panelinden başlatılır. Sora yalnızca başlangıç görselini alır; son kare kontrolü garanti edilmez.'}
          </p>
          <Badge>Video promptu dışa aktarma aktif</Badge>
        </section>
        <section className="panel">
          <h2>
            <ShieldCheck size={20} />
            Kalıcı proje & devamlılık
          </h2>
          <p>
            {standalone ? (
              'Projeler ve görseller bu tarayıcının kayıt alanında saklanır. HTML dosyasının içine yazılmaz. Başka cihaza geçerken Yedeği indir ve Yedek aç düğmelerini kullan. Tarayıcı verilerini silmek veya farklı tarayıcı/dosya konumundan açmak eski kayıtlarına erişimini kaldırabilir.'
            ) : (
              <>
                Projeler SQLite veritabanında; görseller sunucunun <code>.data/media</code>{' '}
                klasöründe saklanır. ZIP paketi proje kaydını, promptları, görselleri ve kaynak
                master dosyasını içerir.
              </>
            )}
          </p>
          <p>
            Görsel üretimi sonrası 6 maddelik insan kontrolü gerekir. Referans değiştiğinde bağlı
            kabul edilmiş çıktılar geçerliliğini kaybeder. Sunucu yeniden başladığında yarım kalan
            ücretli istek otomatik tekrar edilmez.
          </p>
          <Badge tone="green">Master v43 · kayıtlı iş akışı</Badge>
        </section>
      </div>
    </>
  );
}
