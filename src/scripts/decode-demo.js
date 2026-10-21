/* The SAE guardrail log's switch demo: Gemma's own answer, labelled token by
   token by the detector, next to GPT's tagged reference answer to the same
   prompt. Playback pauses at every topic switch. Ported from
   SAE-Guardrails/blog_new/figures/decode_demo.template.html. Layout "a" puts
   the answers side by side with horizontal bars; "b" gives each answer a row
   with vertical bars. Data: decode-demo.json from export_site_data.py. */

const SHORT = ["Enterprise documents", "General news", "Customer service", "Legal", "Financial", "HR & people ops", "Healthcare"];
const MIN_RUN = 25;              // a detector switch counts once the new label holds this long
const BEFORE = 45, AFTER = 60;   // text shown around each switch, in tokens
const MIX = 20;                  // bars: topic mix of the last MIX tokens
const STEP = 2, TICK_MS = 120, HOLD_MS = 1400;   // playback speed and the pause at each switch
const SIDES = ["gemma", "gpt"], NAMES = { gemma: "Gemma's answer", gpt: "GPT's answer" };
const esc = s => s.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const ICON = {
  play: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1 0l9 5-9 5z"/></svg>',
  pause: '<svg viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="0" width="3" height="10"/><rect x="6" y="0" width="3" height="10"/></svg>',
  restart: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1a5 5 0 1 1-4.6 3H0l2.2-2.7L4.4 4H2.6A3.8 3.8 0 1 0 6 2.2z"/></svg>',
};

function sustained(p) {
  const out = []; let cur = -1, j = 0;
  while (j < p.length) {
    if (p[j] !== cur) {
      let k = j; while (k < p.length && k - j < MIN_RUN && p[k] === p[j]) k++;
      if (k - j >= MIN_RUN) { out.push(j); cur = p[j]; j = k; continue; }
    }
    j++;
  }
  return out;
}
function steps(r) {
  // true switches in GPT's tagged answer; for each, the detector's first sustained switch to that topic in Gemma's answer
  const g = r.gpt.p, sw = sustained(r.gemma.p), out = [];
  let after = 0;
  for (let j = 1; j < g.length; j++) if (g[j] !== g[j - 1]) {
    const hit = sw.find(x => x > after && r.gemma.p[x] === g[j]);
    if (hit !== undefined) after = hit;
    out.push({ from: g[j - 1], to: g[j], gpt: j, gemma: hit ?? null });
  }
  return out;
}
const lineLag = (tokens, j) => { let s = j; while (s > 0 && !/\n/.test(tokens[s - 1])) s--; return j - s + 1; };
function mix(p, end) {
  const a = Math.max(0, end - MIX), cnt = new Array(7).fill(0);
  for (let j = a; j < end; j++) cnt[p[j]]++;
  return cnt.map(c => end > a ? c / (end - a) : 0);
}

// one token's HTML, markdown shown as formatting; returns [html, trailing newlines]
function tokenHTML(s, st) {
  if (st.lineStart) {
    s = s.replace(/^(\s*)#{1,6}\s?/, "$1").replace(/^(\s*)\*(\s)/, "$1•$2");
    if (/^\s*\*$/.test(s)) s = s.replace("*", "•");
  }
  let out = "";
  s.split("**").forEach((part, i) => { if (i) st.bold = !st.bold; if (part) out += st.bold ? `<b>${esc(part)}</b>` : esc(part); });
  if (/\n/.test(s)) st.bold = false;
  if (s.trim()) st.lineStart = /\n\s*$/.test(s); else if (/\n/.test(s)) st.lineStart = true;
  const m = out.match(/^([\s\S]*?)(\n[\s\n]*)?$/);
  return [m[1], (m[2] || "").replace(/\n{3,}/g, "\n\n")];
}

export async function init_decode_demo(root, src, layout, signal) {
  const find = key => root.querySelector(`[data-viewer="${key}"]`);
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`${src}: ${res.status}`);
  const DATA = await res.json();
  signal.throwIfAborted();
  const T = DATA.topics;
  const vertical = layout !== "a";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  for (const r of DATA.records) {
    for (const side of SIDES) { const s = r[side]; s.p = Array.from(s.labels, Number); s.n = s.p.length; }
    r.steps = steps(r);
  }

  const cur = { rec: 0 };
  const run = {};   // per side: { seq, sw, pos, timer, holding, ... }
  const fig = side => find("fig-" + side);
  const playBtn = side => fig(side).querySelector('[data-act="play"]');

  function build(side) {
    const r = DATA.records[cur.rec], s = r[side], el = fig(side);
    const sw = r.steps.map(st => ({ at: side === "gpt" ? st.gpt : st.gemma, from: st.from, to: st.to })).filter(x => x.at !== null);
    const ctl = `<div class="ctl"><button type="button" class="btn primary" data-act="play"></button><button type="button" class="btn" data-act="restart">${ICON.restart}Restart</button></div>`;
    el.innerHTML = `<div class="fig-hd"><h3>${NAMES[side]}</h3>${ctl}</div>`;
    if (!sw.length) { el.insertAdjacentHTML("beforeend", `<p class="none">The detector never settles on the next topic in Gemma's answer.</p>`); run[side] = null; return; }

    // windows around each switch, merged where they overlap
    const wins = [];
    for (const x of sw) {
      let a = Math.max(0, x.at - BEFORE);
      const z = Math.min(s.n, x.at + AFTER);
      for (let j = a; j < Math.min(a + 15, x.at); j++) if (/\n/.test(s.tokens[j])) { a = j + 1; break; }
      if (wins.length && a <= wins[wins.length - 1][1] + 10) wins[wins.length - 1][1] = z; else wins.push([a, z]);
    }
    const seq = [];   // display order: token indices
    let html = "";
    wins.forEach(([a, z], w) => {
      if (w > 0) html += `<span class="gap" data-pos="${seq.length}">· · ·</span>`;
      else if (a > 0) html += `<span class="more">… </span>`;
      const st = { bold: false, lineStart: a === 0 || /\n\s*$/.test(s.tokens[a - 1] || "\n") };
      for (let j = a; j < z; j++) {
        const x = sw.find(v => v.at === j);
        if (x) html += `<span class="swm t${x.to}" data-pos="${seq.length}"><span class="dot"></span>${esc(SHORT[x.to])}</span>`;
        const [body, tail] = tokenHTML(s.tokens[j], st);
        html += `<span class="k" data-pos="${seq.length}">${body ? `<span class="hl t${s.p[j]}">${body}</span>` : ""}${tail}</span>`;
        seq.push(j);
      }
      if (w === wins.length - 1 && z < s.n) html += `<span class="more"> …</span>`;
    });
    for (const x of sw) {
      x.pos = seq.indexOf(x.at);
      x.pre = mix(s.p, x.at);
      x.note = side === "gpt" ? `The topic changes to ${SHORT[x.to]} here` : `Switched to ${SHORT[x.to]} on token ${lineLag(s.tokens, x.at)} of the new line`;
    }

    const order = [...r.topics, ...[0, 1, 2, 3, 4, 5, 6].filter(t => !r.topics.includes(t))];
    const bars = vertical
      ? `<div class="vchart">${order.map(t => `<div class="vcol t${t}${r.topics.includes(t) ? "" : " off"}" data-t="${t}"><span class="val"></span><span class="vbar"><span class="ghost"></span><span class="fill"></span></span><span class="name">${esc(SHORT[t])}</span></div>`).join("")}<span class="callout"></span></div>`
      : `<div class="rows">${order.map(t => `<div class="row t${t}${r.topics.includes(t) ? "" : " off"}" data-t="${t}"><span class="name">${esc(SHORT[t])}</span><span class="track"><span class="ghost"></span><span class="fill"></span></span><span class="val"></span><span class="slot"></span></div>`).join("")}</div>`;
    el.insertAdjacentHTML("beforeend", vertical
      ? `<div class="fig-body"><div class="textcol"><div class="card" tabindex="0" role="region" aria-label="${NAMES[side]}">${html}</div><div class="status" aria-live="polite"></div></div>${bars}</div>`
      : `<div class="card" tabindex="0" role="region" aria-label="${NAMES[side]}">${html}</div>${bars}`);

    run[side] = { s, seq, sw, pos: seq.length, timer: 0, holding: false, fig: el,
      card: el.querySelector(".card"), els: [...el.querySelectorAll("[data-pos]")], status: el.querySelector(".status") };
    playBtn(side).addEventListener("click", () => run[side].timer || run[side].holding ? pause(side) : play(side), { signal });
    el.querySelector('[data-act="restart"]').addEventListener("click", () => restart(side), { signal });
  }

  function draw(side, follow) {
    const v = run[side]; if (!v) return;
    const pos = v.pos, end = pos > 0 ? v.seq[pos - 1] + 1 : v.seq[0], m = mix(v.s.p, end);
    for (const el of v.els) el.classList.toggle("f", +el.dataset.pos >= pos);
    const passed = v.sw.filter(x => x.pos < pos), last = passed[passed.length - 1];
    const items = [...v.fig.querySelectorAll("[data-t]")];
    const prop = vertical ? "height" : "width";
    for (const it of items) {
      const t = +it.dataset.t;
      it.querySelector(".fill").style[prop] = (m[t] * 100).toFixed(1) + "%";
      it.querySelector(".ghost").style[prop] = last ? (last.pre[t] * 100).toFixed(1) + "%" : "0%";
      it.querySelector(".val").textContent = Math.round(m[t] * 100) + "%";
    }
    if (vertical) {
      const c = v.fig.querySelector(".vchart .callout");
      c.style.visibility = last ? "visible" : "hidden";
      if (last) {
        const col = v.fig.querySelector(`.vcol[data-t="${last.to}"]`), chart = c.parentElement;
        c.textContent = last.note;
        const cx = col.offsetLeft + col.offsetWidth / 2, half = c.offsetWidth / 2;
        c.style.left = Math.min(Math.max(cx, half), chart.clientWidth - half) + "px";
        const bar = col.querySelector(".vbar"), top = bar.offsetTop + bar.offsetHeight * (1 - m[last.to]) - 22;
        c.style.setProperty("--lead", Math.max(6, top - c.offsetHeight) + "px");
      }
      v.status.textContent = last ? `${SHORT[last.from]} → ${SHORT[last.to]}` : "";
    } else {
      for (const it of items) {
        const slot = it.querySelector(".slot"), want = last && +it.dataset.t === last.to;
        if (want && slot.dataset.note !== last.note) { slot.innerHTML = `<span class="callout">${esc(last.note)}</span>`; slot.dataset.note = last.note; }
        if (!want && slot.dataset.note) { slot.innerHTML = ""; delete slot.dataset.note; }
      }
    }
    if (follow) {
      const el = v.fig.querySelector(`.k[data-pos="${pos - 1}"]`);
      if (el) { const y = el.offsetTop - v.card.offsetTop; if (y > v.card.scrollTop + v.card.clientHeight - 40) v.card.scrollTop = y - v.card.clientHeight + 70; }
    }
  }

  function tick(side) {
    const v = run[side];
    const next = v.sw.find(x => x.pos >= v.pos && x.pos < v.pos + STEP);
    v.pos = next ? next.pos + 1 : Math.min(v.pos + STEP, v.seq.length);
    draw(side, true);
    if (next) {
      // hold on the switch so it registers
      v.holding = true; clearInterval(v.timer); v.timer = 0;
      v.fig.querySelectorAll(".swm.hot, .callout.hot").forEach(e => e.classList.remove("hot"));
      const marks = [v.fig.querySelector(`.swm[data-pos="${next.pos}"]`), v.fig.querySelector(".callout")];
      marks.forEach(e => { if (e) { void e.offsetWidth; e.classList.add("hot"); } });
      v.hold = setTimeout(() => { v.holding = false; if (v.pos < v.seq.length) v.timer = setInterval(() => tick(side), TICK_MS); else pause(side); buttons(); }, HOLD_MS);
    } else if (v.pos >= v.seq.length) pause(side);
  }
  function play(side) {
    const v = run[side]; if (!v) return;
    if (v.pos >= v.seq.length) { v.pos = 0; v.card.scrollTop = 0; }
    if (reduce) { v.pos = v.seq.length; draw(side, false); buttons(); return; }
    draw(side, true);
    v.timer = setInterval(() => tick(side), TICK_MS);
    buttons();
  }
  function pause(side) { const v = run[side]; if (!v) return; clearInterval(v.timer); clearTimeout(v.hold); v.timer = 0; v.holding = false; buttons(); }
  function restart(side) { const v = run[side]; if (!v) return; pause(side); v.pos = v.seq.length; play(side); }
  function buttons() {
    for (const side of SIDES) {
      const b = playBtn(side); if (!b) continue;
      const v = run[side];
      if (!v) { b.disabled = true; b.innerHTML = ICON.play + "Play"; continue; }
      const on = v.timer || v.holding;
      b.innerHTML = on ? ICON.pause + "Pause" : ICON.play + (v.pos > 0 && v.pos < v.seq.length ? "Resume" : "Play");
    }
  }

  function render() {
    SIDES.forEach(sd => run[sd] && pause(sd));
    const r = DATA.records[cur.rec];
    const list = find("list");
    list.querySelectorAll(".item").forEach((b, i) => b.setAttribute("aria-pressed", String(i === cur.rec)));
    // keep the picked example in view inside the strip only; scrollIntoView would move the page too
    const on = list.children[cur.rec];
    if (on) {
      const left = on.offsetLeft - list.offsetLeft;
      if (left < list.scrollLeft || left + on.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = left - 8;
    }
    find("prompt").innerHTML = r.prompt_spans.map(([t, s]) => t < 0 ? esc(s) : `<span class="hl t${t}">${esc(s)}</span>`).join("");
    find("asks").innerHTML = `<span class="eyebrow">Asks about</span>` + r.topics.map(t => `<span class="t${t}"><span class="dot"></span>${esc(SHORT[t])}</span>`).join("");
    SIDES.forEach(build);
    SIDES.forEach(sd => draw(sd, false));
    buttons();
  }

  find("key").innerHTML = T.map((t, i) => `<span class="t${i}"><span class="dot"></span>${esc(SHORT[i])}</span>`).join("")
    + `<span class="bar-sep" aria-hidden="true"></span><span><i class="sw-now"></i>now</span><span><i class="sw-before"></i>just before the switch</span>`;
  find("list").innerHTML = DATA.records.map((r, i) => `<button type="button" class="item" data-i="${i}" aria-pressed="false" title="${esc(r.prompt)}">${esc(r.title)}</button>`).join("");
  const go = d => { cur.rec = (cur.rec + d + DATA.records.length) % DATA.records.length; render(); };
  find("prev").addEventListener("click", () => go(-1), { signal });
  find("next").addEventListener("click", () => go(1), { signal });
  find("list").addEventListener("click", e => { const b = e.target.closest(".item"); if (b) { cur.rec = +b.dataset.i; render(); } }, { signal });
  // left/right arrows move between examples while focus is in the example strip
  find("picker").addEventListener("keydown", e => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    go(d);
    if (e.target.closest(".item")) find("list").children[cur.rec]?.focus({ preventScroll: true });
  }, { signal });
  // bar heights follow the frame, so the callout lead is re-measured on resize
  const resizeObserver = new ResizeObserver(() => SIDES.forEach(sd => draw(sd, false)));
  resizeObserver.observe(root);
  signal.addEventListener("abort", () => {
    resizeObserver.disconnect();
    SIDES.forEach(sd => run[sd] && pause(sd));
  }, { once: true });
  render();
}
