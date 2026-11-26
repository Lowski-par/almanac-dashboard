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
  // ONE source only: the feed.json published next to this page. The claude.ai page and the GitHub copy
  // get the very same file (Claude's publish task / copy task), so every team member sees the same draws.
  // (Until Nov 25 2026 this also merged the GitHub collector feed; an old copy there brought back draws
  // that had been removed, so the two links disagreed.)
  const r = await fetch('feed.json?t=' + Date.now(), {cache:'no-store'}); if(!r.ok) throw new Error('no feed');
  const j = await r.json(); const d = Array.isArray(j) ? j : (j.docs || []); if(!d.length) throw new Error('no feed');
  return d;
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
  document.querySelectorAll('section[id^=tab-]').forEach(s => s.hidden = !(s.id === 'tab-'+t || s.dataset.with === t));
  try{ localStorage.setItem('p4tab', t); }catch(e){}
}
function initControls(){
  const last = DATES[DATES.length-1];
  // today in Central time; Date Sums works off the calendar, not off the last draw, so it moves at midnight
  const todayCT = new Date().toLocaleDateString('en-CA', { timeZone:'America/Chicago' }); const top = todayCT > last ? todayCT : last;
  for(const id of ['drewDate','sumsDate','vibesDate']){ const el = document.getElementById(id); el.min = DATES[0]; el.max = top; if(!el.value) el.value = id === 'sumsDate' ? top : last; else if(id === 'sumsDate' && el.value === last && top > last) el.value = top; }
  const sts = Object.keys(SEQ).sort((a,b) => nm(a).localeCompare(nm(b)));
  for(const id of ['pairsState','gState','lkState','bqState','mlyState','ndState','mdState','mpState']){
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
function renderAll(){ renderDrew(); renderSums(); renderPairs(); renderVibes(); renderGrand(); renderBQE(); renderHot(); sfFillStates(); renderMLY(); renderNeed(); renderMD(); renderMissingToday(); }
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
function dsYearMode(){ const v = (document.getElementById('dsCount')||{}).value; return v === 'both' ? 'both' : v === 'year'; }
// boxed numbers that hold the date sum. withYear may be 'both': then a number counts if it matches EITHER
// the month+day sum or the month+day+year sum (Marcus, Nov 25 2026: 1468 = 19 = 11/25/2026)
function dsSet(day, withYear, root){ const out = new Set(); for(const y of (withYear === 'both' ? [false, true] : [!!withYear])){ const { sum } = dsDateSum(day, y); const ls = dsList(sum, root); for(const k in ls.byWays) ls.byWays[k].forEach(b => out.add(b)); } return out; }
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
  if(dsYearMode() === 'both'){ const a = renderSumsOne(false), b = renderSumsOne(true);
    document.getElementById('sumsBody').innerHTML = '<div class="verdict">Both count: a number gets the Date Sum point if it matches <b>either</b> group below.</div>' + a + '<hr style="margin:16px 0;border:0;border-top:2px solid var(--ink)">' + b;
    document.getElementById('sumsNote').innerHTML = 'Same setup as Almanac Convergence. &ldquo;Both&rdquo; shows the month + day group and the month + day + year group; the Hottest board, State Specific, Mirror Doubles and Missing Pairs give the S point to a number in either one. Root keeps adding until one digit is left.'; return; }
  const h = renderSumsOne(dsYearMode()); document.getElementById('sumsBody').innerHTML = h.html; document.getElementById('sumsNote').innerHTML = h.note;
}
function withBoth(){ return dsYearMode() === 'both'; }
function renderSumsOne(withYear){
  const day = document.getElementById('sumsDate').value, root = document.getElementById('dsGroup').value === 'root';
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
  const note = 'Same setup as Almanac Convergence: the date&rsquo;s month and day digits are added'+(withYear ? ' together with the year' : '')+'; root keeps adding until one digit is left. <b>Chance</b> is how many draws land in the group anyway, given how many numbers it holds and how many draws there were. A week above chance is common &mdash; watch the long line, not the week. Tap a number to make it the 100 Grand seed.';
  return withBoth() ? h : {html: h, note};
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
  const N = +((document.getElementById('hotDays')||{}).value) || 7; const withYear = dsYearMode(), root = (document.getElementById('dsGroup')||{}).value === 'root';
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

/* ---------- Mirror Doubles ----------
   Marcus's chart: for each pair of different mirror groups (0-5 1-6 2-7 3-8 4-9) there is one single,
   e.g. 0156, and four mirror doubles 0011 5566 0066 5511. 10 sets, 50 numbers, each number in one set.
   Board: which members came in the window (red X) and which are still out (green check). Like the
   Almanac Mirror Rundown, a set with two or more members in is READY and its open members are the play.
   Hottest: the open members scored by every system (G Q Y P N S, ranked within type as on State Specific)
   plus how many of their set mates came. */
const MD_SETS = (() => { const out = []; for(let a=0;a<5;a++) for(let b=a+1;b<5;b++){ const A=a+5, B=b+5;
  out.push({ main: box(''+a+b+A+B), dbl: [box(''+a+a+b+b), box(''+A+A+B+B), box(''+a+a+B+B), box(''+A+A+b+b)], name: ''+a+b+A+B }); } return out; })();
const MD_OF = (() => { const m = {}; MD_SETS.forEach((S,i) => { m[S.main] = {i, kind:'single'}; S.dbl.forEach(d => m[d] = {i, kind:'double'}); }); return m; })();
const mdShow = b => { const k = MD_OF[b]; if(!k) return b; const S = MD_SETS[k.i]; if(k.kind==='single') return S.name; // show doubles in the chart's order/spelling
  const [a,bb,A,B] = S.name.split(''); const ord = [a+a+bb+bb, A+A+B+B, a+a+B+B, A+A+bb+bb]; return ord[S.dbl.indexOf(b)]; };
function renderMD(){
  const el = document.getElementById('mdBody'); if(!el || !DATES.length) return;
  const st = document.getElementById('mdState').value, scope = document.getElementById('mdScope').value, N = +document.getElementById('mdDays').value || 14;
  const regKey = Object.keys(REGION4).find(k => REGION4[k].states.includes(st));
  const states = st === 'all' || scope === 'all' ? Object.keys(SEQ) : scope === 'region' && regKey ? REGION4[regKey].states.filter(c => SEQ[c]) : [st];
  const where = st === 'all' || scope === 'all' ? 'all states' : scope === 'region' && regKey ? REGION4[regKey].name : nm(st);
  const asOf = DATES[DATES.length-1], start = isoAdd(asOf, -(N-1)), tomorrow = isoAdd(asOf, 1);
  // every draw in scope, date order; hits = draws whose box is in a set
  const all = []; for(const c of states) for(const x of (SEQ[c]||[])) all.push({...x, c});
  all.sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.s==='m'?0:1) - (b.s==='m'?0:1));
  const win = all.filter(x => x.d >= start), hits = win.filter(x => MD_OF[box(x.n)]);
  const lastSeen = {}; for(const x of all){ const b = box(x.n); if(MD_OF[b]) lastSeen[b] = x; }
  const cameIn = {}; hits.forEach(x => (cameIn[box(x.n)] = cameIn[box(x.n)] || []).push(x));
  const setCover = (24 + 4*6) / 10000, expSet = win.length * setCover;
  // all-systems score for the 50 numbers (state picked, or all states)
  const withYear = dsYearMode(), root = (document.getElementById('dsGroup')||{}).value === 'root';
  const sysStates = st === 'all' ? Object.keys(SEQ) : [st];
  const L = needList(sysStates, tomorrow, 60, st==='all' ? 0 : 0.5, regKey, withYear, root, dsPlayDay()); const SC = {}; L.all.forEach(r => SC[r.b] = r);
  const letters = r => r ? ['G','Q','Y','P','N','V','S'].filter((t,k) => [r.g,r.q,r.y,r.p,r.n,r.v,r.s][k]>0).map(t => `<i class="h${t}" style="font-style:normal;font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;border-radius:3px;padding:0 4px;color:#fff;margin-right:2px">${t}</i>`).join('') : '';
  const drawsWeek = Math.round(win.length / N * 7);
  // board
  const sets = MD_SETS.map((S,i) => { const mem = [S.main, ...S.dbl]; const came = mem.filter(b => cameIn[b]); return {S, i, mem, came, ready: came.length >= 2, n: hits.filter(x => MD_OF[box(x.n)].i === i).length}; });
  const chipFor = b => { const c = cameIn[b]; const lab = mdShow(b);
    return c ? `<span class="chip gone" title="${c.map(x => x.n+' '+nm(x.c)+' '+x.d.slice(5)+(x.s?x.s.toUpperCase():'')).join(' · ')}" onclick="useSeed('${lab}')">${lab}<span class="mk">&#10005;${c.length>1?c.length:''}</span></span>`
             : `<span class="chip watch" onclick="useSeed('${lab}')">${lab}<span class="mk">&#10003;</span></span>`; };
  let board = `<div class="tscroll"><table class="tbl"><tr><th>set</th><th>single</th><th>mirror doubles</th><th>came</th><th>hits</th><th></th></tr>`;
  sets.forEach(x => { board += `<tr><td style="font-family:'Roboto Mono',monospace;font-weight:700">${x.S.name}</td><td>${chipFor(x.S.main)}</td><td>${x.S.dbl.map(chipFor).join('')}</td><td>${x.came.length} / 5</td><td style="font-weight:700">${x.n} <span class="me">/ ${expSet.toFixed(1)}</span></td><td>${x.ready ? '<b style="color:var(--pen)">READY</b>' : ''}</td></tr>`; });
  board += `</table></div>`;
  const totHits = hits.length, totExp = expSet * 10;
  // hottest: open members, all systems + set mates that came
  const open = []; sets.forEach(x => x.mem.forEach(b => { if(cameIn[b]) return; const r = SC[b]; const sys = r ? r.str : 0; const mates = Math.min(3, x.came.length);
    open.push({b, set:x.S.name, kind: MD_OF[b].kind, r, sys, mates, ready: x.ready, score: sys + mates, last: lastSeen[b]}); }));
  open.sort((a,b) => b.score - a.score || b.sys - a.sys || (a.b < b.b ? -1 : 1));
  const hot = open.slice(0, 12);
  const hotRow = (h,i) => `<tr><td class="me">${i+1}</td><td>${chip(mdShow(h.b), i<3?'hotr':i<6?'warmo':'')}</td><td class="me">${h.set} &middot; ${h.kind}</td><td style="font-weight:700">${h.score.toFixed(1)}</td><td>${letters(h.r)}${h.mates ? `<i style="font-style:normal;font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;border-radius:3px;padding:0 4px;color:#fff;background:#6B3FA0">M${h.mates}</i>` : ''}</td><td class="me">${h.last ? daysBetween(h.last.d, asOf)+'d &middot; '+nm(h.last.c) : 'not in the record'}</td><td class="me">${pct(1 - Math.pow(1 - boxCover([h.b])/10000, drawsWeek))}</td></tr>`;
  // hits in date order
  const hitRows = hits.map(x => `<tr><td>${fmtDate(x.d).replace(/, \d{4}$/,'')}</td><td class="me">${x.s==='m'?'mid':x.s==='e'?'eve':''}</td><td class="stname">${nm(x.c)}</td><td>${chip(x.n,'gone')}</td><td class="me">${MD_SETS[MD_OF[box(x.n)].i].name} &middot; ${MD_OF[box(x.n)].kind}</td></tr>`).join('');
  el.innerHTML = `<div class="verdict"><b>Last ${N} days in ${where}:</b> the 10 sets hit <b>${totHits}</b> times in ${win.length.toLocaleString()} draws &mdash; chance would give about <b>${totExp.toFixed(1)}</b>. ${sets.filter(x => x.ready).length} of 10 sets are READY (two or more members in).</div>
    <div class="famh">The 10 sets &mdash; &#10005; came in the window (hover for where), &#10003; still out</div>${board}
    <div class="famh" style="margin-top:12px">Hottest open members &mdash; every system plus the set (red = top 3, orange = next 3)</div>
    <div class="tscroll"><table class="tbl"><tr><th>#</th><th>number</th><th>set</th><th>score</th><th>systems</th><th>last seen</th><th>chance this week</th></tr>${hot.map(hotRow).join('')}</table></div>
    <div class="note"><b>Score</b> = the State Specific score for ${st==='all'?'all states':nm(st)} (one point per system: <b>G</b> 100 Grand / Relatives, <b>Q</b> Big Quad Energy, <b>Y</b> My Lil Yeah, <b>P</b> longest-out pairs/triads, <b>N</b> neighbor fell in 2 days, <b>S</b> today&rsquo;s Date Sum &mdash; each ranked within its type) plus <b>M</b>, how many of its set mates came in the window (up to 3). Tap a number to open it on 100 Grand.</div>
    <div class="famh" style="margin-top:12px">Every hit in the window &mdash; in date order</div>
    ${hits.length ? `<div class="tscroll"><table class="tbl"><tr><th>date</th><th></th><th>state</th><th>came</th><th>set</th></tr>${hitRows}</table></div>` : '<div class="note">None yet.</div>'}
    <details style="margin-top:12px"><summary style="cursor:pointer;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:11px;color:var(--ink-soft)">Does the set follow? &mdash; whole year check</summary><div id="mdTest" class="note"><button class="ghost" onclick="mdYearTest()">Compute (a few seconds)</button></div></details>
    <div class="note">Each set is 5 numbers: a single (24 ways) and four double-doubles (6 ways each) &mdash; together 48 of the 10,000 straights, so a set is expected about once every 208 draws anywhere. Hits are boxed (any order).</div>`;
}
// whole history, all states: when a set member falls, does another member of the same set come within 7 days?
// And the READY rule: two members inside 7 days, does another come in the next 7?
function mdYearTest(){
  const out = document.getElementById('mdTest'); if(!out) return;
  const byDate = {}; for(const c of Object.keys(SEQ)) for(const x of SEQ[c]) (byDate[x.d] = byDate[x.d] || []).push(box(x.n));
  const last = DATES[DATES.length-1]; const W = b => boxCover([b]);
  const next7 = d => { const a = []; for(let k=1;k<=7;k++){ const dd = isoAdd(d,k); if(dd > last) return null; (byDate[dd]||[]).forEach(b => a.push(b)); } return a; };
  let n=0,h=0,e=0, rn=0,rh=0,re=0; const recent = {};
  for(const d of DATES){ const nx = next7(d); for(const b of (byDate[d]||[])){ const k = MD_OF[b]; if(!k) continue; const S = MD_SETS[k.i]; const mem = [S.main, ...S.dbl];
      const rec = (recent[k.i] = (recent[k.i] || []).filter(x => x.d >= isoAdd(d,-7))); const cameSet = new Set([b, ...rec.filter(x => x.b !== b).map(x => x.b)]);
      if(nx){ const others = mem.filter(o => o !== b); n++; if(others.some(o => nx.includes(o))) h++; e += 1 - Math.pow(1 - others.reduce((a,o) => a+W(o),0)/10000, nx.length);
        if(cameSet.size >= 2){ const rest = mem.filter(o => !cameSet.has(o)); rn++; if(rest.some(o => nx.includes(o))) rh++; re += 1 - Math.pow(1 - rest.reduce((a,o) => a+W(o),0)/10000, nx.length); } }
      rec.push({d, b}); } }
  out.innerHTML = `Since ${fmtDate(DATES[0])}, every state: a set member fell <b>${n.toLocaleString()}</b> times. Another member of the same set came within 7 days <b>${h.toLocaleString()}</b> times (${(100*h/n).toFixed(0)}%) &mdash; chance <b>${Math.round(e).toLocaleString()}</b> (${(100*e/n).toFixed(0)}%), ${(h/e).toFixed(2)}&times;.<br>READY (two members inside 7 days): ${rn.toLocaleString()} times, another came in the next 7 days <b>${rh.toLocaleString()}</b> (${(100*rh/Math.max(rn,1)).toFixed(0)}%) vs chance <b>${Math.round(re).toLocaleString()}</b> (${(100*re/Math.max(rn,1)).toFixed(0)}%), ${(rh/Math.max(re,1)).toFixed(2)}&times;.`;
}

/* ---------- Lookup a number: where is it due? (mimics the Almanac's Lookup) ----------
   Every relative of the number from every rundown we have, in both directions:
   G 100 Grand (its own list, and every number whose list holds it), Q Big Quad Energy (both ways),
   Y My Lil Yeah (main <-> relative), M Mirror Doubles set mates, N neighbors (one digit +1/-1/mirror),
   V Vibrations (whole number mirrored, +1, -1). Then, state by state, how many of those relatives fell
   in the last W days. Like the Almanac: the more relatives landed in a state, the hotter that state. */
let RELREV = null;
function qRelOf(b){ const out = new Set(); for(const q of (QSET[b]||[])) for(const r of BQE[q]){ const rb = box(r); if(rb !== b) out.add(rb); } if(new Set(b).size===1) for(const r of (BQE[b]||[])) out.add(box(r)); return out; }
function relRev(){ if(RELREV) return RELREV; const G = {}, Q = {};
  for(const x of ALLBOX){ for(const t of glistBox(x)) (G[t] = G[t] || new Set()).add(x); for(const t of qRelOf(x)) (Q[t] = Q[t] || new Set()).add(x); }
  return (RELREV = {G, Q}); }
function relativesOf(n){ const b = box(n), R = relRev(), tags = {};
  const add = (list, t) => { for(const x of (list||[])){ const k = box(x); if(k === b) continue; (tags[k] = tags[k] || new Set()).add(t); } };
  add(glistBox(b), 'G'); add(R.G[b], 'G'); add(qRelOf(b), 'Q'); add(R.Q[b], 'Q');
  add(FAMILY_TREE[b], 'Y'); add(FT_PARENTS[b], 'Y');
  const md = (typeof MD_OF !== 'undefined') && MD_OF[b]; if(md){ const S = MD_SETS[md.i]; add([S.main, ...S.dbl], 'M'); }
  add(neighborsOf(b).map(x => x.b), 'N'); add(Object.values(vibes(b)), 'V');
  return tags; }
// rows per state for number n, window [asOf-W, asOf)
function lookupStates(n, asOf, W, states){
  const b = box(n), tags = relativesOf(n), keys = Object.keys(tags);
  const relCover = keys.reduce((a,k) => a + boxCover([k]), 0) / 10000;
  const start = isoAdd(asOf, -W); const rows = [];
  for(const S of states){ const seq = (SEQ[S]||[]).filter(x => x.d >= start && x.d < asOf); if(!seq.length) continue;
    const hits = {}; let self = null, falls = 0;
    for(const x of seq){ const k = box(x.n); if(k === b){ self = x; continue; } if(tags[k]){ falls++; const h = hits[k]; if(!h || x.d > h.d) hits[k] = {n:x.n, d:x.d, s:x.s, tags:[...tags[k]], times:(h?h.times:0)+1}; else h.times++; } }
    const ks = Object.keys(hits); const sys = new Set(); ks.forEach(k => hits[k].tags.forEach(t => sys.add(t)));
    rows.push({S, n: ks.length, falls, sys, hits, exp: seq.length * relCover, draws: seq.length, self}); }
  rows.sort((a,c) => c.falls - a.falls || c.sys.size - a.sys.size || (nm(a.S) < nm(c.S) ? -1 : 1));
  return {rows, rel: keys.length, tags};
}

/* ---------- Missing pairs — called for today ----------
   Marcus's rule: a triad (123x, 122x — those three digits in any order, any 4th digit) or a pair
   (12xx, 22xx) that did not hit yesterday is called for today. Longest-missing first. For each one,
   the numbers that complete it are scored by every system (G Q Y P N V M S, the Hottest engine) and
   the best ones shown. Scorecard: how the list called each morning did that day, against chance. */
const MP_PATS = { 3: [], 2: [] }; (() => { const d = '0123456789'; for(let a=0;a<10;a++) for(let b=a;b<10;b++){ MP_PATS[2].push(d[a]+d[b]); for(let c=b;c<10;c++) MP_PATS[3].push(d[a]+d[b]+d[c]); } })();
const MP_FILL = {}; // pattern -> boxes containing it
function mpFill(p){ if(MP_FILL[p]) return MP_FILL[p]; return (MP_FILL[p] = ALLBOX.filter(b => cof(p.length, b).has(p))); }
const MP_COV = {}; function mpCov(p){ if(MP_COV[p] === undefined) MP_COV[p] = mpFill(p).reduce((a,b) => a + boxCover([b]), 0) / 10000; return MP_COV[p]; }
function renderMissingToday(){
  const el = document.getElementById('mpBody'); if(!el || !DATES.length) return;
  const st = document.getElementById('mpState').value || 'all', k = +document.getElementById('mpK').value || 3;
  const states = st === 'all' ? Object.keys(SEQ) : [st], label = st === 'all' ? 'all states' : nm(st);
  const today = todayCT(), asOf = DATES[DATES.length-1];
  const by = {}; for(const S of states) for(const x of (SEQ[S]||[])) (by[x.d] = by[x.d] || []).push({...x, S});
  const hitOn = (p, d) => (by[d]||[]).find(x => cof(k, x.n).has(p));
  // days missed in a row, ending the day before `day` (days with no draws in scope are skipped)
  const streak = (p, day) => { let s = 0, d = isoAdd(day, -1), guard = 0; while(guard++ < 120){ if(!(by[d]||[]).length){ d = isoAdd(d, -1); continue; } if(hitOn(p, d)) break; s++; d = isoAdd(d, -1); } return s; };
  const pats = MP_PATS[k];
  const miss = pats.map(p => ({p, s: streak(p, today)})).filter(x => x.s >= 1).sort((a,b) => b.s - a.s || (a.p < b.p ? -1 : 1));
  // every system, scored for the scope (state picked or all states), Date Sum = the Date Sums tab's day
  const withYear = dsYearMode(), root = (document.getElementById('dsGroup')||{}).value === 'root';
  const regKey = Object.keys(REGION4).find(kk => REGION4[kk].states.includes(st));
  const L = needList(states, today, 14, st === 'all' ? 0 : 0.5, regKey, withYear, root, dsPlayDay()); const SC = {}; L.all.forEach(r => SC[r.b] = r);
  const lastSeen = {}; for(const S of states) for(const x of (SEQ[S]||[])) lastSeen[box(x.n)] = x;
  const letters = r => r ? ['G','Q','Y','P','N','V','M','S'].filter((t,i) => [r.g,r.q,r.y,r.p,r.n,r.v,r.m,r.s][i]>0).map(t => `<i class="h${t}" style="font-style:normal;font-family:'Roboto Mono',monospace;font-size:9px;font-weight:700;border-radius:3px;padding:0 3px;color:#fff;margin-right:1px">${t}</i>`).join('') : '';
  const best = p => mpFill(p).map(b => ({b, r: SC[b], sc: SC[b] ? SC[b].str : 0})).sort((a,c) => c.sc - a.sc || (a.b < c.b ? -1 : 1));
  const todayDraws = (by[today]||[]).length;
  const fmtP = p => p + 'x'.repeat(4 - p.length);
  const rows = miss.slice(0, 20).map((m,i) => { const B = best(m.p).slice(0, 3); const came = hitOn(m.p, today);
    return `<tr><td class="me">${i+1}</td><td style="font-family:'Roboto Mono',monospace;font-weight:700;font-size:15px">${fmtP(m.p)}</td><td style="font-weight:700">${m.s} day${m.s>1?'s':''}</td>
      <td class="me">${pct(1 - Math.pow(1 - mpCov(m.p), Math.max(todayDraws, Math.round((by[isoAdd(today,-1)]||[]).length))))}</td>
      <td>${B.map((x,j) => `<span class="chip ${j===0?'hotr':'warmo'}" onclick="useSeed('${x.b}')" title="score ${x.sc.toFixed(1)}/8${lastSeen[x.b]?' · last '+lastSeen[x.b].n+' '+nm(lastSeen[x.b].S||lastSeen[x.b].st||'')+' '+lastSeen[x.b].d:''}">${x.b}<span class="mk">${x.sc.toFixed(1)}</span></span>${letters(x.r)}`).join(' ')}</td>
      <td>${came ? `<b style="color:var(--pen)">&#10005; ${came.n} ${nm(came.S)}${came.s?' '+came.s.toUpperCase():''}</b>` : ''}</td></tr>`; }).join('');
  // best numbers across the whole missing list
  const pool = {}; miss.forEach(m => best(m.p).slice(0, 3).forEach(x => { if(!pool[x.b] || pool[x.b].sc < x.sc) pool[x.b] = {...x, p: m.p, s: m.s}; }));
  const top = Object.values(pool).sort((a,c) => c.sc - a.sc || c.s - a.s).slice(0, 12);
  // scorecard: each of the last 14 mornings, the missing list vs what came that day
  let H = 0, E = 0, N = 0; const card = [];
  for(let j = 14; j >= 1; j--){ const D = isoAdd(today, -j); const nd = (by[D]||[]).length; if(!nd) continue;
    let h = 0, e = 0, n = 0; for(const p of pats){ if(streak(p, D) < 1) continue; n++; if(hitOn(p, D)) h++; e += 1 - Math.pow(1 - mpCov(p), nd); }
    H += h; E += e; N += n; card.push(`${fmtDate(D).replace(/^\w+, /,'').replace(/, \d{4}$/,'')}: ${h}/${n}`); }
  el.innerHTML = `<div class="verdict"><b>Called for today (${fmtDate(today)}), ${label}:</b> ${miss.length} of ${pats.length} ${k===3?'triads':'pairs'} didn&rsquo;t hit yesterday. ${todayDraws ? `Today so far: ${miss.filter(m => hitOn(m.p, today)).length} of them came (${todayDraws} draws in).` : 'No draws in yet today.'}</div>
    ${miss.length ? `<div class="famh">Best numbers for the missing ${k===3?'triads':'pairs'} &mdash; every system plus today&rsquo;s Date Sum (red = top 3)</div>
    <div class="heatgrid">${top.map((x,i) => `<div class="heat ${i<3?'hot':i<6?'warm':''}" onclick="useSeed('${x.b}')"><div class="hn">${x.b}</div><div class="ht">${hotLetters(x.r||{})}</div><div class="hs">for ${fmtP(x.p)} &middot; out ${x.s}d &middot; ${x.sc.toFixed(1)}/8</div></div>`).join('')}</div>
    <div class="famh" style="margin-top:12px">The missing list &mdash; longest out first (top 20 of ${miss.length})</div>
    <div class="tscroll"><table class="tbl"><tr><th>#</th><th>${k===3?'triad':'pair'}</th><th>missing</th><th>chance today</th><th>best 3 numbers to play (score / 8)</th><th>today</th></tr>${rows}</table></div>` : `<div class="note">Every ${k===3?'triad':'pair'} hit yesterday${st==='all'?' &mdash; across all states that is normal for pairs; pick one state to get a list':''}.</div>`}
    <div class="note" style="margin-top:8px"><b>Scorecard, last 14 days:</b> each morning&rsquo;s missing list, checked against what came that day: <b>${H}</b> of ${N} came &mdash; chance would give about <b>${E.toFixed(0)}</b> (${E ? (H/E).toFixed(2) : '0'}&times;). <span class="me">${card.join(' &middot; ')}</span></div>
    <div class="note">Numbers are boxed (any order). &ldquo;Best numbers&rdquo; = the numbers that hold the ${k===3?'triad':'pair'}, scored by the same 8 systems as the Hottest board (<b>G</b> 100 Grand/Relatives, <b>Q</b> Big Quad, <b>Y</b> My Lil Yeah, <b>P</b> longest-out pairs, <b>N</b> neighbors, <b>V</b> Vibrations, <b>M</b> Mirror Doubles, <b>S</b> Date Sum &mdash; the Date Sums tab&rsquo;s day and settings). Tap any number to open it on 100 Grand.</div>`;
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
// Marcus's rule: 9+ relatives fell = Super Hot (blue), 5-8 = Hot (red), 1-4 = Warm (yellow)
const LKTIER = (n) => n >= 9 ? 'blue' : n >= 5 ? 'red' : n >= 1 ? 'yel' : '';
const LKSTYLE = {blue:{bg:'rgba(37,99,235,.18)',fg:'#1D4ED8',lab:'SUPER HOT'}, red:{bg:'rgba(192,57,43,.16)',fg:'#B42318',lab:'HOT'}, yel:{bg:'rgba(250,204,21,.30)',fg:'#7A5A00',lab:'WARM'}};
function renderWhereDue(T){
  const el = document.getElementById('lkWhere'); if(!el) return;
  const scope = document.getElementById('lkScope').value, st = document.getElementById('lkState').value;
  const states = scope === 'state' ? Object.keys(SEQ) : scopeStates(scope, st); const label = scope === 'state' ? 'all states' : scopeName(scope, st);
  const asOf = DATES[DATES.length-1], tomorrow = isoAdd(asOf, 1), W = +document.getElementById('lkWDays').value || 7;
  const L = lookupStates(T, tomorrow, W, states); const b = box(T);
  const cnt = {}; Object.values(L.tags).forEach(s => s.forEach(t => cnt[t] = (cnt[t]||0)+1));
  const nB = L.rows.filter(r => LKTIER(r.falls, r.exp)==='blue').length, nR = L.rows.filter(r => LKTIER(r.falls, r.exp)==='red').length, nY = L.rows.filter(r => LKTIER(r.falls, r.exp)==='yel').length;
  const lastHere = S => { const s = SEQ[S]||[]; for(let i = s.length-1; i >= 0; i--) if(box(s[i].n) === b) return s[i]; return null; };
  const rowsH = L.rows.filter(r => r.falls >= 1).map(r => { const t = LKSTYLE[LKTIER(r.falls, r.exp)]; const ks = Object.keys(r.hits).sort((a,c) => r.hits[a].d < r.hits[c].d ? 1 : -1); const lh = lastHere(r.S);
    return `<tr${t?` style="background:${t.bg}"`:''}><td style="white-space:nowrap">${t ? `<b style="color:${t.fg}">${nm(r.S)}</b>${t.lab?` <span style="font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.08em;color:#fff;background:${t.fg};padding:1px 4px;border-radius:2px">${t.lab}</span>`:''}` : nm(r.S)}
      <div style="font-size:10px;color:var(--ink-soft)">${r.falls} relative${r.falls>1?'s':''} fell${r.falls>r.n?' ('+r.n+' different)':''} &middot; usual ${r.exp.toFixed(1)} &middot; ${r.draws} draws</div></td>
      <td>${[...r.sys].sort().map(x => `<i class="h${x}" style="font-style:normal;font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;border-radius:3px;padding:0 4px;color:#fff;margin-right:2px">${x}</i>`).join('')}</td>
      <td>${ks.map(k => { const h = r.hits[k]; return `<span class="chip" title="${h.tags.join(', ')}">${h.n}<span class="mk">${h.d.slice(5)}${h.s?h.s.toUpperCase():''} ${h.tags.join('/')}${h.times>1?' &times;'+h.times:''}</span></span>`; }).join('')}</td>
      <td class="me">${r.self ? `<b style="color:var(--pen)">&#10005; came ${r.self.d.slice(5)}</b>` : lh ? 'last '+daysBetween(lh.d, asOf)+'d ago' : 'not this year'}</td></tr>`; }).join('');
  el.innerHTML = `<div class="famh">Where ${T} is due &mdash; its relatives that fell in the last ${W} days, state by state (${label})</div>
    <div class="note" style="margin:0 0 6px">${L.rel} relatives from every rundown: <b>G</b> 100 Grand ${cnt.G||0} &middot; <b>Q</b> Big Quad ${cnt.Q||0} &middot; <b>Y</b> My Lil Yeah ${cnt.Y||0} &middot; <b>M</b> Mirror Doubles ${cnt.M||0} &middot; <b>N</b> neighbors ${cnt.N||0} &middot; <b>V</b> Vibrations ${cnt.V||0} &nbsp;&middot;&nbsp; <b>${nB}</b> super hot &middot; <b>${nR}</b> hot &middot; <b>${nY}</b> warm</div>
    ${rowsH ? `<div class="tscroll"><table class="tbl"><tr><th>state</th><th>systems</th><th>relatives that fell (newest first)</th><th>${T} here</th></tr>${rowsH}</table></div>` : '<div class="note">No state has 2+ of its relatives in the last 7 days.</div>'}
    <div class="note"><b style="color:#1D4ED8">Super Hot</b> = 9 or more of its relatives fell there &middot; <b style="color:#B42318">Hot</b> = 5&ndash;8 &middot; <b style="color:#7A5A00">Warm</b> = 1&ndash;4. Most relatives first. &ldquo;Usual&rdquo; = how many that state would get by luck in that many draws, for comparison. Change &ldquo;look back&rdquo; for 7, 14, 30 or 60 days.</div>
    <div id="lkWhereTest" class="note"><button class="ghost" onclick="whereDueTest('${T}')">Did it work for ${T}? &mdash; check the last 30 days</button></div>`;
}
// Replay the last 30 mornings for this number: how each state read, and whether the number came there within 7 days.
function whereDueTest(T){
  const out = document.getElementById('lkWhereTest'); if(!out) return; const b = box(T);
  const scope = document.getElementById('lkScope').value, st = document.getElementById('lkState').value;
  const states = scope === 'state' ? Object.keys(SEQ) : scopeStates(scope, st);
  const asOf = DATES[DATES.length-1]; const by = {}; for(const S of states) for(const x of (SEQ[S]||[])) (by[x.d+'|'+S] = by[x.d+'|'+S] || []).push(x);
  const T0 = {blue:[0,0,0], red:[0,0,0], yel:[0,0,0], '':[0,0,0]}; const cw = boxCover([b])/10000;
  const W = +document.getElementById('lkWDays').value || 7;
  for(let k = 30; k >= 1; k--){ const D = isoAdd(asOf, -k+1); const L = lookupStates(T, D, W, states);
    for(const r of L.rows){ let nd = 0, hit = false; for(let j = 0; j < 7; j++){ const dd = isoAdd(D, j); if(dd > asOf) break; for(const x of (by[dd+'|'+r.S]||[])){ nd++; if(box(x.n) === b) hit = true; } }
      const a = T0[LKTIER(r.falls, r.exp)]; a[0] += hit; a[1] += 1 - Math.pow(1 - cw, nd); a[2]++; } }
  const came = []; for(const S of states) for(const x of (SEQ[S]||[])) if(box(x.n) === b && x.d >= isoAdd(asOf, -29)) came.push({...x, S});
  came.sort((a,c) => a.d < c.d ? -1 : 1);
  const line = (k, lab) => `<b>${lab}</b>: a state read ${lab.toLowerCase()} ${T0[k][2]} times &mdash; ${T} came in that state within 7 days <b>${T0[k][0]}</b> of those times (chance ${T0[k][1].toFixed(1)})`;
  out.innerHTML = `Last 30 mornings, as if you typed ${T} each morning:<br>${line('blue','Super Hot')}<br>${line('red','Hot')}<br>${line('yel','Warm')}<br>${line('','Not lit').replace('read not lit','was not lit')}<br>
    ${T} actually came: ${came.length ? came.map(x => `${x.n} ${nm(x.S)} ${x.d.slice(5)}`).join(' &middot; ') : 'not in the last 30 days'}. <span class="me">Mornings overlap, so one hit can count on several mornings &mdash; chance is counted the same way.</span>`;
}
function renderLookup(){
  const el = document.getElementById('lookupBody'); const inp = document.getElementById('lkNum');
  inp.value = (inp.value.match(/\d/g)||[]).join('').slice(0,4);
  const T = inp.value; if(!/^\d{4}$/.test(T)){ el.innerHTML = 'Type a 4-digit number.'; document.getElementById('lkWhere').innerHTML = ''; return; }
  renderWhereDue(T);
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
  for(const b of dsSet(asOf, withYear, root)){ if(came.has(b)) continue; add(b, 'S', 'Date Sum'); }
  return [...H.values()].sort((a,b) => b.types.size - a.types.size || b.src - a.src || (a.b<b.b?-1:1));
}
// HOTTEST: every system at once (the same engine as State Specific, run on the region you pick).
// G 100 Grand + Relatives, Q Big Quad, Y My Lil Yeah, P Missing Pairs/triads, N neighbors, V Vibrations,
// M Mirror Doubles, S Date Sum. Each is ranked against numbers of the same type, then the total is ranked
// within type again, so singles, doubles, double-doubles, triples and quads all compete. For each pick the
// Straight Finder gives the arrangement that has been out longest.
const HOTLET = ['G','Q','Y','P','N','V','M','S'];
const hotLetters = r => HOTLET.filter((t,k) => [r.g,r.q,r.y,r.p,r.n,r.v,r.m,r.s][k]>0).map(t => `<i class="h${t}">${t}</i>`).join('');
function hotPicks(states, asOfMorning, N, MIN, withYear, root, dsDay){
  return needList(states, asOfMorning, N, 0, null, withYear, root, dsDay).rows.filter(r => r.sys >= MIN);
}
function renderHot(){
  const scope = document.getElementById('hotScope').value, N = +document.getElementById('hotDays').value || 7, TOP = +document.getElementById('hotN').value || 12, MIN = +document.getElementById('hotMin').value || 2;
  const withYear = dsYearMode(), root = (document.getElementById('dsGroup')||{}).value === 'root';
  const states = scopeStates(scope, 'all'), label = scopeName(scope, 'all'); const asOf = DATES[DATES.length-1];
  const top = hotPicks(states, isoAdd(asOf, 1), N, MIN, withYear, root, dsPlayDay()).slice(0, TOP);
  // straight finder: last time each arrangement came in this region (both draws)
  const lastStr = {}; for(const c of states) for(const x of (SEQ[c]||[])) if(!lastStr[x.n] || x.d > lastStr[x.n]) lastStr[x.n] = x.d;
  const longest = b => sfPerms(b).map(p => ({p, d:lastStr[p] || ''})).sort((a,c) => a.d < c.d ? -1 : a.d > c.d ? 1 : (a.p<c.p?-1:1))[0];
  const KN = {24:'single',12:'double',6:'2 doubles',4:'triple',1:'quad'};
  document.getElementById('hotCount').textContent = `${label} · ${N}-day window · draws through ${fmtDate(asOf)} · ${dsLabel()}`;
  document.getElementById('hotBoard').innerHTML = top.length ? '<div class="heatgrid">' + top.map((r,i) => { const L = longest(r.b);
      return `<div class="heat ${i<6?'hot':i<12?'warm':''}" onclick="useSeed('${L.p}')"><div class="hn">${L.p}</div><div class="ht">${hotLetters(r)}</div><div class="hs">${KN[r.k]} &middot; ${r.str.toFixed(1)}/8 &middot; straight out ${L.d ? daysBetween(L.d, asOf)+'d' : 'all year'}</div></div>`; }).join('') + '</div>'
    : '<div class="soon">Nothing meets that bar right now &mdash; loosen "need at least".</div>';
  document.getElementById('hotScore').innerHTML = '<div class="note">Checking the last 30 days&hellip;</div>';
  setTimeout(() => renderHotScore(states, label, N, MIN, withYear, root, asOf), 30);
}
// Scorecard: the red six as it stood each morning of the last 30 days; a green check if it came (boxed)
// anywhere in the region that day or the next 6. Totals against chance.
// "What hit": every draw in the last 7 days whose box was on that morning's top 12 (or one of the 2 mornings
// before), newest first, crossed out. One row per draw; 'boards' = how many of those mornings had it listed.
function whatHit(hits, label){
  const list = Object.values(hits).sort((a,b) => a.x.d > b.x.d ? -1 : a.x.d < b.x.d ? 1 : (b.x.s==='e'?1:0) - (a.x.s==='e'?1:0) || (nm(a.x.c) < nm(b.x.c) ? -1 : 1));
  const head = `<div class="famh" style="margin-top:10px">What hit &mdash; the top 12 from each of the last 7 mornings, came that day or within 7 days (${label})</div>`;
  if(!list.length) return head + '<div class="note">Nothing from the board has come in the last 7 days yet.</div>';
  return head + `<div class="tscroll"><table class="tbl"><tr><th>came</th><th></th><th>state</th><th>number</th><th>on the board</th></tr>${list.map(h => `<tr><td>${fmtDate(h.x.d).replace(/, \d{4}$/,'')}</td><td class="me">${h.x.s==='m'?'mid':h.x.s==='e'?'eve':''}</td><td class="stname">${nm(h.x.c)}</td><td><span class="chip gone" onclick="useSeed('${h.x.n}')">${h.x.n}<span class="mk">&#10005;</span></span></td><td class="me">${h.morning === h.x.d ? 'that morning' : fmtDate(h.morning).replace(/, \d{4}$/,'') + ' (' + daysBetween(h.morning, h.x.d) + 'd before)'} &middot; <b style="color:${h.rank<=6?'var(--pen)':'#D9822B'}">#${h.rank}</b>${h.boards > 1 ? ' &middot; on '+h.boards+' boards' : ''}</td></tr>`).join('')}</table></div>`;
}
function renderHotScore(states, label, N, MIN, withYear, root, asOf){
  const el = document.getElementById('hotScore'); if(!el) return;
  const drawsBy = {}; for(const c of states) for(const x of (SEQ[c]||[])) (drawsBy[x.d] = drawsBy[x.d] || []).push({...x, c});
  let hit = 0, exp = 0, named = 0; const rows = []; const hits = {}; const myRun = (renderHotScore.run = (renderHotScore.run||0) + 1);
  const days = []; for(let i = 29; i >= 0; i--){ const D = isoAdd(asOf, -i); if((drawsBy[D]||[]).length) days.push(D); }
  // one day per tick so the page never freezes on a phone
  const step = () => { if(myRun !== renderHotScore.run) return; const D = days.shift(); if(!D){ finish(); return; }
    const twelve = hotPicks(states, D, N, MIN, withYear, root).slice(0, 12), six = twelve.slice(0, 6);
    // What hit: the whole top 12 of the last 7 mornings, came that day or the next 6 (same window as the scorecard)
    if(D >= isoAdd(asOf, -6)){ for(let k = 0; k < 7; k++){ const dd = isoAdd(D, k); if(dd > asOf) break;
      for(const x of (drawsBy[dd]||[])){ const i = twelve.findIndex(r => r.b === box(x.n)); if(i < 0) continue; const key = x.d + x.c + x.n + (x.s||'');
        if(!hits[key]) hits[key] = {x, morning: D, rank: i+1, boards: 0}; hits[key].boards++; } } }
    const after = []; let nd = 0; for(let k = 0; k < 7; k++){ const dd = isoAdd(D, k); if(dd > asOf) break; nd++; (drawsBy[dd]||[]).forEach(x => after.push(x)); }
    const cells = six.map(r => { const h = after.find(x => box(x.n) === r.b); named++; exp += 1 - Math.pow(1 - boxCover([r.b])/10000, after.length); if(h) hit++;
      return h ? `<span class="chip hit" title="came as ${h.n} in ${nm(h.c)} ${h.d}">&#10003; ${r.b}<span class="mk">${h.d.slice(5)} ${nm(h.c)}</span></span>` : `<span class="chip hotr" style="opacity:.55">${r.b}</span>`; });
    rows.push(`<tr class="chkrow"><td style="white-space:nowrap">${fmtDate(D).replace(/, \d{4}$/,'')}${nd<7?' <span class="me">(open)</span>':''}</td><td>${cells.join('')}</td></tr>`);
    el.innerHTML = `<div class="note">Checking the last 30 days&hellip; ${30 - days.length} of 30</div>`; setTimeout(step, 0); };
  const finish = () => el.innerHTML = `<div class="verdict ${hit > exp*1.3 && hit >= 4 ? 'good' : ''}">Scorecard &mdash; the red six as it stood each morning of the last 30 days, checked against what came in ${label} that day or the next 6: <b>${hit}</b> of ${named} came &mdash; chance would give about <b>${exp.toFixed(1)}</b> (${exp ? (hit/exp).toFixed(2) : '0'}&times;).</div>
    ${whatHit(hits, label)}
    <details><summary style="cursor:pointer;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:11px;color:var(--ink-soft)">Day by day</summary><div class="tscroll"><table class="tbl"><tr><th>morning of</th><th>the red six (&#10003; = came within 7 days)</th></tr>${rows.slice().reverse().join('')}</table></div></details>`;
  step();
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

// every date each pair / triad showed in these states, sorted, cached per state list (Missing Pairs inside needList)
const CDCACHE = new Map();
function comboDates(states){ const key = states.slice().sort().join(',') + '|' + DATES.length; if(CDCACHE.has(key)) return CDCACHE.get(key);
  const out = {}; for(const c of states) for(const x of (SEQ[c]||[])) for(const k of [2,3]) for(const t of cof(k, x.n)) (out[k+t] = out[k+t] || []).push(x.d);
  for(const k in out){ out[k].sort(); } if(CDCACHE.size > 20) CDCACHE.clear(); CDCACHE.set(key, out); return out; }
// the day Date Sum is played for on the live boards = the day shown on the Date Sums tab (today by default),
// with the same Add up / Play settings, so the S letter always matches that tab
function dsPlayDay(){ const v = (document.getElementById('sumsDate')||{}).value; return v || todayCT(); }
function dsChanged(){ renderSums(); renderHot(); renderNeed(); renderMD(); renderMissingToday(); }
function dsLabel(){ const day = dsPlayDay(), withYear = dsYearMode(), root = (document.getElementById('dsGroup')||{}).value === 'root'; const [y,m,d] = day.split('-');
  const one = wy => { const { sum } = dsDateSum(day, wy); return (+m) + '/' + (+d) + (wy ? '/' + y : '') + ' ' + (root ? 'root ' + dsRoot(sum) : 'sum ' + sum); };
  return 'Date Sum ' + (withYear === 'both' ? one(false) + ' + ' + one(true) : one(!!withYear)); }
const KINDW = b => boxCover([b]);   // 24 single, 12 double, 6 double-double, 4 triple, 1 quad
function needList(states, asOf, N, w, regKey, withYear, root, dsDay){
  const start = isoAdd(asOf, -N); const own = windowDraws(states, start, asOf); const P = pullCounts(own);
  let PR = null, nOthers = 1;
  if(w > 0 && regKey && states.length === 1){ const others = REGION4[regKey].states.filter(c => c!==states[0] && SEQ[c]); nOthers = Math.max(1, others.length); PR = pullCounts(windowDraws(others, start, asOf)); }
  const sum = dsDateSum(dsDay || asOf, withYear === 'both' ? false : withYear).sum; const inSum = dsSet(dsDay || asOf, withYear, root);
  const came = new Set(own.map(x => box(x.n)));
  // P = missing pairs / triads: the 5 longest-out pairs and 5 longest-out triads here (by days), counted in each number
  const CD = comboDates(states); const lastP = {};
  for(const key in CD){ const arr = CD[key]; let lo = 0, hi = arr.length; while(lo < hi){ const m = (lo+hi)>>1; if(arr[m] < asOf) lo = m+1; else hi = m; } if(lo) lastP[key] = arr[lo-1]; }
  const longOut = [];
  for(const k of [2,3]){ const keys = comboInfo(k).keys.map(t => [t, lastP[k+t] || '0000']).sort((a,b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : (a[0]<b[0]?-1:1)).slice(0,5); keys.forEach(([t,d]) => longOut.push({k, t, d})); }
  const PP = {}, PW = {};
  for(const b of ALLBOX){ for(const o of longOut){ if(cof(o.k, b).has(o.t)){ PP[b] = (PP[b]||0) + (o.k===3 ? 2 : 1); (PW[b] = PW[b] || []).push('P '+(o.k===2?'pair ':'triad ')+o.t.split('').join('-')+' out since '+(o.d==='0000'?'start':o.d.slice(5))); } } }
  // N = neighbors: draws here in the last 2 days that are one digit off (+1, -1, mirror) from the number
  const NN = {}, NW = {}; const recent = windowDraws(states, isoAdd(asOf, -2), asOf);
  for(const x of recent) for(const nb of neighborsOf(x.n)){ NN[nb.b] = (NN[nb.b]||0) + 1; (NW[nb.b] = NW[nb.b] || []).push('N '+x.n+' '+nm(x.st)+' '+x.d.slice(5)); }
  // V = vibrations: a draw in the last 2 days vibrates to its mirror (+5 every digit), up (+1) and down (-1)
  const VV = {}, VW = {}; for(const x of recent){ const v = vibes(x.n); for(const k in v){ const b = box(v[k]); VV[b] = (VV[b]||0) + 1; (VW[b] = VW[b] || []).push('V '+k+' of '+x.n+' '+nm(x.st)+' '+x.d.slice(5)); } }
  // M = Mirror Doubles: members of the same set that came in the last 14 days (the number itself still open)
  const MM = {}, MW = {}; const md14 = windowDraws(states, isoAdd(asOf, -14), asOf); const mdCame = {};
  for(const x of md14){ const k = (typeof MD_OF !== 'undefined') && MD_OF[box(x.n)]; if(k) (mdCame[k.i] = mdCame[k.i] || new Set()).add(box(x.n)); }
  for(const i in mdCame){ const S = MD_SETS[i]; for(const b of [S.main, ...S.dbl]){ const mates = [...mdCame[i]].filter(o => o !== b).length; if(mates){ MM[b] = mates; (MW[b] = MW[b] || []).push('M '+mates+' of set '+S.name+' came'); } } }
  const SYS = ['G','Q','Y','P','N','V','M'];
  const rows = ALLBOX.map(b => { const k = KINDW(b); const g = P.G[b]||0, q = P.Q[b]||0, y = P.Y[b]||0, s = inSum.has(b)?1:0, pp = PP[b]||0, nn = NN[b]||0;
    const r = PR ? ((PR.G[b]||0)+(PR.Q[b]||0)+(PR.Y[b]||0))/nOthers : 0;
    const vv = VV[b]||0, mm = MM[b]||0;
    return {b, k, G:g + w*r, Q:q, Y:y, P:pp, N:nn, V:vv, M:mm, g, q, y, p:pp, n:nn, v:vv, m:mm, s, r, raw: g+q+y + w*r, sys:(g>0)+(q>0)+(y>0)+(s>0)+(pp>0)+(nn>0)+(vv>0)+(mm>0), fell: came.has(b), extra:[...(PW[b]||[]), ...(NW[b]||[]), ...(VW[b]||[]), ...(MW[b]||[])]}; });
  // every system gets an equal vote: where the number ranks for that system among numbers of its own type
  const below = (arr, v) => { let lo = 0, hi = arr.length; while(lo < hi){ const m = (lo+hi)>>1; if(arr[m] < v) lo = m+1; else hi = m; } return lo; };
  for(const X of SYS){ const byK = {}; rows.forEach(r => (byK[r.k] = byK[r.k] || []).push(r[X])); for(const k in byK) byK[k].sort((a,b) => a-b);
    rows.forEach(r => { const arr = byK[r.k]; r['r'+X] = r[X] > 0 ? (arr.length > 1 ? below(arr, r[X])/(arr.length-1) : 1) : 0; }); }
  rows.forEach(r => { r.str = SYS.reduce((a,X) => a + r['r'+X], 0) + r.s; });
  // and the combined score is ranked within type once more, so each type's strongest number reaches the top
  const live = rows.filter(r => !r.fell && r.str > 0); const byK2 = {}; live.forEach(r => (byK2[r.k] = byK2[r.k] || []).push(r.str)); for(const k in byK2) byK2[k].sort((a,b) => a-b);
  live.forEach(r => { const arr = byK2[r.k]; r.rank = arr.length > 1 ? below(arr, r.str)/(arr.length-1) : 1; });
  return { all: rows, rows: rows.filter(r => !r.fell && r.str > 0).sort((a,b) => b.rank-a.rank || b.str-a.str || b.sys-a.sys || (a.b<b.b?-1:1)), P, own, sum };
}
const KINDNAME = {24:'single', 12:'double', 6:'2 doubles', 4:'triple', 1:'quad'};
function renderNeed(){
  const el = document.getElementById('needBody'); if(!el) return;
  const st = document.getElementById('ndState').value, N = +document.getElementById('ndDays').value || 60, w = +document.getElementById('ndRegion').value || 0, TOP = +document.getElementById('ndN').value || 20;
  const states = st==='all' ? Object.keys(SEQ) : [st]; const asOf = DATES[DATES.length-1]; const tomorrow = isoAdd(asOf, 1);
  const regKey = Object.keys(REGION4).find(k => REGION4[k].states.includes(st));
  const withYear = dsYearMode(), root = (document.getElementById('dsGroup')||{}).value === 'root';
  const L = needList(states, tomorrow, N, w, regKey, withYear, root, dsPlayDay()); const P = L.P, own = L.own;
  const lastSeen = {}; for(const c of states) for(const x of (SEQ[c]||[])) lastSeen[box(x.n)] = x;
  const dueAll = L.rows; const due = dueAll.slice(0, 12), more = dueAll.slice(12, Math.max(TOP, 12));
  const drawsWeek = Math.round(own.length/N*7);
  const place = dueAll.length ? '' : '';
  const kinds = {}; due.forEach(r => kinds[r.k] = (kinds[r.k]||0)+1);
  const fired = r => [...(r.extra||[]).filter(x => 'NVM'.includes(x[0])), ...(P.why[r.b]||[]).slice().reverse(), ...(r.extra||[]).filter(x => x[0]==='P')];
  const label = st==='all' ? 'all states' : nm(st);
  const row = (r,i) => { const last = lastSeen[r.b];
    return `<tr><td>${i+1}</td><td>${chip(r.b, i<6?'hotr':i<12?'warmo':'')}</td><td class="me">${KINDNAME[r.k]}</td><td style="font-weight:700">${r.str.toFixed(1)}<span class="me" style="font-weight:400"> / 8</span></td><td class="me">${r.rank >= 0.995 ? '#1' : 'top '+Math.max(1, Math.round((1-r.rank)*100))+'%'}</td><td><span title="G ${r.g} · Q ${r.q} · Y ${r.y} · P ${r.p} · N ${r.n} · V ${r.v} · M ${r.m}${r.s?' · S':''}">${['G','Q','Y','P','N','V','M','S'].filter((t,k) => [r.g,r.q,r.y,r.p,r.n,r.v,r.m,r.s][k]>0).map(t => `<i class="h${t}" style="font-style:normal;font-family:'Roboto Mono',monospace;font-size:10px;font-weight:700;border-radius:3px;padding:0 4px;color:#fff;margin-right:2px">${t}</i>`).join('')}</span></td><td class="me">${last ? last.d.slice(5)+' ('+daysBetween(last.d, asOf)+'d)' : 'never'}</td><td class="me">${fired(r).slice(0,2).map(x => x.slice(2)).join(' · ')}${fired(r).length>2?' · +'+(fired(r).length-2):''}</td><td class="me">${pct(1 - Math.pow(1 - boxCover([r.b])/10000, drawsWeek))}</td></tr>`; };
  const head = `<tr><th>#</th><th>number</th><th>type</th><th>score</th><th>among its type</th><th>systems</th><th>last here</th><th>what fired (newest first)</th><th>chance this week</th></tr>`;
  el.innerHTML = `<div id="needCheck" class="verdict">Checking the last 30 days&hellip;</div>
    <div class="note" style="margin:0 0 6px">${label} &middot; ${N}-day pull &middot; ${own.length} draws${w>0&&regKey&&st!=='all'?` &middot; region help ${REGION4[regKey].name} ${w}&times;`:''} &middot; ${dsLabel()} &middot; top 12 today: ${Object.keys(kinds).sort((a,b)=>b-a).map(k => kinds[k]+' '+KINDNAME[k]+(kinds[k]>1&&!/s$/.test(KINDNAME[k])?'s':'')).join(', ')}</div>
    <div class="famh">Due here &mdash; strongest for its type first (red = top 6, orange = next 6)</div>
    <div class="tscroll"><table class="tbl">${head}${due.map(row).join('')}</table></div>
    ${more.length ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:11px;color:var(--ink-soft)">Next ${more.length}</summary><div class="tscroll"><table class="tbl">${more.map((r,i) => row(r, i+12)).join('')}</table></div></details>` : ''}
    <div class="note"><b>Score out of 8, one point per system.</b> <b>G</b> 100 Grand (and its Relatives), <b>Q</b> Big Quad Energy, <b>Y</b> My Lil Yeah, <b>P</b> holds one of the 5 longest-out pairs or triads here, <b>N</b> a neighbor (mirror / &plusmn;1 on one digit) fell here in the last 2 days, <b>V</b> a Vibration (whole number mirrored, +1 or &minus;1) of a draw here in the last 2 days, <b>M</b> its Mirror Doubles set mates came here in 14 days, <b>S</b> today&rsquo;s Date Sum. For G, Q, Y, P and N the point is where the number ranks against numbers of its <i>own type</i> &mdash; a single sits in about 24 arrangements&rsquo; worth of lists, so raw counts would always bury triples and quads. The score is then ranked within type again (&ldquo;#1&rdquo; = the strongest of its type here), so the best triple and quad sit next to the best single. Hover the letters for the raw G / Q / Y counts. &ldquo;Chance this week&rdquo; is how often that number comes here in a week by luck alone &mdash; a single is about 6&times; a triple and 24&times; a quad.</div>
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

/* ---------- 2b. date sum pairs (Play -> "date sum pairs", same rule as Almanac Convergence) ----------
   The calendar day as a pair plus every pair whose two digits add to the day (18th -> 18x 99x; 6th -> 06x 15x 24x 33x).
   Past the 18th it drops down 10 days to start over and keeps the day's own pair (20th -> 20x 10x 19x 28x 37x 46x 55x);
   the 19th and 29th drop to the 9th. A draw counts when it holds both digits anywhere.
   Tested on the year (Oct 17, 2025 - Nov 18, 2026): Pick 4 9,318 vs 9,267 by chance (1.005x). */
const DSP_DAYS = {};
function dspPairs(day){
  if(DSP_DAYS[day]) return DSP_DAYS[day];
  const bx = s => s.split('').sort().join(''), out = [], add = (p, why) => { if(!out.some(x => x.p === p)) out.push({p, why}); };
  add(bx(String(day).padStart(2,'0')), 'the date');
  let t = day; while(t > 18) t -= 10;
  if(t !== day) add(bx(String(t).padStart(2,'0')), 'drops to the '+t+(t===1?'st':t===2?'nd':t===3?'rd':'th'));
  for(let a = 0; a < 10; a++) for(let b = a; b < 10; b++) if(a + b === t) add(''+a+b, 'adds to '+t);
  return (DSP_DAYS[day] = out);
}
const dspTarget = day => { let t = day; while(t > 18) t -= 10; return t; };
/* Last digit sum pairs (Marcus, Nov 25): the date's last digit, its mirror (+5) and the two together -> 11/24: 44xx 49xx 99xx.
   They also like to come the day before or the day after their own date. */
const dspMode = () => ((document.getElementById('dsGroup')||{}).value === 'last') ? 'last' : 'pair';
function dspLast(iso){ const d = +iso.slice(-1), m = (d+5)%10, out = [], add = (p, why) => { if(!out.some(x => x.p === p)) out.push({p, why}); };
  add(''+d+d, 'last digit '+d); add([d,m].sort().join(''), d+' + mirror '+m); add(''+m+m, 'mirror '+m); return out; }
function dspList(iso){ return dspMode() === 'last' ? dspLast(iso) : dspPairs(+iso.slice(8,10)); }
function dspHas(n, p){ const r = String(n).split(''); for(const ch of p){ const i = r.indexOf(ch); if(i < 0) return false; r.splice(i,1); } return true; }
const DSP_SHARE = {};
function dspShare(ps){ const key = ps.join(','); if(DSP_SHARE[key] === undefined){ let c = 0; for(let i = 0; i < 10000; i++){ const n = String(i).padStart(4,'0'); if(ps.some(p => dspHas(n, p))) c++; } DSP_SHARE[key] = c/10000; } return DSP_SHARE[key]; }
function dspScore(dates, states){
  const allow = new Set(states), out = { n:0, hit:0, exp:0, days:[] };
  dates.forEach(dt => {
    const ps = dspList(dt).map(x => x.p), sh = dspShare(ps), row = { dt, ps, hits:[], n:0, e:0 }, day = P4[dt] || {};
    for(const c in day){ if(!allow.has(c)) continue; for(const x of day[c]){ row.n++; const m = ps.filter(p => dspHas(x.n, p)); if(m.length) row.hits.push({...x, c, pm:m}); } }
    row.e = row.n * sh; out.n += row.n; out.hit += row.hits.length; out.exp += row.e; out.days.push(row);
  });
  return out;
}
function renderSumPairs(){
  const iso = document.getElementById('sumsDate').value, scope = document.getElementById('dsScope').value;
  const states = scopeStates(scope === 'all' ? 'all' : scope, 'all'), label = scope === 'all' ? 'all states' : scopeName(scope, 'all');
  const [y,m,d] = iso.split('-'), day = +d, t = dspTarget(day), last = dspMode() === 'last', P = dspList(iso);
  const lab = s => fmtDate(s).replace(/, \d{4}$/, '');
  let h = '<div class="dshead"><div class="dsdate">'+(+m)+'/'+day+'</div>'+
    '<div class="dsmath">'+(last ? 'last digit <b>'+(day%10)+'</b> &rarr; mirror <b>'+((day+5)%10)+'</b>' : t === day ? 'the '+day+' &rarr; pairs that add to <b>'+t+'</b>' : 'the '+day+' can&rsquo;t be added by two digits &rarr; drops to <b>'+t+'</b>')+'</div>'+
    '<div class="dsplay">Playing <b>'+(last ? 'last digit sum pairs' : 'date sum pairs')+'</b> &middot; '+label+'</div></div>';
  h += '<div class="dsrow" style="margin:6px 0 10px">'+P.map(x => '<span class="chip" style="font-size:15px;font-weight:700" title="'+x.why+'">'+x.p+'xx<span class="ago">'+x.why+'</span></span>').join('')+'</div>';
  const today = dspScore([iso], states).days[0];
  const hitChip = x => '<span class="chip dshit" onclick="useSeed(\''+x.n+'\')" title="holds '+x.pm.join(', ')+'">'+x.n+'<span class="ago">'+nm(x.c)+' '+(x.s==='m'?'mid':'eve')+' &middot; '+x.pm.join(' ')+'</span></span>';
  h += '<div class="famh" style="margin-top:8px">Came on '+lab(iso)+'</div>';
  if(!today.n) h += '<div class="note" style="margin:0">No Pick 4 draws logged for '+lab(iso)+' yet &mdash; the first midday draws land around noon Central; evenings are in by about 11:30 PM.</div>';
  else h += '<div class="dsrow"><b>Pick 4</b> '+today.hits.length+' of '+today.n+' draws <span class="dsx">(chance '+today.e.toFixed(1)+')</span> '+today.hits.map(hitChip).join('')+'</div>'+
    '<div class="dsrow" style="color:var(--ink-soft)">By pair: '+P.map(x => '<b>'+x.p+'xx</b> '+today.hits.filter(z => z.pm.includes(x.p)).length).join(' &nbsp;|&nbsp; ')+'</div>'+(last ? dspNear4(iso, states) : '');
  const upTo = DATES.filter(x => x <= iso), week = dspScore(upTo.slice(-7), states);
  h += '<div class="famh" style="margin-top:10px">Last 7 days</div><div class="tscroll"><table class="tbl dst"><tr><th>Date</th><th>Pairs</th><th>Pick 4</th><th>What came</th></tr>'+
    week.days.slice().reverse().map(r => '<tr><td>'+lab(r.dt)+'</td><td>'+r.ps.map(p => p+'xx').join(' ')+'</td><td>'+r.hits.length+' <span class="dsx">/ '+r.e.toFixed(1)+'</span></td><td class="dscame">'+r.hits.map(x => x.n+' <span>'+nm(x.c)+'</span>').join(' &middot; ')+'</td></tr>').join('')+'</table></div>';
  const Y = dspScore(upTo.slice(-365), states), wk = o => o.hit+' vs '+o.exp.toFixed(1)+' by chance ('+(o.exp ? (o.hit/o.exp).toFixed(2) : '&mdash;')+'&times;)';
  h += '<div class="dssum"><div><div class="l">Last 7 days</div><div class="v">P4 '+wk(week)+'</div></div><div><div class="l">Last '+Y.days.length+' days</div><div class="v">P4 '+wk(Y)+'</div></div></div>';
  if(last) h += '<details class="dslist"><summary><b>Last digit sum pairs for every last digit</b></summary><div class="tscroll"><table class="tbl dst">'+
    [0,1,2,3,4,5,6,7,8,9].map(k => '<tr'+(k===day%10?' style="font-weight:700"':'')+'><td>ends in '+k+'</td><td>'+dspLast('2026-01-0'+k).map(x => x.p+'xx').join(' ')+'</td></tr>').join('')+'</table></div></details>';
  else h += '<details class="dslist"><summary><b>Date sum pairs for every date</b></summary><div class="tscroll"><table class="tbl dst">'+
    Array.from({length:31}, (_, i) => i+1).map(dd => '<tr'+(dd===day?' style="font-weight:700"':'')+'><td>'+dd+'</td><td>'+dspPairs(dd).map(x => x.p+'xx').join(' ')+'</td><td class="dsx">'+(dspTarget(dd) !== dd ? 'drops to the '+dspTarget(dd) : '')+'</td></tr>').join('')+'</table></div></details>';
  document.getElementById('sumsBody').innerHTML = h;
  document.getElementById('sumsNote').innerHTML = last ? 'Last digit sum pairs: the date&rsquo;s last digit and its mirror (+5) &mdash; the 24th &rarr; 44xx 49xx 99xx, the 25th &rarr; 55xx 05xx 00xx. A pair counts when a draw holds both digits anywhere. <b>Day before / day after</b> counts yesterday&rsquo;s and tomorrow&rsquo;s pairs in today&rsquo;s draws. Checked before it went in, all states: last 2 weeks (Nov 11&ndash;24) own date 232 vs 201 by chance (1.15&times;), yesterday&rsquo;s pairs 0.95&times;, tomorrow&rsquo;s 1.05&times;; Nov 24 ran 20 vs 13.0. Whole year: own date 1.01&times;, day before 1.01&times;, day after 1.00&times;. The hottest list for these pairs, top 12 every morning of the year: 310 vs 320.5 by chance (0.97&times;); Southeast 1.13&times;, Northeast 1.00&times;. Watch the year line, not the day. Tap a number to make it the 100 Grand seed.' : 'Same date sum pairs as Almanac Convergence. A pair counts when a draw holds both digits anywhere (18xx = a 1 and an 8 in any spot). <b>Chance</b> is how many draws would hold one of the pairs anyway. Tested on the year: 9,318 vs 9,267 by chance (1.005&times;); Nov 18 ran 16 vs 12.0. Watch the year line, not the day. The Add up setting does not change the pairs. Tap a number to make it the 100 Grand seed.';
}
{ const _rs = renderSums; renderSums = function(){ const v = document.getElementById('dsGroup').value; return (v === 'pair' || v === 'last') ? renderSumPairs() : _rs.apply(this, arguments); }; }

/* ---------- 2c. date sum pairs: hottest numbers for the day's pairs ----------
   Every Pick 4 box holding one of the day's pairs, ranked by the Hottest board's engine (all eight systems:
   G Q Y P N V M S), built from the draws before that day in the Date Sums region. Scorecard: the last 28
   mornings, each list graded on its own day and on the 14 days from it.
   Tested every morning Oct 2025 - Nov 2026, top 12: all states same day 411 vs 411.8 (1.00x), within 14 days
   2,856 vs 2,854.5 (1.00x); Northeast same day 1.09x, Southeast 0.95x (14 days 1.05x), Central 1.05x, West 0.95x. */
// default = most letters first (Marcus, Nov 26); new storage key so every screen starts there
let DSP4_RANK = (function(){ try{ return localStorage.getItem('dsp4Rank2') || 'signals'; }catch(e){ return 'signals'; } })();
function dsp4SetRank(v){ DSP4_RANK = v; try{ localStorage.setItem('dsp4Rank2', v); }catch(e){} DSP4.key = null; renderSums(); }
let DSP4_SHOW = (function(){ try{ return +localStorage.getItem('dsp4Show') || 15; }catch(e){ return 15; } })();
function dsp4SetShow(v){ DSP4_SHOW = +v; try{ localStorage.setItem('dsp4Show', v); }catch(e){} renderSums(); }
function dspHot4(iso, states, n){ n = n || 12;
  const ps = dspList(iso).map(x => x.p), N = +((document.getElementById('hotDays')||{}).value) || 7;
  /* every system votes (Nov 25): the 8 Hottest systems, plus D when the box also holds the other pair sum
     (date sum pairs while playing last digit pairs, and the reverse) */
  const other = (dspMode() === 'last' ? dspPairs(+iso.slice(8,10)) : dspLast(iso)).map(x => x.p);
  if(n >= 200) n = 99999;
  if(DSP4_RANK === 'hits'){   /* most hits: every box holding the pairs, all-different first (24 ways > 12 > 6 > 4 > 1), then by votes */
    return needList(states, iso, N, 0, null, false, false, iso).all.filter(r => ps.some(p => dspHas(r.b, p)))
      .map(r => Object.assign({ pm: ps.filter(p => dspHas(r.b, p)), d: other.some(p => dspHas(r.b, p)) ? 1 : 0 }, r))
      .sort((a,b) => b.k - a.k || (b.str + b.d) - (a.str + a.d) || (a.b < b.b ? -1 : 1)).slice(0, n);
  }
  /* "Show all" (Marcus, Nov 25): truly every box holding the pairs, even with no system behind it,
     so a hit like 1525 / 7787 is always on the list. */
  if(n >= 200) n = 99999;
  return (n === 99999 ? needList(states, iso, N, 0, null, false, false, iso).all : hotPicks(states, iso, N, 1, false, false, iso)).filter(r => ps.some(p => dspHas(r.b, p)))
    .map(r => Object.assign({ pm: ps.filter(p => dspHas(r.b, p)), d: other.some(p => dspHas(r.b, p)) ? 1 : 0 }, r))
    .sort((a,b) => (b.sys + b.d) - (a.sys + a.d) || (b.str + b.d) - (a.str + a.d) || (a.b < b.b ? -1 : 1)).slice(0, n);
}
let DSP4 = { key:null, rows:[], done:false, run:0 };
function dspScore4(iso, states, scope){
  const key = DATES.length + '|' + (DATES[DATES.length-1]||'') + '|' + scope + '|' + iso + '|' + ((document.getElementById('hotDays')||{}).value||7) + '|' + dspMode() + '|' + DSP4_RANK;
  if(DSP4.key === key) return DSP4;
  const run = ++DSP4.run; DSP4 = { key, rows:[], done:false, run };
  const by = {}; for(const c of states) for(const x of (SEQ[c]||[])) (by[x.d] = by[x.d] || []).push({ b: box(x.n), c, n: x.n });
  const ds = DATES.filter(d => (by[d]||[]).length && d <= iso); const idx = []; for(let i = ds.length - 1; i >= 0 && idx.length < 28; i--) if(ds[i] < iso) idx.push(i);
  const p = b => boxCover([b])/10000;
  const step = () => { if(DSP4.run !== run) return; const i = idx.shift();
    if(i === undefined){ DSP4.done = true; const el = document.getElementById('dsp4Score'); if(el) el.innerHTML = dspScore4HTML(); return; }
    const D = ds[i], top = dspHot4(D, states), day = by[D]; let hit = 0, exp = 0, h14 = 0, e14 = 0, n14 = 0, span = 0; const hits = [], m14 = new Set();
    for(let j = i; j < Math.min(ds.length, i + 14); j++){ span++; n14 += by[ds[j]].length; by[ds[j]].forEach(x => m14.add(x.b)); }
    top.forEach(r => { exp += 1 - Math.pow(1 - p(r.b), day.length); e14 += 1 - Math.pow(1 - p(r.b), n14); const c = day.filter(x => x.b === r.b); if(c.length){ hit++; hits.push(c.map(x => x.n+' '+nm(x.c)).join('/')); } if(m14.has(r.b)) h14++; });
    DSP4.rows.push({ dt:D, n:top.length, hit, exp, h14, e14, span, open: span < 14, hits });
    const el = document.getElementById('dsp4Score'); if(el) el.innerHTML = '<div class="note">Checking the last 28 mornings&hellip; '+DSP4.rows.length+' of 28</div>';
    setTimeout(step, 0); };
  setTimeout(step, 0); return DSP4;
}
function dspScore4HTML(){
  const R = DSP4.rows, full = R.filter(r => !r.open), sum = (a, k) => a.reduce((x, r) => x + r[k], 0), r2 = (h, e) => e ? (h/e).toFixed(2)+'&times;' : '&mdash;';
  const lab = s => fmtDate(s).replace(/, \d{4}$/, '');
  return '<div class="dssum"><div><div class="l">Came that day &middot; last '+R.length+' mornings</div><div class="v">'+sum(R,'hit')+' vs '+sum(R,'exp').toFixed(1)+' by chance ('+r2(sum(R,'hit'), sum(R,'exp'))+')</div></div>'+
    '<div><div class="l">Came within 14 days &middot; '+full.length+' finished mornings</div><div class="v">'+sum(full,'h14')+' of '+sum(full,'n')+' vs '+sum(full,'e14').toFixed(1)+' by chance ('+r2(sum(full,'h14'), sum(full,'e14'))+')</div></div></div>'+
    '<details class="dslist"><summary><b>Day by day</b></summary><div class="tscroll"><table class="tbl dst"><tr><th>Morning of</th><th>Listed</th><th>Came that day</th><th>Within 14 days</th><th>Which came that day</th></tr>'+
    R.map(r => '<tr><td>'+lab(r.dt)+'</td><td>'+r.n+'</td><td>'+r.hit+' <span class="dsx">/ '+r.exp.toFixed(1)+'</span></td><td>'+r.h14+' <span class="dsx">/ '+r.e14.toFixed(1)+(r.open ? ' &middot; '+r.span+' of 14 days' : '')+'</span></td><td class="dscame">'+r.hits.join(' &middot; ')+'</td></tr>').join('')+'</table></div></details>';
}
function dspHot4HTML(iso){
  const scope = document.getElementById('dsScope').value, states = scopeStates(scope === 'all' ? 'all' : scope, 'all');
  const top = dspHot4(iso, states, DSP4_SHOW), came = {};
  for(const c of states) for(const x of (SEQ[c]||[])) if(x.d === iso) (came[box(x.n)] = came[box(x.n)] || []).push(x.n+' '+nm(c));
  const KN = {24:'single',12:'double',6:'2 doubles',4:'triple',1:'quad'}, hasDay = Object.keys(came).length || (P4[iso] && Object.keys(P4[iso]).length);
  let h = '<div class="famh" style="margin-top:10px">Hottest numbers for these pairs <span class="me">all eight systems (G Q Y P N V M S), built from the draws before '+fmtDate(iso).replace(/, \d{4}$/, '')+', '+((document.getElementById('hotDays')||{}).value||7)+'-day window</span></div>'+
    '<div class="controls" style="margin:0 0 6px"><label>Rank by <select onchange="dsp4SetRank(this.value)"><option value="signals"'+(DSP4_RANK==='signals'?' selected':'')+'>most letters first (systems agreeing)</option><option value="hits"'+(DSP4_RANK==='hits'?' selected':'')+'>all-different numbers first</option></select></label>'+
    '<label>Show <select onchange="dsp4SetShow(this.value)">'+[12,15,20,30,200].map(v => '<option value="'+v+'"'+(DSP4_SHOW===v?' selected':'')+'>'+(v===200?'all':v)+'</option>').join('')+'</select></label>'+
    '<span class="me">'+(DSP4_RANK==='hits' ? 'Over the year, picks on this list came 16% of days (vs 11.5% ranked by signals) &mdash; all-different numbers have 24 ways to come but pay less as a box.' : 'Most letters first: grouped by how many systems agree, then by score. Red = top 6, orange = next 9. Doubles, triples and quads come less often than singles.')+'</span></div>';
  const LET = r => r.sys + (r.d ? 1 : 0), byLet = DSP4_RANK === 'signals';
  const groupHead = (r, i) => { if(!byLet) return i === 12 ? '</div><div class="famh" style="margin-top:8px">Next in line <span class="me">past the top 12 &mdash; not graded on the scorecard</span></div><div class="heatgrid">' : '';
    if(i > 0 && LET(top[i-1]) === LET(r)) return ''; const n = top.filter(x => LET(x) === LET(r)).length;
    return (i ? '</div>' : '') + '<div class="famh" style="margin-top:'+(i?10:2)+'px">'+LET(r)+' systems agree <span class="me">'+n+' number'+(n>1?'s':'')+'</span></div><div class="heatgrid">'; };
  h += top.length ? (byLet ? '' : '<div class="heatgrid">')+top.map((r, i) => { const c = came[r.b];
      return groupHead(r, i)+'<div class="heat '+(i<6?'hot':i<15?'warm':'')+'" onclick="useSeed(\''+r.b+'\')" style="'+(c?'opacity:.6;text-decoration:line-through':'')+'"><div class="hn">'+r.b+'</div><div class="ht">'+hotLetters(r)+(r.d?'<i style="background:#0E7C86;color:#fff;font-style:normal;padding:0 3px;border-radius:2px">D</i>':'')+'</div><div class="hs">'+KN[r.k]+' &middot; '+r.str.toFixed(1)+'/8 &middot; '+r.pm.map(p => p+'xx').join(' ')+(c ? ' &middot; came '+c.slice(0,2).join(', ') : hasDay ? ' &middot; not yet' : '')+'</div></div>'; }).join('')+'</div>'
    : '<div class="note">No number holding these pairs has a system behind it in this region.</div>';
  const S = dspScore4(iso, states, scope);
  h += '<div class="famh" style="margin-top:10px">How this list has done</div><div id="dsp4Score">'+(S.done ? dspScore4HTML() : '<div class="note">Checking the last 28 mornings&hellip;</div>')+'</div>';
  h += '<div class="note" style="margin-top:4px">Every box holding one of the day&rsquo;s pairs, ranked by the Hottest board&rsquo;s engine with all eight systems, plus <b>D</b> when it also holds the other pair sum (date sum pairs and last digit pairs vote for each other); crossed out = came that day. The scorecard rebuilds each of the last 28 mornings&rsquo; lists and grades them two ways: came that same day, and came within the 14 days from that morning. With every system voting (Nov 25), every morning of the year, top 12 &mdash; last digit pairs: all states 404 vs 394.8 (1.02&times;), Northeast 1.08&times;, Southeast 1.13&times;; date sum pairs: all states 460 vs 455.0 (1.01&times;), Northeast 1.07&times;, Southeast 1.04&times;. Before the extra vote, tested every morning of the year, top 12: all states 411 same-day vs 411.8 by chance (1.00&times;), 2,856 within 14 days vs 2,854.5 (1.00&times;); by region same day Northeast 1.09&times;, Central 1.05&times;, Southeast 0.95&times;, West 0.95&times; &mdash; inside chance. A shortlist inside the pairs, not an edge.</div>';
  return h;
}
{ const _rsp = renderSumPairs; renderSumPairs = function(){ _rsp.apply(this, arguments); const body = document.getElementById('sumsBody'); if(!body) return;
    try{ const anchor = [...body.querySelectorAll('.famh')][0]; const div = document.createElement('div'); div.innerHTML = dspHot4HTML(document.getElementById('sumsDate').value); if(anchor) anchor.before(...div.childNodes); else body.append(...div.childNodes); }catch(e){ console.error(e); } }; }

/* ---------- 2d. last digit sum pairs: the day before / day after check ---------- */
function dspNear4(iso, states){
  const allow = new Set(states), day = P4[iso] || {}, draws = []; for(const c in day){ if(allow.has(c)) day[c].forEach(x => draws.push(x)); }
  const row = (lab, src) => { const ps = dspLast(src).map(x => x.p), h = draws.filter(x => ps.some(p => dspHas(x.n, p)));
    return '<div class="dsrow"><span style="min-width:190px">'+lab+' <b>'+ps.map(p => p+'xx').join(' ')+'</b></span> '+h.length+' <span class="dsx">/ '+(draws.length*dspShare(ps)).toFixed(1)+'</span> <span class="dscame">'+h.slice(0,12).map(x => x.n).join(' ')+(h.length>12?' &hellip;':'')+'</span></div>'; };
  return '<div class="dsrow" style="color:var(--ink-soft);margin-top:6px">Day before / day after &mdash; the neighbors&rsquo; pairs in today&rsquo;s draws (came / chance):</div>'+
    row('Yesterday&rsquo;s ('+(+isoAdd(iso,-1).slice(5,7))+'/'+(+isoAdd(iso,-1).slice(8))+')', isoAdd(iso,-1)) + row('Tomorrow&rsquo;s ('+(+isoAdd(iso,1).slice(5,7))+'/'+(+isoAdd(iso,1).slice(8))+')', isoAdd(iso,1));
}
