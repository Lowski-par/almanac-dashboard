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
const SY_BL = {'Last digit triads':'D', 'Date sum':'S', 'Date sum pairs':'S', 'Date sum fired':'F', 'Longest-out triads':'P', 'Longest-out fours':'Q', 'Mirror Doubles':'M', 'Mirror mixes':'X', 'Mirror':'X', 'Lottery Post 814 rundown':'L', 'Lottery Post projection':'L', 'Brings & follows':'B'};
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
