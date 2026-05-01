// MetroMap — rectilinear SVG renderer.
// Layout:
//   horizontal: x = padX + t * stepX, y = laneY(lane)
//     main is the *trunk*, lane 0 lives at trunkY (visually the top in this design,
//     branching lanes hang below it like the reference image).
//   vertical: swap axes — y = padY + t * stepY (top→bottom), x = laneX(lane)
//
// Rectilinear connections:
//   - For commits on the SAME branch (same lane): straight line on that lane between t's.
//   - For a commit whose parent is on a DIFFERENT lane: parent first travels along ITS
//     lane from t_parent up to t_child (or t_child - 0.5 for cleanliness), then makes
//     a 90° corner with rounded radius and rises/drops onto the child's lane at t_child.
//   - Merge commits: drawn on the destination branch's lane; connections to BOTH parents
//     are routed rectilinearly using their respective lanes.
//
// Themes are passed via a `theme` object. Node style is "ring" | "dot" | "square".

(function () {
  const { useMemo, useRef, useEffect, useState, useCallback } = React;

  const TRUNK_LANE = 0;
  const STEP = 78;          // px between time columns
  const LANE = 64;          // px between lanes
  const PAD_X = 120;        // left padding (room for lane labels)
  const PAD_Y = 80;
  const CORNER_R = 14;      // rounded corner radius for 90° turns

  // Build coordinate maps
  function buildLayout(branches, commits, orientation) {
    const laneByBranchId = {};
    branches.forEach(b => { laneByBranchId[b.id] = b.lane; });

    const tMax = Math.max(...commits.map(c => c.t));

    const laneIndices = branches.map(b => b.lane).sort((a, b) => b - a); // 0, -1, -2, ...
    const minLane = Math.min(...laneIndices);

    function laneCoord(lane) {
      // Trunk (lane 0) sits near top; lanes below trunk go DOWN (positive offset)
      // (lane: 0, -1, -2, ... => offset 0, 1, 2, ...)
      return Math.abs(lane) * LANE;
    }

    function pos(t, lane) {
      if (orientation === 'horizontal') {
        return {
          x: PAD_X + t * STEP,
          y: PAD_Y + laneCoord(lane),
        };
      } else {
        return {
          x: PAD_X + laneCoord(lane),
          y: PAD_Y + t * STEP,
        };
      }
    }

    // index commits by sha
    const bySha = {};
    commits.forEach(c => { bySha[c.sha] = c; });

    const width  = orientation === 'horizontal'
      ? PAD_X + (tMax + 1.2) * STEP
      : PAD_X + (Math.abs(minLane) + 1) * LANE + 80;
    const height = orientation === 'horizontal'
      ? PAD_Y + (Math.abs(minLane) + 1) * LANE + 80
      : PAD_Y + (tMax + 1.2) * STEP;

    return { laneByBranchId, pos, bySha, width, height, tMax, minLane };
  }

  // Build a rounded rectilinear SVG path between (x1,y1) and (x2,y2)
  // routed via a single corner. For horizontal mode: parent travels along its
  // lane (constant Y) until x = x2, then turns to child's lane at x2.
  // For vertical mode: parent travels along its lane (constant X) until y = y2,
  // then turns at y = y2.
  function rectPath(p1, p2, orientation, opts = {}) {
    const r = opts.radius ?? CORNER_R;
    const turnAt = opts.turnAt; // optional explicit corner location
    if (orientation === 'horizontal') {
      // corner at x = (turnAt ?? p2.x), y = p1.y -> then to p2
      const cx = turnAt != null ? turnAt : p2.x;
      const cy = p1.y;
      // direction from p1 -> corner along x
      const dx = Math.sign(cx - p1.x) || 1;
      // direction from corner -> p2 along y
      const dy = Math.sign(p2.y - cy) || 1;
      // shorten before corner by r in each direction
      const beforeCornerX = cx - dx * r;
      const afterCornerY  = cy + dy * r;
      // sweep flag: choose so the curve bends naturally from horizontal->vertical
      const sweep = (dx > 0) ? (dy > 0 ? 1 : 0) : (dy > 0 ? 0 : 1);
      let d = `M ${p1.x} ${p1.y} `;
      if (Math.abs(cx - p1.x) <= r + 0.5 && Math.abs(p2.y - cy) <= r + 0.5) {
        // very tight corner, just curve directly
        d += `Q ${cx} ${cy} ${p2.x} ${p2.y}`;
      } else {
        d += `L ${beforeCornerX} ${cy} `;
        d += `A ${r} ${r} 0 0 ${sweep} ${cx} ${afterCornerY} `;
        d += `L ${p2.x} ${p2.y}`;
      }
      return d;
    } else {
      // vertical: travel along Y (constant X = p1.x) to corner, then in X to p2
      const cy = turnAt != null ? turnAt : p2.y;
      const cx = p1.x;
      const dy = Math.sign(cy - p1.y) || 1;
      const dx = Math.sign(p2.x - cx) || 1;
      const beforeCornerY = cy - dy * r;
      const afterCornerX  = cx + dx * r;
      const sweep = (dy > 0) ? (dx > 0 ? 0 : 1) : (dx > 0 ? 1 : 0);
      let d = `M ${p1.x} ${p1.y} `;
      if (Math.abs(cy - p1.y) <= r + 0.5 && Math.abs(p2.x - cx) <= r + 0.5) {
        d += `Q ${cx} ${cy} ${p2.x} ${p2.y}`;
      } else {
        d += `L ${cx} ${beforeCornerY} `;
        d += `A ${r} ${r} 0 0 ${sweep} ${afterCornerX} ${cy} `;
        d += `L ${p2.x} ${p2.y}`;
      }
      return d;
    }
  }

  function MetroMap({
    data,
    orientation = 'horizontal',
    nodeStyle = 'ring',
    theme,
    visibleBranches,
    selectedSha,
    onSelectCommit,
    onHoverCommit,
    onClearHover,
    zoom, setZoom,
    pan, setPan,
  }) {
    const { branches, commits } = data;
    const layout = useMemo(
      () => buildLayout(branches, commits, orientation),
      [branches, commits, orientation]
    );
    const branchById = useMemo(() => {
      const m = {}; branches.forEach(b => m[b.id] = b); return m;
    }, [branches]);

    // Build per-branch ordered commit chain (for trunk + branch lines)
    const branchChains = useMemo(() => {
      const chains = {};
      branches.forEach(b => {
        chains[b.id] = commits
          .filter(c => c.branch === b.id)
          .sort((a, b) => a.t - b.t);
      });
      return chains;
    }, [branches, commits]);

    // Edges: for each non-merge commit on branch X with a parent on branch Y (Y != X),
    //   draw a "spawn" line from parent.pos -> child.pos rectilinearly.
    // For each merge commit (2 parents), draw both edges rectilinearly to its position.
    // Same-branch sequential connections come from the branch chain (continuous line).
    const edges = useMemo(() => {
      const e = [];
      commits.forEach(c => {
        c.parents.forEach((psha, idx) => {
          const p = layout.bySha[psha];
          if (!p) return;
          const child = c;
          if (p.branch === child.branch && !child.isMerge) {
            // already drawn as part of branch chain
            return;
          }
          // For merge commit: parents come from two different branches typically.
          //   First parent = same branch (drawn by chain). Second parent = other branch.
          //   We draw the cross-branch parent edge.
          if (c.isMerge && p.branch === child.branch) {
            // first parent on same branch -> chain handles it
            return;
          }
          e.push({
            id: `${psha}->${c.sha}`,
            from: p,
            to: c,
            color: branchById[p.branch].color, // edge takes parent's branch color
            spawn: !c.isMerge,                   // true = "spawning" off parent
            merge: c.isMerge,
          });
        });
      });
      return e;
    }, [commits, layout, branchById]);

    // Drag-pan
    const svgRef = useRef(null);
    const drag = useRef(null);
    const onMouseDown = (e) => {
      drag.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    };
    useEffect(() => {
      const onMove = (e) => {
        if (!drag.current) return;
        setPan({
          x: drag.current.panX + (e.clientX - drag.current.x),
          y: drag.current.panY + (e.clientY - drag.current.y),
        });
      };
      const onUp = () => { drag.current = null; };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    }, [setPan]);

    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // require modifier so page can scroll
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      setZoom(z => Math.max(0.5, Math.min(2, z + delta)));
    };

    // Filter visible commits/branches
    const visibleSet = new Set(visibleBranches);
    const showCommit = (c) => visibleSet.has(c.branch);

    // For chain rendering, build polyline along time per branch, but skipping segments
    // where one endpoint is hidden.
    function chainPath(chain) {
      if (chain.length < 2) return '';
      const pts = chain.map(c => layout.pos(c.t, branchById[c.branch].lane));
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x} ${pts[i].y}`;
      }
      return d;
    }

    // Lane labels
    const laneLabels = branches.map(b => {
      const tStart = (branchChains[b.id][0]?.t) ?? 0;
      const p = layout.pos(orientation === 'horizontal' ? 0 : tStart, b.lane);
      if (orientation === 'horizontal') {
        return { ...b, x: 16, y: p.y };
      } else {
        return { ...b, x: p.x, y: 16 };
      }
    });

    return (
      <div
        className="metro-canvas"
        style={{
          background: theme.canvas,
          backgroundImage: theme.grid,
          backgroundSize: '40px 40px',
        }}
        onWheel={onWheel}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          onMouseDown={onMouseDown}
          onMouseLeave={onClearHover}
          style={{ cursor: drag.current ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* lane guide lines */}
            {branches.map(b => {
              if (!visibleSet.has(b.id)) return null;
              const chain = branchChains[b.id];
              if (!chain.length) return null;
              const first = chain[0];
              const last = chain[chain.length - 1];
              const a = layout.pos(first.t, b.lane);
              const z = layout.pos(last.t, b.lane);
              return (
                <line
                  key={`guide-${b.id}`}
                  x1={a.x} y1={a.y}
                  x2={orientation === 'horizontal' ? layout.width - 40 : a.x}
                  y2={orientation === 'horizontal' ? a.y : layout.height - 40}
                  stroke={theme.guide}
                  strokeDasharray="2 6"
                  strokeWidth="1"
                />
              );
            })}

            {/* Cross-branch edges (spawns + merges) */}
            {edges.map(ed => {
              if (!visibleSet.has(ed.from.branch) || !visibleSet.has(ed.to.branch)) return null;
              const p1 = layout.pos(ed.from.t, branchById[ed.from.branch].lane);
              const p2 = layout.pos(ed.to.t,   branchById[ed.to.branch].lane);
              // Spawn: parent on trunk-ish lane, child on lower lane.
              //   travel along parent lane until child's t, turn down to child.
              // Merge: parent on outer lane, child on closer-to-trunk lane.
              //   travel along parent lane until child's t, turn up to child.
              const d = rectPath(p1, p2, orientation);
              return (
                <path
                  key={ed.id}
                  d={d}
                  fill="none"
                  stroke={ed.color}
                  strokeWidth={theme.lineWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                />
              );
            })}

            {/* Branch chains (same-lane straight lines) */}
            {branches.map(b => {
              if (!visibleSet.has(b.id)) return null;
              const chain = branchChains[b.id];
              if (chain.length < 2) return null;
              return (
                <path
                  key={`chain-${b.id}`}
                  d={chainPath(chain)}
                  fill="none"
                  stroke={b.color}
                  strokeWidth={theme.lineWidth}
                  strokeLinecap="round"
                  opacity={0.95}
                />
              );
            })}

            {/* Stations (commits) */}
            {commits.map(c => {
              if (!showCommit(c)) return null;
              const b = branchById[c.branch];
              const p = layout.pos(c.t, b.lane);
              const sel = c.sha === selectedSha;
              return (
                <Station
                  key={c.sha}
                  c={c} p={p} color={b.color}
                  nodeStyle={nodeStyle}
                  theme={theme}
                  selected={sel}
                  onSelect={() => onSelectCommit(c)}
                  onHover={(e) => onHoverCommit(c, p, e)}
                />
              );
            })}

            {/* Lane labels (left for horizontal, top for vertical) */}
            {laneLabels.map(l => visibleSet.has(l.id) && (
              <g key={`label-${l.id}`} transform={`translate(${l.x},${l.y})`}>
                <rect
                  x={orientation === 'horizontal' ? 0 : -36} y={orientation === 'horizontal' ? -14 : 0}
                  width="72" height="22" rx="4"
                  fill={l.color}
                />
                <text
                  x={orientation === 'horizontal' ? 36 : 0}
                  y={orientation === 'horizontal' ? 1 : 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="Inter, sans-serif"
                  fontWeight="600"
                  fontSize="11"
                  fill={theme.labelText}
                  style={{ letterSpacing: '0.02em' }}
                >
                  {l.name}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    );
  }

  function Station({ c, p, color, nodeStyle, theme, selected, onSelect, onHover }) {
    const r = c.isMerge ? 8 : (c.isHead ? 7 : 5.5);
    const strokeW = c.isMerge ? 3 : 2;
    const fill = nodeStyle === 'dot' ? color
              : nodeStyle === 'square' ? theme.canvas
              : (c.isHead || c.isMerge) ? theme.canvas : theme.canvas;

    return (
      <g
        transform={`translate(${p.x},${p.y})`}
        style={{ cursor: 'pointer' }}
        onMouseEnter={onHover}
        onMouseMove={onHover}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {selected && (
          <circle r={r + 7} fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="2" />
        )}
        {nodeStyle === 'square' ? (
          <rect
            x={-r} y={-r} width={r * 2} height={r * 2}
            fill={fill}
            stroke={color}
            strokeWidth={strokeW}
            rx="1.5"
          />
        ) : nodeStyle === 'dot' ? (
          <>
            <circle r={r + 1.5} fill={color} opacity="0.18" />
            <circle r={r} fill={color} />
          </>
        ) : (
          // ring (default)
          <>
            {c.isMerge && (
              <circle r={r + 3} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
            )}
            <circle r={r} fill={fill} stroke={color} strokeWidth={strokeW} />
            {c.isHead && <circle r={r - 2.5} fill={color} />}
          </>
        )}
        {c.isTag && (
          <g transform={`translate(${10},${-12})`}>
            <rect width="38" height="14" rx="2" fill={theme.tagBg} />
            <text x="19" y="10" textAnchor="middle" fontFamily="JetBrains Mono, monospace"
              fontSize="9" fill={theme.tagText} fontWeight="600">{c.tag}</text>
          </g>
        )}
      </g>
    );
  }

  window.MetroMap = MetroMap;
})();
