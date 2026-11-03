# Almanac Convergence dashboard

## Open the dashboards

- **Almanac Convergence (Pick 3 / Pick 4):** https://lowski-par.github.io/almanac-dashboard/
- **Pick 5 Endeavor:** https://lowski-par.github.io/almanac-dashboard/pick5/

Bookmark those two links. Everything below is only about how the pages update.

Marcus's Pick 3 / Pick 4 tracker, running on its own: no Claude and no paid services.

- `docs/` is Almanac Convergence (Pick 3/4) and `docs/pick5/` is Pick 5 Endeavor, both served by GitHub Pages.
  `docs/feed.json` and `docs/pick5/feed.json` hold the draws.
- `collector/collect.py` reads the latest Pick 3/4 draws and merges them into `docs/feed.json`;
  `collector/collect_pick5.py` does the same for Pick 5 and copies every state's Pick 4 into `docs/pick5/feed.json`.
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
Michigan Daily 5 isn't collected either (its site only shows numbers inside its app).

The Pick 5 play log is saved in each browser (nothing private goes into these files); use Copy log / Paste log to move it.
