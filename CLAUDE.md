# Options, visually — working notes

An interactive series on options theory. Static HTML, no framework, no build step,
no dependencies. All eleven pages live.

## Before you change anything

**Run `node check.js`.** It is the only safety net — there is no compiler and no test
framework. It parses each page against the engine, verifies every `getElementById`
target exists, catches duplicate ids, resolves internal links, confirms every equation
has a plain-English reading, checks each self-marking question has an answer, and
executes every page end to end under a stubbed DOM. Run it before every commit.

## The rule that produces everything else

**Never explain a thing before the reader has watched it happen.** Page 01 withholds
the Black–Scholes formula until chapter four because by then the reader has already
seen the price assemble itself from simulated payoffs. The formula arrives as a summary
of something witnessed, not a fact to accept.

When planning a page, the question is: *what is the simulation or interaction that makes
the conclusion obvious, and what is the minimum the reader needs to understand it?*
Order the chapters from that answer. A chapter whose figure could be replaced by a
sentence is prose, and should be folded into its neighbour.

## Verify the arithmetic before it reaches the prose

This is not optional and it has repeatedly paid for itself. Write a throwaway node
script, compute the numbers, then write the sentence. Doing this caught:

- a claim about vol-time equivalence wrong by a factor of nine (page 01)
- a sign convention backwards on charm — it is `+∂θ/∂S`, not minus (page 01)
- three wrong worked examples in a source document, where the spreadsheet it
  disagreed with was right (page 07)
- a jade lizard that was not a jade lizard, because the credit did not cover the
  spread width — which became a whole chapter (page 04)
- a benchmark demonstration where both algorithms agreed, defeating the point,
  until the case was re-derived (page 06)
- an interest floor quoted as $1.47 when it is $1.49, caught by a harness that
  recomputes every number in the prose from the code that ships (page 08)
- a variance swap payoff coded in decimals when vega notional is dollars per
  volatility *point* — a clean 100x error that surfaced only because the prose
  carried independently computed numbers to check against (page 09)

If a number appears in the text, it was computed first. Where a figure rests on an
assumption that cannot be measured — price impact, dealer positioning, spread
composition — put the parameter on a slider and label it as an assumption in the prose.

## Repo shape

```
index.html            series landing; entry list must match ROADMAP.md
<page>.html           one file per page, self-contained apart from assets/
assets/lab.css        design system: tokens, typography, every component
assets/mobile.css     phone corrections and touch targets
assets/lab.js         engine: Black–Scholes + greeks, plotting, sliders,
                      teaching layer, tooltips, scroll chrome, LAB.boot
template.html         copy this to start a page
mkpage.py             assembles a page from a body fragment + a script fragment
build.py              inlines assets into dist/ for standalone distribution
check.js              pre-flight; run before every commit
ROADMAP.md            all eleven pages, with verified numbers for unbuilt ones
STYLE-GUIDE.md        design tokens, chapter anatomy, non-negotiables
README.md             publishing and how to add a page
```

## Adding a page

1. Read `STYLE-GUIDE.md` for the chapter anatomy, then `template.html`.
2. Check `ROADMAP.md` — the planned pages already have their spine, signature
   interaction and verified numbers written down.
3. Write `<name>_body.html` and `<name>_js.js`, then
   `python3 mkpage.py <name>_body.html <name>_js.js <name>.html "Title" "Description"`.
4. `node check.js <name>.html` until it passes.
5. Add the entry to `index.html` (copy a `.entry`, drop `planned`, set `st live`)
   and mark the page live in `ROADMAP.md`.
6. `python3 build.py` to regenerate `dist/`.

Delete the `_body`/`_js` fragments once assembled — `<name>.html` is the source of
truth after that, and is edited directly.

## Two forms of every page, and the trap

**Split** (repo root) links to `assets/`. This is what gets hosted; the engine is
cached across the series so each page after the first costs ~40KB rather than ~230KB.

**Inlined** (`dist/`, via `build.py`) has everything embedded. Use this for anything
opened on its own — preview panes, email, sending someone a single file.

Opening a split page in isolation produces unstyled raw HTML, because the relative
asset paths resolve to nothing. That is expected, not a fault. It has caused confusion
twice; if a page ever looks like plain HTML, check which build it is before debugging.

## Engine API

`bs(S,K,T,v,r,q,isCall)` returns price and all greeks including vanna, volga and charm.
`gbm(S0,mu,sig,T,n)` a price path; `gauss()` one normal draw; `ncdf`/`npdf`.
`Fig(canvas,{h,x0,x1,y0,y1,pad})` → `{g,X(),Y(),P,pw,ph}`; then `axes`, `line`,
`vline`, `clip`, `kvHTML`. `sliders(host,specs,state,onChange,key)` — the fifth
argument registers the group so `data-preset` buttons can drive it. `preset(key,patch,focusId)`.
`C("--blue")` reads a design token. `NARROW()` is true on phones. `cvh(px)` scales a
canvas height — `Fig` applies it, so call it yourself only when sizing a canvas manually.
`LAB.boot(drawAll)` handles first paint, webfont reflow, resize, orientation change
and table wrapping.

Colours: `--blue` primary · `--verm` risk/counterpoint · `--moss` positive/proof ·
`--ochre` markers · `--grey` secondary · `--ink` text.

## Mobile

`mobile.css` handles it, with two things to remember when writing a page: never set
grid columns with an inline `style=` (media queries cannot override without
`!important`), and give wide tables one of the wrappable classes — `rot`, `wtab`,
`blot`, `idtab`, `ntab` — so `lab.js` puts them in a horizontal scroller.

## What is left

Nothing unbuilt — all eleven pages are live. Work from here is depth rather than
coverage. `ROADMAP.md` records what each page actually shipped, including the
verified numbers.

## Two traps this repo has already fallen into twice

**`check.js` can pass vacuously.** It finds the page script with a regex that expects
an opening `<script>` followed by a bare LF, so a file written with CRLF line endings
extracts an empty string and
*every* JavaScript check silently skips — the page "passes" having been barely read.
`mkpage.py` now writes with `newline=""` to keep LF. If a page passes suspiciously
fast, confirm the extraction matched before believing it.

**Grid items blow out the layout on phones.** A `.split` column defaults to
`min-width:auto`, so a wide child — a `.tblwrap` holding a 440px table — widens the
column past the viewport. Because `body` sets `overflow-x:hidden`, the result is not
a sideways scroll but silent *clipping*: ~60px of the control rail became unreachable
on a 390px screen, on five of the seven pages, for months. `lab.css` now sets
`.split>*{min-width:0}`. When adding a figure, check `documentElement.scrollWidth`
against `clientWidth` at 360px before shipping.
