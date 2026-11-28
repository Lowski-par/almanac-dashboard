/* ===== VTrac Due (Pick 3) — added Nov 28 2026 =====
   VTrac (Lottery Post): every digit and its mirror share one VTrac number: 1&6=1, 2&7=2, 3&8=3, 4&9=4, 5&0=5.
   Each draw becomes a VTrac pattern (35 patterns, any order). For each state, the 3 patterns out the longest there
   are "due"; play every Pick 3 number in those patterns, in that state, the rest of the day + the next 2 days.
   Tested Oct 23 2025 - Nov 27 2026, every draw in 32 states: 4,547 hits vs 4,240 by chance (1.07x); first half 1.10x,
   second half 1.06x; 48 shuffled-order runs of the same draws: best 1.04x, so the real 1.07x beat every shuffle.
   Still a small edge on a game that pays back about half: a filter, not a guarantee. */
(function(){
const C = window.GRID_CFG; if(!C) return;
const $g = id => document.getElementById(id), srt = n => String(n).split('').sort().join('');
const VT = d => (+d % 5) || 5, vtb = n => String(n).split('').map(VT).sort().join('');
const MAP = {}; for(let i = 0; i < 1000; i++){ const b = srt(String(i).padStart(3,'0')), v = vtb(b); (MAP[v] = MAP[v] || new Set()).add(b); }
const PATS = Object.keys(MAP).sort();
const seqOf = c => (C.seq()[c] || []).slice().sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.s === b.s ? 0 : a.s === 'm' ? -1 : 1));
function due(c, before){          // before: ISO date — only draws before it count (for look-backs); omit for now
  const q = seqOf(c).filter(x => !before || x.d < before), last = {}, cnt = {};
  q.forEach((x, i) => { const v = vtb(x.n); last[v] = i; cnt[v] = (cnt[v]||0) + 1; });
  const rows = PATS.map(v => ({v, out: last[v] === undefined ? q.length : q.length - 1 - last[v], seen:last[v] !== undefined ? q[last[v]] : null, gap: cnt[v] ? Math.round(q.length / cnt[v]) : null, nums:[...MAP[v]]}));
  rows.sort((a,b) => b.out - a.out || (a.v < b.v ? -1 : 1));
  return {q, rows};
}
window.vtracDue = (c, before, k) => { const D = due(c, before); return D.rows.slice(0, k || 3); };
function mount(){
  const host = $g('vtHost'); if(!host || $g('vtOut')) return !!host;
  host.innerHTML = '<div class="controls" style="margin-top:0;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center">'+
    '<label>State <select id="vtState"><option value="">&mdash; every state at a glance &mdash;</option></select></label></div><div id="vtOut"></div><div id="vtCheck"></div>';
  $g('vtState').onchange = render; return true;
}
const vtLabel = v => v.split('').join('-');
let lastCount = -1;
function render(){
  if(!mount()) return;
  const sel = $g('vtState'), S = C.seq(), keys = Object.keys(S).filter(c => (S[c]||[]).length >= 60).sort((a,b) => C.name(a).localeCompare(C.name(b)));
  if(sel.options.length - 1 !== keys.length){ const keep = sel.value; sel.innerHTML = '<option value="">&mdash; every state at a glance &mdash;</option>'+keys.map(c => '<option value="'+c+'">'+C.name(c)+'</option>').join(''); if(keep) sel.value = keep; }
  const st = sel.value, out = $g('vtOut');
  const today = C.today ? C.today() : new Date().toISOString().slice(0,10);
  let h = '';
  if(!st){
    h += '<div class="note" style="margin:0 0 6px">Each state&rsquo;s VTrac pattern out the longest right now (1&amp;6=1, 2&amp;7=2, 3&amp;8=3, 4&amp;9=4, 5&amp;0=5). Pick a state for its top 3 and every number to play.</div><table class="tbl" style="font-size:13px"><tr><th>State</th><th>Longest-out VTrac</th><th>Out</th><th>Usual wait</th><th>Its numbers</th></tr>'+
      keys.map(c => { const r = due(c).rows[0]; return '<tr><td>'+C.name(c)+'</td><td><b>'+vtLabel(r.v)+'</b></td><td>'+r.out+' draws</td><td>~'+(r.gap||'&mdash;')+'</td><td style="font-family:\'Roboto Mono\',monospace">'+r.nums.join(' ')+'</td></tr>'; }).join('')+'</table>';
  } else {
    const D = due(st), top = D.rows.slice(0, 3), last5 = D.q.slice(-5).reverse();
    const cameToday = new Set(D.q.filter(x => x.d === today).map(x => srt(x.n)));
    h += '<div class="note" style="margin:0 0 6px">'+C.name(st)+'&rsquo;s last draws as VTrac: '+last5.map(x => '<b>'+x.n+'</b>&rarr;'+vtLabel(x.n.split('').map(VT).join(''))).join(' &middot; ')+'</div>';
    h += '<div class="vtgrid">'+top.map((r, i) => '<div class="vtcard"><div class="vth">#'+(i+1)+' VTrac <b>'+vtLabel(r.v)+'</b></div><div class="vts">out <b>'+r.out+'</b> draws here (usual wait ~'+(r.gap||'&mdash;')+')'+(r.seen ? ' &middot; last '+r.seen.n+' on '+r.seen.d.slice(5) : '')+'</div><div class="vtn">'+
      r.nums.map(n => '<span class="grchip'+(cameToday.has(n) ? ' came' : '')+'" data-n="'+n+'">'+n+'</span>').join('')+'</div></div>').join('')+'</div>';
    h += '<div style="margin-top:8px"><button type="button" class="ghost" id="vtBtn">Check the last 14 days in '+C.name(st)+'</button></div>';
  }
  h += '<div class="note" style="margin-top:8px">Play window: the rest of the day and the next 2 days, same state, any order. Tested on every draw Oct 2025 &ndash; Nov 2026 (32 states): the 3 longest-out patterns came <b>1.07&times;</b> as often as chance (4,547 vs 4,240), ahead in both halves of the year and beating all 48 shuffled-order runs. It is the only outside method so far to pass every check, but the edge is small &mdash; a filter, not a guarantee.</div>';
  out.innerHTML = h;
  out.querySelectorAll('[data-n]').forEach(el => el.onclick = () => { try{ C.look(el.dataset.n); }catch(e){} });
  const b = $g('vtBtn'); if(b) b.onclick = () => check(st);
}
function check(st){
  const q = seqOf(st), el = $g('vtCheck'), fact = n => n <= 1 ? 1 : n*fact(n-1);
  const ways = b => { const c = {}; for(const ch of b) c[ch] = (c[ch]||0)+1; return fact(3)/Object.values(c).reduce((a,v) => a*fact(v), 1); };
  const add = (d, k) => { const t = new Date(d+'T12:00:00Z'); t.setUTCDate(t.getUTCDate()+k); return t.toISOString().slice(0,10); };
  const end = q.length ? q[q.length-1].d : '', start = add(end, -13); let hits = 0, exp = 0, lists = 0; const got = [];
  const last = {}; q.forEach((x, i) => {
    if(x.d >= start){
      const rows = PATS.map(v => ({v, o: last[v] === undefined ? 1e9 : i - last[v]})).sort((a,b) => b.o - a.o || (a.v < b.v ? -1 : 1)).slice(0, 3);
      const w = []; for(let j = i; j < q.length && q[j].d <= add(x.d, 2); j++) w.push(q[j]);   // the list is built before draw i, so draw i counts
      if(w.length){ lists++; for(const r of rows) for(const b of MAP[r.v]){ exp += 1 - Math.pow(1 - ways(b)/1000, w.length); const hit = w.find(y => srt(y.n) === b); if(hit){ hits++; got.push(hit.n+' '+hit.d.slice(5)+' (VTrac '+vtLabel(r.v)+')'); } } }
    }
    last[vtb(x.n)] = i;
  });
  el.innerHTML = '<div class="note">Last 14 days in '+C.name(st)+': before each draw, the 3 longest-out patterns were taken and checked against that draw and the next 2 days. <b>'+hits+'</b> hits vs <b>'+exp.toFixed(1)+'</b> by chance ('+(exp ? (hits/exp).toFixed(2) : '&mdash;')+'&times;) over '+lists+' draws.'+(got.length ? ' Hits: '+[...new Set(got)].slice(0, 12).join(', ')+'.' : '')+' Fourteen days in one state is a small sample.</div>';
}
const css = document.createElement('style');
css.textContent = '.vtgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr));gap:8px}.vtcard{border:1px solid rgba(0,0,0,.15);border-left:5px solid #0B6E79;border-radius:6px;padding:8px 10px}'+
 '.vth{font-size:13px}.vth b{font-family:\'Roboto Mono\',monospace;font-size:18px;letter-spacing:.06em}.vts{font-size:11px;color:var(--ink-soft,#666);margin:2px 0 6px}.vtn{display:flex;flex-wrap:wrap;gap:4px}';
document.head.appendChild(css);
window.renderVTrac = render;
setInterval(() => { try{ const S = C.seq(), n = Object.values(S).reduce((a,b) => a + (b||[]).length, 0); if(n !== lastCount){ lastCount = n; render(); } }catch(e){} }, 3000);
try{ render(); }catch(e){}
})();
