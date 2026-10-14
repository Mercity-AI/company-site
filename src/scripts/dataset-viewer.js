/* The SAE guardrail log's dataset viewer: 32 test records of the topic-shift
   corpus, filterable by topic count, with every topic span highlighted and
   the details of how each record was generated. Ported from
   SAE-Guardrails/blog_new/figures/dataset_viewer.template.html. Data:
   dataset.json from export_site_data.py,
   { topics, records: [{ row, title, topics, prompt, response, words, scenario, taxonomy, strategy, generator, verdict, critique }] }
   where prompt and response are [[topic index or -1, text], ...]. */

const SHORT = ["Enterprise documents", "General news", "Customer service", "Legal", "Financial", "HR & people ops", "Healthcare"];
const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const plain = sp => sp.map(s => s[1]).join("");
const opening = sp => { const w = plain(sp).trim().split(/\s+/); return w.slice(0, 7).join(" ").replace(/[.,;:?!]+$/, "") + (w.length > 7 ? "…" : ""); };
const nf = n => n.toLocaleString("en-US");

function loadPref(k, d) { try { const v = localStorage.getItem("dsv1." + k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function savePref(k, v) { try { localStorage.setItem("dsv1." + k, JSON.stringify(v)); } catch {} }

/* light markdown inside topic spans: **bold**, headings as bold lines, list stars as bullets */
function richSpans(sp) {
  const st = { bold: false, lineStart: true };
  return sp.map(([t, text]) => {
    let out = "";
    for (const line of text.split(/(\n)/)) {
      if (line === "\n") { out += "\n"; st.lineStart = true; st.bold = false; continue; }
      let s = line;
      if (st.lineStart) {
        const h = s.match(/^(\s*)#{1,6}\s+(.*)$/);
        if (h) s = h[1] + "**" + h[2] + "**";
        s = s.replace(/^(\s*)[*-](\s)/, "$1•$2");
      }
      s.split("**").forEach((part, i) => { if (i) st.bold = !st.bold; if (part) out += st.bold ? `<b>${esc(part)}</b>` : esc(part); });
      if (line.trim()) st.lineStart = false;
    }
    return [t, out];
  });
}

export async function init_dataset_viewer(root, src, signal) {
  const find = key => root.querySelector(`[data-viewer="${key}"]`);
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`${src}: ${res.status}`);
  const DATA = await res.json();
  signal.throwIfAborted();
  const T = DATA.topics, R = DATA.records;

  const firstMulti = (R.find(r => r.topics.length === 3) || R[0]).row;  // open on a three-topic record
  const state = { count: loadPref("count", "all"), view: loadPref("view", "conv"), row: loadPref("row", firstMulti) };
  if (!R.some(r => r.row === state.row)) state.row = firstMulti;
  const visible = () => R.filter(r => state.count === "all" || r.topics.length === +state.count);

  function strip(r) {
    const len = new Array(7).fill(0);
    for (const [t, s] of r.response) if (t >= 0) len[t] += s.length;
    const total = len.reduce((a, b) => a + b, 0) || 1;
    // each label sits in a column the same width as its segment, so it is centred under it
    const share = t => len[t] / total;
    const segs = r.topics.map(t => `<i class="t${t}" style="flex:${share(t)}" title="${esc(T[t])}: ${Math.round(100 * share(t))}% of the response"></i>`).join("");
    const lbls = r.topics.map(t => `<span style="flex:${share(t)}"><b>${esc(SHORT[t])}</b> ${Math.round(100 * share(t))}%</span>`).join("");
    return `<div><div class="strip">${segs}</div><div class="strip-lbl">${lbls}</div></div>`;
  }

  function conversation(r) {
    const prompt = r.prompt.map(([t, s]) => t < 0 ? esc(s) : `<span class="hl t${t}">${esc(s)}</span>`).join("");
    const seen = new Set();
    const resp = richSpans(r.response).map(([t, html]) => {
      if (t < 0) return html;
      const mark = seen.has(t) ? "" : `<span class="tagmark t${t}"><span class="dot"></span>${esc(SHORT[t])}</span>`;
      seen.add(t);
      // keep leading blank lines outside the highlight so a new span starts on its own line
      const m = html.match(/^(\s*)([\s\S]*?)(\s*)$/);
      return `${m[1]}${mark}<span class="hl t${t}">${m[2]}</span>${m[3]}`;
    }).join("");
    return `<div class="block"><span class="eyebrow">Prompt</span><div class="prompt">${prompt}</div></div>
      <div class="block grow"><span class="eyebrow">Response · ${nf(r.words)} words</span><div class="response" tabindex="0" role="region" aria-label="Response">${resp.trim()}</div></div>`;
  }

  function generation(r) {
    const tax = r.taxonomy.map(([f, n]) => `<div><span class="f">${esc(f)}</span><span class="${n === "None" ? "none" : ""}">${n === "None" ? "none (stops here)" : esc(n)}</span></div>`).join("");
    return `<div class="grow"><div class="scroll" tabindex="0" role="region" aria-label="How it was generated"><dl class="facts">
      <dt>Scenario</dt><dd>${esc(r.scenario)}</dd>
      <dt>Taxonomy draw</dt><dd><div class="tax">${tax}</div><div class="note">Sampled before anything is written, so the topics and their order are fixed in advance.</div></dd>
      <dt>Sampling strategy</dt><dd>${esc(r.strategy)}</dd>
      <dt>Generator and critic</dt><dd>${esc(r.generator)}</dd>
      <dt>Critic's verdict</dt><dd><span class="verdict">${esc(r.verdict || "accept")}</span>${esc(r.critique)}</dd>
    </dl></div></div>`;
  }

  function renderList() {
    const vis = visible();
    if (!vis.some(r => r.row === state.row) && vis.length) state.row = vis[0].row;
    find("list").innerHTML = vis.length ? vis.map(r => `
      <button type="button" class="rec" data-row="${r.row}" aria-pressed="${r.row === state.row}" title="${esc(plain(r.prompt))}">
        <span class="name">${esc(r.title || opening(r.prompt))}</span>
        <span class="seq">${r.topics.length} topic${r.topics.length > 1 ? "s" : ""} · ${nf(r.words)} words</span>
      </button>`).join("") : `<p class="empty">No records match these filters.</p>`;
  }

  function renderMain() {
    root.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-selected", String(t.dataset.v === state.view)));
    const r = visible().find(x => x.row === state.row);
    if (!r) { find("read").innerHTML = `<p class="empty">Pick a record on the left.</p>`; return; }
    find("read").innerHTML = `<header class="rec-hd"><h3>Record ${nf(r.row)}</h3>${strip(r)}</header>
      ${state.view === "conv" ? conversation(r) : generation(r)}
      <div class="key">${T.map((t, i) => `<span class="t${i}"><span class="dot"></span>${esc(t)}</span>`).join("")}</div>`;
  }

  function renderControls() {
    root.querySelectorAll('[data-viewer="count"] button').forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === String(state.count))));
  }

  // Keep the picked record in view inside the list only; scrollIntoView would move the page too.
  function revealPicked() {
    const list = find("list"), on = list.querySelector('.rec[aria-pressed="true"]');
    if (!on) return;
    const horizontal = list.scrollWidth > list.clientWidth + 1 && list.scrollHeight <= list.clientHeight + 1;
    if (horizontal) {
      const left = on.offsetLeft - list.offsetLeft;
      if (left < list.scrollLeft || left + on.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = left - 8;
    } else {
      const top = on.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + on.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top - list.clientHeight / 2 + on.offsetHeight / 2;
    }
  }

  function render() { renderControls(); renderList(); renderMain(); }
  function set(k, v) { state[k] = v; savePref(k, v); render(); }
  function step(d) {
    const vis = visible(); if (!vis.length) return;
    const i = Math.max(0, vis.findIndex(r => r.row === state.row));
    set("row", vis[(i + d + vis.length) % vis.length].row);
    revealPicked();
  }

  find("count").addEventListener("click", e => { const b = e.target.closest("button"); if (b) set("count", b.dataset.v); }, { signal });
  find("list").addEventListener("click", e => { const b = e.target.closest(".rec"); if (b) set("row", +b.dataset.row); }, { signal });
  find("tabs").addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) set("view", b.dataset.v); }, { signal });
  find("prev").addEventListener("click", () => step(-1), { signal });
  find("next").addEventListener("click", () => step(1), { signal });
  // arrow keys step through records while focus is in the list or on the arrows
  root.addEventListener("keydown", e => {
    if (!e.target.closest('[data-viewer="list"], [data-viewer="prev"], [data-viewer="next"]')) return;
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    step(d);
    if (e.target.closest('[data-viewer="list"]')) find("list").querySelector('.rec[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, { signal });
  render();
  revealPicked();
}
