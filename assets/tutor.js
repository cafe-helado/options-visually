/* ═══════════════════════════════════════════════════════════════════════
   tutor.js — an "ask the tutor" panel on every page, loaded only on demand.

   Safe to host on GitHub Pages because nothing secret is in the site:
   · Bring your own key. The reader pastes their own Anthropic API key. It is
     held in sessionStorage (or localStorage if they tick "remember"), and it
     is sent only to api.anthropic.com by the official SDK, which is vendored
     into assets/vendor at a pinned version — no third-party script runs.
   · Model output is never inserted as HTML: it is escaped, then a handful of
     markdown marks (bold, code, lists) are re-applied.
   · Tools run in the page and only do three things: compute with the engine's
     bs(), read the site's own packs, and move a figure's sliders inside their
     own ranges. Every tool input is validated before it runs.

   Cheap by construction:
   · The tutor never sees raw HTML. mktutor.js builds tutor/<page>.json once;
     each question sends a short outline (chapters, figures, verified numbers)
     and the tutor fetches a chapter's text only when it needs it, in parts.
   · The fixed prompt and the page outline are cached; the conversation is
     cached as it grows. Live state (where the reader is, slider values)
     goes after the cache, in the new user turn.
   · Low effort, a capped reply length, at most four tool rounds a question,
     a fresh thread after ten turns, a local cache of first-question answers,
     and a monthly spending cap the reader sets. Every reply shows its cost.
   ═══════════════════════════════════════════════════════════════════════ */
import { Anthropic } from "./vendor/anthropic-sdk-1.6.0.mjs";

const PAGE = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
const PACKS = new URL("../tutor/", import.meta.url);
const LS = { key: "ov-tutor-key", set: "ov-tutor-settings", spend: "ov-tutor-spend", cache: "ov-tutor-cache-v1" };
const MODELS = {
  "claude-opus-5-5":   { label: "Claude Opus 5.5 (best)", in: 4,    out: 20,   read: 0.20, write: 5.0,   fallback: true },
  "claude-sonnet-5-5": { label: "Claude Sonnet 5.5",      in: 2,    out: 10,   read: 0.10, write: 2.5,   fallback: true },
  "claude-haiku-5-5":  { label: "Claude Haiku 5.5 (cheapest)", in: 0.10, out: 0.50, read: 0.01, write: 0.125, fallback: false }
};
const MAX_TOOL_ROUNDS = 4, MAX_TURNS = 10, MAX_TOKENS = 2048, PART_WORDS = 1100;

/* ── storage, every access guarded: private windows can throw ─────────── */
const store = {
  get(k, s = localStorage) { try { return s.getItem(k); } catch { return null; } },
  set(k, v, s = localStorage) { try { s.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch {} }
};
const settings = Object.assign({ model: "claude-opus-5-5", cap: 5, remember: false },
  JSON.parse(store.get(LS.set) || "{}"));
if (!MODELS[settings.model]) settings.model = "claude-opus-5-5";
const saveSettings = () => store.set(LS.set, JSON.stringify(settings));
const getKey = () => store.get(LS.key, sessionStorage) || store.get(LS.key) || "";
function setKey(k, remember) {
  store.del(LS.key);
  if (k) store.set(LS.key, k, remember ? localStorage : sessionStorage);
}
const month = () => new Date().toISOString().slice(0, 7);
function spend() {
  const s = JSON.parse(store.get(LS.spend) || "{}");
  return s.month === month() ? s : { month: month(), usd: 0 };
}
function addSpend(usd) { const s = spend(); s.usd += usd; store.set(LS.spend, JSON.stringify(s)); }
function costOf(model, u) {
  const p = MODELS[model] || MODELS[settings.model];
  return ((u.input_tokens || 0) * p.in + (u.output_tokens || 0) * p.out +
    (u.cache_read_input_tokens || 0) * p.read + (u.cache_creation_input_tokens || 0) * p.write) / 1e6;
}

/* ── packs ─────────────────────────────────────────────────────────────── */
const packCache = {};
async function pack(page) {
  if (!/^[\w-]+$/.test(page)) throw new Error("bad page name");
  if (!packCache[page]) packCache[page] = fetch(new URL(page + ".json", PACKS)).then(r => {
    if (!r.ok) throw new Error("no pack for " + page);
    return r.json();
  });
  return packCache[page];
}

/* ── the fixed prompt: identical on every page, so it caches site-wide ── */
const SYSTEM = `You are the tutor built into "Options, visually", an interactive series on options theory. The reader is on one page of it and asks you about what they are reading.

How to answer:
- Short by default: two to five sentences in plain words, sentence case, no exclamation marks. Go longer only when the reader asks for depth or a derivation.
- Every equation you write gets a plain-English reading right after it.
- Never do option arithmetic in your head. Call compute_bs for prices and greeks. When the page's "Verified figures" cover a number, quote that number: those are checked against the page's code.
- Prefer showing to telling. When a figure on the page can demonstrate the point, call set_figure to move it, then say in one sentence what to watch.
- Fetch only what you need. The outline below lists every chapter; call read_chapter for the text of one, and search_series to find where another page covers a topic. Do not read chapters you will not use.
- If the reader is working a check-yourself question, give a hint first and the answer only if they ask again.
- If the series does not cover something, say so in a few words, then answer from general knowledge and mark it as such.
- Signs matter in this subject. Before stating a direction (longer or shorter, dearer or cheaper, gains or loses), check it.`;

function outline(p) {
  const L = [`PAGE ${p.num ? "No. " + p.num + " — " : ""}${p.title}`, p.lede, "", "CHAPTERS (id, number, title, what it shows, figures)"];
  for (const c of p.chapters) {
    L.push(`${c.id} · ${c.n} ${c.title} — ${c.dek}`);
    for (const f of c.figures) if (f.title) L.push(`    figure: ${f.title}${f.ids.length ? " [" + f.ids.join(", ") + "]" : ""}`);
  }
  const groups = sliderGroups();
  if (groups.length) {
    L.push("", "FIGURE CONTROLS you can move with set_figure (key: parameter range)");
    for (const g of groups) L.push(`${g.key}${g.fig ? " (" + g.fig + ")" : ""}: ` +
      g.specs.map(s => `${s.k} ${s.name} ${s.min}…${s.max}`).join("; "));
  }
  if (p.claims.length) {
    L.push("", "VERIFIED FIGURES (each is re-derived from the page's own code by the site's test harness)");
    for (const c of p.claims) L.push("- " + c);
  }
  return L.join("\n");
}

/* ── live state, read from the engine's slider registry ─────────────────── */
const API = () => window.LABAPI || {};
function sliderGroups() {
  const S = API().SYNC || {};
  return Object.keys(S).sort().map(key => {
    const e = S[key], fig = e.host && e.host.closest && e.host.closest("figure");
    const h3 = fig && fig.querySelector(".figtop h3");
    return { key, specs: (e.specs || []).map(s => ({ k: s.k, name: s.name, min: +s.min, max: +s.max, step: +s.step, fmt: s.fmt })),
      state: e.state, fig: h3 ? h3.textContent.trim() : "", figEl: fig };
  });
}
const readout = fig => fig ? [...fig.querySelectorAll(".kv")].map(k =>
  [...k.querySelectorAll(".k")].map(x => x.textContent.trim() + " " + (x.nextElementSibling ? x.nextElementSibling.textContent.trim() : "")).join("; ")
).filter(Boolean).join(" | ").slice(0, 600) : "";
function liveState(focusFig) {
  const vh = innerHeight, secs = [...document.querySelectorAll("section.chapter")];
  let cur = null;
  for (const s of secs) if (s.getBoundingClientRect().top < vh * 0.42) cur = s;
  const h2 = cur && cur.querySelector(".chead h2"), n = cur && cur.querySelector(".cnum");
  const lines = [`Reader is in chapter ${cur ? cur.id + " · " + (n ? n.textContent : "") + " " + (h2 ? h2.textContent : "") : "(the opening, before chapter 01)"}.`];
  const groups = sliderGroups();
  const inView = groups.filter(g => g.figEl && (() => { const b = g.figEl.getBoundingClientRect(); return b.bottom > 0 && b.top < vh; })());
  for (const g of inView) {
    lines.push(`On screen: "${g.fig}" [${g.key}] ` + g.specs.map(s => `${s.k}=${fmtVal(s, g.state[s.k])}`).join(", ") +
      (readout(g.figEl) ? ` · readout: ${readout(g.figEl)}` : ""));
  }
  if (focusFig) {
    const h3 = focusFig.querySelector(".figtop h3"), cap = focusFig.querySelector("figcaption");
    lines.push(`The reader opened the tutor from the figure "${h3 ? h3.textContent.trim() : ""}". Caption: ${cap ? cap.textContent.trim().slice(0, 300) : "none"}. Readout: ${readout(focusFig) || "none"}.`);
  }
  return lines.join("\n");
}
const fmtVal = (s, v) => { try { return s.fmt ? s.fmt(v) : v; } catch { return v; } };

/* ── tools ─────────────────────────────────────────────────────────────── */
const TOOLS = [
  { name: "compute_bs", eager_input_streaming: true,
    description: "Black–Scholes price and greeks from the site's own engine. Use it for any option number instead of estimating. vol, r and q are decimals (0.25 = 25%). T is in years.",
    input_schema: { type: "object", additionalProperties: false, required: ["S", "K", "T", "vol", "type"],
      properties: { S: { type: "number" }, K: { type: "number" }, T: { type: "number" }, vol: { type: "number" },
        r: { type: "number" }, q: { type: "number" }, type: { type: "string", enum: ["call", "put"] } } } },
  { name: "read_chapter", eager_input_streaming: true,
    description: "The text of one chapter (prose, equations with readings, figure captions), in parts of about 1,100 words, plus its check-yourself questions with answers on the last part. Omit page for the current page.",
    input_schema: { type: "object", additionalProperties: false, required: ["chapter"],
      properties: { page: { type: "string" }, chapter: { type: "string", description: "chapter id such as c3" }, part: { type: "integer" } } } },
  { name: "search_series", eager_input_streaming: true,
    description: "Find which pages and chapters of the series cover a topic, by title, summary, glossary terms and figure names. Returns up to five matches to read with read_chapter.",
    input_schema: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string" } } } },
  { name: "set_figure", eager_input_streaming: true,
    description: "Move a figure on the current page by setting slider parameters (keys from FIGURE CONTROLS). Values are clamped to each slider's range. Returns what was applied and the figure's new readout.",
    input_schema: { type: "object", additionalProperties: false, required: ["key", "values"],
      properties: { key: { type: "string" }, values: { type: "object", additionalProperties: { type: "number" } } } } }
];
const num = (v, lo, hi) => typeof v === "number" && isFinite(v) && v >= lo && v <= hi;
const r6 = v => +(+v).toPrecision(6);
let figureMoved = false;

async function runTool(name, x) {
  if (!x || typeof x !== "object") throw new Error("input must be an object");
  if (name === "compute_bs") {
    if (!num(x.S, 1e-6, 1e7) || !num(x.K, 1e-6, 1e7) || !num(x.T, 1e-6, 50) || !num(x.vol, 1e-4, 10))
      throw new Error("S, K > 0; 0 < T <= 50 years; 0 < vol <= 10 as a decimal");
    const r = x.r === undefined ? 0 : x.r, q = x.q === undefined ? 0 : x.q;
    if (!num(r, -0.5, 1) || !num(q, -0.5, 1) || !["call", "put"].includes(x.type)) throw new Error("r and q are decimals; type is call or put");
    const g = API().bs(x.S, x.K, x.T, x.vol, r, q, x.type === "call");
    return { price: r6(g.price), delta: r6(g.delta), gamma: r6(g.gamma), vega_per_vol_point: r6(g.vega / 100),
      theta_per_calendar_day: r6(g.theta / 365), vanna: r6(g.vanna), volga: r6(g.volga), charm_per_year: r6(g.charm), d1: r6(g.d1), d2: r6(g.d2) };
  }
  if (name === "read_chapter") {
    const page = x.page || PAGE;
    if (typeof page !== "string" || typeof x.chapter !== "string") throw new Error("page and chapter are strings");
    const p = await pack(page);
    const c = p.chapters.find(c => c.id === x.chapter || c.n === x.chapter);
    if (!c) return { error: "no such chapter", chapters: p.chapters.map(c => c.id + " " + c.title) };
    const words = c.text.split(" "), parts = Math.max(1, Math.ceil(words.length / PART_WORDS));
    const part = Number.isInteger(x.part) ? Math.min(Math.max(1, x.part), parts) : 1;
    const out = { page, chapter: c.id, title: c.n + " " + c.title, part: `${part} of ${parts}`,
      text: words.slice((part - 1) * PART_WORDS, part * PART_WORDS).join(" ") };
    if (part === parts) {
      out.checks = c.checks;
      if (Object.keys(c.terms).length) out.glossary = c.terms;
    }
    return out;
  }
  if (name === "search_series") {
    if (typeof x.query !== "string" || !x.query.trim()) throw new Error("query is a non-empty string");
    const idx = await pack("index");
    const q = x.query.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
    const hits = [];
    for (const p of idx) for (const c of p.chapters) {
      const hay = [c.title, c.dek, ...(c.terms || []), ...(c.figs || [])].join(" ").toLowerCase();
      let s = 0; for (const w of q) if (hay.includes(w)) s += c.title.toLowerCase().includes(w) ? 3 : 1;
      if (s) hits.push({ s, page: p.page, page_title: p.title, chapter: c.id, title: c.n + " " + c.title, dek: c.dek });
    }
    return hits.sort((a, b) => b.s - a.s).slice(0, 5).map(({ s, ...h }) => h);
  }
  if (name === "set_figure") {
    const g = sliderGroups().find(g => g.key === x.key);
    if (!g) throw new Error("unknown key; valid keys: " + sliderGroups().map(g => g.key).join(", "));
    if (!x.values || typeof x.values !== "object") throw new Error("values is an object of parameter: number");
    const patch = {}, applied = {};
    for (const [k, v] of Object.entries(x.values)) {
      const s = g.specs.find(s => s.k === k);
      if (!s) throw new Error(`no parameter ${k} on ${x.key}; it has ${g.specs.map(s => s.k).join(", ")}`);
      if (typeof v !== "number" || !isFinite(v)) throw new Error(`${k} must be a number`);
      let c = Math.min(s.max, Math.max(s.min, v));
      if (s.step > 0) c = +(s.min + Math.round((c - s.min) / s.step) * s.step).toFixed(10);
      patch[k] = c; applied[k] = fmtVal(s, c);
    }
    const cv = g.figEl && g.figEl.querySelector("canvas");
    API().preset(x.key, patch, cv && cv.id);
    figureMoved = true;
    /* let the figure redraw; rAF is throttled in background tabs, so cap the wait */
    await Promise.race([new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise(r => setTimeout(r, 150))]);
    return { applied, readout: readout(g.figEl) };
  }
  throw new Error("unknown tool");
}

/* ── safe rendering: escape first, then a few marks ─────────────────────── */
const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function md(s) {
  const inl = t => t.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const item = /^\s*([-*]|\d+\.)\s+/;
  return esc(s).split(/\n{2,}/).map(b => {
    /* runs of list lines become a list; other runs become a paragraph */
    const out = []; let run = [], isList = null;
    const flush = () => { if (!run.length) return;
      out.push(isList ? "<ul>" + run.map(l => "<li>" + inl(l.replace(item, "")) + "</li>").join("") + "</ul>"
                      : "<p>" + inl(run.join("<br>")) + "</p>"); run = []; };
    for (const l of b.split("\n")) { const li = item.test(l); if (li !== isList) { flush(); isList = li; } run.push(l); }
    flush(); return out.join("");
  }).join("");
}

/* ── panel ─────────────────────────────────────────────────────────────── */
const CSS = `
#tutor{position:fixed;right:16px;bottom:16px;width:min(420px,calc(100vw - 32px));height:min(620px,calc(100vh - 32px));
 background:var(--chalk,#EDF0EC);color:var(--ink,#14181A);border:1px solid var(--hair,#c9cec9);box-shadow:0 12px 40px rgba(20,24,26,.18);
 display:flex;flex-direction:column;z-index:9999;font:15px/1.5 Newsreader,Georgia,serif}
#tutor[hidden]{display:none}
#tutor header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--hair,#c9cec9);font:12px/1.3 "IBM Plex Mono",monospace}
#tutor header b{flex:1;font:600 14px/1.2 Fraunces,Georgia,serif}
#tutor button{font:12px "IBM Plex Mono",monospace;background:none;border:1px solid var(--hair,#c9cec9);color:inherit;padding:4px 8px;cursor:pointer}
#tutor button.pri{background:var(--ink,#14181A);color:var(--chalk,#EDF0EC);border-color:var(--ink,#14181A)}
#tutor .log{flex:1;overflow:auto;padding:12px}
#tutor .m{margin:0 0 12px}#tutor .m p{margin:0 0 8px}#tutor .m ul{margin:0 0 8px;padding-left:20px}
#tutor .you{color:var(--grey,#5c635d);font-style:italic}
#tutor .meta{font:11px "IBM Plex Mono",monospace;color:var(--grey,#5c635d);margin-top:-6px}
#tutor .err{color:var(--verm,#E5432C)}
#tutor form.ask{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--hair,#c9cec9)}
#tutor textarea{flex:1;resize:none;height:44px;font:inherit;background:transparent;color:inherit;border:1px solid var(--hair,#c9cec9);padding:6px}
#tutor .set{padding:12px;border-bottom:1px solid var(--hair,#c9cec9);font:12px/1.5 "IBM Plex Mono",monospace;display:grid;gap:8px}
#tutor .set input,#tutor .set select{font:inherit;width:100%;box-sizing:border-box;background:transparent;color:inherit;border:1px solid var(--hair,#c9cec9);padding:4px}
#tutor .set label.row{display:flex;gap:6px;align-items:center}#tutor .set label.row input{width:auto}
#tutor .note{color:var(--grey,#5c635d)}
@media (max-width:520px){#tutor{right:0;bottom:0;width:100vw;height:85vh;border-left:0;border-right:0}}`;

let el, log, input, client = null, messages = [], turns = 0, sessionUsd = 0, focusFig = null, busy = false;

function build() {
  const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
  el = document.createElement("aside"); el.id = "tutor"; el.setAttribute("aria-label", "Tutor"); el.hidden = true;
  el.innerHTML = `<header><b>Tutor</b><span class="cost"></span><button type="button" data-a="set" aria-label="Settings">key</button><button type="button" data-a="new">new</button><button type="button" data-a="close" aria-label="Close">×</button></header>
  <div class="set" hidden>
    <label>Your Anthropic API key<input type="password" name="key" autocomplete="off" spellcheck="false" placeholder="sk-ant-..."></label>
    <label class="row"><input type="checkbox" name="remember"> Remember on this device</label>
    <label>Model<select name="model">${Object.entries(MODELS).map(([id, m]) => `<option value="${id}">${esc(m.label)}</option>`).join("")}</select></label>
    <label>Monthly spending cap, US dollars<input type="number" name="cap" min="0" step="0.5"></label>
    <div style="display:flex;gap:8px"><button type="button" class="pri" data-a="save">Save</button><button type="button" data-a="forget">Forget key</button></div>
    <div class="note">Your key stays in this browser and is sent only to api.anthropic.com. This site stores nothing and never sees it. Usage is billed to your Anthropic account; get a key at console.anthropic.com.</div>
  </div>
  <div class="log" aria-live="polite"></div>
  <form class="ask"><textarea placeholder="Ask about this page" aria-label="Your question"></textarea><button class="pri" type="submit">Ask</button></form>`;
  document.body.appendChild(el);
  log = el.querySelector(".log"); input = el.querySelector("textarea");
  const set = el.querySelector(".set"), f = set.querySelector.bind(set);
  const fill = () => { f("[name=key]").value = getKey(); f("[name=remember]").checked = settings.remember;
    f("[name=model]").value = settings.model; f("[name=cap]").value = settings.cap; };
  el.addEventListener("click", e => {
    const a = e.target.closest("[data-a]"); if (!a) return;
    const act = a.dataset.a;
    if (act === "close") el.hidden = true;
    if (act === "set") { set.hidden = !set.hidden; fill(); }
    if (act === "new") { messages = []; turns = 0; note("Started a new thread."); }
    if (act === "save") {
      const k = f("[name=key]").value.trim();
      if (k && !/^sk-ant-[\w-]{20,}$/.test(k)) { note("That does not look like an Anthropic API key.", true); return; }
      settings.remember = f("[name=remember]").checked; settings.model = f("[name=model]").value;
      settings.cap = Math.max(0, +f("[name=cap]").value || 0); saveSettings();
      setKey(k, settings.remember); client = null; set.hidden = true; meter(); note(k ? "Saved." : "Saved, with no key.");
    }
    if (act === "forget") { setKey(""); client = null; fill(); note("Key removed from this browser."); }
  });
  el.querySelector("form").addEventListener("submit", e => { e.preventDefault(); ask(); });
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } });
  meter();
}
function meter() {
  el.querySelector(".cost").textContent = `$${sessionUsd.toFixed(3)} now · $${spend().usd.toFixed(2)} of $${(+settings.cap).toFixed(2)} this month`;
}
function bubble(cls, html) {
  const d = document.createElement("div"); d.className = "m " + cls; d.innerHTML = html; log.appendChild(d);
  log.scrollTop = log.scrollHeight; return d;
}
const note = (t, err) => bubble("meta" + (err ? " err" : ""), esc(t));

/* ── local answer cache for the first question of a thread ─────────────── */
const norm = q => q.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const cacheKey = (q, chap, fig) => [PAGE, chap, fig, norm(q)].join("|");
function cacheGet(k) { const c = JSON.parse(store.get(LS.cache) || "{}"); return c[k] && c[k].a; }
function cachePut(k, a) {
  const c = JSON.parse(store.get(LS.cache) || "{}"); c[k] = { a, t: Date.now() };
  const ks = Object.keys(c); if (ks.length > 150) ks.sort((x, y) => c[x].t - c[y].t).slice(0, ks.length - 150).forEach(x => delete c[x]);
  store.set(LS.cache, JSON.stringify(c));
}

/* ── one question, with its tool loop ──────────────────────────────────── */
async function ask(force) {
  const q = input.value.trim();
  if (!q || busy) return;
  const key = getKey();
  if (!key) { el.querySelector(".set").hidden = false; note("Add your API key first. It stays in this browser.", true); return; }
  if (!navigator.onLine) { note("The tutor needs a connection; the rest of the page works offline.", true); return; }
  if (spend().usd >= settings.cap) { note(`This month's cap of $${(+settings.cap).toFixed(2)} is reached. Raise it under "key" to keep going.`, true); return; }
  input.value = ""; bubble("you", esc(q));

  const sec = [...document.querySelectorAll("section.chapter")].filter(s => s.getBoundingClientRect().top < innerHeight * 0.42).pop();
  const figTitle = focusFig && focusFig.querySelector(".figtop h3") ? focusFig.querySelector(".figtop h3").textContent.trim() : "";
  const ck = cacheKey(q, sec ? sec.id : "", figTitle);
  if (!messages.length && !force) {
    const hit = cacheGet(ck);
    if (hit) {
      bubble("", md(hit));
      const m = bubble("meta", "Saved answer from earlier, no cost. ");
      const b = document.createElement("button"); b.type = "button"; b.textContent = "ask again";
      b.onclick = () => { input.value = q; m.remove(); ask(true); }; m.appendChild(b);
      return;
    }
  }

  busy = true; figureMoved = false;
  if (turns >= MAX_TURNS) { messages = []; turns = 0; note("Started a fresh thread to keep each question cheap."); }
  const firstOfThread = messages.length === 0;
  let p;
  try { p = await pack(PAGE); } catch { busy = false; note("This page has no tutor pack yet.", true); return; }
  client = client || new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
  const system = [{ type: "text", text: SYSTEM }, { type: "text", text: outline(p), cache_control: { type: "ephemeral" } }];
  messages.push({ role: "user", content: [{ type: "text", text: "[Where the reader is right now]\n" + liveState(focusFig) }, { type: "text", text: q }] });
  focusFig = null; turns++;

  const out = bubble("", '<p class="meta">thinking…</p>');
  let usd = 0, answer = "";
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const M = MODELS[settings.model];
      const req = { model: settings.model, max_tokens: MAX_TOKENS, system, tools: TOOLS, messages,
        cache_control: { type: "ephemeral" }, thinking: { type: "adaptive" }, output_config: { effort: "low" },
        tool_choice: round === MAX_TOOL_ROUNDS ? { type: "none" } : { type: "auto" } };
      if (M.fallback) { req.betas = ["server-side-fallback-2026-07-01"]; req.fallbacks = "default"; }
      const stream = client.beta.messages.stream(req);
      let live = "";
      stream.on("text", d => { live += d; out.innerHTML = md(answer + live); log.scrollTop = log.scrollHeight; });
      const msg = await stream.finalMessage();
      usd += costOf(msg.model, msg.usage);
      /* replay the turn unchanged (thinking blocks included), minus the SDK's
         client-side parsed_output field, which the API does not accept */
      messages.push({ role: "assistant", content: msg.content.map(b => { const c = { ...b }; delete c.parsed_output; return c; }) });
      answer += live;
      if (msg.stop_reason === "refusal") { answer += (answer ? "\n\n" : "") + "The model declined to answer this one."; break; }
      if (msg.stop_reason === "max_tokens") { answer += "\n\n(cut off at the length limit; ask it to continue)"; break; }
      if (msg.stop_reason !== "tool_use") break;
      const results = [];
      for (const b of msg.content.filter(b => b.type === "tool_use")) {
        try { results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(await runTool(b.name, b.input)) }); }
        catch (e) { results.push({ type: "tool_result", tool_use_id: b.id, is_error: true, content: String(e.message || e) }); }
      }
      messages.push({ role: "user", content: results });
      if (answer && !/\n$/.test(answer)) answer += "\n\n";
    }
    out.innerHTML = md(answer.trim() || "(no answer)");
    if (firstOfThread && !figureMoved && answer.trim()) cachePut(ck, answer.trim());
  } catch (e) {
    messages = []; turns = 0;
    const s = e && e.status;
    out.remove();
    note(s === 401 ? "The API key was rejected. Check it under \"key\"." :
         s === 429 ? "Rate limited by the API. Wait a moment and ask again." :
         s === 529 || s >= 500 ? "The API is busy. Try again shortly." :
         "Could not reach the tutor: " + (e && e.message ? String(e.message).slice(0, 200) : "unknown error"), true);
  } finally {
    if (usd) { addSpend(usd); sessionUsd += usd; }
    if (usd) bubble("meta", `$${usd.toFixed(4)}`);
    meter(); busy = false;
  }
}

/* for testing the tools and prompt without spending tokens */
export const _test = { runTool, outline: async page => outline(await pack(page || PAGE)), liveState, md, TOOLS, SYSTEM };

export function open(fig) {
  if (!el) build();
  focusFig = fig || null;
  el.hidden = false;
  if (fig) { const h = fig.querySelector(".figtop h3"); input.placeholder = "Ask about “" + (h ? h.textContent.trim() : "this figure") + "”"; }
  else input.placeholder = "Ask about this page";
  if (!getKey()) { el.querySelector(".set").hidden = false; el.querySelector(".set [name=cap]").value = settings.cap; }
  input.focus();
}
