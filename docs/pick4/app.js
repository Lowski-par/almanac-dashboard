/* Pick 4 Ya Heard Me — reads the Almanac results feed, runs the 100 Grand system,
   and grades every list against plain chance. */
'use strict';
const STATE_NAMES = {az:'Arizona',ar:'Arkansas',ca:'California',co:'Colorado',ct:'Connecticut',
 de:'Delaware',fl:'Florida',ga:'Georgia',id:'Idaho',il:'Illinois',in:'Indiana',ia:'Iowa',
 ks:'Kansas',ky:'Kentucky',la:'Louisiana',md:'Maryland',ma:'Massachusetts',mi:'Michigan',mn:'Minnesota',
 ms:'Mississippi',mo:'Missouri',ne:'Nebraska',nj:'New Jersey',nm:'New Mexico',ny:'New York',
 nc:'North Carolina',oh:'Ohio',ok:'Oklahoma',on:'Ontario',or:'Oregon',pa:'Pennsylvania',pr:'Puerto Rico',
 qc:'Quebec',ri:'Rhode Island',sc:'South Carolina',tn:'Tennessee',tx:'Texas',xx:'Tri-State',va:'Virginia',
 wa:'Washington',dc:'Washington DC',wv:'West Virginia',wc:'Western Canada',wi:'Wisconsin',ac:'Atlantic Canada',cr:'Caribbean'};
const REGIONS = [
  ['South', ['ar','de','dc','fl','ga','ky','la','md','ms','nc','ok','sc','tn','tx','va','wv']],
  ['Northeast', ['ct','ma','nj','ny','pa','ri','xx']],
  ['Midwest', ['il','in','ia','ks','mi','mn','mo','ne','oh','wi']],
  ['West', ['az','ca','co','id','nm','or','wa','pr']],
  ['Canada', ['on','qc','wc','ac']],
  ['Caribbean', ['cr']]
];
const nm = c => STATE_NAMES[c] || c.toUpperCase();

/* ---------- data ---------- */
// P4[date][state] = [{n:'1234', s:'m'|'e'}, ...] in draw order; P3 same
var P4 = {}, P3 = {}, DATES = [], SEQ = {}, FEED_AT = null;
const FEED_LIVE = 'https://lowski-par.github.io/almanac-dashboard/feed.json';
async function fetchFeed(){
  // read every copy we can reach and merge them: the live collector feed (newest draws) plus the
  // feed published next to this page (full history incl. backfill). Duplicates are dropped in ingest.
  const out = []; let ok = 0;
  for(const u of [FEED_LIVE, 'feed.json']){
    try{ const r = await fetch(u + '?t=' + Date.now(), {cache:'no-store'}); if(!r.ok) continue;
      const j = await r.json(); const d = Array.isArray(j) ? j : (j.docs || []); if(d.length){ ok++; out.push(...d); } }catch(e){}
  }
  if(!ok) throw new Error('no feed');
  return out;
}
function ingest(docs){
  P4 = {}; P3 = {};
  docs.sort((a,b) => a.date < b.date ? -1 : 1);
  const seen = new Set();
  for(const d of docs){
    if(!d || !d.date) continue;
    for(const [game, T] of [['p4',P4],['p3',P3]]){
      const g = d[game] || {}, s = d['s'+game[1]] || {};
      for(const st in g){
        const L = g[st] || []; if(!L.length) continue;
        // the same state/day can come from two feeds; keep the copy with the most draws (e.g. today's evening is in)
        const k = d.date+'|'+game+'|'+st; const day = (T[d.date] = T[d.date] || {});
        if(seen.has(k) && (day[st]||[]).length >= L.length) continue; seen.add(k);
        day[st] = L.map((n,i) => ({n:String(n), s:(s[st]||[])[i] || ''}));
      }
    }
  }
  DATES = Object.keys(P4).sort();
  SEQ = {};
  for(const dt of DATES) for(const st in P4[dt]) for(const x of P4[dt][st]) (SEQ[st] = SEQ[st] || []).push({d:dt, n:x.n, s:x.s});
}
async function loadFeed(manual){
  const btn = document.getElementById('feedSync'); btn.disabled = true;
  try{
    const docs = await fetchFeed(); ingest(docs); FEED_AT = new Date();
    document.getElementById('fdot').className = 'fdot ok';
    const nDraws = Object.values(SEQ).reduce((a,b) => a+b.length, 0);
    document.getElementById('feedText').textContent = `Results loaded · ${Object.keys(SEQ).length} states · ${nDraws.toLocaleString()} Pick 4 draws · ${DATES[0]} to ${DATES[DATES.length-1]}`;
    initControls(); renderAll();
  }catch(e){
    document.getElementById('fdot').className = 'fdot bad';
    document.getElementById('feedText').textContent = 'Could not reach the results. Try Sync now in a minute.';
  }
  btn.disabled = false;
}

/* ---------- helpers ---------- */
const box = n => n.split('').sort().join('');
const dsum = n => n.split('').reduce((a,c) => a+ +c, 0);
function kind(n){
  const c = {}; for(const ch of n) c[ch] = (c[ch]||0)+1;
  const v = Object.values(c).sort((a,b) => b-a).join('');
  return {'1111':'single','211':'double','22':'double-double','31':'trip','4':'quad'}[v];
}
function perms(a){ if(a.length<=1) return [a]; const out=[]; a.forEach((x,i)=>{ perms(a.slice(0,i).concat(a.slice(i+1))).forEach(p=>out.push([x].concat(p))); }); return out; }
const mod = x => ((x%10)+10)%10;
function family(seed){
  const d = seed.split('').map(Number), SH=[1,2,3,4];
  const plus = new Set(), minus = new Set();
  for(const p of perms(d.map(x=>x+1))) plus.add(p.map((x,i)=>mod(x-SH[i])).join(''));
  for(const p of perms(d.map(x=>x-1))) minus.add(p.map((x,i)=>mod(x+SH[i])).join(''));
  return {plus:[...plus].sort(), minus:[...minus].sort()};
}
function mirrors(seed){
  const d = seed.split('').map(Number), out = new Set();
  for(let m=1;m<16;m++) out.add(d.map((x,i)=>mod(x + ((m>>i)&1 ? 5:0))).join(''));
  return [...out].sort();
}
const BCACHE = new Map();
function boxCover(list){ const key = list.length>1 ? list.join(',') : list[0]; if(BCACHE.has(key)) return BCACHE.get(key); const s = new Set(); for(const n of list) for(const p of perms(n.split(''))) s.add(p.join('')); BCACHE.set(key, s.size); return s.size; }
function isoAdd(d, k){ const t = new Date(d+'T12:00:00Z'); t.setUTCDate(t.getUTCDate()+k); return t.toISOString().slice(0,10); }
function fmtDate(d){ return new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}); }
const pct = x => (x*100).toFixed(x<0.1?1:0)+'%';
function chip(n, cls, mk){ return `<span class="chip ${cls||''}" onclick="useSeed('${n}')">${n}${mk?`<span class="mk">${mk}</span>`:''}</span>`; }

/* ---------- tabs ---------- */
function showTab(t){
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab===t));
  document.querySelectorAll('section[id^=tab-]').forEach(s => s.hidden = s.id !== 'tab-'+t);
  try{ localStorage.setItem('p4tab', t); }catch(e){}
}
function initControls(){
  const last = DATES[DATES.length-1];
  // today in Central time; Date Sums works off the calendar, not off the last draw, so it moves at midnight
  const todayCT = new Date().toLocaleDateString('en-CA', { timeZone:'America/Chicago' }); const top = todayCT > last ? todayCT : last;
  for(const id of ['drewDate','sumsDate','vibesDate']){ const el = document.getElementById(id); el.min = DATES[0]; el.max = top; if(!el.value) el.value = id === 'sumsDate' ? top : last; else if(id === 'sumsDate' && el.value === last && top > last) el.value = top; }
  const sts = Object.keys(SEQ).sort((a,b) => nm(a).localeCompare(nm(b)));
  for(const id of ['pairsState','gState','lkState','bqState','mlyState','ndState']){
    const sel = document.getElementById(id);
    if(sel.options.length) continue;
    sel.innerHTML = (id!=='pairsState' ? '<option value="all">All states</option>' : '') + sts.map(c => `<option value="${c}">${nm(c)}</option>`).join('');
    sel.value = sts.includes('tx') ? 'tx' : sts[0];
  }
  const w = document.getElementById('gWin');
  if(!w.options.length){
    w.innerHTML = '<option value="2">next 2 draws</option><option value="4" selected>next 4 draws</option><option value="6">next 6 draws</option><option value="10">next 10 draws</option><option value="20">next 20 draws</option>';
  }
  if(!document.getElementById('gSeed').value) seedFromState(true);
}
function renderAll(){ renderDrew(); renderSums(); renderPairs(); renderVibes(); renderGrand(); renderBQE(); renderHot(); sfFillStates(); renderMLY(); renderNeed(); }
function stepDate(k){ const el = document.getElementById('drewDate'); el.value = isoAdd(el.value, k); renderDrew(); }

/* ---------- 1. what every state drew ---------- */
function renderDrew(){
  const dt = document.getElementById('drewDate').value, showP3 = document.getElementById('drewShowP3').checked;
  const day = P4[dt] || {}, day3 = P3[dt] || {};
  let n = 0, html = '';
  for(const [rg, codes] of REGIONS){
    const rows = codes.filter(c => day[c] || (showP3 && day3[c]));
    if(!rows.length) continue;
    html += `<div class="region">${rg}</div><div class="tscroll"><table class="tbl"><tr><th>State</th><th>Pick 4</th><th>Sum</th>${showP3?'<th>Pick 3</th>':''}</tr>`;
    for(const c of rows){
      const L = day[c] || []; n += L.length;
      html += `<tr><td class="stname">${nm(c)}</td><td>${L.map(x => chip(x.n,'num',x.s.toUpperCase())).join(' ')}</td>
        <td style="color:var(--ink-soft)">${L.map(x => dsum(x.n)).join(' / ')}</td>
        ${showP3?`<td style="color:var(--ink-soft)">${(day3[c]||[]).map(x => x.n+'<span class="me">'+x.s.toUpperCase()+'</span>').join(' &nbsp; ')}</td>`:''}</tr>`;
    }
    html += '</table></div>';
  }
  document.getElementById('drewCount').textContent = `${fmtDate(dt)} · ${n} Pick 4 draws`;
  document.getElementById('drewBody').innerHTML = html || '<div class="soon">No Pick 4 results for this date yet.</div>';
}

/* ---------- 2. date sum — same setup as Almanac Convergence ----------
   The date's digits added up (10/30 -> 1+0+3+0 = 4; 10/29 -> 12, root 3) point at the numbers whose
   digits add to the same sum, or to the same root when the sum is reduced to one digit. */
const dsDig = n => String(n).split('').reduce((a,d) => a + (+d), 0);
const dsRoot = x => { while(x > 9) x = dsDig(x); return x; };
function dsDateSum(iso, withYear){ const [y,m,d] = iso.split('-'); const digits = (m + d + (withYear ? y : '')).split(''); return { digits, sum: digits.reduce((a,x) => a + (+x), 0) }; }
function dsIn(n, sum, root){ const s = dsDig(n); return root ? (s > 0 && dsRoot(s) === dsRoot(sum)) || (s === 0 && sum === 0) : s === sum; }
const DS_LISTS = {};
function dsList(sum, root){
  const key = sum + '|' + root; if(DS_LISTS[key]) return DS_LISTS[key];
  const bx = new Map();
  for(let i = 0; i < 10000; i++){ const n = String(i).padStart(4,'0'); if(!dsIn(n, sum, root)) continue; const k = box(n); bx.set(k, (bx.get(k)||0)+1); }
  const byWays = {}; bx.forEach((w,k) => (byWays[w] = byWays[w] || []).push(k)); Object.values(byWays).forEach(a => a.sort());
  let straights = 0; bx.forEach(w => straights += w);
  return (DS_LISTS[key] = { byWays, boxes: bx.size, straights, share: straights/10000 });
}
const DS_WAYNAME = {24:'all different',12:'one double',6:'double-double',4:'triple',1:'quad'};
function dsScore(dates, withYear, root, states){
  const allow = new Set(states); const out = { n:0, hit:0, exp:0, days:[] };
  dates.forEach(dt => {
    const { sum } = dsDateSum(dt, withYear), row = { dt, sum, root: dsRoot(sum), hits:[], n:0, e:0 };
    const p = dsList(sum, root).share; const day = P4[dt] || {};
    for(const c in day){ if(!allow.has(c)) continue; for(const x of day[c]){ row.n++; if(dsIn(x.n, sum, root)) row.hits.push({...x, c}); } }
    row.e = row.n * p; out.n += row.n; out.hit += row.hits.length; out.exp += row.e; out.days.push(row);
  });
  return out;
}
function renderSums(){
  const day = document.getElementById('sumsDate').value, withYear = document.getElementById('dsCount').value === 'year', root = document.getElementById('dsGroup').value === 'root';
  const scope = document.getElementById('dsScope').value; const states = scopeStates(scope === 'all' ? 'all' : scope, 'all'); const label = scope === 'all' ? 'all states' : scopeName(scope, 'all');
  const { digits, sum } = dsDateSum(day, withYear), r = dsRoot(sum); const [y,m,d] = day.split('-');
  const lab = iso => fmtDate(iso).replace(/, \d{4}$/, '');
  const groupTxt = root ? 'root '+r+' (sums '+[0,1,2,3,4].map(i => r + 9*i).filter(s => s <= 36 && s > 0).join(', ')+')' : 'sum '+sum;
  let h = '<div class="dshead"><div class="dsdate">'+(+m)+'/'+(+d)+(withYear ? '/'+y : '')+'</div>'+
    '<div class="dsmath">'+digits.join(' + ')+' = <b>'+sum+'</b>'+(sum > 9 ? ' &rarr; '+dsDig(sum)+(dsDig(sum) > 9 ? ' &rarr; '+r : '')+' = root <b>'+r+'</b>' : ' &middot; root <b>'+r+'</b>')+'</div>'+
    '<div class="dsplay">Playing <b>'+groupTxt+'</b> &middot; '+label+'</div></div>';
  const today = dsScore([day], withYear, root, states).days[0];
  const hitChip = x => '<span class="chip dshit" onclick="useSeed(\''+x.n+'\')">'+x.n+'<span class="ago">'+nm(x.c)+' '+(x.s==='m'?'mid':'eve')+'</span></span>';
  h += '<div class="famh" style="margin-top:8px">Came from the group on '+lab(day)+'</div>';
  if(!today.n) h += '<div class="note" style="margin:0">No Pick 4 draws logged for '+lab(day)+' yet &mdash; the first midday draws land around noon Central, and the board refreshes every hour after that; evenings are in by about 11:30 PM.</div>';
  else h += '<div class="dsrow"><b>Pick 4</b> '+today.hits.length+' of '+today.n+' draws <span class="dsx">(chance '+today.e.toFixed(1)+')</span> '+today.hits.map(hitChip).join('')+'</div>';
  const ls = dsList(sum, root), ways = Object.keys(ls.byWays).map(Number).sort((a,b) => b-a);
  h += '<div class="famh" style="margin-top:10px">Numbers in the group</div><details class="dslist"><summary><b>Pick 4</b> &mdash; '+ls.boxes+' box numbers &middot; '+ls.straights.toLocaleString()+' straight ways &middot; comes in '+(100*ls.share).toFixed(ls.share < 0.01 ? 2 : 1)+'% of draws</summary>'+
    (ls.boxes ? ways.map(w => '<div class="dsway"><span class="dswn">'+w+'-way '+(DS_WAYNAME[w]||'')+' ('+ls.byWays[w].length+')</span>'+ls.byWays[w].map(k => '<span class="chip" onclick="useSeed(\''+k+'\')">'+k+'</span>').join('')+'</div>').join('') : '<div class="note">No 4-digit number adds to '+sum+'.</div>')+'</details>';
  const upTo = DATES.filter(x => x <= day); const week = dsScore(upTo.slice(-7), withYear, root, states);
  h += '<div class="famh" style="margin-top:10px">Last 7 days</div><div class="tscroll"><table class="tbl dst"><tr><th>Date</th><th>Sum</th><th>Root</th><th>Pick 4</th><th>What came</th></tr>'+
    week.days.slice().reverse().map(r0 => '<tr><td>'+lab(r0.dt)+'</td><td>'+r0.sum+'</td><td>'+r0.root+'</td><td>'+r0.hits.length+' <span class="dsx">/ '+r0.e.toFixed(1)+'</span></td><td class="dscame">'+r0.hits.map(x => x.n+' <span>'+nm(x.c)+'</span>').join(' &middot; ')+'</td></tr>').join('')+'</table></div>';
  const Y = dsScore(upTo.slice(-365), withYear, root, states);
  const wk = o => o.hit+' vs '+o.exp.toFixed(1)+' by chance ('+(o.exp ? (o.hit/o.exp).toFixed(2) : '&mdash;')+'&times;)';
  h += '<div class="dssum"><div><div class="l">Last 7 days</div><div class="v">P4 '+wk(week)+'</div></div><div><div class="l">Last '+Y.days.length+' days</div><div class="v">P4 '+wk(Y)+'</div></div></div>';
  document.getElementById('sumsBody').innerHTML = h;
  document.getElementById('sumsNote').innerHTML = 'Same setup as Almanac Convergence: the date&rsquo;s month and day digits are added'+(withYear ? ' together with the year' : '')+'; root keeps adding until one digit is left. <b>Chance</b> is how many draws land in the group anyway, given how many numbers it holds and how many draws there were. A week above chance is common &mdash; watch the long line, not the week. Tap a number to make it the 100 Grand seed.';
}

/* ---------- 3. missing pairs / triads ---------- */
/* A "pair" is any two digits that appear together in a Pick 4 draw (boxed, so 3-7 = 7-3); a "triad" is any
   three (6-8-4 covers 6824, 4861, 8468...). For each state: every possible combo, how many draws since it last
   showed, and the draw it showed in. Longest-out first. The tally underneath asks the only question that matters:
   when a combo is the most overdue, does it come back faster than a random combo would? */
const ALLNUMS = Array.from({length:10000}, (_,i) => String(i).padStart(4,'0'));
function combosOf(n, k){ const s = new Set(); const d = n.split('');
  if(k===2){ for(let i=0;i<4;i++) for(let j=i+1;j<4;j++) s.add([d[i],d[j]].sort().join('')); }
  else { for(let i=0;i<4;i++) for(let j=i+1;j<4;j++) for(let l=j+1;l<4;l++) s.add([d[i],d[j],d[l]].sort().join('')); }
  return s; }
const COMBO = {};
function comboInfo(k){
  if(COMBO[k]) return COMBO[k];
  const of = new Map(), contain = new Map();
  for(const n of ALLNUMS){ const c = combosOf(n,k); of.set(n,c); for(const t of c){ if(!contain.has(t)) contain.set(t, []); contain.get(t).push(n); } }
  const keys = [...contain.keys()].sort();
  return COMBO[k] = {of, contain, keys};
}
const cof = (k,n) => comboInfo(k).of.get(n) || combosOf(n,k);
function coverP(k, due){ const C = comboInfo(k).contain; const s = new Set(); for(const t of due) for(const n of C.get(t)) s.add(n); return s.size/10000; }
function todayCT(){ return new Date().toLocaleDateString('en-CA', { timeZone:'America/Chicago' }); }
function renderPairs(){
  const st = document.getElementById('pairsState').value, WIN = +document.getElementById('pairsWin').value || 60, k = +document.getElementById('pairsK').value || 2;
  const s = SEQ[st] || []; const I = comboInfo(k); const word = k===2 ? 'pair' : 'triad';
  const today = todayCT(); const first = s[0] ? s[0].d : today; const recDays = Math.max(1, daysBetween(first, today));
  const perDay = s.length / recDays;   // this state's draws per calendar day (Sundays off and all)
  // last time each combo showed: calendar days out (counting every day, drawn or not), plus draws out for reference
  const last = {}; s.forEach((x,i) => { for(const p of cof(k,x.n)) last[p] = i; });
  const all = I.keys.map(p => { const i = last[p]; const expDraws = 10000/I.contain.get(p).length;
    return {p, days: i===undefined ? recDays : daysBetween(s[i].d, today), gap: i===undefined ? s.length : s.length-1-i, lastN: i===undefined?null:s[i], expDays: expDraws/perDay}; });
  all.sort((a,b) => b.days-a.days || b.gap-a.gap || a.p.localeCompare(b.p));
  const SHOW = 15; const top = all.slice(0, SHOW), rest = all.slice(SHOW); const maxD = Math.max(WIN, top[0] ? top[0].days : WIN);
  const fmtD = d => d % 1 ? d.toFixed(1) : d;
  const row = (r, i) => { const w = Math.min(100, r.days/maxD*100), long = r.days >= 2.5*r.expDays;
    return `<tr><td class="me">${i+1}</td><td><span class="chip ${long?'box':''}" style="font-size:16px">${r.p.split('').join('-')}</span></td><td style="font-weight:700">${r.days}${r.lastN?'':'+'}<span class="me" style="font-weight:400"> (${r.gap} draws)</span></td><td style="color:var(--ink-soft)">~${fmtD(Math.round(r.expDays*10)/10)}</td>
      <td>${r.lastN ? chip(r.lastN.n,'',r.lastN.s.toUpperCase()) + '<span class="me">'+r.lastN.d+'</span>' : '<span class="me">never in the record</span>'}</td>
      <td style="width:26%"><div class="bar"><i style="width:${w}%"></i><b style="left:${Math.min(100,r.expDays/maxD*100)}%"></b></div></td></tr>`; };
  const over = all.filter(r => r.days >= WIN).length;
  let html = `<div class="note" style="margin:0 0 8px">${nm(st)} &middot; ${s.length} draws over ${recDays} days (${perDay.toFixed(1)} a day) &middot; <b>${over}</b> of ${all.length} ${word}s out ${WIN}+ days &middot; days out counts every calendar day since the ${word} last showed here, including days with no draw.</div>`;
  const head = `<tr><th>#</th><th>${word}</th><th>Days out</th><th>Usual (days)</th><th>Last seen</th><th></th></tr>`;
  html += `<div class="tscroll"><table class="tbl">${head}${top.map(row).join('')}</table></div>`;
  if(rest.length) html += `<details style="margin-top:8px"><summary style="cursor:pointer;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:11px;color:var(--ink-soft)">All ${all.length} ${word}s</summary><div class="tscroll"><table class="tbl">${head}${rest.map((r,i) => row(r, i+SHOW)).join('')}</table></div></details>`;
  const back = s[s.length-1];
  if(back){ const prev = s.slice(0,-1); const came = [...cof(k,back.n)].map(p => { let d = daysBetween(first, back.d); for(let i=prev.length-1;i>=0;i--){ if(cof(k,prev[i].n).has(p)){ d = daysBetween(prev[i].d, back.d); break; } } return {p,d}; }).sort((a,b)=>b.d-a.d);
    html += `<div class="note">Latest draw ${chip(back.n,'seed')} on ${back.d} brought back ${came.map(c => `<b>${c.p.split('').join('-')}</b> (${c.d} days out)`).join(', ')}.</div>`; }
  document.getElementById('pairsCount').textContent = `${nm(st)} · ${word}s · ${WIN} days`;
  document.getElementById('pairsBody').innerHTML = html;
  document.getElementById('pairsTally').innerHTML = `<div class="famh" style="margin-bottom:6px">Does &ldquo;due&rdquo; mean anything? &mdash; ${word}s, last ${WIN} days</div><div id="tallyState" class="note">Computing ${nm(st)}&hellip;</div><div id="tallyAll" class="note"><button class="ghost" onclick="renderTally(${k},null)">Compute for every state (takes a few seconds)</button></div>`;
  document.getElementById('pairsNote').innerHTML = `Longest out at the top. Blue bar = days out on a ${WIN}-day scale; red tick = the usual wait for that ${word} in this state; blue chip = 2&frac12;&times; the usual wait or more. &ldquo;Usual&rdquo; is how often the ${word} comes by pure chance (a two-different-digit pair is in about 1 draw in 10; a double like 1-1 about 1 in 19), turned into days using this state&rsquo;s draws per day. Combos are boxed (order doesn&rsquo;t matter).`;
  setTimeout(() => renderTally(k, st), 20);
}
function tallyFor(k, states, start){
  const I = comboInfo(k); const TOP = [1,5,10]; const R = TOP.map(t => ({t, n:0, hits:0, exp:0}));
  for(const st of states){ const s = SEQ[st] || []; const last = {};
    s.forEach((x,i) => {
      if(i>0 && x.d >= start){
        const items = I.keys.map(p => [last[p]===undefined ? 9999 : daysBetween(s[last[p]].d, x.d), p]).sort((a,b) => b[0]-a[0] || (a[1]<b[1]?-1:1));
        const mine = cof(k,x.n);
        for(const r of R){ const due = items.slice(0,r.t).map(z=>z[1]); r.n++; if(due.some(p => mine.has(p))) r.hits++; r.exp += coverP(k, due); }
      }
      for(const p of cof(k,x.n)) last[p] = i;
    }); }
  return R;
}
function renderTally(k, st){
  const states = st ? [st] : Object.keys(SEQ); const WIN = +document.getElementById('pairsWin').value || 60; const start = isoAdd(todayCT(), -WIN);
  const el = document.getElementById(st ? 'tallyState' : 'tallyAll'); if(!el) return; el.textContent = 'Computing…';
  setTimeout(() => {
    const R = tallyFor(k, states, start); const word = k===2?'pair':'triad';
    const lift = r => r.exp ? r.hits/r.exp : 0;
    el.innerHTML = `<div class="verdict ${lift(R[0])>1.1&&lift(R[1])>1.1?'good':''}" style="margin:6px 0"><b>${st ? nm(st) : 'Every state'}</b>, every draw in the last ${WIN} days (${R[0].n.toLocaleString()} draws): before each draw we ranked the ${word}s by days out, then checked whether the most overdue ones showed up.
      <table class="tbl" style="margin-top:6px"><tr><th>Most overdue</th><th>Came back</th><th>Chance would give</th><th>Lift</th></tr>${R.map(r => `<tr><td>top ${r.t}</td><td>${r.hits} (${pct(r.hits/r.n)})</td><td>${r.exp.toFixed(1)} (${pct(r.exp/r.n)})</td><td style="font-weight:700;color:${lift(r)>1.1?'var(--green)':lift(r)<0.9?'var(--pen)':'inherit'}">${lift(r).toFixed(2)}x</td></tr>`).join('')}</table>
      <div style="margin-top:4px">1.00x = the overdue ${word}s came back exactly as often as any random ${word} would. Above 1.10x on both top 1 and top 5, held for a couple of months, would mean &ldquo;due&rdquo; is worth something.</div></div>`;
  }, 20);
}

/* ---------- 4. vibrations ---------- */
/* Default: for every draw of the day, its mirror vibration (each digit +5), its up vibration (+1 each),
   and down vibration (-1 each). Then check the next day's draws anywhere: did any vibration land? */
function vibes(n){ const d = n.split('').map(Number); return {mirror:d.map(x=>mod(x+5)).join(''), up:d.map(x=>mod(x+1)).join(''), down:d.map(x=>mod(x-1)).join('')}; }
function renderVibes(){
  const dt = document.getElementById('vibesDate').value, day = P4[dt] || {}, next = isoAdd(dt,1), nd = P4[next] || {};
  const nextAll = []; for(const c in nd) for(const x of nd[c]) nextAll.push({c, n:x.n});
  const nextBox = new Map(); nextAll.forEach(x => { const b = box(x.n); if(!nextBox.has(b)) nextBox.set(b, []); nextBox.get(b).push(x); });
  let rows = [], hits = 0, total = 0;
  for(const [rg, codes] of REGIONS) for(const c of codes) for(const x of (day[c]||[])){
    const v = vibes(x.n); total++;
    const hit = {}; for(const k in v){ const m = nextBox.get(box(v[k])); if(m){ hit[k] = m; } }
    if(Object.keys(hit).length) hits++;
    rows.push({c, x, v, hit});
  }
  // chance: 3 numbers, boxed; use per-draw average cover
  let pSum = 0; rows.forEach(r => { pSum += 1 - Math.pow(1 - boxCover(Object.values(r.v))/10000, nextAll.length); });
  const pChance = rows.length ? pSum/rows.length : 0;
  let html = nextAll.length
    ? `<div class="verdict ${hits/Math.max(total,1) > pChance*1.3 ? 'good':''}"><b>${hits}</b> of <b>${total}</b> draws on ${fmtDate(dt)} had a vibration land somewhere on ${fmtDate(next)} (<b>${pct(hits/Math.max(total,1))}</b>). Chance for 3 boxed numbers against ${nextAll.length} draws: about <b>${pct(pChance)}</b>.</div>`
    : `<div class="verdict">No results yet for ${fmtDate(next)} &mdash; these are the vibrations to watch.</div>`;
  html += '<div class="tscroll"><table class="tbl"><tr><th>State</th><th>Draw</th><th>Mirror (+5)</th><th>Up (+1)</th><th>Down (&minus;1)</th></tr>' + rows.map(r => {
    const cell = k => { const m = r.hit[k]; return chip(r.v[k], m ? (m.some(y=>y.n===r.v[k])?'str':'box') : '', m ? m.map(y=>nm(y.c)).join(', ') : ''); };
    return `<tr><td class="stname">${nm(r.c)}</td><td>${chip(r.x.n,'num',r.x.s.toUpperCase())}</td><td>${cell('mirror')}</td><td>${cell('up')}</td><td>${cell('down')}</td></tr>`; }).join('') + '</table></div>';
  document.getElementById('vibesCount').textContent = fmtDate(dt);
  document.getElementById('vibesBody').innerHTML = html;
  document.getElementById('vibesNote').innerHTML = 'Default rule: each draw vibrates to its <b>mirror</b> (every digit +5), <b>up</b> (+1) and <b>down</b> (&minus;1). Blue = came boxed next day, green = came straight; the tag says where. If your Vibrations are figured another way, say how.';
}

/* ---------- 5. 100 grand ---------- */
function seedFromState(silent){
  const st = document.getElementById('gState').value;
  if(st==='all'){ const last = DATES[DATES.length-1]; const day = P4[last] || {}; const sts = Object.keys(day).sort(); if(sts.length){ const L = day[sts[0]]; document.getElementById('gSeed').value = L[L.length-1].n; } }
  else { const s = SEQ[st] || []; if(s.length) document.getElementById('gSeed').value = s[s.length-1].n; }
  if(!silent) renderGrand();
}
function seedTyped(){ const el = document.getElementById('gSeed'); el.value = (el.value.match(/\d/g)||[]).join('').slice(0,4);
  if(el.value.length===4){ renderGrand(); try{ el.blur(); }catch(e){} }   // fire on the 4th digit; drop the phone keyboard
  else document.getElementById('grandBody').innerHTML = '<div class="soon">Type ' + (4-el.value.length) + ' more digit' + (el.value.length===3?'':'s') + '&hellip;</div>'; }
function lkTyped(){ const el = document.getElementById('lkNum'); el.value = (el.value.match(/\d/g)||[]).join('').slice(0,4);
  if(el.value.length===4){ renderLookup(); try{ el.blur(); }catch(e){} }
  else document.getElementById('lookupBody').innerHTML = 'Type ' + (4-el.value.length) + ' more digit' + (el.value.length===3?'':'s') + '&hellip;'; }
function useSeed(n){ document.getElementById('gSeed').value = n;
  // pick the state this number was last drawn in, so "this state" mode makes sense
  let best = null; for(const st in SEQ){ const s = SEQ[st]; for(let i=s.length-1;i>=0;i--){ if(s[i].n===n){ if(!best || s[i].d > best.d) best = {st, d:s[i].d}; break; } } }
  if(best) document.getElementById('gState').value = best.st;
  document.getElementById('lkNum').value = n; if(best) document.getElementById('lkState').value = best.st;
  const my = document.getElementById('mlyNum'); if(my){ my.value = n; if(best) document.getElementById('mlyState').value = best.st; renderMLY(); }
  const sb = document.getElementById('sfBox'); if(sb){ sb.value = n; }
  const nd = document.getElementById('ndNum'); if(nd){ nd.value = n; renderNeedWhere(); }
  showTab('grand'); renderGrand(); renderLookup(); window.scrollTo({top:0,behavior:'smooth'}); }

/* ---------- neighbors: the numbers one digit away from the seed ----------
   +1, -1 or the mirror (+5) on exactly one digit, in any arrangement, boxed. Nine numbers for a single or
   a double, fewer for trips/quads. Longest out first, with whether it fell in the last 2 days and how
   many systems are pointing at it on the hot board. */
function neighborsOf(seed){
  const B = box(seed); const out = new Map();
  const perms = new Set(); const rec = (a, rest) => { if(!rest.length){ perms.add(a); return; } for(let i=0;i<rest.length;i++) rec(a+rest[i], rest.slice(0,i)+rest.slice(i+1)); }; rec('', B);
  for(const p of perms) for(let i=0;i<4;i++) for(const [dl, tag] of [[1,'+1'],[-1,'&minus;1'],[5,'mirror']]){
    const t = p.split(''); const from = t[i]; t[i] = String((+t[i] + dl + 10) % 10); const nb = box(t.join('')); if(nb === B) continue;
    const lab = from + '&rarr;' + t[i] + ' ' + tag; if(!out.has(nb)) out.set(nb, new Set()); out.get(nb).add(lab);
  }
  return [...out.entries()].map(([b, labs]) => ({b, how:[...labs]}));
}
function renderNeighbors(seed, st, mode){
  const el = document.getElementById('nbBody'); if(!el) return;
  const states = mode === 'state' ? (st === 'all' ? Object.keys(SEQ) : [st]) : scopeStates(mode, 'all'); const label = scopeName(mode, st);
  const today = todayCT(); const nbs = neighborsOf(seed); const nbSet = new Set(nbs.map(x => x.b));
  const cut2 = isoAdd(today, -1);
  const rows = nbs.map(x => { let last = null; const fell = [];
    for(const c of states) for(const d of (SEQ[c]||[])){ if(box(d.n) !== x.b) continue; if(!last || d.d > last.d) last = {...d, c}; if(d.d >= cut2) fell.push({...d, c}); }
    return {...x, last, fell, days: last ? daysBetween(last.d, today) : null}; });
  rows.sort((a,b) => (b.days===null?9999:b.days) - (a.days===null?9999:a.days));
  // hot board for this scope, same settings as the Hottest card
  const N = +((document.getElementById('hotDays')||{}).value) || 7; const withYear = (document.getElementById('dsCount')||{}).value === 'year', root = (document.getElementById('dsGroup')||{}).value === 'root';
  const H = new Map(); for(const e of hotBoard(isoAdd(DATES[DATES.length-1], 1), states, N, withYear, root)) H.set(e.b, e);
  const letters = e => e ? ['G','Q','Y','S'].filter(t => e.types.has(t)).map(t => `<i class="h${t}" style="font-style:normal;font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;border-radius:3px;padding:0 4px;color:#fff;margin-right:2px">${t}</i>`).join('') : '<span class="me">&mdash;</span>';
  let draws2 = 0; for(const c of states) for(const d of (SEQ[c]||[])) if(d.d >= cut2) draws2++;
  const fellN = rows.filter(r => r.fell.length).length; const exp2 = rows.reduce((a,r) => a + (1 - Math.pow(1 - boxCover([r.b])/10000, draws2)), 0);
  const seedHot = H.get(box(seed));
  el.innerHTML = `<div class="famh">Neighbors of ${seed} &mdash; one digit off (+1, &minus;1, mirror), boxed &middot; ${label}</div>
    <div class="verdict ${fellN >= 3 ? '' : ''}"><b>Last 2 days in ${label}:</b> <b>${fellN}</b> of ${rows.length} neighbors fell &mdash; chance about <b>${exp2.toFixed(1)}</b> (${draws2} draws). ${seed} itself: ${seedHot ? letters(seedHot)+' on the hot board' : 'not on the hot board'}.</div>
    <div class="tscroll"><table class="tbl"><tr><th>#</th><th>number</th><th>change</th><th>days out</th><th>last seen</th><th>fell last 2 days</th><th>hot</th></tr>${rows.map((r,i) => `<tr><td class="me">${i+1}</td><td>${chip(r.last ? r.last.n : r.b, (H.get(r.b)||{types:new Set()}).types.size >= 3 ? 'box' : '')}</td><td class="me">${r.how.join(' / ')}</td><td style="font-weight:700">${r.days===null ? 'never' : r.days}</td><td>${r.last ? '<span class="me">'+nm(r.last.c)+' '+r.last.d+'</span>' : '<span class="me">never in the record</span>'}</td><td>${r.fell.length ? '<b style="color:var(--pen)">&#10005; '+r.fell.map(f => f.n+' '+nm(f.c)+' '+f.d.slice(5)).join(', ')+'</b>' : ''}</td><td>${letters(H.get(r.b))}</td></tr>`).join('')}</table></div>
    <div class="note">Longest out at the top. Blue chip = three or more systems point at that neighbor. Hot uses the Hottest card&rsquo;s settings (${N}-day window). Year-long check, every state: a neighbor falls somewhere in the 2 days before a number comes 91% of the time &mdash; and before every other number 91% of the time too (1.00&times;); same state, previous 6 draws: 10.4% vs 10.2% by chance. A cluster of neighbors is normal for any number, hot or not.</div>`;
}

const GCACHE = new Map();
function groupsFor(seed){
  if(GCACHE.has(seed)) return GCACHE.get(seed);
  const f = family(seed), m = mirrors(seed);
  const r = [
    {key:'plus', name:'Family + (sheet rows under SINGLES / DOUBLES, left block)', list:f.plus},
    {key:'minus', name:'Family − (right block)', list:f.minus},
    {key:'mir', name:'Mirrors', list:m}
  ];
  GCACHE.set(seed, r); return r;
}
function futureDraws(seed, st, mode, K){
  // the draws that come AFTER the seed's most recent appearance (in st for state mode; everywhere for any mode)
  const s = SEQ[st] || []; let idx = -1; for(let i=s.length-1;i>=0;i--){ if(s[i].n===seed){ idx = i; break; } }
  if(mode==='state' && st==='all') mode = 'any';
  if(mode==='state'){
    const start = idx>=0 ? idx+1 : s.length;  // typed seed not drawn here: pending, nothing to check yet
    return {fut: s.slice(start, start+K).map(x => ({...x, st})), pending: K - Math.min(K, s.length-start), since: idx>=0 ? s[idx].d : null};
  }
  // a region or all states: next K calendar days after the seed's date (or today if not drawn anywhere)
  let d0 = idx>=0 ? s[idx].d : null;
  if(!d0){ for(const c of Object.keys(SEQ)){ const q = SEQ[c]; for(let i=q.length-1;i>=0;i--){ if(q[i].n===seed){ if(!d0 || q[i].d > d0) d0 = q[i].d; break; } } } }
  const found = !!d0; d0 = d0 || DATES[DATES.length-1];
  const allow = new Set(REGION4[mode] ? REGION4[mode].states : Object.keys(SEQ));
  const fut = [];
  for(let k=1;k<=K;k++){ const dt = isoAdd(d0,k); for(const c in (P4[dt]||{})){ if(!allow.has(c)) continue; for(const x of P4[dt][c]) fut.push({...x, d:dt, st:c}); } }
  return {fut, pending: 0, since: found ? d0 : null, days:K};
}
function renderGrand(){
  const seed = document.getElementById('gSeed').value, st = document.getElementById('gState').value;
  const mode = document.getElementById('gMode').value; let K = +document.getElementById('gWin').value;
  const w = document.getElementById('gWin');
  const regional = mode!=='state' || st==='all';
  if(regional){ w.innerHTML = '<option value="1">next 1 day</option><option value="2">next 2 days</option><option value="3">next 3 days</option><option value="7">next 7 days</option><option value="14">next 14 days</option>'; if(![1,2,3,7,14].includes(K)) K = 1; w.value = K; }
  else { w.innerHTML = '<option value="2">next 2 draws</option><option value="4">next 4 draws</option><option value="6">next 6 draws</option><option value="10">next 10 draws</option><option value="20">next 20 draws</option><option value="40">next 40 draws</option>'; if(![2,4,6,10,20,40].includes(K)) K = 4; w.value = K; }
  if(!/^\d{4}$/.test(seed)){ document.getElementById('nbBody').innerHTML = ''; document.getElementById('grandBody').innerHTML = '<div class="soon">Pick a state or type a 4-digit seed.</div>'; return; }
  const G = groupsFor(seed), all = [...new Set(G.flatMap(g => g.list))];
  const F = futureDraws(seed, st, mode, K); const fut = F.fut;
  const futStraight = new Map(), futBox = new Map();
  fut.forEach(x => { (futStraight.get(x.n) || futStraight.set(x.n,[]).get(x.n)).push(x); const b = box(x.n); (futBox.get(b) || futBox.set(b,[]).get(b)).push(x); });
  const mark = n => futStraight.has(n) ? 'str' : futBox.has(box(n)) ? 'box' : '';
  const tag = n => { const m = futStraight.get(n) || futBox.get(box(n)); return m ? m.map(y => (regional? nm(y.st)+' ' : '') + y.d.slice(5) + (y.s?y.s.toUpperCase():'')).join(', ') : ''; };
  const hitsB = all.filter(n => futBox.has(box(n))), hitsS = all.filter(n => futStraight.has(n));
  const pB = fut.length ? 1 - Math.pow(1 - boxCover(all)/10000, fut.length) : 0;
  const pS = fut.length ? 1 - Math.pow(1 - all.length/10000, fut.length) : 0;
  const expB = fut.length * boxCover(all)/10000, expS = fut.length * all.length/10000;
  const regName = REGION4[mode] ? 'the '+REGION4[mode].name : 'all states';
  // Look back: which relatives already came in this scope over the last N days, which are still to come
  const NB = +document.getElementById('gBack').value || 14; const startB = isoAdd(DATES[DATES.length-1], -NB);
  const scopeSts = regional ? (REGION4[mode] ? REGION4[mode].states : Object.keys(SEQ)) : [st];
  const whereB = {}; let totB = 0;
  for(const c of scopeSts) for(const x of (SEQ[c]||[])){ if(x.d < startB) continue; totB++; const b = box(x.n); (whereB[b] = whereB[b]||[]).push({...x, st:c}); }
  const relAll = G.flatMap(g => g.list.map(n => ({n, g:g.name.split(' (')[0]}))).filter(r => box(r.n)!==box(seed));
  const seedCame = whereB[box(seed)] || [];
  const cameB = relAll.filter(r => whereB[box(r.n)]), leftB = relAll.filter(r => !whereB[box(r.n)]);
  let expB2 = 0; relAll.forEach(r => { expB2 += 1 - Math.pow(1 - boxCover([r.n])/10000, totB); });
  const whereTxt = r => whereB[box(r.n)].map(w => `${w.n} ${nm(w.st)} ${w.d.slice(5)}${w.s?w.s.toUpperCase():''}`).join(' · ');
  let lb = `<div class="lbwrap"><div class="lbhead"><div class="famh">Last ${NB} days in ${regional ? regName : nm(st)} &mdash; ${totB.toLocaleString()} draws</div>
      <span class="me"><b style="color:var(--pen)">&#10005;</b> ${cameB.length} came &nbsp; <b style="color:var(--green)">&#10003;</b> ${leftB.length} still to come &nbsp; (chance: about ${expB2.toFixed(1)} of ${relAll.length} come in this many draws)</span></div>
    <div class="hitrow"><span class="when">The seed itself</span>${seedCame.length ? `<span class="chip gone seed" style="background:var(--pen);border-color:var(--pen);color:#fff">${seed}<span class="mk" style="color:#fff">&#10005; ${seedCame.length}&times;</span></span><span class="me">${seedCame.map(w => `${w.n} ${nm(w.st)} ${w.d.slice(5)}${w.s?w.s.toUpperCase():''}`).join(' &middot; ')}</span>` : `<span class="chip watch seed" style="background:var(--green);border-color:var(--green);color:#fff">${seed}<span class="mk" style="color:#fff">&#10003;</span></span><span class="me">not drawn in this window</span>`}</div>`;
  for(const gname of ['Family +','Family \u2212','Mirrors']){
    const L = relAll.filter(r => r.g===gname); if(!L.length) continue;
    lb += `<div class="hitrow"><span class="when">${gname}</span>${L.map(r => whereB[box(r.n)] ? `<span class="chip gone" title="${whereTxt(r)}" onclick="useSeed('${r.n}')">${r.n}<span class="mk">&#10005;</span></span>` : `<span class="chip watch" onclick="useSeed('${r.n}')">${r.n}<span class="mk">&#10003;</span></span>`).join('')}</div>`;
  }
  if(cameB.length){
    // one line per draw, in date order (oldest first, midday before evening); relatives that share a box
    // (e.g. 3085 / 3580 / 8035 / 8530) are listed together instead of repeating the same draws
    const relOf = {}; cameB.forEach(r => { const b = box(r.n); (relOf[b] = relOf[b] || []); if(!relOf[b].includes(r.n)) relOf[b].push(r.n); });
    const ev = []; Object.keys(relOf).forEach(b => whereB[b].forEach(w => ev.push({...w, rel: relOf[b]})));
    const slot = w => w.s === 'm' ? 0 : 1;
    ev.sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : slot(a) - slot(b) || (nm(a.st) < nm(b.st) ? -1 : 1));
    lb += `<div class="famh" style="margin-top:8px">Where they came &mdash; in date order</div><div class="tscroll"><table class="tbl"><tr><th>date</th><th></th><th>state</th><th>came</th><th>relative of ${seed}</th></tr>${ev.map(w => `<tr><td>${fmtDate(w.d).replace(/, \d{4}$/,'')}</td><td class="me">${w.s==='m'?'mid':w.s==='e'?'eve':''}</td><td class="stname">${nm(w.st)}</td><td>${chip(w.n,'gone')}</td><td class="me">${w.rel.join(' / ')}</td></tr>`).join('')}</table></div>`;
  }
  lb += '</div>';
  let html = `<div class="seedbar"><span class="seedbig">${seed}</span><span class="seedkind">${kind(seed)} &middot; ${all.length} numbers</span>
    <span class="seedkind">${F.since ? `last drawn in ${st==='all'?'the feed':nm(st)} on ${F.since}` : `not drawn ${st==='all'?'anywhere':'in '+nm(st)} yet &mdash; checking from today`}</span></div>`;
  html += lb;
  html += `<div class="legend"><span><b style="color:var(--pen)">&#10005;</b> came in the window (tap for where)</span><span><b style="color:var(--green)">&#10003;</b> still to come &mdash; watch for it</span><span>tap a number to make it the seed</span></div>`;
  document.getElementById('grandCount').textContent = regional ? regName : nm(st);
  document.getElementById('grandBody').innerHTML = html;
  renderNeighbors(seed, st, mode);
  renderRollup(); if(!document.getElementById('lkNum').value){ document.getElementById('lkNum').value = seed; renderLookup(); }
  document.getElementById('scoreBody').innerHTML = `<button class="ghost" onclick="renderScore()">Compute scoreboard for ${regional?regName:'this state'} · ${regional?K+' day'+(K>1?'s':''):'next '+K+' draws'}</button>`;
}
/* Play regions — states that feed off each other. Change a code here to move a state. */
const REGION4 = {
  ne:{name:'Northeast', states:['ct','ma','nj','ny','pa','ri','xx','de','md','dc']},
  se:{name:'Southeast', states:['fl','ga','sc','nc','va','wv','tn','ky','ms','ar','la','tx','ok','pr']},
  ce:{name:'Central',   states:['il','in','ia','ks','mi','mn','mo','ne','oh','wi']},
  we:{name:'West',      states:['az','ca','co','id','nm','or','wa']},
  ca:{name:'Canada',    states:['on','qc','wc','ac']},
  cb:{name:'Caribbean', states:['cr']}
};
function scopeStates(scope, st){
  if(scope==='state') return st==='all' ? Object.keys(SEQ) : [st];
  if(REGION4[scope]) return REGION4[scope].states.filter(c => SEQ[c]);
  return Object.keys(SEQ);
}
function scopeName(scope, st){ return scope==='state' ? (st==='all' ? 'all states' : nm(st)) : REGION4[scope] ? 'the '+REGION4[scope].name : 'all states'; }
function renderLookup(){
  const el = document.getElementById('lookupBody'); const inp = document.getElementById('lkNum');
  inp.value = (inp.value.match(/\d/g)||[]).join('').slice(0,4);
  const T = inp.value; if(!/^\d{4}$/.test(T)){ el.innerHTML = 'Type a 4-digit number.'; return; }
  const scope = document.getElementById('lkScope').value, N = +document.getElementById('lkDays').value || 35, st = document.getElementById('lkState').value;
  const states = scopeStates(scope, st);
  const label = scopeName(scope, st);
  const start = isoAdd(DATES[DATES.length-1], -N); const TB = box(T);
  // 1. who triggered it: draws in window whose 100 Grand list holds T (boxed)
  const trig = []; let total = 0, cameT = [];
  for(const c of states){ for(const x of (SEQ[c]||[])){ if(x.d < start) continue; total++;
    if(box(x.n)===TB) cameT.push({...x, st:c});
    const G = groupsFor(x.n); const hit = G.filter(g => g.list.some(n => box(n)===TB)).map(g => g.key==='plus'?'Fam +':g.key==='minus'?'Fam −':'Mirror');
    if(hit.length) trig.push({...x, st:c, hit}); } }
  trig.sort((a,b) => a.d<b.d?-1:a.d>b.d?1:0);
  // share of all seeds whose list holds TB (cached per box)
  renderLookup.share = renderLookup.share || {};
  if(renderLookup.share[TB]===undefined){ let c=0; for(const n of ALLNUMS){ if(groupsFor(n).some(g => g.list.some(m => box(m)===TB))) c++; } renderLookup.share[TB] = c/10000; }
  const expTrig = total*renderLookup.share[TB];
  const firstCame = cameT.length ? cameT.slice().sort((a,b)=>a.d<b.d?-1:1)[0] : null;
  let html = `<div class="seedbar" style="margin:6px 0 10px"><span class="seedbig">${T}</span><span class="seedkind">${kind(T)} &middot; ${label}, last ${N} days (${total.toLocaleString()} draws)</span></div>`;
  html += `<div class="verdict ${trig.length > expTrig*1.5 && trig.length>=3 ? 'good':''}"><b>${T}</b> ${cameT.length ? `came ${cameT.length}&times; in ${label} this window (first: ${firstCame.n} ${nm(firstCame.st)} ${firstCame.d.slice(5)}${firstCame.s.toUpperCase()})` : `has not come in ${label} this window`}. <b>${trig.length}</b> draw${trig.length===1?'':'s'} had it on their 100 Grand list${firstCame ? ` &mdash; <b>${trig.filter(t => t.d < firstCame.d).length}</b> of them before it came` : ''}. About <b>${expTrig.toFixed(1)}</b> would carry it by chance (${pct(renderLookup.share[TB])} of all seeds do).</div>`;
  html += `<div class="famh">Who triggered it</div>` + (trig.length ? `<div class="tscroll"><table class="tbl"><tr><th>date</th><th>state</th><th>draw</th><th>where ${T} sat</th></tr>${trig.map(t => `<tr${firstCame && t.d >= firstCame.d ? ' style="opacity:.55"' : ''}><td>${t.d}${t.s?' '+t.s.toUpperCase():''}</td><td class="stname">${nm(t.st)}</td><td>${chip(t.n,'')}</td><td>${t.hit.join(', ')}</td></tr>`).join('')}</table></div>` : '<div class="note">No draw in this window put it on a list.</div>');
  html += `<div class="note">Boxed (order doesn&rsquo;t matter). Grey rows came after the number did, so they weren&rsquo;t triggers. The chance figure says how many draws would carry this number on their list anyway &mdash; triggers only mean something when they clear it by a wide margin, again and again. Tap a trigger to open it on the 100 Grand tab.</div>`;
  el.innerHTML = html;
}
function renderRollup(){
  const st = document.getElementById('gState').value, N = +document.getElementById('ruN').value || 60, K = +document.getElementById('ruK').value || 8;
  const mode = document.getElementById('gMode').value;
  const scopeSts = (mode==='state') ? (st==='all' ? Object.keys(SEQ).sort() : [st]) : (REGION4[mode] ? REGION4[mode].states.filter(c => SEQ[c]) : Object.keys(SEQ).sort());
  const scopeLabel = mode==='state' ? (st==='all' ? 'all states' : nm(st)) : (REGION4[mode] ? 'the '+REGION4[mode].name : 'all states');
  document.getElementById('ruDays').textContent = N; document.getElementById('ruState').textContent = scopeLabel + (scopeSts.length>1 ? ' (each state checked against its own next draws)' : '');
  const out = document.getElementById('rollupBody');
  const parts = scopeSts.map(c => SEQ[c] || []);
  const s = []; const ownNext = []; parts.forEach(q => q.forEach((x,i) => { s.push(x); ownNext.push(q.slice(i+1)); }));
  if(!s.length){ out.textContent = 'No draws for this state.'; return; }
  const start = isoAdd(DATES[DATES.length-1], -N);
  const idx = s.map((x,i)=>i).filter(i => s[i].d >= start);
  let fired = 0, chance = 0, expS = 0, straight = [], srcC = {plus:0, minus:0, mir:0}, byK = {}, hotBox = {}, timing = {}, lists = {};
  const digit = {}; let digTot = 0; const drawBox = {};
  for(const i of idx){
    const seed = s[i].n, G = groupsFor(seed), all = [...new Set(G.flatMap(g=>g.list))];
    for(const c of seed){ digit[c] = (digit[c]||0)+1; digTot++; } drawBox[box(seed)] = (drawBox[box(seed)]||0)+1;
    const k = kind(seed); byK[k] = byK[k] || {n:0,h:0,c:0}; byK[k].n++;
    const fut = ownNext[i].slice(0, K); let any = false;
    const cv = boxCover(all); const pc = 1-Math.pow(1-cv/10000, fut.length); chance += pc; byK[k].c += pc; expS += fut.length*all.length/10000;
    fut.forEach((y,j) => {
      const hitG = G.filter(g => g.list.some(n => box(n)===box(y.n)));
      if(!hitG.length) return;
      any = true; hitG.forEach(g => srcC[g.key]++); hotBox[box(y.n)] = (hotBox[box(y.n)]||0)+1; timing[j+1] = (timing[j+1]||0)+1;
      if(all.includes(y.n)) straight.push({seed, d0:s[i].d, n:y.n, d:y.d, s:y.s});
    });
    if(any){ fired++; byK[k].h++; }
  }
  const n = idx.length; if(!n){ out.textContent = 'No draws in this window.'; return; }
  const lift = fired/chance;
  const hot = Object.entries(hotBox).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const rep = Object.entries(drawBox).filter(x=>x[1]>1).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const digs = '0123456789'.split('').map(c => ({c, p:(digit[c]||0)/digTot})).sort((a,b)=>b.p-a.p);
  out.innerHTML = `<div class="score">
      <div><div class="v">${pct(fired/n)}<small> vs ${pct(chance/n)}</small></div><div class="l">seeds that fired (chance)</div></div>
      <div><div class="v">${straight.length}<small> vs ${expS.toFixed(1)}</small></div><div class="l">straight hits (chance)</div></div>
      <div><div class="v">${lift.toFixed(2)}x</div><div class="l">lift</div></div>
      <div><div class="v">${n}</div><div class="l">draws as seeds</div></div></div>
    <div class="verdict ${lift>1.1?'good':''}">${scopeLabel.charAt(0).toUpperCase()+scopeLabel.slice(1)}, last ${N} days: each draw was run as a 100 Grand seed and checked against ${scopeSts.length>1?'its own state&rsquo;s':nm(st)+'&rsquo;s'} next ${K} draws. <b>${fired}</b> of <b>${n}</b> fired at least one boxed hit; a random list of the same size would have fired <b>${Math.round(chance)}</b>. ${lift>1.1?'Running warm.':lift<0.9?'Running cold.':'Right on the chance line.'}</div>
    <div class="fams">
      <div class="fam"><div class="famh">Which list fired</div><table class="tbl"><tr><td>Family +</td><td><b>${srcC.plus}</b></td></tr><tr><td>Family &minus;</td><td><b>${srcC.minus}</b></td></tr><tr><td>Mirrors</td><td><b>${srcC.mir}</b> <span class="me">(smaller list)</span></td></tr></table>
        <div class="famh" style="margin-top:8px">When it fired</div><div class="note" style="margin:0">${Object.keys(timing).sort((a,b)=>a-b).map(j=>`+${j}: <b>${timing[j]}</b>`).join(' &middot; ')}</div></div>
      <div class="fam"><div class="famh">By seed type</div><table class="tbl"><tr><th>type</th><th>seeds</th><th>fired</th><th>chance</th></tr>${Object.entries(byK).sort((a,b)=>b[1].n-a[1].n).map(([k,o])=>`<tr><td>${k}</td><td>${o.n}</td><td>${pct(o.h/o.n)}</td><td>${pct(o.c/o.n)}</td></tr>`).join('')}</table></div>
      <div class="fam"><div class="famh">Hot boxes &mdash; drawn most in this window</div>${rep.length? rep.map(([b,c])=>chip(b,'box','&times;'+c)).join('') : '<span class="me">no repeats</span>'}
        <div class="note" style="margin:6px 0 0">A single box is expected about ${(n*24/10000).toFixed(1)} times in ${n} draws; a double about ${(n*12/10000).toFixed(1)}.</div>
        <div class="famh" style="margin-top:8px">Straight hits</div>${straight.length ? straight.map(h=>`<div class="hitrow">${chip(h.seed,'seed')}<span class="me">${h.d0.slice(5)}</span> &rarr; ${chip(h.n,'str')}<span class="me">${h.d.slice(5)}${h.s.toUpperCase()}</span></div>`).join('') : '<span class="me">none in this window</span>'}</div>
    </div>`;
}
function renderScore(){
  const mode = document.getElementById('gMode').value, K = +document.getElementById('gWin').value, st = document.getElementById('gState').value;
  const out = document.getElementById('scoreBody'); out.textContent = 'Computing…';
  setTimeout(() => {
    const cache = {}; const covFor = seed => { const k = kind(seed); if(cache[k]===undefined){ const all=[...new Set(groupsFor(seed).flatMap(g=>g.list))]; cache[k]={n:all.length, cov:boxCover(all)}; } return cache[k]; };
    let n=0, hb=0, hs=0, cb=0, cs=0; const byKind = {};
    const add = (k, hitB, hitS, pB, pS) => { n++; hb+=hitB; hs+=hitS; cb+=pB; cs+=pS; const o = byKind[k] = byKind[k] || {n:0,hb:0,cb:0}; o.n++; o.hb+=hitB; o.cb+=pB; };
    const regional = mode!=='state' || st==='all'; const allow = new Set(REGION4[mode] ? REGION4[mode].states : Object.keys(SEQ));
    if(!regional){
      for(const c in SEQ){ if(c!==st) continue; const s = SEQ[c];
        for(let i=0;i+K<s.length;i++){ const seed = s[i].n, all = [...new Set(groupsFor(seed).flatMap(g=>g.list))]; const B = new Set(all.map(box)), S = new Set(all);
          const fut = s.slice(i+1,i+1+K); const hitB = fut.some(x=>B.has(box(x.n)))?1:0, hitS = fut.some(x=>S.has(x.n))?1:0; const cv = covFor(seed);
          add(kind(seed), hitB, hitS, 1-Math.pow(1-cv.cov/10000,K), 1-Math.pow(1-cv.n/10000,K)); } }
    } else {
      for(let di=0; di+K<DATES.length; di++){ const dt = DATES[di]; const fut = []; for(let k=1;k<=K;k++){ const d2 = isoAdd(dt,k); for(const c in (P4[d2]||{})){ if(!allow.has(c)) continue; for(const x of P4[d2][c]) fut.push(x.n); } }
        const FB = new Set(fut.map(box)), FS = new Set(fut);
        for(const c in P4[dt]){ if(!allow.has(c)) continue; for(const x of P4[dt][c]){ const seed = x.n, all = [...new Set(groupsFor(seed).flatMap(g=>g.list))]; const hitB = all.some(y=>FB.has(box(y)))?1:0, hitS = all.some(y=>FS.has(y))?1:0; const cv = covFor(seed);
          add(kind(seed), hitB, hitS, 1-Math.pow(1-cv.cov/10000,fut.length), 1-Math.pow(1-cv.n/10000,fut.length)); } } }
    }
    if(!n){ out.textContent = 'Not enough draws yet.'; return; }
    const lift = hb/cb;
    out.innerHTML = `<div class="verdict ${lift>1.1?'good':''}"><b>${n.toLocaleString()}</b> seeds (${regional?(REGION4[mode]?REGION4[mode].name:'every state'):nm(st)}, June 1 to now). Box: <b>${pct(hb/n)}</b> of seeds had a hit vs <b>${pct(cb/n)}</b> by chance (lift <b>${lift.toFixed(2)}x</b>). Straight: <b>${pct(hs/n)}</b> vs <b>${pct(cs/n)}</b>. 1.00x means the system does exactly what a random list would.</div>
      <table class="tbl"><tr><th>Seed type</th><th>Seeds</th><th>Box hit</th><th>Chance</th><th>Lift</th></tr>${Object.entries(byKind).sort((a,b)=>b[1].n-a[1].n).map(([k,o]) => `<tr><td>${k}</td><td>${o.n}</td><td>${pct(o.hb/o.n)}</td><td>${pct(o.cb/o.n)}</td><td style="font-weight:700;color:${o.hb/o.cb>1.1?'var(--green)':o.hb/o.cb<0.9?'var(--pen)':'inherit'}">${(o.hb/o.cb).toFixed(2)}x</td></tr>`).join('')}</table>`;
  }, 30);
}

/* ---------- 7. big quad energy ---------- */
const BQE = {'0000':'0057 0146 0257 0346 0457 0546 0657 0746 0857 0957','1111':'1168 1257 1368 1457 1568 1657 1768 1857 1968 2068',
 '2222':'2279 2368 2479 2568 2679 2768 2879 2968 3079 3179','3333':'3390 3479 3590 3679 3790 3879 3990 4079 4190 4290',
 '4444':'4501 4590 4701 4790 4901 4990 5101 5190 5301 5401','5555':'5612 5701 5812 5901 6012 6101 6212 6301 6412 6512',
 '6666':'6723 6812 6923 7012 7123 7212 7323 7412 7523 7623','7777':'7834 7923 8034 8123 8234 8323 8434 8523 8634 8734',
 '8888':'8945 9034 9145 9234 9345 9434 9545 9634 9745 9845','9999':'0056 0145 0256 0345 0456 0545 0656 0745 0856 0956'};
for(const q in BQE) if(typeof BQE[q]==='string') BQE[q] = BQE[q].split(' ');
function renderBQE(){
  const st = document.getElementById('bqState').value, scope = document.getElementById('bqScope').value, N = +document.getElementById('bqDays').value || 14, sortBy = document.getElementById('bqSort').value;
  const states = scopeStates(scope, st), label = scopeName(scope, st);
  const start = isoAdd(DATES[DATES.length-1], -N);
  const where = {}; let total = 0;
  for(const c of states) for(const x of (SEQ[c]||[])){ if(x.d < start) continue; total++; const b = box(x.n); (where[b] = where[b]||[]).push({...x, st:c}); }
  const sets = Object.keys(BQE).map(q => {
    const rel = BQE[q]; const came = rel.filter(r => where[box(r)]), left = rel.filter(r => !where[box(r)]);
    let exp = 0; rel.forEach(r => { exp += 1 - Math.pow(1 - boxCover([r])/10000, total); });
    const quadCame = where[q] || [];
    return {q, rel, came, left, exp, quadCame, strength: exp ? came.length/exp : 0};
  });
  if(sortBy==='strength') sets.sort((a,b) => b.strength - a.strength || b.came.length - a.came.length);
  const wtxt = r => where[box(r)].map(w => `${w.n} ${nm(w.st)} ${w.d.slice(5)}${w.s?w.s.toUpperCase():''}`).join(' · ');
  let html = `<div class="note" style="margin:0 0 8px">${label.charAt(0).toUpperCase()+label.slice(1)}, last ${N} days &middot; ${total.toLocaleString()} draws. A random set of 10 singles would have about <b>${sets[0] ? sets[0].exp.toFixed(1) : 0}</b> come in this many draws.</div>`;
  html += sets.map(s => `<div class="lbwrap"><div class="lbhead">
      <span class="chip ${s.quadCame.length ? 'gone' : 'watch'}" style="font-size:20px;font-weight:700;${s.quadCame.length ? 'background:var(--pen);border-color:var(--pen);color:#fff' : ''}" onclick="useSeed('${s.q}')">${s.q}${s.quadCame.length ? `<span class="mk" style="color:#fff">&#10005; came</span>` : ''}</span>
      <span class="me"><b style="color:var(--pen)">&#10005;</b> ${s.came.length} came &nbsp; <b style="color:var(--green)">&#10003;</b> ${s.left.length} to come &nbsp; chance ${s.exp.toFixed(1)}</span>
      <span class="me" style="margin-left:auto;font-family:'Roboto Mono',monospace;font-weight:700;font-size:14px;color:${s.strength>1.3?'var(--green)':s.strength<0.7?'var(--pen)':'inherit'}">${s.strength.toFixed(2)}x</span></div>
      <div class="hitrow">${s.rel.map(r => where[box(r)] ? `<span class="chip gone" title="${wtxt(r)}" onclick="useSeed('${r}')">${r}<span class="mk">&#10005;</span></span>` : `<span class="chip watch" onclick="useSeed('${r}')">${r}<span class="mk">&#10003;</span></span>`).join('')}</div>
      ${s.came.length ? `<div class="note" style="margin-top:4px">${s.came.map(r => `<b>${r}</b> &rarr; ${wtxt(r)}`).join(' &nbsp;|&nbsp; ')}</div>` : ''}
      ${s.quadCame.length ? `<div class="note" style="margin-top:4px;color:var(--pen)">${s.q} itself: ${s.quadCame.map(w => `${nm(w.st)} ${w.d}${w.s?' '+w.s.toUpperCase():''}`).join(' · ')}</div>` : ''}
    </div>`).join('');
  // quad log: every quad in the feed, with its set 30 days before/after in the same state
  const log = [];
  for(const c in SEQ){ const s = SEQ[c]; s.forEach((x,i) => { if(new Set(x.n).size!==1) return; const rel = BQE[x.n]; const rb = new Set(rel.map(box));
      const before = s.filter(y => y.d < x.d && daysBetween(y.d, x.d) <= 30), after = s.filter(y => y.d > x.d && daysBetween(x.d, y.d) <= 30);
      const cb = [...new Set(before.filter(y => rb.has(box(y.n))).map(y => box(y.n)))].length, ca = [...new Set(after.filter(y => rb.has(box(y.n))).map(y => box(y.n)))].length;
      let eb = 0, ea = 0; rel.forEach(r => { eb += 1-Math.pow(1-boxCover([r])/10000, before.length); ea += 1-Math.pow(1-boxCover([r])/10000, after.length); });
      log.push({d:x.d, st:c, q:x.n, cb, eb, ca, ea, after:after.length}); }); }
  log.sort((a,b) => a.d<b.d?1:-1);
  const tB = log.reduce((a,r)=>a+r.cb,0), tEB = log.reduce((a,r)=>a+r.eb,0), tA = log.reduce((a,r)=>a+r.ca,0), tEA = log.reduce((a,r)=>a+r.ea,0);
  html += `<div class="famh" style="margin-top:14px">Quad log &mdash; every quad in the feed, its set 30 days before and after (same state)</div>
    <div class="verdict ${tB/tEB>1.2||tA/tEA>1.2?'good':''}">${log.length} quads since the feed began. Relatives came <b>before</b> them: <b>${tB}</b> vs <b>${tEB.toFixed(1)}</b> by chance (${(tB/tEB).toFixed(2)}x). <b>After</b>: <b>${tA}</b> vs <b>${tEA.toFixed(1)}</b> (${(tA/tEA).toFixed(2)}x).</div>
    <div class="tscroll"><table class="tbl"><tr><th>date</th><th>state</th><th>quad</th><th>came before (chance)</th><th>came after (chance)</th></tr>${log.map(r => `<tr><td>${r.d}</td><td class="stname">${nm(r.st)}</td><td>${chip(r.q,'seed')}</td><td>${r.cb} <span class="me">(${r.eb.toFixed(1)})</span></td><td>${r.ca} <span class="me">(${r.ea.toFixed(1)})</span>${r.after<40?' <span class="me">still running</span>':''}</td></tr>`).join('')}</table></div>`;
  document.getElementById('bqeCount').textContent = label;
  document.getElementById('bqeBody').innerHTML = html;
}
function daysBetween(a,b){ return Math.round((new Date(b+'T12:00:00Z') - new Date(a+'T12:00:00Z'))/86400000); }

/* ---------- 8. hottest — convergence of 100 Grand, Big Quad Energy and Date Sum ----------
   For a region and an "as of" day: every boxed number, how many systems point at it, and how many
   separate seeds/sets fired. Numbers that already came in the window are dropped. */
function hotBoard(asOf, states, N, withYear, root){
  const start = isoAdd(asOf, -N);
  const H = new Map(); const touch = b => { if(!H.has(b)) H.set(b, {b, types:new Set(), src:0, why:[], rep:null}); return H.get(b); };
  const add = (n, type, label) => { const b = box(n); const e = touch(b); e.types.add(type); if(!e.why.includes(label)){ e.src++; e.why.push(label); } if(!e.rep) e.rep = n; };
  const came = new Set(); const seeds = [];
  for(const c of states) for(const x of (SEQ[c]||[])){ if(x.d < start || x.d >= asOf) continue; came.add(box(x.n)); seeds.push({...x, st:c}); }
  // 100 Grand: relatives still to come, from every seed drawn in the window
  for(const s of seeds){ for(const g of groupsFor(s.n)) for(const n of g.list){ if(came.has(box(n)) || box(n)===box(s.n)) continue; add(n, 'G', '100 Grand from '+s.n+' ('+nm(s.st)+' '+s.d.slice(5)+')'); } }
  // Big Quad Energy: relatives still to come; a set counts once, twice if 3+ of its relatives already came (a live set)
  for(const q in BQE){ const rel = BQE[q]; const k = rel.filter(r => came.has(box(r))).length; for(const r of rel){ if(came.has(box(r))) continue; add(r, 'Q', 'Big Quad '+q+' ('+k+' of 10 came)'); if(k>=3) touch(box(r)).src++; } }
  // My Lil Yeah: relatives still to come of mains drawn in the window
  for(const s of seeds){ const rel = FAMILY_TREE[box(s.n)]; if(!rel) continue; for(const r of rel){ if(came.has(r)) continue; add(r, 'Y', 'Family Tree from '+s.n+' ('+nm(s.st)+' '+s.d.slice(5)+')'); } }
  // Date Sum: today's group
  const { sum } = dsDateSum(asOf, withYear); const ls = dsList(sum, root);
  for(const w in ls.byWays) for(const b of ls.byWays[w]){ if(came.has(b)) continue; add(b, 'S', 'Date Sum '+(root ? 'root '+dsRoot(sum) : 'sum '+sum)); }
  return [...H.values()].sort((a,b) => b.types.size - a.types.size || b.src - a.src || (a.b<b.b?-1:1));
}
function renderHot(){
  const scope = document.getElementById('hotScope').value, N = +document.getElementById('hotDays').value || 7, TOP = +document.getElementById('hotN').value || 12, MIN = +document.getElementById('hotMin').value || 2;
  const withYear = (document.getElementById('dsCount')||{}).value === 'year', root = (document.getElementById('dsGroup')||{}).value === 'root';
  const states = scopeStates(scope, 'all'), label = scopeName(scope, 'all'); const asOf = DATES[DATES.length-1];
  const ranked = hotBoard(isoAdd(asOf, 1), states, N, withYear, root).filter(e => e.types.size >= MIN);
  const top = ranked.slice(0, TOP);
  document.getElementById('hotCount').textContent = `${label} · ${N}-day window · ${fmtDate(asOf)}`;
  document.getElementById('hotBoard').innerHTML = top.length ? '<div class="heatgrid">' + top.map((e,i) => `<div class="heat ${i<6?'hot':i<12?'warm':''}" onclick="useSeed('${e.rep}')"><div class="hn">${e.rep}</div><div class="ht">${['G','Q','Y','S'].filter(t => e.types.has(t)).map(t => `<i class="h${t}">${t}</i>`).join('')}<span class="me">${e.types.size} sys · ${e.src} src</span></div><div class="hw">${e.why.slice(0,3).join('<br>')}${e.why.length>3?'<br>+'+(e.why.length-3)+' more':''}</div></div>`).join('') + '</div>'
    : '<div class="soon">Nothing meets that bar right now &mdash; loosen "need at least".</div>';
  // honesty line: run the same board as of each of the last 30 days, check the top 6 against that day's draws in the region
  setTimeout(() => {
    let n=0, hit=0, exp=0, days=0;
    const idx = DATES.indexOf(asOf);
    for(let k=Math.max(1, idx-29); k<=idx; k++){
      const D = DATES[k]; const b = hotBoard(D, states, N, withYear, root).filter(e => e.types.size >= MIN).slice(0,6); if(!b.length) continue;
      const drawsD = []; for(const c of states) for(const x of ((P4[D]||{})[c]||[])) drawsD.push(x.n);
      if(!drawsD.length) continue; days++;
      const bset = new Set(b.map(e => e.b)); const h = drawsD.filter(x => bset.has(box(x))).length;
      hit += h; n += drawsD.length; exp += drawsD.length * b.reduce((a,e) => a + boxCover([e.rep])/10000, 0);
    }
    document.getElementById('hotScore').innerHTML = days ? `<div class="verdict ${hit>exp*1.3&&hit>=5?'good':''}">Scorecard &mdash; the red six, rebuilt as of each of the last ${days} days and checked against that day&rsquo;s draws in ${label}: <b>${hit}</b> boxed hits vs <b>${exp.toFixed(1)}</b> by chance (<b>${exp?(hit/exp).toFixed(2):'—'}&times;</b>). 1.00&times; = the board does what six random numbers would.</div>` : '';
  }, 30);
}

/* ---------- 9. straight finder — same as Almanac Convergence ----------
   Marcus's method: take a number, list every straight way (4/6/12/24 for Pick 4), see when each last
   came in the chosen draw (Midday or Evening) across the states, and play the one longest out —
   straight plus a box for insurance. */
function sfPerms(v){ const out = new Set(); const go = (pre, rest) => { if(!rest.length){ out.add(pre); return; } for(let i=0;i<rest.length;i++) go(pre+rest[i], rest.slice(0,i)+rest.slice(i+1)); }; go('', v); return [...out].sort(); }
function sfFillStates(){ const sel = document.getElementById('sfState'); if(!sel || sel.options.length > 1) return;
  Object.keys(SEQ).sort((a,b) => nm(a).localeCompare(nm(b))).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = nm(c); sel.appendChild(o); }); }
function sfTyped(){ const el = document.getElementById('sfBox'); el.value = (el.value.match(/\d/g)||[]).join('').slice(0,4);
  if(el.value.length===4){ renderStraight(); try{ el.blur(); }catch(e){} } else document.getElementById('sfOut').innerHTML = 'Type ' + (4-el.value.length) + ' more digit' + (el.value.length===3?'':'s') + '&hellip;'; }
function renderStraight(){
  const out = document.getElementById('sfOut'); if(!out) return; sfFillStates();
  const v = (document.getElementById('sfBox').value||'').replace(/\D/g,'');
  if(v.length !== 4){ out.innerHTML = 'Type a four-digit number.'; return; }
  const slot = document.getElementById('sfSlot').value || 'm', st = document.getElementById('sfState').value || '', rg = document.getElementById('sfRegion').value || 'all';
  const states = st ? [st] : scopeStates(rg, 'all'); const allow = new Set(states);
  const P = sfPerms(v), k = P.length, pset = new Set(P);
  const all = []; for(const c of states) for(const x of (SEQ[c]||[])){ if(slot !== 'b' && x.s !== slot) continue; all.push({date:x.d, c, n:x.n, s:x.s}); }
  const slotName = slot==='m' ? 'Midday' : slot==='e' ? 'Evening' : 'Midday + Evening';
  if(!all.length){ out.innerHTML = '<div class="note">No '+slotName.toLowerCase()+' draws for that choice yet.</div>'; return; }
  const dates = [...new Set(all.map(d => d.date))].sort(), first = dates[0], last = dates[dates.length-1], today = DATES[DATES.length-1];
  const hits = all.filter(d => pset.has(d.n)).sort((a,b) => b.date.localeCompare(a.date) || nm(a.c).localeCompare(nm(b.c)));
  const perDate = {}; all.forEach(d => perDate[d.date] = (perDate[d.date]||0) + 1);
  const drawsAfter = dt => dates.filter(x => x > dt).reduce((s,x) => s + perDate[x], 0);
  const rows = P.map(p => { const H = hits.filter(h => h.n === p), L = H[0]; return { p, times:H.length, last:L ? L.date : null, st:L ? L.c : null, days:L ? daysBetween(L.date, today) : null, draws:L ? drawsAfter(L.date) : null }; });
  const age = r => r.last ? daysBetween(r.last, today) : 1e6;
  rows.sort((a,b) => age(b) - age(a) || a.p.localeCompare(b.p));
  const top = age(rows[0]); let tied = rows.filter(r => age(r) === top); let tieNote = '';
  // break a tie by widening the net: same region both draws, then all states both draws
  const lastIn = (p, sts, anySlot) => { let L = null; for(const c of sts) for(const x of (SEQ[c]||[])){ if(x.n !== p) continue; if(!anySlot && x.s !== slot) continue; if(!L || x.d > L.d) L = {d:x.d, c}; } return L; };
  const widen = [[states, true, 'checked both draws too'], [Object.keys(SEQ), true, 'checked every state, both draws']];
  for(const [sts, anySlot, note] of widen){
    if(tied.length <= 1) break;
    const scored = tied.map(r => ({r, L: lastIn(r.p, sts, anySlot)}));
    const oldest = Math.max(...scored.map(s => s.L ? daysBetween(s.L.d, today) : 1e6));
    const keep = scored.filter(s => (s.L ? daysBetween(s.L.d, today) : 1e6) === oldest);
    if(keep.length < tied.length){ tied = keep.map(s => s.r); tieNote = note + (keep[0].L ? ' &mdash; ' + tied.map(r => r.p).join(' / ') + ' last came ' + fmtDate(keep[0].L.d).replace(/^\w+, /,'') + ' ' + nm(keep[0].L.c) : ' &mdash; never come anywhere'); }
  }
  rows.forEach(r => r.pick = tied.includes(r));
  const kindName = k===1?'quad':k===4?'triple':k===6?'double-double':k===12?'double':'single';
  const lab = d => fmtDate(d); const short = d => fmtDate(d).replace(/^\w+, /,'');
  const scope = st ? nm(st) : (rg==='all' ? 'All states' : REGION4[rg].name);
  let h = '<div class="sfhead"><b>'+v+'</b> is a <b>'+kindName+'</b> &mdash; '+k+' straight way'+(k>1?'s':'')+'. <span style="color:var(--ink-soft)">'+slotName+' &middot; '+scope+' &middot; history '+short(first)+' to '+short(last)+' &middot; '+all.length.toLocaleString()+' draws</span></div>';
  if(k > 1){
    const t0 = tied[0];
    h += '<div class="sfplay">PLAY STRAIGHT: <b>'+tied.map(r => r.p).join(' / ')+'</b>'+
      (tied.length>1 ? ' <span style="font-weight:400">(still tied after '+(tieNote||'checking this draw')+' &mdash; pick either)</span>'
                     : ' <span style="font-weight:400">&middot; '+(t0.last ? 'last came '+slotName.toLowerCase()+' '+short(t0.last)+', '+nm(t0.st)+' &middot; '+t0.days+' days out' : 'never come '+slotName.toLowerCase()+' in '+scope.toLowerCase()+' ('+all.length.toLocaleString()+' draws)')+(tieNote ? ' &middot; tie broken: '+tieNote : '')+'</span>')+
      '</div>';
  }
  h += '<div class="tscroll"><table class="tbl sft"><tr><th>#</th><th>Straight</th><th>Last came ('+slotName.toLowerCase()+')</th><th>State</th><th>Days out</th><th>Draws out</th><th>Times</th></tr>'+
    rows.map((r,i) => '<tr'+(r.pick && k>1 ? ' class="sftop"' : '')+'><td>'+(age(r)===top ? '1' : (i+1))+'</td><td class="dnum">'+r.p+'</td><td>'+(r.last ? lab(r.last) : '<b>never in the record</b> <span class="me">(history starts '+short(first)+')</span>')+'</td><td>'+(r.st ? nm(r.st) : '')+'</td><td>'+(r.last ? r.days : '&gt;'+daysBetween(first, today))+'</td><td>'+(r.last ? r.draws : '&gt;'+all.length)+'</td><td>'+r.times+'</td></tr>').join('')+'</table></div>';
  h += '<div class="sfsub">Every time it came '+(slot==='b'?'':slotName.toLowerCase()+' ')+'&mdash; '+hits.length+' hit'+(hits.length===1?'':'s')+'</div>';
  if(hits.length) h += '<div class="tscroll"><table class="tbl sft"><tr><th>Draw date</th><th>State</th><th>Draw</th><th>Result</th></tr>'+hits.map(x => '<tr'+(tied.some(r=>r.p===x.n)&&k>1?' class="sftop"':'')+'><td>'+lab(x.date)+'</td><td>'+nm(x.c)+'</td><td>Pick 4 '+(x.s==='m'?'Midday':'Evening')+'</td><td class="dnum">'+x.n.split('').join('-')+'</td></tr>').join('')+'</table></div>';
  // scorecard for this slot: when a box came, was it the longest-out way?
  const sc = sfScore(slot, allow);
  h += '<details style="margin-top:10px"><summary style="cursor:pointer;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:11px;color:var(--ink-soft)">Does longest-out work? &mdash; scorecard</summary><div class="note">Each straight way has the same chance in every draw &mdash; 1 in 10,000 &mdash; however long it has been out. Tested on every Pick 4 draw in this history ('+slotName.toLowerCase()+', '+scope+'): when a boxed number came, the longest-out way was the one that came '+
    ['24','12','6','4'].filter(w => sc[w] && sc[w].n >= 20).map(w => `<b>${pct(sc[w].h/sc[w].n)}</b> of the time for ${ {24:'singles',12:'doubles',6:'double-doubles',4:'triples'}[w] } (chance ${pct(1/+w)}, n=${sc[w].n})`).join(', ')+'. Straight pays $5,000 on $1; the box ('+(k===24?'$200':k===12?'$400':k===6?'$800':'$1,200')+' on $1) keeps the play alive when it comes another way.</div></details>';
  out.innerHTML = h;
}
const SF_SC = {};
function sfScore(slot, allow){
  const key = slot + '|' + [...allow].sort().join(','); if(SF_SC[key]) return SF_SC[key];
  const all = []; for(const c of allow) for(const x of (SEQ[c]||[])){ if(slot !== 'b' && x.s !== slot) continue; all.push(x); }
  all.sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  const last = {}; const sc = {}; const cut = all.length ? isoAdd(all[0].d, 60) : '9999';   // let 60 days of history build before scoring
  for(const x of all){ const P = sfPerms(x.n), k = P.length;
    if(k > 1 && x.d >= cut){ const ls = P.map(p => last[p] || '0000'); const oldest = ls.reduce((a,b) => a < b ? a : b); const cands = P.filter((p,i) => ls[i] === oldest);
      if(cands.length < k){ const o = sc[k] = sc[k] || {n:0,h:0}; o.n++; if(cands.includes(x.n)) o.h += 1/cands.length; } }
    last[x.n] = x.d; }
  return (SF_SC[key] = sc);
}
function openStraight(n){ const b = document.getElementById('sfBox'); if(!b) return; b.value = n; showTab('sf'); renderStraight(); window.scrollTo({top:0,behavior:'smooth'}); }

/* ---------- 10. My Lil Yeah — Pick 4 Family Tree ----------
   FAMILY_TREE (tree.js): main box -> relatives (boxes). Relatives share the main's digit sum, or the sum +5. */
const FT_PARENTS = {};
for(const m in FAMILY_TREE) for(const r of FAMILY_TREE[m]) (FT_PARENTS[r] = FT_PARENTS[r] || []).push(m);
function mlyTyped(){ const el = document.getElementById('mlyNum'); el.value = (el.value.match(/\d/g)||[]).join('').slice(0,4);
  if(el.value.length===4){ renderMLY(); try{ el.blur(); }catch(e){} } else document.getElementById('mlyBody').innerHTML = 'Type ' + (4-el.value.length) + ' more digit' + (el.value.length===3?'':'s') + '&hellip;'; }
function renderMLY(){
  const el = document.getElementById('mlyBody'); if(!el) return;
  const T = (document.getElementById('mlyNum').value||'').replace(/\D/g,'');
  const st = document.getElementById('mlyState').value, scope = document.getElementById('mlyScope').value, N = +document.getElementById('mlyDays').value || 14;
  const states = scopeStates(scope, st), label = scopeName(scope, st), start = isoAdd(DATES[DATES.length-1], -N);
  const where = {}; let total = 0; const seqIn = [];
  for(const c of states) for(const x of (SEQ[c]||[])){ if(x.d < start) continue; total++; const b = box(x.n); (where[b] = where[b]||[]).push({...x, st:c}); seqIn.push({...x, st:c}); }
  seqIn.sort((a,b) => a.d<b.d?-1:a.d>b.d?1:0);
  const wtxt = b => (where[b]||[]).map(w => `${w.n} ${nm(w.st)} ${w.d.slice(5)}${w.s?w.s.toUpperCase():''}`).join(' · ');
  document.getElementById('mlyBoard').innerHTML = `<button class="ghost" onclick="renderMLYBoard()">Compute for ${label} · last ${N} days</button>`;
  document.getElementById('mlyScore').innerHTML = `<button class="ghost" onclick="renderMLYScore()">Compute scorecard</button>`;
  if(T.length!==4){ el.innerHTML = 'Type a four-digit number, or tap one anywhere on the page.'; return; }
  const B = box(T); const rel = FAMILY_TREE[B] || []; const mains = FT_PARENTS[B] || [];
  const came = rel.filter(r => where[r]), left = rel.filter(r => !where[r]);
  let exp = 0; rel.forEach(r => { exp += 1 - Math.pow(1 - boxCover([r])/10000, total); });
  const selfCame = where[B] || [];
  let h = `<div class="seedbar"><span class="seedbig">${T}</span><span class="seedkind">${kind(T)} &middot; box ${B} &middot; ${rel.length} relatives &middot; ${label}, last ${N} days (${total.toLocaleString()} draws)</span></div>`;
  h += `<div class="lbwrap"><div class="lbhead"><div class="famh">The family</div><span class="me"><b style="color:var(--pen)">&#10005;</b> ${came.length} came &nbsp; <b style="color:var(--green)">&#10003;</b> ${left.length} still to come &nbsp; (chance: about ${exp.toFixed(1)} of ${rel.length})</span></div>
    <div class="hitrow"><span class="when">Main number</span>${selfCame.length ? `<span class="chip gone" style="background:var(--pen);border-color:var(--pen);color:#fff">${T}<span class="mk" style="color:#fff">&#10005; ${selfCame.length}&times;</span></span><span class="me">${wtxt(B)}</span>` : `<span class="chip watch" style="background:var(--green);border-color:var(--green);color:#fff">${T}<span class="mk" style="color:#fff">&#10003;</span></span><span class="me">not drawn in this window</span>`}</div>
    <div class="hitrow"><span class="when">Relatives</span>${rel.map(r => where[r] ? `<span class="chip gone" title="${wtxt(r)}" onclick="useSeed('${r}')">${r}<span class="mk">&#10005;</span></span>` : `<span class="chip watch" onclick="useSeed('${r}')">${r}<span class="mk">&#10003;</span></span>`).join('')}</div>
    ${came.length ? `<div class="note" style="margin-top:4px">${came.map(r => `<b>${r}</b> &rarr; ${wtxt(r)}`).join(' &nbsp;|&nbsp; ')}</div>` : ''}</div>`;
  // what brought it: relatives drawn BEFORE each appearance of the main, in the window
  if(selfCame.length){
    const first = selfCame.slice().sort((a,b)=>a.d<b.d?-1:1)[0];
    const before = seqIn.filter(x => x.d < first.d && rel.includes(box(x.n)));
    h += `<div class="famh" style="margin-top:10px">What brought it &mdash; relatives drawn before ${T} came (${first.d.slice(5)}${first.s?first.s.toUpperCase():''} ${nm(first.st)})</div>` + (before.length ? `<div class="hitrow">${before.map(x => `${chip(x.n,'box')}<span class="me">${nm(x.st)} ${x.d.slice(5)}${x.s?x.s.toUpperCase():''}</span>`).join('')}</div>` : '<div class="note">None of its relatives came before it in this window.</div>');
  }
  // it is itself a relative of these mains
  if(mains.length) h += `<div class="famh" style="margin-top:10px">${T} is a relative of</div><div class="hitrow">${mains.map(m => `<span class="chip ${where[m]?'gone':''}" onclick="useSeed('${m}')">${m}${where[m]?'<span class="mk">&#10005;</span>':''}</span>`).join('')}<span class="me">&#10005; = that main came in the window</span></div>`;
  el.innerHTML = h;
}
function renderMLYBoard(){
  const st = document.getElementById('mlyState').value, scope = document.getElementById('mlyScope').value, N = +document.getElementById('mlyDays').value || 14;
  const states = scopeStates(scope, st), label = scopeName(scope, st), start = isoAdd(DATES[DATES.length-1], -N);
  const where = {}; const mainsSeen = {};
  for(const c of states) for(const x of (SEQ[c]||[])){ if(x.d < start) continue; const b = box(x.n); (where[b] = where[b]||[]).push({...x, st:c}); if(FAMILY_TREE[b]) (mainsSeen[b] = mainsSeen[b]||[]).push({...x, st:c}); }
  const rows = Object.keys(mainsSeen).map(b => { const rel = FAMILY_TREE[b]; const came = rel.filter(r => where[r]); return {b, n:mainsSeen[b].length, rel, came, left: rel.filter(r => !where[r]), last: mainsSeen[b].slice(-1)[0]}; });
  rows.sort((a,b) => b.n - a.n || b.came.length - a.came.length || (a.b<b.b?-1:1));
  const repeated = rows.filter(r => r.n >= 2);
  document.getElementById('mlyBoard').innerHTML = `<div class="note" style="margin:6px 0">${rows.length} mains drawn in ${label} in the last ${N} days; <b>${repeated.length}</b> repeated (the book says their relatives are stronger &mdash; the scorecard below checks that). Sorted: repeated first, then most relatives already in.</div>
    <div class="tscroll"><table class="tbl"><tr><th>main</th><th>times</th><th>relatives: &#10005; came &middot; &#10003; still to come</th></tr>${rows.slice(0,60).map(r => `<tr${r.n>=2?' style="background:rgba(255,158,74,.10)"':''}><td>${chip(r.b, r.n>=2?'hot':'')}<div class="me">${nm(r.last.st)} ${r.last.d.slice(5)}</div></td><td>${r.n}</td><td>${r.rel.map(x => where[x] ? `<span class="chip gone" title="${where[x].map(w=>w.n+' '+nm(w.st)+' '+w.d.slice(5)).join(' · ')}" onclick="useSeed('${x}')">${x}<span class="mk">&#10005;</span></span>` : `<span class="chip watch" onclick="useSeed('${x}')">${x}<span class="mk">&#10003;</span></span>`).join('')}</td></tr>`).join('')}</table></div>${rows.length>60?'<div class="note">Showing the top 60.</div>':''}`;
}
function renderMLYScore(){
  const el = document.getElementById('mlyScore'); el.textContent = 'Computing…';
  setTimeout(() => {
    const K = 12; let n=0,h=0,c=0, nR=0,hR=0,cR=0, n1=0,h1=0,c1=0;
    for(const st in SEQ){ const s = SEQ[st]; const last = {};
      for(let i=0;i<s.length;i++){ const b = box(s[i].n); const rel = FAMILY_TREE[b];
        if(rel && i+K < s.length){ const fut = new Set(s.slice(i+1,i+1+K).map(y => box(y.n))); const hit = rel.some(r => fut.has(r)) ? 1 : 0; let p = 1 - Math.pow(1 - rel.reduce((a,r)=>a+boxCover([r]),0)/10000, K);
          n++; h+=hit; c+=p;
          if(last[b] !== undefined && daysBetween(last[b], s[i].d) <= 30){ nR++; hR+=hit; cR+=p; } else { n1++; h1+=hit; c1+=p; } }
        last[b] = s[i].d; } }
    const L = (a,b) => b ? (a/b).toFixed(2)+'&times;' : '—';
    el.innerHTML = `<div class="verdict ${h/c>1.1?'good':''}">Same state, every draw in the feed (${n.toLocaleString()} mains): after a main number came, a relative followed within the next ${K} draws <b>${pct(h/n)}</b> of the time vs <b>${pct(c/n)}</b> by chance (<b>${L(h,c)}</b>).<br>
      Repeated mains (came twice within 30 days, ${nR.toLocaleString()}): <b>${pct(hR/nR)}</b> vs <b>${pct(cR/nR)}</b> (${L(hR,cR)}) &middot; first-time mains: <b>${pct(h1/n1)}</b> vs <b>${pct(c1/n1)}</b> (${L(h1,c1)}). 1.00&times; = the relatives come exactly as often as any random numbers of the same shape.</div>`;
  }, 20);
}

/* ---------- 11. State Needs — the four systems as one unit, per state ----------
   Pull of a boxed number in a state = relatives of it that fell there in the window (G + Q + Y), + S today. */
const ALLBOX = (() => { const s = new Set(); for(let i=0;i<10000;i++) s.add(box(String(i).padStart(4,'0'))); return [...s].sort(); })();
const QSET = {}; for(const q in BQE) for(const r of BQE[q]) (QSET[box(r)] = QSET[box(r)] || []).push(q);
const GL = new Map();
function glistBox(n){ const b = box(n); if(GL.has(b)) return GL.get(b); const s = new Set(); for(const g of groupsFor(n)) for(const x of g.list){ const xb = box(x); if(xb !== b) s.add(xb); } GL.set(b, s); return s; }
function pullCounts(draws){   // draws: [{n, st, d, s}]
  const G = {}, Q = {}, Y = {}, why = {};
  const add = (M, t, label) => { M[t] = (M[t]||0)+1; const w = (why[t] = why[t] || []); if(!w.includes(label)) w.push(label); };
  for(const x of draws){ const b = box(x.n); const lab = `${x.n} ${nm(x.st)} ${x.d.slice(5)}`;
    for(const t of glistBox(x.n)) add(G, t, 'G '+lab);
    for(const q of (QSET[b]||[])) for(const r of BQE[q]){ const rb = box(r); if(rb !== b) add(Q, rb, 'Q '+lab+' (set '+q+')'); }
    if(new Set(b).size===1) for(const r of (BQE[b]||[])) add(Q, box(r), 'Q quad '+lab);
    for(const r of (FAMILY_TREE[b]||[])) add(Y, r, 'Y '+lab);
    for(const m of (FT_PARENTS[b]||[])) add(Y, m, 'Y '+lab); }
  return {G, Q, Y, why};
}
function windowDraws(states, start, end){ const out = []; for(const c of states) for(const x of (SEQ[c]||[])){ if(x.d >= start && x.d < end) out.push({...x, st:c}); } return out; }
function ndTyped(){ const el = document.getElementById('ndNum'); el.value = (el.value.match(/\d/g)||[]).join('').slice(0,4); if(el.value.length===4){ renderNeedWhere(); try{ el.blur(); }catch(e){} } else document.getElementById('needWhere').innerHTML = el.value ? 'Type '+(4-el.value.length)+' more digit'+(el.value.length===3?'':'s')+'&hellip;' : ''; }
// one ranked list for a set of states as of the morning of `asOf` (draws before asOf only).
// Each system's count is divided by the average count that system gives numbers of the same TYPE
// (single / double / double-double / triple / quad), so a triple at 2.0 is as strong for a triple as a
// single at 2.0 is for a single. Raw counts favour singles because they sit in many more lists.
const KINDW = b => boxCover([b]);   // 24 single, 12 double, 6 double-double, 4 triple, 1 quad
function needList(states, asOf, N, w, regKey, withYear, root){
  const start = isoAdd(asOf, -N); const own = windowDraws(states, start, asOf); const P = pullCounts(own);
  let PR = null, nOthers = 1;
  if(w > 0 && regKey && states.length === 1){ const others = REGION4[regKey].states.filter(c => c!==states[0] && SEQ[c]); nOthers = Math.max(1, others.length); PR = pullCounts(windowDraws(others, start, asOf)); }
  const { sum } = dsDateSum(asOf, withYear); const inSum = new Set(); const ls = dsList(sum, root); for(const k in ls.byWays) ls.byWays[k].forEach(b => inSum.add(b));
  const came = new Set(own.map(x => box(x.n)));
  // P = missing pairs / triads: the 5 longest-out pairs and 5 longest-out triads here (by days), counted in each number
  const lastP = {}; for(const c of states) for(const x of (SEQ[c]||[])){ if(x.d >= asOf) continue; for(const k of [2,3]) for(const t of cof(k, x.n)){ const key = k+t; if(!lastP[key] || x.d > lastP[key]) lastP[key] = x.d; } }
  const longOut = [];
  for(const k of [2,3]){ const keys = comboInfo(k).keys.map(t => [t, lastP[k+t] || '0000']).sort((a,b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : (a[0]<b[0]?-1:1)).slice(0,5); keys.forEach(([t,d]) => longOut.push({k, t, d})); }
  const PP = {}, PW = {};
  for(const b of ALLBOX){ for(const o of longOut){ if(cof(o.k, b).has(o.t)){ PP[b] = (PP[b]||0) + (o.k===3 ? 2 : 1); (PW[b] = PW[b] || []).push('P '+(o.k===2?'pair ':'triad ')+o.t.split('').join('-')+' out since '+(o.d==='0000'?'start':o.d.slice(5))); } } }
  // N = neighbors: draws here in the last 2 days that are one digit off (+1, -1, mirror) from the number
  const NN = {}, NW = {}; const recent = windowDraws(states, isoAdd(asOf, -2), asOf);
  for(const x of recent) for(const nb of neighborsOf(x.n)){ NN[nb.b] = (NN[nb.b]||0) + 1; (NW[nb.b] = NW[nb.b] || []).push('N '+x.n+' '+nm(x.st)+' '+x.d.slice(5)); }
  const SYS = ['G','Q','Y','P','N'];
  const rows = ALLBOX.map(b => { const k = KINDW(b); const g = P.G[b]||0, q = P.Q[b]||0, y = P.Y[b]||0, s = inSum.has(b)?1:0, pp = PP[b]||0, nn = NN[b]||0;
    const r = PR ? ((PR.G[b]||0)+(PR.Q[b]||0)+(PR.Y[b]||0))/nOthers : 0;
    return {b, k, G:g + w*r, Q:q, Y:y, P:pp, N:nn, g, q, y, p:pp, n:nn, s, r, raw: g+q+y + w*r, sys:(g>0)+(q>0)+(y>0)+(s>0)+(pp>0)+(nn>0), fell: came.has(b), extra:[...(PW[b]||[]), ...(NW[b]||[])]}; });
  // every system gets an equal vote: where the number ranks for that system among numbers of its own type
  const below = (arr, v) => { let lo = 0, hi = arr.length; while(lo < hi){ const m = (lo+hi)>>1; if(arr[m] < v) lo = m+1; else hi = m; } return lo; };
  for(const X of SYS){ const byK = {}; rows.forEach(r => (byK[r.k] = byK[r.k] || []).push(r[X])); for(const k in byK) byK[k].sort((a,b) => a-b);
    rows.forEach(r => { const arr = byK[r.k]; r['r'+X] = r[X] > 0 ? (arr.length > 1 ? below(arr, r[X])/(arr.length-1) : 1) : 0; }); }
  rows.forEach(r => { r.str = SYS.reduce((a,X) => a + r['r'+X], 0) + r.s; });
  // and the combined score is ranked within type once more, so each type's strongest number reaches the top
  const live = rows.filter(r => !r.fell && r.str > 0); const byK2 = {}; live.forEach(r => (byK2[r.k] = byK2[r.k] || []).push(r.str)); for(const k in byK2) byK2[k].sort((a,b) => a-b);
  live.forEach(r => { const arr = byK2[r.k]; r.rank = arr.length > 1 ? below(arr, r.str)/(arr.length-1) : 1; });
  return { rows: rows.filter(r => !r.fell && r.str > 0).sort((a,b) => b.rank-a.rank || b.str-a.str || b.sys-a.sys || (a.b<b.b?-1:1)), P, own, sum };
}
const KINDNAME = {24:'single', 12:'double', 6:'2 doubles', 4:'triple', 1:'quad'};
function renderNeed(){
  const el = document.getElementById('needBody'); if(!el) return;
  const st = document.getElementById('ndState').value, N = +document.getElementById('ndDays').value || 60, w = +document.getElementById('ndRegion').value || 0, TOP = +document.getElementById('ndN').value || 20;
  const states = st==='all' ? Object.keys(SEQ) : [st]; const asOf = DATES[DATES.length-1]; const tomorrow = isoAdd(asOf, 1);
  const regKey = Object.keys(REGION4).find(k => REGION4[k].states.includes(st));
  const withYear = (document.getElementById('dsCount')||{}).value === 'year', root = (document.getElementById('dsGroup')||{}).value === 'root';
  const L = needList(states, tomorrow, N, w, regKey, withYear, root); const P = L.P, own = L.own;
  const lastSeen = {}; for(const c of states) for(const x of (SEQ[c]||[])) lastSeen[box(x.n)] = x;
  const dueAll = L.rows; const due = dueAll.slice(0, 12), more = dueAll.slice(12, Math.max(TOP, 12));
  const drawsWeek = Math.round(own.length/N*7);
  const place = dueAll.length ? '' : '';
  const kinds = {}; due.forEach(r => kinds[r.k] = (kinds[r.k]||0)+1);
  const fired = r => [...(r.extra||[]).filter(x => x[0]==='N'), ...(P.why[r.b]||[]).slice().reverse(), ...(r.extra||[]).filter(x => x[0]==='P')];
  const label = st==='all' ? 'all states' : nm(st);
  const row = (r,i) => { const last = lastSeen[r.b];
    return `<tr><td>${i+1}</td><td>${chip(r.b, i<6?'hotr':i<12?'warmo':'')}</td><td class="me">${KINDNAME[r.k]}</td><td style="font-weight:700">${r.str.toFixed(1)}<span class="me" style="font-weight:400"> / 6</span></td><td class="me">${r.rank >= 0.995 ? '#1' : 'top '+Math.max(1, Math.round((1-r.rank)*100))+'%'}</td><td><span title="G ${r.g} · Q ${r.q} · Y ${r.y} · P ${r.p} · N ${r.n}${r.s?' · S':''}">${['G','Q','Y','P','N','S'].filter((t,k) => [r.g,r.q,r.y,r.p,r.n,r.s][k]>0).map(t => `<i class="h${t}" style="font-style:normal;font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;border-radius:3px;padding:0 4px;color:#fff;margin-right:2px">${t}</i>`).join('')}</span></td><td class="me">${last ? last.d.slice(5)+' ('+daysBetween(last.d, asOf)+'d)' : 'never'}</td><td class="me">${fired(r).slice(0,2).map(x => x.slice(2)).join(' · ')}${fired(r).length>2?' · +'+(fired(r).length-2):''}</td><td class="me">${pct(1 - Math.pow(1 - boxCover([r.b])/10000, drawsWeek))}</td></tr>`; };
  const head = `<tr><th>#</th><th>number</th><th>type</th><th>score</th><th>among its type</th><th>systems</th><th>last here</th><th>what fired (newest first)</th><th>chance this week</th></tr>`;
  el.innerHTML = `<div id="needCheck" class="verdict">Checking the last 30 days&hellip;</div>
    <div class="note" style="margin:0 0 6px">${label} &middot; ${N}-day pull &middot; ${own.length} draws${w>0&&regKey&&st!=='all'?` &middot; region help ${REGION4[regKey].name} ${w}&times;`:''} &middot; Date Sum ${fmtDate(tomorrow).replace(/, \d{4}$/,'')}: ${root?'root '+dsRoot(L.sum):'sum '+L.sum} &middot; top 12 today: ${Object.keys(kinds).sort((a,b)=>b-a).map(k => kinds[k]+' '+KINDNAME[k]+(kinds[k]>1&&!/s$/.test(KINDNAME[k])?'s':'')).join(', ')}</div>
    <div class="famh">Due here &mdash; strongest for its type first (red = top 6, orange = next 6)</div>
    <div class="tscroll"><table class="tbl">${head}${due.map(row).join('')}</table></div>
    ${more.length ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:11px;color:var(--ink-soft)">Next ${more.length}</summary><div class="tscroll"><table class="tbl">${more.map((r,i) => row(r, i+12)).join('')}</table></div></details>` : ''}
    <div class="note"><b>Score out of 6, one point per system.</b> <b>G</b> 100 Grand (and its Relatives), <b>Q</b> Big Quad Energy, <b>Y</b> My Lil Yeah, <b>P</b> holds one of the 5 longest-out pairs or triads here, <b>N</b> a neighbor (mirror / &plusmn;1 on one digit) fell here in the last 2 days, <b>S</b> today&rsquo;s Date Sum. For G, Q, Y, P and N the point is where the number ranks against numbers of its <i>own type</i> &mdash; a single sits in about 24 arrangements&rsquo; worth of lists, so raw counts would always bury triples and quads. The score is then ranked within type again (&ldquo;#1&rdquo; = the strongest of its type here), so the best triple and quad sit next to the best single. Hover the letters for the raw G / Q / Y counts. &ldquo;Chance this week&rdquo; is how often that number comes here in a week by luck alone &mdash; a single is about 6&times; a triple and 24&times; a quad.</div>
    <div class="famh" style="margin-top:12px">Did it work? &mdash; the list as it stood each morning, last 30 days</div><div id="needLog" class="note">Computing&hellip;</div>`;
  document.getElementById('needScore').innerHTML = `<button class="ghost" onclick="renderNeedScore()">Compute for ${nm(st)} · ${N}-day pull</button>`;
  renderNeedWhere();
  setTimeout(() => renderNeedLog(states, label, N, w, regKey, withYear, root, asOf), 20);
}
// For each of the last 30 days: the top 12 as it stood that morning, then a green check on any of them
// that came here within the next 7 days (date shown). Totals against chance at the top.
function renderNeedLog(states, label, N, w, regKey, withYear, root, asOf){
  const logEl = document.getElementById('needLog'), top = document.getElementById('needCheck'); if(!logEl) return;
  const days = []; for(let i = 29; i >= 0; i--) days.push(isoAdd(asOf, -i));
  const drawsBy = {}; for(const c of states) for(const x of (SEQ[c]||[])) (drawsBy[x.d] = drawsBy[x.d] || []).push({...x, c});
  let hits = 0, exp = 0, red = 0, redExp = 0, named = 0, open = 0; const out = [];
  for(const D of days){
    if(!(drawsBy[D]||[]).length) continue;
    const list = needList(states, D, N, w, regKey, withYear, root).rows.slice(0, 12);
    const after = []; let nd = 0; for(let k = 0; k < 7; k++){ const dd = isoAdd(D, k); if(dd > asOf) break; nd++; for(const x of (drawsBy[dd]||[])) after.push(x); }
    const complete = nd === 7; if(!complete) open++;
    const cells = list.map((r,i) => { const h = after.find(x => box(x.n) === r.b); const e = 1 - Math.pow(1 - boxCover([r.b])/10000, after.length);
      named++; exp += e; if(i<6) redExp += e; if(h){ hits++; if(i<6) red++; }
      return h ? `<span class="chip hit" onclick="useSeed('${h.n}')" title="${r.b} came as ${h.n} in ${nm(h.c)} ${h.d}">&#10003; ${r.b}<span class="mk">${h.d.slice(5)}${states.length>1?' '+nm(h.c):''}</span></span>` : `<span class="chip ${i<6?'hotr':'warmo'}" style="opacity:.55" onclick="useSeed('${r.b}')">${r.b}</span>`; });
    const dayHits = list.filter(r => after.some(x => box(x.n) === r.b)).length;
    const dayExp = list.reduce((a,r) => a + 1 - Math.pow(1 - boxCover([r.b])/10000, after.length), 0);
    out.push(`<tr class="chkrow"><td style="white-space:nowrap">${fmtDate(D).replace(/, \d{4}$/,'')}${complete?'':' <span class="me">(still open)</span>'}</td><td>${cells.join('')}</td><td style="font-weight:700;white-space:nowrap">${dayHits} <span class="me">/ ${dayExp.toFixed(1)}</span></td></tr>`);
  }
  const lift = exp ? hits/exp : 0;
  top.className = 'verdict' + (lift > 1.3 && hits >= 4 ? ' good' : '');
  top.innerHTML = `<b>Last 30 days in ${label}:</b> each morning the list named 12 numbers. Within 7 days, <b>${hits}</b> of those ${named} came &mdash; chance would give about <b>${exp.toFixed(1)}</b> (${lift.toFixed(2)}&times;). The red six: <b>${red}</b> vs <b>${redExp.toFixed(1)}</b> by chance.${open?` The last ${open} day${open>1?'s are':' is'} still inside its 7-day window.`:''}`;
  logEl.innerHTML = `<div class="tscroll"><table class="tbl"><tr><th>morning of</th><th>the 12 it named (&#10003; = came within 7 days, with the date)</th><th>came / chance</th></tr>${out.reverse().join('')}</table></div>
    <div class="note">Each row is the list exactly as the board would have shown it that morning, using only draws before that day. A number that came the same day or any of the next 6 days gets the green check. Numbers carry over from day to day, so one hit can show on several rows; the totals at the top count each row on its own, and chance is counted the same way, so the comparison is fair.</div>`;
}
function renderNeedWhere(){
  const el = document.getElementById('needWhere'); if(!el) return; const T = (document.getElementById('ndNum').value||'').replace(/\D/g,''); if(T.length!==4){ el.innerHTML=''; return; }
  const N = +document.getElementById('ndDays').value || 60; const asOf = DATES[DATES.length-1]; const start = isoAdd(asOf, -N); const b = box(T);
  const rows = Object.keys(SEQ).map(c => { const dr = windowDraws([c], start, isoAdd(asOf,1)); const P = pullCounts(dr); const g=P.G[b]||0, q=P.Q[b]||0, y=P.Y[b]||0; const fell = dr.filter(x => box(x.n)===b);
    return {c, g, q, y, tot:g+q+y, n:dr.length, fell, why:P.why[b]||[], exp: 1-Math.pow(1-boxCover([b])/10000, Math.round(dr.length/N*7))}; }).filter(r => r.n>0).sort((a,b) => b.tot-a.tot || a.c.localeCompare(b.c));
  const top = rows.filter(r => r.tot>0).slice(0, 12);
  el.innerHTML = `<div class="seedbar" style="margin:6px 0"><span class="seedbig">${T}</span><span class="seedkind">${kind(T)} &middot; relatives fallen per state, last ${N} days</span></div>` + (top.length ? `<div class="tscroll"><table class="tbl"><tr><th>#</th><th>state</th><th>pull</th><th>G</th><th>Q</th><th>Y</th><th>${T} came here?</th><th>chance this week</th><th>what fired</th></tr>${top.map((r,i) => `<tr><td>${i+1}</td><td class="stname">${nm(r.c)}</td><td style="font-weight:700">${r.tot}</td><td>${r.g||''}</td><td>${r.q||''}</td><td>${r.y||''}</td><td>${r.fell.length ? '<b style="color:var(--pen)">&#10005; '+r.fell.map(x=>x.n+' '+x.d.slice(5)).join(', ')+'</b>' : '<span style="color:var(--green)">&#10003; not yet</span>'}</td><td class="me">${pct(r.exp)}</td><td class="me">${r.why.slice(0,3).join(' · ')}${r.why.length>3?' · +'+(r.why.length-3):''}</td></tr>`).join('')}</table></div><div class="note">Top of the list = the state(s) the method says it should fall in. Every state&rsquo;s chance is also shown; the scorecard says whether the top state actually beats the others.</div>` : '<div class="note">No relatives of this number have fallen anywhere in the window.</div>');
}
function renderNeedScore(){
  const el = document.getElementById('needScore'); el.textContent = 'Computing…';
  setTimeout(() => {
    const st = document.getElementById('ndState').value, N = +document.getElementById('ndDays').value || 60; const states = st==='all' ? Object.keys(SEQ) : [st];
    const B = {'0':[0,0,0],'1-2':[0,0,0],'3-4':[0,0,0],'5-7':[0,0,0],'8+':[0,0,0]}; const T10 = [0,0,0]; let days = 0;
    for(const c of states){ const s = SEQ[c]||[]; if(s.length < 100) continue; const first = s[0].d;
      for(let i = DATES.length-8; i >= 0; i -= 5){ const D = DATES[i]; if(D < isoAdd(first, N)) break;
        const win = windowDraws([c], isoAdd(D,-N), D), fut = windowDraws([c], D, isoAdd(D,7)); if(win.length < 20 || !fut.length) continue; days++;
        const P = pullCounts(win); const fb = new Set(fut.map(x => box(x.n))); const sc = [];
        for(const b of ALLBOX){ const v = (P.G[b]||0)+(P.Q[b]||0)+(P.Y[b]||0); const p = 1-Math.pow(1-boxCover([b])/10000, fut.length); const k = v===0?'0':v<=2?'1-2':v<=4?'3-4':v<=7?'5-7':'8+'; const o = B[k]; o[0]++; o[1] += fb.has(b)?1:0; o[2] += p; sc.push([v,b,p]); }
        sc.sort((a,b) => b[0]-a[0]); for(const [v,b,p] of sc.slice(0,10)){ T10[0]++; T10[1] += fb.has(b)?1:0; T10[2] += p; } } }
    if(!days){ el.textContent = 'Not enough history yet.'; return; }
    const L = o => o[2] ? (o[1]/o[2]).toFixed(2)+'&times;' : '—';
    el.innerHTML = `<div class="verdict ${T10[1]/T10[2]>1.15?'good':''}">${st==='all'?'Every state':nm(st)}, ${days} test days (every 5th day, ${N}-day pull, checked against the next 7 days in that state). <b>Top 10 by pull</b>: came <b>${pct(T10[1]/T10[0])}</b> vs <b>${pct(T10[2]/T10[0])}</b> by chance (<b>${L(T10)}</b>).
      <table class="tbl" style="margin-top:6px"><tr><th>pull (relatives fallen)</th><th>numbers</th><th>came within 7 days</th><th>chance</th><th>lift</th></tr>${Object.entries(B).map(([k,o]) => `<tr><td>${k}</td><td>${o[0].toLocaleString()}</td><td>${o[0]?pct(o[1]/o[0]):'—'}</td><td>${o[0]?pct(o[2]/o[0]):'—'}</td><td style="font-weight:700">${L(o)}</td></tr>`).join('')}</table>
      <div style="margin-top:4px">&ldquo;Came&rdquo; climbs with pull &mdash; and so does chance, by the same amount, because numbers with many relatives are singles that come more often anyway. 1.00&times; means the pull adds nothing beyond that.</div></div>`;
  }, 20);
}

/* ---------- boot ---------- */
try{ const t = localStorage.getItem('p4tab'); if(t) showTab(t); }catch(e){}
loadFeed(false);
setInterval(() => loadFeed(false), 30*60*1000);
