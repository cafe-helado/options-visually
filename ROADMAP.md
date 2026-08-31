# Roadmap

Nine pages. Each needs a result that is hard to believe from a description and
obvious once you have watched it — if a page has no such moment, it is an article,
not a page in this series.

Dependencies: 02 gates 03, 04 and 07. Everything else can be written in any order.

---

## 01 · The Price of Uncertainty — Black–Scholes  ✅ live

Random paths → distribution → price as a running average → the formula → greeks →
replication → gamma rent → desk drills.

Signature: the delta hedge lands on zero regardless of drift.

---

## 02 · The Surface — why one volatility isn't enough

**Spine:** Black–Scholes assumes one σ. The market quotes a different one for every
strike and expiry. The surface is not a failure of the model; it is the market telling
you what the model's distribution got wrong.

Signature: draw a smile, invert it to the implied *distribution*, and show the fat left
tail appear. The smile and the distribution are the same statement.

Chapters
- One vol per option — build the surface from quoted prices; implied vol as a price in
  different units
- Reading the smile as a distribution — Breeden–Litzenberger; the second derivative of
  price with respect to strike is the risk-neutral density
- Two generators — jumps and stochastic vol each produce a smile. Simulate both, show
  they are distinguishable by term structure behaviour, not by shape at one expiry
- Term structure — why the front is jumpier; the roots of contango and backwardation
- Sticky strike vs sticky delta vs sticky moneyness — the same spot move gives three
  different mark-to-markets. Show the greek consequences
- Skew and the greeks — vanna as the bridge; why your delta is model-dependent
- Where it breaks — arbitrage constraints on a surface (calendar and butterfly), and
  what an inadmissible surface implies

---

## 03 · Catalyst and Noise — decomposing volatility

**Spine:** variance is additive.  σ²T = σ_diff²·T + Σ J².  One equation, whole page.

Verified: two-expiry strip recovers a 25% diffusive vol and a 6% event move exactly
from a 39.5% / 29.1% inverted term structure.

Signature: raw IV term structure (kinked, inverted, apparently arbitrary) beside the
event-stripped curve (smooth, flat). The mess was one number hiding in the curve.

Second signature: the straddle price *is* the expected absolute move.
straddle = E|S_T − S| = √(2/π)·S·σ√T, confirmed to three decimals across tenors.
The 0.8 in the rule of thumb is √(2/π) = 0.7979.

Chapters
- Two kinds of moves — diffusion vs jump; variance adds, volatility does not.
  Simulate a path with an event in it and watch quadratic variation step
- Not all days are equal — vol-day weighting. Editable grid: weekends ≈ 0.2, holidays
  low, earnings day ≈ 3–4 normal days. Fair term structure computed from the weights
- Stripping the event — the two-expiry solve. Drag either expiry, read σ_diff and J
- The implied move — J in dollars; straddle-derived move vs one-standard-deviation
  move, which are not the same number and get conflated constantly
- Through the print — simulate a long earnings straddle several thousand times. The
  P&L distribution is left-skewed: mostly small losses, occasional large wins. That
  shape is why the trade feels wrong when it is right
- Expressing it — calendars, because the front/back relationship is the trade
- Where it breaks — leakage into pre-event vol, multiple catalysts inside one expiry,
  guidance vs print, non-earnings catalysts (FDA, court, macro prints)

---

## 04 · The Structure Zoo — two lenses on the same instrument

**Spine:** an institution buys a *payoff*; a vol fund buys a *greek exposure*. The
same structure gets two orthogonal descriptions. Show both panels at once.

Signature: the **exposure fingerprint** — five bars per structure (vol level,
realized-vs-implied, skew, term structure, vol convexity). A corporate's zero-cost
collar and a vol fund's risk reversal have identical fingerprints with opposite sign.
Same trade, two vocabularies, opposite sides of it.

Chapters
- What each side is solving for — worst case, budget, mandate, accounting treatment
  vs exposure, carry, convexity, cost to hedge
- The institutional shelf — covered calls and systematic overwriting, protective puts,
  zero-cost collars, cash-secured puts, put spread collars, tail hedges, capped calls
  against convertible issuance
- The vol fund shelf — straddles and strangles, calendars, diagonals, risk reversals,
  flies and condors, ratio spreads and backspreads, variance swaps, dispersion
- The fingerprint — the taxonomy figure; every structure mapped onto the surface axis
  it actually expresses
- The bridge — persistent institutional flow shapes the surface, and vol funds are
  largely the other side of it. The chapter that makes this more than a glossary
- One trade, two books — walk a single structure through both lenses end to end,
  including how each side hedges and what each considers a win

---

## 05 · Parity, Boxes and Rolls — arbitrage as construction

**Spine:** put–call parity is not an identity to memorize, it is a machine for
building one instrument out of others. Everything here is that machine applied twice.

Signature: an interactive where you assemble a synthetic stock from options and watch
its P&L track real stock to the penny — then break it by changing the financing rate
and watch the gap open exactly as much as theory says.

Chapters
- Parity as construction — synthetic stock, synthetic call, synthetic put
- The conversion and the reversal — what you are really long when you are "flat"
- The box — a loan wearing an options costume; solving for the implied financing rate
- The jelly roll — the calendar version, and where the dividend and rate assumptions
  actually enter
- Pin risk, exercise risk, and what goes wrong on expiration
- Where it breaks — borrow cost, hard-to-borrow names, early exercise on the American
  legs, and why the "arbitrage" has a funding desk attached

---

## 06 · Early Exercise and Assignment

**Spine:** the American premium is the value of a decision, and most of the time that
value is zero. Knowing exactly when it is not is a real edge and is mostly arithmetic.

Signature: the exercise boundary as a live curve you can drag a dividend across —
watch the optimal-exercise region appear and vanish.

Chapters
- Why an American call on a non-dividend payer is never exercised early — and the
  one-line proof
- Dividends change that — the boundary condition, and the screen you run the night
  before an ex-date
- American puts are different — rates, not dividends, drive it
- Assignment mechanics — random allocation, what actually lands in your account
- Pin risk on expiration and the do-not-exercise decision
- Corporate actions — adjusted deliverables, ratio changes, merger elections, and why
  the greeks survive a clean ratio adjustment but not a composition change
- Tender offers and 14e-4 — the compliance edge nobody writes about

---

## 07 · Variance, Volatility, and the Log Contract

**Spine:** variance is replicable with a static strip of options; volatility is not.
That asymmetry is the whole subject.

Signature: build the replicating strip live, weight each option by 1/K², and watch the
payoff converge onto a log contract as you add strikes.

Chapters
- Variance vs volatility — why the square matters, and Jensen striking again
- The log contract — the payoff whose delta hedge accumulates realized variance
- The replicating strip — 1/K² weights; convergence as strikes are added
- Variance swaps — what they actually pay, and the convexity that makes var ≠ vol²
- VIX — the index as an implementation of the strip, and what its quirks are
- Where it breaks — discrete strikes, truncated wings, jumps, and why the wings matter
  far more than intuition suggests

---

## 08 · Dispersion and Correlation

**Spine:** index variance is a weighted sum of single-name variances plus a correlation
term. Trade the difference and you are trading correlation, whether you meant to or not.

Signature: a live dispersion basket — sell index vol, buy the components, and watch the
P&L decompose into the correlation term.

Chapters
- Index vol vs the sum of its parts — the algebra
- Implied correlation — extracting it, and what levels have historically meant
- The dispersion trade — how it is actually put on and what it costs to carry
- Why implied correlation is persistently rich — and what flow makes it so
- Where it breaks — correlation goes to one exactly when you need it not to

---

## 09 · The Book

**Spine:** everything so far has been one option. A book is a portfolio, and portfolio
risk is not the sum of the parts.

Signature: a full scenario matrix — spot × vol grid, P&L in every cell, with the
greek-predicted number beside the full reprice so the reader sees where local
approximations stop working.

Chapters
- Aggregating greeks — what adds, what doesn't
- The scenario matrix — the thing risk managers actually look at
- Bucketed vega — why one vega number across the term structure is a lie
- Limits, stops, and what a risk manager is really asking
- Hedging cost vs hedging error — the rebalancing frequency optimization, with costs
- Reading a real risk report end to end

---

## Notes on sequencing

- **02 first.** Both 03 and 04 need smile and term-structure vocabulary; 07 needs it too.
- **05 and 06** are the two that can be written from existing desk knowledge rather than
  research, and 06 in particular has no good treatment anywhere online.
- **09 last.** It is the capstone and assumes everything.
- Reuse page 01's math primer by reference. Later pages should link back rather than
  re-explain, and add primer sections only for genuinely new machinery
  (Breeden–Litzenberger in 02, quadratic variation in 03, static replication in 07).
