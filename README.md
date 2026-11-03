# Almanac Convergence dashboard

Marcus's Pick 3 / Pick 4 tracker, running on its own: no Claude and no paid services.

- `docs/` is the dashboard itself (served by GitHub Pages). `docs/feed.json` holds every draw.
- `collector/collect.py` reads the latest draws from LotteryCorner and merges them into `docs/feed.json`.
  It only uses Python's standard library.
- `.github/workflows/update-results.yml` runs the collector on GitHub four times a day and saves
  any new draws. You can also start it by hand: GitHub → Actions → "Update lottery results" → Run workflow.

Run it on a Mac instead:

```
python3 collector/collect.py --dry-run   # look only
python3 collector/collect.py             # update docs/feed.json
```

Not collected: Ontario and Atlantic Canada, whose official sites only show results inside their own pages.
Paste those on the dashboard to add a day. Western Canada, Quebec and DC come from their official sites.
