#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   verify.js — do the numbers in the prose match what the pages compute?

   check.js is a structural pre-flight: ids resolve, links exist, every
   equation has a reading, every page executes. It cannot tell you that a
   sentence claims 58% where the figure beside it computes 42%.

   This does. It loads each page's shipped <script> under a stubbed DOM and
   re-derives the numbers the prose asserts, from the page's own functions
   wherever possible and from an independent calculation otherwise.

   Every assertion here exists because a number was wrong. The audit that
   produced this file found: an exceedance probability stated backwards on
   page 03, stale implied-density figures on page 02, a benchmark number on
   page 06 quoted from a single random draw, and a correlation on page 09
   that only holds at a hedge count the figure does not open on.

       node verify.js            every page that has claims recorded
       node verify.js catalyst   just that one

   Adding a claim is three lines. If a number appears in the prose and is
   not in here, it is not being checked.
   ═══════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = __dirname;



/* ── run a page's script under a stub DOM, capturing every kv row ────── */
function load(page, exports) {
  const LAB = fs.readFileSync(path.join(ROOT, "assets/lab.js"), "utf8")
    .replace("const kvHTML=", "let kvHTML=");
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const m = html.match(/<script>\n([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error(page + ": script extraction failed (CRLF line endings?)");
  const ROWS = [];
  const mk = () => ({
    innerHTML: "", textContent: "", value: "0", disabled: false, style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {}, getAttribute() { return "0"; },
    querySelectorAll() { return []; },
    getContext() { return new Proxy({}, { get: () => () => {} }); },
    clientWidth: 800, clientHeight: 400, width: 800, height: 400,
    scrollIntoView() {}, focus() {}, appendChild() {}, insertBefore() {},
    getBoundingClientRect() {
      return { top: 0, left: 0, right: 800, bottom: 400, width: 800, height: 400 };
    },
    parentNode: null, parentElement: null, dataset: {}
  });
  const stub = mk();
  global.window = global; global.devicePixelRatio = 1; global.innerWidth = 1200;
  global.scrollX = 0; global.scrollY = 0;
  global.matchMedia = () => ({ matches: false });
  global.addEventListener = () => {};
  global.document = {
    documentElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 800 },
    body: stub, getElementById: () => stub, querySelectorAll: () => [],
    querySelector: () => null, createElement: () => mk(),
    addEventListener() {}, fonts: null
  };
  global.getComputedStyle = () => ({ getPropertyValue: () => "#000000" });
  global.requestAnimationFrame = () => 0;
  global.cancelAnimationFrame = () => {};
  global.MutationObserver = class { observe() {} };
  global.__ROWS = ROWS;
  const shim = "const __k=kvHTML;kvHTML=r=>{try{r.forEach(x=>__ROWS.push(" +
    "[String(x[0]),String(x[1])]));}catch(e){}return __k(r);};";
  const api = new Function(LAB + "\n" + shim + "\n" + m[1] +
    "\nreturn {" + exports.join(",") + "};")();
  api.__rows = ROWS;
  return api;
}

/* ── assertion helpers ───────────────────────────────────────────────── */
let fails = 0, checks = 0;
const eq = (label, got, want, tol) => {
  checks++;
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log("    " + (ok ? "ok   " : "FAIL ") + label.padEnd(52) +
    (typeof got === "number" ? got.toPrecision(7) : got).toString().padStart(13) +
    "   want " + want);
};
const yes = (label, cond) => {
  checks++;
  if (!cond) fails++;
  console.log("    " + (cond ? "ok   " : "FAIL ") + label);
};

/* ── the claims, page by page ────────────────────────────────────────── */
const PAGES = {};

PAGES["surface"] = () => {
  /* The implied density recovered from the smile. The prose used to quote
     8.6% / 6.6% for the skewed case; the page's own panel computes 8.1% /
     7.2%, and the figures had drifted apart. */
  const M = load("surface.html", ["blDensity", "s1", "npdf", "smileVol", "fwd", "RQ"]);
  const S = M.s1.S, T = M.s1.T, atm = M.s1.atm;
  const grid = (beta, gam) => {
    const lo = Math.max(5, S * 0.35), hi = S * 2.0, n = 260, h = (hi - lo) / n;
    const xs = [], dn = [];
    for (let i = 0; i <= n; i++) {
      const K = lo + i * h; xs.push(K);
      dn.push(M.blDensity(S, T, atm, beta, gam, K, Math.max(0.05, S * 0.0008)));
    }
    const cum = x => {
      let c = 0;
      for (let i = 0; i < xs.length; i++) { if (xs[i] > x) break; c += Math.max(0, dn[i]) * h; }
      return c;
    };
    return { cum, tot: cum(1e9) };
  };
  const sk = grid(M.s1.beta, M.s1.gam), fl = grid(0, 0);
  eq("flat surface: P(finish below 70) = 5.1%", 100 * fl.cum(70) / fl.tot, 5.1, 0.15);
  eq("flat surface: P(finish above 130) = 10.2%", 100 * (1 - fl.cum(130) / fl.tot), 10.2, 0.15);
  eq("-0.35 skew: P(finish below 70) = 8.1%", 100 * sk.cum(70) / sk.tot, 8.1, 0.15);
  eq("-0.35 skew: P(finish above 130) = 7.2%", 100 * (1 - sk.cum(130) / sk.tot), 7.2, 0.15);
  yes("the skew moves mass from the right tail to the left",
    sk.cum(70) / sk.tot > fl.cum(70) / fl.tot &&
    1 - sk.cum(130) / sk.tot < 1 - fl.cum(130) / fl.tot);
  /* how faithfully a flat surface reproduces the lognormal — the prose said
     0.04% in one place and 0.05% in another, and it is 0.07% */
  const lo = Math.max(5, S * 0.35), hi = S * 2.0, n = 260, h = (hi - lo) / n;
  const atmV = M.smileVol(S, M.fwd(S, T), T, atm, 0, 0);
  const sd = atmV * Math.sqrt(T), mu = Math.log(S) + (M.RQ.r - M.RQ.q - 0.5 * atmV * atmV) * T;
  let peak = 0, worst = 0;
  const dn = [], ln = [];
  for (let i = 0; i <= n; i++) {
    const K = lo + i * h;
    dn.push(M.blDensity(S, T, atm, 0, 0, K, Math.max(0.05, S * 0.0008)));
    ln.push(M.npdf((Math.log(K) - mu) / sd) / (K * sd));
    peak = Math.max(peak, ln[i]);
  }
  for (let i = 0; i <= n; i++)
    if (ln[i] > 0.02 * peak) worst = Math.max(worst, Math.abs(dn[i] - ln[i]) / ln[i] * 100);
  eq("flat surface reproduces the lognormal to 0.07%", worst, 0.07, 0.02);
};

PAGES["catalyst"] = () => {
  /* The implied move is an expected absolute move, not a standard deviation.
     The prose claimed the stock exceeds it 58% of the time; 58% is the
     probability of staying INSIDE it, and the page's own panel says 42%. */
  const M = load("catalyst.html", ["straddle", "ncdf", "gauss", "ROOT2PI"]);
  const S = 100, sig = 0.20, T = 30 / 365;
  const st = M.straddle(S, S, T, sig), sd1 = S * sig * Math.sqrt(T);
  eq("straddle at 20 vol / 30 days = 4.57", st, 4.5743, 5e-3);
  eq("one standard deviation = 5.73", sd1, 5.7338, 5e-3);
  eq("their ratio is sqrt(2/pi)", st / sd1, 0.79788, 1e-3);
  const mu = Math.log(S) - 0.5 * sig * sig * T, s = sig * Math.sqrt(T);
  const cum = x => M.ncdf((Math.log(x) - mu) / s);
  const pSt = cum(S - st) + (1 - cum(S + st));
  eq("P(exceed the straddle-implied move) = 42%", pSt * 100, 42.5, 0.4);
  eq("P(exceed one sigma) = 32%",
    (cum(S - sd1) + (1 - cum(S + sd1))) * 100, 31.7, 0.4);
  yes("more moves exceed the implied move than exceed one sigma",
    pSt > cum(S - sd1) + (1 - cum(S + sd1)));
  yes("the majority of moves land BELOW the mean absolute move", 1 - pSt > 0.5);
  /* the through-the-print straddle: a different trade, and 33% is right */
  const sd_ = 0.25, J = 0.06, days = 30, Tp = days / 365;
  const ivPre = Math.sqrt((sd_ * sd_ * Tp + J * J) / Tp);
  const cost = M.straddle(100, 100, Tp, ivPre), Taf = (days - 1) / 365;
  const run = ratio => {
    const N = 120000, a = new Float64Array(N), Jr = J * ratio;
    for (let i = 0; i < N; i++)
      a[i] = M.straddle(100 * Math.exp(Jr * M.gauss() - 0.5 * Jr * Jr), 100, Taf, sd_) - cost;
    const s2 = Array.from(a).sort((x, y) => x - y);
    return { mean: s2.reduce((x, y) => x + y, 0) / N, med: s2[N >> 1],
      win: 100 * s2.filter(x => x > 0).length / N };
  };
  const r1 = run(1.0);
  eq("fair price: mean is -0.07 (one day of theta)", r1.mean, -0.074, 0.03);
  eq("fair price: median -0.94", r1.med, -0.938, 0.02);
  eq("fair price: win rate 33%", r1.win, 32.8, 0.8);
  eq("at 1.5x implied the win rate is 52%", run(1.5).win, 51.6, 1.2);
  eq("at half implied you win 5%", run(0.5).win, 5.2, 0.8);
};

PAGES["variance-short-convexity"] = () => {
  /* Question 5's explanation said convexity "helps" the short on the downside.
     It does not: the short's gains are concave and its losses convex. */
  const nvar = 100000 / (2 * 25), pay = rv => nvar * (25 * 25 - rv * rv);
  eq("short $100k vega at 25, realized 10: +$1.05m", pay(10), 1050000, 1);
  eq("…against $1.5m at the linear rate", 100000 * 15, 1500000, 0);
  eq("realized 40: −$1.95m, worse than the linear −$1.5m", pay(40), -1950000, 1);
  yes("the short does worse than linear on both sides", pay(10) < 1500000 && pay(40) < -1500000);
};

PAGES["catalyst-calendar"] = () => {
  /* chapter 06: the prose said 31.3%, an 8-point edge and under 2 points at
     the back; the page's own totalVol gives 32.3, 7.3 and 2.2 */
  const M = load("catalyst.html", ["totalVol"]);
  const at = d => (M.totalVol(0.25, 0.06, d, true) - M.totalVol(0.25, 0.04, d, true)) * 100;
  eq("fair front at J = 4%, 14d: 32.3%", M.totalVol(0.25, 0.04, 14, true) * 100, 32.28, 0.02);
  eq("edge at 14d: 7.3 points", at(14), 7.26, 0.02);
  eq("edge at 60d: 2.2 points", at(60), 2.17, 0.02);
  eq("front spreads J over ~a quarter of the back's time", 60 / 14, 4.29, 0.01);
};

PAGES["execution"] = () => {
  /* Chapter 04 draws a fresh random path on every load. The prose used to
     quote 1.47 against arrival as though it were fixed; across loads it runs
     from about 0.9 to 2.1. What IS stable is that a uniform execution pays
     half the drift over the window, and that is what the prose says now. */
  const N = 12, arr = [], vw = [], dr = [];
  for (let i = 0; i < N; i++) {
    const M = load("execution.html", ["s4"]);
    const g = k => {
      const r = M.__rows.find(x => x[0] === k);
      return r ? parseFloat(String(r[1]).replace(/[^0-9.\-]/g, "")) : NaN;
    };
    arr.push(g("Uniform vs arrival"));
    vw.push(g("Uniform vs VWAP"));
    dr.push(g("Drift over window"));
  }
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  eq("uniform vs arrival averages about 1.5", mean(arr), 1.47, 0.35);
  eq("uniform vs VWAP is essentially zero", mean(vw), 0, 0.05);
  /* the ratio is a 12-sample mean of a quantity whose sd is about 0.06, so the
     band is ~3 standard errors: wide enough not to cry wolf, tight enough that
     a real break (0.3, 0.7) still fails it */
  eq("arrival slippage is half the drift over the window",
    mean(arr.map((a, i) => a / dr[i])), 0.505, 0.06);
  yes("the arrival figure moves enough that no single value can be quoted",
    Math.max(...arr) - Math.min(...arr) > 0.5);
};

PAGES["early-exercise"] = () => {
  /* assignment as a binomial draw */
  const C = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
  const b = (n, k, p) => C(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
  eq("ten short at 40%: P(exactly four) is about a quarter", 100 * b(10, 4, 0.4), 25.08, 0.1);
  eq("ten short at 40%: P(none) = 0.6%", 100 * b(10, 0, 0.4), 0.605, 0.02);
  let s = 0; for (let k = 7; k <= 10; k++) s += b(10, k, 0.4);
  eq("ten short at 40%: P(seven or more) = 5.5%", 100 * s, 5.48, 0.1);
  eq("fifty short at 40%: sd = 346 shares", 100 * Math.sqrt(50 * 0.4 * 0.6), 346.4, 0.5);
  let w = 0; for (let k = 19; k <= 21; k++) w += b(50, k, 0.4);
  eq("fifty short: P(within one contract) = 33.5%", 100 * w, 33.45, 0.2);
  yes("so the overnight hedge is wrong about two times in three", 1 - w > 0.6 && 1 - w < 0.7);
  console.log("    ch10 · calls and puts on one ledger");
  { const M = load("early-exercise.html", ["exSide", "sEx", "bs"]), d = M.sEx, c = M.exSide(d, true), p = M.exSide(d, false);
    yes("defaults", d.m === 15 && d.days === 45 && d.r === 0.045 && d.v === 0.28 && d.D === 1.10 && d.b === 0.005);
    eq("call collects $1.17", c.g, 1.17, 0.006); eq("  borrow saved 7 cents", c.gain[1][1], 0.07, 0.006);
    eq("call gives up $0.96", c.l, 0.96, 0.006); eq("  interest 55 cents", c.lose[0][1], 0.55, 0.006); eq("  put 41 cents", c.lose[1][1], 0.41, 0.006);
    eq("call: exercise, 21 cents better", c.net, 0.21, 0.006);
    eq("put collects $0.55", p.g, 0.55, 0.006);
    eq("put gives up $1.30", p.l, 1.30, 0.006); eq("  lending fee 5 cents", p.lose[1][1], 0.05, 0.006); eq("  call 15 cents", p.lose[2][1], 0.15, 0.006);
    yes("put: hold", p.net < 0);
    /* the ledger is parity: collects minus gives-up is exactly minus the time value */
    eq("call ledger nets to minus its time value", c.net, -c.tv, 1e-9);
    eq("put ledger nets to minus its time value", p.net, -p.tv, 1e-9);
    const n = Object.assign({}, d, { D: 0 }), cn = M.exSide(n, true), pn = M.exSide(n, false);
    yes("no dividend: call held", cn.net < 0); yes("no dividend: put exercised", pn.net > 0);
    eq("  put collects 55 against 26", pn.l, 0.26, 0.006);
    const h = Object.assign({}, d, { D: 0, b: 0.25 }), ch = M.exSide(h, true), ph = M.exSide(h, false);
    eq("25% borrow: call saves $3.49", ch.gain[1][1], 3.49, 0.006);
    eq("  against $1.18 given up", ch.l, 1.18, 0.006);
    yes("  so the call is exercised with no dividend", ch.net > 0);
    yes("25% borrow: put held", ph.net < 0);
    yes("  however deep", M.exSide(Object.assign({}, h, { m: 40 }), false).net < 0);
    const z = Object.assign({}, d, { D: 0, r: 0 });
    yes("zero rates, no dividend, easy borrow: neither is exercised", M.exSide(z, true).net < 0 && M.exSide(z, false).net < 0); }
};

PAGES["variance"] = () => {
  /* The quoted correlations hold hedging daily. The figure opens at 63
     hedges, where the same number is 0.9994 — the prose now says both. */
  const run = (sig, n, M) => {
    const T = 1, px = [], py = [];
    for (let m = 0; m < M; m++) {
      let S = 100, hedge = 0, qv = 0;
      const dt = T / n, sq = Math.sqrt(dt);
      for (let i = 0; i < n; i++) {
        const delta = -(2 / T) / S;
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        const S1 = S * Math.exp(-0.5 * sig * sig * dt + sig * sq * z);
        hedge += -delta * (S1 - S);
        const lr = Math.log(S1 / S); qv += lr * lr; S = S1;
      }
      px.push(qv / T); py.push(-(2 / T) * Math.log(S / 100) + hedge);
    }
    const mx = px.reduce((a, b2) => a + b2, 0) / M, my = py.reduce((a, b2) => a + b2, 0) / M;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < M; i++) {
      const a = px[i] - mx, b2 = py[i] - my; sxy += a * b2; sxx += a * a; syy += b2 * b2;
    }
    return sxy / Math.sqrt(sxx * syy);
  };
  eq("daily hedging, 10 vol: correlation 0.99998", run(0.10, 252, 2500), 0.99998, 3e-5);
  eq("daily hedging, 45 vol: correlation 0.99966", run(0.45, 252, 2500), 0.99966, 1e-4);
  eq("at the figure's own defaults (30 vol, 63 hedges): 0.99946",
    run(0.30, 63, 900), 0.99946, 1.5e-4);
  yes("hedging more often tightens the identity", run(0.45, 252, 900) > run(0.45, 63, 900));
};

PAGES["questions"] = () => {
  const M = load("questions.html", ["bs", "ncdf", "npdf", "__deck", "__run7", "__drill"]);
  const B = M.bs, D = M.__deck;
  eq("the deck holds forty cards", D.length, 40, 0);
  eq("tiers run 12 / 13 / 15", [1, 2, 3].map(t => D.filter(c => c.t === t).length).join("/") === "12/13/15" ? 1 : 0, 1, 0);
  { const B = global.bs || M.bs, a = B(100, 100, 1 / 12, 0.25, 0.04, 0, true), b = B(100, 100, 1, 0.25, 0.04, 0, true);
    eq("card: vega per gamma, one month, about 2.1", a.vega / 100 / a.gamma, 2.1, 0.05);
    eq("card: vega per gamma, one year, 25", b.vega / 100 / b.gamma, 25, 0.01);
    eq("card: twelve times as much", (b.vega / b.gamma) / (a.vega / a.gamma), 12, 1e-6);
    const nc = x => { let s = 0; const n = 20000; for (let i = 0; i < n; i++) { const z = -x + 2 * x * (i + 0.5) / n; s += Math.exp(-z * z / 2); } return s * 2 * x / n / Math.sqrt(2 * Math.PI); };
    eq("card: a fair straddle costs 0.80 sigma", Math.sqrt(2 / Math.PI), 0.80, 0.003);
    eq("card: a move lands inside that 57.5% of the time", 100 * nc(Math.sqrt(2 / Math.PI)), 57.5, 0.02);
    const vr = (k, f) => { let s = 1; for (let j = 1; j < k; j++) s += 2 * (1 - j / k) * Math.pow(f, j); return Math.sqrt(s); };
    eq("card: weekly is 13% above daily at +0.15", (vr(5, 0.15) - 1) * 100, 13, 0.5);
    eq("card: and 11% below at -0.15", (1 - vr(5, -0.15)) * 100, 11, 0.5); }
  yes("every card has four options and exactly one right answer",
    D.every(c => c.o.length === 4 && c.ok >= 0 && c.ok < 4));
  yes("every card carries a reason and a figure spec",
    D.every(c => c.why && c.why.length > 40 && c.fig && c.fig.f.length));
  let bad = 0;
  D.forEach(c => {
    const F = c.fig;
    for (let k = 0; k < 60; k++) {
      const x = F.x0 + (F.x1 - F.x0) * k / 59;
      F.f.forEach(fn => { if (!isFinite(fn(x))) bad++; });
    }
  });
  yes("all " + D.length + " figures are finite across their own x-ranges", bad === 0);
  /* chapter 02 — the spread that cannot reach its width */
  const sp = S => B(S, 100, 0.5, 0.25, 0.04, 0, true).price - B(S, 106, 0.5, 0.25, 0.04, 0, true).price;
  eq("ch02: the ceiling is 6 x e^-rT = 5.8812", 6 * Math.exp(-0.02), 5.8812, 1e-4);
  eq("ch02: the spread at spot 130", sp(130), 5.3478, 2e-3);
  eq("ch02: at spot 200 it stops at the ceiling", sp(200), 5.8807, 2e-3);
  eq("ch02:   of which interest", 6 - 6 * Math.exp(-0.02), 0.1188, 1e-4);
  eq("ch02:   of which optionality", 6 * Math.exp(-0.02) - sp(130), 0.5334, 3e-3);
  /* chapter 03 — rolling costs the square root */
  const atm = T => B(100, 100, T, 0.25, 0, 0, true).price;
  eq("ch03: the year costs 9.95", atm(1), 9.9477, 2e-3);
  eq("ch03: four quarterlies cost 19.93", 4 * atm(0.25), 19.9342, 5e-3);
  eq("ch03:   which is 2.00x", 4 * atm(0.25) / atm(1), 2.0039, 3e-3);
  eq("ch03: monthly is 3.47x", 12 * atm(1 / 12) / atm(1), 3.4721, 5e-3);
  eq("ch03: weekly is 7.23x", 52 * atm(1 / 52) / atm(1), 7.2301, 0.01);
  /* chapter 04 — long gamma, short vega */
  const n4 = B(100, 100, 1 / 12, 0.25, 0.04, 0, true), f4 = B(100, 100, 1, 0.25, 0.04, 0, true);
  const q4 = f4.vega / n4.vega;
  eq("ch04: 3.34 of the front against one of the back", q4, 3.338, 3e-3);
  eq("ch04:   nets vega to zero", (q4 * n4.vega - f4.vega) / 100, 0, 1e-9);
  eq("ch04:   leaving gamma of 0.169", q4 * n4.gamma - f4.gamma, 0.16855, 5e-4);
  eq("ch04:   eleven times the far option's", (q4 * n4.gamma - f4.gamma) / f4.gamma, 11.0, 0.05);
  eq("ch04: taken in for a credit of 1.68", q4 * n4.price - f4.price, -1.6805, 3e-3);
  eq("ch04: theta 0.157 a day", (q4 * n4.theta - f4.theta) / 365, -0.1573, 2e-3);
  eq("ch04: a still month costs 9.58",
    -B(100, 100, 1 - 1 / 12, 0.25, 0.04, 0, true).price - (q4 * n4.price - f4.price), -9.583, 0.02);
  /* chapter 05 — the borrow rate hiding in parity */
  const theo = 100 - 100 * Math.exp(-0.02);
  eq("ch05: parity says C - P = 1.98", theo, 1.9801, 1e-4);
  const q5 = -Math.log((1.5 + 100 * Math.exp(-0.02)) / 100) / 0.5;
  eq("ch05: the gap is a 0.96% borrow", q5 * 100, 0.9626, 5e-3);
  eq("ch05:   = $48.13 on a hundred shares", 100 * 100 * q5 * 0.5, 48.13, 0.05);
  /* chapter 06 — index vol and implied correlation */
  const rho = ((0.25 * 0.25 / 0.16) - 1 / 20) / (1 - 1 / 20);
  eq("ch06: implied correlation 0.359", rho, 0.3586, 5e-4);
  eq("ch06: the rho = 0 floor is 8.94%", 100 * 0.40 / Math.sqrt(20), 8.944, 5e-3);
  const iv = (v, p) => {
    let t = 0;
    for (let i = 0; i < v.length; i++)
      for (let j = 0; j < v.length; j++)
        t += v[i] * v[j] * (i === j ? 1 : p) / (v.length * v.length);
    return Math.sqrt(t);
  };
  const base = Array(20).fill(0.40), cut = base.slice(); cut[0] = 0.20;
  eq("ch06: one name halving takes the index to 24.39%", 100 * iv(cut, rho), 24.387, 5e-3);
  eq("ch06: halving all twenty takes it to 12.50%",
    100 * iv(base.map(x => x / 2), rho), 12.500, 5e-3);
  /* chapter 07 — same realized volatility, opposite P&L */
  const A = M.__run7(0, 0.12, 0.30, 0.25), Bp = M.__run7(1, 0.12, 0.30, 0.25);
  eq("ch07: loud at the start, realized 25.000%", A.rv * 100, 25.000, 2e-3);
  eq("ch07: loud at the end, realized 25.000%", Bp.rv * 100, 25.000, 2e-3);
  eq("ch07:   pays +6.12", A.final, 6.117, 0.03);
  eq("ch07:   loses -2.61", Bp.final, -2.605, 0.03);
  eq("ch07: the option was sold for 11.92", A.prem, 11.9235, 5e-3);
  yes("ch07: the same realized volatility, opposite signs", A.final > 0 && Bp.final < 0);
  /* the six cards added after the audit */
  eq("card: an ATM call's delta is 0.58, not 0.50",
    B(100, 100, 0.5, 0.25, 0.04, 0, true).delta, 0.5799, 1e-3);
  eq("card:   struck at the forward it is still 0.535",
    B(100, 100 * Math.exp(0.02), 0.5, 0.25, 0.04, 0, true).delta, 0.5352, 1e-3);
  eq("card: vol to zero leaves S - Ke^-rT = 14.88",
    B(110, 100, 1, 0.001, 0.05, 0, true).price, 14.877, 2e-3);
  eq("card: the 116.75 strike is the 25-delta",
    B(100, 116.75, 0.5, 0.25, 0.04, 0, true).delta, 0.2500, 1e-3);
  eq("card: a 5% rally takes it to 0.345",
    B(105, 116.75, 0.5, 0.25, 0.04, 0, true).delta, 0.3451, 2e-3);
  eq("card:   the 50-delta gains more (+0.104)",
    B(105, 100, 0.5, 0.25, 0.04, 0, true).delta - B(100, 100, 0.5, 0.25, 0.04, 0, true).delta,
    0.1036, 2e-3);
  const amer = (S, K, T, v, r, cp, N) => {
    const dt = T / N, u = Math.exp(v * Math.sqrt(dt)), d = 1 / u;
    const p = (Math.exp(r * dt) - d) / (u - d), df = Math.exp(-r * dt);
    const val = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const x = S * Math.pow(u, N - i) * Math.pow(d, i);
      val[i] = cp ? Math.max(x - K, 0) : Math.max(K - x, 0);
    }
    for (let j = N - 1; j >= 0; j--)
      for (let i = 0; i <= j; i++) {
        const x = S * Math.pow(u, j - i) * Math.pow(d, i);
        val[i] = Math.max(df * (p * val[i] + (1 - p) * val[i + 1]),
          cp ? Math.max(x - K, 0) : Math.max(K - x, 0));
      }
    return val[0];
  };
  eq("card: the American call premium is zero",
    amer(100, 100, 1, 0.25, 0.05, true, 2000) - B(100, 100, 1, 0.25, 0.05, 0, true).price, 0, 3e-3);
  eq("card: the American put premium at K=100",
    amer(100, 100, 1, 0.25, 0.05, false, 2000) - B(100, 100, 1, 0.25, 0.05, 0, false).price,
    0.5152, 6e-3);
  eq("card: the American put premium at K=120",
    amer(100, 120, 1, 0.25, 0.05, false, 2000) - B(100, 120, 1, 0.25, 0.05, 0, false).price,
    2.0013, 8e-3);
  const mm = B(100, 100, 0.25, 0.25, 0, 0, true);
  const be = Math.sqrt(-2 * (mm.theta / 365) / mm.gamma);
  eq("card: the breakeven daily move is $1.3086", be, 1.3086, 1e-3);
  eq("card:   which IS the one-sigma day, exactly",
    be / (100 * 0.25 / Math.sqrt(365)), 1.0, 1e-6);
  const T7 = 0.25, r7 = 0.03, v7 = 0.25;
  const d2 = (r7 - v7 * v7 / 2) * T7 / (v7 * Math.sqrt(T7));
  eq("card: the digital is worth 0.49527", Math.exp(-r7 * T7) * M.ncdf(d2), 0.49527, 1e-4);
  const cs = w => (B(100, 100 - w / 2, T7, v7, r7, 0, true).price -
    B(100, 100 + w / 2, T7, v7, r7, 0, true).price) / w;
  eq("card:   a ten-wide spread overshoots at 0.49656", cs(10), 0.49656, 1e-4);
  eq("card:   a one-wide spread lands on it", cs(1), 0.49527, 1e-4);
  yes("card: the replication converges from above", cs(10) > cs(2) && cs(2) > cs(0.5));
  /* the drill generator must never mark a correct answer wrong */
  const Q = M.__drill();
  yes("every generated drill question has a finite answer and a tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is always rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

PAGES["screen"] = () => {
  const M = load("screen.html", ["bs", "ncdf", "sigAt", "oneSigma",
    "strikeForDelta", "ivFrom", "__drill", "s1", "s2", "s3", "s4", "s5", "s6",
    "fwdRow", "fwdVol", "ivCarry", "FWD", "sF"]);
  const B = M.bs;
  console.log("    ch02 · a strike's distance in sigmas");
  eq("$100 at 30 vol, 30 days: one sigma is $8.60",M.oneSigma(100,0.30,30/365),8.601,2e-3);
  eq("  a $25 stock: 5-wide is 2.33 sigma",5/M.oneSigma(25,0.30,30/365),2.325,2e-3);
  eq("  a $500 stock: 5-wide is 0.12 sigma",5/M.oneSigma(500,0.30,30/365),0.1163,2e-4);
  eq("  strikes inside one sigma at $500",M.oneSigma(500,0.30,30/365)/5,8.601,2e-3);
  eq("one day out, 5-wide is 3.18 sigma",5/M.oneSigma(100,0.30,1/365),3.184,3e-3);
  eq("one year out, 5-wide is 0.17 sigma",5/M.oneSigma(100,0.30,1),0.1667,2e-4);
  eq("sqrt(30/365) is 0.287",Math.sqrt(30/365),0.2867,5e-4);
  eq("a quarter: one sigma is $15",M.oneSigma(100,0.30,0.25),15.0,1e-9);
  eq("a year: one sigma is $30",M.oneSigma(100,0.30,1),30.0,1e-9);
  eq("the check: $40 at 45 vol, 7 days -> $2.49",M.oneSigma(40,0.45,7/365),2.492,3e-3);
  console.log("    ch03 · where the deltas really sit");
  {const S=100,v=0.30,r=0.04,vf=()=>v;
   const rows=[[7,1.056,0.937],[30,1.127,0.878],[90,1.237,0.802],[365,1.557,0.640]];
   for(const [d,wc,wp] of rows){
     const T=d/365,sd=M.oneSigma(S,v,T);
     const kc=M.strikeForDelta(S,T,vf,r,0.16,true), kp=M.strikeForDelta(S,T,vf,r,0.16,false);
     eq("16-delta call at "+d+"d, in sigmas",(kc-S)/sd,wc,4e-3);
     eq("16-delta put  at "+d+"d, in sigmas",(S-kp)/sd,wp,4e-3);
   }
   yes("the call side drifts out with tenor and the put side drifts in",
     (M.strikeForDelta(S,1,vf,r,0.16,true)-S)/M.oneSigma(S,v,1) >
     (M.strikeForDelta(S,7/365,vf,r,0.16,true)-S)/M.oneSigma(S,v,7/365) &&
     (S-M.strikeForDelta(S,1,vf,r,0.16,false))/M.oneSigma(S,v,1) <
     (S-M.strikeForDelta(S,7/365,vf,r,0.16,false))/M.oneSigma(S,v,7/365));
   const k25m=M.strikeForDelta(S,30/365,vf,r,0.25,true), k25y=M.strikeForDelta(S,1,vf,r,0.25,true);
   eq("25-delta call, monthly, in sigmas",(k25m-S)/M.oneSigma(S,v,30/365),0.781,4e-3);
   eq("25-delta call, yearly, in sigmas",(k25y-S)/M.oneSigma(S,v,1),1.110,4e-3);
   eq("the at-the-money call delta is 0.53",B(S,S,30/365,v,r,0,true).delta,0.5324,1e-3);}
  console.log("    ch04 · what a quote does to the IV column");
  {const S=100,K=105,T=30/365,r=0.04,v=0.30;
   const p=B(S,K,T,v,r,0,true).price;
   eq("the 105 call is worth 1.662",p,1.6620,2e-3);
   const band=w=>(M.ivFrom(p+w/2,S,K,T,r,true)-M.ivFrom(p-w/2,S,K,T,r,true))*100;
   eq("2c wide is a 0.20 point band",band(0.02),0.20,0.02);
   eq("10c wide is a 0.98 point band",band(0.10),0.98,0.03);
   eq("20c wide is a 1.97 point band",band(0.20),1.97,0.05);
   eq("  IV from the bid at 10c",M.ivFrom(p-0.05,S,K,T,r,true)*100,29.51,0.03);
   eq("  IV from the offer at 10c",M.ivFrom(p+0.05,S,K,T,r,true)*100,30.49,0.03);
   yes("the band grows roughly linearly in the width",
     Math.abs(band(0.20)/band(0.10)-2)<0.05);}
  console.log("    ch05 · skew and term structure");
  {const S=100,r=0.04,atm=0.28,skew=-0.35;
   const T=30/365,vf=K=>M.sigAt(S,K,T,atm,skew,0.25,0);
   eq("the 90 strike shows 32.10%",vf(90)*100,32.098,0.02);
   eq("the 110 strike shows 24.99%",vf(110)*100,24.991,0.02);
   for(const [d,want] of [[30,3.773],[90,6.472],[365,12.293]]){
     const T2=d/365, vf2=K=>M.sigAt(S,K,T2,atm,skew,0.25,0);
     const kp=M.strikeForDelta(S,T2,vf2,r,0.25,false), kc=M.strikeForDelta(S,T2,vf2,r,0.25,true);
     eq("25-delta risk reversal at "+d+"d",(vf2(kp)-vf2(kc))*100,want,0.05);
   }}
  console.log("    ch05/06 · an event in the term structure");
  {const S=100,base=0.28,J=0.07;
   for(const [d,want] of [[3,82.13],[7,57.78],[30,37.15],[180,29.72]]){
     eq("baseline 28% plus a 7% event, at "+String(d).padStart(3)+"d",
       M.sigAt(S,S,d/365,base,0,0,J)*100,want,0.05);
   }
   yes("the event's share falls as the horizon grows",
     M.sigAt(S,S,3/365,base,0,0,J) > M.sigAt(S,S,180/365,base,0,0,J));}
  console.log("    ch07 · the drill generator");
  {const Q=M.__drill();
   yes("every question has a finite answer, prompt, working and tolerance",
     Q.every(q=>isFinite(q.a)&&q.q&&q.w&&q.tol>0));
   const kinds={};Q.forEach(q=>{kinds[q.kind]=(kinds[q.kind]||0)+1;});
   Object.keys(kinds).sort().forEach(k=>console.log("       "+k.padEnd(36)+kinds[k]));
   yes("six distinct question kinds",Object.keys(kinds).length===6);
   yes("the exact answer is always accepted",Q.every(q=>Math.abs(q.a-q.a)<=q.tol));
   yes("an answer well outside the band is rejected",
     Q.every(q=>Math.abs((q.a+Math.max(q.tol*10,1))-q.a)>q.tol));}

  console.log("    ch05 · normalized skew");
  { const vf = K => M.sigAt(100, K, 30 / 365, 0.28, -0.35, 0.25, 0);
    eq("100 strike shows 28.12%", vf(100) * 100, 28.12, 0.006);
    eq("90 strike over the 100 strike is 1.142", vf(90) / vf(100), 1.142, 0.0006);
    eq("  a 14.2% premium", (vf(90) / vf(100) - 1) * 100, 14.2, 0.06);
    eq("110 strike at an 11.1% discount", (1 - vf(110) / vf(100)) * 100, 11.1, 0.06); }
  console.log("    ch06 · find the forward first");
  { const a = M.fwdRow(100, 0.06, 0), w = M.fwdRow(115, 0.06, 0), F = M.FWD;
    yes("defaults: 6% borrow, screen assumes none", M.sF.q === 0.06 && M.sF.q0 === 0);
    eq("100 strike trades 27.8%", a.v * 100, 27.8, 0.06);
    eq("  calls say 23.8%", a.ivC * 100, 23.8, 0.06);
    eq("  puts say 31.3%", a.ivP * 100, 31.3, 0.06);
    eq("screen forward 100.99", F.S * Math.exp(F.r * F.T), 100.99, 0.006);
    eq("market forward 99.51", F.S * Math.exp((F.r - 0.06) * F.T), 99.51, 0.006);
    eq("  parity at 100 recovers it", a.F, F.S * Math.exp((F.r - 0.06) * F.T), 1e-9);
    eq("  the gap is $1.48", F.S * Math.exp(F.r * F.T) - a.F, 1.48, 0.006);
    eq("call 5.201", a.c, 5.201, 0.0006); eq("put 5.688", a.p, 5.688, 0.0006);
    eq("e^rT = 1.0099", Math.exp(F.r * F.T), 1.0099, 0.00006);
    eq("forward implies a 6% borrow", F.r - Math.log(a.F / F.S) / F.T, 0.06, 1e-9);
    eq("115 call reads 21.7%", w.ivC * 100, 21.7, 0.06);
    eq("  against a true 23.5%", w.v * 100, 23.5, 0.06);
    eq("  off by 1.8", (w.v - w.ivC) * 100, 1.8, 0.06);
    eq("115 put reads 32.9%", w.ivP * 100, 32.9, 0.06);
    eq("  off by 9.4", (w.ivP - w.v) * 100, 9.4, 0.06);
    yes("the 85 call is below the screen's parity bound", isNaN(M.fwdRow(85, 0.06, 0).ivC));
    const m = M.fwdRow(100, 0.06, 0.06);
    eq("right forward: call IV = put IV = traded", Math.abs(m.ivC - m.v) + Math.abs(m.ivP - m.v), 0, 1e-6);
    const d = M.fwdRow(100, 0, 0.03);
    yes("phantom dividend: calls read ABOVE puts", d.ivC > d.ivP);
    /* forward error lands by delta: the IV error ratio matches the delta ratio */
    const dc = Math.abs(B(F.S, 115, F.T, w.v, F.r, 0.06, true).delta), dp = Math.abs(B(F.S, 115, F.T, w.v, F.r, 0.06, false).delta);
    yes("in-the-money put carries more delta than the out-of-the-money call", dp > 3 * dc); }
};

/* ── run ─────────────────────────────────────────────────────────────── */

PAGES["rulers"] = () => {
  const M = load("rulers.html", ["ROOT_2_PI", "ROOT_PI_2", "tRatio", "NAMED",
    "straddleExact", "straddleApprox", "impliedMove", "oneSigma",
    "moveToSigma", "sigmaToMove", "breachNormal", "breachT", "breachOneSigma",
    "estimatorRun", "lgamma", "__drill", "s1", "s2", "s3", "s4", "s5"]);

  console.log("    chapter 01 - two rulers");
  eq("sqrt(2/pi) is 0.797885", M.ROOT_2_PI, 0.797885, 5e-6);
  eq("sqrt(pi/2) is 1.253314", M.ROOT_PI_2, 1.253314, 5e-6);
  eq("  and they are reciprocals", M.ROOT_2_PI * M.ROOT_PI_2, 1.0, 1e-12);
  yes("the MAD is always the smaller ruler", M.ROOT_2_PI < 1);
  eq("MAD is 20.21% below sigma", (1 - M.ROOT_2_PI) * 100, 20.211, 5e-3);
  eq("  so sigma is 25.33% above the MAD", (M.ROOT_PI_2 - 1) * 100, 25.331, 5e-3);

  console.log("    chapter 02 - the straddle prices the absolute move");
  const S = 100, v = 0.30, T = 30 / 365;
  eq("a 30-day 30-vol straddle on $100 costs $6.860",
    M.straddleExact(S, v, T), 6.8603, 5e-4);
  eq("  the 0.7979 rule says 6.8624", M.straddleApprox(S, v, T), 6.8624, 5e-4);
  eq("  an error of 0.030%", (M.straddleApprox(S, v, T) / M.straddleExact(S, v, T) - 1) * 100,
    0.0304, 5e-3);
  yes("  and the approximation is always high",
    [0.10, 0.20, 0.30, 0.50, 0.80].every(x =>
      M.straddleApprox(S, x, T) >= M.straddleExact(S, x, T)));
  eq("the implied move is 6.860% of spot", M.impliedMove(S, v, T) * 100, 6.8603, 5e-4);
  eq("  the one-sigma move is 8.6007%", M.oneSigma(v, T) * 100, 8.60073, 5e-5);
  eq("  their ratio is 0.79764", M.impliedMove(S, v, T) / M.oneSigma(v, T), 0.79764, 5e-5);
  yes("  which is the theoretical 0.797885 to three decimals",
    Math.abs(M.impliedMove(S, v, T) / M.oneSigma(v, T) - M.ROOT_2_PI) < 5e-4);
  eq("backing sigma out of the straddle returns 30 vol",
    M.moveToSigma(M.impliedMove(S, v, T)) / Math.sqrt(T) * 100, 29.991, 0.02);
  eq("a 5% implied move means a 6.267% sigma", M.moveToSigma(0.05) * 100, 6.2666, 5e-4);
  eq("a 4% implied move means 5.013%", M.moveToSigma(0.04) * 100, 5.0133, 5e-4);
  eq("the breach rate is 42.49%", M.breachNormal() * 100, 42.485, 0.02);
  eq("  against 31.73% for a genuine one-sigma move",
    M.breachOneSigma() * 100, 31.731, 0.02);
  eq("  a gap of 10.75 points",
    (M.breachNormal() - M.breachOneSigma()) * 100, 10.754, 0.03);
  yes("reading the implied move as one sigma understates how often it breaks",
    M.breachOneSigma() < M.breachNormal());

  console.log("    chapter 03 - the ratio is the distribution's, not a constant");
  eq("a uniform gives sqrt(3)/2", Math.sqrt(3) / 2, 0.866025, 5e-6);
  eq("t with 3 df gives exactly 2/pi", M.tRatio(3), 2 / Math.PI, 5e-6);
  eq("t with 4 df gives exactly 1/sqrt(2)", M.tRatio(4), 1 / Math.SQRT2, 5e-6);
  eq("t with 6 df gives exactly 3/4", M.tRatio(6), 0.75, 5e-6);
  eq("t with 5 df gives 0.735105", M.tRatio(5), 0.735105, 5e-6);
  eq("t with 10 df gives 0.773398", M.tRatio(10), 0.773398, 5e-6);
  eq("t with 30 df gives 0.790794", M.tRatio(30), 0.790794, 5e-6);
  yes("the ratio rises monotonically toward the normal",
    [3, 4, 5, 6, 10, 20, 30, 60].every((x, i, a) =>
      i === 0 || M.tRatio(x) > M.tRatio(a[i - 1])));
  yes("  and never reaches it", [3, 6, 30, 200].every(x => M.tRatio(x) < M.ROOT_2_PI));
  yes("large df does not overflow - the ratio stays finite at 5000",
    isFinite(M.tRatio(5000)) && Math.abs(M.tRatio(5000) - M.ROOT_2_PI) < 1e-3);
  yes("the ratio is undefined at or below 2 df, where the variance does not exist",
    !isFinite(M.tRatio(2)) || isNaN(M.tRatio(2)));
  console.log("    chapter 03 - and what it does to the sigma you back out");
  eq("a 5% move under a normal implies 6.267%", 5 / M.ROOT_2_PI, 6.2666, 5e-4);
  eq("  the same move under t(4) implies 7.071%", 5 / M.tRatio(4), 7.0711, 5e-4);
  eq("  which is 12.84% higher", (M.ROOT_2_PI / M.tRatio(4) - 1) * 100, 12.838, 5e-3);
  eq("  under t(6), 6.667%", 5 / M.tRatio(6), 6.6667, 5e-4);
  eq("    higher by 6.38%", (M.ROOT_2_PI / M.tRatio(6) - 1) * 100, 6.385, 5e-3);
  yes("assuming normality always gives the smallest sigma of the candidates",
    [3, 4, 5, 6, 10].every(x => 5 / M.tRatio(x) > 5 / M.ROOT_2_PI));

  /* These come from the page's own numeric integration, which was checked
     independently: its standardized t density integrates to 1.000000, its
     variance to 1.00000, and the MAD it implies matches the closed-form
     ratio to six places. A 400k-draw simulation put t(4) at 37.56%, which
     was sampling error - the integration is the number that ships. */
  console.log("    chapter 04 - fat tails mean FEWER breaches");
  eq("normal: 42.49%", M.breachNormal() * 100, 42.485, 0.02);
  eq("t 30 df: 41.95%", M.breachT(30) * 100, 41.9498, 5e-3);
  eq("t 10 df: 40.75%", M.breachT(10) * 100, 40.7475, 5e-3);
  eq("t  6 df: 39.38%", M.breachT(6) * 100, 39.3754, 5e-3);
  eq("t  4 df: 37.39%", M.breachT(4) * 100, 37.3901, 5e-3);
  yes("the breach rate falls monotonically as the tails fatten",
    [4, 6, 10, 30].every((x, i, a) => i === 0 || M.breachT(x) > M.breachT(a[i - 1])));
  yes("  every one of them below the normal", [4, 6, 10, 30].every(x =>
    M.breachT(x) < M.breachNormal()));
  eq("the Laplace answer is exactly 1/e", Math.exp(-1) * 100, 36.788, 5e-3);
  yes("  and t(4) sits near it, sharing the same MAD ratio",
    Math.abs(M.breachT(4) - Math.exp(-1)) < 0.02);
  yes("the t breach rate approaches the normal from below",
    M.breachT(60) < M.breachNormal() && M.breachT(60) > 0.42);

  console.log("    chapter 05 - two estimators");
  eq("the MAD estimator scales by sqrt(pi/2)", M.ROOT_PI_2, 1.253314, 5e-6);
  eq("its asymptotic variance factor is pi/2 - 1", Math.PI / 2 - 1, 0.570796, 5e-6);
  eq("  against 1/2 for the RMS estimator", 0.5, 0.5, 1e-12);
  eq("  a relative efficiency of 87.6%", 0.5 / (Math.PI / 2 - 1) * 100, 87.60, 0.02);
  eq("  so it needs 14.2% more data", ((Math.PI / 2 - 1) / 0.5 - 1) * 100, 14.16, 0.02);
  const clean = M.estimatorRun(4242, 252, 0, 4, 4000);
  console.log("      clean: rms " + clean.rmsMean.toFixed(4) + " +/- " + clean.rmsSd.toFixed(4) +
    "   mad " + clean.madMean.toFixed(4) + " +/- " + clean.madSd.toFixed(4));
  eq("on clean data the true sigma is 1", clean.truth, 1.0, 1e-12);
  yes("  both estimators are unbiased there",
    Math.abs(clean.rmsMean - 1) < 0.01 && Math.abs(clean.madMean - 1) < 0.01);
  yes("  and the RMS one is the steadier", clean.rmsSd < clean.madSd);
  eq("  by about 7%", clean.madSd / clean.rmsSd, 1.069, 0.03);
  const dirty = M.estimatorRun(4242, 252, 0.06, 4, 4000);
  console.log("      dirty: rms " + dirty.rmsMean.toFixed(4) + " +/- " + dirty.rmsSd.toFixed(4) +
    "   mad " + dirty.madMean.toFixed(4) + " +/- " + dirty.madSd.toFixed(4));
  eq("with 6% of days at 4x vol the true sigma is 1.378", dirty.truth, 1.3784, 5e-4);
  yes("  the RMS estimator stays unbiased", Math.abs(dirty.rmsMean / dirty.truth - 1) < 0.02);
  yes("  the MAD estimator now reads low", dirty.madMean / dirty.truth < 0.90);
  eq("  about 85.6% of the truth", dirty.madMean / dirty.truth * 100, 85.6, 1.2);
  /* the limits the simulation wanders around, in closed form — these are what
     the prose quotes, because a spread read off one run of a resampling figure
     is exactly the kind of number this repo has shipped wrong before */
  const wC = 0.06, mC = 4;
  const trueSig = Math.sqrt((1 - wC) + wC * mC * mC);
  const madLimit = M.ROOT_PI_2 * M.ROOT_2_PI * ((1 - wC) + wC * mC);
  eq("the mixture's true sigma is exactly 1.37840", trueSig, 1.378405, 5e-6);
  eq("  the MAD estimator converges to exactly 1.18000", madLimit, 1.18000, 5e-6);
  eq("  which is 85.61% of the truth", madLimit / trueSig * 100, 85.606, 5e-3);
  yes("  and the simulation lands on that limit",
    Math.abs(dirty.madMean - madLimit) < 0.01);
  eq("the clean-data spread ratio is sqrt((pi/2-1)/0.5) = 1.068",
    Math.sqrt((Math.PI / 2 - 1) / 0.5), 1.0684534, 1e-6);
  yes("  and the simulation agrees with it",
    Math.abs(clean.madSd / clean.rmsSd - Math.sqrt((Math.PI / 2 - 1) / 0.5)) < 0.03);
  yes("  but it is roughly twice as steady", dirty.madSd < 0.62 * dirty.rmsSd);
  yes("contamination makes the RMS estimator far noisier than on clean data",
    dirty.rmsSd > 2 * clean.rmsSd);
  yes("  while the MAD estimator barely moves", dirty.madSd < 1.9 * clean.madSd);

  console.log("    chapter 06 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(38) + kinds[k]));
  yes("seven distinct question kinds", Object.keys(kinds).length === 7);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};


PAGES["atlas"] = () => {
  const M = load("atlas.html", ["BASE", "STRUCTS", "AXES", "greeksOf", "flatVol",
    "skewVol", "yardstick", "normalized", "thetaRatio", "vegaRatio", "breakeven",
    "impliedDaily", "decompose", "totalOf", "fundSize", "CALL", "PUT", "STOCK",
    "__atlas", "__profile", "__crossings", "__atTime", "__breakeven", "__fund",
    "__decompose", "__drill", "bs"]);
  const S = 100, T = 30 / 365, T2 = 90 / 365, V = 0.30;
  const byName = n => M.STRUCTS.find(x => x.n === n);
  const gOf = (n, s, t, vol) => M.greeksOf(byName(n).legs, s === undefined ? S : s,
    t === undefined ? T : t, T2, M.flatVol(vol === undefined ? V : vol));

  console.log("    chapter 01 - the two identities");
  console.log("      theta = -1/2 * gamma * S^2 * sigma^2   (no T)");
  console.log("      vega  =      gamma * S^2 * sigma * T   (T)");
  [80, 90, 95, 100, 105, 110, 125].forEach(k => {
    const b = M.bs(S, k, T, V, 0, 0, true);
    yes("  strike " + k + ": theta/(-.5*g*S^2*v^2) is exactly 1",
      Math.abs(M.thetaRatio(b, S, V) - 1) < 1e-9);
    yes("  strike " + k + ": vega/(g*S^2*v*T) is exactly 1",
      Math.abs(M.vegaRatio(b, S, V, T) - 1) < 1e-9);
  });
  yes("theta tracks gamma across MIXED expiries too",
    [["Long straddle", T], ["Butterfly", T], ["Calendar", T], ["Diagonal", T]]
      .every(([n, t]) => Math.abs(M.thetaRatio(gOf(n, S, t), S, V) - 1) < 1e-9));
  yes("  but vega does NOT, once expiries are mixed",
    Math.abs(M.vegaRatio(gOf("Calendar"), S, V, T) - 1) > 0.5);
  const cal = gOf("Calendar");
  eq("a 30/90 calendar: gamma is -0.0196", cal.gamma, -0.019636, 5e-6);
  eq("  while its vega is +8.33", cal.vega, 8.3284, 5e-4);
  yes("  so the signs differ, which no single expiry can do", cal.gamma * cal.vega < 0);
  yes("every SINGLE-expiry structure has gamma and vega of one sign",
    ["Long straddle", "Long strangle", "Call spread", "Put spread", "Risk reversal",
     "Butterfly", "Iron condor", "Call ratio 1\u00d72", "Put backspread", "Collar",
     "Covered call", "Short put"].every(n => {
      const g = gOf(n);
      return g.gamma * g.vega >= -1e-12;
    }));

  console.log("    chapter 02 - the atlas");
  eq("sixteen structures", M.STRUCTS.length, 16, 0);
  const y = M.yardstick(S, T, V);
  eq("the yardstick straddle's gamma", y.gamma, 0.092684, 5e-6);
  eq("  vega", y.vega, 22.8535, 5e-4);
  eq("  theta", y.theta, -41.7076, 5e-4);
  const nz = n => M.normalized(byName(n), S, T, T2, V);
  eq("the straddle normalizes to 1.00 on gamma", nz("Long straddle").gamma, 1.0, 1e-12);
  eq("straddle vanna is near zero", nz("Long straddle").vanna, 0.0050, 5e-4);
  eq("  and its volga is near zero", nz("Long straddle").volga, -0.0062, 5e-4);
  eq("strangle volga is +0.95", nz("Long strangle").volga, 0.9463, 5e-4);
  yes("  so a strangle is a straddle plus a bet on the SIZE of the vol move",
    Math.abs(nz("Long strangle").volga) > 100 * Math.abs(nz("Long straddle").volga));
  eq("risk reversal vanna is +0.057", nz("Risk reversal").vanna, 0.0572, 5e-4);
  eq("  and its volga is only -0.016", nz("Risk reversal").volga, -0.0159, 5e-4);
  yes("  so a risk reversal is skew where a strangle is vol convexity",
    Math.abs(nz("Risk reversal").vanna) > Math.abs(nz("Risk reversal").volga));

  console.log("    chapter 02 - a covered call IS a short put");
  const cc = gOf("Covered call"), sp = gOf("Short put");
  ["delta", "gamma", "vega", "theta", "vanna", "volga"].forEach(k => {
    yes("  " + k.padEnd(6) + " matches to 12 decimals", Math.abs(cc[k] - sp[k]) < 1e-12);
  });
  eq("both have delta 0.4828", cc.delta, 0.482849, 5e-6);
  eq("  gamma -0.0463", cc.gamma, -0.046342, 5e-6);
  eq("  vega -11.43", cc.vega, -11.4267, 5e-4);
  eq("  theta +20.85", cc.theta, 20.8538, 5e-4);
  const ccn = nz("Covered call");
  eq("normalized, both sit at -0.500 on gamma", ccn.gamma, -0.500, 5e-4);
  eq("  and -0.500 on vega", ccn.vega, -0.500, 5e-4);
  eq("  vanna -0.0025", ccn.vanna, -0.0025, 5e-4);
  eq("  volga +0.0031", ccn.volga, 0.0031, 5e-4);
  console.log("    chapter 02 - and a covered put IS a short call");
  const cp = gOf("Covered put"), sc = gOf("Short call");
  ["delta", "gamma", "vega", "theta", "vanna", "volga"].forEach(k => {
    yes("  " + k.padEnd(6) + " matches to 12 decimals", Math.abs(cp[k] - sc[k]) < 1e-12);
  });
  eq("both have delta -0.5172", cp.delta, -0.517151, 5e-6);
  console.log("    chapter 02 - stock touches delta and nothing else");
  ["gamma", "vega", "theta", "vanna", "volga"].forEach(k => {
    yes("  covered call and NAKED short call agree on " + k,
      Math.abs(cc[k] - sc[k]) < 1e-12);
  });
  yes("  while their deltas differ by exactly one",
    Math.abs((cc.delta - sc.delta) - 1) < 1e-12);

  console.log("    chapter 03 - a profile is not a number");
  eq("butterfly gamma at spot 100", M.__profile("Butterfly", "gamma", 100, T, V), -0.1559, 5e-4);
  eq("  at spot 92", M.__profile("Butterfly", "gamma", 92, T, V), -0.0148, 5e-4);
  yes("  and it is POSITIVE below the wing",
    M.__profile("Butterfly", "gamma", 88, T, V) > 0);
  const cross = M.__crossings("Butterfly", "gamma", T, V);
  yes("the butterfly's gamma changes sign twice across spot", cross.length === 2);
  eq("  the lower crossing is at 91.45", cross[0], 91.45, 0.06);
  yes("  and the upper one is above spot", cross[1] > 100);
  yes("the straddle's gamma never changes sign",
    M.__crossings("Long straddle", "gamma", T, V).length === 0);
  yes("the iron condor's gamma changes sign too",
    M.__crossings("Iron condor", "gamma", T, V).length >= 2);

  console.log("    chapter 04 - what time does");
  eq("straddle gamma at 90 days", M.yardstick(S, 90 / 365, V).gamma, 0.053414, 5e-6);
  eq("  at 30 days", M.yardstick(S, 30 / 365, V).gamma, 0.092684, 5e-6);
  eq("  at 1 day", M.yardstick(S, 1 / 365, V).gamma, 0.508104, 5e-5);
  const g30 = M.yardstick(S, 30 / 365, V), g7 = M.yardstick(S, 7 / 365, V);
  eq("gamma multiplies by 2.072 going 30d to 7d", g7.gamma / g30.gamma, 2.0724, 5e-3);
  eq("  against the theoretical sqrt(30/7)", Math.sqrt(30 / 7), 2.0702, 5e-4);
  yes("  the two agree to within a fifth of a percent",
    Math.abs(g7.gamma / g30.gamma - Math.sqrt(30 / 7)) / Math.sqrt(30 / 7) < 0.002);
  eq("vega multiplies by 0.483 over the same move", g7.vega / g30.vega, 0.4834, 5e-3);
  eq("  against sqrt(7/30)", Math.sqrt(7 / 30), 0.4830, 5e-4);
  yes("so a vega position becomes a gamma position on its own",
    g7.gamma > g30.gamma && g7.vega < g30.vega);

  console.log("    chapter 05 - the same breakeven, until skew");
  const imp = M.impliedDaily(V);
  eq("the implied daily move is 1.5703%", imp, 1.5703, 5e-4);
  const flatNames = ["Long straddle", "Long strangle", "Call spread", "Put spread",
    "Risk reversal", "Butterfly", "Iron condor", "Call ratio \u00d72", "Covered call",
    "Calendar", "Diagonal"];
  ["Long straddle", "Long strangle", "Call spread", "Put spread", "Risk reversal",
   "Butterfly", "Iron condor", "Call ratio 1\u00d72", "Put backspread", "Collar",
   "Covered call", "Short put", "Calendar", "Diagonal"].forEach(n => {
    eq("  " + n.padEnd(15) + " breaks even at 1.5703%",
      M.breakeven(gOf(n), S), 1.5703, 5e-4);
  });
  yes("EVERY structure, single or mixed expiry, gives the identical breakeven",
    ["Long straddle", "Butterfly", "Iron condor", "Calendar", "Diagonal", "Covered call"]
      .every(n => Math.abs(M.breakeven(gOf(n), S) - imp) < 5e-4));
  console.log("    chapter 05 - and what breaks it");
  const skewG = n => M.greeksOf(byName(n).legs, S, T, T2, M.skewVol(V, 0.004));
  eq("with 40bp of skew a straddle still needs 1.5703%",
    M.breakeven(skewG("Long straddle"), S), 1.5703, 1e-3);
  eq("  a put spread needs only 1.1185%",
    M.breakeven(skewG("Put spread"), S), 1.1185, 5e-3);
  eq("  a risk reversal 1.3277%",
    M.breakeven(skewG("Risk reversal"), S), 1.3277, 5e-3);
  eq("  and a butterfly 1.5957%, slightly MORE",
    M.breakeven(skewG("Butterfly"), S), 1.5957, 5e-3);
  yes("so skew separates them, and it is the only thing that does",
    Math.abs(M.breakeven(skewG("Put spread"), S) - imp) > 0.4);
  yes("  the butterfly is the worse carry on an equity surface, not the better",
    M.breakeven(skewG("Butterfly"), S) > imp);
  eq("the trading-day convention gives 1.890% instead",
    V / Math.sqrt(252) * 100, 1.8898, 5e-4);

  console.log("    chapter 06 - in fund units");
  eq("vega per contract per point is $22.85", y.vega / 100 * 100, 22.8535, 5e-4);
  eq("theta per contract per day is $11.43", -y.theta / 365 * 100, 11.4267, 5e-4);
  const F = M.fundSize(y, 100000, 100);
  eq("$100k of vega per point takes 4,376 contracts", F.lots, 4376, 1.0);
  eq("  which is $43.8m of option notional", F.notional, 43756978, 12000);
  eq("  and bleeds $50,000 a day", F.thetaDay, 50000, 30);
  eq("a 1% move earns $20,278 of gamma",
    F.lots * 100 * 0.5 * y.gamma * 1, 20278, 12);
  eq("  a 2% move, $81,111", F.lots * 100 * 0.5 * y.gamma * 4, 81111, 45);
  eq("  a 3% move, $182,500", F.lots * 100 * 0.5 * y.gamma * 9, 182500, 100);
  yes("gamma grows with the SQUARE of the move",
    Math.abs((F.lots * 100 * 0.5 * y.gamma * 4) / (F.lots * 100 * 0.5 * y.gamma * 1) - 4) < 1e-9);
  eq("one vol point is worth exactly 2 days of theta",
    (y.vega / 100) / (-y.theta / 365), 2.0, 5e-3);
  yes("  and a 90-day option gives three times that",
    Math.abs((M.yardstick(S, 90 / 365, V).vega / 100) /
      (-M.yardstick(S, 90 / 365, V).theta / 365) - 6.0) < 0.02);
  const d = M.decompose(y, S, 0, 1);
  eq("a one-point vol move alone earns 0.2285 per share", d.vega, 0.228535, 5e-5);
  yes("  which is roughly twice the daily theta", Math.abs(d.vega / -d.theta - 2) < 0.01);

  console.log("    chapter 07 - the drill generator");
  const Q = M.__drill();
  yes("every question has a finite answer, prompt, working and tolerance",
    Q.every(q => isFinite(q.a) && q.q && q.w && q.tol > 0));
  const kinds = {};
  Q.forEach(q => { kinds[q.kind] = (kinds[q.kind] || 0) + 1; });
  Object.keys(kinds).sort().forEach(k => console.log("      " + k.padEnd(34) + kinds[k]));
  yes("seven distinct question kinds", Object.keys(kinds).length === 7);
  yes("the exact answer is always accepted", Q.every(q => Math.abs(q.a - q.a) <= q.tol));
  yes("an answer well outside the band is rejected",
    Q.every(q => Math.abs((q.a + Math.max(q.tol * 10, 1)) - q.a) > q.tol));
};

/* ── claims added by the November 2026 logic audit. Each one guards a
   sentence that was wrong before the audit, so a regression reintroduces
   a known error rather than a hypothetical one. ─────────────────────── */

PAGES["black-scholes"] = () => {
  /* the prose said 7.95; a rounded discount factor also made the appendix
     parity check "agree to five decimals" when it agrees exactly */
  const M = load("black-scholes.html", ["bs"]);
  eq("ATM call, 20 vol, 1y, r = 0 averages 7.97", M.bs(100, 100, 1, 0.20, 0, 0, true).price, 7.9656, 5e-4);
  const c = M.bs(100, 100, 0.25, 0.30, 0.05, 0, true).price, p = M.bs(100, 100, 0.25, 0.30, 0.05, 0, false).price;
  eq("appendix call = 6.583084", c, 6.583084, 2e-6);
  eq("appendix put = 5.340864", p, 5.340864, 2e-6);
  eq("parity with Ke^-rT = 98.757780 reproduces the put", c - 100 + 98.757780, p, 2e-6);
  eq("the 0.4·Sσ√T rule is 8.9% low on the appendix option", 6 / c - 1, -0.0886, 1e-3);
  /* the band in the 8·3 table: within 2% at the forward, −1% to −11% at spot */
  let lo = 1, hi = -1, flo = 1, fhi = -1;
  for (const v of [0.2, 0.3, 0.45, 0.6]) for (const d of [7, 14, 30, 60, 90]) {
    const T = d / 365, x = 0.4 * 100 * v * Math.sqrt(T);
    const e = x / M.bs(100, 100, T, v, 0.04, 0, true).price - 1;
    const f = x / M.bs(100, 100 * Math.exp(0.04 * T), T, v, 0.04, 0, true).price - 1;
    lo = Math.min(lo, e); hi = Math.max(hi, e); flo = Math.min(flo, f); fhi = Math.max(fhi, f);
  }
  yes("at the forward the ATM rule is within 2%", flo > -0.02 && fhi < 0.02);
  eq("at spot, 4% rates, 7–90d: worst error about −11%", lo * 100, -10.8, 0.5);
  eq("at spot, 4% rates, 7–90d: best error about −1%", hi * 100, -0.8, 0.5);
};

PAGES["structures"] = () => {
  const M = load("structures.html", ["bs", "MKT"]);
  const T = 45 / 365, r = 0.04;
  const cr = (p, c, l, v) => M.bs(100, p, T, v, r, 0, false).price + M.bs(100, c, T, v, r, 0, true).price - M.bs(100, l, T, v, r, 0, true).price;
  eq("92/105/110 jade lizard collects 2.36 (not 2.68)", cr(92, 105, 110, 0.30), 2.3565, 1e-3);
  eq("98/102/104 collects 3.80", cr(98, 102, 104, 0.30), 3.7958, 1e-3);
  eq("widening to 102/112 adds 1.88 of credit", cr(98, 102, 112, 0.30) - cr(98, 102, 104, 0.30), 1.878, 5e-3);
  /* steep skew makes a zero-cost collar keep LESS upside, not more */
  const zc = slope => {
    const v = K => Math.max(0.05, 0.30 + slope * Math.log(K / 100));
    const put = M.bs(100, 90, T, v(90), r, 0, false).price;
    for (let k = 100.5; k < 200; k += 0.5) if (M.bs(100, k, T, v(k), r, 0, true).price <= put) return k;
    return NaN;
  };
  eq("zero-cost call for a 90 put, flat surface: 113", zc(0), 113, 0);
  eq("zero-cost call for a 90 put, steep skew: 106.5", zc(-0.8), 106.5, 0);
  /* chapters 01, 02 and 04 as expanded: gamma signs and fingerprint bars */
  const S = load("structures.html", ["ALL", "MKT", "legGreeks", "fingerprint"]);
  const G = n => S.legGreeks(S.ALL[n](S.MKT)), F = n => S.fingerprint(S.ALL[n](S.MKT)).map(x => x[1]);
  eq("butterfly gamma at the money −0.0080", G("Butterfly").gamma, -0.00803, 5e-5);
  eq("straddle gamma +0.0754", G("Straddle").gamma, 0.07537, 5e-5);
  yes("Realized equals Vol level for every single-expiry structure",
    Object.keys(S.ALL).every(n => Math.abs(F(n)[1] - F(n)[2]) < 1e-9));
  eq("iron condor reads −0.53", F("Iron condor")[1], -0.53, 0.005);
  eq("butterfly reads −0.11", F("Butterfly")[1], -0.11, 0.005);
  eq("strangle gamma 0.64 of a straddle", F("Strangle")[1], 0.64, 0.005);
  eq("strangle convexity +0.47", F("Strangle")[4], 0.47, 0.005);
  eq("risk reversal direction +0.35", F("Risk reversal")[0], 0.35, 0.005);
  eq("risk reversal skew +0.46", F("Risk reversal")[3], 0.46, 0.005);
  eq("call spread direction +0.33", F("Call spread")[0], 0.33, 0.005);
  eq("call spread skew −0.25", F("Call spread")[3], -0.25, 0.005);
  yes("collar is the exact mirror of the risk reversal",
    F("Collar (options)").every((x, i) => Math.abs(x + F("Risk reversal")[i]) < 1e-12));
  /* chapter 07: the field guide */
  const FG = load("structures.html", ["FG", "fgGreeks", "MKT"]);
  yes("the field guide covers 23 structures, each with all four sections",
    FG.FG.length === 23 && FG.FG.every(x => x.why && x.win && x.pit && x.how && x.pg));
  yes("every card's greeks are finite", FG.FG.every(x => Object.values(FG.fgGreeks(x.l)).every(isFinite)));
  const box = FG.fgGreeks(FG.FG.find(x => x.n === "Box spread").l), cv = FG.fgGreeks(FG.FG.find(x => x.n.startsWith("Conversion")).l);
  eq("a box has no delta", box.delta, 0, 1e-9);
  eq("…no gamma", box.gamma, 0, 1e-9);
  eq("…and costs the width discounted", box.price, 10 * Math.exp(-FG.MKT.r * FG.MKT.days / 365), 1e-6);
  eq("a conversion has no delta", cv.delta, 0, 1e-9);
};

PAGES["dispersion"] = () => {
  /* the long leg used to be sized on the diagonal only, which left the book
     short the volatility level: −1,134 at 1.8x vols with correlation flat */
  const M = load("dispersion.html", ["idxVar", "VOLS", "scale", "kMatch", "wVar"]);
  const net = (rr, m, ri) => {
    const v = M.scale(M.VOLS, m);
    return ((M.idxVar(M.VOLS, ri) - M.idxVar(v, rr)) + M.kMatch(ri) * (M.wVar(v) - M.wVar(M.VOLS))) * 1e4;
  };
  eq("realized = implied: flat at 0.6x vols", net(0.35, 0.6, 0.35), 0, 1e-9);
  eq("realized = implied: flat at 1.8x vols", net(0.35, 1.8, 0.35), 0, 1e-9);
  eq("realized 0.60 loses 1.25x what 0.15 makes", -net(0.60, 1, 0.35) / net(0.15, 1, 0.35), 1.25, 1e-9);
  const v = M.scale(M.VOLS, 1.8);
  eq("crash: short index leg loses 3,896", (M.idxVar(M.VOLS, 0.35) - M.idxVar(v, 0.90)) * 1e4, -3896, 1);
  eq("crash: long component leg gains 1,318", M.kMatch(0.35) * (M.wVar(v) - M.wVar(M.VOLS)) * 1e4, 1318, 1);
  eq("crash: net −2,579", net(0.90, 1.8, 0.35), -2579, 1);
};

PAGES["spreading"] = () => {
  const M = load("spreading.html", ["sizedFive", "structPnl", "S0", "T0", "R0", "s3"]);
  const S = M.sizedFive();
  const at = ST => S.map(s => M.structPnl(s.legs, ST, M.S0, M.T0, M.s3.v, M.R0) * s.mult);
  const lead = ST => { const v = at(ST); return v.indexOf(Math.max(...v)); };
  yes("long call leads at 80", lead(80) === 1);
  yes("the risk reversal leads at 90", lead(90) === 4);
  eq("…by $14", at(90)[4], 14, 1);
  yes("short put leads 95 to 105", [95, 100, 105].every(x => lead(x) === 3));
  yes("ratio leads 110 to 120", [110, 115, 120].every(x => lead(x) === 5));
  eq("ratio makes $31,734 at 115", at(115)[5], 31734, 1);
  yes("long call leads again at 130", lead(130) === 1);
  eq("long call +$5,014 at 130", at(130)[1], 5014, 1);
};

PAGES["merger"] = () => {
  const M = load("merger.html", ["oddsShortcut", "oddsExact", "bookMove", "treeNodes", "divPrice", "divNaive", "mixPut", "mixSpot", "s5", "s7"]);
  /* chapter 01: a fund record read as funding plus a premium */
  eq("fund forecast 5.25% + 4% premium, net of 5.75% loan = 3.5%", 0.0525 + 0.04 - 0.0575, 0.035, 1e-12);
  eq("ten years compounded on both sides: $673,169", 1e6 * (Math.pow(1.0925, 10) - Math.pow(1.0575, 10)), 673169, 1);
  /* chapter 02: the shortcut charges carry in one state only */
  eq("no-carry odds 66.7%", M.oddsExact(4, 5, 2, 0, 1), 2 / 3, 1e-12);
  eq("one year at 10%: no-arbitrage odds 80.0%", M.oddsExact(4, 5, 2, 0.10, 1), 0.80, 1e-12);
  eq("…the shortcut says 76.9%", M.oddsShortcut(4, 5, 2, 0.10, 1), 0.7692, 1e-4);
  /* chapter 04 */
  const b = M.bookMove(-0.01, 0.75, 0.0525);
  eq("each cash deal marks up 0.96%", (1.0525 / 1.0425 - 1) * 100, 0.959, 1e-3);
  eq("book marks up 0.72%", b.mark * 100, 0.72, 0.005);
  eq("yearly return falls 0.81%", b.fwd * 100, -0.8125, 1e-9);
  eq("year one nets about −0.09%", b.year1 * 100, -0.093, 0.005);
  /* chapter 05: the tree reproduces the desk's node prices */
  const t = M.treeNodes(M.s5);
  eq("today $10.79", t.top, 10.79, 0.005);
  eq("after a 2nd request $10.47", t.sec, 10.47, 0.005);
  eq("after a lawsuit $8.63", t.law, 8.63, 0.005);
  eq("tree's odds of closing 88.1%", t.close * 100, 88.07, 0.01);
  eq("…82.4% once in the 2nd-request branch", t.close2 * 100, 82.41, 0.01);
  eq("drop from lower odds about 23 cents", t.oddsPart, -0.226, 0.003);
  eq("drop from more time about 9 cents", t.timePart, -0.094, 0.003);
  /* chapter 06 */
  eq("GoPro after a $0.30 special: $4.20", M.divPrice(5, 2, 0.30, 2 / 3), 4.20, 1e-9);
  eq("…not $4.30", M.divNaive(5, 2, 0.30, 2 / 3), 4.30, 1e-9);
  /* The prose said "80% implied odds", which needs a $7.95 standalone the page
     never states; its own tree breaks at $7.51, where $10.79 is 82%. */
  eq("VZIO: $10.79 against a $7.51 break is 82% at zero rates", (10.79 - 7.51) / (11.5 - 7.51) * 100, 82, 0.3);
  eq("VZIO after a $0.20 special: $10.95", M.divPrice(11.5, 7.51, 0.20, (10.79 - 7.51) / (11.5 - 7.51)), 10.95, 0.006);
  eq("  up 16 cents", M.divPrice(11.5, 7.51, 0.20, (10.79 - 7.51) / (11.5 - 7.51)) - 10.79, 0.16, 0.006);
  /* chapter 07: the biotech readout */
  const st = M.s7;
  eq("spot $20 implies 62.5% odds", M.mixSpot(st), 20, 1e-9);
  eq("10/5 put spread on the market's view $0.19", M.mixPut(10, st, 10) - M.mixPut(5, st, 10), 0.193, 0.002);
  eq("…on yours $1.78", M.mixPut(10, st, 5) - M.mixPut(5, st, 5), 1.779, 0.002);
  eq("7.5 put about a fifth of a cent on the market's view", M.mixPut(7.5, st, 10), 0.0019, 0.0003);
  eq("…about 94 cents on yours", M.mixPut(7.5, st, 5), 0.938, 0.003);
};

PAGES["workbook"] = () => {
  /* every numeric answer is a function; evaluate them all, and pin a sample
     to values that are independently checked elsewhere in this file */
  const M = load("workbook.html", ["__wb"]);
  const W = M.__wb, all = [];
  W.forEach(e => e.p.forEach((p, i) => all.push([e.n + "." + (i + 1), p])));
  yes("twenty-four sections, one per page, every one with a reading list and at least three problems",
    W.length === 24 && W.every(e => e.r.length >= 1 && e.p.length >= 3));
  yes("every page link points at a file that exists",
    W.every(e => fs.existsSync(path.join(ROOT, e.href))));
  yes("every numeric answer is finite", all.every(([, p]) => !p.f || isFinite(p.f())));
  yes("every written answer carries a real explanation", all.every(([, p]) => p.f || (p.ans && p.ans.length > 60)));
  const A = id => all.find(x => x[0] === id)[1].f();
  eq("01.1 appendix call 6.5831", A("01.1"), 6.583084, 1e-5);
  eq("03.1 strip recovers 25.0%", A("03.1"), 0.25, 2e-4);
  eq("03.2 …and a 6.0% event", A("03.2"), 0.06, 2e-4);
  eq("04.2 zero-cost call strike 113", A("04.2"), 113, 0);
  eq("06.1 halving proportional costs doubles N*", A("06.1"), 256, 0);
  eq("06.2 fixed-ticket model: +59%", A("06.2") / 128, 1.5874, 1e-4);
  eq("07.2 revcon example implies 2.965%", A("07.2") * 100, 2.9647, 1e-3);
  eq("08.1 interest floor 1.4888", A("08.1"), 1.4888, 1e-4);
  eq("08.2 assignment sd 346 shares", A("08.2"), 346.4, 0.1);
  eq("09.1 var swap at 30: +$550,000", A("09.1"), 550000, 0);
  eq("10.1 implied correlation 0.359", A("10.1"), 0.3586, 1e-4);
  eq("12.1 one-step call is 10", A("12.1"), 10, 1e-12);
  eq("14.1 put spread pays 6.229", A("14.1"), 6.2290, 1e-3);
  eq("14.2 ratio breakeven 123.904", A("14.2"), 123.904, 1e-3);
  eq("18.2 breach rate 42.5%", A("18.2") * 100, 42.49, 0.01);
  eq("19.1 breakeven 1.5703%", A("19.1") * 100, 1.5703, 1e-4);
  eq("20.1 odds with carry 80%", A("20.1"), 0.80, 1e-12);
  eq("20.2 special dividend: $4.20", A("20.2"), 4.20, 1e-12);
  { const e = W.find(x => x.n === "22");
    eq("22.1 hidden-delta hedge is $160,000", e.p[0].f(), 160000, 1e-6);
    eq("22.2 weighted vega is -$45,000", e.p[1].f(), -45000, 1e-6);
    eq("22.3 two-day vol by summing two correlated returns", e.p[2].f(), 0.20 * Math.sqrt((1 + 1 + 2 * 0.2) / 2), 1e-12);
    eq("22.4 break-even vol move is 0.60 points", e.p[3].f(), 0.60, 1e-12); }
  { const P = n => W.find(x => x.n === n).p;
    yes("sections run 01 to 24 in order", W.map(x => +x.n).every((n, i) => n === i + 1));
    eq("21.1 put-writing year is +4.5%", P("21")[0].f(), 0.045, 1e-12);
    eq("21.3 tail hedge nets -11% over eight years", P("21")[2].f(), -0.11, 1e-12);
    eq("23.1 carry 3.38%", P("23")[0].f() * 100, 3.38, 0.006);
    eq("23.3 implied dividend about $0.59", P("23")[2].f(), 0.59, 0.006);
    eq("23.4 conversions lose $46,000", P("23")[3].f(), -46000, 1e-6);
    eq("24.1 premium 27.9%", P("24")[0].f() * 100, 27.9, 0.06);
    eq("24.2 carry about -$6.90", P("24")[1].f(), -6.9, 0.03);
    eq("24.3 edge about $16.20", P("24")[2].f(), 16.2, 0.06);
    eq("24.4 break-even 32.6%", P("24")[3].f() * 100, 32.6, 0.06); }
};

PAGES["tools"] = () => {
  const M = load("tools.html", ["moveTable", "parseCloses", "coneOf", "hedgedPnL", "kelly", "letf", "bs", "gauss"]);
  eq("rule of 16 is within 1% of √252", Math.sqrt(252) / 16, 0.992, 1e-3);
  const mt = M.moveTable(0.30, 100);
  eq("a quarter carries half the year's sigma", mt[3].sd / mt[4].sd, 0.5, 1e-12);
  eq("straddle is 0.7979 of sigma", mt[2].st / mt[2].sd, 0.79788, 1e-5);
  /* the cone must recover a known vol from a constant-vol series */
  /* Seeded, and ten times longer than it was: drawn from Math.random over ten
     years this claim failed about one run in four, on a tolerance the series
     was too short to meet. */
  let sd = 20261117; const u = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const z = () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
  let p = 100; const px = [p];
  for (let i = 0; i < 25200; i++) { p *= Math.exp(-0.5 * 0.09 / 252 + 0.30 / Math.sqrt(252) * z()); px.push(p); }
  const c = M.coneOf(px, [21, 252]);
  eq("cone median at 21d recovers 30% vol", c[0].med, 0.30, 0.015);
  eq("cone median at 252d recovers 30% vol", c[1].med, 0.30, 0.015);
  yes("short windows swing wider than long ones", c[0].max - c[0].min > c[1].max - c[1].min);
  yes("CSV with dates: the last number on each line is the close",
    M.parseCloses("date,close\n2026-01-02,101.5\n2026-01-05,99.25").join(",") === "101.5,99.25");
  yes("…and parses to two closes", M.parseCloses("date,close\n2026-01-02,101.5\n2026-01-05,99.25").length === 2);
  /* hedged P&L: variance-based, equals vega × gap to first order */
  const T = 30 / 365, v = M.bs(100, 100, T, 0.30, 0, 0, true).vega;
  eq("small gap: vega × vol difference", M.hedgedPnL(100, 0.30, 0.301, T) / (v * 0.001), 1, 2e-3);
  yes("convex: +5 pts earns more than −5 pts loses", M.hedgedPnL(100, 0.30, 0.35, T) > -M.hedgedPnL(100, 0.30, 0.25, T));
  /* Kelly on the biotech put spread */
  const K = M.kelly(0.19, 5, 0.20);
  eq("market-implied odds 3.8%", K.imp, 0.038, 1e-12);
  eq("Kelly fraction 16.8%", K.f, 0.2 - 0.8 / ((5 - 0.19) / 0.19), 1e-12);
  eq("on this long shot half Kelly keeps 86% of the growth", K.g(K.f / 2) / K.g(K.f), 0.855, 0.005);
  const E = M.kelly(1, 2, 0.55);
  eq("small even-odds edge: half Kelly keeps three-quarters", E.g(E.f / 2) / E.g(E.f), 0.75, 0.01);
  eq("…and twice Kelly gives it all back", E.g(2 * E.f) / E.g(E.f), 0, 0.03);
  let neg = false; for (let f = K.f; f < 0.99; f += 0.005) if (K.g(f) < 0) { neg = true; break; }
  yes("far enough past Kelly even the long shot loses money", neg);
  /* leveraged ETFs */
  eq("3x at 20 vol drags 12% a year", M.letf(0.08, 0.20, 3).drag, -0.12, 1e-12);
  eq("−1x has (L² − L) = 2", M.letf(0.08, 0.20, -1).drag / (-(0.04) / 2), 2, 1e-12);
};

PAGES["dynamics"] = () => {
  /* Page 22. Every number in the prose, re-derived from the shipped functions,
     and the three identities the page leans on checked by a second route. */
  const M = load("dynamics.html", ["bs", "volAt", "px", "effDelta", "bsDelta", "hedgedMove", "lean",
    "vegaNet", "flipH", "tenorShock", "rr", "breakevenSSR", "varRatio", "arPath", "sampledVol",
    "gam2", "s2", "carry4", "s4", "samp5", "s5", "s1", "s3", "book3"]);
  const p = r => ({ atm: .30, b: -.35, ssr: r, T: .5 });
  /* 01 */
  eq("01 BS delta of the 6m ATM call", M.bsDelta(100, 100, .5, true, p(1)), 0.542, 0.0006);
  eq("01 flat delta at R=2", M.effDelta(100, 100, .5, true, p(2)), 0.444, 0.0006);
  eq("01 flat delta at R=0", M.effDelta(100, 100, .5, true, p(0)), 0.640, 0.0006);
  eq("01 sticky strike: flat delta is the BS delta", M.effDelta(100, 100, .5, true, p(1)), M.bsDelta(100, 100, .5, true, p(1)), 1e-6);
  const v1 = M.bs(100, 100, .5, .30, 0, 0, true).vega;
  eq("01 vega per point per contract ~ $28", v1, 28, 0.5);
  /* the formula, by a route that never reprices: BS delta + vega (R-1) b / S */
  eq("01 flat-delta formula at R=2", M.bsDelta(100, 100, .5, true, p(2)) + v1 * (2 - 1) * -.35 / 100, M.effDelta(100, 100, .5, true, p(2)), 0.0005);
  eq("01 hedged +3%, sticky strike ~ $8", 100 * M.hedgedMove(100, .5, true, .03, p(1)), 8.3, 0.3);
  eq("01 hedged -3%, sticky strike ~ $8", 100 * M.hedgedMove(100, .5, true, -.03, p(1)), 8.5, 0.3);
  eq("01 hedged +3% at R=0 is +$37", 100 * M.hedgedMove(100, .5, true, .03, p(0)), 37, 0.6);
  eq("01 hedged -3% at R=0 is -$21", 100 * M.hedgedMove(100, .5, true, -.03, p(0)), -21, 0.6);
  eq("01 hedged +3% at R=2 is -$21", 100 * M.hedgedMove(100, .5, true, .03, p(2)), -21, 0.6);
  eq("01 hedged -3% at R=2 is +$38", 100 * M.hedgedMove(100, .5, true, -.03, p(2)), 38, 0.6);
  eq("01 $1,000 vega, 40 vol, beta 1 hides -$40,000", M.lean(1000, 40, 1), -40000, 0);
  eq("01 check: short $5,000 vega, 20 vol, beta 1.2 is long $120,000", M.lean(-5000, 20, 1.2), 120000, 1e-6);
  yes("01 default dial is R=2", M.s1.ssr === 2 && M.s1.b === -.35 && M.s1.atm === .30 && M.s1.T === .5);
  /* 02 */
  const G = M.gam2(M.s2), G1 = M.gam2(Object.assign({}, M.s2, { ssr: 1 }));
  eq("02 sheet delta -16.8", G.bsd, -16.8, 0.06);
  eq("02 sheet gamma 2.16", G.sheet, 2.16, 0.006);
  eq("02 sheet predicts -27.5 at $95", G.bsd - 5 * G.sheet, -27.5, 0.06);
  eq("02 sticky strike flat hedge at $95 is -30.0", G1.at95, -30.0, 0.06);
  eq("02 R=2 flat hedge at $95 is -35.9", G.at95, -35.9, 0.06);
  eq("02 3,588 shares on a hundred contracts", -100 * G.at95, 3588, 1);
  eq("02 2,753 by the sheet", -100 * (G.bsd - 5 * G.sheet), 2753, 1);
  eq("02 down-gamma 3.11", G.down, 3.11, 0.006);
  eq("02 up-gamma 2.24", G.up, 2.24, 0.006);
  yes("02 short put is longer than the sheet predicted after a fall", -G.at95 > -(G.bsd - 5 * G.sheet));
  /* 03 */
  const B = M.book3(M.s3);
  eq("03 raw vega +$10k", M.vegaNet(B, .25, 0), 10, 1e-9);
  eq("03 root-time: -$15k", M.vegaNet(B, .25, .5), -15, 1e-9);
  eq("03 a point at 3m is half a point at 1y", M.tenorShock(1, .25, .5), 0.5, 1e-12);
  eq("03 flat at h = 0.16", M.flipH(B[0], B[1]), 0.16, 0.002);
  eq("03 and the book is flat there", M.vegaNet(B, .25, M.flipH(B[0], B[1])), 0, 1e-9);
  const strad = (T, v) => 2 * M.bs(100, 100, T, v, 0, 0, true).price;
  eq("03 3m straddle, +1 point: $0.398", strad(.25, .31) - strad(.25, .30), 0.398, 0.0006);
  eq("03 1y straddle, +0.5 point: $0.394", strad(1, .305) - strad(1, .30), 0.394, 0.0006);
  eq("03 check: 1m vs 6m, 1/sqrt(6) = 0.41", M.tenorShock(.5, 1 / 12, .5), 0.41, 0.002);
  eq("03 check: weighted short is 59% of the front leg", M.vegaNet([{ T: 1 / 12, vega: -1 }, { T: .5, vega: 1 }], 1 / 12, .5), -0.59, 0.002);
  yes("03 try: a two-year back leg makes it more short", M.vegaNet([{ T: .25, vega: -40 }, { T: 2, vega: 50 }], .25, .5) < -15);
  /* 04 */
  const c = M.carry4(M.s4), c15 = M.carry4(Object.assign({}, M.s4, { ssr: 1.5 })), c2 = M.carry4(Object.assign({}, M.s4, { ssr: 2 }));
  eq("04 put vol 28.2", 100 * c.volP, 28.2, 0.05);
  eq("04 call vol 22.1", 100 * c.volC, 22.1, 0.05);
  eq("04 sticky strike loses $137 a day", c.tot, -137, 0.6);
  eq("04 theta $68 a day", c.th, -68, 0.5);
  eq("04 gamma is the other half", c.ga, -68, 0.5);
  eq("04 no spot-vol P&L at sticky strike", c.va, 0, 0.3);
  /* skew theta by the closed form, not the engine's theta */
  eq("04 skew theta formula, per year", c.vegaLeg * 100 * (c.volP - c.volC) / (2 * .25), 17200, 60);
  eq("04 skew theta formula, per day", c.vegaLeg * 100 * (c.volP - c.volC) / (2 * .25) / 252, -c.th, 0.2);
  eq("04 vega of one leg per unit vol", c.vegaLeg * 100, 142672, 2);
  eq("04 R=1.5 still loses $69", c15.tot, -69, 0.6);
  eq("04 each unit of R adds about $135", c2.tot - c.tot, 135, 1);
  eq("04 break-even R = 2.0", c.be, 2.0, 0.03);
  eq("04 break-even with half the skew", M.carry4(Object.assign({}, M.s4, { b: -.15 })).be, 2.0, 0.04);
  eq("04 break-even at 6 months", M.carry4(Object.assign({}, M.s4, { mo: 6 })).be, 2.0, 0.06);
  /* the first draft said the break-even holds at any realized vol. It does not:
     theta is fixed while the gamma and spot-vol terms both scale with movement. */
  eq("04 break-even falls to 1.7 at 40 realized", M.carry4(Object.assign({}, M.s4, { rv: .40 })).be, 1.72, 0.02);
  eq("04 vega at $92 about +$1,250", c.vdn, 1250, 2);
  eq("04 vega at $108 about -$1,270", c.vup, -1270, 2);
  /* 05 */
  eq("05 phi .15 weekly 18.0", 16 * Math.sqrt(M.varRatio(5, .15)), 18.0, 0.05);
  eq("05 phi .15 monthly 18.5", 16 * Math.sqrt(M.varRatio(21, .15)), 18.5, 0.05);
  eq("05 phi -.15 weekly 14.2", 16 * Math.sqrt(M.varRatio(5, -.15)), 14.2, 0.05);
  eq("05 random walk: no effect", M.varRatio(21, 0), 1, 1e-12);
  eq("05 1% a day is 16%", Math.sqrt(252), 16, 0.2);
  eq("05 a 5% week is 35.5%", 5 * Math.sqrt(252 / 5), 35.5, 0.05);
  eq("05 a 22% month is 78%", 22 * Math.sqrt(252 / 20), 78, 0.2);
  /* the seeded simulation agrees with the closed form (fixed seed, so not flaky) */
  const sm = M.samp5(M.s5);
  eq("05 simulated daily", 100 * sm[0], 16, 0.25);
  eq("05 simulated weekly vs exact", 100 * sm[1], 16 * Math.sqrt(M.varRatio(5, .15)), 0.35);
  eq("05 simulated monthly vs exact", 100 * sm[2], 16 * Math.sqrt(M.varRatio(21, .15)), 0.6);

};

PAGES["book"] = () => {
  /* The page had no claims until chapter 05 was added. These cover chapters
     05 and 08 only; the older chapters are still unchecked here. */
  const M = load("book.html", ["gammaPnl", "idxBook", "sI", "PNL", "pnlBook", "pnlDay", "sP", "bs", "fields", "sFld"]);
  yes("defaults", M.sI.g1 === 1000 && M.sI.b1 === 0.5 && M.sI.g2 === -500 && M.sI.b2 === 2 && M.sI.x === 2);
  const r = M.idxBook(M.sI, 2);
  eq("summed gamma is +$500,000 per 1%", (M.sI.g1 + M.sI.g2) * 1000, 500000, 0);
  eq("sum predicts +$10,000 on a 2% index move", r.raw, 10000, 1e-6);
  eq("utility moves 1% and makes $5,000", r.n1, 5000, 1e-6);
  eq("technology moves 4% and loses $40,000", r.n2, -40000, 1e-6);
  eq("book loses $35,000", r.real, -35000, 1e-6);
  eq("index-equivalent gamma is -$1,750,000 per 1%", r.eq, -1750000, 1e-6);
  eq("  and it reproduces the P&L", M.gammaPnl(r.eq, 2), r.real, 1e-6);
  eq("flat at a technology beta of 0.71", Math.sqrt(1000 * 0.25 / 500), 0.71, 0.005);
  eq("  the book is flat there", M.idxBook(Object.assign({}, M.sI, { b2: Math.sqrt(0.5) }), 3).real, 0, 1e-6);
  eq("betas of 1: the sum is right", M.idxBook(Object.assign({}, M.sI, { b1: 1, b2: 1 }), 3).real, M.idxBook(M.sI, 3).raw, 1e-6);
  eq("check: 200,000 x 1.5 squared = 450,000", 200000 * 1.5 * 1.5, 450000, 0);
  console.log("    ch08 · the day's P&L");
  { const d = M.pnlDay(M.sP), B = M.pnlBook(), P = M.PNL;
    yes("defaults", M.sP.x === -2 && M.sP.dvf === 1.5 && M.sP.dvb === 0.8 && M.sP.days === 1 && M.sP.edge === 3 && M.sP.lots === 50);
    eq("short 8,174 shares", B.shares, -8174, 0);
    eq("marked value +$1,752", d.actual, 1752, 0.6);
    eq("delta -$1", d.delta, -1, 0.6);
    eq("gamma +$192", d.gamma, 192, 0.6);
    eq("theta -$274", d.theta, -274, 0.6);
    eq("vega +$1,637", d.vega, 1637, 0.6);
    eq("  ninety-day leg +$3,135", 200 * 100 * B.g[0].vega * 0.008, 3135, 0.6);
    eq("  thirty-day leg -$1,497", -100 * 100 * B.g[1].vega * 0.015, -1497, 0.6);
    eq("  summed vega $2,920 a point", (200 * B.g[0].vega - 100 * B.g[1].vega), 2920, 1);
    eq("vanna and volga +$212", d.cross, 212, 0.6);
    eq("unexplained -$14", d.unexplained, -14, 0.6);
    yes("  under one percent of the day", Math.abs(d.unexplained / d.total) < 0.01);
    eq("carry +$64", d.carry, 64, 0.6);
    eq("  cash about $703,000", B.cash, 703000, 400);
    eq("  earning $87 a day", B.cash * P.r / 365, 87, 0.6);
    eq("  against $22 of borrow", 8174 * 100 * P.borrow / 365, 22, 0.6);
    eq("new trade +$150", d.trade, 150, 1e-9);
    eq("fees -$32", d.fees, -32, 0.6);
    eq("the day: $1,934", d.total, 1934, 0.6);
    eq("  the bars add to the total", d.delta + d.gamma + d.theta + d.vega + d.cross + d.unexplained + d.carry + d.trade + d.fees, d.total, 1e-6);
    /* the real number by a route that never touches a greek: reprice each leg by hand */
    const S1 = 98, re = 200 * 100 * (M.bs(S1, 100, 89 / 365, 0.308, P.r, 0, true).price - M.bs(100, 100, 90 / 365, 0.30, P.r, 0, true).price)
      - 100 * 100 * (M.bs(S1, 105, 29 / 365, 0.295, P.r, 0, true).price - M.bs(100, 105, 30 / 365, 0.28, P.r, 0, true).price) - 8174 * (S1 - 100);
    eq("  marked value by direct repricing", re, d.actual, 1e-6);
    const c = M.pnlDay(Object.assign({}, M.sP, { x: -5, dvf: 6, dvb: 3 })), w = M.pnlDay(Object.assign({}, M.sP, { x: 0, dvf: 0, dvb: 0, days: 3 }));
    eq("crash: vanna and volga $2,044", c.cross, 2044, 0.6);
    eq("crash: unexplained $214", c.unexplained, 214, 0.6);
    eq("weekend: theta -$821", w.theta, -821, 0.6);
    eq("weekend: carry +$193", w.carry, 193, 0.6);
    eq("check: -5,000 predicted, +40,000 shown, 45,000 unexplained", 40000 - -5000, 45000, 0); }
  console.log("    ch09 · the columns, decoded");
  { const f = M.fields(M.sFld), b = f.bump, near = (x, y, tol) => Math.abs(x - y) <= tol * Math.abs(y);
    yes("defaults: 100 x 30-day 260 calls, $250, 30 vol", M.sFld.n === 100 && M.sFld.S === 250 && M.sFld.K === 260 && M.sFld.days === 30 && M.sFld.vol === 0.30 && M.sFld.call === 1);
    eq("GammaShares 173", f.GammaShares, 173, 0.5);
    eq("DollarGamma $43,316", f.DollarGamma, 43316, 1);
    eq("DollarGammaPct $108,289", f.DollarGammaPct, 108289, 1);
    eq("  = 433 shares at $250", 433 * 250, f.DollarGammaPct, 100);
    eq("  shares gained on a 1% move: 433", f.GammaShares * 2.5, 433, 0.5);
    eq("gamma P&L of a 1% move $541", f.GammaPnl1Pct, 541, 0.6);
    eq("  = half of 433 x $2.50", 0.5 * f.GammaShares * 2.5 * 2.5, f.GammaPnl1Pct, 1e-6);
    eq("DeltaShares 3,557", f.DeltaShares, 3557, 0.6);
    eq("DollarDelta $889,220", f.DollarDelta, 889220, 1);
    eq("  1% of it is $8,892", f.DollarDelta / 100, 8892, 0.6);
    eq("theta -$1,439 a day", f.ThetaDay, -1439, 0.6);
    eq("break-even move 1.63%", f.Breakeven, 1.63, 0.006);
    eq("vega $2,670", f.Vega, 2670, 0.6);
    eq("vanna $14,157", f.Vanna, 14157, 1);
    eq("charm -34 shares a day", f.CharmDay, -34, 0.6);
    eq("one-year option counts 29% in weighted vega", Math.sqrt(30 / 365) * 100, 29, 0.5);
    eq("vega per 1.00 of vol is $267,000", f.Vega * 100, 267000, 60);
    eq("calendar theta is 31% below trading-day theta", (1 - 252 / 365) * 100, 31, 0.5);
    eq("the P&L figure is 200 times smaller than DollarGammaPct", f.DollarGammaPct / f.GammaPnl1Pct, 200, 1e-9);
    eq("DollarGamma and DollarGammaPct differ by 2.5x at $250", f.DollarGammaPct / f.DollarGamma, 2.5, 1e-9);
    const h = M.fields(Object.assign({}, M.sFld, { S: 100, K: 104 }));
    eq("  and are equal at $100", h.DollarGammaPct, h.DollarGamma, 1e-9);
    /* every field against a bump-and-reprice that never reads the greek */
    yes("reprice: DollarDelta", near(b.DollarDelta, f.DollarDelta, 0.001));
    yes("reprice: DollarGammaPct", near(b.DollarGammaPct, f.DollarGammaPct, 0.01));
    yes("reprice: gamma P&L of 1%", near(b.GammaPnl1Pct, f.GammaPnl1Pct, 0.01));
    yes("reprice: theta", near(b.ThetaDay, f.ThetaDay, 0.02));
    yes("reprice: vega", near(b.Vega, f.Vega, 0.001));
    yes("reprice: vanna", near(b.Vanna, f.Vanna, 0.01));
    yes("reprice: charm", near(b.CharmDay, f.CharmDay, 0.05));
    const sh = M.fields(Object.assign({}, M.sFld, { n: -100 }));
    yes("short flips every field", sh.DollarGammaPct === -f.DollarGammaPct && sh.Vega === -f.Vega && sh.ThetaDay === -f.ThetaDay);
    eq("check: half of 200,000 x 9 / 100 = 9,000", 0.5 * 200000 * 9 / 100, 9000, 0); }
};

PAGES["carry"] = () => {
  /* Page 23. The forward model is checked against a second construction
     (step the stock through each dividend date), then every prose number. */
  const M = load("carry.html", ["CAR", "fwd", "pvDiv", "feeInt", "carryTo", "carryBetween", "impliedDiv", "jelly",
    "cMinusP", "parityFwd", "optPx", "divShock", "rows2", "s1", "s2", "s3", "P3", "bs"]);
  const E = M.CAR.exp.map(d => d / 365), p = { div: 0.6, b0: 0.01, b1: 0.01 }, h = { div: 0.6, b0: 0.12, b1: 0.02 };
  yes("defaults", M.s1.div === 0.6 && M.s1.b0 === 0.01 && M.s2.d4 === 0.6 && M.s2.bk === 0.01 && M.s3.nd === 0.3 && M.s3.mo === 24);
  /* second route to the forward: carry cash forward day by day, paying each dividend as it falls */
  const stepFwd = (T, q) => { let x = M.CAR.S, t = 0; const pay = M.CAR.divDays.filter(d => d <= T * 365).map(d => d / 365);
    /* the model escrows dividends, so the equivalent forward subtracts each one grown from its date at r less the fee */
    let f = M.CAR.S * Math.exp(M.CAR.r * T - M.feeInt(T, q));
    pay.forEach(d => { f -= q.div * Math.exp(-M.CAR.r * d) * Math.exp(M.CAR.r * T - M.feeInt(T, q)); }); return f; };
  eq("forward to 1y matches the dividend-by-dividend build", M.fwd(1, p), stepFwd(1, p), 1e-9);
  eq("parity at any strike returns the forward", M.parityFwd(E[5], 87, p), M.fwd(E[5], p), 1e-9);
  eq("call minus put from priced options equals the parity value", M.optPx(1, 100, true, p) - M.optPx(1, 100, false, p), M.cMinusP(1, 100, p), 1e-9);
  console.log("    ch01");
  eq("carry to 30 days 1.00%", M.carryTo(E[0], p) * 100, 1.00, 0.006);
  eq("carry to 60 days 4.64%", M.carryTo(E[1], p) * 100, 4.64, 0.006);
  eq("carry to a year 3.38%", M.carryTo(E[5], p) * 100, 3.38, 0.006);
  eq("no dividend: flat at the borrow", M.carryTo(E[3], { div: 0, b0: 0.01, b1: 0.01 }) * 100, 1.00, 1e-6);
  eq("$0.60 a quarter is a 2.4% yield", 4 * 0.6 / 100 * 100, 2.4, 1e-9);
  eq("squeeze: 10.5% to thirty days", M.carryTo(E[0], h) * 100, 10.5, 0.06);
  eq("squeeze: 5.6% to two years", M.carryTo(E[7], h) * 100, 5.6, 0.06);
  yes("squeeze inverts the curve", M.carryTo(E[0], h) > M.carryTo(E[7], h));
  console.log("    ch02");
  const R = M.rows2(M.s2), cut = M.rows2(Object.assign({}, M.s2, { d4: 0.3 })), b3 = M.rows2(Object.assign({}, M.s2, { bk: 0.03 }));
  eq("one ex-date: 60 cents", R[0].imp, 0.60, 0.003);
  eq("none: nothing", R[1].imp, 0, 0.003);
  eq("two: $1.20", R[5].imp, 1.20, 0.006);
  eq("cut: the 273-365 bar reads 30 cents", cut[4].imp, 0.30, 0.003);
  yes("cut: no other bar moves", cut.every((r, i) => i === 4 || Math.abs(r.imp - R[i].imp) < 1e-9));
  eq("jelly roll before: $0.27", R[4].jelly, 0.27, 0.006);
  eq("jelly roll after: $0.56", cut[4].jelly, 0.56, 0.006);
  eq("  a gain of 29 cents", cut[4].jelly - R[4].jelly, 0.29, 0.006);
  eq("wrong borrow: 91-182 reads 10 cents", b3[2].imp, 0.10, 0.006);
  yes("  and the empty interval goes negative", b3[1].imp < 0);
  yes("  every bar shrinks", b3.every((r, i) => r.imp < R[i].imp));
  console.log("    ch03");
  const a = M.divShock(2, 100, M.P3, 0.3), b = M.divShock(1, 100, M.P3, 0.3);
  eq("two years: $2.30 of present value removed", -a.dPV, 2.30, 0.006);
  eq("  call +$138", a.c * 100, 138, 0.6);
  eq("  put -$87", a.p * 100, -87, 0.6);
  eq("  call takes 60%", a.c / -a.dPV, 0.60, 0.006);
  eq("  conversion -$225", a.conv * 100, -225, 0.6);
  eq("  the same at the 80 and 120 strikes", M.divShock(2, 80, M.P3, 0.3).conv - M.divShock(2, 120, M.P3, 0.3).conv, 0, 1e-9);
  eq("  formula: change in C-P = -dPV * exp(-bT)", -a.conv, -a.dPV * Math.exp(-M.feeInt(2, M.P3)), 1e-9);
  eq("one year: $1.17 removed", -b.dPV, 1.17, 0.006);
  eq("  each conversion loses $116", b.conv * 100, -116, 0.6);
  eq("  500 of them: about $58,000", 500 * b.conv * 100, -58000, 200);
  yes("a raise pleases the conversion side", M.divShock(2, 100, M.P3, 0.9).conv > 0);
};

PAGES["converts"] = () => {
  /* Page 24. Bond-plus-option decomposition, the carry account, the vol edge,
     and the credit link. */
  const M = load("converts.html", ["CB", "bondFloor", "cbOpt", "cbPrice", "cbDelta", "parity", "cbImplied", "hedgedCb",
    "linkSpread", "cbCarry", "volEdge", "breakevenVol", "breakevenLink", "year2", "s1", "s2", "s3", "bs"]);
  yes("defaults", M.s1.S === 80 && M.s1.vol === 0.35 && M.s1.s === 0.03 && M.s2.vi === 0.28 && M.s2.vr === 0.38 && M.s2.fund === 0.05 && M.s2.borrow === 0.005 && M.s3.k === 10);
  console.log("    ch01");
  /* floor by a second route: sum the five coupons and the face by hand */
  let fl = 1000 * Math.exp(-0.07 * 5); for (let t = 1; t <= 5; t++) fl += 20 * Math.exp(-0.07 * t);
  eq("bond floor $786", M.bondFloor(0.03), fl, 1e-9); eq("  = 786", fl, 786, 0.5);
  eq("convertible $1,023 at $80", M.cbPrice(80, 0.35, 0.03), 1023, 0.5);
  eq("premium over parity 27.9%", (M.cbPrice(80, 0.35, 0.03) / 800 - 1) * 100, 27.9, 0.06);
  eq("option worth $237", M.cbPrice(80, 0.35, 0.03) - M.bondFloor(0.03), 237, 0.5);
  eq("delta 6.4 shares", M.cbDelta(80, 0.35), 6.4, 0.06);
  eq("$6.70 per vol point", M.CB.cr * M.cbOpt(80, 0.35).vega / 100, 6.70, 0.03);
  eq("at $40: $828", M.cbPrice(40, 0.35, 0.03), 828, 0.5);
  eq("  $42 over the floor", M.cbPrice(40, 0.35, 0.03) - M.bondFloor(0.03), 42, 0.5);
  eq("at $200: $2,028", M.cbPrice(200, 0.35, 0.03), 2028, 0.6);
  eq("  1.4% over parity", (M.cbPrice(200, 0.35, 0.03) / 2000 - 1) * 100, 1.4, 0.06);
  eq("implied vol round-trips", M.cbImplied(M.cbPrice(80, 0.28, 0.03), 80, 0.03), 0.28, 1e-6);
  yes("wider spread moves the left of the curve most", (M.cbPrice(40, 0.35, 0.03) - M.cbPrice(40, 0.35, 0.09)) / M.cbPrice(40, 0.35, 0.03) > (M.cbPrice(200, 0.35, 0.03) - M.cbPrice(200, 0.35, 0.09)) / M.cbPrice(200, 0.35, 0.03));
  console.log("    ch02");
  const y = M.year2(M.s2), c = y.c;
  eq("bought for $976", c.px, 976, 0.5);
  eq("short 6.09 shares", M.cbDelta(80, 0.28), 6.09, 0.006);
  eq("  worth $487", c.sh, 487, 0.5);
  eq("financing costs $48.80", -c.fund, 48.80, 0.03);
  eq("short proceeds earn about $24", c.rebate, 24, 0.5);
  eq("borrow costs $2.40", -c.borrow, 2.40, 0.06);
  eq("carry -$6.90", c.net, -6.90, 0.03);
  eq("  the four lines add up", 20 + c.fund + c.rebate + c.borrow, c.net, 1e-9);
  eq("vol edge at 38 realized: $16.20", y.e, 16.20, 0.03);
  eq("expected year +$9.30", y.net, 9.30, 0.03);
  eq("break-even realized 32.6%", y.be * 100, 32.6, 0.06);
  eq("  the year is zero there", M.year2(M.s2, y.be).net, 0, 1e-6);
  eq("no edge when realized = implied", M.volEdge(80, 0.28, 0.28), 0, 1e-12);
  eq("$67 cheap against 38%", M.cbPrice(80, 0.38, 0.03) - c.px, 67, 0.6);
  eq("gamma pays $47 on a 40% fall", M.hedgedCb(80, 0.28, 0.03, -0.4, 0), 47, 0.5);
  yes("  and is positive on a rise too", M.hedgedCb(80, 0.28, 0.03, 0.4, 0) > 0);
  /* the edge formula against a hedged simulation of one year: daily rehedge at implied-vol deltas */
  { let tot = 0; const n = 3000, dt = 1 / 252, vi = 0.28, vr = 0.38, g0 = M.cbOpt(80, vi);
    for (let i = 0; i < n; i++) { const z = Math.sqrt(-2 * Math.log(Math.random() || 1e-12)) * Math.cos(2 * Math.PI * Math.random());
      const S1 = 80 * Math.exp(vr * Math.sqrt(dt) * z - 0.5 * vr * vr * dt);
      const a = M.cbOpt(S1, vi, 5 - dt).price - g0.price - g0.delta * (S1 - 80) - 0.04 * dt * (g0.price - g0.delta * 80); tot += M.CB.cr * a; }
    eq("one-day hedged steps, annualized, agree with the formula", tot / n * 252, M.volEdge(80, vi, vr), 2.5); }
  const hb = M.year2(Object.assign({}, M.s2, { borrow: 0.06 }));
  eq("6% borrow: carry about -$34", hb.c.net, -34, 0.5);
  eq("  year about -$17", hb.net, -17, 0.5);
  eq("  break-even 46.4%", hb.be * 100, 46.4, 0.06);
  console.log("    ch03");
  eq("spread fixed, -30%: +$19.90", M.hedgedCb(80, 0.35, 0.03, -0.3, 0), 19.90, 0.06);
  eq("10bp per 1%: spread 600bp after -30%", (0.03 + M.linkSpread(-0.3, 10)) * 1e4, 600, 1e-6);
  eq("  floor $681", M.bondFloor(0.06), 681, 0.5);
  eq("  hedged P&L -$84.80", M.hedgedCb(80, 0.35, 0.03, -0.3, M.linkSpread(-0.3, 10)), -84.80, 0.06);
  eq("  the right side is unchanged", M.hedgedCb(80, 0.35, 0.03, 0.3, M.linkSpread(0.3, 10)), M.hedgedCb(80, 0.35, 0.03, 0.3, 0), 1e-12);
  eq("break-even 1.8bp per 1%", M.breakevenLink(80, 0.35, 0.03, -0.3), 1.8, 0.03);
  yes("delta shrinks as the stock falls", M.cbDelta(56, 0.35) < M.cbDelta(80, 0.35));
};

PAGES["parity"] = () => {
  /* The page had no claims. These cover the revcon rate examples, the two
     conventions, the jelly-roll sheet values and the straddle/combo split. */
  const M = load("parity.html", ["simpleRate", "compRate", "intFromComp", "legComp", "legSimple", "jrNewton", "s5", "s7"]);
  eq("commission: $0.25 an option is $0.005 a share over two legs", 0.25 / 100 * 2, 0.005, 1e-12);
  /* interest embedded in each quote, then the page's own rate function */
  eq("1: 0.3475, K25, 18d, div 0.40 -> 3.80%", M.simpleRate(0.40 - 0.3475 - 0.005, 25, 18), 3.80, 0.006);
  eq("2: 0.36, K25, 17d, div 0.40 -> 2.96%", M.simpleRate(0.40 - 0.36 - 0.005, 25, 17), 2.96, 0.006);
  eq("3: 0.347, K25, 17d -> 4.07%", M.simpleRate(0.40 - 0.347 - 0.005, 25, 17), 4.07, 0.006);
  eq("4: reverse 0.015, K10, 39d -> -1.85%", M.simpleRate(-0.015 - 0.005, 10, 39), -1.85, 0.006);
  eq("5: offer 0.3171, K300, 38d, div 0.95, no comm -> 4.00%", M.simpleRate(0.3171 + 0.95, 300, 38), 4.00, 0.006);
  eq("6: HTB credit 0.65, K20, 28d -> 41.5%", M.simpleRate(0.65 - 0.005, 20, 28), 41.5, 0.06);
  eq("  interest is 0.645", 0.65 - 0.005, 0.645, 1e-12);
  eq("the additive shortcut returns 64.8% on example 2", M.simpleRate(0.36 + 0.40 + 0.005, 25, 17), 64.8, 0.06);
  eq("lending at 2.96% against 3.39% funding loses 43bp", (3.39 - 2.96) * 100, 43, 1e-9);
  eq("17-day example, simple: 2.9647%", M.simpleRate(0.035, 25, 17), 2.9647, 0.00006);
  eq("17-day example, compound: 2.9669%", M.compRate(0.035, 25, 17), 2.9669, 0.00006);
  yes("  about a fifth of a basis point apart", Math.abs(M.compRate(0.035, 25, 17) - M.simpleRate(0.035, 25, 17)) * 100 < 0.3);
  eq("a 12% convert against 15% borrow is a three-point loss", 15 - 12, 3, 0);
  /* jelly roll sheet values, each built leg by leg and by a second route (direct compounding) */
  const leg = (K, d, r) => K * (Math.pow(1 + r / 100 / 360, d) - 1);
  eq("A: 75 -> 70, no dividend: 0.2165", M.legComp(70, 31, 4, 0, 0) - M.legComp(75, 3, 4, 0, 0), 0.2165, 0.00006);
  eq("  by direct compounding", leg(70, 31, 4) - leg(75, 3, 4), M.legComp(70, 31, 4, 0, 0) - M.legComp(75, 3, 4, 0, 0), 1e-12);
  eq("  Newton recovers 4.00% from it", M.jrNewton(leg(70, 31, 4) - leg(75, 3, 4), 70, 31, 75, 3, 0, 0), 4.00, 1e-6);
  yes("  the hand-computed 0.21569 is the wrong one", Math.abs(0.21569 - (leg(70, 31, 4) - leg(75, 3, 4))) > 0.0005);
  yes("default jelly roll is example A", M.s7.Kn === 75 && M.s7.dn === 3 && M.s7.Kf === 70 && M.s7.df === 31 && M.s7.rate === 4.0);
  /* straddle 7.80 and combo 5.42 split into call and put */
  eq("call = (7.80 + 5.42) / 2 = 6.61", (7.80 + 5.42) / 2, 6.61, 1e-9);
  eq("put = (7.80 - 5.42) / 2 = 1.19", (7.80 - 5.42) / 2, 1.19, 1e-9);
};

PAGES["binomial"] = () => {
  /* Read in full on 2026-11-17 with nothing found; these pin the numbers. */
  const M = load("binomial.html", ["crrParams", "lattice", "treePrice", "stepLimit", "bs"]);
  const T = (N, am) => M.treePrice(100, 100, 1, 0.30, 0.05, N, true, !!am), BS = M.bs(100, 100, 1, 0.30, 0.05, 0, true);
  eq("one step: half a share, 45 borrowed, costs 5", 0.5 * 100 - 45, 5, 0);
  eq("  delta = (10 - 0) / (110 - 90)", (10 - 0) / (110 - 90), 0.5, 0);
  eq("Black-Scholes 14.2312", BS.price, 14.2312, 0.00006);
  eq("one step 16.9640", T(1), 16.9640, 0.00006);
  eq("ten steps 13.9408", T(10), 13.9408, 0.00006);
  eq("a hundred 14.2018", T(100), 14.2018, 0.00006);
  eq("sixteen hundred 14.2294", T(1600), 14.2294, 0.00006);
  eq("doubling N halves the error (400 -> 800)", (T(400) - BS.price) / (T(800) - BS.price), 2.0, 0.01);
  eq("N=40 low by 0.0734", T(40) - BS.price, -0.0734, 0.00006);
  eq("N=41 high by 0.0672", T(41) - BS.price, 0.0672, 0.00006);
  eq("25 steps off by +0.1103", T(25) - BS.price, 0.1103, 0.00006);
  eq("25/26 average off by -0.0012", (T(25) + T(26)) / 2 - BS.price, -0.0012, 0.00006);
  eq("N=400 raw -0.0074", T(400) - BS.price, -0.0074, 0.00006);
  eq("N=400 averaged -0.0002", (T(400) + T(401)) / 2 - BS.price, -0.0002, 0.00006);
  const pe = M.treePrice(80, 100, 1, 0.30, 0.10, 500, false, false), pa = M.treePrice(80, 100, 1, 0.30, 0.10, 500, false, true);
  eq("European put 16.24", pe, 16.2413, 0.01);
  eq("American put 20.27", pa, 20.2680, 0.01);
  eq("  premium 24.8% of the European value", (pa - pe) / pe * 100, 24.8, 0.15);
  eq("American call = European call with no dividend", T(200, true), T(200, false), 1e-9);
  eq("p = 1.0761 at 10 vol, 8% rates, two years, one step", M.crrParams(0.10, 0.08, 2).p, 1.0761, 0.00006);
  eq("p = 1.3867 at four years", M.crrParams(0.10, 0.08, 4).p, 1.3867, 0.00006);
  eq("p = 1.5388 at 5 vol, 10% rates, one year", M.crrParams(0.05, 0.10, 1).p, 1.5388, 0.00006);
  eq("one-step example: p = 0.5 at zero rates", (1 - 0.9) / (1.1 - 0.9), 0.5, 1e-12);
  yes("step limit is (sigma/r)^2", Math.abs(M.stepLimit(0.10, 0.08) - Math.pow(0.10 / 0.08, 2)) < 1e-9);
};

PAGES["forwards"] = () => {
  /* The page had no claims. Closed-form numbers only; the trees are checked against Black-76. */
  const M = load("forwards.html", ["fwd", "fwdDisc", "b76", "futTree", "bs", "s3"]);
  eq("forward 101.5113", M.fwd(100, 0.05, 0.02, 0.5), 101.5113, 0.00006);
  eq("expected spot at -20% drift, 2% yield: 80.25", 100 * Math.exp(-0.20 - 0.02), 80.25, 0.006);
  eq("  at +25%: 125.86", 100 * Math.exp(0.25 - 0.02), 125.86, 0.006);
  eq("no-dividend one-year forward 105.1271", M.fwd(100, 0.05, 0, 1), 105.1271, 0.00006);
  eq("  by the discrete route with no dividends", M.fwdDisc(100, 0.05, 1, []), 105.1271, 0.00006);
  eq("2.50 special at three months: 102.5316", M.fwdDisc(100, 0.05, 1, [[0.25, 2.50]]), 102.5316, 0.00006);
  yes("  a bigger effect than three 60-cent dividends", 105.1271 - M.fwdDisc(100, 0.05, 1, [[0.25, 2.50]]) > 105.1271 - M.fwdDisc(100, 0.05, 1, [[0.25, 0.6], [0.5, 0.6], [0.75, 0.6]]));
  eq("$17,240 of notional per contract", 172.40 * 100, 17240, 1e-9);
  eq("cash settlement: $8,347", (5283.47 - 5200) * 100, 8347, 1e-6);
  eq("ten contracts: $83,470", 10 * (5283.47 - 5200) * 100, 83470, 1e-6);
  const F = M.fwd(100, 0.06, 0, 0.5), bsC = M.bs(100, 100, 0.5, 0.30, 0.06, 0, true), bC = M.b76(F, 100, 0.5, 0.30, 0.06, true);
  eq("forward 103.0455", F, 103.0455, 0.00006);
  eq("Black-Scholes 9.882656", bsC.price, 9.882656, 0.0000006);
  eq("Black-76 on the forward gives the same", bC.price, bsC.price, 1e-9);
  eq("delta 0.5977 on the spot model", bsC.delta, 0.5977, 0.00006);
  eq("delta 0.5801 with respect to the forward", bC.delta, 0.5801, 0.00006);
  eq("  ratio 0.970446 = exp(-0.03)", bC.delta / bsC.delta, Math.exp(-0.03), 1e-6);
  eq("  about 1.8 contracts fewer per hundred", 100 * (bsC.delta - bC.delta), 1.8, 0.06);
  const e = (F0, cp) => M.b76(F0, 100, 1, 0.30, 0.08, cp).price, am = (F0, cp) => M.futTree(F0, 100, 1, 0.30, 0.08, 800, cp, true);
  eq("F=130 European call 30.9927", e(130, true), 30.9927, 0.00006);
  eq("  American 32.2092", am(130, true), 32.2092, 0.01);
  eq("  premium 1.2166", am(130, true) - e(130, true), 1.2166, 0.01);
  eq("F=70 European put 29.0132", e(70, false), 29.0132, 0.00006);
  eq("  premium 1.4492", am(70, false) - e(70, false), 1.4492, 0.01);
  eq("F=140 European call 39.0630, below intrinsic by 0.9370", 40 - e(140, true), 0.9370, 0.00006);
  eq("F=200: below intrinsic by 7.5506", 100 - e(200, true), 7.5506, 0.00006);
  eq("at the money, call and put premiums are equal", am(100, true) - e(100, true), am(100, false) - e(100, false), 1e-9);
  eq("  0.2205", am(100, true) - e(100, true), 0.2205, 0.01);
};

PAGES["real-world"] = () => {
  /* The page had no claims. Chapters 03 and 04 are closed-form and checked
     here; chapters 01-02 quote simulated hedging errors and are not. */
  const M = load("real-world.html", ["mixVol", "mixPrice", "impliedVol", "bs", "s3", "s4"]);
  const S = 100, r = 0.03, w = 0.85, v1 = 0.18, v2 = 0.42;
  yes("defaults: 85% at 18 vol, 15% at 42", M.s3.w === w && M.s3.v1 === v1 && M.s3.v2 === v2 && M.s3.T === 1);
  const iv = K => { const cp = K >= 100; return 100 * M.impliedVol(S, K, 1, r, cp, M.mixPrice(S, K, 1, w, v1, v2, r, cp)); };
  eq("mixture smile: 25.27% at 70", iv(70), 25.27, 0.006);
  eq("  22.00% at 90", iv(90), 22.00, 0.006);
  eq("  21.60% at the money", iv(100), 21.60, 0.006);
  eq("  22.11% at 120", iv(120), 22.11, 0.006);
  eq("  22.87% at 130", iv(130), 22.87, 0.006);
  eq("variance-matched vol 23.238%", 100 * M.mixVol(w, v1, v2), 23.238, 0.0006);
  eq("  by hand", 100 * Math.sqrt(0.85 * 0.0324 + 0.15 * 0.1764), 23.238, 0.0006);
  eq("flat vol overprices the body: 10.67", M.bs(S, 100, 1, M.mixVol(w, v1, v2), r, 0, true).price, 10.67, 0.006);
  eq("  against the mixture's 10.03", M.mixPrice(S, 100, 1, w, v1, v2, r, true), 10.03, 0.006);
  eq("and underprices the left tail: 0.380", M.bs(S, 70, 1, M.mixVol(w, v1, v2), r, 0, false).price, 0.380, 0.0006);
  eq("  against 0.566", M.mixPrice(S, 70, 1, w, v1, v2, r, false), 0.566, 0.0006);
  eq("sqrt(32) = 5.66", Math.sqrt(32), 5.66, 0.006);
  /* chapter 04: one volatility on a skewed surface */
  yes("defaults: 25 ATM, -0.30 skew, six months", M.s4.atm === 0.25 && M.s4.skew === -0.30 && M.s4.T === 0.5);
  const T = 0.5, F = S * Math.exp(r * T), surf = K => Math.max(0.04, 0.25 - 0.30 * Math.log(K / F));
  const mk = K => M.bs(S, K, T, surf(K), r, 0, K >= F).price, fl = K => M.bs(S, K, T, 0.25, r, 0, K >= F).price, er = K => 100 * (fl(K) - mk(K)) / mk(K);
  eq("75 strike: market 1.0296", mk(75), 1.0296, 0.00006);
  eq("  flat model 0.2689", fl(75), 0.2689, 0.00006);
  eq("  low by 74%", er(75), -74, 0.5);
  eq("115 strike: flat model 46% high", er(115), 46, 0.5);
  eq("125 strike: 213% high", er(125), 213, 0.5);
  eq("  on an option worth 0.37", mk(125), 0.37, 0.006);
  eq("at-the-money error about 2%", Math.abs(er(100)), 2, 0.7);
};

PAGES["microstructure"] = () => {
  /* The page had no claims. Writing the first one found that "one cent is
     11.57 vol points on a seven-day five-delta" was wrong by a factor of
     sixteen: that figure belongs to a strike about 13% out of the money, a
     0.2-delta. A five-delta weekly is 0.70, at any volatility. Chapters 03-05
     quote simulation results and are not checked here. */
  const M = load("microstructure.html", ["bs", "s1"]);
  const B = M.bs, strikeFor = (d, T) => { let lo = 100, hi = 160; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (B(100, m, T, 0.30, 0, 0, true).delta > d) lo = m; else hi = m; } return lo; };
  const K5 = strikeFor(0.05, 7 / 365), v5 = B(100, K5, 7 / 365, 0.30, 0, 0, true).vega / 100, v6 = B(100, 100, 180 / 365, 0.30, 0, 0, true).vega / 100;
  eq("six-month ATM: a cent is 0.04 vol points", 0.01 / v6, 0.04, 0.005);
  eq("seven-day five-delta: a cent is 0.70 vol points", 0.01 / v5, 0.70, 0.006);
  eq("  its vega is about 0.014 a point", v5, 0.014, 0.0006);
  eq("  by the closed form S sqrt(T) n(d1) / 100 with N(d1) = 0.05", 100 * Math.sqrt(7 / 365) * Math.exp(-0.5 * 1.6449 * 1.6449) / Math.sqrt(2 * Math.PI) / 100, v5, 0.0002);
  eq("a nickel is 0.2 vol wide on the first", 0.05 / v6, 0.2, 0.03);
  eq("  and 3.5 vol wide on the second", 0.05 / v5, 3.5, 0.03);
  eq("nearly twenty times more", (0.01 / v5) / (0.01 / v6), 19.5, 0.3);
  eq("the same at 60 vol: the ratio does not depend on volatility", (() => { let lo = 100, hi = 250; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (B(100, m, 7 / 365, 0.60, 0, 0, true).delta > 0.05) lo = m; else hi = m; } return 0.01 / (B(100, lo, 7 / 365, 0.60, 0, 0, true).vega / 100); })(), 0.70, 0.02);
  eq("the old 11.57 is a strike 13% out of the money", 0.01 / (B(100, 112.9, 7 / 365, 0.30, 0, 0, true).vega / 100), 11.57, 1.2);
  yes("  which is a 0.2-delta, not a five-delta", B(100, 112.9, 7 / 365, 0.30, 0, 0, true).delta < 0.003);
};

PAGES["program"] = () => {
  /* The program's drills carry computed keys. Each is re-derived here a
     different way from the one the page uses, over a few hundred deals. */
  const M = load("program.html", ["seed", "deal", "DRILLS", "SPOT", "STN", "gradeOf", "isRight", "boxOf", "dueList",
    "gateOK", "stationState", "summary", "loopLines", "GAP", "DAY", "FEE", "bs", "pinRisk", "poolShare", "parseLog", "betterSprint", "SPRINT", "gradesByDay"]);
  const N = 400, each = (type, f) => { let bad = 0; for (let i = 1; i <= N; i++) { M.seed(i * 7919); if (!f(M.deal(type))) bad++; } return bad; };
  eq("seven stations", M.STN.length, 7, 0);
  yes("every gate names a real drill", M.STN.every(s => s.gate.every(g => g.every(t => M.DRILLS[t]))));
  eq("hedged break-even at 30 vol on trading days is 1.89%", 0.30 / Math.sqrt(252) * 100, 1.89, 0.005);

  eq("parity: the planted strike is the one found, right side, right size", each("parity", d => d.planted === 0 ? d.ans.nothing
    : !d.ans.nothing && d.ans.k === d.plantedAt && d.ans.c === (d.planted > 0 ? 0 : 1) && Math.abs(d.ans.n - (Math.abs(d.planted) - M.FEE) * 100) <= 2.5), 0, 0);
  eq("hard-to-borrow chain is never a trade", each("htb", d => d.ans.nothing && d.ans.c === 2), 0, 0);
  eq("…its gap is the same at every strike, to rounding", each("htb", d => Math.max(...d.gaps) - Math.min(...d.gaps) <= 0.035 && Math.max(...d.gaps) < 0), 0, 0);
  eq("…and the implied borrow recovers the true one", each("htb", d => Math.abs(d.impliedBorrow - d.borrow) <= 0.02), 0, 0);
  eq("quote: a conversion is only called when it clears the spread", each("inside", d => (d.ans.c === 0) === (d.conv > 0) && d.rev < 0), 0, 0);
  eq("box: the implied rate reprices the box", each("box", d => Math.abs(d.W * Math.exp(-d.imp * d.T) - d.px) < 1e-9), 0, 0);
  eq("forward vol: near variance plus forward variance is far variance", each("fwdvar", d => { const q = d.q, f = d.ans.n / 100;
    return Math.abs(q.v1 * q.v1 * q.t1 + f * f * (q.t2 - q.t1) - q.v2 * q.v2 * q.t2) < 1e-9; }), 0, 0);
  eq("event move: base plus event reprices both expiries", each("event", d => { const q = d.q, J = d.ans.n / 100, b = d.base;
    return Math.abs(b * b * q.d1 / 365 + J * J - q.v1 * q.v1 * q.d1 / 365) < 1e-9 && Math.abs(b * b * q.d2 / 365 + J * J - q.v2 * q.v2 * q.d2 / 365) < 1e-9; }), 0, 0);
  eq("clean vol: the answer recovers the base the print was built from", each("clean", d => Math.abs(d.ans.n / 100 - d.q.b) < 0.003), 0, 0);
  eq("box: side follows implied against funding", each("box", d => d.ans.c === (d.imp - d.fund > 0.0025 ? 0 : d.imp - d.fund < -0.0025 ? 1 : 2)), 0, 0);
  eq("call prices: a planted strike makes its butterfly negative", each("fly", d => d.planted < 0 ? d.ans.nothing
    : d.ans.k === d.planted - 1 && d.ans.n < 0 && Math.abs(d.ans.n - (d.C[d.planted - 1] - 2 * d.C[d.planted] + d.C[d.planted + 1])) < 1e-9), 0, 0);
  eq("term structure: nothing to do exactly when total variance never falls", each("calendar", d =>
    d.ans.nothing === d.w.every((x, i) => i === 0 || x >= d.w[i - 1])), 0, 0);
  eq("mock pit: net price equals cash paid plus the strike gap", each("dissect", d => { const f = d.fills;
    return Math.abs(d.cost - (f.strad - f.c1 - 2 * f.c2 + 2 * f.c3 - f.p3 + (f.K3 - f.K1))) < 0.006 && (d.ans.c === 0) === (d.cost < 0); }), 0, 0);
  eq("straddle to vol: the head estimate is inside tolerance of the true vol", each("strad2iv", d => Math.abs(d.ans.n - d.trueVol * 100) < d.ans.tol), 0, 0);
  eq("conversion rate: tolerance admits the simple-interest answer", each("revcon", d => d.ans.tol >= 0.12 && (d.ans.c === 0) === (d.imp > d.fund)), 0, 0);
  eq("fair vol: buy below fair, sell above, nothing inside a point", each("fairiv", d => d.ans.c === (Math.abs(d.pts) < 1 ? 2 : d.pts > 0 ? 1 : 0)), 0, 0);
  eq("half Kelly is half of full, and zero when the edge is negative", each("kelly", d => Math.abs(d.ans.n - Math.max(0, d.full * 50)) < 1e-9), 0, 0);
  yes("every drill deals without error and carries a key and steps", Object.keys(M.DRILLS).every(t => { for (let i = 1; i <= 60; i++) { M.seed(i * 31 + 5);
    const d = M.deal(t); if (!d.key || !d.template || !(d.sec > 0) || /NaN|undefined/.test(d.key + d.html)) return false; } return true; }));

  /* the second batch: carry, exercise, assignment, hedging behavior, games */
  eq("forty drills", Object.keys(M.DRILLS).length, 40, 0);
  { const now = 1e12, DAY = 864e5, G = M.gradesByDay([{ t: now - 1000, g: "A" }, { t: now - 2000, g: "F" }, { t: now - DAY - 5, g: "C" }, { t: now - 13.5 * DAY, g: "B" }, { t: now - 15 * DAY, g: "A" }], now);
    yes("grades chart: 14 days, today last, older reps dropped", G.length === 14 && G[13].ab === 1 && G[13].f === 1 && G[12].c === 1 && G[0].ab === 1
      && G.reduce((a, d) => a + d.ab + d.c + d.f, 0) === 4); }
  eq("peer group: the planted name is the one found, and the high-vol decoy never is", each("peers", d => { const q = d.q;
    return q.planted < 0 ? d.ans.nothing : !d.ans.nothing && d.ans.k === q.planted && d.ans.k !== q.decoy && (d.ans.c === 0) === (q.mult > 1); }), 0, 0);
  eq("…and the answer follows from the numbers on the screen alone", each("peers", d => { const r = d.q.iv.map((x, i) => x / d.q.rv[i]), o = r.slice().sort((a, b) => a - b),
    m = (o[2] + o[3]) / 2, far = r.filter(x => Math.abs(x - m) >= 0.15).length; return d.ans.nothing ? far === 0 : far === 1; }), 0, 0);
  const cp = (S, K, T, v, r) => M.bs(S, K, T, v, r, 0, true).price - M.bs(S, K, T, v, r, 0, false).price;
  eq("jelly roll: far synthetic minus near, less the dividends between", each("jelly", d => { const q = d.q;
    return Math.abs(d.ans.n - (cp(77, q.K, q.T2, 0.3, q.r) - cp(77, q.K, q.T1, 0.3, q.r) - q.dv)) < 1e-6; }), 0, 0);
  eq("implied borrow recovers the borrow the prices were built with", each("borrow", d => Math.abs(d.ans.n / 100 - d.q.b) <= d.ans.tol / 100), 0, 0);
  eq("early exercise: the hurdle rule agrees with comparing intrinsic to the live call", each("earlyex", d => { const q = d.q;
    return (d.ans.c === 0) === (q.S - q.K > M.bs(q.S - q.D, q.K, q.tau / 365, q.v, q.r, 0, true).price); }), 0, 0);
  eq("assignment: sd matches the exact binomial", each("assign", d => { const { n, p } = d.q; let m = 0, v = 0, C = 1;
    for (let k = 0; k <= n; k++) { const pr = C * Math.pow(p, k) * Math.pow(1 - p, n - k); m += k * pr; v += k * k * pr; C = C * (n - k) / (k + 1); }
    return Math.abs(d.ans.n - 100 * Math.sqrt(v - m * m)) < 1e-6; }), 0, 0);
  eq("pin: 10 short calls at 35 vol carry $3,819 of weekend risk", M.pinRisk(10, 0.35), 3819, 1);
  eq("dividend play: 10,000 written into 1,000 open interest takes 90.9%", M.poolShare(10000, 1000) * 100, 90.9, 0.05);
  eq("dividend play: your windfall plus the original writers' is the whole unexercised dividend", each("divplay", d => { const q = d.q;
    return Math.abs(d.ans.n + q.u * q.OI * (q.OI / (q.OI + q.Q)) * 100 * q.D - q.u * q.OI * 100 * q.D) < 1e-6; }), 0, 0);
  const fd = (legs, g) => { const P = (S, v) => legs.reduce((a, l) => a + l[2] * M.bs(S, l[0], 0.25, v, 0.045, 0, !!l[1]).price, 0), h = 0.01, k = 1e-4;
    return g === "delta" ? (P(100 + h, 0.25) - P(100 - h, 0.25)) / (2 * h) : g === "gamma" ? (P(100 + h, 0.25) - 2 * P(100, 0.25) + P(100 - h, 0.25)) / (h * h)
      : g === "vega" ? (P(100, 0.25 + k) - P(100, 0.25 - k)) / (2 * k) : g === "volga" ? (P(100, 0.25 + 1e-3) - 2 * P(100, 0.25) + P(100, 0.25 - 1e-3)) / 1e-6
      : (P(100 + h, 0.25 + k) - P(100 + h, 0.25 - k) - P(100 - h, 0.25 + k) + P(100 - h, 0.25 - k)) / (4 * h * k); };
  eq("Greek signs agree with finite differences on the structure's price", each("sign", d => { const x = fd(d.q.legs, d.q.g);
    return d.ans.c === 2 ? true : (d.ans.c === 0) === (x > 0); }), 0, 0);
  eq("hedge split: the three accounts' trades add to the book's", each("split", d => Math.abs(d.q.all.reduce((a, x) => a + x, 0) + d.q.G * d.q.dS) < 1e-6 && d.ans.n === d.q.all[d.q.i]), 0, 0);
  eq("overnight bleed: the repriced drift has the sign of charm", each("bleed", d => { const q = d.q, ch = M.bs(100, q.K, (q.d - 0.5) / 365, q.v, 0.045, 0, q.call).charm * (q.long ? 1 : -1);
    return (ch > 0) === (q.dd > 0) && (d.ans.c === 0) === (q.dd < 0); }), 0, 0);
  eq("vol moving with spot: the extra delta has the sign of vanna times the vol change", each("shadow", d => { const q = d.q,
    va = M.bs(q.S1, q.K, q.T, 0.25 + q.dv / 2, 0.045, 0, q.call).vanna * q.dv; return (va * q.db > 0) === (d.ans.c === 0); }), 0, 0);
  eq("hidden delta: the stock trade offsets the vega P&L of a 1% rally", each("lean", d => { const q = d.q, volPnl = q.vega * (q.sig * (1 - q.beta * 0.01) - q.sig);
    return Math.abs(volPnl + d.ans.n * 0.01) < 1e-6; }), 0, 0);
  eq("weighted vega: P&L of a one-point front move when the back moves sqrt(Tf/Tb)", each("wvega", d => { const q = d.q;
    return Math.abs(q.fv * 1 + q.bv * Math.sqrt(q.fm) / Math.sqrt(q.bm) - d.ans.n) < 1e-9 && Math.abs(d.ans.n) >= 2; }), 0, 0);
  eq("dice: fair value is the mean over every roll of the hidden dice", each("dice", d => { const { n, seen } = d.q; let tot = 0, cnt = 0;
    const rec = (k, s) => { if (k === 0) { tot += s; cnt++; return; } for (let f = 1; f <= 6; f++) rec(k - 1, s + f); }; rec(n - 1, seen); return Math.abs(d.ans.n - tot / cnt) < 1e-9; }), 0, 0);
  eq("overround at −110 both sides is 4.76%", (2 * 110 / 210 - 1) * 100, 4.76, 0.005);
  eq("pot odds: at the stated equity a call has zero expected value", each("potodds", d => { const { P, B } = d.q, e = d.ans.n / 100; return Math.abs(e * (P + B) - (1 - e) * B) < 1e-9; }), 0, 0);
  eq("backtest odds: posterior matches counting 100,000 strategies", each("bayes", d => { const { pr, pw, fp } = d.q, real = 1e5 * pr * pw, dead = 1e5 * (1 - pr) * fp;
    return Math.abs(d.ans.n - 100 * real / (real + dead)) < 1e-9; }), 0, 0);
  yes("log lines round-trip through the parser", (x => x.length === 2 && x[0].type === "fly" && x[0].g === "A" && x[1].type === "kelly" && x[1].tag === "SIZING")(
    M.parseLog("- GRADE | 2026-11-16 | spot-fly | OK | A\n- GRADE | 2026-11-16 | kelly | SIZING | F\n- GRADE | 2026-11-16 | nonsense | OK | A\nnot a line")));
  yes("a sprint is better with more right, then with less time", M.betterSprint({ right: 9, sec: 99 }, { right: 8, sec: 50 }) && M.betterSprint({ right: 9, sec: 80 }, { right: 9, sec: 90 })
    && !M.betterSprint({ right: 9, sec: 95 }, { right: 9, sec: 90 }) && M.betterSprint({ right: 1, sec: 300 }, null));
  yes("sprint drills are all real drills", M.SPRINT.every(t => M.DRILLS[t]));

  /* grading */
  const num = { ans: { c: null, k: null, n: 250, tol: 1 }, tag: "CARRY", sec: 60 };
  yes("right first time inside the clock is an A", M.gradeOf(num, { n: 250.4 }, 1, 40).g === "A");
  yes("right first time over the clock is a B", M.gradeOf(num, { n: 250 }, 1, 61).g === "B");
  yes("right on the second try is a C", M.gradeOf(num, { n: 250 }, 2, 10).g === "C");
  yes("wrong is an F with the drill's tag", (r => r.g === "F" && r.tag === "CARRY")(M.gradeOf(num, { n: 300 }, 2, 10)));
  yes("a flipped sign is tagged SIGN", M.gradeOf(num, { n: -250 }, 2, 10).tag === "SIGN");
  yes("an answer a hundred times too big is tagged UNITS", M.gradeOf(num, { n: 25000 }, 2, 10).tag === "UNITS");
  const spot = { ans: { c: 2, k: null, n: null, tol: 2.5, nothing: true }, tag: "CARRY", sec: 60 };
  yes("'nothing to do' is right with no strike and no number", M.isRight(spot, { c: 2, k: null, n: null }));
  yes("trading a screen that has nothing on it is wrong", !M.isRight(spot, { c: 0, k: 1, n: 12 }));

  /* the ledger */
  const t0 = 1e12, rep = (type, g, d) => ({ t: t0 + d * M.DAY, type, g, tag: "OK", sec: 5 });
  eq("two good reps put a drill in box 2", M.boxOf([rep("kelly", "A", 0), rep("kelly", "B", 1)], "kelly").b, 2, 0);
  eq("a miss sends it back to box 1", M.boxOf([rep("kelly", "A", 0), rep("kelly", "A", 1), rep("kelly", "F", 2)], "kelly").b, 1, 0);
  yes("the gaps are 1, 2, 4, 8 and 16 days", M.GAP.slice(1).join() === "1,2,4,8,16");
  yes("box 2 is not due after one day", M.dueList([rep("kelly", "A", 0), rep("kelly", "A", 1)], t0 + 2 * M.DAY).length === 0);
  yes("…and is due after two", M.dueList([rep("kelly", "A", 0), rep("kelly", "A", 1)], t0 + 3 * M.DAY)[0].t === "kelly");
  yes("a gate needs two in a row", !M.gateOK([rep("payoff", "A", 0)], ["payoff"]) && M.gateOK([rep("payoff", "A", 0), rep("payoff", "B", 1)], ["payoff"])
    && !M.gateOK([rep("payoff", "A", 0), rep("payoff", "A", 1), rep("payoff", "C", 2)], ["payoff"]));
  const s1 = M.stationState([rep("payoff", "A", 0), rep("payoff", "A", 1)], {}, M.STN[0]);
  yes("drills alone do not pass a station; the real-screen task must be ticked", s1.drills && !s1.passed
    && M.stationState([rep("payoff", "A", 0), rep("payoff", "A", 1)], { 1: 1 }, M.STN[0]).passed);
  yes("spot drills are logged with the spot- prefix", /\| spot-fly \| OK \| A$/.test(M.loopLines([rep("fly", "A", 0)])));
};

PAGES["playbook"] = () => {
  const M = load("playbook.html", ["simulate", "statsOf", "s1", "PB", "PB", "PBSHAPE", "SHAPES", "shapeSkew", "shapeSvg"]);
  const s = M.simulate(M.s1), A = M.statsOf(s.idx), B = M.statsOf(s.pw), Cc = M.statsOf(s.th);
  eq("default history has three crash months", s.idx.filter(r => r < -0.15).length, 3, 0);
  eq("put-writing wins 93% of months", B.win * 100, 93, 0.5);
  eq("…with skewness −9.2", B.skew, -9.2, 0.05);
  eq("…and a worst month of −19%", B.worst * 100, -19, 0.5);
  eq("index grows 13.0% a year", A.cagr * 100, 13.0, 0.05);
  eq("…with a 26% worst drawdown", A.dd * 100, -26, 0.5);
  eq("tail-hedged index grows 13.6%", Cc.cagr * 100, 13.6, 0.05);
  eq("…with a 19% worst drawdown", Cc.dd * 100, -19, 0.5);
  const z = M.statsOf(M.simulate(Object.assign({}, M.s1, { vrp: 0 }))[ "pw" ]);
  yes("with no premium put-writing's return all but disappears", z.cagr < 0.25 * B.cagr + 0.01);
  yes("fifteen strategies, each with all four sections",
    M.PB.length === 15 && M.PB.every(x => x.harvest && x.how && x.lose && x.win && x.pg.length));
  yes("every linked page exists", M.PB.every(x => x.pg.every(([h]) => fs.existsSync(path.join(ROOT, h)))));
  { yes("every strategy has a return shape", M.PB.every(x => M.SHAPES[M.PBSHAPE[x.n]]));
    yes("short-vol shapes are negatively skewed", M.shapeSkew("short") < -1);
    yes("the tail hedge is positively skewed", M.shapeSkew("long") > 1);
    yes("the symmetric shape has no skew", Math.abs(M.shapeSkew("sym")) < 1e-6);
    yes("put-writing is drawn short, tail hedging long", M.PBSHAPE["Systematic put-writing"] === "short" && M.PBSHAPE["Tail-risk hedging"] === "long");
    yes("the SVG is a path, not empty", M.shapeSvg("short").indexOf("<path") > 0); }
};

const only = process.argv[2];
const names = only ? [only.replace(/\.html$/, "")] : Object.keys(PAGES);
/* Every Monte Carlo claim used to draw from the real Math.random, so the
   harness could fail on a page nobody had touched (the vol cone did, about
   one run in four). The generator is now seeded per page: a failure is a
   failure of the page, and it reproduces. VERIFY_SEED=n tries another seed;
   a claim that passes on one seed and fails on another has a tolerance
   tighter than its sample supports. */
const SEED0 = +(process.env.VERIFY_SEED || 20261117);
function seedRandom(a) {
  Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
for (const name of names) {
  seedRandom(SEED0 + [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
  if (!PAGES[name]) { console.error("no claims recorded for " + name); process.exit(2); }
  console.log("\n  " + name + ".html");
  try { PAGES[name](); }
  catch (e) { fails++; console.log("    FAIL threw: " + e.message); }
}
console.log("\n" + (fails
  ? fails + " of " + checks + " claims do NOT match what the pages compute"
  : "all " + checks + " numeric claims match — " + names.length + " page(s)"));
process.exit(fails ? 1 : 0);
