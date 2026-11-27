/* grid-1.js — Grid 5: the Pick 5 grid rundown (Marcus, Nov 26 2026).
   Method B (single seed): the seed goes down the diagonal; each ring counts +1 counter-clockwise (or clockwise) from its
   bottom-right diagonal cell, skipping the diagonal. Checked against his sheet (LA 55453, Nov 16) and the app grid (mirror 62617).
   Method A: the state's last 5 draws as rows, newest on top.
   Mirror grid: 0↔5 1↔6 2↔7 3↔8 4↔9 · Flip grid: 0↔9 1↔8 2↔7 3↔6 4↔5.
   Lines (Marcus, Nov 26: clean, definable lines only until exact cell paths are defined): 5 rows, 5 columns, the diagonal, the anti-diagonal.
   Ranking: Mirror lines first, Base second, Flip last; a number on both Base and Mirror gets a boost; hot digits, overdue spots and the date digit only break ties.
   Uses SEQ, CODES, DATES, srt, ways, addInc, esc, nm, fmtShort, fmtD, slotName, store, $ (app-1.js), syPlayDay, syLastDraw,
   syStates, syCame, syCopy, syShift, syDsum, syRoot, syHas, syUniq, sySubs (sys-1.js). */
'use strict';
const G5_KEYS = {'12345':'+1 2 3 4 5 (classic)', '11111':'+1 1 1 1 1 (simple)', '67867':'67867', '95379':'95379', '31753':'31753'};
const g5Mir = v => (v + 5) % 10, g5Flip = v => 9 - v;
function g5Spiral(seed, cw){
  const G = [...Array(5)].map(() => Array(5).fill(null));
  for(let i = 0; i < 5; i++) G[i][i] = +seed[i];
  for(const [lo, hi] of [[0, 4], [1, 3]]){
    let v = G[hi][hi], path = [];
    if(!cw){ for(let r = hi-1; r >= lo; r--) path.push([r, hi]); for(let c = hi-1; c >= lo; c--) path.push([lo, c]); for(let r = lo+1; r <= hi; r++) path.push([r, lo]); for(let c = lo+1; c < hi; c++) path.push([hi, c]); }
    else { for(let c = hi-1; c >= lo; c--) path.push([hi, c]); for(let r = hi-1; r >= lo; r--) path.push([r, lo]); for(let c = lo+1; c <= hi; c++) path.push([lo, c]); for(let r = lo+1; r < hi; r++) path.push([r, hi]); }
    for(const [r, c] of path){ if(r === c) continue; v = (v + 1) % 10; G[r][c] = v; }
  }
  return G;
}
const g5Rows = draws => draws.map(n => n.split('').map(Number));
const g5Map = (G, f) => G.map(r => r.map(f));
function g5Lines(G){
  const s = a => a.join(''), out = [];
  for(let i = 0; i < 5; i++) out.push(['row ' + (i+1), s(G[i])]);
  for(let i = 0; i < 5; i++) out.push(['column ' + (i+1), s(G.map(r => r[i]))]);
  out.push(['diagonal', s(G.map((r, i) => r[i]))]);
  out.push(['anti-diagonal', s(G.map((r, i) => r[4-i]))]);
  return out;
}
function g5Grids(method, seed, last5){
  const base = method === 'A' ? g5Rows(last5) : g5Spiral(seed, method === 'Bcw');
  return {Base:base, Mirror:g5Map(base, g5Mir), Flip:g5Map(base, g5Flip)};
}
function g5Rundown(seed, key){ const out = [seed]; let cur = seed; for(let k = 1; k <= 9; k++){ cur = addInc(cur, key, 1); out.push(cur); } return out; }

/* state stats as of a point in a state's draw list (idx = index of the seed draw) */
function g5Stats(sq, idx, playDay){
  const lastN = sq.slice(Math.max(0, idx - 29), idx + 1), cnt = Array(10).fill(0), roots = Array(10).fill(0);
  for(const x of lastN){ for(const d of x.n) cnt[+d]++; roots[syRoot(syDsum(x.n)) || 0]++; }
  const hot = [...Array(10).keys()].sort((a, b) => cnt[b] - cnt[a] || a - b).slice(0, 3);
  const hotRoot = [...Array(10).keys()].sort((a, b) => roots[b] - roots[a] || a - b)[0];
  const over = [];                           // per position: the digit gone longest in that position (the orange dot)
  for(let p = 0; p < 5; p++){ const seen = new Set(); let last = null;
    for(let j = idx; j >= 0 && seen.size < 10; j--){ const d = +sq[j].n[p]; if(!seen.has(d)){ seen.add(d); last = d; } }
    if(seen.size < 10){ for(let d = 0; d < 10; d++) if(!seen.has(d)){ last = d; break; } }
    over.push(last); }
  const tri = new Set(); for(const x of sq.slice(Math.max(0, idx - 9), idx + 1)) for(const t of sySubs(x.n, 3)) tri.add(t);
  const L = +playDay.slice(-1), M = (L + 5) % 10;
  return {hot, hotRoot, over, tri, L, M};
}
function g5Rank(G, S, ownBox){
  const by = new Map();                      // box -> candidate
  for(const [gname, grid] of Object.entries(G)) for(const [lab, n] of g5Lines(grid)){
    const k = srt(n); if(k === ownBox) continue;
    let e = by.get(k); if(!e){ e = {k, n, grids:new Set(), lines:[]}; by.set(k, e); }
    e.grids.add(gname); e.lines.push(gname + ' ' + lab);
  }
  for(const e of by.values()){
    const why = [], n = e.n; let s = 0;
    if(e.grids.has('Mirror')){ s += 3; why.push('mirror'); }
    if(e.grids.has('Base')){ s += 1; why.push('base'); }
    if(e.grids.has('Flip')){ s += 0.5; why.push('flip'); }
    if(e.grids.has('Mirror') && e.grids.has('Base')){ s += 2; why.push('base + mirror boost'); }
    const hotIn = S.hot.filter(d => n.includes(String(d))); if(hotIn.length){ s += 0.25 * hotIn.length; why.push('hot ' + hotIn.join('')); }
    const ov = [...n].filter((d, p) => +d === S.over[p]).length; if(ov){ s += 0.5 * ov; why.push(ov + ' overdue spot' + (ov > 1 ? 's' : '')); }
    if(n.includes(String(S.L)) || n.includes(String(S.M))){ s += 0.5; why.push('date ' + S.L + '/' + S.M); }
    e.score = s; e.why = why;
  }
  return [...by.values()].sort((a, b) => b.score - a.score || b.grids.size - a.grids.size || ways(b.k) - ways(a.k) || a.k.localeCompare(b.k));
}

/* ── render ── */
function g5GridHTML(name, G, S, isSeed){
  return `<div style="min-width:0"><div class="sub-h" style="margin-top:6px">${name} grid</div><table class="g5g"><tbody>` + G.map((r, i) => '<tr>' + r.map((v, j) => {
    const cls = [isSeed && i === j ? 'dg' : '', (v === S.L || v === S.M) ? 'pk' : ''].filter(Boolean).join(' ');
    return `<td class="${cls}">${v}${S.over[j] === v ? '<i title="gone longest in this position"></i>' : ''}</td>`; }).join('') + '</tr>').join('') + '</tbody></table></div>';
}
let G5_LAST = {all:[], top:[]};
function renderG5(){
  if(!$('g5Out')) return;
  if(!Object.keys(SEQ).length){ $('g5Out').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  const sel = $('g5State'); if(sel && !sel.options.length){ sel.innerHTML = syStates().map(c => `<option value="${c}">${esc(nm(c))}</option>`).join(''); const v = store('g5State'); if(v && [...sel.options].some(o => o.value === v)) sel.value = v; }
  const c = sel.value || syStates()[0], asOf = syPlayDay(), method = $('g5Method').value || 'B';
  let key = $('g5Key').value; if(key === 'custom'){ key = ($('g5Custom').value || '').replace(/\D/g, ''); if(key.length !== 5) key = '12345'; }
  $('g5CustomWrap').hidden = $('g5Key').value !== 'custom';
  const sq = (SEQ[c] || []).filter(x => x.d <= asOf), idx = sq.length - 1;
  if(idx < 0){ $('g5Out').innerHTML = '<div class="empty">No draws for this state yet.</div>'; return; }
  const typed = ($('g5Seed').value || '').replace(/\D/g, ''), seed = typed.length === 5 ? typed : sq[idx].n;
  const last5 = sq.slice(Math.max(0, idx - 4)).map(x => x.n).reverse();
  if(method === 'A' && last5.length < 5){ $('g5Out').innerHTML = '<div class="empty">This state needs 5 draws for Method A.</div>'; return; }
  const S = g5Stats(sq, idx, asOf), G = g5Grids(method, seed, last5), ranked = g5Rank(G, S, method === 'A' ? null : srt(seed));
  const src = typed.length === 5 ? null : {...sq[idx], c};
  let h = `<div class="play"><b>${method === 'A' ? last5[0] : seed}</b><small>${method === 'A' ? `${esc(nm(c))}'s last 5 draws as rows, newest on top (${last5.join(' · ')}).` : (src ? `${esc(nm(c))} ${esc(slotName(c, src.s))} ${fmtD(src.d)} on the diagonal` : 'Your seed on the diagonal') + `, every ring counted +1 ${method === 'Bcw' ? 'clockwise' : 'counter-clockwise'} from its bottom-right corner.`} ${esc(nm(c))} right now: hot digits ${S.hot.join(' ')}, hot root ${S.hotRoot}, gone longest by position ${S.over.join(' ')}. Date digit ${S.L}, mirror ${S.M}.</small></div>`;
  // rundown
  const rd = g5Rundown(seed, key);
  h += `<div class="sub-h">Classic rundown · ${esc(G5_KEYS[key] || key)}</div><div class="chips">` + rd.map((n, i) => `<span class="chip${i ? '' : ' hot'}" data-look="${n}">${n}</span>`).join('') + '</div>';
  // grids
  h += '<div class="g5wrap">' + Object.entries(G).map(([nmG, g]) => g5GridHTML(nmG, g, S, method !== 'A')).join('') + '</div>';
  h += '<div class="legend"><span><i style="background:var(--navy)"></i>seed on the diagonal</span><span><i style="background:#F7C6DD"></i>date digit or its mirror</span><span><i style="background:var(--accent);border-radius:50%"></i>dot = digit gone longest in that position</span></div>';
  // ranked
  const top = ranked.slice(0, 10);
  h += `<div class="sub-h">Strongest candidates in ${esc(nm(c))}</div><div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>#</th><th>Number</th><th>Score</th><th>Why</th><th>Since</th></tr></thead><tbody>` +
    top.map((e, i) => { const came = src ? syCame(e.k, src, c) : null;
      return `<tr${i < 3 ? ' class="top"' : ''}><td class="num">${i + 1}</td><td class="n"><span class="chip" data-look="${e.n}" style="border:0;padding:0;background:none">${e.n}</span><span class="tag">${ways(e.k)}w</span></td><td class="num">${e.score.toFixed(1)}</td><td>${esc(e.why.join(' · '))}<div style="color:var(--muted);font-size:12px">${esc(e.lines.join(', '))}</div></td><td>${came ? `<span class="mk x">✕</span> ${came.n} ${fmtShort(came.d)}` : (src ? '<span class="mk ok">✓</span> not yet' : '')}</td></tr>`; }).join('') + '</tbody></table></div>';
  h += `<div class="ctl" style="margin-top:8px"><button class="btn primary" type="button" data-g5copy="top">Copy the top 10</button><button class="btn" type="button" data-g5copy="all">Copy all ${ranked.length} unique numbers</button><span id="g5Copied" style="color:var(--good);font-size:13px" aria-live="polite"></span></div>`;
  // complete list by grid
  h += '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px">Every line from every grid</summary><div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Line</th>' + Object.keys(G).map(k => `<th>${k}</th>`).join('') + '</tr></thead><tbody>' +
    g5Lines(G.Base).map(([lab], i) => `<tr><td>${lab}</td>` + Object.values(G).map(g => { const n = g5Lines(g)[i][1]; return `<td class="n" style="font-size:14px"><span data-look="${n}" style="cursor:pointer">${n}</span></td>`; }).join('') + '</tr>').join('') + '</tbody></table></div></details>';
  $('g5Out').innerHTML = h; G5_LAST = {all:ranked.map(e => e.n), top:top.map(e => e.n)};
  g5Card();
}

/* ── live scorecard: every draw on file, Method B, next draw in the same state (box) ── */
const G5_LIVE = '2026-11-27', G5_REVIEW = 150;
let G5_CARD = {key:null, R:null, run:null};
function g5Card(){
  if(!$('g5Card')) return;
  const meth = $('g5Method').value === 'Bcw' ? 'Bcw' : 'B', key = meth + '|' + bfAll().length;
  if(G5_CARD.key === key && G5_CARD.R){ g5CardShow(); return; }
  if(G5_CARD.run === key) return;
  G5_CARD = {key, R:null, run:key};
  const R = {Base:[0,0,0], Mirror:[0,0,0], Flip:[0,0,0], 'All three':[0,0,0], 'Top 10 ranked':[0,0,0], live:[0,0,0], liveTop:[0,0,0]};
  const jobs = []; for(const c of syStates()){ const sq = SEQ[c]; for(let i = 4; i < sq.length - 1; i++) jobs.push([c, i]); }
  let j = 0;
  const step = () => {
    if(G5_CARD.key !== key) return;
    const t0 = performance.now();
    while(j < jobs.length && performance.now() - t0 < 40){
      const [c, i] = jobs[j++], sq = SEQ[c], x = sq[i], nxt = srt(sq[i + 1].n), own = srt(x.n), G = g5Grids(meth, x.n);
      const put = (k, B) => { let sh = 0; for(const b of B) sh += ways(b); R[k][0] += B.has(nxt) ? 1 : 0; R[k][1] += sh / 1e5; R[k][2]++; };
      const all = new Set();
      for(const [gn, g] of Object.entries(G)){ const B = new Set(g5Lines(g).map(l => srt(l[1]))); B.delete(own); put(gn, B); B.forEach(b => all.add(b)); }
      put('All three', all);
      const isLive = x.d >= G5_LIVE;
      if(i >= sq.length - 400 || isLive){ const S = g5Stats(sq, i, sq[i + 1].d); const B = new Set(g5Rank(G, S, own).slice(0, 10).map(e => e.k)); if(i >= sq.length - 400) put('Top 10 ranked', B); if(isLive) put('liveTop', B); }
      if(isLive){ const B = new Set(g5Lines(G.Mirror).map(l => srt(l[1]))); B.delete(own); put('live', B); }
    }
    G5_CARD.R = R; g5CardShow(j < jobs.length ? `checking… ${Math.round(j / jobs.length * 100)}%` : '');
    if(j < jobs.length) setTimeout(step, 0); else G5_CARD.run = null;
  };
  setTimeout(step, 50);
}
function g5CardShow(msg){
  const R = G5_CARD.R; if(!R) return;
  const z = a => a[1] > 0 ? (a[0] - a[1]) / Math.sqrt(a[1]) : 0;
  const cell = a => `<td class="num">${a[0].toLocaleString()} / ${a[1].toFixed(1)} <span class="tag" style="${z(a) >= 2 ? 'background:var(--good-soft);color:var(--good)' : ''}">${a[1] > 0 ? (a[0] / a[1]).toFixed(2) + '×' : '—'}</span></td>`;
  const tile = (k, a) => `<div class="tile"><div class="k">${k}</div><div class="v">${a[0]} / ${a[1].toFixed(1)}</div><div class="k">${a[2]} of ${G5_REVIEW}+ draws graded${a[1] > 0 ? ' · ' + (a[0] / a[1]).toFixed(2) + '×' : ''}</div></div>`;
  let h = `<div class="tiles">${tile('Live test · mirror grid lines', R.live)}${tile('Live test · ranked top 10', R.liveTop)}</div>`;
  h += `<div class="note" style="margin:0 0 10px">The live test counts only draws from ${fmtShort(G5_LIVE)}, 2026 on: each draw's grid, then that state's next draw. Review it after ${G5_REVIEW}–200 graded draws${R.live[2] >= G5_REVIEW ? ' <b>— ready to review now</b>' : ` (${Math.max(0, G5_REVIEW - R.live[2])} to go)`}. The table below is the look back at every draw before that.</div>`;
  h += '<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Grid (Method B), next draw in the same state, box</th><th>Came / chance</th></tr></thead><tbody>' +
    ['Base', 'Mirror', 'Flip', 'All three', 'Top 10 ranked'].map(k => `<tr${k === 'Mirror' ? ' class="top"' : ''}><td>${k}${k === 'Top 10 ranked' ? ' <span class="tag">last 400 draws per state</span>' : ''}</td>${cell(R[k])}</tr>`).join('') + '</tbody></table></div>';
  if(msg) h += `<div class="empty">${esc(msg)}</div>`;
  h += '<div class="note">Every draw on file was put on the diagonal and its rows, columns, diagonal and anti-diagonal checked against that state\'s next draw. "Chance" is how often the same boxes would come at random. The look back is not proof either way: the mirror grid has run a little ahead of the others, but not by enough to rule out luck. The live tiles decide it.</div>';
  $('g5Card').innerHTML = h;
}

document.addEventListener('change', e => { if(['g5State', 'g5Method', 'g5Key'].includes(e.target.id)){ store(e.target.id, e.target.value); renderG5(); } });
document.addEventListener('input', e => { if(['g5Seed', 'g5Custom'].includes(e.target.id)){ const v = e.target.value.replace(/\D/g, ''); if(v.length === 5 || !v.length) renderG5(); } });
document.addEventListener('click', e => { const b = e.target.closest('[data-g5copy]'); if(!b) return; const L = G5_LAST[b.dataset.g5copy] || []; syCopy(L.join(' '), 'g5Copied', L.length + ' numbers'); });
(function(){ for(const id of ['g5Method', 'g5Key']){ const v = store(id), el = $(id); if(el && v && [...el.options].some(o => o.value === v)) el.value = v; }
  const base = renderAll; renderAll = function(){ base(); try{ renderG5(); }catch(err){ console.error(err); if($('g5Out')) $('g5Out').innerHTML = '<div class="empty">Grid 5 could not load.</div>'; } }; })();
