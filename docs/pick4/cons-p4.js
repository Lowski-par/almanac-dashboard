/* Consensus hook for Pick 4 (Ya Heard Me): reads each column's own output; changes none of their rules.
   The eight Hottest systems vote only for their own top picks: top 5% of each number type by that system's score (rG..rM >= 0.95); Date Sum = its whole group. */
window.CONS_CFG = { N:4, _c:new Map(),
  seq:() => SEQ, name:c => (typeof P4NAMES !== 'undefined' && P4NAMES[c]) || nm(c), look:n => { useSeed(n); showTab('grand'); }, today:() => todayCT(),
  systems(D, st, past){
    const key = D+'|'+st+'|'+past+'|'+Object.values(SEQ).reduce((a,b) => a+b.length, 0); if(this._c.has(key)) return this._c.get(key);
    const out = [], box = n => String(n).split('').sort().join(''), add = (k, name, list, straight) => { const set = new Set(), sm = new Map(); (list||[]).forEach(n => { const b = box(n); set.add(b); if(straight && !sm.has(b)) sm.set(b, String(n)); }); out.push({k, name, set, straight:straight ? sm : null}); };
    const rk = st ? Object.keys(REGION4).find(k => REGION4[k].states.includes(st)) : null, reg = rk ? REGION4[rk].states.filter(c => SEQ[c]) : Object.keys(SEQ), where = rk ? REGION4[rk].name : 'all states';
    const q = st ? (SEQ[st] || []).slice().sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.s === b.s ? 0 : a.s === 'm' ? -1 : 1)) : [];
    const before = past ? q.filter(x => x.d < D) : q;
    if(st && before.length){
      try{ const mid = [...before].reverse().find(x => x.s === 'm') || before[before.length-1]; add('R', 'GA Rundown play list', window.gaBuild(mid.n, D, [], 12, st, null).list.map(x => x.n), true); }catch(e){}
      try{ const fill = (document.getElementById('grDir')||{}).value || 'ring'; add('X', 'Master Grid Top 15', window.gridBuild(before[before.length-1].n, fill, st).ranked.slice(0, 15).map(e => e.n), true); }catch(e){}
    }
    try{ const rows = needList(reg, D, 7, 0, null, dsYearMode(), false, D).all.filter(r => !r.fell);
      for(const [k, f, name] of [['G','g','100 Grand'],['Q','q','Big Quad Energy'],['Y','y','My Lil Yeah'],['P','p','Missing pairs / triads'],['N','n','Neighbors'],['V','v','Vibrations'],['M','m','Mirror Doubles'],['S','s','Date Sum']])
        add(k, name+(f === 's' ? '' : ' top picks')+' ('+where+')', rows.filter(r => f === 's' ? r.s > 0 : (r['r'+k] || 0) >= 0.95).map(r => r.b)); }catch(e){}
    try{ add('H', 'Hottest board ('+where+')', hotPicks(reg, D, 7, 2, dsYearMode(), false, D).slice(0, 12).map(r => r.b)); }catch(e){}
    const sel = document.getElementById('dsGroup'), keep = sel ? sel.value : null;
    for(const [k, mode, name] of [['D','pair','date sum pairs'],['L','last','last digit sum pairs']]){ if(sel) sel.value = mode; try{ add(k, name, dspHot4(D, reg, 12).slice(0, 12).map(r => r.b)); }catch(e){} }
    if(sel) sel.value = keep;
    const res = out.filter(s => s.set.size); this._c.set(key, res); return res; } };
