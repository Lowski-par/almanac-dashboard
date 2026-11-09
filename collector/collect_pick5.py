#!/usr/bin/env python3
"""Collect the latest Pick 5 draws and merge them, with every state's Pick 4, into docs/pick5/feed.json.

Runs on its own like collect.py (no Claude, standard library only):
  * Pick 5 from LotteryCorner game pages (DC-5 from the official DC Lottery site);
  * Pick 4 for every state is copied from the Almanac feed (docs/feed.json), which collect.py keeps
    current, so run collect.py first.
Michigan Daily 5 is read from Lottery Post's text results page (untested parser - see collect.read_text_game).
Same safety rules as collect.py: only numbers actually read are stored, and a day is only
replaced by a read with at least as many draws.
"""
import argparse, datetime, json, os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import collect as C

FEED = os.path.join(C.ROOT, 'docs', 'pick5', 'feed.json')
ALMANAC = os.path.join(C.ROOT, 'docs', 'feed.json')

# code -> [(slug, slot), ...] in draw-time order
P5 = {
    'pa': [('pick-5-midday', 'm'), ('pick-5-evening', 'e')],
    'oh': [('pick-5-midday', 'm'), ('pick-5-evening', 'e')],
    'md': [('pick-5-midday', 'm'), ('pick-5-evening', 'e')],
    'fl': [('pick-5-midday', 'm'), ('pick-5-evening', 'e')],
    'ga': [('georgia-five-midday', 'm'), ('georgia-five-evening', 'e')],
    'va': [('pick-5-day', 'm'), ('pick-5-night', 'e')],
    'de': [('play-5-day', 'm'), ('play-5', 'e')],
    'la': [('pick-5', 'e')],
    'dc': 'dclottery',
    'mi': 'mi_daily5',
}


def collect_p5(pause=0.6):
    found, problems = {}, []                        # date -> {code: [(order, number, slot)]}
    for code, games in P5.items():
        if games == 'dclottery':
            try:
                per, bad = C.read_dc((5,))
                if bad:
                    problems.append(f'dc: unreadable {bad}')
                for (d, _), lst in per.items():
                    found.setdefault(d, {})[code] = sorted(lst)
            except Exception as e:
                problems.append(f'dc: {e}')
            continue
        if games == 'mi_daily5':
            try:
                draws, bad = C.read_mi_daily5()
                if bad:
                    problems.append(f'mi: unreadable {bad}')
                for d, lst in draws.items():
                    found.setdefault(d, {})[code] = sorted(lst)
            except Exception as e:
                problems.append(f'mi: {e}')
            continue
        for order, (slug, slot) in enumerate(games):
            try:
                draws, bad = C.read_game(code, slug, 5, False)
            except Exception as e:
                problems.append(f'{code} {slug}: {e}')
                continue
            if bad:
                problems.append(f'{code} {slug}: unreadable rows {bad}')
            for d, n in draws.items():
                found.setdefault(d, {}).setdefault(code, []).append((order, n, slot))
            time.sleep(pause)
    return found, problems


def p4_from_almanac(dates):
    """{date: (p4 map, s4 map)} merged across the Almanac's groups."""
    out = {}
    for x in json.load(open(ALMANAC))['docs']:
        if x['date'] not in dates:
            continue
        p4, s4 = out.setdefault(x['date'], ({}, {}))
        for c, ns in (x.get('p4') or {}).items():
            p4[c] = ns
            s4[c] = (x.get('s4') or {}).get(c) or ['e'] * len(ns)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    feed = json.load(open(FEED))
    docs = {x['date']: x for x in feed['docs']}
    found, problems = collect_p5()
    changed = []
    for d, per in found.items():
        doc = docs.setdefault(d, {'date': d, 'p5': {}, 's5': {}, 'p4': {}, 's4': {}})
        for code, lst in per.items():
            lst.sort()
            ns, ss = [n for _, n, _ in lst], [s for _, _, s in lst]
            old = (doc.get('p5') or {}).get(code, [])
            if ns != old and len(ns) >= len(old):
                doc.setdefault('p5', {})[code] = ns
                doc.setdefault('s5', {})[code] = ss
                changed.append(f'{d} {code} P5 {old} -> {ns}')
    # Pick 4 for every date the Pick 5 feed holds
    for d, (p4, s4) in p4_from_almanac(set(docs)).items():
        doc = docs[d]
        for c, ns in p4.items():
            old = (doc.get('p4') or {}).get(c, [])
            if ns != old and len(ns) >= len(old):
                doc.setdefault('p4', {})[c] = ns
                doc.setdefault('s4', {})[c] = s4[c]
                changed.append(f'{d} {c} P4 {old} -> {ns}')
    feed['docs'] = sorted(docs.values(), key=lambda x: x['date'])
    for p in problems:
        print('PROBLEM', p)
    for c in changed:
        print('UPDATE ', c)
    print(f'{len(changed)} state-days updated, {len(problems)} problems')
    if changed and not a.dry_run:
        feed['updatedAt'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        tmp = FEED + '.tmp'
        json.dump(feed, open(tmp, 'w'), separators=(',', ':'))
        os.replace(tmp, FEED)
    return 1 if problems and not changed else 0


if __name__ == '__main__':
    sys.exit(main())
