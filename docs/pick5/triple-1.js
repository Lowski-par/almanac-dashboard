/* Triple watch — how long each Pick 5 state has gone without three of each digit,
   plus two live forward tests that start Oct 14, 2026:
   1. Long-out: when a state/digit reaches 234 draws without a triple, does it come in that state's next 14 draws more than chance?
   2. Travel: after a Pick 5 triple in one state, does the same triple come in another Pick 5 state within 7 days more than chance?
   Uses SEQ, STATES, CODES, DATES, P3X, coverFor, dnum, fmtShort, slotName, esc, nm, store from app-1.js. */
'use strict';
const TW_START = '2026-10-14', TW_LONG = 234, TW_RUN = 14, TW_AVG = 117;
const twHas = (n, d) => n.split(d).length - 1 >= 3;
let TW_SEL = (function(){ const v = store('twSel'); return (v && /^[a-z]{2}\|\d$/.test(v)) ? v : 'oh|8'; })();

function twPair(c, d){                 // gap now, last hit, longest gap seen, draws on file
  const L = SEQ[c] || []; let last = -1, longest = 0, lastHit = null;
  L.forEach((x, i) => { if(twHas(x.n, d)){ if(last >= 0) longest = Math.max(longest, i - last - 1); last = i; lastHit = x; } });
  const gap = last >= 0 ? L.length - 1 - last : L.length;
  return {gap, never: last < 0, lastHit, longest: Math.max(longest, gap), n: L.length, first: L[0] && L[0].d};
}
function twLongOut(){                  // live long-out windows, starting Oct 14
  const ev = [];
  for(const c in SEQ){ const L = SEQ[c];
    for(let d = 0; d < 10; d++){ const D = String(d); let last = -1, act = null;
      L.forEach((x, i) => {
        const gap = last >= 0 ? i - last - 1 : -1;
        if(!act && x.d >= TW_START && gap >= TW_LONG){ act = {c, d: D, start: x, gap, draws: 0, hits: []}; ev.push(act); }
        if(act){ act.draws++; if(twHas(x.n, D)) act.hits.push(x); if(act.draws >= TW_RUN) act = null; }
        if(twHas(x.n, D)) last = i;
      });
    }
  }
  return ev;
}
function twTravel(e){                  // other Pick 5 states, 7 days after a Pick 5 triple
  const X = tripDigit(e.n), d0 = dnum(e.d), lastD = DATES.length ? dnum(DATES[DATES.length-1]) : d0;
  const hits = []; let draws = 0;
  for(const c in SEQ){ if(c === e.c) continue; for(const x of SEQ[c]){ const k = dnum(x.d); if(k > d0 && k <= d0 + 7){ draws++; if(twHas(x.n, X)) hits.push({...x, c}); } } }
  hits.sort((a,b)=> a.d<b.d?-1:a.d>b.d?1:0);
  return {X, hits, exp: P3X * draws, daysIn: Math.max(0, Math.min(7, lastD - d0)), done: lastD - d0 >= 7};
}
function twLevel(g){ return g >= 3*TW_AVG ? 'l3' : g >= 2*TW_AVG ? 'l2' : g >= TW_AVG ? 'l1' : ''; }

function renderTW(){
  if(!$('twGrid')) return;
  const codes = CODES.filter(c => SEQ[c]);
  if(!codes.length){ $('twGrid').innerHTML = '<div class="empty">Loading draws…</div>'; return; }
  if(!SEQ[TW_SEL.split('|')[0]]) TW_SEL = codes[0] + '|8';
  // grid
  let h = '<table class="t twg"><thead><tr><th>State</th>' + [...'0123456789'].map(d=>`<th class="c">${d}${d}${d}</th>`).join('') + '</tr></thead><tbody>';
  for(const c of codes){
    h += `<tr><td>${esc(nm(c))}</td>`;
    for(let d = 0; d < 10; d++){ const p = twPair(c, String(d)), k = c+'|'+d;
      h += `<td class="c"><button type="button" class="twc ${twLevel(p.gap)}${k===TW_SEL?' sel':''}" data-tw="${k}" aria-label="${esc(nm(c))} ${d}${d}${d}: ${p.gap} draws">${p.never?p.gap+'+':p.gap}</button></td>`;
    }
    h += '</tr>';
  }
  $('twGrid').innerHTML = h + '</tbody></table>';
  // selected pair
  const [sc, sd] = TW_SEL.split('|'), p = twPair(sc, sd), X = sd+sd+sd;
  const ch14 = (1 - Math.pow(1 - P3X, 14)) * 100;
  $('twSelOut').innerHTML = `<div class="play"><b>${X}xx</b> in ${esc(nm(sc))}: <span class="mono">${p.never?p.gap+'+':p.gap}</span> draws since the last one
    <small>${p.lastHit ? `Last: <span class="mono">${p.lastHit.n}</span>, ${esc(slotName(sc,p.lastHit.s))} ${fmtD(p.lastHit.d)}.` : `None since this state's history starts (${fmtShort(p.first)}).`}
    Longest wait on file: ${p.longest} draws. Average wait: about ${TW_AVG}. Chance it comes in ${esc(nm(sc))}'s next draw: 0.86%; in its next 14 draws: ${ch14.toFixed(1)}%. Covering all 55 boxes costs $55 a draw.</small></div>
    <button class="btn" type="button" data-twcopy="${sd}">Copy the 55 ${X}xx boxes</button> <span id="twCopied" style="color:var(--good);font-size:13px" aria-live="polite"></span>`;
  // live tests
  const lo = twLongOut(), loDone = lo.filter(e => e.draws >= TW_RUN);
  const loH = loDone.reduce((s,e)=>s+e.hits.length,0), loE = loDone.reduce((s,e)=>s+e.draws*P3X,0);
  const p5t = []; for(const c in SEQ) for(const x of SEQ[c]) if(tripDigit(x.n)) p5t.push({...x, c});
  let trH = 0, trE = 0, trN = 0;
  for(const e of p5t){ if(e.d < TW_START) continue; const f = twTravel(e); if(!f.done) continue; trN++; trH += f.hits.length; trE += f.exp; }
  $('twTiles').innerHTML = `<div class="tiles">
    <div class="tile"><div class="k">Long-out test since Oct 14</div><div class="v">${loH} / ${loE.toFixed(1)}</div><div class="k">${loDone.length} finished 14-draw windows · came vs random</div></div>
    <div class="tile"><div class="k">Travel test since Oct 14</div><div class="v">${trH} / ${trE.toFixed(1)}</div><div class="k">${trN} finished weeks · came vs random</div></div>
    <div class="tile"><div class="k">Pairs 234+ draws out now</div><div class="v">${codes.reduce((s,c)=>s+[...'0123456789'].filter(d=>twPair(c,d).gap>=TW_LONG).length,0)}</div><div class="k">of ${codes.length*10} state/digit pairs</div></div>
  </div>`;
  // long-out table
  const loShow = lo.slice().sort((a,b)=> a.start.d<b.start.d?1:a.start.d>b.start.d?-1:b.gap-a.gap);
  $('twLong').innerHTML = loShow.length ? '<table class="t"><thead><tr><th>State</th><th>Triple</th><th>Out when watch began</th><th>Next 14 draws in that state</th></tr></thead><tbody>' +
    loShow.map(e=>`<tr><td>${esc(nm(e.c))}</td><td class="n">${e.d}${e.d}${e.d}xx</td><td>${e.gap} draws · ${fmtShort(e.start.d)} ${esc(slotName(e.c,e.start.s))}</td><td style="font-size:13px">${
      e.hits.length ? e.hits.map(x=>`<span class="mono" style="color:var(--accent);font-weight:600;letter-spacing:.06em">${x.n}</span> ${esc(slotName(e.c,x.s))} ${fmtShort(x.d)}`).join('<br>') + (e.draws<TW_RUN?` <span style="color:var(--muted)">· ${e.draws} of ${TW_RUN}</span>`:'')
      : `<span style="color:var(--muted)">${e.draws>=TW_RUN?'none in 14 draws':'none yet · '+e.draws+' of '+TW_RUN+' draws'}</span>`}</td></tr>`).join('') + '</tbody></table>'
    : '<div class="empty">No state/digit pair has been 234+ draws out since Oct 14 yet.</div>';
  // travel table: Pick 5 triples, last 30 days
  const lastD = DATES[DATES.length-1] || todayCT();
  const tShow = p5t.filter(e => dnum(e.d) > dnum(lastD) - 30).sort((a,b)=> a.d<b.d?1:a.d>b.d?-1:(a.s===b.s?0:a.s==='e'?-1:1));
  $('twTravel').innerHTML = tShow.length ? '<table class="t"><thead><tr><th>Date</th><th>State</th><th>Number</th><th>Same triple in another Pick 5 state, next 7 days</th></tr></thead><tbody>' +
    tShow.map(e=>{ const f = twTravel(e);
      const st = f.hits.length ? f.hits.map(x=>`<span class="mono" style="letter-spacing:.06em">${x.n}</span> ${esc(x.c.toUpperCase())} ${esc(slotName(x.c,x.s))} ${fmtShort(x.d)}`).join('<br>')
        : (f.done ? '<span style="color:var(--muted)">none in 7 days</span>' : `<span style="color:var(--muted)">none yet · ${f.daysIn} of 7 days</span>`);
      return `<tr><td>${fmtShort(e.d)}${e.d>=TW_START?'':' <span class="tag">before test</span>'}</td><td>${esc(nm(e.c))} ${esc(slotName(e.c,e.s))}</td><td class="n"><span class="chip" data-look="${e.n}" style="border:0;padding:0;background:none">${e.n}</span></td><td style="font-size:13px">${st}</td></tr>`; }).join('') + '</tbody></table>'
    : '<div class="empty">No Pick 5 triples in the last 30 days.</div>';
}

document.addEventListener('click', e=>{
  const b = e.target.closest('[data-tw]'); if(b){ TW_SEL = b.dataset.tw; store('twSel', TW_SEL); renderTW(); return; }
  const cp = e.target.closest('[data-twcopy]'); if(!cp) return;
  const x = cp.dataset.twcopy, t = coverFor(x).join(' ');
  const done = ()=>{ const m=$('twCopied'); if(m){ m.textContent=`Copied the 55 ${x}${x}${x}xx boxes`; setTimeout(()=>{ m.textContent=''; },2500); } };
  function fb(){ const a=document.createElement('textarea'); a.value=t; document.body.appendChild(a); a.select(); try{ document.execCommand('copy'); done(); }catch(er){} a.remove(); }
  try{ navigator.clipboard.writeText(t).then(done, fb); }catch(err){ fb(); }
});
(function(){ const base = renderAll; renderAll = function(){ base(); try{ renderTW(); }catch(err){ if($('twGrid')) $('twGrid').innerHTML = '<div class="empty">Triple watch could not load.</div>'; } }; })();
