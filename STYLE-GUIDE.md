# Building more pages in this style

The repo is a static site: `index.html` (series landing), one HTML file per page, and
`assets/` holding the shared engine. Copy `template.html`, delete the example chapter,
write yours. See README.md for publishing and the pre-flight checks.

The engine lives in `assets/lab.js` and the design system in `assets/lab.css`. Pages
carry only their own figures and prose, so a second page costs about 40KB rather than
230KB, and the shared assets are cached across the series after the first visit.

## The one rule that makes this style work

**Never explain a thing before the reader has watched it happen.** Black–Scholes
withholds the formula until chapter four because the reader has already seen the
price assemble itself from simulated payoffs. By the time the formula appears it is
a *summary of something they watched*, not a new fact to accept.

Apply this to any topic by asking: what is the simulation or interaction that makes
the conclusion obvious, and what is the minimum the reader needs to understand it?
Order the chapters from that answer. If a chapter's figure could be replaced by a
sentence, the chapter is prose and should be folded into its neighbour.

## Chapter anatomy

Every chapter is the same seven slots, in this order. Skip any except the first three.

1. `.chead` — number, title stating a *claim*, one-line dek
2. `.prose` — lead paragraph gets the drop cap; state the idea fully before qualifying
3. `figure.bleed` with `.split.wide` — figure left, controls rail right
4. `.mline` + `.mread` — an equation and its plain-English reading
5. `.try` — a prediction, then a button that configures the figure
6. `.check` — one question, self-marking, explanation either way
7. `details.derive` — the algebra, ending with where it breaks in practice

## Non-negotiables

- **Every `.mline` gets a `.mread`.** No equation appears without a sentence a person
  would say out loud. This is the single highest-leverage rule in the whole system.
- **Every piece of jargon gets a `.term` gloss** on first use. Write the definition
  saying what the thing is *for*, not just what it is.
- **Derivations end with "where it breaks."** Naming the failing assumption is what
  separates teaching from reciting.
- **Captions say what to notice**, never what the axes are. The axes are labelled.
- **Distractors in `.check` must be real misconceptions**, not filler. If you can't
  think of three things someone actually believes wrongly, the question is too easy.
- **Verify the arithmetic before writing it.** Every number in the Black–Scholes page
  was checked in node first, and doing that caught a claim wrong by a factor of nine.

## Design tokens

Ground `--chalk` #EDF0EC cool bone · ink `--ink` #14181A
`--blue` #1F4CE8 primary signal · `--verm` #E5432C counterpoint, risk, decay
`--moss` #0E9463 positive, proof, "it worked" · `--ochre` #E0A215 markers, attention
`--grey` #8B928C secondary

Fraunces (display) / Newsreader (body) / IBM Plex Mono (all numbers, labels, axes).
Prose in serif, every number in mono — the split is what makes it read as a text
rather than a dashboard. Figures have hairline axes and no frames.

Spend boldness in exactly one place per page. Here it was the live hero simulation;
everything else is quiet.

## Wiring a Try-this button

The last argument to `sliders(...)` registers the widget under a key:

    sliders(host, specs, state, ()=>draw(), "c1");

Then any button can drive it:

    <button data-preset="c1" data-patch='{"sig":0.9}' data-focus="cv1" data-then="run1">

`data-patch` keys must exist on the state object; `data-focus` scrolls to a canvas;
`data-then` clicks another button afterwards. Validate all three before shipping —
a silent typo here produces a dead button, which is worse than no button.

## Making a page useful to a practitioner, not just a reader

Two additions turned the Black-Scholes page from an explainer into something a junior
could actually train on. Both generalize.

**A units chapter.** Model outputs are per-share and dimensionless; real positions are
not. Any page about a quantitative topic should have a chapter that does the
multiplication chain explicitly — model number, multiplier, position size, dollars —
and a live blotter where the reader builds a position and reads its risk the way a
desk would print it. This is where most of the real-world confusion lives, and almost
no explainer covers it.

**A drill generator.** Understanding is not fluency. Randomized numeric questions with
a tolerance band, a streak counter, and the working shown every time (right or wrong)
is what converts one into the other. Free numeric entry beats multiple choice here:
estimation under time pressure is the actual skill. Keep two difficulty tiers, and
exercise the generator headlessly over a few thousand draws before shipping — a drill
that marks a correct answer wrong is worse than no drill.

**Rules of thumb need measured error bars.** If you give someone a shortcut, quantify
how wrong it is and in which direction. The ATM theta approximation here understates
by 5-13% because it omits rate carry, and saying so is what makes it safe to use.

## Two components worth reusing

**The identity table.** When a topic has algebraic relationships that hold exactly,
compute both sides live and show the residual in a column. Asserting "these are equal"
is weak; showing a residual sitting at 1e-14 while the reader drags a slider is not.
Used in chapter 5 for the greek identities and chapter 7 for the PDE.

**The multi-axis explorer.** Most explanations show a quantity against one axis. Show
it against three (spot, time, vol) with chips to switch which quantity. The panel
people never see is usually the one that settles the argument — for the greeks it's
the time axis, which is where gamma and vega visibly diverge.

## Candidate next pages

Ordered by how much the interaction would add over prose:

- **The volatility surface** — smile and term structure, why they exist, what a
  sticky-strike vs sticky-delta assumption does to your delta. The interaction:
  drag the surface, watch a book's greeks change.
- **Put-call parity and the box** — arbitrage as a construction rather than a formula.
  Conversion/reversal, the jelly roll, and where the financing actually sits.
- **Early exercise** — the American call/put asymmetry, dividend capture, and the
  screen you'd actually run. Interaction: a boundary that moves as you drag the div.
- **Skew and the smile's origin** — jump risk and stochastic vol as two generators of
  the same shape, with a simulation that produces a smile from each.
- **Variance swaps** — why a log contract replicates variance, the strip of options,
  and where the replication fails in practice.

Each of these has the property that made the Black–Scholes page work: a result that
is hard to believe from a description and obvious once you've watched it.


## Series conventions

**One bold moment per page, and it goes in the hero.** Page 01 uses a live GBM field.
Whatever a page's equivalent is, it should be native to the subject and it should be
the only place the design raises its voice.

**Number the pages, and mean it.** The `serieshead` bar carries `No. 0X`. Pages don't
have to be read in order, but each should name its prerequisites in the Start-here
block rather than silently assuming them.

**Reuse the math primer by reference.** Page 01's chapter M covers e, logs, expectation,
the normal distribution, √T scaling, derivatives, Jensen, and Itô. Later pages should
link back to it instead of re-explaining, and only add primer sections for genuinely
new machinery.

**Mobile is not an afterthought.** Never set grid columns with inline `style=` — they
can't be overridden by media queries. Give tables one of the wrappable classes. Size
canvases through `Fig` so `cvh()` applies, and if you size one manually, call `cvh()`
yourself.
