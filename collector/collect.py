#!/usr/bin/env python3
"""Collect the latest Pick 3 / Pick 4 draws and merge them into docs/feed.json.

Runs on its own (GitHub Actions or by hand) - no Claude, no API keys, Python
standard library only. Each game page on LotteryCorner lists its last ~10 draws,
so every run re-reads the recent days and fills anything that was missing.

Safety rules:
  * only numbers actually read from a page are stored, never guessed;
  * a state's day is only replaced when the new read has at least as many
    draws as what is already stored, so a half-posted day can't erase data;
  * nothing older than the pages show is ever touched.
"""
import argparse, datetime, json, os, re, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEED = os.path.join(ROOT, 'docs', 'feed.json')
UA = {'User-Agent': 'Mozilla/5.0 (almanac-dashboard results collector)'}

# state code on the page -> (LotteryCorner code, group, [(slug, digits, slot), ...] in draw-time order)
# slot: "m" = morning/midday/day draws, "e" = evening/night draws
def pair(code, p3, p4, mid='midday', eve='evening'):
    g = []
    if p3: g += [(f'{p3}-{mid}', 3, 'm'), (f'{p3}-{eve}', 3, 'e')]
    if p4: g += [(f'{p4}-{mid}', 4, 'm'), (f'{p4}-{eve}', 4, 'e')]
    return g

GAMES = {
    # south
    'ar': ('ar', 'south', pair('ar', 'cash-3', 'cash-4')),
    'dc': ('dc', 'south', 'dclottery'),                         # official site: all three daily draws
    'de': ('de', 'south', pair('de', 'play-3', 'play-4', 'day', 'night')),
    'fl': ('fl', 'south', pair('fl', 'pick-3', 'pick-4')),
    'ga': ('ga', 'south', [('cash-3-midday', 3, 'm'), ('cash-3-evening', 3, 'e'), ('cash-3-night', 3, 'e'),
                           ('cash-4-midday', 4, 'm'), ('cash-4-evening', 4, 'e'), ('cash-4-night', 4, 'e')]),
    'ky': ('ky', 'south', pair('ky', 'pick-3', 'pick-4')),
    'la': ('la', 'south', [('pick-3', 3, 'e'), ('pick-4', 4, 'e')]),
    'md': ('md', 'south', pair('md', 'pick-3', 'pick-4')),
    'ms': ('ms', 'south', pair('ms', 'cash-3', 'cash-4')),
    'nc': ('nc', 'south', pair('nc', 'pick-3', 'pick-4', 'day', 'evening')),
    'ok': ('ok', 'south', [('pick-3', 3, 'e')]),
    'sc': ('sc', 'south', pair('sc', 'pick-3', 'pick-4')),
    'tn': ('tn', 'south', [('cash-3-morning', 3, 'm'), ('cash-3-midday', 3, 'm'), ('cash-3-evening', 3, 'e'),
                           ('cash-4-morning', 4, 'm'), ('cash-4-midday', 4, 'm'), ('cash-4-evening', 4, 'e')]),
    'tx': ('tx', 'south', [('pick-3-morning', 3, 'm'), ('pick-3-day', 3, 'm'), ('pick-3-evening', 3, 'e'), ('pick-3-night', 3, 'e'),
                           ('daily-4-morning', 4, 'm'), ('daily-4-day', 4, 'm'), ('daily-4-evening', 4, 'e'), ('daily-4-night', 4, 'e')]),
    'va': ('va', 'south', pair('va', 'pick-3', 'pick-4', 'day', 'night')),
    'wv': ('wv', 'south', [('daily-3', 3, 'e'), ('daily-4', 4, 'e')]),
    # north
    'az': ('az', 'north', pair('az', 'pick-3', 'pick-4')),
    'ca': ('ca', 'north', [('daily-3-midday', 3, 'm'), ('daily-3-evening', 3, 'e'), ('daily-4', 4, 'e')]),
    'co': ('co', 'north', [('pick-3-midday', 3, 'm'), ('pick-3', 3, 'e')]),
    'ct': ('ct', 'north', pair('ct', 'play3', 'play4', 'day', 'night')),
    'ia': ('ia', 'north', pair('ia', 'pick-3', 'pick-4')),
    'id': ('id', 'north', pair('id', 'pick-3', 'pick-4', 'day', 'night')),
    'il': ('il', 'north', pair('il', 'pick-3', 'pick-4')),
    'in': ('in', 'north', pair('in', 'daily3', 'daily4')),
    'ks': ('ks', 'north', [('pick-3', 3, 'm'), ('pick-3-evening', 3, 'e')]),
    'mi': ('mi', 'north', pair('mi', 'daily-3', 'daily-4')),
    'mn': ('mn', 'north', [('pick-3', 3, 'e')]),
    'mo': ('mo', 'north', pair('mo', 'pick-3', 'pick-4')),
    'ne': ('ne', 'north', [('pick-3', 3, 'e'), ('pick-4', 4, 'e')]),
    'nj': ('nj', 'north', pair('nj', 'pick-3', 'pick-4')),
    'nm': ('nm', 'north', pair('nm', 'pick-3-plus', 'pick-4-plus', 'day', 'evening')),
    'ny': ('ny', 'north', [('numbers-midday', 3, 'm'), ('numbers-evening', 3, 'e'), ('win-4-midday', 4, 'm'), ('win-4-evening', 4, 'e')]),
    'oh': ('oh', 'north', pair('oh', 'pick-3', 'pick-4')),
    'pa': ('pa', 'north', pair('pa', 'pick-3', 'pick-4')),
    'pr': ('pr', 'north', pair('pr', 'pega-3', 'pega-4', 'diacutea', 'noche')),
    'wa': ('wa', 'north', [('daily-game', 3, 'e')]),
    'wi': ('wi', 'north', pair('wi', 'pick-3', 'pick-4')),
    'xx': ('nh', 'north', pair('nh', 'tri-state-pick-3', 'tri-state-pick-4', 'day', 'evening')),
    'ma': ('ma', 'north', [('numbers-game-midday', 4, 'm'), ('numbers-game-evening', 4, 'e')]),
    'or': ('or', 'north', [('pick-4-1pm', 4, 'm'), ('pick-4-4pm', 4, 'm'), ('pick-4-7pm', 4, 'e'), ('pick-4-10pm', 4, 'e')]),
    'ri': ('ri', 'north', [('numbers-game-midday', 4, 'm'), ('numbers-game-evening', 4, 'e')]),
    # caribbean: each draw lists 1st, 2nd and 3rd prize; only the 1st prize is kept
    'cr': ('vi', 'caribbean', [('pick-3-morning', 3, 'm'), ('pick-3-midday', 3, 'm'), ('pick-3-sunset', 3, 'e'), ('pick-3-evening', 3, 'e'),
                               ('pick-4-morning', 4, 'm'), ('pick-4-midday', 4, 'm'), ('pick-4-sunset', 4, 'e'), ('pick-4-evening', 4, 'e')]),
}
ROW = re.compile(r'<time dateTime="(\d{4}-\d\d-\d\d)"[^>]*>.*?</time>(.*?)</li></ul>', re.S)
BALL = re.compile(r'data-ball="([a-z-]+)" aria-label="([^"]+)"')


def fetch(url, tries=3):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode('utf8', 'replace')
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))


def first_prize(balls, digits, caribbean):
    """The winning number from a row's balls, or None if the layout isn't recognised."""
    b = [v for kind, v in balls if kind == 'standard']
    one = lambda x: re.fullmatch(r'\d', x) is not None
    if not caribbean:
        return ''.join(b[:digits]) if len(b) >= digits and all(one(x) for x in b[:digits]) else None
    # Caribbean: "19,6,7,24,5,0,38,1,3,0" -> prize rank glued to the first digit (967)
    if re.fullmatch(r'1\d', b[0] or '') and all(one(x) for x in b[1:digits]) and (len(b) == digits or re.fullmatch(r'2\d', b[digits] or '')):
        return b[0][1] + ''.join(b[1:digits])
    if len(b) in (3 * digits, 3 * digits + 1) and all(one(x) for x in b):
        return ''.join(b[:digits])
    return None


def read_game(lc, slug, digits, caribbean):
    """{date: number} for one game page (the page repeats its newest draw at the top)."""
    out, bad = {}, []
    for d, body in ROW.findall(fetch(f'https://www.lotterycorner.com/{lc}/{slug}')):
        n = first_prize(BALL.findall(body), digits, caribbean)
        if n is None:
            bad.append(d)
        elif d not in out:
            out[d] = n
    return out, bad


DC_TIMES = {'1:50pm': (0, 'm'), '7:50pm': (1, 'e'), '11:30pm': (2, 'e')}


def read_dc():
    """DC-3 and DC-4 from dclottery.com, which lists the 1:50pm, 7:50pm and 11:30pm draws."""
    h = fetch('https://dclottery.com/winning-numbers')
    per, bad = {}, []
    for digits in (3, 4):
        m = re.search(r'<div class="game dc-%d[ "].*?(?=<div class="game |\Z)' % digits, h, re.S)
        if not m:
            bad.append(f'DC-{digits} section not found')
            continue
        for d, t, body in re.findall(r'<time datetime="(\d{4}-\d\d-\d\d)T[^"]*"[^>]*>[^<]*</time>\s*-\s*([0-9:apm]+)\s*</div>(.*?)</span>\s*</div>', m.group(0), re.S):
            balls = re.findall(r'<span class="ball ball_\d">\s*(\d)\s*</span>', body)
            if t not in DC_TIMES or len(balls) != digits:
                bad.append(f'{d} {t} DC-{digits}')
                continue
            order, slot = DC_TIMES[t]
            lst = per.setdefault((d, digits), [])
            if all(o != order for o, _, _ in lst):
                lst.append((order, ''.join(balls), slot))
    return per, bad


def collect(only=None, pause=0.6):
    """{(date, group): {"p3": {code: [...]}, "s3": {...}, "p4": {...}, "s4": {...}}}"""
    found, problems = {}, []
    for code, (lc, group, games) in GAMES.items():
        if only and code not in only:
            continue
        per = {}                                    # (date, digits) -> [(order, number, slot)]
        if games == 'dclottery':
            try:
                per, bad = read_dc()
                if bad:
                    problems.append(f'dc: unreadable {bad}')
            except Exception as e:
                problems.append(f'dc: {e}')
            games = []
        for order, (slug, digits, slot) in enumerate(games):
            try:
                draws, bad = read_game(lc, slug, digits, code == 'cr')
            except Exception as e:
                problems.append(f'{code} {slug}: {e}')
                continue
            if bad:
                problems.append(f'{code} {slug}: unreadable rows {bad}')
            for d, n in draws.items():
                per.setdefault((d, digits), []).append((order, n, slot))
            time.sleep(pause)
        for (d, digits), lst in per.items():
            lst.sort()
            doc = found.setdefault((d, group), {'p3': {}, 's3': {}, 'p4': {}, 's4': {}})
            doc[f'p{digits}'][code] = [n for _, n, _ in lst]
            doc[f's{digits}'][code] = [s for _, _, s in lst]
    return found, problems


def merge(feed, found):
    docs = {(x['date'], x.get('group', '')): x for x in feed['docs']}
    changed = []
    for (d, group), new in found.items():
        cur = docs.get((d, group))
        if cur is None:
            cur = docs[(d, group)] = {'date': d, 'group': group, 'p3': {}, 'p4': {}, 's3': {}, 's4': {}}
        for g in ('3', '4'):
            for code, ns in new['p' + g].items():
                old = (cur.get('p' + g) or {}).get(code, [])
                if ns != old and len(ns) >= len(old):
                    cur.setdefault('p' + g, {})[code] = ns
                    cur.setdefault('s' + g, {})[code] = new['s' + g][code]
                    changed.append(f'{d} {code} P{g} {old} -> {ns}')
    feed['docs'] = sorted(docs.values(), key=lambda x: (x['date'], x.get('group', '')))
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true', help='read the pages and report, but do not write feed.json')
    ap.add_argument('--only', nargs='*', help='state codes to collect (default: all)')
    a = ap.parse_args()
    feed = json.load(open(FEED))
    found, problems = collect(set(a.only) if a.only else None)
    changed = merge(feed, found)
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
