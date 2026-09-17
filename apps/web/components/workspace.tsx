'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  FlaskConical,
  FolderOpen,
  LayoutDashboard,
  Leaf,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  borrowers,
  declineEvaluation,
  download,
  evaluation,
  money,
  planDescription,
  presets,
  restoreDecisions,
  restoreScenarios,
  shortDate,
  sourceLinks,
  type Decision,
  type Plan,
  type ScenarioDraft,
  type View,
} from '../lib/demo';
import { CashChart, DominoArt, Sparkline } from './charts';
const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'borrowers', label: 'Borrowers', icon: Users },
  { id: 'comparison', label: 'Plan comparison', icon: SlidersHorizontal },
  { id: 'scenarios', label: 'Scenario lab', icon: FlaskConical },
  { id: 'decisions', label: 'Decisions', icon: ClipboardCheck },
  { id: 'evidence', label: 'Evidence library', icon: Database },
] as const;
function Badge({ children, tone = 'green' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <FolderOpen size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function SourceNote({ children }: { children?: ReactNode }) {
  return (
    <div className="source-note">
      <ShieldCheck size={14} />
      <span>
        {children || 'Synthetic demonstration data. Saved v1 results, not a live lending decision.'}
      </span>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement),
  );
  useEffect(() => {
    const dialog = ref.current;
    const previous = opener.current;
    dialog?.showModal();
    const initial = dialog?.querySelector<HTMLElement>(
      'input:not([type="file"]), textarea, button',
    );
    const textInput = dialog?.querySelector<HTMLElement>('input:not([type="file"]), textarea');
    (textInput || initial)?.focus();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const nodes = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
          ),
        ).filter((node) => node.offsetParent !== null);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function Workspace() {
  const [view, setView] = useState<View>('overview');
  const [person, setPerson] = useState('farmer');
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All borrowers');
  const [modal, setModal] = useState<
    'help' | 'import' | 'search' | 'activity' | 'selection' | null
  >(null);
  const [toast, setToast] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('seasonal');
  const [ledger, setLedger] = useState(false);
  const [decisionPlan, setDecisionPlan] = useState<Plan | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [scenario, setScenario] = useState<ScenarioDraft>({ ...presets[0] });
  const [drafts, setDrafts] = useState<ScenarioDraft[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<string[][]>([]);
  const [importError, setImportError] = useState('');
  const [fileName, setFileName] = useState('');
  useEffect(() => {
    const restore = () => {
      const hash = window.location.hash.slice(1);
      const [route, id] = hash.split('/');
      const allowed = [
        'overview',
        'borrowers',
        'borrower',
        'comparison',
        'scenarios',
        'evidence',
        'decisions',
      ];
      if (allowed.includes(route)) {
        setView(route as View);
        if (route === 'comparison') setPerson(id === 'tailor' ? 'tailor' : 'farmer');
        else if (route === 'borrower')
          setPerson(borrowers.some((b) => b.id === id) ? id : 'farmer');
      }
    };
    restore();
    window.addEventListener('hashchange', restore);
    try {
      const d = JSON.parse(localStorage.getItem('domino-decisions') || '[]');
      setDecisions(restoreDecisions(d));
      const s = JSON.parse(localStorage.getItem('domino-scenarios') || '[]');
      setDrafts(restoreScenarios(s));
    } catch {}
    return () => window.removeEventListener('hashchange', restore);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setModal('search');
      }
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  const go = (next: View, id?: string) => {
    setView(next);
    setMenu(false);
    if (id) setPerson(id);
    window.location.hash =
      next === 'comparison'
        ? `comparison/${id === 'tailor' ? 'tailor' : id === 'farmer' ? 'farmer' : person === 'tailor' ? 'tailor' : 'farmer'}`
        : id
          ? `${next}/${id}`
          : next;
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const persist = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      setToast('Browser storage is unavailable. Your draft remains in this session.');
      return false;
    }
  };
  const current = borrowers.find((b) => b.id === person) || borrowers[0];
  const currentEvaluation = person === 'tailor' ? declineEvaluation : evaluation;
  const filtered = borrowers.filter(
    (b) =>
      `${b.name} ${b.occupation} ${b.place}`.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'All borrowers' || b.pattern === filter),
  );
  const exportLedger = (plan: Plan) => {
    const keys = [
      'week',
      'date',
      'incomePaise',
      'essentialsPaidPaise',
      'repaymentPaidPaise',
      'closingCashPaise',
      'outstandingPrincipalPaise',
      'outstandingInterestPaise',
    ] as const;
    download(
      `domino-${plan.id}-saved-ledger.csv`,
      [keys.join(','), ...plan.ledger.map((r) => keys.map((k) => r[k]).join(','))].join('\n'),
      'text/csv',
    );
    setToast('Saved example ledger exported. All monetary values are in paise.');
  };
  const openSelection = (plan: Plan) => {
    setDecisionPlan(plan);
    setModal('selection');
  };
  const saveDecision = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const d: Decision = {
      id: crypto.randomUUID(),
      borrowerId: 'farmer',
      borrower: 'Rani Devi',
      planId: decisionPlan!.id,
      plan: decisionPlan!.name,
      reason: String(data.get('reason')).trim(),
      consent: String(data.get('consent')).trim(),
      state: 'Draft',
      createdAt: new Date().toISOString(),
    };
    if (d.reason.length < 12) {
      setToast('Add a review reason with at least 12 characters.');
      return;
    }
    const next = [d, ...decisions];
    setDecisions(next);
    const stored = persist('domino-decisions', next);
    setModal(null);
    go('decisions');
    if (stored) setToast('Decision draft saved in this browser.');
  };
  const readFile = async (file?: File) => {
    setImportError('');
    setImportPreview([]);
    if (!file) return;
    setFileName(file.name);
    if (file.size > 65536) {
      setImportError('Use a CSV smaller than 64 KB for the local preview.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Choose a .csv file.');
      return;
    }
    const lines = (await file.text())
      .trim()
      .split(/\r?\n/)
      .map((s) => s.split(',').map((v) => v.trim()));
    if (lines[0]?.join(',') !== 'date,income_inr,essentials_inr') {
      setImportError('Expected columns: date,income_inr,essentials_inr');
      return;
    }
    if (
      lines.length < 2 ||
      lines
        .slice(1)
        .some(
          (r) =>
            r.length !== 3 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(r[0]) ||
            !Number.isFinite(Date.parse(r[0])) ||
            new Date(r[0]).toISOString().slice(0, 10) !== r[0] ||
            r.slice(1).some((v) => v === '' || !Number.isFinite(Number(v))),
        )
    ) {
      setImportError(
        'Every row needs a date and numeric income and essentials. This simple preview does not accept quoted CSV cells.',
      );
      return;
    }
    setImportPreview(lines.slice(1));
  };
  function BorrowerRows({ compact = false }: { compact?: boolean }) {
    const rows = compact ? borrowers : filtered;
    return rows.length ? (
      <div className="table-scroll">
        <table className="borrower-table">
          <thead>
            <tr>
              <th scope="col">Borrower</th>
              <th scope="col">Income pattern</th>
              <th scope="col">Loan principal</th>
              <th scope="col">Review status</th>
              <th scope="col">
                <span className="sr-only">Open borrower</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>
                  <button className="person-button" onClick={() => go('borrower', b.id)}>
                    <span className={`avatar ${b.color}`}>{b.initials}</span>
                    <span>
                      <strong>{b.name}</strong>
                      <small>{b.occupation}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <div className="pattern-cell">
                    <Sparkline
                      type={
                        b.id === 'farmer' ? 'seasonal' : b.id === 'vendor' ? 'irregular' : 'decline'
                      }
                    />
                    <span>{b.pattern}</span>
                  </div>
                </td>
                <td className="tabular">₹24,000</td>
                <td>
                  <Badge
                    tone={b.id === 'farmer' ? 'green' : b.id === 'vendor' ? 'neutral' : 'amber'}
                  >
                    {b.status}
                  </Badge>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${b.name}`}
                    onClick={() => go('borrower', b.id)}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty title="No borrowers found">Try another name or clear the income-pattern filter.</Empty>
    );
  }
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside id="workspace-sidebar" className={`sidebar ${menu ? 'open' : ''}`}>
        <button className="brand" onClick={() => go('overview')} aria-label="DOMINO overview">
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            domino<span className="brand-period">.</span>
          </span>
        </button>
        <button className="workspace-switch" onClick={() => setModal('help')}>
          <span className="workspace-icon">N</span>
          <span>
            <strong>NueraRangers</strong>
            <small>Lending workspace</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'comparison') setPerson('farmer');
                go(item.id);
              }}
              className={`nav-item ${view === item.id || (view === 'borrower' && item.id === 'borrowers') ? 'active' : ''}`}
              aria-current={
                view === item.id || (view === 'borrower' && item.id === 'borrowers')
                  ? 'page'
                  : undefined
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === 'borrowers' && <span className="nav-count">3</span>}
              {item.id === 'decisions' && decisions.length > 0 && (
                <span className="nav-count">{decisions.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="purpose-card">
            <span className="purpose-icon">
              <Sprout size={22} />
            </span>
            <h3>Room to move forward.</h3>
            <p>
              Better timing for repayments.
              <br />
              More breathing room for people.
            </p>
            <button onClick={() => setModal('help')}>
              The DOMINO approach <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="support-button" onClick={() => setModal('help')}>
            <CircleHelp size={17} />
            Workspace guide
            <ArrowUpRight size={14} />
          </button>
          <div className="user-profile">
            <span className="avatar user-avatar">SS</span>
            <span>
              <strong>Shrit Shrivastava</strong>
              <small>Demo loan officer</small>
            </span>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menu}
              aria-controls="workspace-sidebar"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>
              {view === 'borrower'
                ? 'Borrower profile'
                : navigation.find((n) => n.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              onClick={() => {
                setQuery('');
                setModal('search');
              }}
            >
              <Search size={16} />
              <span>Find a borrower</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="demo-label">
              <i />
              Demo workspace
            </span>
            <button
              className="icon-button notification"
              aria-label="View activity"
              onClick={() => setModal('activity')}
            >
              <Bell size={18} />
              <i />
            </button>
            <span className="avatar top-avatar">SS</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {view === 'overview' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A LITTLE PERSPECTIVE. A BETTER DECISION.</div>
                  <h1>
                    Good morning, Shrit<span className="heading-dot">.</span>
                  </h1>
                  <p>Every cash flow tells a story. Let’s find the right next step.</p>
                </div>
                <span className="date-chip">
                  <Clock3 size={14} />
                  17 September 2026
                </span>
              </div>
              <section className="welcome-card">
                <div className="welcome-content">
                  <span className="mini-label">
                    <span className="tiny-sun" /> PEOPLE BEFORE PAYMENT DATES
                  </span>
                  <h2>
                    Life isn’t fixed.
                    <br />
                    Repayments shouldn’t be either.
                  </h2>
                  <p>
                    Understand the rhythm of someone’s income.
                    <br className="desktop-br" /> Build a plan that gives them room to breathe.
                  </p>
                  <button className="button primary" onClick={() => go('borrower', 'farmer')}>
                    Explore a borrower <ArrowRight size={16} />
                  </button>
                </div>
                <DominoArt />
              </section>
              <div className="stat-grid">
                <div className="stat-card">
                  <span className="stat-icon mint">
                    <Users size={19} />
                  </span>
                  <p>Demonstration borrowers</p>
                  <div>
                    <strong>03</strong>
                    <span className="stat-context">3 different income stories</span>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon beige">
                    <Wallet size={19} />
                  </span>
                  <p>Total example principal</p>
                  <div>
                    <strong>₹72,000</strong>
                    <span className="stat-context">Across three synthetic loans</span>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon lilac">
                    <SlidersHorizontal size={19} />
                  </span>
                  <p>Ways to find a better fit</p>
                  <div>
                    <strong>04</strong>
                    <span className="stat-context">Transparent baseline schedules</span>
                  </div>
                </div>
              </div>
              <div className="overview-grid">
                <section className="panel cash-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">THE DIFFERENCE TIMING MAKES</span>
                      <h2>A little more breathing room</h2>
                    </div>
                    <span className="subtle-chip">Rani Devi · 26 weeks</span>
                  </div>
                  <div className="chart-kpi">
                    <strong>₹2,850</strong>
                    <span>
                      lowest cash balance with seasonal surplus
                      <br />
                      <span className="muted">Saved example, baseline scenario</span>
                    </span>
                  </div>
                  <CashChart comparison compact />
                  <SourceNote />
                </section>
                <section className="panel attention-panel">
                  <div className="panel-heading">
                    <h2>Your next steps</h2>
                    <span className="small-count">3</span>
                  </div>
                  <button className="next-step" onClick={() => go('borrower', 'farmer')}>
                    <span className="step-icon mint">
                      <FileCheck2 size={19} />
                    </span>
                    <span>
                      <strong>A plan worth reviewing</strong>
                      <small>Rani’s seasonal surplus schedule</small>
                      <span className="step-link">
                        Review the saved result <ArrowRight size={13} />
                      </span>
                    </span>
                  </button>
                  <button className="next-step" onClick={() => go('borrower', 'tailor')}>
                    <span className="step-icon peach">
                      <Activity size={19} />
                    </span>
                    <span>
                      <strong>Look a little closer</strong>
                      <small>Asha’s income needs attention</small>
                      <span className="step-link">
                        Understand the pattern <ArrowRight size={13} />
                      </span>
                    </span>
                  </button>
                  <button className="next-step" onClick={() => go('scenarios')}>
                    <span className="step-icon lilac">
                      <FlaskConical size={19} />
                    </span>
                    <span>
                      <strong>Prepare for the unexpected</strong>
                      <small>A late harvest or higher expenses</small>
                      <span className="step-link">
                        Explore scenario assumptions <ArrowRight size={13} />
                      </span>
                    </span>
                  </button>
                  <div className="attention-footer">
                    <Leaf size={14} />
                    Thoughtful decisions start with context.
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>People in your workspace</h2>
                    <p>Different livelihoods. A more personal approach.</p>
                  </div>
                  <button className="text-button" onClick={() => go('borrowers')}>
                    All borrowers <ArrowRight size={15} />
                  </button>
                </div>
                <BorrowerRows compact />
              </section>
            </>
          )}
          {view === 'borrowers' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">UNDERSTAND THE PERSON BEHIND THE PLAN</div>
                  <h1>
                    Your borrowers<span className="heading-dot">.</span>
                  </h1>
                  <p>Three livelihoods. Three different rhythms of income.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    setImportPreview([]);
                    setFileName('');
                    setImportError('');
                    setModal('import');
                  }}
                >
                  <Plus size={16} />
                  Preview an import
                </button>
              </div>
              <div className="quiet-banner">
                <ShieldCheck size={19} />
                <span>
                  <strong>A safe space to explore.</strong> These profiles are synthetic. No
                  personal borrower information is connected.
                </span>
              </div>
              <section className="panel">
                <div className="table-toolbar">
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search borrowers…"
                      aria-label="Search borrowers"
                    />
                  </label>
                  <div className="filter-control">
                    <SlidersHorizontal size={16} />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      aria-label="Filter by income pattern"
                    >
                      {['All borrowers', 'Seasonal', 'Irregular', 'Income decline'].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <BorrowerRows />
                <div className="table-footer">
                  Showing {filtered.length} of 3 demonstration borrowers{' '}
                  <span>INR · Synthetic data</span>
                </div>
              </section>
              <div className="three-columns">
                {borrowers.map((b) => (
                  <article className="story-card" key={b.id}>
                    <Sparkline
                      type={
                        b.id === 'farmer' ? 'seasonal' : b.id === 'vendor' ? 'irregular' : 'decline'
                      }
                    />
                    <h3>{b.pattern} income</h3>
                    <p>{b.description}</p>
                    <button className="text-button" onClick={() => go('borrower', b.id)}>
                      Meet {b.name.split(' ')[0]} <ArrowRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
          {view === 'borrower' && (
            <>
              <button className="back-link" onClick={() => go('borrowers')}>
                <ArrowLeft size={15} />
                All borrowers
              </button>
              <div className="page-heading profile-heading">
                <div className="profile-title">
                  <span className={`avatar profile-avatar ${current.color}`}>
                    {current.initials}
                  </span>
                  <div>
                    <div className="eyebrow">BORROWER PROFILE · SYNTHETIC</div>
                    <h1>{current.name}</h1>
                    <p>
                      {current.occupation} <span className="separator">·</span> {current.place}{' '}
                      <span className="muted">(illustrative)</span>
                    </p>
                  </div>
                </div>
                <Badge
                  tone={person === 'tailor' ? 'amber' : person === 'vendor' ? 'neutral' : 'green'}
                >
                  {current.status}
                </Badge>
              </div>
              <div className="profile-stats">
                <div>
                  <span>Outstanding principal</span>
                  <strong>₹24,000</strong>
                </div>
                <div>
                  <span>Annual interest rate</span>
                  <strong>
                    18<span className="unit">%</span>
                  </strong>
                </div>
                <div>
                  <span>Repayment horizon</span>
                  <strong>
                    26 <span className="unit">weeks</span>
                  </strong>
                </div>
                <div>
                  <span>Opening cash</span>
                  <strong>₹6,000</strong>
                </div>
                <div>
                  <span>History in fixture</span>
                  <strong>
                    104 <span className="unit">weeks</span>
                  </strong>
                </div>
              </div>
              {person === 'vendor' ? (
                <section className="panel">
                  <Empty title="An irregular income story">
                    Meera’s profile is ready to explore. No saved evaluation is available for this
                    fixture. Use the scenario lab to prepare assumptions for a future evaluation.
                  </Empty>
                  <div className="center-action">
                    <button className="button primary" onClick={() => go('scenarios')}>
                      Prepare scenario assumptions <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
              ) : (
                <>
                  <div className="detail-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">
                            {person === 'farmer'
                              ? 'LOOK BACK BEFORE LOOKING AHEAD'
                              : 'A CHANGE THAT DESERVES ATTENTION'}
                          </span>
                          <h2>
                            {person === 'farmer'
                              ? 'Income has a rhythm'
                              : 'A sustained decline in income'}
                          </h2>
                          <p>
                            {person === 'farmer'
                              ? 'The last 26 weeks of a two-year synthetic history.'
                              : 'Saved assessment of the most recent income pattern.'}
                          </p>
                        </div>
                        <span className="subtle-chip">Weekly · INR</span>
                      </div>
                      {person === 'farmer' ? (
                        <CashChart history />
                      ) : (
                        <div className="decline-insight">
                          <Sparkline type="decline" />
                          <strong>0.377×</strong>
                          <p>Recent income relative to the same 13 weeks last year.</p>
                          <div className="warning-note">
                            The saved evaluation finds no feasible plan. A new date alone may not
                            solve a persistent resource shortfall.
                          </div>
                        </div>
                      )}
                      <SourceNote />
                    </section>
                    <section className="insight-panel">
                      <span className="insight-icon">
                        <Sprout size={26} />
                      </span>
                      <span className="eyebrow">WHAT THE PATTERN TELLS US</span>
                      <h2>
                        {person === 'farmer'
                          ? 'Timing matters more than a fixed date.'
                          : 'Start with a conversation.'}
                      </h2>
                      <p>{currentEvaluation.assessment.summary}</p>
                      <div className="insight-rule" />
                      <span className="label">EVIDENCE, NOT A CREDIT SCORE</span>
                      <p className="small">
                        {person === 'farmer'
                          ? 'Two repeating harvest cycles across 104 weeks of generated history. This is a deterministic assessment, not a default prediction.'
                          : 'The cause of the decline is unknown. Review the household’s situation before considering another schedule.'}
                      </p>
                    </section>
                  </div>
                  <section
                    className={`recommendation-strip ${person === 'tailor' ? 'warning' : ''}`}
                  >
                    <span className="recommendation-icon">
                      {person === 'farmer' ? <CheckCheck size={23} /> : <Activity size={23} />}
                    </span>
                    <div>
                      <span className="eyebrow">SAVED BASELINE RESULT</span>
                      <h3>
                        {person === 'farmer'
                          ? 'Seasonal surplus gives this example room to breathe.'
                          : 'No feasible plan in the saved example.'}
                      </h3>
                      <p>
                        {person === 'farmer'
                          ? 'Zero stress weeks, no remaining debt, and a ₹2,850 minimum cash balance.'
                          : 'All four schedules leave constraint violations. Escalate for human review.'}
                      </p>
                    </div>
                    <button className="button primary" onClick={() => go('comparison', person)}>
                      Compare all plans <ArrowRight size={16} />
                    </button>
                  </section>
                </>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <h2>A clear record of the assumptions</h2>
                  <FileText size={18} />
                </div>
                <div className="assumption-grid">
                  <div>
                    <span>Source category</span>
                    <strong>Synthetic demonstration fixture</strong>
                  </div>
                  <div>
                    <span>Interest convention</span>
                    <strong>Simple weekly · APR / 52</strong>
                  </div>
                  <div>
                    <span>Protected cash buffer</span>
                    <strong>₹1,500 in the saved scenario</strong>
                  </div>
                  <div>
                    <span>Payment priority</span>
                    <strong>Essentials, interest, principal</strong>
                  </div>
                  <div>
                    <span>Loan start</span>
                    <strong>14 September 2026</strong>
                  </div>
                  <div>
                    <span>Evidence limitation</span>
                    <strong>No real-world outcomes observed</strong>
                  </div>
                </div>
              </section>
            </>
          )}
          {view === 'comparison' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">ONE BORROWER. FOUR PERSPECTIVES.</div>
                  <h1>
                    Find the right fit<span className="heading-dot">.</span>
                  </h1>
                  <p>Compare the tradeoffs. Keep the person at the center.</p>
                </div>
                <select
                  className="borrower-select"
                  aria-label="Comparison borrower"
                  value={person === 'tailor' ? 'tailor' : 'farmer'}
                  onChange={(e) => {
                    setPerson(e.target.value);
                    setLedger(false);
                    window.location.hash = `comparison/${e.target.value}`;
                  }}
                >
                  <option value="farmer">Rani Devi · Seasonal</option>
                  <option value="tailor">Asha Rao · Income decline</option>
                </select>
              </div>
              <div className="comparison-context">
                <span>
                  <span className={`avatar small ${person === 'tailor' ? 'orange' : 'green'}`}>
                    {person === 'tailor' ? 'AR' : 'RD'}
                  </span>
                  <strong>{person === 'tailor' ? 'Asha Rao' : 'Rani Devi'}</strong>
                </span>
                <span>₹24,000 principal</span>
                <span>18% APR</span>
                <span>26 weeks</span>
                <Badge tone="neutral">Saved baseline · v0.1.0</Badge>
              </div>
              {person === 'tailor' && (
                <div className="warning-note">
                  <strong>No feasible candidate.</strong> Every saved plan has stress weeks or
                  remaining debt. These plans cannot be selected.
                </div>
              )}
              <div className="plan-grid">
                {currentEvaluation.plans.map((p, i) => {
                  const feasible =
                    p.metrics.stressWeeks === 0 && p.metrics.remainingDebtPaise === 0;
                  return (
                    <article key={p.id} className={`plan-card ${feasible ? 'recommended' : ''}`}>
                      <div className="plan-topline">
                        <span className="plan-number">0{i + 1}</span>
                        {feasible ? (
                          <span className="recommended-label">
                            <Check size={12} />
                            Saved recommendation
                          </span>
                        ) : (
                          <span className="not-feasible">{p.metrics.stressWeeks} stress weeks</span>
                        )}
                      </div>
                      <h2>{p.name}</h2>
                      <p className="plan-description">{planDescription[p.id]}</p>
                      <div className="plan-interest">
                        <span>Total interest paid</span>
                        <strong>{money(p.metrics.interestPaidPaise, true)}</strong>
                      </div>
                      <div
                        className="mini-schedule"
                        role="img"
                        aria-label="Relative scheduled principal by week"
                      >
                        {p.schedule.map((r) => (
                          <i
                            key={r.week}
                            style={{
                              height: `${Math.max(4, (r.principalDuePaise / 300000) * 38)}px`,
                            }}
                          />
                        ))}
                      </div>
                      <dl>
                        <div>
                          <dt>Minimum cash</dt>
                          <dd>{money(p.metrics.minimumClosingCashPaise)}</dd>
                        </div>
                        <div>
                          <dt>Unpaid essentials</dt>
                          <dd className={p.metrics.unpaidEssentialsPaise ? 'warning-text' : ''}>
                            {money(p.metrics.unpaidEssentialsPaise)}
                          </dd>
                        </div>
                        <div>
                          <dt>Remaining debt</dt>
                          <dd>{money(p.metrics.remainingDebtPaise, true)}</dd>
                        </div>
                        <div>
                          <dt>Stress weeks</dt>
                          <dd className={p.metrics.stressWeeks ? 'warning-text' : 'green-text'}>
                            {p.metrics.stressWeeks} of 26
                          </dd>
                        </div>
                      </dl>
                      <button
                        className={`button ${feasible ? 'primary' : 'secondary'}`}
                        onClick={() => {
                          setSelectedPlan(p.id);
                          setLedger(true);
                        }}
                      >
                        {feasible ? 'Explore this plan' : 'Inspect ledger'}
                        <ArrowRight size={15} />
                      </button>
                      {feasible && (
                        <button className="text-button save-plan" onClick={() => openSelection(p)}>
                          Create decision draft <Plus size={14} />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      {person === 'tailor'
                        ? 'Why the result needs human review'
                        : 'What a different schedule changes'}
                    </h2>
                    <p>
                      {person === 'tailor'
                        ? 'A lower installment cannot guarantee enough resources for both essentials and debt.'
                        : 'Weekly closing cash, after actual essential and loan payments.'}
                    </p>
                  </div>
                  {person !== 'tailor' && <Badge>Buffer protected in saved result</Badge>}
                </div>
                {person !== 'tailor' ? (
                  <CashChart comparison />
                ) : (
                  <div className="assumption-grid">
                    <div>
                      <span>Recommendation</span>
                      <strong>None of four candidates</strong>
                    </div>
                    <div>
                      <span>Required next step</span>
                      <strong>Review underlying resources</strong>
                    </div>
                    <div>
                      <span>Model limitation</span>
                      <strong>Cause of decline not established</strong>
                    </div>
                  </div>
                )}
                <SourceNote>
                  Saved contract v1 example. No new calculation was run. Additional required
                  scenarios have not been evaluated here.
                </SourceNote>
              </section>
              {ledger && (
                <section className="panel ledger-panel" aria-label="Saved plan ledger">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">EVERY RUPEE HAS A PLACE</span>
                      <h2>
                        {currentEvaluation.plans.find((p) => p.id === selectedPlan)?.name}: weekly
                        ledger
                      </h2>
                      <p>Showing all 26 weeks. Monetary amounts displayed in INR.</p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() =>
                        exportLedger(currentEvaluation.plans.find((p) => p.id === selectedPlan)!)
                      }
                    >
                      <ArrowDownToLine size={15} />
                      Export CSV
                    </button>
                  </div>
                  <div className="table-scroll ledger-scroll">
                    <table>
                      <thead>
                        <tr>
                          {[
                            'Week',
                            'Date',
                            'Income',
                            'Essentials paid',
                            'Loan payment',
                            'Closing cash',
                            'Remaining principal',
                          ].map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentEvaluation.plans
                          .find((p) => p.id === selectedPlan)!
                          .ledger.map((r) => (
                            <tr key={r.week}>
                              <td>{r.week}</td>
                              <td>{shortDate(r.date)}</td>
                              <td>{money(r.incomePaise, true)}</td>
                              <td>{money(r.essentialsPaidPaise, true)}</td>
                              <td>{money(r.repaymentPaidPaise, true)}</td>
                              <td className={r.closingCashPaise < 150000 ? 'warning-text' : ''}>
                                {money(r.closingCashPaise, true)}
                              </td>
                              <td>{money(r.outstandingPrincipalPaise, true)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              <div className="quiet-banner">
                <BookOpen size={20} />
                <span>
                  <strong>Affordable comes before cheaper.</strong> The saved selector first
                  requires zero debt and zero stress weeks, then compares interest among feasible
                  plans.
                </span>
              </div>
            </>
          )}
          {view === 'scenarios' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">MAKE ROOM FOR THE UNEXPECTED</div>
                  <h1>
                    A plan for “what if”<span className="heading-dot">.</span>
                  </h1>
                  <p>Make assumptions visible before asking a plan to hold up.</p>
                </div>
                <span className="subtle-chip">
                  <FlaskConical size={15} />
                  Scenario preparation
                </span>
              </div>
              <div className="scenario-layout">
                <section className="panel scenario-controls">
                  <div className="panel-heading">
                    <div>
                      <h2>Start with a possibility</h2>
                      <p>Choose a preset, then make it your own.</p>
                    </div>
                  </div>
                  <div className="scenario-presets">
                    {presets.map((p, i) => (
                      <button
                        key={p.id}
                        className={scenario.id === p.id ? 'selected' : ''}
                        onClick={() => setScenario({ ...p })}
                      >
                        <span className="preset-number">0{i + 1}</span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.kind} scenario</small>
                        </span>
                        {scenario.id === p.id ? <Check size={17} /> : <ChevronRight size={17} />}
                      </button>
                    ))}
                  </div>
                  <div className="slider-fields">
                    {[
                      {
                        key: 'delay',
                        title: 'Income arrives late',
                        unit: 'weeks',
                        max: 8,
                        step: 1,
                      },
                      { key: 'reduction', title: 'Income reduction', unit: '%', max: 100, step: 5 },
                      {
                        key: 'expenses',
                        title: 'Essential expenses rise',
                        unit: '%',
                        max: 50,
                        step: 5,
                      },
                      {
                        key: 'buffer',
                        title: 'Protected cash buffer',
                        unit: 'INR',
                        max: 6000,
                        step: 100,
                      },
                    ].map((f) => (
                      <label className="slider-field" key={f.key}>
                        <span>
                          {f.title}
                          <strong>
                            {f.key === 'buffer'
                              ? `₹${scenario.buffer.toLocaleString('en-IN')}`
                              : `${scenario[f.key as 'delay' | 'reduction' | 'expenses']} ${f.unit}`}
                          </strong>
                        </span>
                        <input
                          type="range"
                          aria-label={f.title}
                          min={0}
                          max={f.max}
                          step={f.step}
                          value={scenario[f.key as 'delay' | 'reduction' | 'expenses' | 'buffer']}
                          onChange={(e) =>
                            setScenario({
                              ...scenario,
                              id: 'custom',
                              name: 'Custom assumptions',
                              [f.key]: Number(e.target.value),
                            })
                          }
                        />
                        <span className="slider-limits">
                          <small>0 {f.unit}</small>
                          <small>
                            {f.max.toLocaleString('en-IN')} {f.unit}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="button primary full-width"
                    onClick={() => {
                      const next = [{ ...scenario, id: crypto.randomUUID() }, ...drafts];
                      setDrafts(next);
                      if (persist('domino-scenarios', next))
                        setToast('Scenario draft saved. Evaluation has not been run.');
                    }}
                  >
                    <Plus size={15} />
                    Save scenario draft
                  </button>
                </section>
                <div className="scenario-right">
                  <section className="scenario-story">
                    <span className="mini-label">
                      <Sprout size={15} /> ASSUMPTIONS WITH CONTEXT
                    </span>
                    <h2>
                      {scenario.reduction === 100
                        ? 'What if income stops?'
                        : scenario.delay > 0
                          ? 'What if the harvest comes late?'
                          : scenario.expenses > 0
                            ? 'What if life costs a little more?'
                            : 'Start with what we know.'}
                    </h2>
                    <p>
                      {scenario.reduction === 100
                        ? 'A severe income interruption helps expose a plan’s limits. It belongs in a diagnostic set unless lender policy makes it required.'
                        : scenario.delay > 0
                          ? 'A timing gap and a resource shortage are different problems. A delayed receipt should stay visible, even when it falls beyond the loan horizon.'
                          : scenario.expenses > 0
                            ? 'Household essentials come first. A useful plan needs to account for both higher bills and money arriving below expectations.'
                            : 'A baseline is a point of comparison. It is not a guarantee that the next six months will follow the past.'}
                    </p>
                    <div className="scenario-illustration" aria-hidden="true">
                      <div />
                      <div />
                      <div className="delayed" />
                      <div />
                      <div />
                      <div className="delayed" />
                      <div />
                      <div />
                      <span>INCOME HAS ITS OWN RHYTHM</span>
                    </div>
                    <Badge tone={scenario.kind === 'Diagnostic' ? 'amber' : 'green'}>
                      {scenario.kind} scenario
                    </Badge>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Your assumptions, in plain language</h2>
                    </div>
                    <div className="assumption-summary">
                      <p>
                        <Clock3 size={17} />
                        Move receipts <strong>{scenario.delay} weeks later.</strong>
                      </p>
                      <p>
                        <Wallet size={17} />
                        Reduce income by <strong>{scenario.reduction}%.</strong>
                      </p>
                      <p>
                        <Activity size={17} />
                        Increase essential spending by <strong>{scenario.expenses}%.</strong>
                      </p>
                      <p>
                        <ShieldCheck size={17} />
                        Preserve a cash buffer of{' '}
                        <strong>₹{scenario.buffer.toLocaleString('en-IN')}.</strong>
                      </p>
                    </div>
                    <SourceNote>
                      Draft only. Saving assumptions does not run the engine or establish
                      feasibility.
                    </SourceNote>
                  </section>
                </div>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Prepared scenarios</h2>
                    <p>Stored locally in this browser, ready for a future evaluation.</p>
                  </div>
                  {drafts.length > 0 && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        download(
                          'domino-scenario-drafts.json',
                          JSON.stringify(
                            { type: 'unevaluated-scenario-drafts', scenarios: drafts },
                            null,
                            2,
                          ),
                          'application/json',
                        )
                      }
                    >
                      <ArrowDownToLine size={15} />
                      Export drafts
                    </button>
                  )}
                </div>
                {drafts.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Scenario</th>
                          <th>Income delay</th>
                          <th>Income reduction</th>
                          <th>Expense increase</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drafts.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <strong>{d.name}</strong>
                              <small className="cell-small">{d.kind}</small>
                            </td>
                            <td>{d.delay} weeks</td>
                            <td>{d.reduction}%</td>
                            <td>{d.expenses}%</td>
                            <td>
                              <Badge tone="neutral">Not evaluated</Badge>
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`Remove ${d.name} draft`}
                                onClick={() => {
                                  const next = drafts.filter((s) => s.id !== d.id);
                                  setDrafts(next);
                                  persist('domino-scenarios', next);
                                }}
                              >
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title="A little preparation goes a long way">
                    Save a scenario above to start a clear, reviewable set of assumptions.
                  </Empty>
                )}
              </section>
            </>
          )}
          {view === 'evidence' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">GOOD DECISIONS HAVE ROOTS</div>
                  <h1>
                    Evidence you can follow<span className="heading-dot">.</span>
                  </h1>
                  <p>Know where a number comes from, and what it can actually tell you.</p>
                </div>
                <a
                  className="button secondary"
                  href="https://github.com/Shrit1401/tt_mitblr/blob/main/docs/research-experiments.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpen size={16} />
                  Research notes
                  <ArrowUpRight size={14} />
                </a>
              </div>
              <div className="evidence-hero">
                <div>
                  <span className="mini-label">
                    <Database size={15} /> THE INDIA FINANCIAL DIARIES
                  </span>
                  <h2>
                    Real context.
                    <br />
                    Careful interpretation.
                  </h2>
                  <p>
                    A historical view of household cash flow in Varanasi.
                    <br />
                    Useful for understanding variation, not predicting default.
                  </p>
                  <span className="evidence-period">February to June 2013 · FinMark Trust</span>
                </div>
                <div className="evidence-numbers">
                  <div>
                    <strong>86</strong>
                    <span>households in the source</span>
                  </div>
                  <div>
                    <strong>356</strong>
                    <span>paired household-months</span>
                  </div>
                  <div>
                    <strong>
                      43.82<span>%</span>
                    </strong>
                    <span>months with income below expenses</span>
                  </div>
                </div>
              </div>
              <div className="quiet-banner">
                <ShieldCheck size={20} />
                <span>
                  <strong>Context is not a borrower record.</strong> Public averages and historical
                  diary observations stay separate from the synthetic weekly demonstration.
                </span>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>The source registry</h2>
                    <p>Four sources. Clear boundaries. Traceable claims.</p>
                  </div>
                  <span className="subtle-chip">Evidence reviewed · 17 Sep 2026</span>
                </div>
                <div className="source-list">
                  {sourceLinks.map((s) => (
                    <div className={`source-row ${source === s.id ? 'expanded' : ''}`} key={s.id}>
                      <button
                        onClick={() => setSource(source === s.id ? null : s.id)}
                        aria-expanded={source === s.id}
                      >
                        <span
                          className={`source-icon ${s.type === 'Synthetic' ? 'mint' : s.type === 'Research' ? 'lilac' : 'beige'}`}
                        >
                          <samp>
                            {s.type === 'Synthetic'
                              ? 'D'
                              : s.type === 'Research'
                                ? 'F'
                                : s.id === 'nabard'
                                  ? 'N'
                                  : 'S'}
                          </samp>
                        </span>
                        <span className="source-name">
                          <strong>{s.name}</strong>
                          <small>
                            {s.publisher} · {s.period}
                          </small>
                        </span>
                        <Badge tone={s.type === 'Synthetic' ? 'green' : 'neutral'}>{s.type}</Badge>
                        <ChevronDown size={17} />
                      </button>
                      {source === s.id && (
                        <div className="source-details">
                          <p>{s.detail}</p>
                          <a href={s.href} target="_blank" rel="noreferrer">
                            Open source <ArrowUpRight size={14} />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
              <div className="three-columns">
                <div className="principle-card">
                  <span>01</span>
                  <h3>Keep missing data missing.</h3>
                  <p>
                    356 paired months out of 365 household-month rows. Unknown values are never
                    silently replaced by zero.
                  </p>
                </div>
                <div className="principle-card">
                  <span>02</span>
                  <h3>Keep the original frequency.</h3>
                  <p>
                    Monthly diary totals do not become observed weekly cash flow. Five months do not
                    establish annual seasonality.
                  </p>
                </div>
                <div className="principle-card">
                  <span>03</span>
                  <h3>Keep claims proportional.</h3>
                  <p>
                    156 income-expense gaps are not defaults, unmet essentials, or people helped by
                    DOMINO.
                  </p>
                </div>
              </div>
            </>
          )}
          {view === 'decisions' && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">THOUGHTFUL CHOICES. A CLEAR RECORD.</div>
                  <h1>
                    Every decision, explained<span className="heading-dot">.</span>
                  </h1>
                  <p>A place to keep the reasoning, not just the repayment date.</p>
                </div>
                <button
                  className="button primary"
                  onClick={() => {
                    setPerson('farmer');
                    go('comparison', 'farmer');
                  }}
                >
                  <Plus size={16} />
                  Create a decision
                </button>
              </div>
              <div className="decision-workflow">
                {['Compare plans', 'Create a draft', 'Review reasoning', 'Approve externally'].map(
                  (s, i) => (
                    <div key={s}>
                      <span className={i < 3 ? '' : 'muted-step'}>{i + 1}</span>
                      <strong>{s}</strong>
                      {i < 3 && <ChevronRight size={16} />}
                    </div>
                  ),
                )}
              </div>
              <div className="quiet-banner">
                <ShieldCheck size={20} />
                <span>
                  <strong>Your reasoning stays reviewable.</strong> These are local demonstration
                  drafts. Approval and live schedule activation are not connected.
                </span>
              </div>
              {decisions.length ? (
                <div className="decision-list">
                  {decisions.map((d) => (
                    <section className="panel decision-card" key={d.id}>
                      <div className="panel-heading">
                        <div className="decision-person">
                          <span className="avatar green">RD</span>
                          <div>
                            <h2>{d.borrower}</h2>
                            <p>{d.plan} · Saved baseline example</p>
                          </div>
                        </div>
                        <Badge tone={d.state === 'Reviewed' ? 'green' : 'neutral'}>{d.state}</Badge>
                      </div>
                      <div className="decision-reason">
                        <span className="eyebrow">REVIEWER’S REASONING</span>
                        <p>{d.reason}</p>
                        <small>
                          Consent reference: {d.consent || 'Not recorded'} ·{' '}
                          {new Date(d.createdAt).toLocaleDateString('en-GB')}
                        </small>
                      </div>
                      <div className="decision-actions">
                        <button
                          className="button secondary"
                          onClick={() =>
                            download(
                              `domino-decision-${d.id.slice(0, 8)}.json`,
                              JSON.stringify(
                                {
                                  ...d,
                                  mode: 'demonstration-only',
                                  evaluationVersion: '0.1.0',
                                  activated: false,
                                },
                                null,
                                2,
                              ),
                              'application/json',
                            )
                          }
                        >
                          <ArrowDownToLine size={15} />
                          Export record
                        </button>
                        {d.state === 'Draft' && (
                          <button
                            className="button primary"
                            onClick={() => {
                              const next = decisions.map((x) =>
                                x.id === d.id ? { ...x, state: 'Reviewed' as const } : x,
                              );
                              setDecisions(next);
                              if (persist('domino-decisions', next))
                                setToast('Draft marked reviewed. No live schedule was changed.');
                            }}
                          >
                            <CheckCheck size={16} />
                            Mark reviewed
                          </button>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty title="The next step starts with understanding">
                    Explore Rani’s saved seasonal plan and create your first decision draft.
                  </Empty>
                  <div className="center-action">
                    <button
                      className="button primary"
                      onClick={() => {
                        setPerson('farmer');
                        go('comparison', 'farmer');
                      }}
                    >
                      Explore the plan comparison <ArrowRight size={15} />
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="main-footer">
            <span className="footer-brand">
              <span className="mini-mark">◧</span> domino.
            </span>
            <p>Better timing. More possibility.</p>
            <span>
              Made with care by NueraRangers <span className="footer-dot">·</span> Prototype v1.0
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal === 'help' && (
        <Modal title="A little context for your workspace" onClose={() => setModal(null)}>
          <div className="guide-intro">
            <Sprout size={30} />
            <h3>Room to move forward.</h3>
            <p>
              DOMINO helps a loan officer understand cash flow, compare repayment schedules, and
              record a thoughtful decision.
            </p>
          </div>
          <ol className="guide-steps">
            <li>
              <strong>Understand a borrower.</strong>
              <span>Look at income patterns, loan terms, and the source of each observation.</span>
            </li>
            <li>
              <strong>Compare the tradeoffs.</strong>
              <span>Inspect four saved schedules and their weekly ledgers.</span>
            </li>
            <li>
              <strong>Make assumptions explicit.</strong>
              <span>Prepare scenario drafts, then document your reasoning.</span>
            </li>
          </ol>
          <div className="warning-note">
            This frontend uses synthetic profiles and previously saved results. Backend evaluations
            and approvals are not connected or tested.
          </div>
          <button className="button primary full-width" onClick={() => setModal(null)}>
            Back to the workspace <ArrowRight size={15} />
          </button>
        </Modal>
      )}
      {modal === 'search' && (
        <Modal title="Find a borrower" onClose={() => setModal(null)}>
          <label className="search-field modal-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, livelihood, or location"
              aria-label="Find a borrower"
            />
          </label>
          <div className="search-results">
            {borrowers
              .filter((b) =>
                `${b.name} ${b.occupation} ${b.place}`.toLowerCase().includes(query.toLowerCase()),
              )
              .map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setModal(null);
                    go('borrower', b.id);
                  }}
                >
                  <span className={`avatar ${b.color}`}>{b.initials}</span>
                  <span>
                    <strong>{b.name}</strong>
                    <small>{b.occupation}</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              ))}
            {!borrowers.some((b) =>
              `${b.name} ${b.occupation} ${b.place}`.toLowerCase().includes(query.toLowerCase()),
            ) && <Empty title="No matching borrowers">Try a different name or livelihood.</Empty>}
          </div>
        </Modal>
      )}
      {modal === 'activity' && (
        <Modal title="Workspace activity" onClose={() => setModal(null)}>
          <div className="activity-list">
            <div>
              <span className="step-icon mint">
                <FileCheck2 size={19} />
              </span>
              <p>
                <strong>Saved examples available</strong>
                <span>Rani and Asha have archived v1 evaluation results.</span>
                <small>Demonstration evidence</small>
              </p>
            </div>
            <div>
              <span className="step-icon lilac">
                <Database size={19} />
              </span>
              <p>
                <strong>Four sources documented</strong>
                <span>Open the evidence library to follow each claim.</span>
                <small>17 September 2026</small>
              </p>
            </div>
            <div>
              <span className="step-icon beige">
                <ClipboardCheck size={19} />
              </span>
              <p>
                <strong>
                  {decisions.length} local decision {decisions.length === 1 ? 'draft' : 'drafts'}
                </strong>
                <span>Your browser stores the decisions you create.</span>
                <small>Current browser session and storage</small>
              </p>
            </div>
          </div>
        </Modal>
      )}
      {modal === 'selection' && (
        <Modal title="Give this decision a little context" onClose={() => setModal(null)}>
          <div className="selection-summary">
            <span className="avatar green">RD</span>
            <div>
              <strong>Rani Devi</strong>
              <p>{decisionPlan?.name} · Saved example</p>
            </div>
            <Badge>Draft</Badge>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveDecision(e.currentTarget);
            }}
          >
            <label className="form-label">
              Why does this plan fit?
              <textarea
                required
                minLength={12}
                maxLength={2000}
                name="reason"
                placeholder="Explain the income pattern, the tradeoffs, and what needs further review…"
                rows={4}
              />
            </label>
            <label className="form-label">
              Consent reference <span className="muted">(optional for a demo draft)</span>
              <input name="consent" maxLength={100} placeholder="e.g. DEMO-CONSENT-001" />
            </label>
            <div className="warning-note">
              A draft is not an approval. The saved baseline does not demonstrate feasibility under
              additional stress scenarios.
            </div>
            <button className="button primary full-width" type="submit">
              <FileCheck2 size={16} />
              Save decision draft
            </button>
          </form>
        </Modal>
      )}
      {modal === 'import' && (
        <Modal title="Preview a cash-flow file" onClose={() => setModal(null)}>
          <p className="modal-description">
            Explore a CSV locally. Your file stays in this browser and is not uploaded or imported
            into the backend.
          </p>
          <button
            className="text-button"
            onClick={() =>
              download(
                'domino-example.csv',
                'date,income_inr,essentials_inr\n2026-09-01,2400,1000\n2026-09-08,3200,1000\n',
                'text/csv',
              )
            }
          >
            <ArrowDownToLine size={15} />
            Download a sample CSV
          </button>
          <label className="upload-zone">
            <ArrowDownToLine size={27} />
            <strong>{fileName || 'Choose a CSV to preview'}</strong>
            <span>date, income_inr, essentials_inr · up to 64 KB</span>
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label="Choose CSV file"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
          </label>
          {importError && (
            <p role="alert" className="warning-note">
              {importError}
            </p>
          )}
          {importPreview.length > 0 && (
            <>
              <Badge>{importPreview.length} rows ready to preview</Badge>
              <div className="table-scroll import-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Income (INR)</th>
                      <th>Essentials (INR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        {r.map((v, j) => (
                          <td key={j}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SourceNote>
                Local preview only. No reconciliation or backend validation has been run.
              </SourceNote>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
