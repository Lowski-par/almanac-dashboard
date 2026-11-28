/* ===== Consensus board (Marcus, Nov 28 2026) =====
   Every system makes its own numbers with its own rules (nothing here changes them). This board only COUNTS:
   one vote per system that names a number (box, any order), ranked by how many systems agree, letters underneath.
   Page sets window.CONS_CFG = {N, seq(), name(c), look(n), today(), systems(D, st, past) -> [{k, name, set:Set(box), live?}]}.
   past=true asks only for systems that can be rebuilt as of an earlier day (used by the scorecard). */
(function(){
const C = window.CONS_CFG; if(!C) return;
const N = C.N, P = Math.pow(10, N), $g = id => document.getElementById(id), srt = n => String(n).split('').sort().join('');
const isoAdd = (d, k) => { const t = new Date(d+'T12:00:00Z'); t.setUTCDate(t.getUTCDate()+k); return t.toISOString().slice(0,10); };
const fact = n => n <= 1 ? 1 : n * fact(n-1);
const ways = b => { const c = {}; for(const ch of b) c[ch] = (c[ch]||0) + 1; return fact(b.length) / Object.values(c).reduce((a,v) => a * fact(v), 1); };
function playDay(){ const S = C.seq(); let last = ''; for(const c in S) for(const x of S[c]) if(x.d > last) last = x.d; const t = C.today(); return t > last ? t : last; }
function tally(D, st, past){
  const sys = C.systems(D, st, past) || [], M = new Map();
  for(const s of sys) for(const b of s.set){ if(String(b).length !== N) continue; const k = srt(b); if(!M.has(k)) M.set(k, {b:k, ks:[], straight:null}); const e = M.get(k); if(!e.ks.includes(s.k)) e.ks.push(s.k); if(!e.straight && s.straight && s.straight.get(k)) e.straight = s.straight.get(k); }
  const W = new Set(C.weak || []), weak = r => r.ks.filter(k => W.has(k)).length;
  return {sys, rows:[...M.values()].sort((a,b) => b.ks.length - a.ks.length || weak(a) - weak(b) || (a.b < b.b ? -1 : 1))};
}
function drawsOn(days){ const S = C.seq(), out = []; for(const c in S) for(const x of S[c]) if(days.includes(x.d)) out.push({c, x}); return out; }
function mount(){
  const host = $g('consHost'); if(!host || $g('consOut')) return !!host;
  host.innerHTML = '<div class="controls" style="margin-top:0;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center">'+
    '<label>State <select id="consState"><option value="">&mdash; all states (no grid / GA votes) &mdash;</option></select></label>'+
    '<label>Need at least <select id="consMin"><option value="2" selected>2 systems</option><option value="3">3 systems</option><option value="4">4 systems</option></select></label>'+
    '<label>Show <select id="consTop"><option>20</option><option selected>40</option><option>100</option></select></label>'+
    '</div><div id="consOut"><div class="empty note">Loading&hellip;</div></div><div id="consCheck"></div>';
  ['consState','consMin','consTop'].forEach(id => $g(id).onchange = render);
  return true;
}
let lastCount = -1;
function render(){
  if(!mount()) return;
  const sel = $g('consState'), S = C.seq(), keys = Object.keys(S).filter(c => (S[c]||[]).length).sort((a,b) => C.name(a).localeCompare(C.name(b)));
  if(sel.options.length - 1 !== keys.length){ const keep = sel.value; sel.innerHTML = '<option value="">&mdash; all states (no grid / GA votes) &mdash;</option>'+keys.map(c => '<option value="'+c+'">'+C.name(c)+'</option>').join(''); if(keep) sel.value = keep; }
  const out = $g('consOut'), st = sel.value, min = +$g('consMin').value || 2, top = +$g('consTop').value || 40, D = playDay();
  let T; try{ T = tally(D, st, false); }catch(e){ out.innerHTML = '<div class="note">Could not build the board.</div>'; console.error(e); return; }
  const today = drawsOn([D]), came = {}; today.forEach(({c, x}) => { const k = srt(x.n); (came[k] = came[k] || []).push(C.name(c)+' '+x.n); });
  const rows = T.rows.filter(r => r.ks.length >= min), byCount = {};
  T.rows.forEach(r => { const n = Math.min(r.ks.length, 5); byCount[n] = (byCount[n]||0) + 1; });
  let h = '<div class="note" style="margin:0 0 6px">For <b>'+D.slice(5).replace('-','/')+'</b>'+(st ? ' &middot; '+C.name(st) : ' &middot; all states')+'. Each system below makes its own numbers by its own rules; a number gets one vote per system that names it (any order). '+
    Object.keys(byCount).sort((a,b) => b-a).map(n => '<b>'+byCount[n]+'</b> on '+(n == 5 ? '5+' : n)+' system'+(n > 1 ? 's' : '')).join(' &middot; ')+'.</div>';
  h += '<div class="consleg">'+T.sys.map(s => '<span><i class="csb">'+s.k+'</i> '+s.name+' <small>('+s.set.size+')</small></span>').join('')+'</div>';
  if(!rows.length) h += '<div class="note">No number is on '+min+' or more systems right now.</div>';
  else h += '<div class="consgrid">'+rows.slice(0, top).map((r, i) => { const cm = came[r.b];
    return '<button type="button" class="conspick'+(cm ? ' came' : '')+(r.ks.length >= 4 ? ' c4' : r.ks.length === 3 ? ' c3' : '')+'" data-n="'+(r.straight || r.b)+'" title="'+r.ks.map(k => (T.sys.find(s => s.k === k)||{}).name).join(', ')+'">'+
      '<span class="consn">'+(r.straight || r.b)+'</span><span class="consc">'+r.ks.length+' systems</span><span class="consks">'+r.ks.map(k => '<i class="csb'+((C.weak||[]).includes(k) ? ' csw' : '')+'">'+k+'</i>').join('')+'</span>'+
      '<span class="consst">#'+(i+1)+(cm ? ' &middot; <b>came today: '+cm.slice(0,2).join(', ')+'</b>' : '')+'</span></button>'; }).join('')+'</div>'+
    (rows.length > top ? '<div class="note">'+(rows.length - top)+' more on '+min+'+ systems (raise Show).</div>' : '');
  h += '<div style="margin-top:10px"><button type="button" class="ghost" id="consBtn">Check how consensus did the last 14 days</button></div>';
  h += '<div class="note" style="margin-top:8px">Highest consensus first; lean hardest on the numbers most systems agree on. '+((C.weak||[]).length ? 'Lighter letters ('+C.weak.join(', ')+') name a big list, so on a tie the numbers that don&rsquo;t lean on them rank first. ' : '')+'This only narrows the list &mdash; it does not change the odds. In earlier tests, 2-system numbers hit at about chance and 3+ ran slightly ahead (small samples).</div>';
  out.innerHTML = h;
  out.querySelectorAll('[data-n]').forEach(el => el.onclick = () => { try{ C.look(el.dataset.n); }catch(e){} });
  $g('consBtn').onclick = () => check(st);
}
function check(st){
  const el = $g('consCheck'), D0 = playDay(), R = {}; let k = 1, skipped = new Set();
  const step = () => {
    if(k > 14){
      let h = '<div class="note" style="margin-top:8px">Last 14 days'+(st ? ', '+C.name(st) : ', all states')+' &mdash; numbers by how many systems named them that morning, and how many came in any state that day or the next:</div><table class="tbl" style="font-size:13px"><tr><th>systems</th><th>numbers</th><th>came</th><th>chance would give</th><th>ratio</th></tr>'+
        [1,2,3,4].map(n => { const r = R[n] || {n:0, h:0, e:0}; return '<tr><td>'+(n === 4 ? '4+' : n)+'</td><td>'+r.n+'</td><td><b>'+r.h+'</b></td><td>'+r.e.toFixed(1)+'</td><td>'+(r.e ? (r.h/r.e).toFixed(2)+'&times;' : '&mdash;')+'</td></tr>'; }).join('')+'</table>'+
        (skipped.size ? '<div class="note">Not in the look-back (they can only be read for today): '+[...skipped].join(', ')+'.</div>' : '');
      el.innerHTML = h; return; }
    const D = isoAdd(D0, -k), win = drawsOn([D, isoAdd(D, 1)]); el.innerHTML = '<div class="note">Checking '+D.slice(5)+'&hellip; ('+k+' of 14)</div>';
    try{ if(win.length){ const T = tally(D, st, true); (C.systems(D0, st, false)||[]).forEach(s => { if(!T.sys.some(t => t.k === s.k)) skipped.add(s.k+' '+s.name); });
      const wb = new Set(win.map(w => srt(w.x.n)));
      for(const r of T.rows){ const n = Math.min(r.ks.length, 4); const o = R[n] = R[n] || {n:0, h:0, e:0}; o.n++; if(wb.has(r.b)) o.h++; o.e += 1 - Math.pow(1 - ways(r.b)/P, win.length); } } }catch(e){ console.error(e); }
    k++; setTimeout(step, 0); };
  setTimeout(step, 0);
}
const css = document.createElement('style');
css.textContent = '.consleg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--ink-soft,#666);margin:4px 0 10px}.consleg small{opacity:.7}'+
 '.csb{font-style:normal;font-family:\'Roboto Mono\',monospace;font-size:10px;font-weight:700;border-radius:3px;padding:0 4px;color:#fff;background:#3B4A5C;margin-right:2px}'+
 '.csb.csw{background:#A9B2BD}'+
 '.consgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr));gap:8px}'+
 '.conspick{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:1px solid rgba(0,0,0,.15);border-left:5px solid #8A8577;border-radius:6px;padding:7px 10px;background:#fff;cursor:pointer;font:inherit;color:inherit}'+
 '.conspick.c3{border-left-color:#E07B00;background:rgba(224,123,0,.06)}.conspick.c4{border-left-color:#C0392B;background:rgba(192,57,43,.08)}'+
 '.conspick.came .consn{text-decoration:line-through;text-decoration-color:#FF6B5E}.consst b{color:#B8362B}'+
 '.consn{font-family:\'Roboto Mono\',monospace;font-size:22px;font-weight:700;letter-spacing:.12em;line-height:1.1}.consc{font-size:11px;font-weight:600}.consks{display:flex;flex-wrap:wrap;gap:2px}.consst{font-size:11px;color:var(--ink-soft,#666)}';
document.head.appendChild(css);
window.renderConsensus = render; window.consTally = tally;
setInterval(() => { try{ const S = C.seq(), n = Object.values(S).reduce((a,b) => a + (b||[]).length, 0); if(n !== lastCount){ lastCount = n; render(); } }catch(e){} }, 3000);
try{ render(); }catch(e){}
})();
