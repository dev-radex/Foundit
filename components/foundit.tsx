'use client';
import AuthPanel from './auth-panel';
import { supabaseBrowser } from '../lib/supabase/client';
import React, { useEffect, useState } from 'react';
import {
  Home,
  Search,
  Package,
  PlusCircle,
  FileText,
  ShieldCheck,
  MessageSquare,
  Bell,
  User,
  LogOut,
  ArrowRight,
  MapPin,
  Calendar,
  ImageOff,
  CheckCircle,
  Lock,
  Menu,
  X,
  ChevronRight,
  Flag,
  Send,
  Upload,
  Check,
  Settings,
  Users,
  ClipboardList,
  Megaphone,
  Layers,
  BookOpen,
  KeyRound,
  Smartphone,
  Briefcase,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import { categories, locations, safety, matchScore, resolveTaxonomy } from '../lib/domain';
type Row = Record<string, any>;
const fmt = (s: string) =>
  s
    ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
const titleCase = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const nav = [
  ['/dashboard', 'Dashboard', Home],
  ['/lost', 'Lost Items', Search],
  ['/found', 'Found Items', Package],
  ['/report', 'Report an Item', PlusCircle],
  ['/my-reports', 'My Reports', FileText],
  ['/my-claims', 'My Claims', ShieldCheck],
  ['/messages', 'Messages', MessageSquare],
  ['/notifications', 'Notifications', Bell],
  ['/profile', 'Profile', User],
] as const;
const adminNav = [
  ['/admin', 'Overview'],
  ['/admin/reports', 'Reports'],
  ['/admin/claims', 'Disputed claims'],
  ['/admin/verifications', 'Verifications'],
  ['/admin/abuse', 'Abuse reports'],
  ['/admin/users', 'Members'],
  ['/admin/announcements', 'Announcements'],
  ['/admin/institutions', 'Institutions'],
  ['/admin/locations', 'Campus locations'],
  ['/admin/categories', 'Categories'],
  ['/admin/audit', 'Audit log'],
];
function Logo() {
  return (
    <a className="logo" href="/">
      <img src="/favicon.svg" alt="" />
      Found<span>It</span>
    </a>
  );
}
function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
function Empty({
  title,
  children,
  href,
  label = 'Report an item',
}: {
  title: string;
  children?: React.ReactNode;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Package size={28} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {href && (
        <a className="btn primary" href={href}>
          {label}
          <ArrowRight size={16} />
        </a>
      )}
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Safety() {
  return (
    <div className="safety">
      <h3>
        <ShieldCheck size={18} />
        Stay safe when recovering
      </h3>
      <ul>
        {safety.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', f);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', f);
      document.body.style.overflow = old;
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function UploadField({
  purpose,
  name,
  label = 'Add a photo',
  value = '',
  onError,
}: {
  purpose: string;
  name: string;
  label?: string;
  value?: string;
  onError: (message: string) => void;
}) {
  const [fid, setFid] = useState(value),
    [uploading, setUploading] = useState(false);
  return (
    <div>
      <input type="hidden" name={name} value={fid} />
      <label className="upload">
        <Upload size={22} />
        <span>{uploading ? 'Uploading…' : fid ? 'Image attached — choose to replace' : label}</span>
        <small>JPEG, PNG or WebP · up to 3 MB</small>
        <input
          aria-label={label}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setUploading(true);
            try {
              const fd = new FormData();
              fd.set('file', f);
              fd.set('purpose', purpose);
              const r = await fetch('/api/upload', { method: 'POST', body: fd });
              const d = (await r.json()) as Row;
              if (!r.ok) throw new Error(d.error);
              setFid(d.id);
            } catch (e: any) {
              onError(e.message);
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      {fid && (
        <a className="text-link" target="_blank" rel="noreferrer" href={'/api/files/' + fid}>
          View attachment ↗
        </a>
      )}
    </div>
  );
}
export default function FoundIt({ initialPath = '/' }: { initialPath?: string }) {
  const [path, setPath] = useState(initialPath);
  const [query, setQuery] = useState<URLSearchParams>(new URLSearchParams());
  const [data, setData] = useState<Row>({
    reports: [],
    stats: {},
    taxonomy: [],
    announcements: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<Row | null>(null);
  const [adminData, setAdminData] = useState<Row>({});
  const [conversation, setConversation] = useState<Row | null>(null);
  const [tab, setTab] = useState('All');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [loc, setLoc] = useState('');
  const [sort, setSort] = useState('new');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  async function load() {
    const r = await fetch('/api/data');
    const d = (await r.json()) as Row;
    if (!r.ok) throw new Error(d.error);
    setData(d);
    return d;
  }
  useEffect(() => {
    setPath(window.location.pathname);
    const q = new URLSearchParams(window.location.search);
    setQuery(q);
    setSearch(q.get('q') || '');
    setCat(q.get('category') || '');
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const u = data.user,
    isAdmin = ['admin', 'super-admin'].includes(u?.role);
  const publicPage = [
    '/',
    '/docs',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/legal/terms',
    '/legal/privacy',
    '/legal/guidelines',
  ].includes(path);
  useEffect(() => {
    if (!u) return;
    let alive = true;
    async function refresh() {
      try {
        if (path.startsWith('/admin') && isAdmin) {
          const r = await fetch('/api/data?mode=admin'),
            d = (await r.json()) as Row;
          if (!r.ok) throw new Error(d.error);
          if (alive) setAdminData(d);
        }
        if (path.startsWith('/messages/')) {
          const r = await fetch(
              '/api/data?mode=conversation&id=' + encodeURIComponent(path.split('/')[2]),
            ),
            d = (await r.json()) as Row;
          if (!r.ok) throw new Error(d.error);
          if (alive) setConversation(d);
        }
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    }
    refresh();
    const t = path.startsWith('/messages/') ? setInterval(refresh, 10000) : null;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [path, u?.id, isAdmin]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  async function mutate(action: string, p: Row = {}) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...p }),
      });
      const d = (await r.json()) as Row;
      if (!r.ok) throw new Error(d.error);
      await load();
      if (path.startsWith('/admin')) {
        const ar = await fetch('/api/data?mode=admin');
        setAdminData((await ar.json()) as Row);
      }
      if (path.startsWith('/messages/')) {
        const cr = await fetch('/api/data?mode=conversation&id=' + path.split('/')[2]);
        setConversation((await cr.json()) as Row);
      }
      setToast('Saved successfully');
      return d;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  const taxonomy = resolveTaxonomy(data.taxonomy || []);
  const cats = taxonomy.filter((t) => t.kind === 'category' && t.active).map((t) => t.name);
  const locs = taxonomy.filter((t) => t.kind === 'location' && t.active).map((t) => t.name);
  const reports: Row[] = data.reports || [];
  const claims: Row[] = data.claims || [];
  const myReports = reports.filter((r) => r.owner === u?.id);
  const unread = (data.notifications || []).filter((n: Row) => !n.read).length;
  const messageUnread = (data.conversations || []).reduce((n: number, c: Row) => n + c.unread, 0);
  function Card({ r, compact = false }: { r: Row; compact?: boolean }) {
    return (
      <a
        className={'report-card ' + (compact ? 'compact' : '')}
        href={u ? '/items/' + r.id : '/login'}
      >
        {!compact && (
          <div className="report-photo">
            {r.photo ? <img src={'/api/files/' + r.photo} alt={r.title} /> : <ImageOff size={29} />}
            <Badge tone={r.type}>{titleCase(r.type)}</Badge>
            <span className="photo-status">
              <Badge tone={r.status === 'recovered' ? 'green' : ''}>{titleCase(r.status)}</Badge>
            </span>
          </div>
        )}
        <div className="report-content">
          {compact && <Badge tone={r.type}>{titleCase(r.type)}</Badge>}
          <small>{r.category}</small>
          <h3>{r.title}</h3>
          {!compact && <p className="clamp">{r.description}</p>}
          <div className="meta">
            <MapPin size={14} />
            {r.location}
          </div>
          <div className="meta">
            <Calendar size={14} />
            {fmt(r.date)}
          </div>
        </div>
      </a>
    );
  }
  function Stats() {
    return (
      <div className="stats">
        {[
          ['lost', 'Open lost reports'],
          ['found', 'Open found reports'],
          ['recovered', 'Items recovered'],
        ].map(([key, label]) => (
          <div className="stat" key={key}>
            <strong>{data.stats?.[key] || 0}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    );
  }
  function ReportGrid({ list }: { list: Row[] }) {
    return list.length ? (
      <div className="report-grid">
        {list.map((r) => (
          <Card key={r.id} r={r} />
        ))}
      </div>
    ) : (
      <Empty title="No reports yet" href="/report">
        Be the first to help someone find their belongings.
      </Empty>
    );
  }
  function SearchBox() {
    return (
      <form className="searchbox" action="/search">
        <Search size={21} />
        <input
          aria-label="Search reports"
          name="q"
          placeholder="Search item, e.g. blue backpack, student ID…"
          defaultValue={query.get('q') || ''}
        />
        <button className="btn primary">Search</button>
      </form>
    );
  }
  function Heading({
    title,
    sub,
    children,
  }: {
    title: string;
    sub?: string;
    children?: React.ReactNode;
  }) {
    return (
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {children}
      </div>
    );
  }

  function ProfileForm() {
    return (
      <form
        className="panel form-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          const p = Object.fromEntries(new FormData(e.currentTarget));
          if (await mutate('profile', p)) window.location.href = '/dashboard';
        }}
      >
        <Field label="Full name">
          <input name="name" required maxLength={100} defaultValue={u.name} />
        </Field>
        <div className="form-grid">
          <Field label="Affiliation">
            <select name="affiliation" required defaultValue={u.affiliation || ''}>
              <option value="">Select affiliation</option>
              {[
                'Undergraduate student',
                'Postgraduate student',
                'Academic staff',
                'Non-academic staff',
                'Alumnus',
                'Other',
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Institution">
            <input readOnly value="University of Ilorin" />
          </Field>
          <Field label="Department">
            <input name="department" defaultValue={u.department || ''} maxLength={150} />
          </Field>
          <Field label="Level / year">
            <select name="level" defaultValue={u.level || ''}>
              <option value="">Select level</option>
              {['100', '200', '300', '400', '500', '600', 'Postgraduate', 'Not applicable'].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </Field>
        </div>
        <button disabled={busy} className="btn primary">
          Save profile
          <ArrowRight size={16} />
        </button>
      </form>
    );
  }
  function ClaimList({ list }: { list: Row[] }) {
    return list.length ? (
      <div className="stack">
        {list.map((c) => (
          <article className="panel claim-card" key={c.id}>
            <div className="row between">
              <a href={'/items/' + c.report}>
                <h3>{c.title}</h3>
              </a>
              <div>
                <Badge tone={c.status === 'recovered' ? 'green' : ''}>{titleCase(c.status)}</Badge>
                {!!c.escalated && <Badge tone="lost">Disputed</Badge>}
              </div>
            </div>
            <p>
              {c.owner === u.id ? 'Claim from ' + c.claimant_name : 'Submitted ' + fmt(c.created)}
            </p>
            <dl className="claim-details">
              <dt>Ownership explanation</dt>
              <dd>{c.reason}</dd>
              <dt>Distinctive features</dt>
              <dd>{c.features}</dd>
              {c.answer && (
                <>
                  <dt>Private answer</dt>
                  <dd>{c.answer}</dd>
                </>
              )}
            </dl>
            {c.evidence && (
              <a className="text-link" target="_blank" href={'/api/files/' + c.evidence}>
                View private evidence ↗
              </a>
            )}
            <div className="actions">
              {(c.owner === u.id || (isAdmin && c.escalated)) &&
                ['pending', 'more_info'].includes(c.status) && (
                  <>
                    <button
                      disabled={busy}
                      className="btn primary"
                      onClick={() => mutate('claimState', { id: c.id, status: 'approved' })}
                    >
                      Approve claim
                    </button>
                    <button
                      disabled={busy}
                      className="btn"
                      onClick={() => mutate('claimState', { id: c.id, status: 'rejected' })}
                    >
                      Reject
                    </button>
                    {c.status === 'pending' && (
                      <button
                        disabled={busy}
                        className="btn"
                        onClick={() => mutate('claimState', { id: c.id, status: 'more_info' })}
                      >
                        Request more information
                      </button>
                    )}
                  </>
                )}
              {(c.owner === u.id || (isAdmin && c.escalated)) && c.status === 'approved' && (
                <button
                  className="btn primary"
                  onClick={() => setModal({ kind: 'recover', claim: c })}
                >
                  Confirm handover
                </button>
              )}
              {[c.owner, c.claimant].includes(u.id) && c.status !== 'recovered' && !c.escalated && (
                <button
                  disabled={busy}
                  className="btn"
                  onClick={() => mutate('claimState', { id: c.id, status: 'escalated' })}
                >
                  Escalate dispute
                </button>
              )}
              {(data.conversations || []).find(
                (v: Row) => v.report === c.report && v.member === c.claimant,
              ) && (
                <a
                  className="btn"
                  href={
                    '/messages/' +
                    data.conversations.find(
                      (v: Row) => v.report === c.report && v.member === c.claimant,
                    ).id
                  }
                >
                  <MessageSquare size={16} />
                  Conversation
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    ) : (
      <Empty title="No claims here yet">
        Ownership claims and their progress will appear here.
      </Empty>
    );
  }
  let content: React.ReactNode;
  if (path === '/') {
    content = (
      <>
        <header className="public-header">
          <Logo />
          <nav>
            <a href="/docs">Docs</a>
            <a href="/api/inspect">Inspect API</a>
            <a className="btn primary small" href={u ? '/dashboard' : '/login'}>
              {u ? 'Dashboard' : 'Sign in'}
            </a>
          </nav>
        </header>
        <main className="landing">
          <section className="landing-hero">
            <div>
              <Badge tone="warm">✧ University of Ilorin</Badge>
              <h1>
                Lost something?
                <br />
                <em>Let's find it.</em>
              </h1>
              <p>
                FoundIt is a privacy-first lost-and-found platform for the university community.
                Report what you lost or found, get smart match suggestions, and arrange safe
                handovers — all without exposing your phone number or email.
              </p>
              <div className="actions">
                <a className="btn primary" href={u ? '/dashboard' : '/register'}>
                  {u ? 'Go to dashboard' : 'Get started'}
                  <ArrowRight size={17} />
                </a>
                <a className="btn" href="/login">
                  Sign in
                </a>
                <a className="btn" href="/docs">
                  <BookOpen size={17} />
                  Documentation
                </a>
              </div>
            </div>
            <aside className="community panel">
              <h4>Community activity</h4>
              <Stats />
              <div className="how-mini">
                <strong>How it works</strong>
                <ol>
                  <li>Report a lost or found item.</li>
                  <li>FoundIt suggests possible matches.</li>
                  <li>Claim, verify, and arrange a safe handover — privately.</li>
                </ol>
              </div>
            </aside>
          </section>
          <section>
            <div className="section-head">
              <h2>Recently reported</h2>
              <a href={u ? '/search' : '/login'}>{u ? 'Browse all' : 'Sign in to browse all'} →</a>
            </div>
            {reports.length ? (
              <div className="report-grid">
                {reports.slice(0, 3).map((r) => (
                  <Card key={r.id} r={r} compact />
                ))}
              </div>
            ) : (
              <div className="quiet-empty">
                No public reports yet. Be the first to post one after you sign in.
              </div>
            )}
          </section>
          <section>
            <h2>Everything you need to recover what's yours</h2>
            <div className="features">
              {[
                [
                  Search,
                  'Smart matching',
                  'We compare category, keywords, location and date to suggest likely matches.',
                ],
                [
                  ShieldCheck,
                  'Verified claims',
                  'Claimants explain distinctive features. You approve before any handover.',
                ],
                [
                  MessageSquare,
                  'Private messaging',
                  'Coordinate in-app. Your phone number and email stay private.',
                ],
                [
                  Search,
                  'Search & filter',
                  'Browse lost and found reports by category, location and status.',
                ],
                [
                  GraduationCap,
                  'Affiliation verified',
                  'University ID review helps the community know who they are dealing with.',
                ],
                [
                  BookOpen,
                  'Built for transparency',
                  'Public documentation explains how FoundIt works and protects your data.',
                ],
              ].map(([Icon, t, b]: any) => (
                <article className="panel feature" key={t}>
                  <Icon size={24} />
                  <h3>{t}</h3>
                  <p>{b}</p>
                </article>
              ))}
            </div>
          </section>
          <Safety />
          <section className="cta">
            <h2>Ready to find what you lost?</h2>
            <p>Join the University of Ilorin community and help bring lost belongings home.</p>
            <a className="btn amber" href={u ? '/dashboard' : '/register'}>
              {u ? 'Go to dashboard' : 'Create your account'}
              <ArrowRight size={16} />
            </a>
          </section>
        </main>
        <footer>
          <Logo />
          <div>
            <a href="/docs">Documentation</a>
            <a href="/legal/terms">Terms</a>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/guidelines">Guidelines</a>
          </div>
        </footer>
      </>
    );
  } else if (['/login', '/register', '/forgot-password', '/reset-password'].includes(path)) {
    content = <AuthPanel path={path} />;
  } else if (path === '/docs' || path.startsWith('/legal/')) {
    const kind = path.split('/').pop();
    content = (
      <>
        <header className="public-header">
          <Logo />
          <nav>
            <a href="/">Home</a>
            <a href="/dashboard">Dashboard</a>
          </nav>
        </header>
        <main className="document">
          <Badge tone="warm">University of Ilorin</Badge>
          <h1>
            {path === '/docs'
              ? 'FoundIt — a privacy-first university lost-and-found platform.'
              : kind === 'privacy'
                ? 'Your privacy matters'
                : kind === 'terms'
                  ? 'Terms of use'
                  : 'Community guidelines'}
          </h1>
          {path === '/docs' ? (
            <>
              <p>
                Report lost belongings, list found items, discover possible matches and coordinate
                safe handovers through verified claims and private messaging.
              </p>
              <h2>How it works</h2>
              <ol>
                <li>Sign in and complete your affiliation profile.</li>
                <li>
                  Create a lost or found report with a photo, category, campus location and date.
                </li>
                <li>
                  Review possible matches. Claim found items with details only the owner would know.
                </li>
                <li>
                  The finder reviews the evidence and can approve, reject or request more
                  information.
                </li>
                <li>
                  Arrange a public handover in private messages. The finder confirms recovery.
                </li>
              </ol>
              <h2>Roles and permissions</h2>
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Visitor</td>
                    <td>Landing page, public summaries, documentation and policies.</td>
                  </tr>
                  <tr>
                    <td>Member</td>
                    <td>Reports, claims, participant-only messages, profile and verification.</td>
                  </tr>
                  <tr>
                    <td>Admin</td>
                    <td>
                      Moderation, disputed claims, verification, abuse investigations, announcements
                      and taxonomy.
                    </td>
                  </tr>
                  <tr>
                    <td>Super-admin</td>
                    <td>Administrator access plus controlled role assignment.</td>
                  </tr>
                </tbody>
              </table>
              <h2>Privacy by design</h2>
              <p>
                Private identifying details are available only to the reporter and authorised
                administrators. Claim evidence is limited to the claimant, finder and administrators
                handling an escalated dispute. University ID documents are restricted to their owner
                and verification administrators. Administrative file access and investigation access
                are logged.
              </p>
              <h2>Matching</h2>
              <p>
                Scores use category (35 points), overlapping words (up to 35), location (20) and
                nearby dates (up to 10). A score is a suggestion, never proof of ownership.
              </p>
              <h2>Independent deployment</h2>
              <p>
                FoundIt uses Supabase accounts, a PostgreSQL database and private file storage, with
                the application hosted on Vercel. Email/password and Google sign-in depend on the
                authentication providers configured by the operator.
              </p>
            </>
          ) : kind === 'privacy' ? (
            <>
              <p>
                FoundIt stores your display name, affiliation, reports and the information you
                choose to submit. Contact email and phone numbers are not displayed to other
                members.
              </p>
              <h2>Public and private information</h2>
              <p>
                Report titles, photos, categories, dates and general locations can appear in public
                summaries. Descriptions are available to signed-in members. Do not include contact
                details, ID numbers or distinctive proof of ownership in a public description or
                photograph.
              </p>
              <p>
                Claim answers and evidence, ID documents and private notes have restricted access.
                Conversation participants can read their messages. Administrators may inspect
                relevant transcripts for a recorded abuse investigation; this access is audited.
              </p>
              <h2>Account and storage</h2>
              <p>
                Authentication is handled by Supabase. FoundIt does not receive your password. Files
                are stored privately and served after permission checks. Contact the platform
                operator for account or data requests. The operator must establish retention periods
                and a contact channel before a public launch.
              </p>
            </>
          ) : kind === 'terms' ? (
            <>
              <p>
                Use FoundIt to help the university community return belongings to their rightful
                owners. Submit truthful reports and only claim property you believe belongs to you.
              </p>
              <h2>Safe handovers</h2>
              <p>
                FoundIt facilitates communication; it does not guarantee ownership or physical
                safety. Meet in public, verify the item and do not pay recovery fees. Escalate
                disputes instead of confronting another member.
              </p>
              <h2>Moderation</h2>
              <p>
                Administrators may hide reports, resolve disputes and suspend accounts that misuse
                the service. Do not impersonate others, publish sensitive information, harass
                members or submit fraudulent claims.
              </p>
              <p>
                These operating terms require review and an identified operator before the service
                is launched publicly.
              </p>
            </>
          ) : (
            <>
              <p>
                Be helpful, honest and respectful. Keep distinctive identifying information private
                so the real owner can prove their claim.
              </p>
              <Safety />
              <h2>Report concerns</h2>
              <p>
                Use “Report this listing” or the conversation reporting control to flag scams,
                harassment or inappropriate content. Block unwanted contact and let administrators
                investigate.
              </p>
            </>
          )}
        </main>
      </>
    );
  } else if (loading) {
    content = (
      <div className="loading">
        <RefreshCw className="spin" />
        Loading your community…
      </div>
    );
  } else if (!u) {
    content = (
      <div className="auth-wrap">
        <Logo />
        <Empty title="Sign in to continue" href="/login" label="Sign in">
          Reports, claims and messages are available to signed-in community members.
        </Empty>
      </div>
    );
  } else if (path === '/dashboard') {
    const matches: Row[] = myReports
      .flatMap((a) =>
        reports
          .filter((b) => b.owner !== u.id && b.moderation === 'visible')
          .map((b) => ({ ...b, score: matchScore(a, b) })),
      )
      .filter((r) => r.score >= 50)
      .sort((a, b) => b.score - a.score);
    content = (
      <>
        <section className="dashboard-hero">
          <div className="row">
            <Badge>University of Ilorin</Badge>
            <Badge>{titleCase(u.verified)}</Badge>
          </div>
          <h1>
            Welcome back, {u.name.split(' ')[0]}.<br />
            Let's help you find it.
          </h1>
          <p>
            Report lost or found belongings, match them with the right person and
            <br className="desktop" /> recover them safely — no WhatsApp groups, no phone numbers
            shared.
          </p>
          <SearchBox />
          <div className="actions">
            <a className="btn amber" href="/report?type=lost">
              Report lost item
              <ArrowRight size={16} />
            </a>
            <a className="btn ghost" href="/report?type=found">
              Report found item
            </a>
          </div>
        </section>
        {!u.onboarded && (
          <a className="onboarding panel row between" href="/onboarding">
            <div>
              <strong>Finish setting up your FoundIt profile</strong>
              <p>Add your affiliation, see how FoundIt works and read the safety rules.</p>
            </div>
            <ArrowRight size={20} />
          </a>
        )}
        <Stats />
        {data.announcements?.length > 0 && (
          <section>
            {data.announcements.map((a: Row) => (
              <div className="announcement panel" key={a.id}>
                <Megaphone size={20} />
                <div>
                  <h3>{a.title}</h3>
                  <p>{a.body}</p>
                </div>
                {!!a.pinned && <Badge>Pinned</Badge>}
              </div>
            ))}
          </section>
        )}
        {matches.length > 0 && (
          <section>
            <div className="section-head">
              <div>
                <h2>Possible matches for your reports</h2>
                <p>These suggestions need your verification.</p>
              </div>
            </div>
            <div className="report-grid">
              {matches.slice(0, 3).map((r, i) => (
                <div key={r.id + i}>
                  <Badge tone="green">{r.score}% match</Badge>
                  <Card r={r} />
                </div>
              ))}
            </div>
          </section>
        )}
        {['lost', 'found'].map((type) => (
          <section key={type}>
            <div className="section-head">
              <div>
                <h2>Recently reported {type}</h2>
                <p>
                  {type === 'lost'
                    ? 'Belongings the community is looking for.'
                    : 'Items handed in or spotted on campus.'}
                </p>
              </div>
              <a href={'/' + type}>View all →</a>
            </div>
            <ReportGrid
              list={reports
                .filter((r) => r.type === type && r.moderation === 'visible' && r.status === 'open')
                .slice(0, 3)}
            />
          </section>
        ))}
        <section>
          <h2>Commonly reported belongings</h2>
          <p>Jump straight to a category.</p>
          <div className="category-grid">
            {cats.map((c, i) => (
              <a href={'/search?category=' + encodeURIComponent(c)} className="panel" key={c}>
                {i === 0 ? (
                  <Smartphone size={21} />
                ) : i === 5 ? (
                  <KeyRound size={21} />
                ) : (
                  <Briefcase size={21} />
                )}
                <span>{c}</span>
                <ChevronRight size={15} />
              </a>
            ))}
          </div>
        </section>
        <section>
          <h2>How FoundIt works</h2>
          <div className="steps">
            {[
              [
                'Report what you lost or found',
                'Add a photo, the campus location and a few details. Sensitive identifying marks stay private.',
              ],
              [
                'FoundIt suggests possible matches',
                'We compare category, keywords, location and dates, then show you likely candidates.',
              ],
              [
                'Verify, arrange handover, recover',
                'Claim with proof only you would know, message safely in-app, then meet in a public campus spot.',
              ],
            ].map(([a, b], i) => (
              <div className="panel" key={a}>
                <span className="step">{i + 1}</span>
                <h3>{a}</h3>
                <p>{b}</p>
              </div>
            ))}
          </div>
        </section>
        <Safety />
      </>
    );
  } else if (['/lost', '/found', '/search'].includes(path)) {
    const type = path === '/search' ? '' : path.slice(1);
    let filtered = reports.filter(
      (r) =>
        r.moderation === 'visible' &&
        (!type || r.type === type) &&
        (!cat || r.category === cat) &&
        (!loc || r.location === loc) &&
        (!status || r.status === status) &&
        (!search || (r.title + ' ' + r.description).toLowerCase().includes(search.toLowerCase())),
    );
    filtered.sort((a, b) =>
      sort === 'old' ? a.created.localeCompare(b.created) : b.created.localeCompare(a.created),
    );
    content = (
      <>
        <Heading
          title={type ? titleCase(type) + ' items' : 'Search reports'}
          sub={
            type === 'found'
              ? 'Items handed in or spotted around campus. Claim yours with details only the owner would know.'
              : type === 'lost'
                ? 'Help reunite the community with the belongings they are looking for.'
                : 'Find belongings by name, description, category or campus location.'
          }
        />
        <div className="filters panel">
          <div className="searchbox">
            <Search size={20} />
            <input
              aria-label="Search reports"
              placeholder="Search by item, colour, brand or description…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="filter-row">
            <select
              aria-label="Category"
              value={cat}
              onChange={(e) => {
                setCat(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {cats.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="Location"
              value={loc}
              onChange={(e) => {
                setLoc(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All locations</option>
              {locs.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {['open', 'recovered', 'closed'].map((x) => (
                <option value={x} key={x}>
                  {titleCase(x)}
                </option>
              ))}
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
            </select>
          </div>
        </div>
        {filtered.length ? (
          <ReportGrid list={filtered.slice((page - 1) * 12, page * 12)} />
        ) : (
          <Empty title="No matching reports">Try a different keyword or clear the filters.</Empty>
        )}
        <div className="pagination">
          <span>{filtered.length} reports found</span>
          <div className="actions">
            <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="btn small"
              disabled={page * 12 >= filtered.length}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </>
    );
  } else if (path === '/report') {
    const edit = reports.find((r) => r.id === query.get('edit'));
    const type = edit?.type || query.get('type') || 'lost';
    content = (
      <>
        <Heading
          title={edit ? 'Edit your report' : 'Report an item'}
          sub="Two minutes now can save a week of searching. Only share what helps someone recognise the item."
        />
        {edit && edit.owner !== u.id ? (
          <Empty title="You can only edit your own reports" />
        ) : (
          <form
            className="panel form-panel"
            onSubmit={async (e) => {
              e.preventDefault();
              const p = Object.fromEntries(new FormData(e.currentTarget));
              const result = await mutate('report', {
                ...p,
                type,
                id: edit?.id,
                version: edit?.version,
              });
              if (result) window.location.href = '/items/' + result.id;
            }}
          >
            {!edit && (
              <div className="segmented">
                <a className={type === 'lost' ? 'selected' : ''} href="/report?type=lost">
                  <Search size={17} />I lost something
                </a>
                <a className={type === 'found' ? 'selected' : ''} href="/report?type=found">
                  <Package size={17} />I found something
                </a>
              </div>
            )}
            <Field label="Item name">
              <input
                required
                maxLength={120}
                name="title"
                placeholder="e.g. Blue Nike backpack"
                defaultValue={edit?.title}
              />
            </Field>
            <div className="form-grid">
              <Field label="Category">
                <select required name="category" defaultValue={edit?.category || ''}>
                  <option value="">Select a category</option>
                  {cats.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={'Date ' + type}>
                <input
                  required
                  type="date"
                  name="date"
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={edit?.date || new Date().toISOString().slice(0, 10)}
                />
              </Field>
            </div>
            <Field
              label="Description"
              hint="Visible to members. Keep proof of ownership and contact details out of this field."
            >
              <textarea
                name="description"
                required
                maxLength={3000}
                rows={4}
                placeholder="Colour, brand, size — enough to recognise the item without revealing private details."
                defaultValue={edit?.description}
              />
            </Field>
            <Field
              label="Campus location"
              hint="Keep it general — never post exact room numbers or live locations."
            >
              <select name="location" required defaultValue={edit?.location || ''}>
                <option value="">Where was it?</option>
                {locs.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Private identifying details"
              hint="Only you and authorised administrators can see these details. Claimants must provide their own proof."
            >
              <textarea
                name="private_note"
                maxLength={3000}
                rows={3}
                placeholder="e.g. name on an ID, serial number or distinctive contents"
                defaultValue={edit?.private_note}
              />
            </Field>
            <Field
              label="Photograph (optional)"
              hint="Avoid including ID numbers, addresses or other sensitive information in the photo."
            >
              <UploadField onError={setError} purpose="photo" name="photo" value={edit?.photo} />
            </Field>
            <div className="actions">
              <button className="btn primary" disabled={busy}>
                {busy ? 'Saving…' : edit ? 'Save changes' : 'Publish ' + type + ' report'}
              </button>
              <a className="btn" href={edit ? '/items/' + edit.id : '/dashboard'}>
                Cancel
              </a>
            </div>
          </form>
        )}
      </>
    );
  } else if (path.startsWith('/items/')) {
    const r = reports.find((r) => r.id === path.split('/')[2]);
    const own = r?.owner === u.id;
    const already = claims.find((c) => c.report === r?.id && c.claimant === u.id);
    content = r ? (
      <>
        <a className="back-link" href={'/' + r.type}>
          ← Back to {r.type} items
        </a>
        <div className="detail-grid">
          <article>
            <div className="detail-image">
              {r.photo ? (
                <img alt={r.title} src={'/api/files/' + r.photo} />
              ) : (
                <>
                  <ImageOff size={46} />
                  <span>No photo provided</span>
                </>
              )}
            </div>
            <div className="actions">
              <Badge tone={r.type}>{titleCase(r.type)}</Badge>
              <Badge>{titleCase(r.status)}</Badge>
              <Badge>{r.category}</Badge>
              {r.moderation !== 'visible' && <Badge tone="lost">{r.moderation}</Badge>}
            </div>
            <h1>{r.title}</h1>
            <p className="description">{r.description}</p>
            {r.private_note && (
              <div className="private-note">
                <h3>
                  <Lock size={16} />
                  Private identifying details
                </h3>
                <p>{r.private_note}</p>
              </div>
            )}
            {own && (
              <>
                <h2>Incoming claims</h2>
                <ClaimList list={claims.filter((c) => c.report === r.id)} />
              </>
            )}
          </article>
          <aside className="panel detail-aside">
            <dl>
              <dt>
                <MapPin size={16} />
                Location
              </dt>
              <dd>{r.location}</dd>
              <dt>
                <Calendar size={16} />
                Date {r.type}
              </dt>
              <dd>{fmt(r.date)}</dd>
              <dt>
                <User size={16} />
                Reported by
              </dt>
              <dd>
                {r.reporter}
                <small>{r.affiliation || 'Community member'}</small>
                {r.verified === 'verified' && <Badge tone="green">Verified member</Badge>}
              </dd>
            </dl>
            <p className="muted">Posted {fmt(r.created)}</p>
            {own ? (
              <div className="stack">
                {r.status === 'open' && (
                  <>
                    <a className="btn primary" href={'/report?edit=' + r.id}>
                      Edit report
                    </a>
                    <button className="btn" onClick={() => setModal({ kind: 'close', report: r })}>
                      Close report
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="stack">
                {r.type === 'found' &&
                  r.status === 'open' &&
                  (already ? (
                    <a href="/my-claims" className="btn primary">
                      View your claim
                    </a>
                  ) : (
                    <button
                      className="btn primary"
                      onClick={() => setModal({ kind: 'claim', report: r })}
                    >
                      <ShieldCheck size={16} />
                      Claim this item
                    </button>
                  ))}
                <button
                  className="btn"
                  disabled={busy}
                  onClick={async () => {
                    const c = await mutate('conversation', { report: r.id });
                    if (c) window.location.href = '/messages/' + c.id;
                  }}
                >
                  <MessageSquare size={16} />
                  Message the {r.type === 'found' ? 'finder' : 'reporter'}
                </button>
              </div>
            )}
            <Safety />
            {!own && (
              <button
                className="btn subtle full"
                onClick={() => setModal({ kind: 'abuse', target_type: 'report', target: r.id })}
              >
                <Flag size={15} />
                Report this listing
              </button>
            )}
          </aside>
        </div>
      </>
    ) : (
      <Empty title="Report not available">
        It may have been removed or you may not have access.
      </Empty>
    );
  } else if (path === '/my-reports') {
    let list = myReports.filter(
      (r) =>
        tab === 'All' ||
        (tab === 'Active' && r.status === 'open') ||
        (tab === 'Completed' && r.status !== 'open') ||
        (tab === 'Awaiting claims' &&
          claims.some((c) => c.report === r.id && ['pending', 'more_info'].includes(c.status))),
    );
    content = (
      <>
        <Heading title="My reports" sub="Everything you have reported, and where it stands.">
          <a className="btn primary" href="/report">
            <PlusCircle size={17} />
            New report
          </a>
        </Heading>
        <div className="tabs">
          {['All', 'Active', 'Awaiting claims', 'Completed'].map((t) => (
            <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {list.length ? (
          <ReportGrid list={list} />
        ) : (
          <Empty title="You haven't reported anything here yet" href="/report">
            Report a lost or found item and it will show up here with its status.
          </Empty>
        )}
      </>
    );
  } else if (path === '/my-claims') {
    content = (
      <>
        <Heading title="My claims" sub="Track ownership claims and coordinate your next steps." />
        <ClaimList list={claims.filter((c) => c.claimant === u.id)} />
      </>
    );
  } else if (path === '/messages' || path.startsWith('/messages/')) {
    content = (
      <>
        <Heading title="Messages" sub="Coordinate privately. Your contact details stay yours." />
        <div className="messenger panel">
          <aside className="conversation-list">
            {data.conversations?.length ? (
              data.conversations.map((c: Row) => (
                <a
                  className={path.endsWith(c.id) ? 'selected' : ''}
                  href={'/messages/' + c.id}
                  key={c.id}
                >
                  <div className="avatar">{c.other_name?.[0]}</div>
                  <div>
                    <strong>{c.other_name}</strong>
                    <p>{c.title}</p>
                    <small>{c.preview || 'Start a conversation'}</small>
                  </div>
                  {c.unread > 0 && <Badge tone="lost">{c.unread}</Badge>}
                </a>
              ))
            ) : (
              <Empty title="No conversations yet">Open an item to contact its reporter.</Empty>
            )}
          </aside>
          <section className="conversation">
            {conversation ? (
              <>
                <div className="chat-header row between">
                  <div>
                    <h3>{conversation.conversation.title}</h3>
                    <small>Private conversation</small>
                  </div>
                  <div className="actions">
                    <button
                      className="btn small"
                      onClick={() =>
                        setModal({
                          kind: 'abuse',
                          target_type: 'user',
                          target:
                            conversation.conversation.owner === u.id
                              ? conversation.conversation.member
                              : conversation.conversation.owner,
                        })
                      }
                    >
                      Report
                    </button>
                    <button
                      className="btn small"
                      onClick={() => {
                        const target =
                          conversation.conversation.owner === u.id
                            ? conversation.conversation.member
                            : conversation.conversation.owner;
                        mutate('block', {
                          target,
                          remove: !!data.blocks?.find((b: Row) => b.target === target),
                        });
                      }}
                    >
                      {data.blocks?.some(
                        (b: Row) =>
                          b.target ===
                          (conversation.conversation.owner === u.id
                            ? conversation.conversation.member
                            : conversation.conversation.owner),
                      )
                        ? 'Unblock'
                        : 'Block'}
                    </button>
                  </div>
                </div>
                <div className="chat-messages">
                  {conversation.messages.length ? (
                    conversation.messages.map((m: Row) => (
                      <div
                        className={
                          m.system
                            ? 'system-message'
                            : 'message ' + (m.sender === u.id ? 'mine' : '')
                        }
                        key={m.id}
                      >
                        {!m.system && <small>{m.sender_name}</small>}
                        <p>{m.body}</p>
                        <time>
                          {new Date(m.created).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    ))
                  ) : (
                    <p className="muted center">
                      Start with a friendly hello. Keep personal contact details private.
                    </p>
                  )}
                </div>
                <form
                  className="message-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const body = new FormData(form).get('body');
                    if (
                      await mutate('message', { conversation: conversation.conversation.id, body })
                    )
                      form.reset();
                  }}
                >
                  <input
                    name="body"
                    required
                    maxLength={3000}
                    placeholder="Write a message…"
                    aria-label="Message"
                  />
                  <button disabled={busy} className="btn primary" aria-label="Send message">
                    <Send size={18} />
                  </button>
                </form>
              </>
            ) : (
              <Empty title="Your conversations, in one place">
                Select a conversation to continue arranging a safe handover.
              </Empty>
            )}
          </section>
        </div>
      </>
    );
  } else if (path === '/notifications') {
    content = (
      <>
        <Heading title="Notifications" sub="Matches, messages and updates from your community.">
          <button
            className="btn"
            disabled={busy || !unread}
            onClick={() => mutate('readNotifications')}
          >
            <Check size={16} />
            Mark all as read
          </button>
        </Heading>
        {data.notifications?.length ? (
          <div className="stack">
            {data.notifications.map((n: Row) => (
              <a
                className={'panel notification ' + (!n.read ? 'unread' : '')}
                href={n.link}
                key={n.id}
              >
                <div className="empty-icon">
                  <Bell size={20} />
                </div>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <small>{fmt(n.created)}</small>
                </div>
                <ChevronRight size={18} />
              </a>
            ))}
          </div>
        ) : (
          <Empty title="You're all caught up">
            New matches, claims and messages will appear here.
          </Empty>
        )}
      </>
    );
  } else if (['/profile', '/onboarding', '/verify'].includes(path)) {
    content = (
      <>
        <Heading
          title={
            path === '/onboarding'
              ? 'Welcome to FoundIt'
              : path === '/verify'
                ? 'Verify your affiliation'
                : 'Your profile'
          }
          sub={
            path === '/verify'
              ? 'Help the community know who they are dealing with.'
              : 'A little about you helps build a trusted campus community.'
          }
        />
        {path !== '/verify' ? (
          <>
            <div className="profile-summary panel">
              <div className="avatar large">{u.name[0]}</div>
              <div>
                <h2>{u.name}</h2>
                <p>{u.affiliation || 'Community member'} · University of Ilorin</p>
                <Badge tone={u.verified === 'verified' ? 'green' : ''}>
                  {titleCase(u.verified)}
                </Badge>
              </div>
              <a className="btn" href="/verify">
                <ShieldCheck size={17} />
                Verify affiliation
              </a>
            </div>
            {ProfileForm()}
            {path === '/onboarding' && <Safety />}
          </>
        ) : (
          <>
            <div className="panel form-panel">
              <div className="row">
                <ShieldCheck size={28} />
                <h2>
                  {u.verified === 'verified'
                    ? 'Your affiliation is verified'
                    : u.verified === 'pending'
                      ? 'Your verification is being reviewed'
                      : 'Confirm your university affiliation'}
                </h2>
              </div>
              <p>
                Your ID image is private. Only you and authorised verification administrators can
                access it.
              </p>
              {!['verified', 'pending'].includes(u.verified) && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await mutate('verification', Object.fromEntries(new FormData(e.currentTarget)));
                  }}
                >
                  <Field label="University ID photograph">
                    <UploadField
                      onError={setError}
                      purpose="verification"
                      name="document"
                      label="Upload your university ID"
                    />
                  </Field>
                  <button className="btn primary" disabled={busy}>
                    Submit for review
                  </button>
                </form>
              )}
            </div>
            {data.verifications?.map((v: Row) => (
              <div className="panel" key={v.id}>
                <Badge>{titleCase(v.status)}</Badge>
                <p>Submitted {fmt(v.created)}</p>
                {v.note && <p>Reviewer note: {v.note}</p>}
              </div>
            ))}
          </>
        )}
      </>
    );
  } else if (path.startsWith('/admin')) {
    const section = path.split('/')[2] || 'overview';
    content = !isAdmin ? (
      <Empty title="Administrator access required">
        Your member account does not have access to this area.
      </Empty>
    ) : (
      <>
        <Heading
          title={section === 'overview' ? 'Administration' : titleCase(section)}
          sub="Keep the community safe, trusted and organised."
        />
        <div className="admin-tabs">
          {adminNav.map(([url, label]) => (
            <a className={path === url ? 'active' : ''} href={url} key={url}>
              {label}
            </a>
          ))}
        </div>
        {section === 'overview' ? (
          <>
            <div className="admin-stats">
              {[
                ['Members', adminData.users?.length, 'users', Users],
                [
                  'Open reports',
                  adminData.reports?.filter((r: Row) => r.status === 'open').length,
                  'reports',
                  Package,
                ],
                [
                  'Pending verifications',
                  adminData.verifications?.filter((v: Row) => v.status === 'pending').length,
                  'verifications',
                  ShieldCheck,
                ],
                [
                  'Open safety reports',
                  adminData.abuse?.filter((a: Row) => a.status === 'open').length,
                  'abuse',
                  Flag,
                ],
              ].map(([label, n, url, Icon]: any) => (
                <a className="panel" key={url} href={'/admin/' + url}>
                  <Icon size={22} />
                  <strong>{n || 0}</strong>
                  <p>{label}</p>
                </a>
              ))}
            </div>
            <div className="panel">
              <h2>Moderation workspace</h2>
              <p>
                Review pending verification and safety reports first. Every administrative decision
                is recorded in the audit log. Role changes require a super-admin.
              </p>
            </div>
          </>
        ) : section === 'claims' ? (
          <ClaimList list={(adminData.claims || []).filter((c: Row) => c.escalated)} />
        ) : section === 'reports' ? (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Reporter</th>
                  <th>Status</th>
                  <th>Visibility</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminData.reports?.map((r: Row) => (
                  <tr key={r.id}>
                    <td>
                      <a href={'/items/' + r.id}>{r.title}</a>
                      <small>
                        {r.type} · {fmt(r.date)}
                      </small>
                    </td>
                    <td>{r.reporter}</td>
                    <td>
                      <Badge>{r.status}</Badge>
                    </td>
                    <td>{r.moderation}</td>
                    <td>
                      <select
                        aria-label={'Visibility for ' + r.title}
                        value={r.moderation}
                        disabled={busy}
                        onChange={(e) =>
                          mutate('admin.moderate', { id: r.id, status: e.target.value })
                        }
                      >
                        {['visible', 'hidden', 'removed'].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!adminData.reports?.length && <Empty title="No reports to moderate" />}
          </div>
        ) : section === 'users' ? (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Affiliation</th>
                  <th>Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                {adminData.users?.map((v: Row) => (
                  <tr key={v.id}>
                    <td>
                      {v.name}
                      <small>{v.verified}</small>
                    </td>
                    <td>{v.affiliation || 'Not set'}</td>
                    <td>
                      {u.role === 'super-admin' && v.id !== u.id && v.role !== 'super-admin' ? (
                        <select
                          aria-label={'Role for ' + v.name}
                          value={v.role}
                          disabled={busy}
                          onChange={(e) =>
                            setModal({ kind: 'role', user: v, role: e.target.value })
                          }
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Badge>{v.role}</Badge>
                      )}
                    </td>
                    <td>
                      {v.id !== u.id && v.role !== 'super-admin' ? (
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() =>
                            mutate('admin.user', { id: v.id, suspended: !v.suspended })
                          }
                        >
                          {v.suspended ? 'Reactivate' : 'Suspend'}
                        </button>
                      ) : (
                        <Badge>Protected</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : section === 'verifications' ? (
          <div className="stack">
            {adminData.verifications?.length ? (
              adminData.verifications.map((v: Row) => (
                <article className="panel" key={v.id}>
                  <div className="row between">
                    <h3>{v.name}</h3>
                    <Badge>{v.status}</Badge>
                  </div>
                  <p>
                    {v.affiliation} · {v.department} · {v.level}
                  </p>
                  <a className="text-link" href={'/api/files/' + v.document} target="_blank">
                    Review private ID image ↗
                  </a>
                  {v.status === 'pending' && (
                    <form
                      className="actions"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const p = Object.fromEntries(new FormData(e.currentTarget));
                        await mutate('admin.verify', { ...p, id: v.id });
                      }}
                    >
                      <input
                        name="note"
                        placeholder="Reviewer note (optional)"
                        aria-label="Reviewer note"
                      />
                      <select name="status" aria-label="Verification decision">
                        <option value="verified">Verify affiliation</option>
                        <option value="rejected">Reject</option>
                      </select>
                      <button disabled={busy} className="btn primary">
                        Save decision
                      </button>
                    </form>
                  )}
                  {v.note && <p>{v.note}</p>}
                </article>
              ))
            ) : (
              <Empty title="No verification requests" />
            )}
          </div>
        ) : section === 'abuse' ? (
          <div className="stack">
            {adminData.abuse?.length ? (
              adminData.abuse.map((a: Row) => (
                <article className="panel" key={a.id}>
                  <div className="row between">
                    <h3>{a.reason}</h3>
                    <Badge>{a.status}</Badge>
                  </div>
                  <p>{a.details}</p>
                  <small>
                    {a.target_type}: {a.target} · {fmt(a.created)}
                  </small>
                  <div className="actions">
                    {a.target_type === 'report' && (
                      <a className="btn" href={'/items/' + a.target}>
                        View listing
                      </a>
                    )}
                    <button
                      className="btn"
                      onClick={() => setModal({ kind: 'transcript', abuse: a })}
                    >
                      Review related conversation
                    </button>
                  </div>
                  {a.status === 'open' && (
                    <form
                      className="actions"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await mutate('admin.abuse', {
                          id: a.id,
                          ...Object.fromEntries(new FormData(e.currentTarget)),
                        });
                      }}
                    >
                      <input
                        required
                        name="note"
                        placeholder="Resolution and action taken"
                        aria-label="Resolution note"
                      />
                      <button disabled={busy} className="btn primary">
                        Resolve report
                      </button>
                    </form>
                  )}
                  {a.note && <p>{a.note}</p>}
                </article>
              ))
            ) : (
              <Empty title="No safety reports">
                Reported concerns will appear here for review.
              </Empty>
            )}
          </div>
        ) : section === 'announcements' ? (
          <>
            <div className="section-head">
              <p>Publish updates for the campus community.</p>
              <button className="btn primary" onClick={() => setModal({ kind: 'announcement' })}>
                <PlusCircle size={17} />
                New announcement
              </button>
            </div>
            {adminData.announcements?.map((a: Row) => (
              <article className="panel" key={a.id}>
                <div className="row between">
                  <h3>{a.title}</h3>
                  {!!a.pinned && <Badge>Pinned</Badge>}
                </div>
                <p>{a.body}</p>
                <small>{a.expires ? 'Expires ' + fmt(a.expires) : 'No expiry'}</small>
                <div className="actions">
                  <button
                    className="btn"
                    onClick={() => setModal({ kind: 'announcement', item: a })}
                  >
                    Edit
                  </button>
                  <button
                    className="btn"
                    onClick={() => setModal({ kind: 'removeAnnouncement', item: a })}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </>
        ) : ['categories', 'locations', 'institutions'].includes(section) ? (
          <>
            <div className="section-head">
              <p>Manage the options available to members.</p>
              <button
                className="btn primary"
                onClick={() =>
                  setModal({
                    kind: 'taxonomy',
                    type:
                      section === 'categories'
                        ? 'category'
                        : section === 'locations'
                          ? 'location'
                          : 'institution',
                  })
                }
              >
                <PlusCircle size={16} />
                Add{' '}
                {section === 'categories'
                  ? 'category'
                  : section === 'locations'
                    ? 'location'
                    : 'institution'}
              </button>
              {section === 'institutions' && (
                <button
                  className="btn"
                  onClick={() => setModal({ kind: 'taxonomy', type: 'department' })}
                >
                  Add department
                </button>
              )}
            </div>
            <div className="panel table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {resolveTaxonomy(adminData.taxonomy || [])
                    .filter((t: Row) =>
                      section === 'categories'
                        ? t.kind === 'category'
                        : section === 'locations'
                          ? t.kind === 'location'
                          : ['institution', 'department'].includes(t.kind),
                    )
                    .map((t: Row) => (
                      <tr key={t.id}>
                        <td>
                          {t.name}
                          <small>{t.parent}</small>
                        </td>
                        <td>{t.kind}</td>
                        <td>{t.active ? 'Active' : 'Inactive'}</td>
                        <td>
                          <button
                            className="btn small"
                            onClick={() => setModal({ kind: 'taxonomy', type: t.kind, item: t })}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : section === 'audit' ? (
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {adminData.audit?.map((a: Row) => (
                  <tr key={a.id}>
                    <td>{new Date(a.created).toLocaleString('en-GB')}</td>
                    <td>{a.actor_name || 'Administrator'}</td>
                    <td>{a.action}</td>
                    <td className="mono">{a.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!adminData.audit?.length && <Empty title="No administrative actions yet" />}
          </div>
        ) : (
          <Empty title="Page not found" />
        )}
      </>
    );
  } else
    content = (
      <Empty title="Page not found" href="/dashboard" label="Go to dashboard">
        Let's get you back to your community.
      </Empty>
    );
  let modalContent: React.ReactNode = null;
  if (modal?.kind === 'claim')
    modalContent = (
      <Modal title="Claim this item" onClose={() => setModal(null)}>
        <p>
          Your answers stay private — only the finder and authorised dispute administrators can read
          them.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await mutate('claim', {
              ...Object.fromEntries(new FormData(e.currentTarget)),
              report: modal.report.id,
            });
            if (result) window.location.href = '/messages/' + result.id;
          }}
        >
          <Field label="Why does this belong to you?">
            <textarea name="reason" required rows={3} maxLength={2000} />
          </Field>
          <Field label="Distinctive features">
            <textarea name="features" required rows={3} maxLength={2000} />
          </Field>
          <Field label="Something only the owner would know" hint="Never shown publicly.">
            <input
              name="answer"
              maxLength={2000}
              placeholder="e.g. the name written inside the cover"
            />
          </Field>
          <Field label="Supporting evidence (optional)">
            <UploadField
              onError={setError}
              purpose="evidence"
              name="evidence"
              label="Attach a photo or receipt"
            />
          </Field>
          <button disabled={busy} className="btn primary full">
            Submit claim
          </button>
        </form>
      </Modal>
    );
  if (modal?.kind === 'abuse')
    modalContent = (
      <Modal title="Report a concern" onClose={() => setModal(null)}>
        <p>Tell the moderation team what happened. Your report is private.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await mutate('abuse', {
                ...Object.fromEntries(new FormData(e.currentTarget)),
                target: modal.target,
                target_type: modal.target_type,
              })
            )
              setModal(null);
          }}
        >
          <Field label="Reason">
            <select name="reason" required>
              <option value="">Select a reason</option>
              {[
                'Suspected fraud',
                'Harassment',
                'Sensitive personal information',
                'Misleading report',
                'Inappropriate content',
                'Other',
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Details">
            <textarea name="details" rows={4} maxLength={3000} />
          </Field>
          <button disabled={busy} className="btn primary">
            Submit report
          </button>
        </form>
      </Modal>
    );
  if (['recover', 'close', 'role', 'removeAnnouncement'].includes(modal?.kind))
    modalContent = (
      <Modal
        title={
          modal?.kind === 'recover'
            ? 'Confirm successful handover'
            : modal?.kind === 'close'
              ? 'Close this report?'
              : modal?.kind === 'role'
                ? 'Change member role?'
                : 'Remove announcement?'
        }
        onClose={() => setModal(null)}
      >
        <p>
          {modal?.kind === 'recover'
            ? 'Confirm that the item has been handed to its verified owner. This completes the claim and closes other pending claims.'
            : modal?.kind === 'close'
              ? 'This report will no longer accept new claims.'
              : modal?.kind === 'role'
                ? `Change ${modal.user.name} to ${modal.role}? This changes their access to administration features.`
                : 'This announcement will be removed from the dashboard.'}
        </p>
        <div className="actions">
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              let r;
              if (modal?.kind === 'recover')
                r = await mutate('claimState', { id: modal.claim.id, status: 'recovered' });
              if (modal?.kind === 'close') r = await mutate('closeReport', { id: modal.report.id });
              if (modal?.kind === 'role')
                r = await mutate('admin.user', { id: modal.user.id, role: modal.role });
              if (modal?.kind === 'removeAnnouncement')
                r = await mutate('admin.announcement', { id: modal.item.id, remove: true });
              if (r) setModal(null);
            }}
          >
            Confirm
          </button>
          <button className="btn" onClick={() => setModal(null)}>
            Cancel
          </button>
        </div>
      </Modal>
    );
  if (modal?.kind === 'announcement')
    modalContent = (
      <Modal
        title={modal.item ? 'Edit announcement' : 'New announcement'}
        onClose={() => setModal(null)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const p = Object.fromEntries(new FormData(e.currentTarget));
            if (
              await mutate('admin.announcement', {
                ...p,
                id: modal.item?.id,
                pinned: p.pinned === 'on',
                expires: p.expires ? new Date(String(p.expires)).toISOString() : '',
              })
            )
              setModal(null);
          }}
        >
          <Field label="Title">
            <input required name="title" maxLength={160} defaultValue={modal.item?.title} />
          </Field>
          <Field label="Message">
            <textarea
              required
              name="body"
              rows={5}
              maxLength={5000}
              defaultValue={modal.item?.body}
            />
          </Field>
          <Field label="Expires (optional)">
            <input
              type="datetime-local"
              name="expires"
              defaultValue={modal.item?.expires?.slice(0, 16)}
            />
          </Field>
          <label className="checkbox">
            <input type="checkbox" name="pinned" defaultChecked={!!modal.item?.pinned} />
            Pin to dashboard
          </label>
          <button className="btn primary" disabled={busy}>
            Publish announcement
          </button>
        </form>
      </Modal>
    );
  if (modal?.kind === 'taxonomy')
    modalContent = (
      <Modal title={(modal.item ? 'Edit ' : 'Add ') + modal.type} onClose={() => setModal(null)}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const p = Object.fromEntries(new FormData(e.currentTarget));
            if (
              await mutate('admin.taxonomy', {
                ...p,
                id: modal.item?.id,
                kind: modal.type,
                active: p.active === 'on',
              })
            )
              setModal(null);
          }}
        >
          <Field label="Name">
            <input name="name" required maxLength={150} defaultValue={modal.item?.name} />
          </Field>
          {modal.type === 'department' && (
            <Field label="Institution / faculty">
              <input name="parent" defaultValue={modal.item?.parent || 'University of Ilorin'} />
            </Field>
          )}
          <label className="checkbox">
            <input
              type="checkbox"
              name="active"
              defaultChecked={modal.item ? !!modal.item.active : true}
            />
            Active
          </label>
          <button className="btn primary" disabled={busy}>
            Save
          </button>
        </form>
      </Modal>
    );
  if (modal?.kind === 'transcript')
    modalContent = (
      <Modal title="Audited conversation review" onClose={() => setModal(null)}>
        <p>Access must relate to this safety report and will be recorded in the audit log.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await mutate('admin.transcript', {
              id: modal.abuse.id,
              ...Object.fromEntries(new FormData(e.currentTarget)),
            });
            if (r) setModal({ ...modal, messages: r.messages });
          }}
        >
          {modal.abuse.target_type !== 'message' && (
            <Field label="Related conversation ID">
              <input required name="conversation" />
            </Field>
          )}
          <button disabled={busy} className="btn primary">
            Open transcript
          </button>
        </form>
        {modal.messages?.map((m: Row) => (
          <div className="panel" key={m.id}>
            <small>{fmt(m.created)}</small>
            <p>{m.body}</p>
          </div>
        ))}
      </Modal>
    );
  return (
    <>
      {publicPage || !u ? (
        content
      ) : (
        <div className="app-shell">
          <button
            className="mobile-menu icon-btn"
            aria-label="Open navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          {menu && <div className="sidebar-backdrop" onClick={() => setMenu(false)} />}
          <aside className={'sidebar ' + (menu ? 'open' : '')}>
            <Logo />
            <p className="campus-label">University of Ilorin</p>
            <nav>
              {nav.map(([href, label, Icon]) => (
                <a
                  key={href}
                  href={href}
                  className={
                    path === href || (href === '/messages' && path.startsWith('/messages/'))
                      ? 'active'
                      : ''
                  }
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {label === 'Notifications' && unread > 0 && <b className="nav-count">{unread}</b>}
                  {label === 'Messages' && messageUnread > 0 && (
                    <b className="nav-count">{messageUnread}</b>
                  )}
                </a>
              ))}
              {isAdmin && (
                <a className={path.startsWith('/admin') ? 'active' : ''} href="/admin">
                  <Settings size={19} />
                  Administration
                </a>
              )}
            </nav>
            <div className="sidebar-user">
              <div className="avatar">{u.name[0]}</div>
              <div>
                <strong>{u.name}</strong>
                <small>{titleCase(u.role)}</small>
              </div>
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={async () => {
                  const { error } = await supabaseBrowser().auth.signOut();
                  if (error) setError(error.message);
                  else window.location.assign('/');
                }}
              >
                <LogOut size={18} />
              </button>
            </div>
          </aside>
          <main className="workspace">
            {content}
            <div className="app-footer">
              <span>FoundIt · University of Ilorin</span>
              <a href="/legal/privacy">Privacy</a>
              <a href="/legal/guidelines">Safety guidelines</a>
            </div>
          </main>
        </div>
      )}
      {modalContent}
      {error && (
        <div className="alert error" role="alert">
          <Flag size={18} />
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            <X size={17} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={19} />
          {toast}
        </div>
      )}
    </>
  );
}
