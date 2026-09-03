# Options, visually

An interactive series on options theory. Static HTML, no framework, no build step.
Open any file directly in a browser and it runs.

```
index.html            series landing page
black-scholes.html    No. 01 — The Price of Uncertainty
surface.html          No. 02 — The Shape of What We Don't Believe
catalyst.html         No. 03 — One Number Holding Two Things
structures.html       No. 04 — The Same Trade, Read Twice
microstructure.html   No. 05 — Every Price Has Someone Behind It
execution.html        No. 06 — The Hedge That Costs Something
parity.html           No. 07 — Two Ways to Own the Same Thing
early-exercise.html   No. 08 — A Decision Worth Exactly Nothing
template.html         copy this to start a new page
assets/
  lab.css             design system: tokens, typography, every component
  mobile.css          phone/tablet corrections and touch targets
  lab.js              engine: Black–Scholes, plotting, controls, teaching layer
.nojekyll             tells GitHub Pages to serve files as-is
```

## Two forms of the same page

**Split** (the files in the repo root) — pages link to `assets/lab.css` and
`assets/lab.js`. This is what you host: the shared engine is downloaded once and
cached across the whole series, so page two costs ~40KB instead of ~230KB.

**Standalone** (`dist/`, produced by `build.py`) — everything inlined into one file.
Relative paths only resolve when the folder is served together, so a page opened from
a preview pane, emailed, or dropped somewhere on its own will render unstyled unless
it's the inlined copy. Regenerate any time with:

```bash
python3 build.py
```

Host the split files. Share the `dist/` ones.

## Publishing

Live at **https://cafe-helado.github.io/options-visually/**, served by GitHub Pages
from the root of `main` in `github.com/cafe-helado/options-visually`.

There is no CI and no build step, so publishing is a push:

```bash
node check.js                          # never skip this
git add -A && git commit -m "..."
git push
```

Pages redeploys on every push to `main` and is usually live in under a minute.

A few things that are load-bearing:

- **`.nojekyll`** — without it GitHub runs Jekyll, which ignores files and folders
  beginning with an underscore. Keep it.
- **`.gitattributes`** — forces LF. `check.js` finds each page's script with a regex
  expecting a bare LF after `<script>`, so a CRLF checkout makes it extract nothing
  and skip every JavaScript check while still printing a pass.
- **Relative paths everywhere**, so the site works at a subpath without configuration.
  For a custom domain, add a `CNAME` file containing the domain.
- **`dist/` is gitignored and is not what gets hosted.** The site serves the split
  files so `assets/` caches across the series.

## Local preview

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening the file directly with `file://` also works, since there are no fetches.

## Scripts

| script | what it does |
|---|---|
| `node check.js` | Pre-flight every page. Run before every commit — it is the only safety net. |
| `python3 mkpage.py body.html script.js out.html "Title" "Description"` | Assemble a page from fragments. |
| `python3 build.py` | Inline assets into `dist/` for standalone distribution. |

## Adding a page

1. `cp template.html surface.html`
2. Fill in the title, meta description, and the `serieshead` number.
3. Write chapters using the anatomy in the template.
4. Add one figure block per canvas, registering each with `sliders(..., "key")`.
5. List every draw function inside `drawAll()`. `LAB.boot(drawAll)` handles the rest —
   first paint, webfont reflow, resize, orientation change, and table wrapping.
6. Add an entry to `index.html`: copy a `.entry` block, drop the `planned` class,
   set the status to `live`.

## Verify before publishing

There is no build step, so nothing catches mistakes for you. Run:

```bash
node check.js                 # every page
node check.js surface.html    # one page
```

It checks parsing against the engine, missing and duplicate element ids, broken
internal links, equations without a plain-English reading, self-marking questions with
no answer, presets naming unregistered slider groups, and executes every page under a
stubbed DOM to catch runtime errors a parse check would miss.

<details><summary>The equivalent one-liners, if you want them individually</summary>

```bash
# 1. does the page parse together with the engine?
node -e '
const fs=require("fs"), f=process.argv[1];
const h=fs.readFileSync(f,"utf8"), lab=fs.readFileSync("assets/lab.js","utf8");
const m=h.match(/<script>\n"use strict";([\s\S]*?)<\/script>/);
new Function(lab+"\n"+(m?m[1]:"")); console.log("parse OK");
' surface.html

# 2. does every getElementById target actually exist?
node -e '
const fs=require("fs"), f=process.argv[1];
const h=fs.readFileSync(f,"utf8"), lab=fs.readFileSync("assets/lab.js","utf8");
const ids=new Set([...h.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const refs=[...new Set([...(h+lab).matchAll(/getElementById\("([^"]+)"\)/g)].map(m=>m[1]))];
const miss=refs.filter(i=>!ids.has(i));
console.log(miss.length?"MISSING: "+miss.join(", "):"all ids resolve");
' surface.html

# 3. every equation has a plain-English reading
node -e '
const h=require("fs").readFileSync(process.argv[1],"utf8");
const e=(h.match(/class="mline"/g)||[]).length, r=(h.match(/class="mread"/g)||[]).length;
console.log(e===r?"all "+e+" equations explained":"UNEXPLAINED: "+(e-r));
' surface.html
```

And verify the arithmetic itself in `node` before it goes in the prose. Doing this on
page 01 caught a claim that was wrong by a factor of nine and a sign convention that
was backwards. If a number appears in the text, compute it first.

## Mobile

`mobile.css` handles it, but two things need care when you write a page:

- **Don't set grid columns with inline `style=`.** They can't be overridden by media
  queries without `!important`. Use a class.
- **Wide tables** get wrapped in a horizontal scroller automatically by `lab.js`.
  Give a table one of the known classes (`rot`, `wtab`, `blot`, `idtab`, `ntab`) so
  it's picked up.

Canvas heights shrink automatically on narrow screens via `cvh()`, which `Fig` applies,
and axis tick density drops so labels don't collide. If you size a canvas manually
rather than through `Fig`, wrap the height in `cvh()` yourself.
</details>
