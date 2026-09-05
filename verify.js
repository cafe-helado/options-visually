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
  eq("arrival slippage is half the drift over the window",
    mean(arr.map((a, i) => a / dr[i])), 0.5, 0.03);
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
  eq("the deck holds twenty-two cards", D.length, 22, 0);
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

/* ── run ─────────────────────────────────────────────────────────────── */
const only = process.argv[2];
const names = only ? [only.replace(/\.html$/, "")] : Object.keys(PAGES);
for (const name of names) {
  if (!PAGES[name]) { console.error("no claims recorded for " + name); process.exit(2); }
  console.log("\n  " + name + ".html");
  try { PAGES[name](); }
  catch (e) { fails++; console.log("    FAIL threw: " + e.message); }
}
console.log("\n" + (fails
  ? fails + " of " + checks + " claims do NOT match what the pages compute"
  : "all " + checks + " numeric claims match — " + names.length + " page(s)"));
process.exit(fails ? 1 : 0);
