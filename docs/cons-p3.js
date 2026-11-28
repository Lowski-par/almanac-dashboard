/* Consensus hook for Pick 3 (Almanac): reads each column's own output; changes none of their rules. */
window.CONS_CFG = { N:3, _c:new Map(), weak:['B'],   /* Book convergence's top tier is ~85 numbers with no ranking inside it: on a tie, numbers that don't need its vote rank first */
  seq:() => window.GRID_CFG.seq(), name:c => nm(c), look:n => openLookup(n), today:() => window.GRID_CFG.today(),
  systems(D, st, past){
    const key = D+'|'+st+'|'+past+'|'+window.GRID_CFG._n; if(this._c.has(key)) return this._c.get(key);
    const out = [], box = n => String(n).split('').sort().join(''), add = (k, name, list, straight) => { const set = new Set(), sm = new Map(); (list||[]).forEach(n => { const b = box(n); set.add(b); if(straight && !sm.has(b)) sm.set(b, String(n)); }); out.push({k, name, set, straight:straight ? sm : null}); };
    const q = st ? (this.seq()[st] || []).slice().sort((a,b) => a.d < b.d ? -1 : a.d > b.d ? 1 : (a.s === b.s ? 0 : a.s === 'm' ? -1 : 1)) : [];
    const before = past ? q.filter(x => x.d < D) : q;
    if(st && before.length){
      try{ const mid = [...before].reverse().find(x => x.s === 'm') || before[before.length-1]; add('R', 'GA Rundown play list', window.gaBuild(mid.n, D, [], 12, st, null).list.map(x => x.n), true); }catch(e){}
      try{ const fill = (document.getElementById('grDir')||{}).value || 'ring'; add('X', 'Master Grid Top 10', window.gridBuild(before[before.length-1].n, fill, st).ranked.slice(0, 10).map(e => e.n), true); }catch(e){}
    }
    try{ const ds = dsDateSum(D, dsWithYear()); add('S', 'Date Sum '+ds.sum+' (its group)', Object.values(dsList(3, ds.sum, true).byWays).flat()); }catch(e){}
    const sel = document.getElementById('dsGroup'), keep = sel ? sel.value : null;
    for(const [k, mode, name] of [['D','pair','date sum pairs'],['L','last','last digit sum pairs']]){ if(sel) sel.value = mode; try{ add(k, name, dspHot(D, 12, false).slice(0, 12).map(x => x.k)); }catch(e){} }
    if(sel) sel.value = keep;
    try{ add('H', 'Hottest board', dspHeatFor(D, 7).slice(0, 12).map(h => h.num), true); }catch(e){}
    try{ add('V', 'Vibrations', mtVibes(D)); }catch(e){}
    if(!past){ try{ const L = mtLists(D); add('B', 'Book convergence', [...L.B]); add('M', 'Mirror Rundown ready', [...L.M]); add('F', 'Brings / Follows rules', [...L.F]); }catch(e){} }
    const res = out.filter(s => s.set.size); this._c.set(key, res); return res; } };
