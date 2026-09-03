# Roadmap

Eleven pages. Each needs a result that is hard to believe from a description and
obvious once you have watched it — if a page has no such moment, it is an article,
not a page in this series.

Dependencies: 02 gates 03, 04 and 07. Everything else can be written in any order.

---

## 01 · The Price of Uncertainty — Black–Scholes  ✅ live

Random paths → distribution → price as a running average → the formula → greeks →
replication → gamma rent → desk drills.

Signature: the delta hedge lands on zero regardless of drift.

---

## 02 · The Surface — why one volatility isn't enough  ✅ live (surface.html)

**Spine:** Black–Scholes assumes one σ. The market quotes a different one for every
strike and expiry. The surface is not a failure of the model; it is the market telling
you what the model's distribution got wrong.

Signature as built: Breeden-Litzenberger. The recovered density reproduces the lognormal
to 0.04% under a flat surface, and a -0.35 skew moves P(finish below 70) from 5.0% to
8.6% while P(above 130) falls from 10.2% to 6.6%.

Second signature: two generators separated by term structure, not shape. Merton jump skew
runs 8.46 vol points at one month and 0.40 at three years; an uncorrelated stochastic-vol
mixture holds 0.56 to 0.33 across the same range. Indistinguishable at one expiry.

Third: sticky-strike vs sticky-delta differ by 0.0972 of delta on a 100-strike six-month
call at 30 vol with -0.35 skew — about 10 shares a contract from a choice of convention.

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

## 03 · Catalyst and Noise — decomposing volatility  ✅ live (catalyst.html)

**Spine:** variance is additive.  σ²T = σ_diff²·T + Σ J².  One equation, whole page.

Verified: two-expiry strip recovers a 25% diffusive vol and a 6% event move exactly
from a 39.5% / 29.1% inverted term structure.

Signature as built: raw term structure (kinked, inverted) beside the event-stripped
curve (flat). A 39.54% front and 29.05% back recover sigma_d = 25.000% and J = 6.000%
exactly, from any pair of expiries.

Also built: the straddle-vs-one-sigma trap. Straddle = E|move| = 0.7979 S sigma sqrt(T),
so at 20 vol / 30 days it is 4.57 against a one-sigma 5.73 — a 25% gap in a number that
gets quoted to two decimals and reasoned about as though it were a standard deviation.

And: a fairly priced earnings straddle has mean ~0, median -0.93, win rate 33%. The gap
between mean and median is the whole behavioural problem with event vol.

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

## 04 · The Structure Zoo — two lenses on the same instrument  ✅ live (structures.html)

**Spine:** an institution buys a *payoff*; a vol fund buys a *greek exposure*. The
same structure gets two orthogonal descriptions. Show both panels at once.

Signature as built: the exposure fingerprint — five bars (direction, realized, vol
level, skew, vol convexity) normalised against a one-lot ATM straddle. Collar and risk
reversal annihilate exactly: largest |sum| across all seven greeks is 0.00e+0.

Unexpected find that became chapter 05: the lizards are CONDITIONAL structures. A jade
lizard only removes upside risk when credit >= call-spread width. At 98 put / 102-104
spread the credit is 3.796 against width 2 and it holds at every vol from 25% to 70%.
At 92 put / 105-110 the credit is 2.357 against width 5 and it fails — that position is
a short strangle with a capped call side, not a jade lizard. Narrow spreads and high vol
make it hold; widening breaks it, which is the opposite of instinct.

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

## 05 · The Market, Not the Model — options microstructure  ✅ live (microstructure.html)

**Spine:** every price in pages 01–04 is a model output. A real option has a bid, an
ask, a queue, and a counterparty who may know something you don't.

Verified: one cent is 0.04 vol points on a 180d ATM option and **11.57 vol points on a
7d 5-delta**. A nickel-wide market is 0.2 vol wide in one case and 58 vol wide in the
other. Tick size is fixed in price and wildly variable in vol.

Verified: a toy dealer-hedging model reproduces pinning, but only above a price-impact
threshold. Long-gamma dealers pull spot to the strike (mean |S_T − K| = 1.50 vs 2.46
unhedged; 19.4% finish within 50c vs 12.2%). Short-gamma dealers push it away (4.41;
0.8% pinned). Below that threshold the effect vanishes into the noise entirely — which
is the honest version of a claim usually made without conditions.

Signature 1: the tick-in-vol table. Explains why far OTM short-dated markets look
absurd, and why market makers quote in vol while screens display price.

Signature 2: the pinning simulator with a price-impact slider, showing the effect
emerge from nothing — and disappear again when flow is small relative to volume.

Signature 3 as built: quote a market yourself. At a 0.20 vol-point half-width you get
filled on 321 of 400 arrivals and lose 31.3. At 3.50 wide you make 2.41 per fill and
trade six times. Interior optimum near 1.2. The informed SHARE of your fills rises as
you widen — informed traders are the last to be deterred, so widening manages the size
of adverse selection and never its composition.

Chapters
- Price quoting vs vol quoting — what a tick is worth, and why it varies by 300x
- What is actually inside a spread — hedge cost, inventory risk, adverse selection,
  fees, edge. Decomposed with sliders
- Where liquidity really sits — volume vs open interest; the ATM front-month
  concentration and what it means for anything outside it
- Legging risk and complex orders — why multi-leg trades are quoted as a package
- Auctions and price improvement — the mechanism, not the current rulebook
- Dealer positioning and hedging flow — the mechanism, the impact condition that makes
  it real, and the explicit caveat that positioning is inferred rather than observed
- Pinning and expiration — the simulator, plus what else pins a stock
- What a market maker's day optimizes — and why it is not "predicting the stock"

Two constraints on writing it
- **Plumbing rots.** Exchange counts, fee schedules and auction names change. Teach
  mechanisms; date anything venue-specific and expect to revise it
- **Do not overclaim dealer gamma.** The narrative is popular and usually stated
  without the flow-size condition. The page's value is including the condition

---

## 06 · Executing the Hedge — algos, dark pools, ETFs  ✅ live (execution.html)

**Spine:** page 01 proved replication works and never charged for it. Every rebalance
is an order that pays a spread and moves the market. Put the bill back in.

Verified: short one 90d ATM call at 28 vol, 5bp cost on traded notional. Hedging error
falls like 1/sqrt(N) (sd*sqrt(N) flat at 4.4-5.2). Transaction cost climbs. The
objective E[loss] + lambda*sd is a clean U with an interior minimum that moves with
risk aversion:

      N        8      32      64     128     256     512
   lam=0.5  0.887   0.566   0.475  *0.457*  0.478   0.548
   lam=2.0  3.289   1.840   1.392   1.109   0.967  *0.934*

Honest caveat: cost approaches sqrt(N) only asymptotically (ratio 1.76 vs predicted
2.0 between N=128 and 512). At low N the initial hedge and final unwind dominate.

Signature 1: the U-curve, with sliders for cost in bps and risk aversion. This is the
honest ending to page 01 chapter 06 — "hedge continuously" becomes a corner solution
that is wrong as soon as trading costs anything.

Signature 2 as built: one uniform execution buying into a rising market scores -0.00
against interval VWAP (exactly on benchmark) and +1.47 against arrival. Same fills. One
report says the algo did its job, the other says it cost a point and a half. VWAP
forgives trend and punishes deviation; arrival punishes delay.

Signature 3: dark pool adverse selection. Rest at the midpoint, get filled, and watch
what happens next. Fills cluster right before adverse moves. Same lesson as page 05's
market-making sim, taken from the other side of the trade.

Chapters
- The missing line item — costs added to page 01's replication; the U-curve
- Impact vs timing risk — trade fast and pay certain impact, trade slow and take
  uncertain drift. Why the optimal trajectory is neither instant nor uniform
- The algo menu — TWAP, VWAP, POV/participation, implementation shortfall, MOC/close,
  liquidity-seeking, pegged and midpoint, iceberg. Each mapped to what it optimizes,
  and when it is the wrong tool
- Benchmarks disagree — arrival vs interval VWAP vs close. The same fills, three
  verdicts. Pick the benchmark and you have picked the answer
- Dark venues — midpoint matching, no pre-trade transparency, block crossing, minimum
  quantity, information leakage, and why dark fills are adversely selected
- ETFs as the hedge — creation and redemption, authorised participants, the arbitrage
  band that holds price to NAV, why ETF liquidity is inherited from the basket rather
  than intrinsic, ETF options vs index options on settlement and exercise style, and
  beta-hedging a single name with residual basis risk
- Where it breaks — impact models are fitted rather than observed, slippage attribution
  is contentious, and the close is crowded

Interactive for the ETF chapter: price vs NAV with the creation/redemption band, where
raising creation cost visibly loosens tracking.

Relationship to 05: siblings. 05 is what happens when you are the one quoting; 06 is
what happens when you are the one taking. They could merge into one longer page if the
series needs to be shorter.

---

## 07 · Parity, Boxes and Rolls — arbitrage as construction  ✅ live

**Spine:** put–call parity is not an identity to memorize, it is a machine for
building one instrument out of others. Everything here is that machine applied twice.

Signature as built: the same few thousand paths run through three positions. Long stock
sd 14.39, delta-hedged short call sd 0.63, conversion sd **0.000000** — a vertical line,
not a narrow distribution. The middle panel is page 01's replication chapter replayed,
which makes the contrast the point: hedging is an approximation that improves with
effort, a conversion is an identity that needs none.

Second signature: switch on early assignment (exercise iff put value < dividend) and the
vertical line splits in two. At a $1.50 dividend, 33% of paths get assigned and the mean
falls to -0.40. The "riskless" trade has a second mode.

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

## 08 · A Decision Worth Exactly Nothing  ✅ live (early-exercise.html)

**Spine:** the American premium is the value of a decision, and most of the time that
value is zero. Knowing exactly when it is not is a real edge and is mostly arithmetic.

Signature as built: American and European priced in the *same* CRR tree, with a residual
panel underneath. Across 600 cases — spot 60 to 180, expiries one month to two years,
vol 15% to 60%, rates 0% to 10% — the worst gap is **1.85e-13**. The panel does not lift
off the axis for any slider. Switch the contract to a put and it lifts immediately.

The unifier that turned out to organise the whole page: **exercising early costs exactly
the option's time value**, and parity splits time value into two named pieces.

    time value  =  K(1 - e^-r.tau)  +  p(S)
                   interest floor     insurance

Checked live against the pricer; worst residual over 1,728 ITM cases is **4.42e-14**.
Every chapter is then the same subtraction with a different quantity on the left:
a dividend (03), the interest on the strike (04), a tender premium (09).

Second signature: the call rule is **exact** — after the ex-date there are no more
dividends, so the surviving call is European and parity prices it with no approximation.
The put rule is not, and the page shows the gap. The one-line European test overshoots
the tree's true boundary by **6.9 to 9.5 points of spot** at three to six months, in the
direction that over-exercises. Use it to rule out, never to rule in.

Verified numbers
- The interest floor is a hard filter needing no vol and no spot: on a 100 strike at
  4.5%, a dividend must clear 8.6c at a week, 36.9c at a month, $1.10 at three months.
  The breakeven dividend decays *to* the floor and never below it — at 45 days it is
  4.36 at S=104, 1.27 at S=112, 0.5541 at S=140 against a floor of 0.5533.
- Put early-exercise premium is made of rates: on a 1y 100-strike put at 30 vol, S=80,
  it is 0.000 at r=0, 1.439 at 4.5% (7.2% of the European), 5.090 at 12% (34%). At zero
  rates the boundary does not exist at any time remaining.
- Volatility moves the put boundary the opposite way to instinct: 87 at 15 vol, 42 at
  60 vol, nine months out at 4.5%.
- Assignment is binomial, not proportional. Short 50 contracts into a 40% exercise
  fraction: 2,000 shares expected, sd 346, and only a **33.5%** chance of landing within
  one contract of the mean.
- Pin risk quantified: settle at 100.02 short ten 100-strike calls and you collect $20
  of intrinsic against $2,205 of one-day and $3,820 of weekend risk — **191x**.
- Ratio adjustments preserve everything. A 2:1 split moves position value, dollar delta,
  gamma cash and vega with residual 0.00e+0 (3:2 gives -9.09e-13); only share delta
  scales. Black-Scholes is homogeneous of degree one, so a split is a change of units.
- A composition change does not. An all-cash deal at $85 on a stock at $84 sends the
  6-month 90 call from 7.80 to **zero** and the 85 call from 9.85 to zero, while the
  70 call falls 18.48 to 14.67 and vega goes to zero everywhere. The stock goes up and
  every call on it goes down.
- Tender offers are the third exercise trigger and reuse the same equation with the
  tender premium in the dividend's place. Deal vol collapses, so the insurance half of
  the hurdle vanishes and the floor is nearly the whole cost — which is why tenders
  produce early exercise so reliably.

Chapters as built
- The right to exercise early is worth zero — the residual panel, and the one-line proof
- Exercising early costs exactly the time value — the identity table, interest + insurance
- Only a dividend can pay for it — the boundary S*(tau), draggable, and the hard filter
- The put runs on interest instead — the tree boundary against the shortcut that overshoots
- The screen you run the night before — a live chain, sorted by edge, with dollars at stake
- Assignment is a lottery you are already in — the binomial and its dollar consequence
- Twenty dollars of intrinsic, two thousand of risk — pin risk and exercise by exception
- A ratio change survives; a composition change does not — corporate actions
- The third reason nobody writes down — tender offers and the net-long requirement
- Drills — interest floor, exercise edge, expected assignment, adjusted strikes

Constraint honoured throughout: the mathematics is checked numerically, the market
plumbing (auto-exercise thresholds, allocation method, tender rules) is labelled as
convention, dated, and taught as mechanism rather than rulebook.

---

## 09 · Variance, Volatility, and the Log Contract

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

## 10 · Dispersion and Correlation

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

## 11 · The Book

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
- **05 needs no other page but 01**, and is the one whose content sounds most like
  someone who has sat on a desk.
- **06 closes the loop on page 01.** Its U-curve is the honest ending to the
  replication chapter, so it reads as a sequel rather than a detour.
- **07 and 08** can be written from existing desk knowledge rather than research, and
  08 in particular has no good treatment anywhere online.
- **11 last.** It is the capstone and assumes everything.
- Reuse page 01's math primer by reference. Later pages should link back rather than
  re-explain, and add primer sections only for genuinely new machinery
  (Breeden–Litzenberger in 02, quadratic variation in 03, adverse selection in 05,
  impact and timing risk in 06, static replication in 09).
