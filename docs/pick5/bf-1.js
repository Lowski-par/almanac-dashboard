/* Brings & Follows + Hot list.
   A rule is: trigger pattern (4 or 5 digits, any order; 4 digits = any fifth digit) -> follower patterns (same shape).
   Every rule is graded on every draw on file: how often a follower came within 3 / 7 days of the trigger,
   in the same state and anywhere, against what random draws would give.
   Uses SEQ, CODES, STATES, DATES, CUR_DAY, srt, dnum, fmtShort, fmtD, slotName, esc, nm, store, $,
   RUNDOWNS, END_STEPS, addInc, mirror, LP_LISTS, BOXIDX, cameAnywhereAfter from app-1.js. */
'use strict';
const BF_BUILTIN = [
  {id:'r1', name:'Rule #1', trig:'5231', fol:['4444','4449','4499','4999','9999'], note:'Any 5231, any order (5231x in Pick 5), brings the 4/9 family: 444x and 999x — 4449, 4444, 9999, 4499, 9994.'}
];
let BF_RULES = BF_BUILTIN.slice();
let BF_MINE = (function(){ const v = store('bfMine'); return Array.isArray(v) ? v.filter(r => r && r.trig && Array.isArray(r.fol)) : []; })();
let BF_ALL = null, BF_SCORE = new Map(), BF_SCORE_N = -1;

const bfClean = s => String(s||'').replace(/\D/g,'');
function bfMatch(n, p){                      // draw n (5 digits) holds every digit of pattern p, any order
  const rem = n.split('');
  for(const d of p){ const i = rem.indexOf(d); if(i < 0) return false; rem.splice(i,1); }
  return true;
}
const bfMatchAny = (n, ps) => ps.some(p => bfMatch(n, p));
function bfAll(){                             // every draw on file in time order, with its day number
  const n = Object.keys(SEQ).reduce((s,c)=>s+SEQ[c].length,0);
  if(BF_ALL && BF_ALL.length === n) return BF_ALL;
  const a = []; for(const c in SEQ) for(const x of SEQ[c]) a.push({c, d:x.d, s:x.s, n:x.n, t:dnum(x.d)});
  a.sort((p,q)=> p.t-q.t || (p.s===q.s?0:p.s==='m'?-1:1)); BF_ALL = a; BF_SCORE = new Map(); return a;
}
function bfLo(a, t){ let lo=0, hi=a.length; while(lo<hi){ const m=(lo+hi)>>1; if(a[m].t < t) lo=m+1; else hi=m; } return lo; }  // first index with day >= t
function bfScore(rule){                       // came / chance for 3- and 7-day windows, same state and anywhere
  const key = rule.trig + '>' + rule.fol.join(',');
  const all = bfAll();
  if(BF_SCORE.has(key)) return BF_SCORE.get(key);
  const isF = all.map(x => bfMatchAny(x.n, rule.fol));
  const base = isF.filter(Boolean).length / Math.max(1, all.length);
  const trig = []; all.forEach((x,i)=>{ if(bfMatch(x.n, rule.trig)) trig.push(i); });
  const W = {3:{a:0,ae:0,s:0,se:0}, 7:{a:0,ae:0,s:0,se:0}};
  for(const i of trig){ const x = all[i];
    for(const w of [3,7]){ const lo = bfLo(all, x.t+1), hi = bfLo(all, x.t+w+1);
      let na=0, ns=0, ha=false, hs=false;
      for(let j=lo;j<hi;j++){ na++; if(isF[j]) ha=true; if(all[j].c===x.c){ ns++; if(isF[j]) hs=true; } }
      W[w].a += ha?1:0; W[w].ae += 1-Math.pow(1-base, na); W[w].s += hs?1:0; W[w].se += 1-Math.pow(1-base, ns);
    }
  }
  const z = (h,e) => e > 0 ? (h-e)/Math.sqrt(e) : 0;
  const best = Math.max(z(W[3].a,W[3].ae), z(W[7].a,W[7].ae), z(W[3].s,W[3].se), z(W[7].s,W[7].se));
  const worst = Math.min(z(W[3].a,W[3].ae), z(W[7].a,W[7].ae), z(W[3].s,W[3].se), z(W[7].s,W[7].se));
  const verdict = trig.length < 10 ? 'few' : best >= 2 ? 'beats' : worst <= -2 ? 'under' : 'chance';
  const out = {n:trig.length, base, W, verdict, lastTrig: trig.length ? all[trig[trig.length-1]] : null};
  BF_SCORE.set(key, out); return out;
}
function bfRecent(rule, asOf, days){          // triggers fired in the last `days` days up to asOf, with what followed
  const all = bfAll(), t1 = dnum(asOf), out = [];
  for(let i = bfLo(all, t1-days+1); i < all.length && all[i].t <= t1; i++){ const x = all[i]; if(!bfMatch(x.n, rule.trig)) continue;
    const fol = []; for(let j=i+1;j<all.length && all[j].t <= x.t+7;j++) if(bfMatchAny(all[j].n, rule.fol)) fol.push(all[j]);
    out.push({x, fol, open: t1 - x.t < 7});
  }
  return out.reverse();
}
const bfVerdict = v => v==='beats' ? '<span class="mk ok">beats chance</span>' : v==='under' ? '<span class="mk x">below chance</span>' : v==='few' ? '<span style="color:var(--muted)">too few to grade</span>' : '<span style="color:var(--muted)">at chance</span>';
const bfRatio = (h,e) => e > 0 ? (h/e).toFixed(2)+'×' : '—';
function bfFam(p){ return p.length === 5 ? [srt(p)] : [...'0123456789'].map(d => srt(p+d)); }   // boxes a pattern covers

function renderBF(){
  if(!$('bfOut')) return;
  const asOf = CUR_DAY || DATES[DATES.length-1]; if(!asOf || !Object.keys(SEQ).length){ $('bfOut').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  const rules = BF_RULES.concat(BF_MINE.map(r => ({...r, mine:true})));
  let h = '';
  for(const r of rules){
    const S = bfScore(r), rec = bfRecent(r, asOf, 14);
    const cell = (k, w) => `<td class="num">${S.W[w][k]} / ${S.W[w][k+'e'].toFixed(1)} <span class="tag">${bfRatio(S.W[w][k], S.W[w][k+'e'])}</span></td>`;
    h += `<div class="card" style="margin-bottom:10px"><h3><span>${esc(r.name||'Rule')}${r.mine?' <span class="tag">only on this device</span>':''}</span><span>${bfVerdict(S.verdict)}</span></h3>
      <div class="from"><b>${esc(r.trig)}${r.trig.length===4?'x':''}</b> brings ${r.fol.map(f=>`<span class="chip" data-look="${esc(f.length===5?f:f)}" style="padding:1px 6px;font-size:13px">${esc(f)}${f.length===4?'x':''}</span>`).join(' ')}${r.note?`<div style="margin-top:4px">${esc(r.note)}</div>`:''}</div>
      <div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Trigger drew ${S.n} times</th><th>Came in 3 days / chance</th><th>Came in 7 days / chance</th></tr></thead><tbody>
        <tr><td>Anywhere (${Object.keys(SEQ).length} states)</td>${cell('a',3)}${cell('a',7)}</tr>
        <tr><td>Same state</td>${cell('s',3)}${cell('s',7)}</tr></tbody></table></div>`;
    h += '<div class="sub-h" style="margin-top:10px">Fired in the last 14 days</div>';
    h += rec.length ? '<div class="tw"><table class="t" style="font-size:13px"><thead><tr><th>Trigger</th><th>Followers so far (7 days)</th></tr></thead><tbody>' + rec.map(e =>
      `<tr><td><span class="chip" data-look="${e.x.n}" style="border:0;padding:0;background:none">${e.x.n}</span> ${esc(nm(e.x.c))} ${esc(slotName(e.x.c,e.x.s))} ${fmtShort(e.x.d)}</td><td>${
        e.fol.length ? e.fol.map(f=>`<span class="chip came" data-look="${f.n}" style="text-decoration:none">${f.n}<small>${esc(nm(f.c))} ${fmtShort(f.d)}${f.c===e.x.c?' · same state':''}</small></span>`).join(' ')
        : (e.open ? `<span class="chip open">waiting<small>day ${dnum(asOf)-e.x.t} of 7</small></span>` : '<span style="color:var(--muted)">none in 7 days</span>')}</td></tr>`).join('') + '</tbody></table></div>'
      : '<div class="empty" style="font-size:13px">This trigger has not drawn in the last 14 days.</div>';
    if(r.mine) h += `<button class="btn" type="button" data-bfdel="${esc(r.id)}" style="margin-top:8px;padding:3px 10px">Remove this rule</button>`;
    h += '</div>';
  }
  $('bfOut').innerHTML = h;
}
function bfAdd(){
  const trig = bfClean($('bfTrig').value), fol = ($('bfFol').value||'').split(/[\s,]+/).map(bfClean).filter(Boolean);
  const msg = $('bfMsg');
  if(trig.length < 4 || trig.length > 5){ msg.textContent = 'The trigger needs 4 or 5 digits.'; return; }
  if(!fol.length || fol.some(f => f.length < 4 || f.length > 5)){ msg.textContent = 'Each follower needs 4 or 5 digits (space between them).'; return; }
  const name = ($('bfName').value||'').trim() || ('Rule #' + (BF_BUILTIN.length + BF_MINE.length + 1));
  BF_MINE.push({id:'m'+Date.now(), name, trig:srt(trig), fol:[...new Set(fol.map(srt))]}); store('bfMine', BF_MINE);
  $('bfTrig').value = $('bfFol').value = $('bfName').value = ''; msg.textContent = ''; renderBF(); renderHot();
}

/* ── hot list: every system's votes for the day, strongest agreement first ── */
function renderHot(){
  if(!$('convOut')) return;
  const asOf = CUR_DAY || DATES[DATES.length-1]; if(!asOf) return;
  const tally = new Map();
  const add = (key, sys, c, strong) => { const t = tally.get(key) || {sys:new Set(), states:new Set(), strong:0}; t.sys.add(sys); if(c) t.states.add(c); if(strong) t.strong++; tally.set(key, t); };
  // rundowns and mirror, from each state's last draw (all graded at chance in Methods tested)
  const srcs = { ...RUNDOWNS, 'Mirror':null, 'Rundown 67867':'67867', 'Rundown 34534':'34534' };
  for(const c of CODES){ const sq = SEQ[c]; if(!sq) continue;
    let idx=-1; for(let i=sq.length-1;i>=0;i--) if(sq[i].d<=asOf){ idx=i; break; } if(idx<0) continue;
    const n = sq[idx].n, base = srt(n);
    for(const [label, inc] of Object.entries(srcs)){
      if(label==='Mirror'){ if(srt(mirror(n))!==base) add(srt(mirror(n)), label, c, false); continue; }
      const steps = inc==='01123' ? END_STEPS : [1,2,3,4,5,6,7,8,9], from = label.startsWith('Rundown') ? n : base;
      for(const k of steps){ const key = srt(addInc(from, inc, k)); if(key!==base) add(key, label, c, false); }
    }
    // Lottery Post methods for this state (worked by renderLP from the same last draw)
    if(typeof LP_LISTS === 'object' && LP_LISTS[c]) for(const k of String(LP_LISTS[c]).split(' ').filter(Boolean)) add(srt(k), 'Lottery Post methods', c, false);
  }
  // brings & follows: rules whose trigger fired in the last 7 days
  for(const r of BF_RULES.concat(BF_MINE)){ const S = bfScore(r);
    for(const e of bfRecent(r, asOf, 7)) for(const f of r.fol) for(const key of bfFam(f)) add(key, 'Brings & follows · '+(r.name||r.trig), e.x.c, S.verdict==='beats');
  }
  if(typeof sysHotVotes === 'function'){ try{ sysHotVotes(tally, add, asOf); }catch(err){} }
  const top = [...tally.entries()].map(([k,t])=>({k, m:t.sys.size, s:t.states.size, strong:t.strong, t}))
    .filter(x => x.m >= 2 || x.strong).sort((a,b)=> (b.strong-a.strong) || (b.m-a.m) || (b.s-a.s) || a.k.localeCompare(b.k)).slice(0,30);
  if(!top.length){ $('convOut').innerHTML='<div class="empty">No number has two or more systems behind it today.</div>'; return; }
  let h = '<div class="chips">';
  for(const x of top){ const L = cameAnywhereAfter(asOf, x.k);
    h += `<span class="chip ${L?'came':(x.strong?'hot':'')}" data-look="${x.k}" title="${esc([...x.t.sys].join(', ')+' · from '+[...x.t.states].map(nm).join(', '))}">${x.k}<small>${x.m} system${x.m>1?'s':''} · ${x.s} state${x.s!==1?'s':''}${x.strong?' · ★':''}</small></span>`; }
  const came = top.map(x=>({k:x.k, a:(BOXIDX.get(x.k)||[]).filter(d=>d.d>asOf)})).filter(x=>x.a.length);
  h += `</div><div class="sub-h" style="margin:12px 0 4px;font-size:11.5px">Came since ${fmtShort(asOf)}, any state · ${came.length} of ${top.length}</div>` +
    (came.length ? `<div style="font-size:12.5px;line-height:1.55;color:var(--ink-2)">${came.map(x=>`<span class="mono" style="letter-spacing:.06em">${x.k}</span> → `+x.a.map(d=>`${esc(d.c.toUpperCase())} ${esc(slotName(d.c,d.s))} ${fmtShort(d.d)} <span class="mono">(${d.n})</span>`).join(', ')).join('<br>')}</div>` : '<div class="empty" style="font-size:12.5px;padding:0">None yet.</div>');
  h += '<div class="note">Every system on this page votes from the day\'s draws: the five workbook rundowns, the mirror, the 67867 and 34534 rundowns, the Lottery Post methods, the mirror mixes (each digit kept or flipped), and any Brings &amp; follows rule whose trigger fired in the last 7 days. Then a named number picks up a vote for holding today\'s last digit triads, the date sum, a state\'s longest-out triads, or a ready Mirror Doubles set. A number is listed when two or more systems name it, ordered by how many agree. ★ marks a vote from a rule that beats chance in its scorecard. Hover a number for its sources. Honest reading: in testing, numbers that several systems agreed on came at the same rate as random boxes, so treat agreement as a shortlist, not a signal.</div>';
  $('convOut').innerHTML = h;
}

document.addEventListener('click', e=>{
  const d = e.target.closest('[data-bfdel]'); if(d){ BF_MINE = BF_MINE.filter(r => r.id !== d.dataset.bfdel); store('bfMine', BF_MINE); renderBF(); renderHot(); return; }
  if(e.target.id === 'bfAdd') bfAdd();
});
(function(){
  fetch('bf-rules.json', {cache:'no-cache'}).then(r => r.ok ? r.json() : null).then(j => { if(j && Array.isArray(j.rules) && j.rules.length){ BF_RULES = j.rules.filter(r => r && r.trig && Array.isArray(r.fol)); BF_SCORE = new Map(); renderBF(); renderHot(); } }).catch(()=>{});
  const base = renderAll; renderAll = function(){ base(); try{ renderBF(); }catch(err){ if($('bfOut')) $('bfOut').innerHTML = '<div class="empty">Brings &amp; follows could not load.</div>'; } try{ renderHot(); }catch(err){} };
})();
