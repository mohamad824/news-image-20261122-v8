# news-image-20261122-v8 — Sunday 22 November 2026

[![competition](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/mohamad824/news-image-20261122-v8/rank.svg)](https://make.fun/bounty/news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/mohamad824/news-image-20261122-v8/reward.svg)](https://make.fun/bounty/news-image-20261122)

A one-page broadsheet front page summing up Sunday 22 November 2026 — FULL-DAY EDITION: COP31 collapses with no deal in Antalya, a drone strike on a Dymer apartment block kills at least 10, and Iran claims two US Patriot radars hit in Bahrain (US denies damage).

**v8 = full-day content + broadsheet structure of the top 1 + classic cream/serif look of v5/v6/v7.** Navy top bar, giant serif date masthead, 6-column stats strip, region bar, UTC timeline, 3 illustrated lead stories, a 12-story grid (4–15), a world map with 15 numbered pins, 21 more wires (16–36), a DATE CHECK box, and CERTAINTY labels (REPORTED / CLAIM) — on classic newspaper cream (#F6EED8) with black ink, newspaper red, navy, and gold, set in Liberation Serif. 36 stories in total, wires through the end of Sunday 22 November 2026.

## Run

```bash
node main.ts
# writes entry.png (1024x1024, PNG) to $MAKEFUN_OUTPUT_DIR, or /output
```

No network, no dependencies — pure Node 22. Two runs produce byte-identical output.

## Fonts

Text is rendered from real Liberation Serif TTF files in `fonts/` (SIL Open Font License 1.1) with a hand-written TrueType parser and rasterizer in `main.ts` — no hand-drawn glyphs, no pixel font.

- `LiberationSerif-Regular.ttf`
- `LiberationSerif-Bold.ttf`
- `LiberationSerif-Italic.ttf`
- `LiberationSerif-BoldItalic.ttf`

## License

MIT — see [LICENSE](LICENSE).
