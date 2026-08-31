# Options, visually

An interactive series on options theory. Static HTML, no framework, no build step.
Open any file directly in a browser and it runs.

```
index.html            series landing page
black-scholes.html    No. 01 — The Price of Uncertainty
template.html         copy this to start a new page
assets/
  lab.css             design system: tokens, typography, every component
  mobile.css          phone/tablet corrections and touch targets
  lab.js              engine: Black–Scholes, plotting, controls, teaching layer
.nojekyll             tells GitHub Pages to serve files as-is
```

## Publishing to GitHub Pages

1. Create a repo and push these files to the **root** of the `main` branch.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. It goes live at `https://<user>.github.io/<repo>/` in a minute or two.

`.nojekyll` matters: without it GitHub runs Jekyll, which ignores files and folders
beginning with an underscore. Keep it.

Everything is relative-path linked, so it works at a subpath (`/options-visually/`)
without configuration. For a custom domain, add a `CNAME` file containing the domain.

## Local preview

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening the file directly with `file://` also works, since there are no fetches.

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

There is no build step, so nothing catches mistakes for you. Run these:

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
