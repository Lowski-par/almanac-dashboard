/* sys-1.js — Date sums, Mirror mixes & Mirror Doubles, Pair sets, and State all-in-one.
   Ported from the Pick 3 (Almanac Convergence) and Pick 4 (Ya Heard Me) dashboards and turned into 5-digit rules.
   Every system is graded live on every Pick 5 draw on file against exact chance (all 100,000 straights counted).
   Uses SEQ, CODES, DATES, CUR_DAY, BOXIDX, LP_LISTS, RUNDOWNS, END_STEPS, srt, ways, addInc, mirror, dnum, fmtShort,
   fmtD, slotName, esc, nm, store, todayCT, $ from app-1.js and bfAll, bfLo from bf-1.js. */
'use strict';
const SY_M = d => String((+d + 5) % 10);
const syUniq = a => [...new Set(a)];
const syDsum = s => String(s).split('').reduce((a, d) => a + (+d), 0);
const syRoot = x => { while(x > 9) x = syDsum(x); return x; };
function syHas(n, p){ const r = n.split(''); for(const ch of p){ const i = r.indexOf(ch); if(i < 0) return false; r.splice(i, 1); } return true; }
const syShift = (iso, k) => new Date(Date.parse(iso + 'T12:00:00Z') + k * 864e5).toISOString().slice(0, 10);
const syLater = (x, src) => x.d > src.d || (x.d === src.d && src.s === 'm' && x.s === 'e');
function syCame(key, src, c){            // first later draw (box = key), anywhere or in state c
  for(const x of (BOXIDX.get(key) || [])) if(syLater(x, src) && (!c || x.c === c)) return x; return null;
}
function syCopy(text, msgId, label){
  const done = () => { const m = $(msgId); if(m){ m.textContent = 'Copied ' + label; setTimeout(() => { m.textContent = ''; }, 2500); } };
  const fb = () => { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try{ document.execCommand('copy'); done(); }catch(e){} a.remove(); };
  try{ navigator.clipboard.writeText(text).then(done, fb); }catch(e){ fb(); }
}
function syPlayDay(){ return CUR_DAY || DATES[DATES.length - 1] || todayCT(); }
function syLastDraw(c, asOf){ const sq = SEQ[c] || []; for(let i = sq.length - 1; i >= 0; i--) if(sq[i].d <= asOf) return sq[i]; return null; }
function syStates(){ return CODES.filter(c => SEQ[c]); }
function syOpts(sel, withAll){
  const el = $(sel); if(!el || el.options.length) return;
  el.innerHTML = (withAll ? '<option value="">All states</option>' : '') + syStates().map(c => `<option value="${c}">${esc(nm(c))}</option>`).join('');
  const s = store(sel); if(s !== null && s !== undefined && [...el.options].some(o => o.value === s)) el.value = s;
}

/* ── exact chance: every straight 00000–99999 ── */
const SY_CNT = (() => { const a = new Uint8Array(1e6); for(let i = 0; i < 1e5; i++){ let x = i; for(let k = 0; k < 5; k++){ a[i*10 + x%10]++; x = (x/10)|0; } } return a; })();
const SY_SUM = (() => { const a = new Uint8Array(1e5); for(let i = 0; i < 1e5; i++){ let x = i, s = 0; for(let k = 0; k < 5; k++){ s += x%10; x = (x/10)|0; } a[i] = s; } return a; })();
const syPC = p => { const v = new Array(10).fill(0); for(const ch of p) v[+ch]++; return v; };
function syMatch(n, sp){
  if(sp.k === 'sum') return sp.v.includes(syDsum(n));
  if(sp.k === 'root'){ const s = syDsum(n); return s > 0 ? sp.v.includes(syRoot(s)) : sp.v.includes(0); }
  return sp.v.some(p => syHas(n, p));
}
const SY_SH = new Map();
function syShare(sp){
  const key = sp.k + ':' + sp.v.join(','); if(SY_SH.has(key)) return SY_SH.get(key);
  let c = 0;
  if(sp.k === 'sum'){ for(let i = 0; i < 1e5; i++) if(sp.v.includes(SY_SUM[i])) c++; }
  else if(sp.k === 'root'){ for(let i = 0; i < 1e5; i++){ const s = SY_SUM[i]; if(s > 0 ? sp.v.includes(syRoot(s)) : sp.v.includes(0)) c++; } }
  else { const pcs = sp.v.map(syPC);
    for(let i = 0; i < 1e5; i++){ const o = i*10; for(const v of pcs){ let ok = true; for(let d = 0; d < 10; d++) if(SY_CNT[o+d] < v[d]){ ok = false; break; } if(ok){ c++; break; } } } }
  const r = c / 1e5; SY_SH.set(key, r); return r;
}

/* ══ DATE SUMS ══
   The Pick 3 / Pick 4 versions, plus the new Pick 5 one (Marcus, Nov 26 2026):
   last digit triads — the date's last digit and its mirror made into threes: the 26th → 666xx 111xx 616xx 116xx. */
const SY_DS = [
  {id:'last3', name:'Last digit triads (new for Pick 5)'},
  {id:'last2', name:'Last digit sum pairs'},
  {id:'pairs', name:'Date sum pairs'},
  {id:'md',    name:'Sum: month + day'},
  {id:'mdy',   name:'Sum: month + day + year'},
  {id:'both',  name:'Sum: both'},
  {id:'rmd',   name:'Root: month + day'},
  {id:'rmdy',  name:'Root: month + day + year'}
];
function syDatePairs(day){
  const out = []; const add = p => { if(!out.includes(p)) out.push(p); };
  add(srt(String(day).padStart(2, '0'))); let t = day; while(t > 18) t -= 10;
  if(t !== day) add(srt(String(t).padStart(2, '0')));
  for(let a = 0; a < 10; a++) for(let b = a; b < 10; b++) if(a + b === t) add('' + a + b);
  return {out, t};
}
function syDsSpec(id, iso){
  const [y, m, d] = iso.split('-'), md = syDsum(m + d), mdy = syDsum(m + d + y), day = +d, L = day % 10, M = (L + 5) % 10;
  switch(id){
    case 'last3': return {k:'pat', v:syUniq([''+L+L+L, ''+M+M+M, srt(''+L+L+M), srt(''+L+M+M)]),
      show:syUniq([''+L+L+L, ''+M+M+M, ''+L+M+L, ''+M+M+L]).map(p => p + 'xx'), how:`the ${day} ends in <b>${L}</b> → its mirror is <b>${M}</b> → threes made of ${L} and ${M}`};
    case 'last2': return {k:'pat', v:syUniq([''+L+L, srt(''+L+M), ''+M+M]), show:syUniq([''+L+L, ''+M+L, ''+M+M]).map(p => p + 'xxx'), how:`the ${day} ends in <b>${L}</b> → mirror <b>${M}</b>`};
    case 'pairs': { const P = syDatePairs(day); return {k:'pat', v:P.out, show:P.out.map(p => p + 'xxx'), how: P.t === day ? `the ${day} → pairs that add to <b>${day}</b>` : `the ${day} → drops to the <b>${P.t}</b> → pairs that add to ${P.t}`}; }
    case 'md':   return {k:'sum', v:[md], show:['sum ' + md], how:`${+m}/${day}: ${(m+d).split('').join('+')} = <b>${md}</b>`};
    case 'mdy':  return {k:'sum', v:[mdy], show:['sum ' + mdy], how:`${+m}/${day}/${y}: ${(m+d+y).split('').join('+')} = <b>${mdy}</b>`};
    case 'both': return {k:'sum', v:syUniq([md, mdy]), show:syUniq([md, mdy]).map(s => 'sum ' + s), how:`${+m}/${day} = <b>${md}</b> and ${+m}/${day}/${y} = <b>${mdy}</b>`};
    case 'rmd':  return {k:'root', v:[syRoot(md)], show:['root ' + syRoot(md)], how:`${+m}/${day} = ${md} → root <b>${syRoot(md)}</b>`};
    case 'rmdy': return {k:'root', v:[syRoot(mdy)], show:['root ' + syRoot(mdy)], how:`${+m}/${day}/${y} = ${mdy} → root <b>${syRoot(mdy)}</b>`};
  }
}
function syDrawsOn(iso, c){ const out = []; for(const k in SEQ){ if(c && k !== c) continue; for(const x of SEQ[k]) if(x.d === iso) out.push({...x, c:k}); } return out; }
let SY_DS_CARD = null, SY_DS_N = -1;
function syDsScorecard(){                 // every version, every draw on file, against exact chance
  const all = bfAll(); if(SY_DS_CARD && SY_DS_N === all.length) return SY_DS_CARD;
  const last = all.length ? all[all.length-1].t : 0, out = {};
  for(const V of SY_DS){ const r = {own:[0,0,0], y365:[0,0,0], d30:[0,0,0], yday:[0,0,0], tmrw:[0,0,0]}; const spc = new Map();
    const spec = iso => { if(!spc.has(iso)){ const s = syDsSpec(V.id, iso); spc.set(iso, [s, syShare(s)]); } return spc.get(iso); };
    for(const x of all){
      const [s, sh] = spec(x.d), h = syMatch(x.n, s) ? 1 : 0;
      const put = k => { r[k][0] += h; r[k][1] += sh; r[k][2]++; };
      put('own'); if(x.t > last - 365) put('y365'); if(x.t > last - 30) put('d30');
      for(const [k, off] of [['yday', -1], ['tmrw', 1]]){ const [s2, sh2] = spec(syShift(x.d, off)); r[k][0] += syMatch(x.n, s2) ? 1 : 0; r[k][1] += sh2; r[k][2]++; }
    }
    out[V.id] = r; }
  SY_DS_CARD = out; SY_DS_N = all.length; return out;
}
const syRat = (h, e) => e > 0 ? (h / e).toFixed(2) + '×' : '—';
const syZ = (h, e, n) => e > 0 ? (h - e) / Math.sqrt(e * (1 - e / Math.max(n, 1))) : 0;
function syCell(a){ const z = syZ(a[0], a[1], a[2]); return `<td class="num">${a[0].toLocaleString()} / ${a[1].toFixed(1)} <span class="tag" style="${z >= 2 ? 'background:var(--good-soft);color:var(--good)' : z <= -2 ? 'background:var(--bad-soft);color:var(--bad)' : ''}">${syRat(a[0], a[1])}</span></td>`; }

function renderDS(){
  if(!$('dsOut')) return;
  if(!Object.keys(SEQ).length){ $('dsOut').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  const id = $('dsVer').value || 'last3', iso = $('dsDay').value || syPlayDay(), c = $('dsState').value || '';
  const sp = syDsSpec(id, iso), sh = syShare(sp), [y, m, d] = iso.split('-');
  let h = `<div class="play"><b>${sp.show.join(' &nbsp;')}</b><small>${+m}/${+d}: ${sp.how}. A draw counts when it holds ${sp.k === 'pat' ? 'every digit of one of these, in any order' : sp.k === 'sum' ? 'digits that add up to that sum' : 'digits whose sum reduces to that root'}. About ${(sh*100).toFixed(1)}% of all Pick 5 numbers qualify.</small></div>`;
  if(sp.k === 'pat') h += `<div class="ctl" style="margin:4px 0 8px"><button class="btn" type="button" data-sycopy="ds">Copy every box (${syBoxesFor(sp).length})</button><span id="dsCopied" style="color:var(--good);font-size:13px" aria-live="polite"></span></div>`;
  // that day
  const today = syDrawsOn(iso, c), hits = today.filter(x => syMatch(x.n, sp));
  h += `<div class="sub-h">Came on ${fmtShort(iso)} ${c ? 'in ' + esc(nm(c)) : 'in any state'}</div>`;
  h += today.length ? `<div style="margin-bottom:6px;font-size:13.5px">${hits.length} of ${today.length} draws <span style="color:var(--muted)">(chance ${(today.length*sh).toFixed(1)})</span></div><div class="chips">${hits.map(x => `<span class="chip hot" data-look="${x.n}">${x.n}<small>${esc(x.c.toUpperCase())} ${esc(slotName(x.c, x.s))}</small></span>`).join('') || '<span class="empty" style="padding:0">none yet</span>'}</div>`
    : '<div class="empty">No Pick 5 draws on file for that day yet.</div>';
  // last 7 days
  const days = DATES.filter(x => x <= iso).slice(-7).reverse();
  h += '<div class="sub-h">Last 7 days</div><div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Date</th><th>Called</th><th>Came / chance</th><th>What came</th></tr></thead><tbody>' + days.map(dd => {
    const s2 = syDsSpec(id, dd), sh2 = syShare(s2), dr = syDrawsOn(dd, c), hh = dr.filter(x => syMatch(x.n, s2));
    return `<tr><td>${fmtShort(dd)}</td><td class="mono">${s2.show.join(' ')}</td><td class="num">${hh.length} / ${(dr.length*sh2).toFixed(1)}</td><td>${hh.map(x => `<span class="mono" data-look="${x.n}" style="cursor:pointer;letter-spacing:.05em">${x.n}</span> <span style="color:var(--muted)">${esc(x.c.toUpperCase())}</span>`).join(' · ')}</td></tr>`; }).join('') + '</tbody></table></div>';
  $('dsOut').innerHTML = h;
  // scorecard
  const card = syDsScorecard(); let best = null;
  for(const V of SY_DS){ const r = card[V.id].own; const z = syZ(r[0], r[1], r[2]); if(!best || z > best.z) best = {V, z, r}; }
  $('dsCard').innerHTML = '<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Version</th><th>All draws (own date)</th><th>Last 365 days</th><th>Last 30 days</th><th>Yesterday\'s list</th><th>Tomorrow\'s list</th></tr></thead><tbody>' +
    SY_DS.map(V => { const r = card[V.id]; return `<tr${V.id === id ? ' class="top"' : ''}><td>${esc(V.name)}</td>${syCell(r.own)}${syCell(r.y365)}${syCell(r.d30)}${syCell(r.yday)}${syCell(r.tmrw)}</tr>`; }).join('') + '</tbody></table></div>' +
    `<div class="note">Came / chance, all ${card.last3.own[2].toLocaleString()} Pick 5 draws on file. Green would mean two standard errors above chance; red two below. <b>Best on paper: ${esc(best.V.name)}</b> (${syRat(best.r[0], best.r[1])}), but no version is clearly above chance, and with eight versions one will always top the table by luck. The new last digit triads ran ${syRat(card.last3.own[0], card.last3.own[1])} on all draws. "Yesterday's / tomorrow's list" checks whether a date's numbers come a day early or late.</div>`;
}
function syBoxesFor(sp){                  // every box that holds one of the patterns
  const out = new Set(); const pcs = sp.v.map(syPC);
  for(let i = 0; i < 1e5; i++){ const o = i*10; for(const v of pcs){ let ok = true; for(let d = 0; d < 10; d++) if(SY_CNT[o+d] < v[d]){ ok = false; break; } if(ok){ out.add(srt(String(i).padStart(5, '0'))); break; } } }
  return [...out].sort();
}

/* ══ MIRROR MIXES ══  every digit kept or flipped to its mirror (0↔5 1↔6 2↔7 3↔8 4↔9): 31 numbers per draw (Marcus, Nov 26) */
function syMixes(n){ const out = new Set(); for(let mask = 1; mask < 32; mask++){ let s = ''; for(let i = 0; i < 5; i++) s += (mask >> i & 1) ? SY_M(n[i]) : n[i]; out.add(s); } out.delete(n); return [...out]; }
function syMixBoxes(n){ const own = srt(n); return syUniq(syMixes(n).map(srt)).filter(k => k !== own); }
let SY_MIX_CARD = null, SY_MIX_N = -1;
function syMixScore(){
  const all = bfAll(); if(SY_MIX_CARD && SY_MIX_N === all.length) return SY_MIX_CARD;
  const last = all.length ? all[all.length-1].t : 0, R = {d1:[0,0,0], d1o:[0,0,0], d7:[0,0,0], st:[0,0,0]};
  const next = new Map();                  // index of next draw in the same state
  { const lastIdx = {}; for(let i = all.length - 1; i >= 0; i--){ const c = all[i].c; if(lastIdx[c] !== undefined) next.set(i, lastIdx[c]); lastIdx[c] = i; } }
  for(let i = 0; i < all.length; i++){ const x = all[i]; if(x.t + 1 > last) continue;
    const B = new Set(syMixBoxes(x.n)); let sh = 0; for(const k of B) sh += ways(k); sh /= 1e5;
    const lo = bfLo(all, x.t + 1), hi1 = bfLo(all, x.t + 2), hi7 = bfLo(all, x.t + 8);
    let a = false, ao = false, no = 0; for(let j = lo; j < hi1; j++){ const ok = B.has(srt(all[j].n)); if(ok) a = true; if(all[j].c !== x.c){ no++; if(ok) ao = true; } }
    R.d1[0] += a; R.d1[1] += 1 - Math.pow(1 - sh, hi1 - lo); R.d1[2]++;
    R.d1o[0] += ao; R.d1o[1] += 1 - Math.pow(1 - sh, no); R.d1o[2]++;
    if(x.t + 7 <= last){ let b = false; for(let j = lo; j < hi7; j++) if(B.has(srt(all[j].n))){ b = true; break; } R.d7[0] += b; R.d7[1] += 1 - Math.pow(1 - sh, hi7 - lo); R.d7[2]++; }
    if(next.has(i)){ R.st[0] += B.has(srt(all[next.get(i)].n)); R.st[1] += sh; R.st[2]++; }
  }
  SY_MIX_CARD = R; SY_MIX_N = all.length; return R;
}
/* ══ MIRROR DOUBLES ══ the Pick 4 chart as four-digit patterns with any fifth digit:
   two low digits a<b (0–4) and their mirrors → single a b A B and doubles aabb AABB aaBB AAbb. 10 sets. */
const SY_MD = (() => { const out = []; for(let a = 0; a < 5; a++) for(let b = a + 1; b < 5; b++){ const A = a + 5, B = b + 5;
  out.push({name:`${a}${b}${A}${B}`, mem:[`${a}${b}${A}${B}`, `${a}${a}${b}${b}`, `${A}${A}${B}${B}`, `${a}${a}${B}${B}`, `${A}${A}${b}${b}`].map(srt)}); } return out; })();
function syMdState(asOf, c, days){          // which members came in the window, per set
  const t1 = dnum(asOf), draws = []; for(const k in SEQ){ if(c && k !== c) continue; for(const x of SEQ[k]){ const t = dnum(x.d); if(t <= t1 && t > t1 - days) draws.push({...x, c:k}); } }
  return SY_MD.map(S => { const came = S.mem.map(p => draws.filter(x => syHas(x.n, p)));
    const n = came.filter(a => a.length).length; return {S, came, n, ready: n >= 2, rest: S.mem.filter((p, i) => !came[i].length)}; });
}
function renderMix(){
  if(!$('mixOut')) return;
  if(!Object.keys(SEQ).length){ $('mixOut').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  syOpts('mixState', false);
  const asOf = syPlayDay(), c = $('mixState').value || syStates()[0];
  const typed = ($('mixBox').value || '').replace(/\D/g, '');
  const src = typed.length === 5 ? {n:typed, d:asOf, s:'e', c:null} : (() => { const x = syLastDraw(c, asOf); return x ? {...x, c} : null; })();
  let h = '';
  if(src){
    const mixes = syMixes(src.n), boxes = syUniq(mixes.map(srt)).filter(k => k !== srt(src.n));
    const came = boxes.map(k => ({k, x: src.c ? syCame(k, src) : null}));
    h += `<div class="play"><b>${src.n}</b><small>${src.c ? `${esc(nm(src.c))} ${esc(slotName(src.c, src.s))} ${fmtD(src.d)}` : 'your number'} → ${mixes.length} mirror mixes (${boxes.length} different boxes). Each digit stays or flips: ${src.n.split('').map(d => d + '↔' + SY_M(d)).join(' ')}.</small></div>`;
    h += '<div class="chips">' + mixes.map(v => { const k = srt(v), x = src.c ? syCame(k, src) : null;
      return `<span class="chip ${src.c ? (x ? 'came' : 'open') : ''}" data-look="${v}" title="${x ? esc(`came ${nm(x.c)} ${slotName(x.c, x.s)} ${fmtShort(x.d)} as ${x.n}`) : ''}">${v}${x ? `<small>${esc(x.c.toUpperCase())} ${fmtShort(x.d)}</small>` : ''}</span>`; }).join('') + '</div>';
    if(src.c){ const k = came.filter(z => z.x).length; h += `<div class="note">Red = that box has come in some state since. ${k} of ${boxes.length} boxes have come so far.</div>`; }
    h += `<div class="ctl" style="margin-top:8px"><button class="btn" type="button" data-sycopy="mix" data-n="${src.n}">Copy the ${mixes.length} numbers</button><span id="mixCopied" style="color:var(--good);font-size:13px" aria-live="polite"></span></div>`;
  }
  // every state, last draw
  h += '<div class="sub-h">Every state\'s last draw, and its mirror-mix boxes that came since</div><div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>State</th><th>Last draw</th><th>Came since (any state)</th></tr></thead><tbody>';
  for(const k of syStates()){ const x = syLastDraw(k, asOf); if(!x) continue; const s = {...x, c:k};
    const hits = syMixBoxes(x.n).map(b => syCame(b, s)).filter(Boolean).sort((p, q) => p.d < q.d ? -1 : 1);
    h += `<tr><td>${esc(nm(k))}</td><td class="n"><span class="chip" data-look="${x.n}" style="border:0;padding:0;background:none">${x.n}</span> <span class="tag">${esc(slotName(k, x.s))} ${fmtShort(x.d)}</span></td><td>${hits.length ? hits.map(z => `<span class="mono" data-look="${z.n}" style="cursor:pointer;letter-spacing:.05em">${z.n}</span> <span style="color:var(--muted)">${esc(z.c.toUpperCase())} ${fmtShort(z.d)}</span>`).join(' · ') : '<span style="color:var(--muted)">none yet</span>'}</td></tr>`; }
  h += '</tbody></table></div>';
  $('mixOut').innerHTML = h;
  const R = syMixScore();
  $('mixCard').innerHTML = '<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>After a number draws, one of its mirror-mix boxes comes…</th><th>Came / chance</th></tr></thead><tbody>' +
    `<tr><td>Next draw, same state</td>${syCell(R.st)}</tr><tr><td>Any state, the next day</td>${syCell(R.d1)}</tr><tr><td>Another state, the next day</td>${syCell(R.d1o)}</tr><tr><td>Any state, within 7 days</td>${syCell(R.d7)}</tr></tbody></table></div>` +
    `<div class="note">A mirror mix shows up somewhere the next day after about ${R.d1[2] ? Math.round(R.d1[0] / R.d1[2] * 100) : 0}% of draws, which is why mirrors seem to run the board. Random boxes of the same types do that almost as often (the chance column), because 31 numbers across about 20 draws a day covers a lot of ground.</div>`;
  // mirror doubles
  const win = +($('mdWin').value || 7), mc = $('mdScope').value === 'state' ? c : '';
  const MS = syMdState(asOf, mc, win);
  $('mdOut').innerHTML = '<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Set</th><th>Single and its four mirror doubles (any fifth digit)</th><th>Came</th><th>Play</th></tr></thead><tbody>' +
    MS.map(z => `<tr${z.ready ? ' class="top"' : ''}><td class="n">${z.S.name}</td><td>${z.S.mem.map((p, i) => `<span class="chip ${z.came[i].length ? 'came' : ''}" title="${esc(z.came[i].map(x => x.n + ' ' + x.c.toUpperCase() + ' ' + fmtShort(x.d)).join(', '))}" style="font-size:13px">${p}x${z.came[i].length ? `<small>${z.came[i].length}</small>` : ''}</span>`).join(' ')}</td><td class="num">${z.n} of 5</td><td>${z.ready ? z.rest.map(p => p + 'x').join(' ') || 'all five came' : '<span style="color:var(--muted)">waiting for 2</span>'}</td></tr>`).join('') + '</tbody></table></div>' +
    `<div class="note">The Pick 4 Mirror Doubles chart, with any fifth digit: 0156x covers 01556, 01566 and so on. A set is ready once two of its five came in the window (${mc ? esc(nm(mc)) : 'all states'}, last ${win} days); then the rest are the play. Tested on every Pick 5 day since Aug 2021: once a set was ready, the rest came the next day 724 times against 763 by chance (0.95×).</div>`;
}

/* ══ PAIR SETS & MISSING TRIADS ══
   Pick 3: a pair → its ten sets (45 → 045 145 … 459). Pick 5: a pair + one digit → ten triads, each a 55-box family (45 → 045xx … 459xx). */
function syPats(K){ const o = []; const rec = (s, from) => { if(s.length === K){ o.push(s); return; } for(let d = from; d < 10; d++) rec(s + d, d); }; rec('', 0); return o; }
const SY_TRI = syPats(3), SY_QUAD = syPats(4);
function sySubs(n, K){ const a = n.split('').sort(), out = new Set(); const rec = (i, s) => { if(s.length === K){ out.add(s); return; } for(let j = i; j < a.length; j++) rec(j + 1, s + a[j]); }; rec(0, ''); return out; }
function syGaps(c, asOf, K){               // draws since each 3- or 4-digit pattern last came, in state c ('' = all states together)
  const P = K === 4 ? SY_QUAD : SY_TRI, sq = c ? (SEQ[c] || []).filter(x => x.d <= asOf).map(x => ({...x, c})) : bfAll().filter(x => x.d <= asOf), last = {};
  sq.forEach((x, i) => { for(const t of sySubs(x.n, K)) last[t] = i; });
  const out = {}; for(const t of P) out[t] = last[t] === undefined ? {g:sq.length, never:true} : {g:sq.length - 1 - last[t], x:sq[last[t]]};
  return out;
}
const SY_GAP_CACHE = new Map();
function syGapsC(c, asOf, K){ K = K || 3; const k = c + '|' + asOf + '|' + K + '|' + (c ? (SEQ[c] || []).length : bfAll().length); if(!SY_GAP_CACHE.has(k)) SY_GAP_CACHE.set(k, syGaps(c, asOf, K)); return SY_GAP_CACHE.get(k); }
function syLongest(c, asOf, k, K){ K = K || 3; const G = syGapsC(c, asOf, K); return (K === 4 ? SY_QUAD : SY_TRI).slice().sort((a, b) => G[b].g - G[a].g || a.localeCompare(b)).slice(0, k).map(t => ({t, ...G[t]})); }
function renderPS(){
  if(!$('psOut')) return;
  if(!Object.keys(SEQ).length){ $('psOut').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  syOpts('psState', false);
  const asOf = syPlayDay(), c = $('psState').value || syStates()[0], pair = ($('psPair').value || '').replace(/\D/g, '').slice(0, 2);
  const G = syGapsC(c, asOf);
  let h = '';
  if(pair.length === 2){
    const sets = [...'0123456789'].map(d => { const t = srt(pair + d); const need = syStates().map(k => ({k, g:syGapsC(k, asOf)[t].g})).sort((a, b) => b.g - a.g);
      return {t, d, g:G[t], need}; });
    const top = sets.reduce((a, b) => b.g.g > a.g.g ? b : a);
    h += `<div class="sub-h">${pair} → its ten sets in ${esc(nm(c))}</div><div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Set</th><th>Draws out here</th><th>Last here</th><th>States that need it most</th></tr></thead><tbody>` +
      sets.map(z => `<tr${z === top ? ' class="top"' : ''}><td class="n">${pair}${z.d}xx</td><td class="num">${z.g.g}${z.g.never ? '+' : ''}${z === top ? ' <span class="tag">longest out</span>' : ''}</td><td>${z.g.x ? `<span class="mono" data-look="${z.g.x.n}" style="cursor:pointer">${z.g.x.n}</span> ${fmtShort(z.g.x.d)}` : '—'}</td><td>${z.need.slice(0, 3).map(q => `${esc(q.k.toUpperCase())} ${q.g}`).join(' · ')}</td></tr>`).join('') + '</tbody></table></div>';
  }
  // called for the day: the date's pairs that missed the day before
  const called = syUniq([...syDsSpec('last2', asOf).v, ...syDsSpec('pairs', asOf).v]), yd = syShift(asOf, -1), ydDraws = syDrawsOn(yd, '');
  h += `<div class="sub-h">Pairs called for ${fmtShort(asOf)} (date sum pairs + last digit pairs) · did they hit ${fmtShort(yd)}?</div><div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Pair</th><th>${fmtShort(yd)}, any state</th><th>Longest-out set in ${esc(nm(c))}</th></tr></thead><tbody>` +
    called.map(p => { const hh = ydDraws.filter(x => syHas(x.n, p)); const best = [...'0123456789'].map(d => srt(p + d)).sort((a, b) => G[b].g - G[a].g)[0];
      return `<tr${hh.length ? '' : ' class="top"'}><td class="n">${p}xxx</td><td>${hh.length ? hh.map(x => `<span class="mono">${x.n}</span> ${esc(x.c.toUpperCase())}`).join(' · ') : '<b>missed</b>'}</td><td class="mono">${best}xx · ${G[best].g} draws</td></tr>`; }).join('') + '</tbody></table></div>';
  $('psOut').innerHTML = h; renderLO();
}

/* ══ LONGEST OUT: triads (123xx) or fours (1234x), one state or all states together ══ */
function renderLO(){
  if(!$('loOut')) return;
  const asOf = syPlayDay(), K = +($('loSize').value || 3), all = $('loScope').value === 'all', c = all ? '' : ($('psState').value || syStates()[0]);
  const L = syLongest(c, asOf, 20, K), tail = K === 4 ? 'x' : 'xx';
  const share = p => syShare({k:'pat', v:[p]});
  let h = `<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>${K === 4 ? 'Four' : 'Triad'}</th><th>Draws out${all ? ' (all states)' : ''}</th><th>Average wait</th><th>Last</th>${all ? '' : '<th>All states</th>'}</tr></thead><tbody>`;
  const GA = all ? null : syGapsC('', asOf, K);
  h += L.map(z => { const avg = Math.round(1 / share(z.t)), over = z.g / avg;
    return `<tr${over >= 2 ? ' class="top"' : ''}><td class="n">${z.t}${tail}</td><td class="num">${z.g.toLocaleString()}${z.never ? '+' : ''}</td><td class="num">${avg.toLocaleString()} <span class="tag">${over.toFixed(1)}× its wait</span></td><td>${z.x ? `<span class="mono" data-look="${z.x.n}" style="cursor:pointer">${z.x.n}</span> ${esc((z.x.c || '').toUpperCase())} ${fmtShort(z.x.d)}` : '—'}</td>${all ? '' : `<td class="num">${GA[z.t].g.toLocaleString()} out</td>`}</tr>`; }).join('') + '</tbody></table></div>';
  h += `<div class="ctl" style="margin-top:8px"><button class="btn" type="button" data-sycopy="lo">Copy every box for the top 5 (${syBoxesFor({k:'pat', v:L.slice(0, 5).map(z => z.t)}).length})</button><span id="loCopied" style="color:var(--good);font-size:13px" aria-live="polite"></span></div>`;
  h += `<div class="note">A ${K === 4 ? 'four is four digits a draw holds in any order, with any fifth digit (1234x covers 12340 through 12349, any order)' : 'triad is three digits a draw holds in any order (166xx = a 1 and two 6s)'}. "Draws out" counts ${all ? 'every Pick 5 draw in all 10 states' : 'that state\'s draws'} since it last came. "Average wait" is how many draws it takes on average, so the rare kinds (like ${K === 4 ? '0000x' : '000xx'}) sit at the top of any longest-out list just because they are rare; "× its wait" shows which are truly overdue. Tested on every draw since Aug 2021, next draw: ${K === 4 ? 'fours, one state — top 1: 11 vs 15.7 by chance (0.70×), top 5: 126 vs 126.4 (1.00×), top 10: 272 vs 281.4 (0.97×), top 20: 623 vs 611.5 (1.02×); all states together — top 5: 82 vs 88.1 (0.93×), top 10: 226 vs 229.2 (0.99×), top 20: 611 vs 589.8 (1.04×)' : 'triads, one state — top 1: 180 vs 191.6 by chance (0.94×), top 5: 1,263 vs 1,260 (1.00×), top 10: 2,831 vs 2,781 (1.02×); all states together — top 1: 234 vs 220.6 (1.06×), top 5: 1,505 vs 1,498 (1.00×), top 10: 3,334 vs 3,310 (1.01×)'}. None is clearly above chance.</div>`;
  $('loOut').innerHTML = h; SY_LO_LAST = L.slice(0, 5).map(z => z.t);
}
let SY_LO_LAST = [];

/* ══ STATE ALL-IN-ONE ══ every system on the page, scored for one state */
function sySpecificVotes(c, asOf){         // boxes named by the systems that make whole numbers, from the state's last draw
  const x = syLastDraw(c, asOf); if(!x) return {x:null, V:new Map()};
  const V = new Map(), base = srt(x.n), add = (k, s) => { if(k === base) return; if(!V.has(k)) V.set(k, new Set()); V.get(k).add(s); };
  for(const [label, inc] of Object.entries({...RUNDOWNS, 'Rundown 67867':'67867', 'Rundown 34534':'34534'})){
    const steps = inc === '01123' ? END_STEPS : [1,2,3,4,5,6,7,8,9], from = label.startsWith('Rundown') ? x.n : base;
    for(const k of steps) add(srt(addInc(from, inc, k)), label); }
  add(srt(mirror(x.n)), 'Mirror');
  for(const k of syMixBoxes(x.n)) add(k, 'Mirror mixes');
  if(typeof LP_LISTS === 'object' && LP_LISTS[c]) for(const k of String(LP_LISTS[c]).split(' ').filter(Boolean)) add(srt(k), 'Lottery Post methods');
  if(typeof BF_RULES !== 'undefined') for(const r of BF_RULES.concat(typeof BF_MINE !== 'undefined' ? BF_MINE : [])) for(const e of bfRecent(r, asOf, 7)) if(e.x.c === c) for(const f of r.fol) for(const k of bfFam(f)) add(k, 'Brings & follows');
  return {x, V};
}
function syPatternVotes(k, c, asOf, ctx){   // the pattern systems: does this box hold today's patterns?
  const out = [];
  if(syMatch(k, ctx.ds3)) out.push('Date sum · last digit triads');
  if(syMatch(k, ctx.dsb)) out.push('Date sum · sum');
  if(ctx.longT.some(t => syHas(k, t))) out.push('Longest-out triads');
  if(ctx.longQ.some(t => syHas(k, t))) out.push('Longest-out fours');
  if(ctx.mdRest.some(p => syHas(k, p))) out.push('Mirror Doubles');
  return out;
}
function syCtx(c, asOf){
  return {ds3:syDsSpec('last3', asOf), dsb:syDsSpec('both', asOf), longT:syLongest(c, asOf, 5).map(z => z.t), longQ:syLongest(c, asOf, 10, 4).map(z => z.t),
    mdRest:syMdState(asOf, '', 7).filter(z => z.ready).flatMap(z => z.rest)};
}
const SY_LET = {'Date sum · last digit triads':'D', 'Date sum · sum':'S', 'Longest-out triads':'P', 'Longest-out fours':'Q', 'Mirror Doubles':'M', 'Mirror mixes':'X', 'Mirror':'X', 'Lottery Post methods':'L', 'Brings & follows':'B'};
function renderAIO(){
  if(!$('aioOut')) return;
  if(!Object.keys(SEQ).length){ $('aioOut').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  syOpts('aioState', false);
  const asOf = syPlayDay(), c = $('aioState').value || syStates()[0], show = +($('aioTop').value || 20);
  const {x, V} = sySpecificVotes(c, asOf);
  if(!x){ $('aioOut').innerHTML = '<div class="empty">No draws for this state yet.</div>'; return; }
  const ctx = syCtx(c, asOf), src = {...x, c};
  const rows = [...V.entries()].map(([k, s]) => { const pv = syPatternVotes(k, c, asOf, ctx), sys = [...s, ...pv];
    return {k, sys, n:sys.length, came:syCame(k, src, c)}; }).filter(r => !r.came)
    .sort((a, b) => b.n - a.n || ways(b.k) - ways(a.k) || a.k.localeCompare(b.k)).slice(0, show);
  const D = ctx.ds3.show.join(' '), S = ctx.dsb.show.join(' / ');
  let h = `<div class="play"><b>${x.n}</b><small>${esc(nm(c))}'s last draw (${esc(slotName(c, x.s))} ${fmtD(x.d)}) feeds the rundowns, mirror, mirror mixes, Lottery Post methods and Brings &amp; follows. Then each box earns a point for holding today's last digit triads (${D}), the date sum (${S}), one of ${esc(nm(c))}'s 5 longest-out triads (${ctx.longT.map(t => t + 'xx').join(' ')}) or 10 longest-out fours (${ctx.longQ.map(t => t + 'x').join(' ')}), or a Mirror Doubles set that is ready (${ctx.mdRest.length ? syUniq(ctx.mdRest).map(p => p + 'x').join(' ') : 'none ready'}).</small></div>`;
  h += rows.length ? '<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Box</th><th>Systems</th><th>Which</th></tr></thead><tbody>' + rows.map((r, i) =>
    `<tr${i < 5 && r.n >= 3 ? ' class="top"' : ''}><td class="n"><span class="chip" data-look="${r.k}" style="border:0;padding:0;background:none">${r.k}</span><span class="tag">${ways(r.k)}w</span></td><td class="num">${r.n}</td><td>${r.sys.map(s => `<span class="tag" title="${esc(s)}">${esc(SY_LET[s] || 'R')}</span>`).join('')} <span style="color:var(--muted)">${esc(r.sys.join(', '))}</span></td></tr>`).join('') + '</tbody></table></div>'
    : '<div class="empty">Nothing to show.</div>';
  h += `<div class="ctl" style="margin-top:8px"><button class="btn" type="button" data-sycopy="aio">Copy these ${rows.length} boxes</button><span id="aioCopied" style="color:var(--good);font-size:13px" aria-live="polite"></span></div>`;
  h += '<div class="note"><b>R</b> rundowns (Endeavor and the workbook\'s others, 67867, 34534) · <b>X</b> mirror and mirror mixes · <b>L</b> Lottery Post methods · <b>B</b> Brings &amp; follows · <b>D</b> last digit triads · <b>S</b> date sum · <b>P</b> longest-out triads · <b>Q</b> longest-out fours · <b>M</b> Mirror Doubles. Boxes that already came in this state since the draw are left off. Each system on its own tested at chance, so agreement is a way to shortlist, not a proven edge; the Hot list above uses the same votes across every state.</div>';
  $('aioOut').innerHTML = h; SY_AIO_LAST = rows.map(r => r.k);
}
let SY_AIO_LAST = [];

/* ── feed the Hot list (bf-1.js calls this before ranking) ── */
function sysHotVotes(tally, add, asOf){
  for(const c of CODES){ const x = syLastDraw(c, asOf); if(!x) continue; const full = srt(mirror(x.n));
    for(const k of syMixBoxes(x.n)) if(k !== full) add(k, 'Mirror mixes', c, false); }
  const ds3 = syDsSpec('last3', asOf), dsb = syDsSpec('both', asOf);
  const longT = syUniq(syStates().flatMap(c => syLongest(c, asOf, 3).map(z => z.t)));
  const mdRest = syMdState(asOf, '', 7).filter(z => z.ready).flatMap(z => z.rest);
  const longQ = syLongest('', asOf, 10, 4).map(z => z.t);
  for(const k of [...tally.keys()]){
    if(longQ.some(t => syHas(k, t))) add(k, 'Longest-out fours (all states)', null, false);
    if(syMatch(k, ds3)) add(k, 'Date sum · last digit triads', null, false);
    if(syMatch(k, dsb)) add(k, 'Date sum · sum', null, false);
    if(longT.some(t => syHas(k, t))) add(k, 'Longest-out triads', null, false);
    if(mdRest.some(p => syHas(k, p))) add(k, 'Mirror Doubles', null, false);
  }
}

/* ── wiring ── */
function syRenderAll(){ for(const f of [renderAIO, renderDS, renderMix, renderPS]) try{ f(); }catch(err){ console.error(err); } }
document.addEventListener('change', e => {
  const id = e.target.id;
  if(['dsVer', 'dsDay', 'dsState'].includes(id)){ store(id, e.target.value); renderDS(); }
  else if(['mixState', 'mdWin', 'mdScope'].includes(id)){ store(id, e.target.value); renderMix(); }
  else if(id === 'psState'){ store(id, e.target.value); renderPS(); }
  else if(['loSize', 'loScope'].includes(id)){ store(id, e.target.value); renderLO(); }
  else if(['aioState', 'aioTop'].includes(id)){ store(id, e.target.value); renderAIO(); }
});
document.addEventListener('input', e => {
  if(e.target.id === 'mixBox'){ const v = e.target.value.replace(/\D/g, ''); if(v.length === 5 || !v.length) renderMix(); }
  if(e.target.id === 'psPair'){ const v = e.target.value.replace(/\D/g, ''); if(v.length === 2 || !v.length) renderPS(); }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sycopy]'); if(!b) return;
  const w = b.dataset.sycopy;
  if(w === 'ds'){ const sp = syDsSpec($('dsVer').value || 'last3', $('dsDay').value || syPlayDay()); const L = syBoxesFor(sp); syCopy(L.join(' '), 'dsCopied', L.length + ' boxes'); }
  if(w === 'mix'){ const L = syMixes(b.dataset.n); syCopy(L.join(' '), 'mixCopied', L.length + ' numbers'); }
  if(w === 'lo'){ const L = syBoxesFor({k:'pat', v:SY_LO_LAST}); syCopy(L.join(' '), 'loCopied', L.length + ' boxes'); }
  if(w === 'aio'){ syCopy(SY_AIO_LAST.join(' '), 'aioCopied', SY_AIO_LAST.length + ' boxes'); }
});
(function(){
  for(const id of ['dsVer', 'mdWin', 'mdScope', 'aioTop', 'loSize', 'loScope']){ const v = store(id), el = $(id); if(el && v && [...el.options].some(o => o.value === v)) el.value = v; }
  const dsS = $('dsState'); if(dsS && !dsS.options.length) dsS.innerHTML = '<option value="">All states</option>';
  const base = renderAll; renderAll = function(){ base(); const el = $('dsState');
    if(el && el.options.length <= 1){ el.innerHTML = '<option value="">All states</option>' + syStates().map(c => `<option value="${c}">${esc(nm(c))}</option>`).join(''); const v = store('dsState'); if(v) el.value = v; }
    syRenderAll(); };
})();

/* ══ TODAY'S BOARD — every rundown and every system together ══
   Seeds: every draw in every state from the day before and the play day so far (not just each state's last draw).
   A seed that hit a date sum for its own date (last digit triads, or the month+day / month+day+year sum) is "fired":
   every box it makes gets an extra vote. Every box then picks up a vote from each pattern system it holds.
   The board grades itself on past days: each day's top list, built only from draws before that day, against that day's draws. */
const SY_BOARD_SYS = ['Endeavor and the workbook rundowns', 'Rundown 67867 / 34534', 'Mirror', 'Mirror mixes', 'Lottery Post 814 rundown', 'Lottery Post projection', 'Brings & follows'];
function syFired(x){ const f = []; if(syMatch(x.n, syDsSpec('last3', x.d))) f.push('last digit triads'); if(syMatch(x.n, syDsSpec('both', x.d))) f.push('date sum'); return f; }
function syBoard(P, seedTo, top){
  // P = the day being played; seeds are draws from P-1 through seedTo (seedTo = P-1 for a fair look back, or P for today so far)
  const from = syShift(P, -1), seeds = [];
  for(const c in SEQ) for(const x of SEQ[c]) if(x.d >= from && x.d <= seedTo) seeds.push({...x, c});
  const K = new Map(), add = (k, sys, seed) => { let e = K.get(k); if(!e){ e = {k, sys:new Set(), seeds:new Map(), fired:false}; K.set(k, e); } e.sys.add(sys); e.seeds.set(seed.c + seed.d + seed.s, seed); if(seed.fired.length) e.fired = true; };
  for(const x of seeds){ x.fired = syFired(x); const base = srt(x.n), put = (k, s) => { if(k !== base) add(k, s, x); };
    for(const [label, inc] of Object.entries(RUNDOWNS)){ const steps = inc === '01123' ? END_STEPS : [1,2,3,4,5,6,7,8,9]; for(const k of steps) put(srt(addInc(base, inc, k)), label); }
    for(const inc of ['67867', '34534']) for(let k = 1; k <= 9; k++) put(srt(addInc(x.n, inc, k)), 'Rundown ' + inc);
    put(srt(mirror(x.n)), 'Mirror');
    for(const k of syMixBoxes(x.n)) put(k, 'Mirror mixes');
    if(typeof lpKeys === 'function'){ try{ for(const k of lpKeys(x.n, 'rund').keys()) put(k, 'Lottery Post 814 rundown'); for(const k of lpKeys(x.n, 'proj').keys()) put(k, 'Lottery Post projection'); }catch(e){} }
    if(typeof g5Spiral === 'function'){ const MG = g5Map(g5Spiral(x.n, false), g5Mir); for(const [, l] of g5Lines(MG)) put(srt(l), 'Grid 5 mirror grid'); }
    if(typeof gaPlayBoxes === 'function'){ try{ for(const k of gaPlayBoxes(x.n, P)) put(k, 'GA Rundown'); }catch(e){} }   // GA Rundown (Grid System) play list from this draw, date digit of the play day (Marcus, Nov 28)
  }
  if(typeof BF_RULES !== 'undefined') for(const r of BF_RULES.concat(typeof BF_MINE !== 'undefined' ? BF_MINE : [])) for(const e of bfRecent(r, seedTo, 7)){ const sd = {...e.x, fired:[]}; for(const f of r.fol) for(const k of bfFam(f)) add(k, 'Brings & follows', sd); }
  // pattern systems for the play day, from what was known by seedTo
  const ds3 = syDsSpec('last3', P), dsb = syDsSpec('both', P), dsp = syDsSpec('pairs', P);
  const longT = syUniq(syStates().flatMap(c => syLongest(c, seedTo, 3).map(z => z.t))), longQ = syLongest('', seedTo, 10, 4).map(z => z.t);
  const mdRest = syMdState(seedTo, '', 7).filter(z => z.ready).flatMap(z => z.rest);
  const rows = [];
  for(const e of K.values()){
    // leave off boxes that already came (anywhere) after their earliest seed, up to seedTo
    let gone = null; const first = [...e.seeds.values()].sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.s === 'm' ? -1 : 1)[0];
    for(const y of (BOXIDX.get(e.k) || [])) if(syLater(y, first) && y.d <= seedTo){ gone = y; break; }
    if(gone) continue;
    const v = [...e.sys];
    if(e.fired) v.push('Date sum fired');
    if(syMatch(e.k, ds3)) v.push('Last digit triads');
    if(syMatch(e.k, dsb)) v.push('Date sum');
    if(syMatch(e.k, dsp)) v.push('Date sum pairs');
    if(longT.some(t => syHas(e.k, t))) v.push('Longest-out triads');
    if(longQ.some(t => syHas(e.k, t))) v.push('Longest-out fours');
    if(mdRest.some(p => syHas(e.k, p))) v.push('Mirror Doubles');
    const st = new Set([...e.seeds.values()].map(s => s.c));
    rows.push({k:e.k, v, n:v.length, st, seeds:[...e.seeds.values()]});
  }
  rows.sort((a, b) => b.n - a.n || b.st.size - a.st.size || ways(b.k) - ways(a.k) || a.k.localeCompare(b.k));
  return {rows:rows.slice(0, top || 20), seeds, fired:seeds.filter(x => x.fired.length), total:rows.length, P};
}
const SY_BL = {'Last digit triads':'D', 'Date sum':'S', 'Date sum pairs':'S', 'Date sum fired':'F', 'Longest-out triads':'P', 'Longest-out fours':'Q', 'Mirror Doubles':'M', 'Mirror mixes':'X', 'Mirror':'X', 'Lottery Post 814 rundown':'L', 'Lottery Post projection':'L', 'Brings & follows':'B', 'Grid 5 mirror grid':'G', 'GA Rundown':'A'};
let SY_BOARD_LAST = [], SY_BT = {key:null, rows:null, running:false};
function renderBoard(){
  if(!$('boardOut')) return;
  if(!Object.keys(SEQ).length){ $('boardOut').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  const P = syPlayDay(), N = +($('boardTop').value || 20), B = syBoard(P, P, N);
  let h = `<div class="play"><b>${fmtShort(P)}</b><small>${B.seeds.length} draws from ${fmtShort(syShift(P, -1))} and ${fmtShort(P)} so far went through every rundown and system, making ${B.total.toLocaleString()} boxes that have not come yet. Each box is ranked by how many systems name it. Today's date numbers: ${syDsSpec('last3', P).show.join(' ')} · ${syDsSpec('both', P).show.join(' / ')} · pairs ${syDsSpec('pairs', P).show.join(' ')}.</small></div>`;
  h += `<div class="sub-h">Date sum fired · ${B.fired.length} of ${B.seeds.length} draws hit a date sum for their own day</div>` + (B.fired.length ? '<div class="chips">' + B.fired.map(x => `<span class="chip hot" data-look="${x.n}">${x.n}<small>${esc(x.c.toUpperCase())} ${esc(slotName(x.c, x.s))} ${fmtShort(x.d)} · ${esc(x.fired.join(' + '))}</small></span>`).join('') + '</div>' : '<div class="empty">None yet.</div>');
  h += '<div class="sub-h">The board</div><div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>#</th><th>Box</th><th>Systems</th><th>Which</th><th>From</th></tr></thead><tbody>' + B.rows.map((r, i) =>
    `<tr${i < 5 ? ' class="top"' : ''}><td class="num">${i + 1}</td><td class="n"><span class="chip" data-look="${r.k}" style="border:0;padding:0;background:none">${r.k}</span><span class="tag">${ways(r.k)}w</span></td><td class="num">${r.n}</td><td>${r.v.map(s => `<span class="tag" title="${esc(s)}">${esc(SY_BL[s] || 'R')}</span>`).join('')} <span style="color:var(--muted)">${esc(r.v.join(', '))}</span></td><td style="font-size:12.5px">${r.seeds.slice(0, 4).map(s => `<span class="mono">${s.n}</span> ${esc(s.c.toUpperCase())}${s.fired && s.fired.length ? ' <b style="color:var(--accent)">F</b>' : ''}`).join(' · ')}${r.seeds.length > 4 ? ` +${r.seeds.length - 4}` : ''}</td></tr>`).join('') + '</tbody></table></div>';
  h += `<div class="ctl" style="margin-top:8px"><button class="btn primary" type="button" data-sycopy="board">Copy the ${B.rows.length} boxes</button><span id="boardCopied" style="color:var(--good);font-size:13px" aria-live="polite"></span></div>`;
  $('boardOut').innerHTML = h; SY_BOARD_LAST = B.rows.map(r => r.k);
  syBacktest();
}
function syBacktest(){                    // grade the board on past days, a few days per tick so the page stays quick
  if(!$('boardCheck')) return;
  const days = +($('boardDays').value || 30), N = +($('boardTop').value || 20), dates = DATES.filter(d => d < syPlayDay()).slice(-days);
  const key = days + '|' + N + '|' + bfAll().length + '|' + syPlayDay();
  if(SY_BT.key === key && SY_BT.rows){ syBtShow(); return; }
  if(SY_BT.running === key) return;
  SY_BT = {key, rows:[], running:key};
  let i = 0;
  const step = () => {
    if(SY_BT.key !== key) return;
    const t0 = performance.now();
    while(i < dates.length && performance.now() - t0 < 40){
      const P = dates[i++], B = syBoard(P, syShift(P, -1), N), set = new Set(B.rows.map(r => r.k));
      let sh = 0; for(const k of set) sh += ways(k); sh /= 1e5;
      const dr = syDrawsOn(P, ''), hits = dr.filter(x => set.has(srt(x.n)));
      SY_BT.rows.push({P, n:dr.length, hits, e:dr.length * sh});
    }
    syBtShow(i < dates.length ? `checking… ${i} of ${dates.length} days` : '');
    if(i < dates.length) setTimeout(step, 0); else SY_BT.running = false;
  };
  setTimeout(step, 30);
}
function syBtShow(msg){
  const R = SY_BT.rows || [], H = R.reduce((s, r) => s + r.hits.length, 0), E = R.reduce((s, r) => s + r.e, 0), N = R.reduce((s, r) => s + r.n, 0);
  let h = `<div class="tiles"><div class="tile"><div class="k">Board's top ${+($('boardTop').value || 20)}, next-day hits</div><div class="v">${H} / ${E.toFixed(1)}</div><div class="k">${R.length} days · came vs chance · ${E ? (H / E).toFixed(2) : '—'}×</div></div>` +
    `<div class="tile"><div class="k">Draws checked</div><div class="v">${N.toLocaleString()}</div><div class="k">box match, any state</div></div></div>`;
  if(msg) h += `<div class="empty">${esc(msg)}</div>`;
  const hitDays = R.filter(r => r.hits.length).slice().reverse();
  h += hitDays.length ? '<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Day</th><th>What the board had that came</th></tr></thead><tbody>' + hitDays.map(r => `<tr><td>${fmtShort(r.P)}</td><td>${r.hits.map(x => `<span class="mono" data-look="${x.n}" style="cursor:pointer;letter-spacing:.05em">${x.n}</span> ${esc(x.c.toUpperCase())} ${esc(slotName(x.c, x.s))}`).join(' · ')}</td></tr>`).join('') + '</tbody></table></div>' : (msg ? '' : '<div class="empty">No hits from the board in these days.</div>');
  h += '<div class="note">Each past day\'s board was built only from draws before that day, then checked against that day\'s draws in every state (box match). "Chance" is how many hits the same number of boxes of the same kinds would get at random. Above 1.00× means the board did better than random picks over these days; to call it real it needs to stay ahead over many weeks.</div>';
  $('boardCheck').innerHTML = h;
}
document.addEventListener('change', e => { if(['boardTop', 'boardDays'].includes(e.target.id)){ store(e.target.id, e.target.value); renderBoard(); } });
document.addEventListener('click', e => { const b = e.target.closest('[data-sycopy="board"]'); if(b) syCopy(SY_BOARD_LAST.join(' '), 'boardCopied', SY_BOARD_LAST.length + ' boxes'); });
(function(){ for(const id of ['boardTop', 'boardDays']){ const v = store(id), el = $(id); if(el && v && [...el.options].some(o => o.value === v)) el.value = v; }
  const base = renderAll; renderAll = function(){ base(); try{ renderBoard(); }catch(err){ console.error(err); if($('boardOut')) $('boardOut').innerHTML = '<div class="empty">The board could not load.</div>'; } }; })();

/* ══ SAME-STATE MIRROR WATCH (Marcus, Nov 26) ══
   Each state's draws from the last 7 days: the full mirror box of the draw (0↔5 1↔6 2↔7 3↔8 4↔9), how many systems
   on this page name that box from the same draw, and whether it has come back in that state (or anywhere) yet.
   Example that started it: LA Nov 20 88263 → mirror 33718 → LA Nov 25 drew 87331 (same box), named by 7 systems.
   Four systems always name a draw's mirror (Grid 5 mirror grid diagonal, Mirror, Mirror mixes, +1 1 1 1 1), so 4 is the floor.
   Tested before it went in (every draw, Aug 2021 – Nov 26 2026, mirror in the same state's next 7 draws):
   4 systems 64 vs 65.3 (0.98x) · 5: 7 vs 7.3 (0.95x) · 6: 13 vs 15.4 (0.85x) · 7+: 6 vs 3.7 (1.64x, 735 draws, not proven). */
const SY_MW_LIVE = '2026-11-27', SY_MW_STRONG = 7;
function sySeedSystems(n){
  const V = new Map(), base = srt(n), put = (k, s) => { if(k === base) return; if(!V.has(k)) V.set(k, new Set()); V.get(k).add(s); };
  for(const [label, inc] of Object.entries(RUNDOWNS)){ const steps = inc === '01123' ? END_STEPS : [1,2,3,4,5,6,7,8,9]; for(const k of steps) put(srt(addInc(base, inc, k)), label); }
  for(const inc of ['67867', '34534']) for(let k = 1; k <= 9; k++) put(srt(addInc(n, inc, k)), 'Rundown ' + inc);
  put(srt(mirror(n)), 'Mirror');
  for(const k of syMixBoxes(n)) put(k, 'Mirror mixes');
  if(typeof lpKeys === 'function'){ try{ let cur = n; for(let k = 0; k < 9; k++){ cur = addInc(cur, '81481', 1); put(srt(cur), 'Lottery Post 814 rundown'); } for(const k of lpKeys(n, 'proj').keys()) put(k, 'Lottery Post projection'); }catch(e){} }
  if(typeof g5Spiral === 'function'){ const B = g5Spiral(n, false), M = g5Map(B, g5Mir); for(const [, l] of g5Lines(B)) put(srt(l), 'Grid 5 base grid'); for(const [, l] of g5Lines(M)) put(srt(l), 'Grid 5 mirror grid'); }
  return V;
}
function syMirrorWatch(asOf, days){
  const t1 = dnum(asOf), rows = [];
  for(const c of syStates()) for(const x of SEQ[c]){ const t = dnum(x.d); if(t > t1 || t <= t1 - days) continue;
    const M = srt(mirror(x.n)); if(M === srt(x.n)) continue;
    const sys = sySeedSystems(x.n).get(M) || new Set(), src = {...x, c};
    let here = null, any = null, since = 0;
    for(const y of SEQ[c]){ if(!syLater(y, src) || y.d > asOf) continue; since++; if(!here && srt(y.n) === M) here = y; }
    for(const y of (BOXIDX.get(M) || [])) if(syLater(y, src) && y.d <= asOf){ any = y; break; }
    rows.push({c, x, M, sys:[...sys], n:sys.size, here, any, since});
  }
  return rows.sort((a, b) => (!!a.here - !!b.here) || b.n - a.n || (a.x.d < b.x.d ? 1 : -1));
}
function syMwLive(){                        // live test: strong mirrors from Nov 27 on, same state's next 7 draws
  const R = [0, 0, 0, 0];                   // came, chance, finished, open
  for(const c of syStates()){ const L = SEQ[c];
    L.forEach((x, i) => { if(x.d < SY_MW_LIVE) return; const M = srt(mirror(x.n)); if(M === srt(x.n)) return;
      if((sySeedSystems(x.n).get(M) || new Set()).size < SY_MW_STRONG) return;
      const nxt = L.slice(i + 1, i + 8); const hit = nxt.some(y => srt(y.n) === M);
      if(nxt.length < 7 && !hit){ R[3]++; return; }
      R[0] += hit ? 1 : 0; R[1] += 1 - Math.pow(1 - ways(M) / 1e5, 7); R[2]++; }); }
  return R;
}
function renderMW(){
  if(!$('mwOut')) return;
  if(!Object.keys(SEQ).length){ $('mwOut').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  const asOf = syPlayDay(), days = +($('mwDays').value || 7), min = +($('mwMin').value || 4);
  const rows = syMirrorWatch(asOf, days).filter(r => r.n >= min);
  const open = rows.filter(r => !r.here), strong = open.filter(r => r.n >= SY_MW_STRONG);
  let h = `<div class="play"><b>${strong.length ? strong.map(r => r.M).join(' ') : 'none'}</b><small>${strong.length ? `Mirror box${strong.length > 1 ? 'es' : ''} named by ${SY_MW_STRONG}+ systems that ${strong.length > 1 ? 'have' : 'has'} not come back in ${strong.length > 1 ? 'their states' : 'its state'} yet` : `No open mirror box has ${SY_MW_STRONG}+ systems behind it right now`} · ${open.length} open of ${rows.length} draws in the last ${days} days with ${min}+ systems.</small></div>`;
  h += '<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>State</th><th>Drew</th><th>Mirror box</th><th>Systems</th><th>Back in that state?</th><th>Anywhere?</th></tr></thead><tbody>' + rows.map(r =>
    `<tr${!r.here && r.n >= SY_MW_STRONG ? ' class="top"' : ''}><td>${esc(nm(r.c))}</td><td><span class="mono" data-look="${r.x.n}" style="cursor:pointer;letter-spacing:.05em">${r.x.n}</span> <span class="tag">${esc(slotName(r.c, r.x.s))} ${fmtShort(r.x.d)}</span></td><td class="n"><span class="chip ${r.here ? 'came' : 'open'}" data-look="${mirror(r.x.n)}">${r.M}<small>${ways(r.M)}w</small></span></td><td><b class="num">${r.n}</b> <span style="color:var(--muted);font-size:12px">${esc(r.sys.join(', '))}</span></td><td>${r.here ? `<span class="mk x">✕</span> ${r.here.n} ${fmtShort(r.here.d)}` : `<span class="mk ok">✓</span> open · ${r.since} draw${r.since === 1 ? '' : 's'} since`}</td><td style="font-size:12.5px">${r.any ? `${r.any.n} ${esc(r.any.c.toUpperCase())} ${fmtShort(r.any.d)}` : '<span style="color:var(--muted)">not yet</span>'}</td></tr>`).join('') + '</tbody></table></div>';
  const L = syMwLive();
  h += `<div class="tiles" style="margin-top:10px"><div class="tile"><div class="k">Live test from ${fmtShort(SY_MW_LIVE)}: ${SY_MW_STRONG}+ system mirrors, back in the same state within 7 draws</div><div class="v">${L[0]} / ${L[1].toFixed(2)}</div><div class="k">${L[2]} finished · ${L[3]} still open · came vs chance</div></div></div>`;
  h += `<div class="note">The mirror box is the draw with every digit flipped (0&harr;5 1&harr;6 2&harr;7 3&harr;8 4&harr;9), played in any order. Four systems always name it (Grid 5 mirror grid diagonal, Mirror, Mirror mixes, +1 1 1 1 1), so 4 is the floor; extra votes come when other rundowns or grid lines land on it too. Example: Louisiana drew 88263 on Nov 20; its mirror box 13378 had 7 systems behind it, and Louisiana drew 87331 on Nov 25. Tested on every draw since Aug 2021 (mirror back in the same state within 7 draws): 4 systems 0.98&times;, 5 systems 0.95&times;, 6 systems 0.85&times;, 7+ systems 6 vs 3.7 by chance (1.64&times;) &mdash; only 735 draws, so not proven. The live tile counts only draws from Nov 27 on.</div>`;
  $('mwOut').innerHTML = h;
}
document.addEventListener('change', e => { if(['mwDays', 'mwMin'].includes(e.target.id)){ store(e.target.id, e.target.value); renderMW(); } });
(function(){ for(const id of ['mwDays', 'mwMin']){ const v = store(id), el = $(id); if(el && v && [...el.options].some(o => o.value === v)) el.value = v; }
  const base = renderAll; renderAll = function(){ base(); try{ renderMW(); }catch(err){ console.error(err); if($('mwOut')) $('mwOut').innerHTML = '<div class="empty">Mirror watch could not load.</div>'; } }; })();

/* ══ WHY THIS NUMBER? (Marcus, Nov 26) ══
   One report for any number: everything on this page that points at it, from the state's and every state's draws.
   Built after the 44004 question (LA): Mirror Doubles set 0459 ready, LA 44009 one flip away, Pick 4 full of its mirror
   digits, date sums calling it on Nov 28-29 — all real, none tested above chance.
   Tested before it went in (every Pick 5 day since Aug 2021, next day, any state, against the same picks checked
   2-30 days later): build-up (most-named boxes over 14 days) top 10 1.11x but later days 1.15x — no timing signal;
   one flip away from the day's draws 1.06x vs 1.00x later (2 of 15 later days as high) — a lean, not proven.
   So the report is context: it explains a number, it does not push it up Today's board. */
function ways4(b){ const c = {}; for(const d of b) c[d] = (c[d] || 0) + 1; let w = 24; for(const v of Object.values(c)) for(let k = 2; k <= v; k++) w /= k; return w; }
function syFlipOne(n){ const out = []; for(let p = 0; p < 5; p++) out.push(n.slice(0, p) + SY_M(n[p]) + n.slice(p + 1)); return out; }
function syP4Share(digits){ const key = 'p4|' + digits; if(SY_SH.has(key)) return SY_SH.get(key); let c = 0;
  for(let i = 0; i < 1e4; i++){ const s = String(i).padStart(4, '0'); if(syP4Hit(s, digits)) c++; } SY_SH.set(key, c / 1e4); return c / 1e4; }
function syP4Hit(p4, digits){ const r = digits.split(''); let k = 0; for(const ch of p4){ const i = r.indexOf(ch); if(i >= 0){ r.splice(i, 1); k++; } } return k >= 3; }   // shares 3+ digits (as a set with repeats)
function renderWhy(){
  if(!$('whyOut')) return;
  if(!Object.keys(SEQ).length){ $('whyOut').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  const sel = $('whyState'); if(sel && sel.options.length <= 1){ sel.innerHTML = '<option value="">All states</option>' + syStates().map(c => `<option value="${c}">${esc(nm(c))}</option>`).join(''); const v = store('whyState'); if(v !== null && v !== undefined) sel.value = v; }
  const N = ($('whyBox').value || '').replace(/\D/g, '');
  if(N.length !== 5){ $('whyOut').innerHTML = '<div class="empty">Type a five-digit number, or tap any number on the page.</div>'; return; }
  const c = sel.value || '', K = srt(N), M = mirror(N), MK = srt(M), asOf = syPlayDay(), t1 = dnum(asOf), w = ways(K);
  const inWin = (x, days) => { const t = dnum(x.d); return t <= t1 && t > t1 - days; };
  const all = bfAll().filter(x => x.d <= asOf), mine = c ? all.filter(x => x.c === c) : all;
  const where = c ? esc(nm(c)) : 'all states';
  const sec = (title, body) => `<div class="sub-h">${title}</div>${body}`;
  let h = '';
  // 1 history and odds
  const came = (BOXIDX.get(K) || []).filter(x => x.d <= asOf), cameHere = c ? came.filter(x => x.c === c) : came, str = came.filter(x => x.n === N);
  const perState = c ? (SEQ[c] || []).length : 0, avgWait = Math.round(1e5 / w);
  h += `<div class="play"><b>${N}</b><small>Box ${K} · ${w}-way · comes about 1 draw in ${avgWait.toLocaleString()} as a box (1 in 100,000 straight). ${cameHere.length ? `Last in ${where}: ${cameHere[cameHere.length - 1].n} ${esc(cameHere[cameHere.length - 1].c.toUpperCase())} ${fmtShort(cameHere[cameHere.length - 1].d)}, ${cameHere[cameHere.length - 1].d.slice(0, 4)}.` : `Not in ${where} since the history starts.`} ${c ? `At one or two draws a day, a ${w}-way box is due in ${esc(nm(c))} only about once every ${Math.round(avgWait / (perState / Math.max(1, (t1 - dnum(SEQ[c][0].d)) / 365)) )} years, so "due" never really applies.` : ''}</small></div>`;
  h += sec(`Every time it came (box) · ${came.length} on file`, came.length ? '<div class="chips">' + came.slice(-12).reverse().map(x => `<span class="chip${x.n === N ? ' hot' : ''}">${x.n}<small>${esc(x.c.toUpperCase())} ${fmtShort(x.d)} ${x.d.slice(0, 4)}${x.n === N ? ' · straight' : ''}</small></span>`).join('') + '</div>' : '<div class="empty">Never on file.</div>');
  // 2 systems that named it (30 days), build-up (14 days)
  const named = []; for(const x of all){ if(!inWin(x, 30)) continue; const s = sySeedSystems(x.n).get(K); if(s && s.size) named.push({x, s:[...s]}); }
  const b14 = named.filter(r => inWin(r.x, 14)).reduce((a, r) => a + r.s.length, 0), maxOne = named.reduce((a, r) => Math.max(a, r.s.length), 0);
  h += sec(`Systems that named it · last 30 days, every state`, named.length ? `<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Day</th><th>State</th><th>Draw</th><th>Systems</th></tr></thead><tbody>${named.slice().reverse().map(r => `<tr${c && r.x.c === c ? ' class="top"' : ''}><td>${fmtShort(r.x.d)}</td><td>${esc(r.x.c.toUpperCase())}</td><td class="mono">${r.x.n}</td><td>${esc(r.s.join(', '))}</td></tr>`).join('')}</tbody></table></div><div class="note" style="margin-top:4px">${named.length} draws named it; the most from one draw was ${maxOne} system${maxOne === 1 ? '' : 's'}${maxOne >= 2 ? '' : ' (never two at once, so it never reached Today\'s board)'}. Build-up over the last 14 days: ${b14} mention${b14 === 1 ? '' : 's'}.</div>` : '<div class="empty">No system named it in the last 30 days.</div>');
  // 3 one flip away
  const flips = mine.filter(x => inWin(x, 14) && syFlipOne(x.n).some(v => srt(v) === K)).map(x => ({x, exact: syFlipOne(x.n).includes(N)}));
  h += sec(`One mirror flip away · last 14 days, ${where}`, flips.length ? '<div class="chips">' + flips.reverse().map(r => `<span class="chip${r.exact ? ' hot' : ''}" data-look="${r.x.n}">${r.x.n}<small>${esc(r.x.c.toUpperCase())} ${fmtShort(r.x.d)}${r.exact ? ' · flips to ' + N + ' exactly' : ' · flips to the box'}</small></span>`).join('') + '</div>' : '<div class="empty">No draw was one flip away.</div>');
  // 4 mirror doubles
  const md = syMdState(asOf, '', 7).filter(z => z.S.mem.some(p => syHas(K, p)));
  h += sec('Mirror Doubles sets it belongs to · last 7 days, all states', md.length ? md.map(z => `<div style="font-size:13.5px;margin:3px 0"><b class="mono">${z.S.name}</b> set (${z.S.mem.map(p => p + 'x').join(' ')}): ${z.n} of 5 came${z.ready ? ` — <b>ready</b>, open plays ${z.rest.map(p => (syHas(K, p) ? '<b>' + p + 'x</b>' : p + 'x')).join(' ')}` : ' — not ready'}. ${z.S.mem.map((p, i) => z.came[i].length ? `${p}x: ${z.came[i].slice(-2).map(x => x.n + ' ' + x.c.toUpperCase() + ' ' + fmtShort(x.d)).join(', ')}` : '').filter(Boolean).join(' · ')}</div>`).join('') : '<div class="empty">It holds no Mirror Doubles set member (it needs a single like 0156x or a double pair like 0011x).</div>');
  // 5 mirror side and Pick 4
  const p5m = all.filter(x => inWin(x, 14)).filter(x => [...sySubs(x.n, 4)].some(s => syHas(MK, s)));
  const p5mShare = syShare({k:'pat', v:[...sySubs(MK, 4)]});
  let p4n = 0, p4m = 0, p4k = 0, p4list = [];
  for(const [d, m] of P4DAY){ const t = dnum(d); if(t > t1 || t <= t1 - 14) continue; for(const cc in m) for(const x of m[cc]){ p4n++; if(syP4Hit(x.n, MK)){ p4m++; p4list.push({d, c:cc, n:x.n}); } if(syP4Hit(x.n, K)) p4k++; } }
  const sM = syP4Share(MK), sK = syP4Share(K);
  h += sec(`Its mirror side · mirror ${M} (box ${MK}) · last 14 days`, `<div style="font-size:13.5px">Pick 5 draws holding 4 of its mirror's digits: <b>${p5m.length}</b> vs ${(all.filter(x => inWin(x, 14)).length * p5mShare).toFixed(1)} by chance${p5m.length ? ' (' + p5m.slice(-6).map(x => x.n + ' ' + x.c.toUpperCase()).join(', ') + ')' : ''}.<br>Pick 4 draws (every state) sharing 3+ digits with its mirror: <b>${p4m}</b> vs ${(p4n * sM).toFixed(1)} by chance${p4list.length ? ' (latest ' + p4list.sort((a, b) => a.d < b.d ? 1 : -1).slice(0, 8).map(x => x.n + ' ' + x.c.toUpperCase()).join(', ') + ')' : ''}. Sharing 3+ digits with the number itself: <b>${p4k}</b> vs ${(p4n * sK).toFixed(1)}.</div>`);
  // 6 coming dates
  const cal = []; for(let k = 0; k <= 7; k++){ const d = syShift(asOf, k), hits = ['last3', 'md', 'mdy', 'rmd', 'rmdy'].filter(id => syMatch(N, syDsSpec(id, d))).map(id => SY_DS.find(v => v.id === id).name); if(hits.length) cal.push(`<b>${fmtShort(d)}</b>: ${esc(hits.join(', '))}`); }
  h += sec('Date sums that call it · today and the next 7 days', cal.length ? `<div style="font-size:13.5px;line-height:1.6">${cal.join('<br>')}</div>` : '<div class="empty">No date sum calls it this week.</div>');
  // 6b near misses, Pick 4 triggers, grid lines one digit off (last 14 days)
  const shareN = a => { const x = K.split(''); let k = 0; for(const ch of a){ const i = x.indexOf(ch); if(i >= 0){ x.splice(i, 1); k++; } } return k; };
  const nearKey = 'near|' + K; let nearShare = SY_SH.get(nearKey); if(nearShare === undefined){ let c4 = 0; for(let i = 0; i < 1e5; i++) if(shareN(String(i).padStart(5, '0')) === 4) c4++; nearShare = c4 / 1e5; SY_SH.set(nearKey, nearShare); }
  const w14 = all.filter(x => inWin(x, 14)), near = w14.filter(x => shareN(x.n) === 4);
  h += sec(`Near misses · Pick 5 draws holding 4 of its 5 digits · last 14 days, every state`, (near.length ? '<div class="chips">' + near.slice().reverse().map(x => `<span class="chip${c && x.c === c ? ' hot' : ''}" data-look="${x.n}">${x.n}<small>${esc(x.c.toUpperCase())} ${fmtShort(x.d)}</small></span>`).join('') + '</div>' : '<div class="empty">None.</div>') + `<div class="note" style="margin-top:4px">${near.length} vs ${(w14.length * nearShare).toFixed(1)} by chance in ${w14.length} draws.</div>`);
  const cnt = {}; for(const ch of N) cnt[ch] = (cnt[ch] || 0) + 1;
  const tripD = Object.keys(cnt).filter(d => cnt[d] >= 3), subs4 = [...sySubs(K, 4)];
  const p4trip = [], p4four = []; let p4n14 = 0;
  for(const [d, m] of P4DAY){ const t = dnum(d); if(t > t1 || t <= t1 - 14) continue; for(const cc in m) for(const x of m[cc]){ p4n14++;
    if(tripD.some(dd => x.n.split(dd).length - 1 >= 3)) p4trip.push({d, c:cc, n:x.n}); else if(subs4.includes(srt(x.n))) p4four.push({d, c:cc, n:x.n}); } }
  const tripShare = tripD.length ? tripD.length * 37 / 1e4 : 0, fourShare = subs4.reduce((a, q) => a + ways4(q), 0) / 1e4;
  const p4chips = L => L.sort((a, b) => a.d < b.d ? 1 : -1).map(x => `<span class="chip"><span>${x.n}</span><small>${esc(x.c.toUpperCase())} ${fmtShort(x.d)}</small></span>`).join('');
  h += sec('Pick 4 triggers · last 14 days, every state', `<div style="font-size:13.5px">${tripD.length ? `Pick 4 triples of ${tripD.map(d => d + d + d).join(' / ')} (the Pick 4 → Pick 5 trigger): <b>${p4trip.length}</b> vs ${(p4n14 * tripShare).toFixed(1)} by chance` : 'It has no triple, so no Pick 4 triple trigger applies'}.${p4trip.length ? '<div class="chips" style="margin:4px 0">' + p4chips(p4trip) + '</div>' : ''}<br>Pick 4 draws holding four of its digits (${subs4.join(', ')}): <b>${p4four.length}</b> vs ${(p4n14 * fourShare).toFixed(1)} by chance.${p4four.length ? '<div class="chips" style="margin:4px 0">' + p4chips(p4four) + '</div>' : ''}</div>`);
  const gnear = []; let glines = 0;
  for(const x of mine){ if(!inWin(x, 14)) continue; const B = g5Spiral(x.n, false), MG = g5Map(B, g5Mir);
    for(const [gn, g] of [['base', B], ['mirror', MG]]) for(const [lab, l] of g5Lines(g)){ if(gn === 'base' && lab === 'diagonal') continue; glines++; if(shareN(l) === 4) gnear.push(`${l} · ${x.c.toUpperCase()} ${x.n} ${fmtShort(x.d)} · ${gn} ${lab}`); } }
  h += sec(`Grid 5 lines one digit off · last 14 days, ${where}`, (gnear.length ? `<div style="font-size:13px;line-height:1.6">${gnear.slice(-12).reverse().map(esc).join('<br>')}${gnear.length > 12 ? `<br><span style="color:var(--muted)">+${gnear.length - 12} more</span>` : ''}</div>` : '<div class="empty">None.</div>') + `<div class="note" style="margin-top:4px">${gnear.length} of ${glines} grid lines vs ${(glines * nearShare).toFixed(1)} by chance (grid rows and columns rarely repeat a digit, so numbers with doubles or triples land one-off less often).</div>`);
  // 7 grid
  const gr = []; for(const x of mine){ if(!inWin(x, 30)) continue; const B = g5Spiral(x.n, false), MG = g5Map(B, g5Mir);
    for(const [gn, g] of [['Base', B], ['Mirror', MG]]) for(const [lab, l] of g5Lines(g)) if(srt(l) === K) gr.push(`${x.n} ${x.c.toUpperCase()} ${fmtShort(x.d)} · ${gn} ${lab} (${l})`); }
  h += sec(`Grid 5 · every draw in the last 30 days, ${where}`, gr.length ? `<div style="font-size:13.5px">${gr.map(esc).join('<br>')}</div>` : '<div class="empty">No grid line produced it.</div>');
  // verdict
  const pts = [named.length ? `${named.length} single-system mention${named.length > 1 ? 's' : ''}` : '', flips.length ? `${flips.length} draw${flips.length > 1 ? 's' : ''} one flip away` : '', md.some(z => z.ready && z.rest.some(p => syHas(K, p))) ? 'a ready Mirror Doubles set' : '', p4m > p4n * sM * 1.25 ? 'Pick 4 heavy on its mirror digits' : '', cal.length ? `date sums on ${cal.length} day${cal.length > 1 ? 's' : ''} this week` : '', gr.length ? 'Grid 5 lines' : '', near.length > w14.length * nearShare * 1.5 ? `${near.length} near misses (4 of 5)` : '', p4trip.length > p4n14 * tripShare * 1.5 && p4trip.length >= 2 ? `${p4trip.length} Pick 4 triple triggers` : ''].filter(Boolean);
  h = `<div class="note" style="margin:0 0 10px;font-size:13.5px;color:var(--ink)"><b>In short:</b> ${pts.length ? 'what points at it — ' + pts.join(' · ') + '.' : 'nothing on this page points at it right now.'} None of these pieces has beaten chance in testing; together they explain why a number feels "around," not that it will come.</div>` + h;
  h += '<div class="note">Tested before this went in, on every Pick 5 day since Aug 2021: the most-named boxes over 14 days ran 1.11&times; the next day but 1.15&times; on later days too, so there is no timing signal; numbers one flip from the day\'s draws ran 1.06&times; the next day against 1.00&times; on later days (a lean, not proven). So this report explains a number; it does not move it up Today\'s board.</div>';
  $('whyOut').innerHTML = h;
}
document.addEventListener('change', e => { if(e.target.id === 'whyState'){ store('whyState', e.target.value); renderWhy(); } });
document.addEventListener('input', e => { if(e.target.id === 'whyBox'){ const v = e.target.value.replace(/\D/g, ''); if(v.length === 5 || !v.length) renderWhy(); } });
document.addEventListener('click', e => { const l = e.target.closest('[data-look]'); if(l && /^\d{5}$/.test(l.dataset.look) && $('whyBox') && !e.target.closest('#pWhy')){ $('whyBox').value = l.dataset.look; try{ renderWhy(); }catch(err){} } });
(function(){ const base = renderAll; renderAll = function(){ base(); try{ renderWhy(); }catch(err){ console.error(err); if($('whyOut')) $('whyOut').innerHTML = '<div class="empty">This report could not load.</div>'; } }; })();

/* ══ ONE FLIP AWAY · live test (Marcus, Nov 26) ══
   Every draw of a day → its five one-digit mirror flips (44009 → 54009 49009 44509 44059 44004), as boxes.
   Graded on the next day's draws in every state. Look back (Aug 2021 – Nov 26 2026): 861 vs 814.6 by chance (1.06x),
   against 1.00x when the same boxes are checked 2-30 days later (2 of 15 later days as high) — a lean, not proven.
   The live count starts with the Nov 27, 2026 draws. */
const SY_FLIP_LIVE = '2026-11-27';
function syFlipBoxes(day){ const B = new Set(), own = new Set(); for(const c in SEQ) for(const x of SEQ[c]) if(x.d === day){ own.add(srt(x.n)); for(const v of syFlipOne(x.n)) B.add(srt(v)); } own.forEach(b => B.delete(b)); return B; }
function syFlipLive(){
  const R = [0, 0, 0];
  const days = DATES.filter(d => d >= SY_FLIP_LIVE);
  for(const d of days){ const nx = syShift(d, 1); if(!DATES.includes(nx)) continue; const B = syFlipBoxes(d); let sh = 0; B.forEach(b => sh += ways(b)); sh /= 1e5;
    const dr = syDrawsOn(nx, ''); R[0] += dr.filter(x => B.has(srt(x.n))).length; R[1] += dr.length * sh; R[2]++; }
  return R;
}
function renderFlip(){
  if(!$('flipOut') || !Object.keys(SEQ).length) return;
  const d = syPlayDay(), B = [...syFlipBoxes(d)].sort(), R = syFlipLive();
  $('flipOut').innerHTML = `<div class="tiles"><div class="tile"><div class="k">Live test from ${fmtShort(SY_FLIP_LIVE)}: one flip away → next day, any state</div><div class="v">${R[0]} / ${R[1].toFixed(1)}</div><div class="k">${R[2]} day${R[2] === 1 ? '' : 's'} graded · came vs chance${R[1] > 0 ? ' · ' + (R[0] / R[1]).toFixed(2) + '×' : ''}</div></div></div>
    <div style="font-size:13.5px">${fmtShort(d)}'s draws make <b>${B.length}</b> one-flip boxes for the next day. <button class="btn" type="button" data-sycopy="flip">Copy them</button> <span id="flipCopied" style="color:var(--good);font-size:13px" aria-live="polite"></span></div>
    <div class="note">One flip away: change one digit of a draw to its mirror (0&harr;5 1&harr;6 2&harr;7 3&harr;8 4&harr;9) &mdash; Louisiana&rsquo;s 44009 &rarr; 44004. Look back on every day since Aug 2021: 861 next-day hits vs 814.6 by chance (1.06&times;), but only 1.00&times; when the same boxes are checked 2&ndash;30 days later, so it is a lean, not proven. With about 90 boxes a day it is far too many to play; it is tracked to see whether the lean holds. The live tile counts only from ${fmtShort(SY_FLIP_LIVE)} on.</div>`;
  SY_FLIP_LAST = B;
}
let SY_FLIP_LAST = [];
document.addEventListener('click', e => { const b = e.target.closest('[data-sycopy="flip"]'); if(b) syCopy(SY_FLIP_LAST.join(' '), 'flipCopied', SY_FLIP_LAST.length + ' boxes'); });
(function(){ const base = renderAll; renderAll = function(){ base(); try{ renderFlip(); }catch(err){ console.error(err); } }; })();
