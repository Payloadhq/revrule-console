# RevRule Console by Payload

**Try:** [live console](https://payloadhq.github.io/revrule-console/) (static PWA, no backend) · **Powered by:** [RevRule $99 one-time API](https://payloadtools.gumroad.com/l/revrule) · **Engine:** [Payloadhq/payload-flow](https://github.com/Payloadhq/payload-flow)

**RevRule Console** is the human configuration and visualization layer for
[RevRule](https://github.com/Payloadhq/payload-flow), Payload's programmable
revenue rules engine. Manage Revenue Graphs, simulate economic events, and
track entitlements with the RevRule API, all from your browser.

## What you can do

- **Manage Revenue Graphs:** define, review, and activate graphs (draft to
  active) without writing SDK calls.
- **Simulate events:** dry-run an economic event against a graph and preview
  the resulting entitlements, fees, and proposed distributions with zero side
  effects.
- **Track entitlements:** read the append-only, hash-chained ledger and see
  who is owed what, with reasons.
- **Explore a worked example:** the bundled demo walks through a music
  agreement and a royalty statement (`demo/music-agreement.txt`,
  `demo/music-statement.csv`).

## Try it

The console is a static web app (PWA): no build step, no backend. Serve the
repo root from any static host and open it in a browser:

```bash
npx serve .
```

Connect it to the hosted RevRule API (`https://payload-rail.fly.dev`; get a free API
key with one curl call, see the
[RevRule API quickstart](https://payloadhq.github.io/flow-rail.html)) or point it at
your own self-hosted RevRule API. The console never moves money: it only reads and
proposes, like the engine itself.

## Repo contents

- `index.html` - app shell (the bundled build lives in `assets/`)
- `demo/` - worked-example fixtures: a music agreement and royalty statement
- `manifest.json` + icons - PWA install assets

## Links

- RevRule engine (MIT): https://github.com/Payloadhq/payload-flow
- RevRule API quickstart: https://payloadhq.github.io/flow-rail.html
- Browser sandbox (no key needed): https://payloadhq.github.io/flow-sandbox.html

## License

No LICENSE file is present in this repo yet. Add one before distributing
builds (the engine repo it configures is MIT).

---

**More from Payload** · [payloadhq.github.io](https://payloadhq.github.io/) · [all Payload repos](https://github.com/Payloadhq)

Related: [payload-flow](https://github.com/Payloadhq/payload-flow) · [revrule-csv-import](https://github.com/Payloadhq/revrule-csv-import)
