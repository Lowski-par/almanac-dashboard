/* Pick 5 Endeavor — page logic.
   Data: history.json (published, through the date it names) + feed.json (published by the
   results task) + the owner's live db "feed" collection when signed in. */
'use strict';

const STATES = {
  pa:{name:'Pennsylvania', game:'Pick 5', m:'Day', e:'Evening'},
  oh:{name:'Ohio', game:'Pick 5', m:'Midday', e:'Evening'},
  md:{name:'Maryland', game:'Pick 5', m:'Midday', e:'Evening'},
  fl:{name:'Florida', game:'Pick 5', m:'Midday', e:'Evening'},
  ga:{name:'Georgia', game:'Georgia FIVE', m:'Midday', e:'Evening', nobox:true},
  va:{name:'Virginia', game:'Pick 5', m:'Day', e:'Night'},
  dc:{name:'Washington DC', game:'DC-5', m:'Midday', e:'Evening'},
  de:{name:'Delaware', game:'Play 5', m:'Day', e:'Night'},
  la:{name:'Louisiana', game:'Pick 5', m:null, e:'Evening'},
  mi:{name:'Michigan', game:'Daily 5', m:'Midday', e:'Evening'}
};
const CODES = Object.keys(STATES).sort((a,b)=>STATES[a].name.localeCompare(STATES[b].name));
const nm = c => (STATES[c] && STATES[c].name) || c.toUpperCase();
const PAY = {120:400, 60:800, 30:1600, 20:2500, 10:5000, 5:10000, 1:50000};
const RUNDOWNS = {
  '+0 1 1 2 3 (Endeavor)':'01123', '+1 1 1 1 1':'11111', '+1 0 1 1 2':'10112', '+1 1 2 3 5':'11235', '+1 2 3 5 8':'12358'
};
const END_STEPS = [1,2,3,4,6,7,8,9];

/* ── helpers ── */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const srt = n => n.split('').sort().join('');
const FACT = [1,1,2,6,24,120];
function ways(n){ const c={}; for(const d of n) c[d]=(c[d]||0)+1; let w=120; for(const k in c) w/=FACT[c[k]]; return w; }
const addInc = (n, inc, k) => n.split('').map((d,i)=>String((+d + k*(+inc[i]))%10)).join('');
const mirror = n => n.split('').map(d=>String((+d+5)%10)).join('');
function perms(n){
  const out=new Set();
  const go=(pre,rest)=>{ if(!rest.length){out.add(pre);return;} for(let i=0;i<rest.length;i++) if(rest.indexOf(rest[i])===i) go(pre+rest[i], rest.slice(0,i)+rest.slice(i+1)); };
  go('', n); return [...out].sort();
}
function endeavorKeys(n, which){
  const base = srt(n), out = new Map();
  const incs = which === 'all' ? Object.entries(RUNDOWNS) : [['+0 1 1 2 3 (Endeavor)','01123']];
  for(const [label, inc] of incs){
    const steps = inc === '01123' ? END_STEPS : [1,2,3,4,5,6,7,8,9];
    for(const k of steps){ const key = srt(addInc(base, inc, k)); if(key !== base && !out.has(key)) out.set(key, label); }
  }
  return out;  // boxed key -> rundown label
}
const DAY = 864e5;
const dnum = d => Math.round(Date.parse(d+'T12:00:00Z')/DAY);
const fmtD = d => new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const fmtShort = d => new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
function todayCT(){ try{ return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date()); }catch(e){ return new Date().toISOString().slice(0,10); } }
const slotName = (c,s) => (STATES[c] && STATES[c][s]) || (s==='m'?'Midday':'Evening');
function store(k,v){ try{ if(v===undefined) return JSON.parse(localStorage.getItem('p5e_'+k)); localStorage.setItem('p5e_'+k, JSON.stringify(v)); }catch(e){ return null; } }

/* ── data ── */
let ROWS = new Map();          // "c|date|slot" -> n
let SEQ = {};                  // c -> [{d,s,n,i}] in time order
let DATES = [];                // all dates with any draw, ascending
let HIST_THROUGH = null;
let FEED_STATE = {file:null, db:null, updatedAt:null};
let CUR_DAY = null;

function addDraw(c, d, s, n){
  if(!STATES[c] || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{5}$/.test(n) || (s!=='m' && s!=='e')) return;
  ROWS.set(c+'|'+d+'|'+s, n);
}
function addFeedDoc(doc){
  if(!doc || !doc.date || !doc.p5) return;
  for(const [c, ns] of Object.entries(doc.p5)){
    const sl = (doc.s5 && doc.s5[c]) || [];
    (ns||[]).forEach((n,i)=> addDraw(c, doc.date, sl[i] || (ns.length===1 ? 'e' : (i===0?'m':'e')), String(n)));
  }
  for(const [c, ns] of Object.entries(doc.p4 || {})){
    const sl = (doc.s4 && doc.s4[c]) || [];
    setP4Day(doc.date, c, (ns||[]).map((n,i)=>({n:String(n), s:(sl[i]==='m'?'m':'e')})));
  }
}
function rebuild(){
  SEQ = {}; const ds = new Set();
  for(const [k, n] of ROWS){ const [c,d,s] = k.split('|'); (SEQ[c] = SEQ[c] || []).push({d,s,n}); ds.add(d); }
  for(const c in SEQ){ SEQ[c].sort((a,b)=> a.d<b.d?-1:a.d>b.d?1:(a.s==='m'?-1:1)); SEQ[c].forEach((x,i)=>x.i=i); }
  DATES = [...ds].sort();
  BOXIDX = new Map();
  for(const c in SEQ) for(const x of SEQ[c]){ const k = srt(x.n); if(!BOXIDX.has(k)) BOXIDX.set(k, []); BOXIDX.get(k).push({...x, c}); }
  for(const arr of BOXIDX.values()) arr.sort((a,b)=> a.d<b.d?-1:a.d>b.d?1:(a.s===b.s?0:a.s==='m'?-1:1));
}
let BOXIDX = new Map();       // box -> every draw with that box, in time order
const laterThan = (x, src) => x.d > src.d || (x.d === src.d && x.s === 'e' && src.s === 'm');
function cameElsewhere(c, src, key){   // later draws in OTHER states whose box = key
  return (BOXIDX.get(key) || []).filter(x => x.c !== c && laterThan(x, src));
}
async function loadAll(){
  try{
    const r = await fetch('history.json', {cache:'force-cache'});
    const j = await r.json(); HIST_THROUGH = j.through;
    for(const [c,d,s,n] of j.draws) addDraw(c,d,s,n);
  }catch(e){}
  try{
    const r = await fetch('p4days.json', {cache:'no-cache'});
    const j = await r.json();
    for(const [d, m] of Object.entries(j.d||{})) for(const [c, arr] of Object.entries(m)) if(!(P4DAY.get(d)||{})[c]) setP4Day(d, c, arr.map(x=>({n:x.slice(0,4), s:x[4]==='m'?'m':'e'})));
  }catch(e){}
  try{
    const r = await fetch('p4trips.json', {cache:'force-cache'});
    const j = await r.json(); for(const [c,d,s,n] of j.trips) addP4(c,d,s,n);
  }catch(e){}
  await loadFeed();
}
async function loadFeed(){
  FEED_STATE.file = null;
  // the live file on GitHub Pages first (so the claude.ai copy stays current), then this copy's own
  for(const u of ['https://lowski-par.github.io/almanac-dashboard/pick5/feed.json', 'feed.json']){
    try{
      const r = await fetch(u+'?t='+Date.now(), {cache:'no-store'});
      if(r.ok){ const j = await r.json(); (j.docs||[]).forEach(addFeedDoc); FEED_STATE.file = true; FEED_STATE.updatedAt = j.updatedAt || null; break; }
    }catch(e){}
  }
  try{
    if(window.claude && window.claude.use){
      const db = await window.claude.use('db');
      if(db){
        const snap = await db.collection('feed').limit(1000).get();
        snap.docs.forEach(x => addFeedDoc(x.data()));
        FEED_STATE.db = true;
      }
    }
  }catch(e){ FEED_STATE.db = false; }
  rebuild();
}

/* ── status ── */
function renderStatus(){
  const last = DATES[DATES.length-1];
  const today = todayCT();
  let n = 0; for(const c in SEQ){ n += SEQ[c].length; }
  $('feedDot').className = 'dot ' + (last && dnum(today)-dnum(last) <= 1 ? 'ok' : 'warn');
  $('feedText').textContent = last
    ? `${n.toLocaleString()} draws loaded · newest ${fmtD(last)}` + (FEED_STATE.updatedAt ? ` · results updated ${new Date(FEED_STATE.updatedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}` : '')
    : 'No results loaded yet.';
  const sel = $('daySel');
  const recent = DATES.slice(-60).reverse();
  if(!CUR_DAY || DATES.indexOf(CUR_DAY) < 0) CUR_DAY = last;
  sel.innerHTML = recent.map(d=>`<option value="${d}"${d===CUR_DAY?' selected':''}>${fmtD(d)}</option>`).join('');
  $('dayPrev').disabled = DATES.indexOf(CUR_DAY) <= 0;
  $('dayNext').disabled = DATES.indexOf(CUR_DAY) >= DATES.length-1;
}

/* ── what every state drew ── */
function renderDraws(){
  const d = CUR_DAY; if(!d){ $('drawsOut').innerHTML='<div class="empty">No draws yet.</div>'; return; }
  let cnt = 0, cnt4 = 0;
  const only5 = $('drawsOnly').value === 'p5';
  const cell = (c,s) => { if(!STATES[c]) return '<td></td>'; const n = ROWS.get(c+'|'+d+'|'+s);
    if(STATES[c][s] === null) return '<td class="empty" style="font-size:12px">no draw</td>';
    if(!n) return '<td></td>'; cnt++;
    return `<td class="n"><span class="chip" data-look="${n}" style="border:0;padding:0;background:none">${n}</span><span class="tag">${STATES[c].nobox?'exact only':ways(n)+'-way'}</span></td>`; };
  const p4d = P4DAY.get(d) || {};
  const cell4 = (c,s) => { const list = (p4d[c]||[]).filter(x=>x.s===s); if(!list.length) return '<td></td>'; cnt4 += list.length;
    return '<td class="n" style="font-size:15px">' + list.map(x=>{ const t = !!tripDigit(x.n); return `<span class="chip${t?' hot':''}" data-look="${x.n}" style="${t?'':'border:0;padding:0;background:none'}">${x.n}${t?'<small>triple</small>':''}</span>`; }).join('<br>') + '</td>'; };
  const codes = new Set(); for(const c of CODES) if(SEQ[c] && SEQ[c][0].d <= d) codes.add(c);
  if(!only5) for(const c of Object.keys(p4d)) codes.add(c);
  const label = c => STATES[c] ? nm(c) : (P4NAMES[c] || c.toUpperCase());
  const rows = [...codes].sort((a,b)=>label(a).localeCompare(label(b)));
  let h = '<table class="t"><thead><tr><th>State</th><th>Pick 4 Midday / Day</th><th>Pick 4 Evening / Night</th><th>Pick 5 Midday / Day</th><th>Pick 5 Evening / Night</th></tr></thead><tbody>';
  for(const c of rows){
    h += `<tr><td>${esc(label(c))}${STATES[c]?`<div style="color:var(--muted);font-size:12px">${esc(STATES[c].game)}</div>`:''}</td>${cell4(c,'m')}${cell4(c,'e')}${cell(c,'m')}${cell(c,'e')}</tr>`;
  }
  h += '</tbody></table>';
  $('drawsOut').innerHTML = h;
  $('drawsSub').textContent = `${fmtD(d)} · ${cnt} Pick 5 and ${cnt4} Pick 4 draws` + (d === todayCT() ? ' so far' : '');
}

/* ── came-since checks ── */
function cameAfter(c, idx, key){            // first later draw in state c whose box = key
  const sq = SEQ[c]; for(let j=idx+1;j<sq.length;j++) if(srt(sq[j].n)===key) return sq[j]; return null;
}
function cameAnywhereAfter(d, key){
  let best=null;
  for(const c in SEQ) for(const x of SEQ[c]) if(x.d>d && srt(x.n)===key && (!best || x.d<best.d)) best={...x,c};
  return best;
}
function lastBox(key, before){                // most recent draw with this box anywhere (optionally before a date)
  let best=null;
  for(const c in SEQ) for(const x of SEQ[c]) if((!before || x.d<before) && srt(x.n)===key && (!best || x.d>best.d || (x.d===best.d && x.s>best.s))) best={...x,c};
  return best;
}

/* ── Endeavor ── */
function chipFor(key, state, label){
  const st = state ? (state.came ? 'came' : 'open') : '';
  const t = state && state.came ? `came ${nm(state.came.c)} ${slotName(state.came.c,state.came.s)} ${fmtShort(state.came.d)} as ${state.came.n}` : (state ? 'not come yet' : '');
  return `<span class="chip ${st}" data-look="${key}" title="${esc((label||'')+(t?' — '+t:''))}">${key}<small>${ways(key)}w</small>${state?`<span class="mk ${state.came?'x':'ok'}">${state.came?'✕':'✓'}</span>`:''}</span>`;
}
function renderEndeavor(){
  const which = $('endSet').value;
  // your own number
  const v = ($('endBox').value||'').replace(/\D/g,'');
  if(v.length === 5){
    const keys = endeavorKeys(v, which);
    let h = `<div class="play">Endeavor from <b>${v}</b> · ${keys.size} box plays<small>Boxed, any order. $1 box on each = $${keys.size}. A 120-way box pays about $400, 60-way about $800, 30-way about $1,600.</small></div><div class="chips">`;
    for(const [k,label] of keys){ const came = cameAnywhereAfter('0000-00-00', k) && lastBox(k); h += `<span class="chip" data-look="${k}" title="${esc(label)}${came?' — last came '+esc(nm(came.c))+' '+fmtShort(came.d):''}">${k}<small>${ways(k)}w${came?' · last '+fmtShort(came.d):''}</small></span>`; }
    h += '</div>';
    $('endMine').innerHTML = h;
  } else $('endMine').innerHTML = '';
  // each state's last draw (as of the selected day)
  const asOf = CUR_DAY;
  let cards = '';
  for(const c of CODES){
    const sq = SEQ[c]; if(!sq) continue;
    let idx = -1; for(let i=sq.length-1;i>=0;i--) if(sq[i].d <= asOf){ idx=i; break; }
    if(idx<0) continue;
    const src = sq[idx], keys = endeavorKeys(src.n, which);
    let open = 0, chips = '', trav = [], travBoxes = 0;
    for(const [k,label] of keys){
      const came = cameAfter(c, idx, k); if(!came) open++;
      chips += chipFor(k, {came: came ? {...came, c} : null}, label);
      const el = cameElsewhere(c, src, k);
      if(el.length){ travBoxes++; trav.push(`<span class="mono" style="letter-spacing:.06em">${k}</span> → ` + el.map(x=>`${esc(x.c.toUpperCase())} ${esc(slotName(x.c,x.s))} ${fmtShort(x.d)} <span class="mono">(${x.n})</span>`).join(', ')); }
    }
    const travHtml = `<div class="sub-h" style="margin:10px 0 4px;font-size:11.5px">Came in other states · ${travBoxes} of ${keys.size}</div>` +
      (trav.length ? `<div style="font-size:12.5px;line-height:1.55;color:var(--ink-2)">${trav.join('<br>')}</div>` : '<div class="empty" style="font-size:12.5px;padding:0">None yet.</div>');
    cards += `<div class="card"><h3><span>${esc(nm(c))}</span><span class="tag">${open} open · ${travBoxes} traveled</span></h3>
      <div class="from">from ${esc(slotName(c,src.s))} ${fmtShort(src.d)} <b>${src.n}</b></div><div class="chips">${chips}</div>${travHtml}</div>`;
  }
  $('endOut').innerHTML = cards || '<div class="empty">No draws yet.</div>';
  $('endAsOf').textContent = '· as of ' + fmtD(asOf);
}

/* ── Lottery Post methods ── */
const LP_LINES = ['12360','12458','12679','13467','13589','14590','16780','23469','23578','24570','25890','34680','35790','46789'];
const LP_STRINGS = {R2:'5924013867', R4:'2590683471', R6:'6817059324', R8:'7019836245'};
const LP_HOW = {
  rund: 'Add the "Add across" number to the last draw, digit by digit with no carrying, nine times in a row (lakerben\'s "814 rundown" stretched to five digits: +8 1 4 8 1). Each line is played as a box. Change the add-across number to run any rundown you like.',
  proj: 'Each digit of the last draw is moved one step along adobea78\'s four strings (R2 5924013867, R4 2590683471, R6 6817059324, R8 7019836245): once forward, once back. That makes up to 8 boxes.',
  wheel: 'tokecap\'s 14-line covering wheel. Each state card shows the lines that hold the last draw\'s front 4 or back 4 digits (repeats allowed, so 1122336600 is line 12360). A line "comes" when a later draw\'s front 4 or back 4 digits all sit inside it.'
};
const subsetOf = (part, line) => [...new Set(part)].every(d => line.includes(d));
const wheelHit = (n, line) => subsetOf(n.slice(0,4), line) || subsetOf(n.slice(1), line);
function lpKeys(n, which){
  const out = new Map(), base = srt(n);
  if(which === 'rund'){
    let inc = ($('lpInc').value||'').replace(/\D/g,''); if(inc.length !== 5) inc = '81481';
    let cur = n; for(let k=1;k<=9;k++){ cur = addInc(cur, inc, 1); const key = srt(cur); if(key !== base && !out.has(key)) out.set(key, `line ${k} (${cur})`); }
  } else if(which === 'proj'){
    for(const [nmS, s] of Object.entries(LP_STRINGS)) for(const [dir, step] of [['next',1],['back',9]]){
      const p = n.split('').map(d => s[(s.indexOf(d)+step)%10]).join(''), key = srt(p);
      if(key !== base && !out.has(key)) out.set(key, `${nmS} ${dir} (${p})`);
    }
  } else {
    for(const L of LP_LINES){ const f = subsetOf(n.slice(0,4), L), b = subsetOf(n.slice(1), L); if(f||b) out.set(L, f&&b ? 'front 4 and back 4' : f ? 'front 4' : 'back 4'); }
  }
  return out;
}
let LP_LISTS = {};
function lpCopy(text){
  const done = () => { $('lpCopied').textContent = 'Copied'; setTimeout(()=>{ $('lpCopied').textContent=''; }, 2000); };
  try{ navigator.clipboard.writeText(text).then(done, ()=>fallback()); }catch(e){ fallback(); }
  function fallback(){ const t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); try{ document.execCommand('copy'); done(); }catch(e){} t.remove(); }
}
function renderLP(){
  const which = $('lpSet').value, asOf = CUR_DAY;
  $('lpIncWrap').hidden = which !== 'rund';
  $('lpHow').textContent = LP_HOW[which];
  $('lpTop').innerHTML = which === 'wheel'
    ? `<div class="sub-h">The 14 lines</div><div class="chips" style="margin-bottom:12px">${LP_LINES.map(L=>`<span class="chip" data-look="${srt(L)}">${L}</span>`).join('')} <button class="btn" type="button" data-lpcopy="__lines">Copy the 14 lines</button></div><div class="sub-h">Lines each state's last draw fell in</div>`
    : '';
  LP_LISTS = {__lines: LP_LINES.join(' ')};
  let cards = '';
  for(const c of CODES){
    const sq = SEQ[c]; if(!sq) continue;
    let idx = -1; for(let i=sq.length-1;i>=0;i--) if(sq[i].d <= asOf){ idx=i; break; } if(idx<0) continue;
    const src = sq[idx], keys = lpKeys(src.n, which);
    let open = 0, chips = '';
    for(const [k,label] of keys){
      let came = null;
      for(let j=idx+1;j<sq.length;j++){ if(which==='wheel' ? wheelHit(sq[j].n, k) : srt(sq[j].n)===k){ came = {...sq[j], c}; break; } }
      if(!came) open++;
      if(which==='wheel'){
        const t = came ? `came ${slotName(c,came.s)} ${fmtShort(came.d)} as ${came.n}` : 'not come yet';
        chips += `<span class="chip ${came?'came':'open'}" data-look="${srt(k)}" title="${esc(label+' — '+t)}">${k}<small>${esc(label)}</small><span class="mk ${came?'x':'ok'}">${came?'✕':'✓'}</span></span>`;
      } else chips += chipFor(k, {came}, label);
    }
    LP_LISTS[c] = [...keys.keys()].join(' ');
    cards += `<div class="card"><h3><span>${esc(nm(c))}</span><span class="tag">${keys.size ? open+' open' : 'none'}</span></h3>
      <div class="from">from ${esc(slotName(c,src.s))} ${fmtShort(src.d)} <b>${src.n}</b></div>
      ${keys.size ? `<div class="chips">${chips}</div><button class="btn" type="button" data-lpcopy="${c}" style="margin-top:8px;font-size:12px;padding:3px 9px">Copy</button>` : '<div class="empty" style="font-size:13px">Front 4 and back 4 are not inside any line.</div>'}</div>`;
  }
  $('lpOut').innerHTML = cards || '<div class="empty">No draws yet.</div>';
}

/* ── play log (owner-only db: spend, spendcfg) ── */
const LOG = {db:null, rows:[], budget:null, ready:false, all:false};
const money = v => (v<0?'−':'')+'$'+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const toAmt = s => { const v = parseFloat(String(s||'').replace(/[$,\s]/g,'')); return isFinite(v) && v>=0 ? Math.round(v*100)/100 : null; };
function renderLog(){
  if(!LOG.ready){ $('logTiles').innerHTML = ''; $('logOut').innerHTML = `<div class="empty">${LOG.db===false ? 'Open this dashboard while signed in to Claude to keep your play log.' : 'Loading your log…'}</div>`; $('logForm').hidden = $('lgBudgetRow').hidden = LOG.db===false; return; }
  $('logForm').hidden = $('lgBudgetRow').hidden = false;
  const rows = LOG.rows, month = todayCT().slice(0,7);
  const sum = (rs,k) => rs.reduce((a,r)=>a+(+r[k]||0),0);
  const sp = sum(rows,'spent'), wn = sum(rows,'won'), net = wn-sp;
  const mRows = rows.filter(r=>(r.date||'').startsWith(month)), mSp = sum(mRows,'spent'), mWn = sum(mRows,'won');
  const b = LOG.budget;
  const left = b ? b - mSp : null;
  $('logTiles').innerHTML = `<div class="tiles">
    <div class="tile"><div class="k">This month spent</div><div class="v">${money(mSp)}</div><div class="k">${b?`of ${money(b)} budget · ${left>=0?money(left)+' left':'<b style="color:var(--bad)">'+money(-left)+' over</b>'}`:'no budget set'}</div></div>
    <div class="tile"><div class="k">This month won</div><div class="v">${money(mWn)}</div><div class="k">net ${money(mWn-mSp)}</div></div>
    <div class="tile"><div class="k">All-time net</div><div class="v" style="color:${net>=0?'var(--good)':'var(--bad)'}">${money(net)}</div><div class="k">${money(wn)} won on ${money(sp)} spent</div></div>
    <div class="tile"><div class="k">Expected back so far</div><div class="v">${money(sp*0.5)}</div><div class="k">about 50¢ per $1 on average</div></div>
  </div>`;
  if(b){ const pct = Math.min(100, Math.round(100*mSp/b)); $('logTiles').innerHTML += `<div style="height:8px;border-radius:4px;background:var(--bg);border:1px solid var(--line);margin:-2px 0 12px;max-width:560px" role="img" aria-label="${pct}% of monthly budget used"><div style="height:100%;width:${pct}%;border-radius:4px;background:${mSp>b?'var(--bad)':mSp>0.8*b?'var(--warn)':'var(--good)'}"></div></div>`; }
  if(!rows.length){ $('logOut').innerHTML = '<div class="empty">No plays logged yet. Add one above.</div>'; return; }
  const show = LOG.all ? rows : rows.slice(0,20);
  let h = '<div class="tw"><table class="t"><thead><tr><th>Date</th><th>State</th><th>Played</th><th>Spent</th><th>Won</th><th></th></tr></thead><tbody>'+
    show.map(r=>`<tr><td>${r.date?fmtD(r.date):''}</td><td>${r.state?esc(nm(r.state)):''}</td><td>${esc(r.note||'')}</td><td class="num">${money(+r.spent||0)}</td><td class="num" style="${(+r.won||0)>0?'color:var(--good);font-weight:600':''}">${money(+r.won||0)}</td><td><button class="btn" type="button" data-logdel="${esc(r.id)}" aria-label="Delete this entry" style="padding:2px 8px">✕</button></td></tr>`).join('')+'</tbody></table></div>';
  if(rows.length>20) h += `<button class="btn" type="button" id="lgAll" style="margin-top:8px">${LOG.all?'Show fewer':'Show all '+rows.length}</button>`;
  $('logOut').innerHTML = h;
}
/* Standalone: the play log lives in this browser (localStorage), not a server database.
   Copy log / Paste log move it between devices. */
const LOGKEY = 'playlog_v1';
function logLoad(){ const v = store(LOGKEY) || {}; LOG.rows = Array.isArray(v.rows) ? v.rows : []; LOG.budget = (typeof v.budget==='number' && v.budget>0) ? v.budget : null;
  LOG.rows.sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b.at||0)-(a.at||0)); }
function logSave(){ store(LOGKEY, {rows: LOG.rows, budget: LOG.budget}); }
function logMsg(t, ok){ $('lgMsg').style.color = ok ? 'var(--good)' : 'var(--bad)'; $('lgMsg').textContent = t; if(ok) setTimeout(()=>{ $('lgMsg').textContent=''; }, 2500); }
async function startLog(){
  $('lgDate').value = todayCT();
  $('lgState').innerHTML = '<option value="">Any</option>' + CODES.map(c=>`<option value="${c}">${esc(nm(c))}</option>`).join('');
  LOG.db = 'local'; logLoad(); LOG.ready = true;
  if(document.activeElement !== $('lgBudget')) $('lgBudget').value = LOG.budget ? LOG.budget : '';
  if(!$('lgCopy')){
    $('lgBudgetRow').insertAdjacentHTML('beforeend', '<button class="btn" type="button" id="lgCopy">Copy log</button> <button class="btn" type="button" id="lgPaste">Paste log</button>');
    $('lgCopy').addEventListener('click', ()=>{ const t = JSON.stringify({rows: LOG.rows, budget: LOG.budget});
      const ok = ()=> logMsg('Log copied. Open the dashboard on your other device and use Paste log.', true);
      try{ navigator.clipboard.writeText(t).then(ok, ()=> window.prompt('Copy this text:', t)); }catch(e){ window.prompt('Copy this text:', t); } });
    $('lgPaste').addEventListener('click', ()=>{ const t = window.prompt('Paste the text from Copy log. Entries already here are kept.'); if(!t) return;
      try{ const v = JSON.parse(t), have = new Set(LOG.rows.map(r=>r.id)); let n = 0;
        (v.rows||[]).forEach(r=>{ if(r && r.id && !have.has(r.id) && /^\d{4}-\d{2}-\d{2}$/.test(r.date||'')){ LOG.rows.push({id:String(r.id), date:r.date, state:String(r.state||''), note:String(r.note||'').slice(0,80), spent:+r.spent||0, won:+r.won||0, at:+r.at||Date.now()}); n++; } });
        if(typeof v.budget==='number' && v.budget>0 && !LOG.budget) LOG.budget = v.budget;
        logSave(); logLoad(); renderLog(); logMsg(n+' entries added', true);
      }catch(e){ logMsg('That text was not a play log.', false); } });
  }
  renderLog();
}
$('logForm').addEventListener('submit', e=>{
  e.preventDefault();
  const spent = toAmt($('lgSpent').value) ?? 0, won = toAmt($('lgWon').value) ?? 0;
  const date = $('lgDate').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || (spent===0 && won===0)){ logMsg('Enter a date and an amount spent or won.', false); return; }
  LOG.rows.push({id: date+'-'+Date.now().toString(36), date, state:$('lgState').value||'', note:($('lgNote').value||'').trim().slice(0,80), spent, won, at:Date.now()});
  logSave(); logLoad(); renderLog();
  $('lgSpent').value=''; $('lgWon').value=''; $('lgNote').value='';
  logMsg('Added', true);
});
$('lgBudgetSave').addEventListener('click', ()=>{
  const v = toAmt($('lgBudget').value); LOG.budget = v || null; logSave(); renderLog();
  logMsg(v ? 'Budget saved' : 'Budget cleared', true);
});
$('logOut').addEventListener('click', e=>{
  const all = e.target.closest('#lgAll'); if(all){ LOG.all=!LOG.all; renderLog(); return; }
  const del = e.target.closest('[data-logdel]'); if(!del) return;
  LOG.rows = LOG.rows.filter(r => r.id !== del.dataset.logdel); logSave(); renderLog();
});

/* ── Pick 4 → Pick 5 triggers ── */
const P4NAMES = {ac:'Atlantic Canada',ar:'Arkansas',az:'Arizona',ca:'California',ct:'Connecticut',dc:'Washington DC',de:'Delaware',fl:'Florida',ga:'Georgia',ia:'Iowa',id:'Idaho',il:'Illinois',in:'Indiana',ky:'Kentucky',la:'Louisiana',ma:'Massachusetts',md:'Maryland',mi:'Michigan',mo:'Missouri',ms:'Mississippi',nc:'North Carolina',ne:'Nebraska',nj:'New Jersey',nm:'New Mexico',ny:'New York',oh:'Ohio',on:'Ontario',or:'Oregon',pa:'Pennsylvania',pr:'Puerto Rico',qc:'Quebec',ri:'Rhode Island',sc:'South Carolina',tn:'Tennessee',tx:'Texas',va:'Virginia',wc:'Western Canada',wi:'Wisconsin',wv:'West Virginia',xx:'Tri-State (ME/NH/VT)'};
const P4TRIP = new Map();
const P4DAY = new Map();      // date -> {code: [{n,s}]}
function setP4Day(d, c, list){ if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return; const ok = list.filter(x=>/^\d{4}$/.test(x.n)); if(!ok.length) return; if(!P4DAY.has(d)) P4DAY.set(d, {}); P4DAY.get(d)[c] = ok; ok.forEach(x=>addP4(c, d, x.s, x.n)); }     // "c|date|slot|n" -> {c,d,s,n}
const TRIG_START = '2026-10-14';
function addP4(c, d, s, n){
  if(!/^\d{4}$/.test(n) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
  const cnt = {}; for(const x of n) cnt[x] = (cnt[x]||0)+1;
  if(Math.max(...Object.values(cnt)) < 3) return;
  P4TRIP.set(c+'|'+d+'|'+s+'|'+n, {c, d, s: s==='m'?'m':'e', n});
}
const tripDigit = n => { const cnt={}; for(const x of n) cnt[x]=(cnt[x]||0)+1; return Object.keys(cnt).find(k=>cnt[k]>=3); };
const coverFor = x => { const out=[]; for(let a=0;a<10;a++) for(let b=a;b<10;b++) out.push(x+x+x+a+b); return out; };
const P3X = 0.00856;          // chance a Pick 5 draw has 3+ of a given digit
function trigFollow(e){
  const X = tripDigit(e.n), d0 = dnum(e.d), last = DATES.length ? dnum(DATES[DATES.length-1]) : d0;
  const hits = [], fol = []; let draws = 0;
  for(const c in SEQ) for(const x of SEQ[c]){ const k = dnum(x.d); if(k > d0 && k <= d0+7){ draws++; if(x.n.split(X).length-1 >= 3) hits.push({...x, c}); } }
  hits.sort((a,b)=> a.d<b.d?-1:a.d>b.d?1:0);
  return {X, hits, draws, exp: P3X*draws, daysIn: Math.max(0, Math.min(7, last - d0)), done: last - d0 >= 7};
}
function renderTrig(){
  const win = +$('trWin').value, only = $('trOnly').value;
  const lastD = DATES[DATES.length-1] || todayCT();
  const from = dnum(lastD) - win;
  let ev = [...P4TRIP.values()].filter(e => dnum(e.d) > from && (!only || STATES[e.c]));
  ev.sort((a,b)=> a.d<b.d?1:a.d>b.d?-1:(a.s===b.s?0:a.s==='e'?-1:1));
  // live forward count since TRIG_START (finished weeks only)
  let fh=0, fe=0, fs=0, fse=0, fn=0;
  for(const e of P4TRIP.values()){ if(e.d < TRIG_START) continue; const f = trigFollow(e); if(!f.done) continue; fn++; fh += f.hits.length; fe += f.exp;
    if(STATES[e.c]){ const sd = SEQ[e.c]||[]; const d0=dnum(e.d); const w = sd.filter(x=>{const k=dnum(x.d); return k>d0&&k<=d0+7;}); fs += w.filter(x=>x.n.split(f.X).length-1>=3).length; fse += P3X*w.length; } }
  $('trTiles').innerHTML = `<div class="tiles">
    <div class="tile"><div class="k">Pick 4 triples shown</div><div class="v">${ev.length}</div><div class="k">${only?'Pick 5 states only':'all Pick 4 states'}</div></div>
    <div class="tile"><div class="k">Live test since Oct 14: any Pick 5 state</div><div class="v">${fh} / ${fe.toFixed(1)}</div><div class="k">${fn} finished weeks · came vs random</div></div>
    <div class="tile"><div class="k">Live test: same state's Pick 5</div><div class="v">${fs} / ${fse.toFixed(1)}</div><div class="k">the one to watch (backtest 1.24×)</div></div>
  </div>`;
  if(!ev.length){ $('trOut').innerHTML = '<div class="empty">No Pick 4 triples in this window yet.</div>'; }
  else {
    let h = '<table class="t"><thead><tr><th>Date</th><th>Pick 4 state</th><th>Number</th><th>Pick 5 with three+ of that digit, next 7 days</th><th></th></tr></thead><tbody>';
    for(const e of ev){
      const f = trigFollow(e);
      const status = f.hits.length
        ? f.hits.map(x=>`<span class="mono" style="letter-spacing:.06em;${x.c===e.c?'color:var(--accent);font-weight:600':''}">${x.n}</span> ${esc(x.c.toUpperCase())} ${esc(slotName(x.c,x.s))} ${fmtShort(x.d)}${x.c===e.c?' <span class="tag">same state</span>':''}`).join('<br>')
        : (f.done ? '<span style="color:var(--muted)">none in 7 days</span>' : `<span style="color:var(--muted)">none yet · ${f.daysIn} of 7 days</span>`);
      h += `<tr><td>${fmtShort(e.d)}</td><td>${esc(P4NAMES[e.c]||e.c.toUpperCase())} ${e.s==='m'?'Midday':'Evening'}</td><td class="n">${e.n}</td><td style="font-size:13px">${status}</td><td><button class="btn" type="button" data-trcopy="${f.X}" style="font-size:12px;padding:3px 9px">Copy 55 (${f.X}${f.X}${f.X}xx)</button></td></tr>`;
    }
    $('trOut').innerHTML = h + '</tbody></table>';
  }
  $('trBack').innerHTML = '<table class="t"><thead><tr><th>Check (Jan 2024 – Oct 13, 2026)</th><th>Came</th><th>Random</th><th>Ratio</th><th>Other digits, same days</th></tr></thead><tbody>' +
    [['Any of the 10 Pick 5 states, next day','379','375.3','1.01','1.01'],
     ['Any Pick 5 state, next 3 days','1,174','1,124.7','1.04','1.02'],
     ['Any Pick 5 state, next 7 days','2,720','2,618.4','1.04','1.02'],
     ['Same state\'s Pick 5, next 7 days','105','84.4','1.24','1.02'],
     ['DC-4 → DC-5, next 7 days','20','15.3','1.30','—'],
     ['Pick 4 number inside a Pick 5 (any order), next 3 days','26,595','26,518.3','1.00','—']]
    .map(r=>`<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td><td class="num">${r[4]}</td></tr>`).join('') +
    '</tbody></table><div class="note" style="margin-top:6px">Tested on 71,928 Pick 4 draws (35 states, DC and Puerto Rico) against 16,910 Pick 5 draws. Any state: Pick 5 had slightly more triples of every digit during these stretches, so the trigger digit\'s small edge mostly goes away. Same state: 1.24×, and shifting the Pick 4 dates to random other times beat that only 1.5% of the time. But it was 1.30 in 2024, 1.00 in 2025 and 1.46 in 2026, and dozens of tests were run, so it is not proven. The live test above will show whether it holds. Even at 1.24×, covering the triple pays back about 62¢ per $1.</div>';
}
document.addEventListener('click', e=>{ const b = e.target.closest('[data-trcopy]'); if(!b) return; const x=b.dataset.trcopy; const t=coverFor(x).join(' ');
  const done=()=>{ $('trCopied').textContent=`Copied the 55 ${x}${x}${x}xx boxes`; setTimeout(()=>{$('trCopied').textContent='';},2500); };
  try{ navigator.clipboard.writeText(t).then(done, ()=>fb()); }catch(err){ fb(); }
  function fb(){ const a=document.createElement('textarea'); a.value=t; document.body.appendChild(a); a.select(); try{document.execCommand('copy'); done();}catch(er){} a.remove(); } });

/* ── 10-way sequence watch ── */
function assocBoxes(n){
  const out = new Map(), base = srt(n);
  const put = (k, l) => { if(k === base) return; if(!out.has(k)) out.set(k, new Set()); out.get(k).add(l); };
  for(const [label, inc] of Object.entries(RUNDOWNS)){
    const steps = inc === '01123' ? END_STEPS : [1,2,3,4,5,6,7,8,9];
    const short = inc === '01123' ? 'Endeavor' : '+' + inc.split('').join(' ');
    for(const k of steps) put(srt(addInc(base, inc, k)), short);
  }
  put(srt(mirror(n)), 'Mirror');
  let cur = n; for(let k=0;k<9;k++){ cur = addInc(cur, '81481', 1); put(srt(cur), '814 rundown'); }
  for(const s of Object.values(LP_STRINGS)) for(const step of [1,9]) put(srt(n.split('').map(d => s[(s.indexOf(d)+step)%10]).join('')), 'Projection');
  return out;
}
let SEQ_CACHE = {key:null, rows:null};
function seqRows(since){
  const ck = since + '|' + DATES.length + '|' + (DATES[DATES.length-1]||'');
  if(SEQ_CACHE.key === ck) return SEQ_CACHE.rows;
  const ALL = [];
  for(const c in SEQ) for(const x of SEQ[c]) ALL.push({c, d:x.d, s:x.s, n:x.n, b:srt(x.n), t: dnum(x.d)*2 + (x.s==='e'?1:0)});
  ALL.sort((a,b)=>a.t-b.t);
  const T = ALL.map(x=>x.t), LAST = T[T.length-1];
  const lo = v => { let a=0,b=T.length; while(a<b){ const m=(a+b)>>1; if(T[m]<v) a=m+1; else b=m; } return a; };
  const hi = v => { let a=0,b=T.length; while(a<b){ const m=(a+b)>>1; if(T[m]<=v) a=m+1; else b=m; } return a; };
  const rows = [];
  for(let i=0;i<ALL.length;i++){
    const h = ALL[i]; if(h.d < since || ways(h.b) !== 10) continue;
    const m = assocBoxes(h.n); let p = 0; for(const k of m.keys()) p += ways(k)/1e5;
    const day = dnum(h.d), endT = (day+7)*2+1;
    const bef = ALL.slice(lo((day-7)*2), lo(h.t)), aft = ALL.slice(hi(h.t), hi(endT));
    const bh = bef.filter(x=>m.has(x.b)).map(x=>({...x, why:[...m.get(x.b)].join(', ')}));
    const ah = aft.filter(x=>m.has(x.b)).map(x=>({...x, why:[...m.get(x.b)].join(', ')}));
    rows.push({h, size:m.size, b:bh, be:p*bef.length, a:ah, ae:p*aft.length, full: endT <= LAST, daysIn: Math.min(7, Math.max(0, Math.floor(LAST/2) - day))});
  }
  SEQ_CACHE = {key:ck, rows};
  return rows;
}
function renderSeq(){
  const rows = seqRows($('seqSince').value);
  if(!rows.length){ $('seqTiles').innerHTML=''; $('seqOut').innerHTML='<div class="empty">No 10-way hits in this range.</div>'; return; }
  const full = rows.filter(r=>r.full);
  const sum = (rs,f) => rs.reduce((a,r)=>a+f(r),0);
  const B = sum(rows,r=>r.b.length), BE = sum(rows,r=>r.be), A = sum(full,r=>r.a.length), AE = sum(full,r=>r.ae);
  const busy = full.filter(r=>r.b.length >= r.be+2), bA = sum(busy,r=>r.a.length), bAE = sum(busy,r=>r.ae);
  const xs = full.map(r=>r.b.length-r.be), ys = full.map(r=>r.a.length-r.ae);
  const mean = v => v.reduce((a,b)=>a+b,0)/Math.max(1,v.length), mx = mean(xs), my = mean(ys);
  let cov=0, vx=0, vy=0; xs.forEach((x,i)=>{ cov+=(x-mx)*(ys[i]-my); vx+=(x-mx)**2; vy+=(ys[i]-my)**2; });
  const corr = vx&&vy ? cov/Math.sqrt(vx*vy) : 0;
  const ratio = (a,e) => e ? (a/e).toFixed(2) : '—';
  $('seqTiles').innerHTML = `<div class="tiles">
    <div class="tile"><div class="k">10-way hits</div><div class="v">${rows.length}</div><div class="k">${rows.length-full.length} still inside their week after</div></div>
    <div class="tile"><div class="k">Week before: came vs random</div><div class="v">${B} / ${BE.toFixed(1)}</div><div class="k">ratio ${ratio(B,BE)}</div></div>
    <div class="tile"><div class="k">Week after: came vs random</div><div class="v">${A} / ${AE.toFixed(1)}</div><div class="k">ratio ${ratio(A,AE)}</div></div>
    <div class="tile"><div class="k">After a busy week before</div><div class="v">${bA} / ${bAE.toFixed(1)}</div><div class="k">${busy.length} hits · ratio ${ratio(bA,bAE)}</div></div>
    <div class="tile"><div class="k">Before ↔ after link</div><div class="v">${corr>=0?'+':''}${corr.toFixed(2)}</div><div class="k">0 = no link · 1 = busy before always means busy after</div></div>
  </div>`;
  const cell = (n,e,partial) => { const hot = n >= e+2, cold = n === 0 && e >= 2; return `<td class="num" style="${hot?'color:var(--accent);font-weight:600':cold?'color:var(--muted)':''}">${n}<span style="color:var(--muted);font-weight:400"> / ${e.toFixed(1)}</span>${partial?`<span class="tag">${partial}</span>`:''}</td>`; };
  const list = arr => arr.length ? arr.map(x=>`<span class="mono">${x.b}</span> ← ${esc(x.c.toUpperCase())} ${esc(slotName(x.c,x.s))} ${fmtShort(x.d)} <span class="mono">(${x.n})</span> <span style="color:var(--muted)">${esc(x.why)}</span>`).join('<br>') : '<span style="color:var(--muted)">none</span>';
  let h = '<table class="t"><thead><tr><th>Date</th><th>State</th><th>Number</th><th>Before</th><th>After</th></tr></thead><tbody>';
  for(const r of rows.slice().reverse()){
    const id = 'sq'+r.h.c+r.h.t;
    h += `<tr data-seqrow="${id}" style="cursor:pointer"><td>${fmtShort(r.h.d)}, ${r.h.d.slice(0,4)}</td><td>${esc(nm(r.h.c))} ${esc(slotName(r.h.c,r.h.s))}</td><td class="n">${r.h.n}</td>${cell(r.b.length,r.be)}${cell(r.a.length,r.ae, r.full?'':`${r.daysIn} of 7 days`)}</tr>
      <tr id="${id}" hidden><td colspan="5" style="font-size:12.5px;line-height:1.55;background:var(--bg)"><b>Week before</b><br>${list(r.b)}<br><b>Week after</b><br>${list(r.a)}<br><span style="color:var(--muted)">${r.size} associated boxes</span></td></tr>`;
  }
  $('seqOut').innerHTML = h + '</tbody></table>';
}

/* ── scoreboard ── */
let SCORE_CACHE = null;
function renderScore(){
  if(!SCORE_CACHE){
    let hits=0, exp=0, n=0, spent=0, won=0; const recent=[]; let fwdH=0, fwdE=0, fwdN=0;
    for(const c in SEQ){
      const sq = SEQ[c];
      for(let i=0;i<sq.length-1;i++){
        let j=-1; for(let k=i+1;k<Math.min(i+3,sq.length);k++) if(sq[k].s===sq[i].s){ j=k; break; }
        if(j<0) continue;
        const keys = [...endeavorKeys(sq[i].n,'end').keys()];
        const cov = keys.reduce((a,k)=>a+ways(k),0)/1e5;
        const key = srt(sq[j].n), h = keys.includes(key);
        n++; exp+=cov; hits+=h;
        if(!STATES[c].nobox){ spent += keys.length; if(h) won += PAY[ways(key)]; }
        if(HIST_THROUGH && sq[j].d > HIST_THROUGH){ fwdN++; fwdE+=cov; fwdH+=h; }
        if(h) recent.push({c, from:sq[i], hit:sq[j]});
      }
    }
    recent.sort((a,b)=> a.hit.d<b.hit.d?1:-1);
    SCORE_CACHE = {hits,exp,n,spent,won,recent,fwdH,fwdE,fwdN};
  }
  const S = SCORE_CACHE;
  let h = `<div class="tiles">
    <div class="tile"><div class="k">Draws graded</div><div class="v">${S.n.toLocaleString()}</div></div>
    <div class="tile"><div class="k">Endeavor box hits</div><div class="v">${S.hits}</div></div>
    <div class="tile"><div class="k">Random picks would get</div><div class="v">${S.exp.toFixed(1)}</div></div>
    <div class="tile"><div class="k">$1 on all 8 every draw</div><div class="v">${Math.round(100*S.won/Math.max(1,S.spent))}%</div><div class="k">paid back ($${S.won.toLocaleString()} on $${S.spent.toLocaleString()})</div></div>
  </div>`;
  h += `<div class="note" style="margin-top:0">Each state's 8 Endeavor boxes are worked from one draw and graded on that state's next draw in the same slot (midday to midday, evening to evening). New draws keep adding to this count${HIST_THROUGH?` — since ${fmtShort(HIST_THROUGH)}: ${S.fwdH} hits on ${S.fwdN} draws, random picks ${S.fwdE.toFixed(1)}`:''}.</div>`;
  h += '<div class="sub-h">Latest Endeavor hits</div><div class="tw"><table class="t"><thead><tr><th>Date</th><th>State</th><th>Worked from</th><th>Came</th><th>Box</th></tr></thead><tbody>';
  h += S.recent.slice(0,12).map(r=>`<tr><td>${fmtD(r.hit.d)}</td><td>${esc(nm(r.c))} ${esc(slotName(r.c,r.hit.s))}</td><td class="n">${r.from.n}</td><td class="n">${r.hit.n}</td><td>${ways(srt(r.hit.n))}-way${STATES[r.c].nobox?' (no box bet in GA)':''}</td></tr>`).join('');
  h += '</tbody></table></div>';
  $('scoreOut').innerHTML = h;
}

/* ── convergence ── */
function renderConv(){
  const asOf = CUR_DAY; const tally = new Map();
  const srcs = { ...RUNDOWNS, 'Mirror':null, 'Rundown 67867':'67867', 'Rundown 34534':'34534' };
  for(const c of CODES){
    const sq = SEQ[c]; if(!sq) continue;
    let idx=-1; for(let i=sq.length-1;i>=0;i--) if(sq[i].d<=asOf){ idx=i; break; } if(idx<0) continue;
    const n = sq[idx].n, base = srt(n);
    const add = (key, label) => { if(key===base) return; const t = tally.get(key) || {methods:new Set(), states:new Set()}; t.methods.add(label); t.states.add(c); tally.set(key,t); };
    for(const [label, inc] of Object.entries(srcs)){
      if(label==='Mirror'){ add(srt(mirror(n)), label); continue; }
      const steps = inc==='01123' ? END_STEPS : [1,2,3,4,5,6,7,8,9];
      const from = (label.startsWith('Rundown')) ? n : base;
      for(const k of steps) add(srt(addInc(from, inc, k)), label);
    }
  }
  const top = [...tally.entries()].map(([k,t])=>({k, m:t.methods.size, s:t.states.size, t}))
    .filter(x=>x.m+x.s>=3).sort((a,b)=> (b.m+b.s)-(a.m+a.s) || a.k.localeCompare(b.k)).slice(0,24);
  if(!top.length){ $('convOut').innerHTML='<div class="empty">Nothing lines up across methods today.</div>'; return; }
  let h = '<div class="chips">';
  for(const x of top){
    const L = cameAnywhereAfter(asOf, x.k);
    h += `<span class="chip ${L?'came':(x.m+x.s>=4?'hot':'')}" data-look="${x.k}" title="${esc([...x.t.methods].join(', ')+' · from '+[...x.t.states].map(nm).join(', '))}">${x.k}<small>${x.m} methods · ${x.s} states</small></span>`;
  }
  const came = top.map(x=>({k:x.k, a:(BOXIDX.get(x.k)||[]).filter(d=>d.d>asOf)})).filter(x=>x.a.length);
  h += `</div><div class="sub-h" style="margin:12px 0 4px;font-size:11.5px">Came since ${fmtShort(asOf)}, any state · ${came.length} of ${top.length}</div>` +
    (came.length ? `<div style="font-size:12.5px;line-height:1.55;color:var(--ink-2)">${came.map(x=>`<span class="mono" style="letter-spacing:.06em">${x.k}</span> → `+x.a.map(d=>`${esc(d.c.toUpperCase())} ${esc(slotName(d.c,d.s))} ${fmtShort(d.d)} <span class="mono">(${d.n})</span>`).join(', ')).join('<br>')}</div>` : '<div class="empty" style="font-size:12.5px;padding:0">None yet.</div>');
  h += '<div class="note">Boxes produced by more than one rundown, or by the same rundown from more than one state\'s last draw. Hover a number for the sources. Lining up does not raise the odds: in testing, boxes picked this way came at the same rate as random boxes.</div>';
  $('convOut').innerHTML = h;
}

/* ── straight finder ── */
function renderSF(){
  const v = ($('sfBox').value||'').replace(/\D/g,'');
  if(v.length !== 5){ $('sfOut').innerHTML = '<div class="empty">Type a five-digit number.</div>'; return; }
  const slot = $('sfSlot').value, only = $('sfState').value;
  const P = perms(v), key = srt(v), today = dnum(todayCT());
  const hits = [];
  for(const c in SEQ){ if(only && c!==only) continue;
    for(const x of SEQ[c]) if((slot==='b'||x.s===slot) && srt(x.n)===key) hits.push({...x,c}); }
  hits.sort((a,b)=> a.d<b.d?1:a.d>b.d?-1:0);
  const byWay = {}; for(const p of P) byWay[p] = {p, last:null, times:0};
  for(const x of hits){ const w = byWay[x.n]; if(w){ w.times++; if(!w.last) w.last = x; } }
  let first = null; for(const c in SEQ){ if(only && c!==only) continue; if(SEQ[c].length && (!first || SEQ[c][0].d<first)) first = SEQ[c][0].d; }
  const rows = Object.values(byWay).sort((a,b)=> (a.last?a.last.d:'0') < (b.last?b.last.d:'0') ? -1 : (a.last?a.last.d:'0') > (b.last?b.last.d:'0') ? 1 : a.p.localeCompare(b.p));
  const never = rows.filter(r=>!r.last).length;
  const w = ways(key);
  let h = `<div class="play">${v} is a <b style="font-size:16px">${w}-way</b> number — ${P.length} straight way${P.length>1?'s':''}<small>Straight pays $50,000 per $1 (1 in 100,000). Box pays about $${PAY[w].toLocaleString()} per $1 (1 in ${Math.round(1e5/w).toLocaleString()}). ${never} of the ${P.length} ways have not come in this history (since ${first?fmtD(first):'—'}).</small></div>`;
  const show = EXPAND.sf ? rows : rows.slice(0,15);
  h += '<div class="tw"><table class="t"><thead><tr><th>Straight</th><th>Last came</th><th>State</th><th>Days out</th><th>Times</th></tr></thead><tbody>';
  h += show.map((r,i)=>`<tr class="${i===0?'top':''}"><td class="n">${r.p}</td><td>${r.last?fmtD(r.last.d)+' · '+esc(slotName(r.last.c,r.last.s)):'<i>not in history</i>'}</td><td>${r.last?esc(nm(r.last.c)):''}</td><td class="num">${r.last? today-dnum(r.last.d) : '—'}</td><td class="num">${r.times}</td></tr>`).join('');
  h += '</tbody></table></div>';
  if(rows.length>15) h += `<button class="btn" type="button" data-expand="sf" style="margin-top:8px">${EXPAND.sf?'Show fewer':'Show all '+rows.length+' ways'}</button>`;
  h += `<div class="sub-h">Every time it came, any order — ${hits.length}</div>`;
  h += hits.length ? '<div class="tw"><table class="t"><thead><tr><th>Date</th><th>State</th><th>Draw</th><th>Result</th></tr></thead><tbody>'+
    hits.slice(0,60).map(x=>`<tr><td>${fmtD(x.d)}</td><td>${esc(nm(x.c))}</td><td>${esc(slotName(x.c,x.s))}</td><td class="n">${x.n.split('').join('-')}</td></tr>`).join('')+'</tbody></table></div>'
    : '<div class="empty">This box has not come in the loaded history.</div>';
  $('sfOut').innerHTML = h;
}

/* ── pairs out ── */
function renderPairs(){
  const c = $('prState').value, mode = $('prMode').value, sq = SEQ[c];
  if(!sq){ $('prOut').innerHTML='<div class="empty">No draws for this state.</div>'; return; }
  const last = {}; const N = sq.length;
  sq.forEach((x,i)=>{
    if(mode==='f') last[x.n.slice(0,2)] = i;
    else if(mode==='b') last[x.n.slice(3)] = i;
    else { const ds=x.n.split(''); for(let a=0;a<5;a++) for(let b=a+1;b<5;b++){ const k=[ds[a],ds[b]].sort().join(''); last[k]=i; } }
  });
  const cells = []; for(let i=0;i<100;i++){ const p=String(i).padStart(2,'0'); if(mode==='a' && p[0]>p[1]) { cells.push(null); continue; } cells.push({p, out: last[p]===undefined ? N : N-1-last[p]}); }
  const real = cells.filter(Boolean).sort((a,b)=>b.out-a.out);
  const t1 = real[Math.min(9,real.length-1)].out, t2 = real[Math.min(29,real.length-1)].out;
  const avg = mode==='a' ? null : 100;
  let h = '<div class="pgrid">'+cells.map(x=> x ? `<div class="pc ${x.out>=t1?'l3':x.out>=t2?'l2':x.out>=(avg||60)?'l1':''}" title="${x.p}: ${x.out} draws since it last came">${x.p}<small>${x.out}</small></div>` : '<div></div>').join('')+'</div>';
  h += `<div class="legend"><span><i style="background:var(--accent)"></i>10 longest out</span><span><i style="background:var(--accent-soft)"></i>next 20</span>${avg?'<span><i style="background:var(--warn-soft)"></i>past the average gap of 100 draws</span>':''}</div>`;
  h += `<div class="note">${esc(nm(c))}, ${N.toLocaleString()} draws loaded. Each cell is a pair and the number of draws since it last came. ${mode==='a'?'Any two digits anywhere in the number, any order.':'A front or back pair comes once every 100 draws on average.'} PA, OH, DC, LA, MD and DE sell Front/Back Pair bets ($50 per $1). A pair that is far out is no more likely to come next draw than any other.</div>`;
  $('prOut').innerHTML = h;
}

/* ── lookup ── */
function renderLook(){
  const v = ($('lkBox').value||'').replace(/\D/g,'');
  if(v.length<3){ $('lkOut').innerHTML='<div class="empty">Type 3, 4 or 5 digits.</div>'; return; }
  let h = '';
  if(v.length===5){
    const key = srt(v), hits=[];
    for(const c in SEQ) for(const x of SEQ[c]) if(srt(x.n)===key) hits.push({...x,c});
    hits.sort((a,b)=>a.d<b.d?1:-1);
    const ex = hits.filter(x=>x.n===v).length;
    h += `<div class="play"><b>${v}</b> · ${ways(key)}-way · came ${hits.length} time${hits.length===1?'':'s'} in any order, ${ex} exactly<small>${hits.length?'Last: '+fmtD(hits[0].d)+' · '+nm(hits[0].c)+' '+slotName(hits[0].c,hits[0].s)+' · '+hits[0].n:'Not in the loaded history.'}</small></div>`;
    // which current Endeavor lists contain it
    const inLists = [];
    for(const c of CODES){ const sq=SEQ[c]; if(!sq) continue; let idx=-1; for(let i=sq.length-1;i>=0;i--) if(sq[i].d<=CUR_DAY){idx=i;break;} if(idx<0) continue;
      const ks = endeavorKeys(sq[idx].n,'all'); if(ks.has(key)) inLists.push(`${nm(c)} (${ks.get(key)} from ${sq[idx].n})`); }
    h += `<div class="sub-h">On today's rundown lists</div><div style="font-size:14px">${inLists.length? esc(inLists.join(' · ')) : '<span class="empty">Not on any state\'s rundowns right now.</span>'}</div>`;
    h += hits.length ? '<div class="sub-h">History</div><div class="tw"><table class="t"><thead><tr><th>Date</th><th>State</th><th>Draw</th><th>Result</th><th></th></tr></thead><tbody>'+
      hits.slice(0,50).map(x=>`<tr><td>${fmtD(x.d)}</td><td>${esc(nm(x.c))}</td><td>${esc(slotName(x.c,x.s))}</td><td class="n">${x.n}</td><td>${x.n===v?'<span class="mk ok">straight</span>':''}</td></tr>`).join('')+'</tbody></table></div>' : '';
  } else {
    const L = v.length, key = srt(v), hits=[];
    for(const c in SEQ) for(const x of SEQ[c]){
      const f=x.n.slice(0,L), b=x.n.slice(5-L);
      const fe=f===v, be=b===v, fb=srt(f)===key, bb=srt(b)===key;
      if(fb||bb) hits.push({...x,c,where: fe?'front, exact': be?'back, exact': fb?'front, any order':'back, any order'});
    }
    hits.sort((a,b)=>a.d<b.d?1:-1);
    const exact = hits.filter(x=>x.where.includes('exact')).length;
    h += `<div class="play"><b>${v}</b> as the front or back ${L} · ${exact} exact, ${hits.length} any order<small>Front/Back ${L} bets (PA, OH, DC, LA, MD, DE) pay $${L===3?'500':'5,000'} per $1, about 1 in ${L===3?'1,000':'10,000'} per draw for each side.</small></div>`;
    h += hits.length ? '<div class="tw"><table class="t"><thead><tr><th>Date</th><th>State</th><th>Draw</th><th>Pick 5</th><th>Where</th></tr></thead><tbody>'+
      hits.slice(0,50).map(x=>`<tr><td>${fmtD(x.d)}</td><td>${esc(nm(x.c))}</td><td>${esc(slotName(x.c,x.s))}</td><td class="n">${x.n}</td><td>${x.where}</td></tr>`).join('')+'</tbody></table></div>' : '<div class="empty">Not found.</div>';
  }
  $('lkOut').innerHTML = h;
}

/* ── state view ── */
function renderState(){
  const c = $('stState').value, sq = SEQ[c];
  if(!sq){ $('stOut').innerHTML='<div class="empty">No draws.</div>'; return; }
  const recent = sq.slice(-14).reverse();
  let h = '<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Draw</th><th>Number</th><th>Box</th><th>Sum</th></tr></thead><tbody>'+
    recent.map(x=>`<tr><td>${fmtD(x.d)}</td><td>${esc(slotName(c,x.s))}</td><td class="n"><span class="chip" data-look="${x.n}" style="border:0;padding:0;background:none">${x.n}</span></td><td>${ways(srt(x.n))}-way</td><td class="num">${x.n.split('').reduce((a,d)=>a+ +d,0)}</td></tr>`).join('')+'</tbody></table></div>';
  // Endeavor from last midday and last evening
  for(const s of ['m','e']){
    if(STATES[c][s]===null) continue;
    let idx=-1; for(let i=sq.length-1;i>=0;i--) if(sq[i].s===s){ idx=i; break; } if(idx<0) continue;
    const keys = endeavorKeys(sq[idx].n,'end');
    h += `<div class="sub-h">Endeavor from the last ${esc(slotName(c,s))} (${fmtShort(sq[idx].d)}, ${sq[idx].n}) — for the next ${esc(slotName(c,s).toLowerCase())}</div><div class="chips">`+
      [...keys.keys()].map(k=>{ const came=cameAfter(c,idx,k); return chipFor(k,{came:came?{...came,c}:null}); }).join('')+'</div>';
  }
  // digits last 50 draws
  const last50 = sq.slice(-50), cnt = Array(10).fill(0);
  last50.forEach(x=>x.n.split('').forEach(d=>cnt[+d]++));
  const exp = last50.length*5/10;
  h += `<div class="sub-h">Digits in the last ${last50.length} draws (expected about ${exp.toFixed(0)} each)</div><div class="chips">`+
    cnt.map((v,d)=>`<span class="chip ${v>=exp*1.25?'hot':''}" style="cursor:default">${d}<small>${v}×</small></span>`).join('')+'</div>';
  h += '<div class="note">Swings of ±25% around the expected count are normal over 50 draws. In testing, playing the hottest digit in each spot did no better than random.</div>';
  $('stOut').innerHTML = h;
}

/* ── methods tested (from the 17,647-draw backtest) ── */
const TESTS = [
  ['Endeavor +0 1 1 2 3 (your workbook)','8 boxes',94,94.4],
  ['All five workbook rundowns','42 boxes',524,524.4],
  ['Endeavor, any of the next 7 draws','8 boxes',648,647.8],
  ['Rundown +1 1 1 1 1','9 boxes',115,112.7],
  ['Rundown +1 2 3 4 5','9 boxes',96,110.8],
  ['Rundown +6 7 8 6 7 (YouTube "engine")','9 boxes',115,108.1],
  ['Rundown +3 4 5 3 4','9 boxes',129,113.3],
  ['Rundown +1 2 3 1 2','9 boxes',117,113.3],
  ['Rundown +9 9 9 9 9','9 boxes',115,112.7],
  ['Mirror of last draw','1 box',8,12.6],
  ['Same number repeats','1 box',11,12.6],
  ['Each digit up/down 1','243 straights',44,42.8],
  ['Mirror / up 1 / down 1 per digit','243 straights',32,42.8],
  ['Mirror mix (digit or its mirror)','32 straights',4,5.6],
  ['Hot digit in each spot (last 40)','1 box',11,12.1],
  ['Top-2 hot digits each spot (wheel)','32 straights',2,5.5],
  ['Traveling numbers (hit 2+ states, 30 days)','≈59 boxes',887,833.8],
  ['Pick 4 triple → same digit 3+ in any Pick 5 state, 7 days','≈55 boxes',2720,2618.4],
  ['Pick 4 triple → same state\'s Pick 5, 7 days','≈55 boxes',105,84.4],
  ['LP: 814-style rundown +8 1 4 8 1 (lakerben)','≈9 boxes',112,106.8],
  ['LP: Digit string projection R2–R8 (adobea78)','≈8 boxes',85,99.5],
  ['LP: Covering wheel, 14 lines as boxes (tokecap)','14 boxes',300,296.2],
  ['LP: Covering wheel, next front/back 4 in the same line','1–3 lines',1978,2013.4],
];
function renderTests(){
  $('testOut').innerHTML = '<table class="t"><thead><tr><th>Method</th><th>Plays per draw</th><th>Hits</th><th>Random picks</th><th>Ratio</th></tr></thead><tbody>'+
    TESTS.map(([m,p,h,e])=>`<tr><td>${esc(m)}</td><td>${p}</td><td class="num">${h}</td><td class="num">${e}</td><td class="num">${(h/e).toFixed(2)}</td></tr>`).join('')+'</tbody></table>';
}
function renderPay(){
  const rows = [['Straight (exact order)',1,'$50,000'],['5-way box (four of a kind, 11112)',5,'$10,000'],['10-way box (three + pair, 11122)',10,'$5,000'],['20-way box (three of a kind, 11123)',20,'$2,500'],['30-way box (two pairs, 11223)',30,'$1,600–1,700'],['60-way box (one pair, 11234)',60,'$800–850'],['120-way box (all different)',120,'$400–425']];
  $('payOut').innerHTML = '<table class="t"><thead><tr><th>Bet</th><th>Odds</th><th>Pays per $1</th></tr></thead><tbody>'+
    rows.map(([b,w,p])=>`<tr><td>${b}</td><td class="num">1 in ${Math.round(1e5/w).toLocaleString()}</td><td class="num">${p}</td></tr>`).join('')+
    '<tr><td>Front or back 4 (PA, OH, DC, LA, MD, DE)</td><td class="num">1 in 10,000</td><td class="num">$5,000</td></tr><tr><td>Front or back 3</td><td class="num">1 in 1,000</td><td class="num">$500</td></tr><tr><td>Front or back pair</td><td class="num">1 in 100</td><td class="num">$50</td></tr>'+
    '</tbody></table><div class="note">Georgia FIVE has no box bets: it pays $10,000 for an exact match plus smaller prizes for matching front or back digits. Every bet type pays back about 50¢ per $1 on average.</div>';
}

/* ── wiring ── */
const EXPAND = {};
function renderAll(){
  renderStatus(); renderDraws(); renderEndeavor(); renderLP(); renderScore(); renderConv(); renderTrig(); renderSeq(); renderSF(); renderPairs(); renderLook(); renderState();
}
function fillStateSelects(){
  const opts = CODES.filter(c=>SEQ[c]).map(c=>`<option value="${c}">${esc(nm(c))}</option>`).join('');
  $('sfState').innerHTML = '<option value="">All states</option>'+opts;
  $('prState').innerHTML = opts; $('stState').innerHTML = opts;
  const s = store('state'); if(s && SEQ[s]){ $('prState').value=s; $('stState').value=s; }
}
function openLook(n){ $('lkBox').value = n; $('sfBox').value = n.length===5?n:$('sfBox').value; renderLook(); renderSF(); const p=$('pLook'); p.open=true; p.scrollIntoView({behavior:'smooth',block:'start'}); }

document.addEventListener('click', e=>{
  const look = e.target.closest('[data-look]'); if(look){ openLook(look.dataset.look); return; }
  const sr = e.target.closest('[data-seqrow]'); if(sr){ const t=$(sr.dataset.seqrow); if(t) t.hidden=!t.hidden; return; }
  const lc = e.target.closest('[data-lpcopy]'); if(lc){ lpCopy(LP_LISTS[lc.dataset.lpcopy]||''); return; }
  const ex = e.target.closest('[data-expand]'); if(ex){ EXPAND[ex.dataset.expand]=!EXPAND[ex.dataset.expand]; renderSF(); }
});
$('daySel').addEventListener('change', e=>{ CUR_DAY = e.target.value; renderAll(); });
$('dayPrev').addEventListener('click', ()=>{ const i=DATES.indexOf(CUR_DAY); if(i>0){ CUR_DAY=DATES[i-1]; renderAll(); } });
$('dayNext').addEventListener('click', ()=>{ const i=DATES.indexOf(CUR_DAY); if(i<DATES.length-1){ CUR_DAY=DATES[i+1]; renderAll(); } });
$('endBox').addEventListener('input', renderEndeavor);
$('drawsOnly').addEventListener('change', ()=>{ store('drawsOnly',$('drawsOnly').value); renderDraws(); });
['trWin','trOnly'].forEach(id=>$(id).addEventListener('change', ()=>{ store(id,$(id).value); renderTrig(); }));
$('seqSince').addEventListener('change', ()=>{ store('seqSince',$('seqSince').value); renderSeq(); });
$('lpSet').addEventListener('change', ()=>{ store('lpSet',$('lpSet').value); renderLP(); });
$('lpInc').addEventListener('input', ()=>{ if(($('lpInc').value||'').replace(/\D/g,'').length===5) renderLP(); });
$('lpCopyAll').addEventListener('click', ()=>{ const all=new Set(); for(const c of CODES) (LP_LISTS[c]||'').split(' ').filter(Boolean).forEach(k=>all.add(k)); lpCopy([...all].join(' ')); });
$('endSet').addEventListener('change', ()=>{ store('endSet',$('endSet').value); renderEndeavor(); });
['sfBox','sfSlot','sfState'].forEach(id=>$(id).addEventListener(id==='sfBox'?'input':'change', renderSF));
['prState','prMode'].forEach(id=>$(id).addEventListener('change', ()=>{ store('state',$('prState').value); renderPairs(); }));
$('stState').addEventListener('change', ()=>{ store('state',$('stState').value); renderState(); });
$('lkBox').addEventListener('input', renderLook);
$('syncBtn').addEventListener('click', async ()=>{ $('syncBtn').disabled=true; $('feedText').textContent='Checking for new results…'; await loadFeed(); SCORE_CACHE=null; CUR_DAY=null; renderAll(); $('syncBtn').disabled=false; });
document.querySelectorAll('details.panel').forEach(d=>{
  const k='open_'+d.id, v=store(k); if(v!==null && v!==undefined) d.open=v;
  d.addEventListener('toggle', ()=>store(k,d.open));
});
(async function start(){
  const es = store('endSet'); if(es) $('endSet').value = es;
  const ls = store('lpSet'); if(ls) $('lpSet').value = ls;
  const ss = store('seqSince'); if(ss) $('seqSince').value = ss;
  for(const id of ['trWin','trOnly','drawsOnly']){ const v = store(id); if(v!==null && v!==undefined) $(id).value = v; }
  renderTests(); renderPay();
  startLog();
  await loadAll();
  fillStateSelects();
  if(!$('endBox').value){ /* leave empty: the per-state cards are the main view */ }
  if(!$('sfBox').value){ const pa=SEQ.pa; if(pa) $('sfBox').value = pa[pa.length-1].n; }
  renderAll();
})();
