/* ===== GA Rundown — "Grid System" / photo system / circled system (Marcus, Nov 27 2026) =====
   A SEPARATE system. It shares no rules with the Master Grid or the original Date Sum system; it only reads the draws.
   1. Seed = the hit typed in, otherwise the state's latest Midday (latest draw if the state has no midday).
   2. Rundown: seed, then +1 to every digit (ones place only) for 10 rows, then back to the seed.
   3. GA date digit = last digit of the month + last digit of the day (Nov 27 -> 1 + 7 = 8); if that is 10 or more, its last digit.
   4. Mark every row holding the date digit; also mark the rows right above and below (the surrounding zone).
   5. Play list (8-15): numbers he says are showing a lot, the marked rows, their mirrors (+5), the surrounding rows,
      then their mirrors. Pairs with the date digit are listed beside it, ranked by how often they came in that state's last 30 draws.
   A filter only: it does not change the odds. */
(function(){
const C = window.GA_CFG || window.GRID_CFG; if(!C) return;
const N = C.N, $g = id => document.getElementById(id), srt = n => n.split('').sort().join('');
const up = n => n.split('').map(d => (+d + 1) % 10).join(''), mir = n => n.split('').map(d => (+d + 5) % 10).join('');
const today = () => C.today ? C.today() : new Date().toLocaleDateString('en-CA', {timeZone:'America/Chicago'});
const slotName = s => s === 'm' ? 'Midday' : s === 'e' ? 'Evening' : (s || '');
function seqOf(c){ return (C.seq()[c] || []).slice().sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.s === b.s ? 0 : a.s === 'm' ? -1 : 1)); }
function dateDigit(iso){ const m = +iso.slice(5,7) % 10, d = +iso.slice(8,10) % 10; return {m, d, sum:m + d, digit:(m + d) % 10}; }
function shares(a, b){ const L = b.split(''); let k = 0; for(const ch of a){ const i = L.indexOf(ch); if(i >= 0){ L.splice(i,1); k++; } } return k; }
function rundown(seed){ const R = [seed]; for(let i = 1; i < 10; i++) R.push(up(R[i-1])); R.push(seed); return R; }   // 10 rows + back to the seed
function build(seed, iso, showing, size, st, since){
  const DD = dateDigit(iso), dg = String(DD.digit), R = rundown(seed);
  const marked = new Set(), zone = new Set();
  R.forEach((n, i) => { if(n.includes(dg)) marked.add(i); });
  marked.forEach(i => { if(i > 0 && !marked.has(i-1)) zone.add(i-1); if(i < R.length-1 && !marked.has(i+1)) zone.add(i+1); });
  const list = [], seen = new Set(), add = (n, why) => { if(list.length >= size) return; const b = srt(n); if(seen.has(b)) return; seen.add(b); list.push({n, why}); };
  showing.forEach(n => add(n, 'you said it is showing a lot'));
  const mk = [...marked].sort((a,b) => a-b).map(i => R[i]), zn = [...zone].sort((a,b) => a-b).map(i => R[i]);
  mk.forEach(n => add(n, 'marked (holds '+dg+')'));
  mk.forEach(n => add(mir(n), 'mirror of '+n));
  zn.forEach(n => add(n, 'surrounding row'));
  zn.forEach(n => add(mir(n), 'mirror of '+n));
  /* pairs with the date digit, from the marked + surrounding rows, ranked by that state's last 30 draws */
  const recent = st ? seqOf(st).slice(-30) : [], pc = {};
  for(const n of mk.concat(zn)) for(const ch of n){ if(ch === dg && n.split(dg).length <= 2) continue; const p = [dg, ch].sort().join(''); pc[p] = 0; }
  for(const x of recent) for(const p in pc) if(shares(p, x.n) === 2) pc[p]++;
  const pairs = Object.entries(pc).sort((a,b) => b[1]-a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 4);
  /* what came in this state after the seed draw, and which rundown row it sits closest to */
  const after = [];
  const q = st ? seqOf(st) : [], si = since ? q.indexOf(since) : -1;
  if(si >= 0) for(const x of q.slice(si+1)){
    let best = null; R.slice(0, 10).forEach((n, i) => { const k = shares(x.n, n); if(!best || k > best.k) best = {k, n, i}; });
    after.push({x, best, rowTag: marked.has(best.i) ? 'marked' : zone.has(best.i) ? 'surrounding' : 'unmarked'});
  }
  return {DD, dg, R, marked, zone, list, pairs, recentN:recent.length, after};
}
function mount(){
  const host = $g('gaHost'); if(!host || $g('gaOut')) return !!host;
  host.innerHTML = '<div class="controls" style="margin-top:0;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center">'+
    '<label>State <select id="gaState"><option value="">&mdash; pick a state &mdash;</option></select></label>'+
    '<label>Hit <input id="gaSeed" inputmode="numeric" maxlength="'+N+'" placeholder="latest Midday" style="width:'+(70+N*8)+'px"></label>'+
    '<label>Date <input type="date" id="gaDate" style="width:auto"></label>'+
    '<label>Showing a lot <input id="gaShow" placeholder="'+(N===3?'254 580':'2717 1767')+'" style="width:130px"></label>'+
    '<label>List size <select id="gaSize">'+[8,10,12,15].map(k => '<option'+(k===12?' selected':'')+'>'+k+'</option>').join('')+'</select></label>'+
    '</div><div id="gaOut"><div class="empty note">Pick a state (uses its latest Midday) or type a hit.</div></div>';
  ['gaState','gaDate','gaSize'].forEach(id => $g(id).onchange = render);
  $g('gaSeed').oninput = () => { const el = $g('gaSeed'); el.value = (el.value.match(/\d/g)||[]).join('').slice(0,N); if(el.value.length === N || !el.value) render(); };
  $g('gaShow').oninput = () => render();
  $g('gaDate').value = today();
  return true;
}
let lastCount = -1;
function render(){
  if(!mount()) return;
  const sel = $g('gaState'), S = C.seq(), keys = Object.keys(S).filter(c => (S[c]||[]).length).sort((a,b) => C.name(a).localeCompare(C.name(b)));
  if(sel.options.length - 1 !== keys.length){ const keep = sel.value; sel.innerHTML = '<option value="">&mdash; pick a state &mdash;</option>'+keys.map(c => '<option value="'+c+'">'+C.name(c)+'</option>').join(''); if(keep) sel.value = keep; }
  const out = $g('gaOut'), st = sel.value, typed = $g('gaSeed').value.trim(), iso = $g('gaDate').value || today(), size = +$g('gaSize').value || 12;
  const showing = ($g('gaShow').value.match(/\d+/g) || []).filter(n => n.length === N);
  let seed = '', src = null;
  if(typed.length === N) seed = typed;
  else if(st){ const q = seqOf(st); src = [...q].reverse().find(x => x.s === 'm') || q[q.length-1]; if(src) seed = src.n; }
  if(seed.length !== N){ out.innerHTML = '<div class="empty note">Pick a state (uses its latest Midday) or type a '+N+'-digit hit.</div>'; return; }
  const G = build(seed, iso, showing, size, st, src);
  let h = '<div class="note" style="margin:0 0 6px"><b>Date sum for '+iso.slice(5).replace('-','/')+' = '+G.DD.m+' + '+G.DD.d+' = '+G.DD.sum+'</b>'+(G.DD.sum >= 10 ? ' &rarr; digit <b>'+G.dg+'</b>' : '')+
    ' &nbsp;&middot;&nbsp; Seed used: <b>'+seed+'</b> '+(src ? '('+C.name(st)+' '+slotName(src.s)+' '+src.d.slice(5)+')' : '(typed)')+'</div>';
  h += '<div class="grh">Full rundown &mdash; +1 to every digit</div><table class="garun" style="border-collapse:collapse;margin:2px 0 8px"><tbody>'+G.R.map((n, i) => {
    const m = G.marked.has(i), z = G.zone.has(i);
    return '<tr class="'+(m ? 'gam' : z ? 'gaz' : '')+'"><td class="gan" data-n="'+n+'">'+n+'</td><td class="gat">'+(i === 0 ? 'seed' : i === 10 ? 'back to the seed' : '')+(m ? (i===0||i===10?' &middot; ':'')+'&larr; contains '+G.dg : z ? (i===0||i===10?' &middot; ':'')+'surrounding row' : '')+'</td></tr>'; }).join('')+'</tbody></table>';
  if(G.after.length) h += '<div class="note" style="margin:0 0 8px">Since the seed in '+C.name(st)+': '+G.after.map(a => '<b>'+a.x.n+'</b> ('+slotName(a.x.s)+' '+a.x.d.slice(5)+')'+(a.best.k >= N-1 ? ' &mdash; '+(a.best.k === N ? 'same box as' : 'close to')+' <b>'+a.best.n+'</b> ('+a.rowTag+' row)' : '')).join(' &middot; ')+'</div>';
  h += '<div class="grh">Prioritized play list ('+G.list.length+')</div><div class="grfull">'+G.list.map(x => '<span class="grchip'+(x.why.startsWith('marked') ? ' m' : '')+'" data-n="'+x.n+'" title="'+x.why+'">'+x.n+'<small> '+x.why+'</small></span>').join('')+'</div>';
  if(G.pairs.length) h += '<div class="note" style="margin-top:6px">Pairs with the '+G.dg+': '+G.pairs.map(([p, c]) => '<b>'+p+'x'.repeat(N-2)+'</b>'+(st ? ' ('+c+' of '+C.name(st)+'&rsquo;s last '+G.recentN+')' : '')).join(' &middot; ')+'</div>';
  h += '<div class="note" style="margin-top:8px"><b>This is only a filter.</b> It narrows what to look at; it does not beat the odds. This GA Rundown is its own system &mdash; its date sum (last digit of the month + last digit of the day) is not the Date Sum column&rsquo;s, and it is not ranked with the Master Grid above.</div>';
  out.innerHTML = h;
  out.querySelectorAll('[data-n]').forEach(el => el.onclick = () => { try{ C.look(el.dataset.n); }catch(e){} });
}
const css = document.createElement('style');
css.textContent = '.garun td{padding:2px 8px;font-size:13px}.garun .gan{font-family:\'Roboto Mono\',monospace;font-size:18px;letter-spacing:.1em;cursor:pointer}'+
 '.garun tr.gam .gan{font-weight:700;background:rgba(192,57,43,.14);border-radius:4px;box-shadow:inset 0 0 0 2px #C0392B}.garun tr.gam .gat{color:#C0392B;font-weight:600}'+
 '.garun tr.gaz .gan{background:rgba(183,121,31,.14)}.garun tr.gaz .gat{color:#8A4B00}.garun .gat{color:var(--ink-soft,#666)}'+
 '.grh{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:11px;color:var(--ink-soft,#666);margin:10px 0 4px}'+
 '.grfull{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.grchip{font-family:\'Roboto Mono\',monospace;font-size:14px;border:1px solid rgba(0,0,0,.18);border-radius:4px;padding:2px 6px;cursor:pointer}'+
 '.grchip.m{border-color:#C0392B;background:rgba(192,57,43,.08)}.grchip small{font-family:Inter,sans-serif;font-size:10px;margin-left:3px;opacity:.75}';
document.head.appendChild(css);
window.renderGA = render; window.gaBuild = build;
setInterval(() => { try{ const S = C.seq(), n = Object.values(S).reduce((a,b) => a + (b||[]).length, 0); if(n !== lastCount){ lastCount = n; render(); } }catch(e){} }, 2000);
try{ render(); }catch(e){}
})();
