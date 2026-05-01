// Main GitMetro app — Entry → Loading → Map flow.

(function () {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // ─── THEMES ────────────────────────────────────────────────────────────────
  const THEMES = {
    'gitmetro-dark': {
      key: 'gitmetro-dark',
      label: 'GitMetro Dark',
      app: '#0b0d10',
      panel: '#11141a',
      panelAlt: '#161a21',
      border: '#222732',
      canvas: '#0a0c10',
      grid: 'radial-gradient(circle at 1px 1px, #1a1f29 1px, transparent 0)',
      guide: '#252b36',
      text: '#e6e8ec',
      textMuted: '#8a92a3',
      labelText: '#0a0c10',
      tagBg: '#1f2530',
      tagText: '#e6e8ec',
      lineWidth: 3.5,
      colors: {
        main: '#ff5b5b', hotfix: '#ff9f43', develop: '#f3d54e',
        feature: '#3ddbd9', release: '#4aa3ff'
      }
    },
    'london-tube': {
      key: 'london-tube',
      label: 'London Tube',
      app: '#0e1116',
      panel: '#141821',
      panelAlt: '#191e28',
      border: '#272d3a',
      canvas: '#f3eedf',
      grid: 'radial-gradient(circle at 1px 1px, #d8d2c1 1px, transparent 0)',
      guide: '#cfc7b1',
      text: '#e6e8ec',
      textMuted: '#8a92a3',
      labelText: '#f3eedf',
      tagBg: '#1f2530',
      tagText: '#f3eedf',
      lineWidth: 4.5,
      colors: {
        main: '#dc241f', hotfix: '#f3a52b', develop: '#a1a5a8',
        feature: '#0019a8', release: '#003688'
      }
    },
    'cyberpunk': {
      key: 'cyberpunk',
      label: 'Cyberpunk',
      app: '#08060f',
      panel: '#0e0a1c',
      panelAlt: '#140e26',
      border: '#2a1d49',
      canvas: '#06050b',
      grid: 'radial-gradient(circle at 1px 1px, #2a1d49 1px, transparent 0)',
      guide: '#221540',
      text: '#f0e9ff',
      textMuted: '#8b7eb8',
      labelText: '#06050b',
      tagBg: '#1a0f33',
      tagText: '#f0e9ff',
      lineWidth: 3.5,
      colors: {
        main: '#ff3df0', hotfix: '#ffb000', develop: '#c8ff5e',
        feature: '#00f0ff', release: '#7a5cff'
      }
    },
    'skill-tree': {
      key: 'skill-tree',
      label: 'Skill Tree',
      app: '#0a0d0c',
      panel: '#10151a',
      panelAlt: '#161d24',
      border: '#22303a',
      canvas: '#0a1014',
      grid: 'radial-gradient(circle at 1px 1px, #1a2832 1px, transparent 0)',
      guide: '#1f2b35',
      text: '#e8f0ee',
      textMuted: '#8aa1a6',
      labelText: '#0a1014',
      tagBg: '#152028',
      tagText: '#e8f0ee',
      lineWidth: 4,
      colors: {
        main: '#ffd166', hotfix: '#ef476f', develop: '#06d6a0',
        feature: '#8ecae6', release: '#bb9bff'
      }
    }
  };

  // remap branch.color through current theme
  function applyTheme(data, themeKey) {
    const t = THEMES[themeKey];
    const map = {
      main: t.colors.main, hotfix: t.colors.hotfix, develop: t.colors.develop,
      feature: t.colors.feature, release: t.colors.release, other: t.colors.feature
    };
    return {
      ...data,
      branches: data.branches.map((b) => ({ ...b, color: map[b.category] || map.feature }))
    };
  }

  // ─── ROOT APP ──────────────────────────────────────────────────────────────
  function App() {
    const initialScreen = typeof window !== 'undefined' && window.location.hash === '#map' ? 'map' :
    typeof window !== 'undefined' && window.location.hash === '#loading' ? 'loading' :
    'entry';
    const [screen, setScreen] = useState(initialScreen); // 'entry' | 'loading' | 'map'
    const [repoInput, setRepoInput] = useState('lumen-labs/lumen-pay');

    // Tweaks
    const [tweaks, setTweak] = window.useTweaks(/*EDITMODE-BEGIN*/{
      "orientation": "horizontal",
      "theme": "gitmetro-dark",
      "nodeStyle": "ring"
    } /*EDITMODE-END*/);

    const theme = THEMES[tweaks.theme] || THEMES['gitmetro-dark'];
    const data = useMemo(() => applyTheme(window.GITMETRO_DATA, tweaks.theme), [tweaks.theme]);

    // Map state
    const [visibleBranches, setVisibleBranches] = useState(
      new Set(data.branches.map((b) => b.id))
    );
    const [selectedSha, setSelectedSha] = useState('m3ef0a3'); // pre-select an interesting merge
    const [hover, setHover] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // CSS variables live on root
    useEffect(() => {
      const root = document.documentElement;
      root.style.setProperty('--app', theme.app);
      root.style.setProperty('--panel', theme.panel);
      root.style.setProperty('--panel-alt', theme.panelAlt);
      root.style.setProperty('--border', theme.border);
      root.style.setProperty('--text', theme.text);
      root.style.setProperty('--muted', theme.textMuted);
    }, [theme]);

    // Flow handlers
    const handleVisualize = () => {
      setScreen('loading');
      setTimeout(() => setScreen('map'), 3400); // synced with terminal animation
    };
    const handleReset = () => {
      setScreen('entry');
      setPan({ x: 0, y: 0 });setZoom(1);
    };

    return (
      <div className="app" style={{ background: theme.app, color: theme.text }}>
        {screen === 'entry' && <EntryScreen theme={theme} repoInput={repoInput} setRepoInput={setRepoInput} onVisualize={handleVisualize} />}
        {screen === 'loading' && <LoadingScreen theme={theme} repoInput={repoInput} />}
        {screen === 'map' &&
        <MapScreen
          theme={theme} data={data}
          tweaks={tweaks} setTweak={setTweak}
          visibleBranches={visibleBranches} setVisibleBranches={setVisibleBranches}
          selectedSha={selectedSha} setSelectedSha={setSelectedSha}
          hover={hover} setHover={setHover}
          zoom={zoom} setZoom={setZoom}
          pan={pan} setPan={setPan}
          onReset={handleReset} />

        }

        {/* Tweaks panel — visible when host activates edit mode */}
        <TweaksPanel themes={THEMES} tweaks={tweaks} setTweak={setTweak} />
      </div>);

  }

  // ─── ENTRY ─────────────────────────────────────────────────────────────────
  function EntryScreen({ theme, repoInput, setRepoInput, onVisualize }) {
    return (
      <div className="entry entry-minimal">
        <div className="entry-minimal-card">
          <Logo theme={theme} />
          <h1 className="hero-title minimal">GitMetro</h1>
          <p className="hero-sub minimal">
            Turn any GitHub repository into a readable metro map.
          </p>

          <form
            className="entry-form"
            onSubmit={(e) => { e.preventDefault(); onVisualize(); }}>
            <div className="entry-input">
              <span className="entry-prefix">github.com/</span>
              <input
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="facebook/react"
                spellCheck={false}
                autoFocus />
              <button type="submit" className="btn primary">
                Visualize
              </button>
            </div>

            <button type="button" className="btn ghost full">
              <GhIcon /> Sign in with GitHub
            </button>
          </form>
        </div>
      </div>);
  }

  function EntryHint({ theme }) {
    const c = theme.colors;
    return (
      <svg className="entry-hint" viewBox="0 0 1440 220" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={theme.app} stopOpacity="0" />
            <stop offset="100%" stopColor={theme.app} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* main */}
        <path d="M0 60 L1440 60" stroke={c.main} strokeWidth="4" />
        {/* hotfix */}
        <path d="M260 60 L260 100 Q260 110 270 110 L520 110 Q530 110 530 120 L530 60" stroke={c.hotfix} strokeWidth="3" fill="none" />
        {/* develop */}
        <path d="M340 60 L340 150 L1180 150 L1180 60" stroke={c.develop} strokeWidth="3" fill="none" />
        {/* feature */}
        <path d="M460 150 L460 190 L920 190 L920 150" stroke={c.feature} strokeWidth="3" fill="none" />
        {/* nodes */}
        {[100, 260, 340, 530, 720, 1180, 1380].map((x) =>
        <circle key={x} cx={x} cy={60} r="5" fill={theme.app} stroke={c.main} strokeWidth="2" />
        )}
        <rect width="1440" height="220" fill="url(#fade)" />
      </svg>);

  }

  function Logo({ theme }) {
    return (
      <div className="logo">
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="9" fill="none" stroke={theme.colors.main} strokeWidth="2.5" />
          <line x1="2" y1="11" x2="20" y2="11" stroke={theme.colors.feature} strokeWidth="2.5" />
          <circle cx="6" cy="11" r="2" fill={theme.colors.develop} />
          <circle cx="16" cy="11" r="2" fill={theme.colors.hotfix} />
        </svg>
        <span className="logo-text">GitMetro</span>
      </div>);

  }

  // ─── LOADING ───────────────────────────────────────────────────────────────
  function LoadingScreen({ theme, repoInput }) {
    const STEPS = [
    { label: `Parsing repository URL...`, detail: `→ resolved ${repoInput}` },
    { label: `Fetching branches...`, detail: `→ 23 branches discovered` },
    { label: `Reading commit graph...`, detail: `→ 1,284 commits · 14 contributors` },
    { label: `Detecting merge stations...`, detail: `→ 47 merge points identified` },
    { label: `Allocating branch lanes...`, detail: `→ trunk + 5 visible lanes` },
    { label: `Building metro layout...`, detail: `→ rectilinear routing complete` }];

    const [step, setStep] = useState(0);
    const [tick, setTick] = useState(0);

    useEffect(() => {
      const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length)), 480);
      return () => clearInterval(id);
    }, []);
    useEffect(() => {
      const id = setInterval(() => setTick((t) => t + 1), 400);
      return () => clearInterval(id);
    }, []);

    const pct = Math.min(100, Math.round(step / STEPS.length * 100));

    return (
      <div className="loading">
        <div className="terminal" style={{ background: theme.panel, borderColor: theme.border }}>
          <div className="terminal-bar" style={{ borderColor: theme.border }}>
            <span className="tdot r" /><span className="tdot y" /><span className="tdot g" />
            <span className="terminal-title">gitmetro@core — analysis</span>
            <span className="terminal-meta">PID 4831 · {pct}%</span>
          </div>
          <div className="terminal-body">
            <Line dim>$ gitmetro analyze {repoInput}</Line>
            {STEPS.slice(0, step).map((s, i) =>
            <React.Fragment key={i}>
                <Line>
                  <span className="ok">✓</span> {s.label}
                </Line>
                <Line dim>{'  '}{s.detail}</Line>
              </React.Fragment>
            )}
            {step < STEPS.length &&
            <Line>
                <span className="spin">{['◐', '◓', '◑', '◒'][tick % 4]}</span> {STEPS[step].label}
              </Line>
            }
            {step >= STEPS.length &&
            <>
                <Line><span className="ok">✓</span> Done in 2.71s.</Line>
                <Line><span className="cursor">▍</span></Line>
              </>
            }
          </div>
          <div className="terminal-progress">
            <div className="bar" style={{ width: `${pct}%`, background: theme.colors.main }} />
          </div>
        </div>
      </div>);

  }

  function Line({ children, dim }) {
    return <div className={`tline${dim ? ' dim' : ''}`}>{children}</div>;
  }

  // ─── MAP ───────────────────────────────────────────────────────────────────
  function MapScreen({
    theme, data, tweaks, setTweak,
    visibleBranches, setVisibleBranches,
    selectedSha, setSelectedSha,
    hover, setHover,
    zoom, setZoom, pan, setPan,
    onReset
  }) {
    const onHoverCommit = (c, p, e) => {
      const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
      setHover({ c, x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const onClearHover = () => setHover(null);
    const selected = data.commits.find((c) => c.sha === selectedSha) || data.commits[data.commits.length - 1];

    const toggleBranch = (id) => {
      const next = new Set(visibleBranches);
      if (next.has(id)) next.delete(id);else next.add(id);
      setVisibleBranches(next);
    };

    return (
      <div className="map-screen">
        <Toolbar theme={theme} data={data} tweaks={tweaks} setTweak={setTweak} onReset={onReset}
        zoom={zoom} setZoom={setZoom} setPan={setPan} />
        <div className="map-body">
          <FilterPanel theme={theme} data={data}
          visibleBranches={visibleBranches} toggleBranch={toggleBranch} />
          <div className="map-canvas-wrap" onMouseLeave={onClearHover}>
            <window.MetroMap
              data={data}
              orientation={tweaks.orientation}
              nodeStyle={tweaks.nodeStyle}
              theme={theme}
              visibleBranches={visibleBranches}
              selectedSha={selectedSha}
              onSelectCommit={(c) => setSelectedSha(c.sha)}
              onHoverCommit={onHoverCommit}
              onClearHover={onClearHover}
              zoom={zoom} setZoom={setZoom}
              pan={pan} setPan={setPan} />
            
            {hover && <Tooltip hover={hover} theme={theme} />}
            <ZoomControls zoom={zoom} setZoom={setZoom} setPan={setPan} />
            <Legend theme={theme} />
          </div>
          <Inspector theme={theme} commit={selected} data={data} setSelectedSha={setSelectedSha} />
        </div>
      </div>);

  }

  // Toolbar
  function Toolbar({ theme, data, tweaks, setTweak, onReset, zoom, setZoom, setPan }) {
    return (
      <div className="toolbar" style={{ borderColor: theme.border, background: theme.panel }}>
        <div className="tb-left">
          <button className="btn ghost iconbtn" onClick={onReset} title="New repo">
            <Logo theme={theme} />
          </button>
          <div className="repo-crumb">
            <span className="muted">{data.repo.owner}</span>
            <span className="muted slash">/</span>
            <span className="strong">{data.repo.name}</span>
            <span className="branch-pill" style={{ borderColor: theme.border }}>
              <BranchIcon /> {data.repo.defaultBranch}
            </span>
          </div>
          <span className="muted small dotsep">·</span>
          <span className="muted small">{data.repo.commitsTotal.toLocaleString()} commits</span>
          <span className="muted small dotsep">·</span>
          <span className="muted small">last sync {data.repo.lastSync}</span>
        </div>

        <div className="tb-right">
          <Segmented
            value={tweaks.orientation}
            onChange={(v) => setTweak('orientation', v)}
            options={[
            { value: 'horizontal', label: 'Horizontal', icon: <HorizIcon /> },
            { value: 'vertical', label: 'Vertical', icon: <VertIcon /> }]
            } />
          
          <Select
            value={tweaks.theme}
            onChange={(v) => setTweak('theme', v)}
            options={[
            { value: 'gitmetro-dark', label: 'GitMetro Dark' },
            { value: 'london-tube', label: 'London Tube' },
            { value: 'cyberpunk', label: 'Cyberpunk' },
            { value: 'skill-tree', label: 'Skill Tree' }]
            } />
          
          <button className="btn ghost">
            <ExportIcon /> Export
          </button>
          <button className="btn ghost">
            <GhIcon /> Open on GitHub
          </button>
        </div>
      </div>);

  }

  function Segmented({ value, onChange, options }) {
    return (
      <div className="segmented">
        {options.map((o) =>
        <button key={o.value}
        className={`seg ${value === o.value ? 'active' : ''}`}
        onClick={() => onChange(o.value)} title={o.label}>
            {o.icon}<span>{o.label}</span>
          </button>
        )}
      </div>);

  }

  function Select({ value, onChange, options }) {
    return (
      <div className="select">
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronIcon />
      </div>);

  }

  // Filter panel (left)
  function FilterPanel({ theme, data, visibleBranches, toggleBranch }) {
    const grouped = useMemo(() => {
      const g = { main: [], develop: [], feature: [], hotfix: [], release: [], other: [] };
      data.branches.forEach((b) => g[b.category].push(b));
      return g;
    }, [data.branches]);

    return (
      <aside className="filter-panel" style={{ borderColor: theme.border, background: theme.panel }}>
        <div className="panel-section">
          <div className="panel-title">Branches</div>
          <div className="search">
            <SearchIcon />
            <input placeholder="Filter branches…" />
          </div>
        </div>

        {['main', 'develop', 'feature', 'hotfix', 'release'].map((cat) =>
        <div key={cat} className="panel-section">
            <div className="panel-subtitle">
              <span>{labelFor(cat)}</span>
              <span className="muted small">{grouped[cat].length}</span>
            </div>
            {grouped[cat].map((b) => {
            const on = visibleBranches.has(b.id);
            return (
              <button key={b.id}
              className={`branch-row ${on ? '' : 'off'}`}
              onClick={() => toggleBranch(b.id)}>
                  <span className="branch-swatch" style={{ background: b.color }} />
                  <span className="branch-name">{b.name}</span>
                  <span className={`branch-toggle ${on ? 'on' : ''}`}>
                    {on ? <EyeIcon /> : <EyeOffIcon />}
                  </span>
                </button>);

          })}
          </div>
        )}

        <div className="panel-section">
          <div className="panel-subtitle"><span>Timeline</span></div>
          <div className="timeline">
            <div className="timeline-track">
              <div className="timeline-fill" style={{ background: theme.colors.main }}></div>
              <div className="timeline-handle left"></div>
              <div className="timeline-handle right"></div>
            </div>
            <div className="timeline-labels">
              <span className="muted small">Feb 4</span>
              <span className="muted small">Apr 10</span>
            </div>
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-subtitle"><span>Display</span></div>
          <div className="check-row">
            <input type="checkbox" defaultChecked id="cb1" />
            <label htmlFor="cb1">Show commit labels</label>
          </div>
          <div className="check-row">
            <input type="checkbox" defaultChecked id="cb2" />
            <label htmlFor="cb2">Show tags</label>
          </div>
          <div className="check-row">
            <input type="checkbox" id="cb3" />
            <label htmlFor="cb3">Cluster commits &gt; 500</label>
          </div>
        </div>
      </aside>);

  }

  function labelFor(cat) {
    return {
      main: 'Main', develop: 'Develop', feature: 'Feature',
      hotfix: 'Hotfix', release: 'Release', other: 'Other'
    }[cat];
  }

  // Inspector (right)
  function Inspector({ theme, commit, data, setSelectedSha }) {
    const branch = data.branches.find((b) => b.id === commit.branch);
    const parents = commit.parents.map((p) => data.commits.find((c) => c.sha === p)).filter(Boolean);
    return (
      <aside className="inspector" style={{ borderColor: theme.border, background: theme.panel }}>
        <div className="ins-header">
          <div className="muted small">Selected commit</div>
          <div className="ins-action">
            <button className="iconbtn-sm" title="Copy SHA"><CopyIcon /></button>
            <button className="iconbtn-sm" title="Open on GitHub"><LinkIcon /></button>
          </div>
        </div>

        <div className="ins-sha-row">
          <span className="sha-pill" style={{ background: theme.panelAlt }}>
            <span className="sha-dot" style={{ background: branch.color }} />
            <code>{commit.shortSha}</code>
          </span>
          {commit.isMerge && <span className="tag-pill merge">merge</span>}
          {commit.isHead && <span className="tag-pill head">HEAD</span>}
          {commit.tag && <span className="tag-pill tag">{commit.tag}</span>}
        </div>

        <p className="ins-message">{commit.message}</p>

        <div className="ins-meta">
          <div className="ins-author">
            <div className="avatar" style={{ background: branch.color }}>{commit.avatar}</div>
            <div>
              <div className="strong small">{commit.author}</div>
              <div className="muted small">{commit.date}</div>
            </div>
          </div>
        </div>

        <Divider theme={theme} />

        <div className="ins-stats">
          <Stat label="Branch" value={branch.name} swatch={branch.color} />
          <Stat label="Files" value={commit.files} />
          <Stat label="Parents" value={parents.length} />
          {commit.pr && <Stat label="PR" value={commit.pr} />}
        </div>

        <Divider theme={theme} />

        <div className="ins-section">
          <div className="ins-subtitle">Parents</div>
          {parents.map((p) =>
          <button key={p.sha} className="parent-row"
          onClick={() => setSelectedSha(p.sha)}>
              <span className="sha-dot" style={{
              background: data.branches.find((b) => b.id === p.branch).color
            }} />
              <code className="muted">{p.shortSha}</code>
              <span className="parent-msg">{p.message}</span>
            </button>
          )}
        </div>

        <div className="ins-section">
          <div className="ins-subtitle">Changed files <span className="muted small">{commit.files}</span></div>
          <FileBars files={commit.files} theme={theme} branch={branch} />
        </div>
      </aside>);

  }

  function FileBars({ files, theme, branch }) {
    // synthetic file list — placeholder; we don't pretend this is real diff data
    const items = [
    { path: 'apps/web/src/wallet/list.tsx', add: 24, del: 6 },
    { path: 'apps/api/src/ledger/index.ts', add: 18, del: 2 },
    { path: 'packages/ui/components/row.tsx', add: 9, del: 1 },
    { path: 'README.md', add: 4, del: 0 }].
    slice(0, Math.min(files, 4));
    return (
      <div className="files">
        {items.map((f) =>
        <div key={f.path} className="file-row">
            <code className="file-path">{f.path}</code>
            <span className="file-stat">
              <span className="add" style={{ color: '#3dd68c' }}>+{f.add}</span>
              <span className="del" style={{ color: '#ff5b5b' }}>−{f.del}</span>
            </span>
          </div>
        )}
        {files > 4 && <div className="muted small">+{files - 4} more files</div>}
      </div>);

  }

  function Divider({ theme }) {
    return <div className="divider" style={{ background: theme.border }} />;
  }

  function Stat({ label, value, swatch }) {
    return (
      <div className="stat">
        <div className="muted small">{label}</div>
        <div className="strong stat-val">
          {swatch && <span className="sha-dot" style={{ background: swatch }} />}
          {value}
        </div>
      </div>);

  }

  // Tooltip on hover
  function Tooltip({ hover, theme }) {
    const c = hover.c;
    return (
      <div className="tooltip" style={{
        left: hover.x + 14, top: hover.y + 14,
        background: theme.panelAlt, borderColor: theme.border
      }}>
        <div className="tt-row">
          <code className="strong">{c.shortSha}</code>
          {c.isMerge && <span className="tag-pill merge">merge</span>}
          {c.tag && <span className="tag-pill tag">{c.tag}</span>}
        </div>
        <div className="tt-msg">{c.message}</div>
        <div className="tt-foot">
          <span className="muted small">{c.author}</span>
          <span className="muted small">·</span>
          <span className="muted small">{c.date}</span>
          <span className="muted small">·</span>
          <span className="muted small">{c.files} files</span>
        </div>
      </div>);

  }

  function ZoomControls({ zoom, setZoom, setPan }) {
    return (
      <div className="zoom-controls">
        <button className="iconbtn-sm" onClick={() => setZoom((z) => Math.min(2, z + 0.15))}><PlusIcon /></button>
        <div className="zoom-val">{Math.round(zoom * 100)}%</div>
        <button className="iconbtn-sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}><MinusIcon /></button>
        <div className="zoom-divider" />
        <button className="iconbtn-sm" title="Reset"
        onClick={() => {setZoom(1);setPan({ x: 0, y: 0 });}}><ResetIcon /></button>
      </div>);

  }

  function Legend({ theme }) {
    const items = [
    { label: 'commit', el: <circle cx="8" cy="8" r="4" fill={theme.canvas} stroke={theme.text} strokeWidth="1.6" /> },
    { label: 'merge', el: <>
          <circle cx="8" cy="8" r="6" fill="none" stroke={theme.text} strokeWidth="1.6" opacity="0.5" />
          <circle cx="8" cy="8" r="3.5" fill={theme.canvas} stroke={theme.text} strokeWidth="1.6" />
        </> },
    { label: 'head', el: <>
          <circle cx="8" cy="8" r="4.5" fill={theme.canvas} stroke={theme.text} strokeWidth="1.6" />
          <circle cx="8" cy="8" r="2" fill={theme.text} />
        </> },
    { label: 'tag', el: <rect x="2" y="4" width="12" height="8" rx="1.5" fill={theme.text} /> }];

    return (
      <div className="legend" style={{ background: theme.panelAlt, borderColor: theme.border }}>
        {items.map((i) =>
        <div key={i.label} className="legend-item">
            <svg width="16" height="16">{i.el}</svg>
            <span className="muted small">{i.label}</span>
          </div>
        )}
      </div>);

  }

  // ─── TWEAKS PANEL ──────────────────────────────────────────────────────────
  function TweaksPanel({ themes, tweaks, setTweak }) {
    const Panel = window.TweaksPanel;
    const { TweakSection, TweakRadio, TweakSelect } = window;
    return (
      <Panel title="Tweaks">
        <TweakSection title="Map orientation">
          <TweakRadio value={tweaks.orientation} onChange={(v) => setTweak('orientation', v)}
          options={[{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }]} />
        </TweakSection>
        <TweakSection title="Theme">
          <TweakSelect value={tweaks.theme} onChange={(v) => setTweak('theme', v)}
          options={Object.values(themes).map((t) => ({ value: t.key, label: t.label }))} />
        </TweakSection>
        <TweakSection title="Node style">
          <TweakRadio value={tweaks.nodeStyle} onChange={(v) => setTweak('nodeStyle', v)}
          options={[
          { value: 'ring', label: 'Ring' },
          { value: 'dot', label: 'Dot' },
          { value: 'square', label: 'Square' }]
          } />
        </TweakSection>
      </Panel>);

  }

  // ─── ICONS ─────────────────────────────────────────────────────────────────
  const i = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  function GhIcon() {return <svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M8 .2a8 8 0 0 0-2.5 15.6c.4.1.6-.2.6-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.6.7.6 1.5v2.2c0 .2.2.5.6.4A8 8 0 0 0 8 .2z" /></svg>;}
  function HorizIcon() {return <svg width="14" height="14" viewBox="0 0 16 16" {...i}><path d="M2 8h12M5 5l-3 3 3 3M11 5l3 3-3 3" /></svg>;}
  function VertIcon() {return <svg width="14" height="14" viewBox="0 0 16 16" {...i}><path d="M8 2v12M5 5L8 2l3 3M5 11l3 3 3-3" /></svg>;}
  function ExportIcon() {return <svg width="14" height="14" viewBox="0 0 16 16" {...i}><path d="M8 11V2M5 5l3-3 3 3M2 11v3h12v-3" /></svg>;}
  function ChevronIcon() {return <svg width="10" height="10" viewBox="0 0 16 16" {...i}><path d="M4 6l4 4 4-4" /></svg>;}
  function BranchIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="12" cy="6" r="1.5" /><path d="M4 5.5v5M5.5 6c1.5 0 5 0 5 0" /></svg>;}
  function SearchIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><circle cx="7" cy="7" r="4" /><path d="M10 10l3 3" /></svg>;}
  function EyeIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5S1 8 1 8z" /><circle cx="8" cy="8" r="2" /></svg>;}
  function EyeOffIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><path d="M2 2l12 12M6.7 6.7A2 2 0 0 0 8 10a2 2 0 0 0 1.3-.5M3 5C2 6.4 1 8 1 8s2.5 5 7 5c1.4 0 2.6-.4 3.6-.9M7 3c4.4 0 7 5 7 5s-.5 1-1.4 2" /></svg>;}
  function CopyIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><rect x="3" y="3" width="9" height="10" rx="1.5" /><path d="M6 3V2h7v9h-1" /></svg>;}
  function LinkIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><path d="M9 7l-2 2M6 4l1-1a3 3 0 0 1 4 4l-1 1M10 12l-1 1a3 3 0 0 1-4-4l1-1" /></svg>;}
  function PlusIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><path d="M8 3v10M3 8h10" /></svg>;}
  function MinusIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><path d="M3 8h10" /></svg>;}
  function ResetIcon() {return <svg width="12" height="12" viewBox="0 0 16 16" {...i}><path d="M3 8a5 5 0 1 0 1.5-3.5L3 6M3 3v3h3" /></svg>;}

  window.GitMetroApp = App;
})();