#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   mktutor.js — build the tutor's context packs from the pages.

   The tutor never reads raw HTML. This script reads each page once and
   writes tutor/<page>.json: a short outline that is sent with every
   question, and the full text of each chapter, which the tutor fetches
   only when it needs it. The pages change rarely, so the packs are built
   here, committed, and served as static files. check.js refuses a pack
   whose page has changed since it was built, so they cannot drift.

       node mktutor.js            every page with chapters
       node mktutor.js parity     just that one

   Nothing here is secret and nothing here calls a network.
   ═══════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = __dirname, OUT = path.join(ROOT, "tutor");

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", minus: "−",
  mdash: "—", ndash: "–", times: "×", middot: "·", sigma: "σ", Delta: "Δ", delta: "δ",
  rarr: "→", larr: "←", le: "≤", ge: "≥", asymp: "≈", radic: "√", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", deg: "°", plusmn: "±", infin: "∞" };
const decode = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n] !== undefined ? ENT[n] : m);
/* tags out, sub/superscripts kept readable, whitespace collapsed */
const text = html => decode(html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<sub>([\s\S]*?)<\/sub>/gi, "_$1").replace(/<sup>([\s\S]*?)<\/sup>/gi, "^$1")
  .replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ").trim();
const all = (re, s) => [...s.matchAll(re)];
/* the inner HTML of the first <tag class="cls"> balanced on <div>/<section> */
function block(html, start) {
  const open = html.slice(start).match(/^<(\w+)/)[1];
  const re = new RegExp(`<${open}\\b|</${open}>`, "gi");
  re.lastIndex = start; let depth = 0, m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (!depth) return html.slice(html.indexOf(">", start) + 1, m.index);
  }
  return html.slice(start);
}
/* remove every element (and its balanced contents) whose class starts with one of cls */
function strip(html, cls) {
  const re = new RegExp(`<(div|span|p)[^>]*class="(?:${cls})\\b[^"]*"[^>]*>`, "i");
  let m;
  while ((m = html.match(re))) {
    const inner = block(html, m.index);
    const end = html.indexOf(inner, m.index) + inner.length;
    const close = html.indexOf(">", end) + 1;
    html = html.slice(0, m.index) + " " + html.slice(close);
  }
  return html;
}
function blocks(html, cls) {
  const out = [], re = new RegExp(`<(div|section|figure|p|details)[^>]*class="${cls}\\b[^"]*"[^>]*>`, "gi");
  let m; while ((m = re.exec(html))) out.push(block(html, m.index));
  return out;
}

/* verified claims: the labels of eq()/yes() inside each PAGES[...] block of
   verify.js, keyed by the page file the block loads */
function claimsByPage() {
  const src = fs.readFileSync(path.join(ROOT, "verify.js"), "utf8");
  const parts = src.split(/\nPAGES\["[^"]+"\]\s*=/).slice(1);
  const map = {};
  for (const p of parts) {
    const files = [...new Set(all(/load\("([\w-]+)\.html"/g, p).map(m => m[1]))];
    const labels = all(/\b(?:eq|yes)\(\s*("(?:[^"\\]|\\.)*"|`[^`$]*`|'(?:[^'\\]|\\.)*')/g, p)
      .map(m => { try { return m[1][0] === "`" ? m[1].slice(1, -1) : JSON.parse(m[1].replace(/^'|'$/g, '"')); } catch { return null; } })
      .filter(Boolean).map(s => s.trim()).filter(s => s.length > 3);
    for (const f of files) (map[f] = map[f] || []).push(...labels);
  }
  return map;
}

function buildPage(file, claims) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const page = file.replace(/\.html$/, "");
  const title = text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title>([\s\S]*?)<\/title>/i) || ["", page])[1]);
  const lede = text((html.match(/<p class="lede[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || ["", ""])[1]).slice(0, 400);
  const num = text((html.match(/class="pnum"[^>]*>([\s\S]*?)</i) || html.match(/No\.\s*(\d+)/) || ["", ""])[1]);
  const chapters = [];
  for (const m of all(/<section class="chapter[^"]*" id="([\w-]+)"[^>]*>/g, html)) {
    const body = block(html, m.index);
    const head = blocks(body, "chead")[0] || "";
    const n = text((head.match(/class="cnum"[^>]*>([\s\S]*?)</) || ["", ""])[1]);
    const t = text((head.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || ["", ""])[1]);
    const dek = text((head.match(/class="dek"[^>]*>([\s\S]*?)<\/p>/) || ["", ""])[1]);
    const terms = {};
    for (const tm of all(/<span class="term"[^>]*data-t="([^"]*)"[^>]*data-def="([^"]*)"/g, body))
      terms[decode(tm[1])] = decode(tm[2]);
    const figures = [];
    for (const fm of all(/<figure[^>]*>/g, body)) {
      const f = block(body, fm.index);
      const ft = text((f.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || ["", ""])[1]);
      const cap = text((f.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) || ["", ""])[1]);
      const ids = all(/<canvas[^>]*id="([\w-]+)"/g, f).map(x => x[1]);
      if (ft || cap) figures.push({ ids, title: ft, caption: cap });
    }
    const checks = all(/<div class="check"[^>]*>/g, body).map(cm => {
      const c = block(body, cm.index);
      const q = text((c.match(/class="q"[^>]*>([\s\S]*?)<\/p>/) || ["", ""])[1]);
      const right = text((c.match(/<button[^>]*data-ok[^>]*>([\s\S]*?)<\/button>/) || ["", ""])[1]);
      const ans = text((blocks(c, "ans")[0] || ""));
      return q ? { q, right, why: ans } : null;
    }).filter(Boolean);
    /* the reading text: prose, equations with their readings, try-this boxes.
       Check-yourself answers are left out of the text and kept separately, so
       the tutor can quiz without giving the answer away. */
    const prose = text(strip(body, "chead|check|ctl|kv|btnrow|legend|opts")
      .replace(/<canvas[^>]*><\/canvas>/g, " ")
      .replace(/<div class="mline"[^>]*>([\s\S]*?)<\/div>/g, " [equation: $1] "));
    chapters.push({ id: m[1], n, title: t, dek, figures, checks, terms, text: prose });
  }
  const src = crypto.createHash("sha256").update(html).digest("hex").slice(0, 16);
  return { page, num, title, lede, src, claims: [...new Set(claims[page] || [])], chapters };
}

const args = process.argv.slice(2);
const files = (args.length ? args.map(a => a.replace(/\.html$/, "") + ".html")
  : fs.readdirSync(ROOT).filter(f => f.endsWith(".html") && f !== "template.html"))
  .filter(f => /<section class="chapter/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
fs.mkdirSync(OUT, { recursive: true });
const claims = claimsByPage();
const index = [];
for (const f of files.sort()) {
  const p = buildPage(f, claims);
  fs.writeFileSync(path.join(OUT, p.page + ".json"), JSON.stringify(p) + "\n");
  const words = p.chapters.reduce((a, c) => a + c.text.split(" ").length, 0);
  console.log(`  ${p.page.padEnd(16)} ${String(p.chapters.length).padStart(2)} chapters  ${String(words).padStart(6)} words  ${String(p.claims.length).padStart(4)} claims`);
  index.push({ page: p.page, num: p.num, title: p.title, src: p.src,
    chapters: p.chapters.map(c => ({ id: c.id, n: c.n, title: c.title, dek: c.dek,
      terms: Object.keys(c.terms), figs: c.figures.map(f => f.title).filter(Boolean) })) });
}
if (!args.length) {
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index) + "\n");
  console.log(`\n  ${index.length} packs and an index written to tutor/`);
}
