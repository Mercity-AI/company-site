import { deltaColor } from '../utils/plot-deltas.js';
import { loadRuns } from "../utils/runs-data.js";

export async function init_runs_viewer(root, signal) {
  const find = key => root.querySelector(`[data-viewer="${key}"]`);

  // Row order in data/runs.csv sets each run's colour slot.
  const RUN_DATA = await loadRuns(signal);
  signal.throwIfAborted();
  find("carousel").replaceChildren();

  const COLORS = ["--s1", "--s2", "--s3", "--s4", "--s5"];
  const REF = "baseline_qknorm";

  const METRICS = {
    loss: { title: "Train loss", smooth: true, delta: true, zeroFloor: false },
    eval: { title: "Eval loss", smooth: false, delta: true, zeroFloor: false },
    grad: { title: "Grad norm", smooth: true, delta: false, zeroFloor: true },
  };
  const MKEYS = Object.keys(METRICS);

  const fmt = {
    loss: v => v.toFixed(4),
    delta: v => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(4),
    grad: v => v >= 1 ? v.toFixed(3) : v.toFixed(4),
  };

  function loadPref(k, d) { try { const v = localStorage.getItem("rv4." + k); return v == null ? d : JSON.parse(v); } catch { return d; } }
  function savePref(k, v) { try { localStorage.setItem("rv4." + k, JSON.stringify(v)); } catch {} }

  const state = {
    xaxis: loadPref("xaxis", "step"),
    range: loadPref("range", "warm"),
    smooth: loadPref("smooth", 0.9),
    log: loadPref("log", false),
    delta: loadPref("delta", false),
    hidden: new Set(loadPref("hidden", [])),
  };

  /* ---------- math ---------- */
  function emaDebiased(ys, w) {
    if (!w) return ys.slice();
    const out = new Array(ys.length);
    let last = 0, debias = 0;
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i];
      if (y == null) { out[i] = null; continue; }
      last = last * w + (1 - w) * y;
      debias = debias * w + (1 - w);
      out[i] = last / debias;
    }
    return out;
  }

  function niceTicks(lo, hi, n) {
    const span = hi - lo || Math.abs(hi) || 1;
    const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const err = step0 / mag;
    const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
    const ticks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) ticks.push(+v.toPrecision(12));
    return { ticks, step };
  }

  function logTicks(lo, hi) {
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi < lo) return [];
    const t = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++)
      for (const m of [1, 2, 5]) { const v = m * Math.pow(10, e); if (v >= lo && v <= hi) t.push(v); }
    return t.length >= 2 ? t : niceTicks(lo, hi, 4).ticks;
  }

  function bisect(xs, x) {
    let lo = 0, hi = xs.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < x) lo = mid; else hi = mid; }
    return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
  }

  /* ---------- series ---------- */
  function buildSeries(mk) {
    const m = METRICS[mk];
    const useDelta = state.delta && m.delta;
    const pick = r => mk === "eval"
      ? { xs: r.eval[state.xaxis], steps: r.eval.step, ys: r.eval.loss.slice() }
      : { xs: r[state.xaxis], steps: r.step, ys: m.smooth ? emaDebiased(r[mk], state.smooth) : r[mk].slice() };
    const ref = pick(RUN_DATA.runs.find(r => r.key === REF));
    const refByStep = new Map(ref.steps.map((st, i) => [st, ref.ys[i]]));
    return RUN_DATA.runs.map((r, i) => {
      const p = pick(r);
      let ys = p.ys;
      if (useDelta) ys = ys.map((y, j) => { const rv = refByStep.get(p.steps[j]); return y == null || rv == null ? null : y - rv; });
      return { run: r, color: `var(${COLORS[i]})`, visible: !state.hidden.has(r.key), xs: p.xs, steps: p.steps, ys };
    });
  }

  function xDomain() {
    const r0 = RUN_DATA.runs[0], xs = r0[state.xaxis];
    const maxX = Math.max(...RUN_DATA.runs.map(r => r[state.xaxis][r[state.xaxis].length - 1]));
    if (state.range === "all") return [0, maxX];
    if (state.range === "warm") return [xs[Math.min(150, xs.length - 1)], maxX];
    const cut = r0.tokens[r0.tokens.length - 1] - 1;
    return [xs[bisect(r0.tokens, cut)], maxX];
  }

  /* ---------- one plot slide ---------- */
  class Plot {
    constructor(mk, host) {
      this.mk = mk;
      this.m = METRICS[mk];
      this.el = document.createElement("section");
      this.el.className = "slide";
      this.el.id = root.id + "-plot-" + mk;
      this.el.innerHTML = `<div class="slide-hd"><h2>${this.m.title}</h2><em></em>
        <button type="button" class="reset" hidden>Reset zoom</button></div><svg role="img"></svg>`;
      host.appendChild(this.el);
      this.svg = this.el.querySelector("svg");
      this.resetBtn = this.el.querySelector(".reset");
      this.zoom = null;   // {x0, x1, y0?, y1?} in data units, or null
      this.drag = null;
      this.resetBtn.addEventListener("click", () => this.setZoom(null), { signal });
      this.svg.addEventListener("dblclick", () => this.setZoom(null), { signal });
      // drag a box to zoom, like wandb; touch keeps scrolling the carousel
      this.svg.addEventListener("pointerdown", e => {
        if (e.pointerType === "touch" || e.button !== 0 || !this.geom) return;
        const p = this.svgPoint(e);
        const { P, iw, ih } = this.geom;
        if (p.x < P.l || p.x > P.l + iw || p.y < P.t || p.y > P.t + ih) return;
        this.drag = { x: p.x, y: p.y };
        this.svg.setPointerCapture(e.pointerId);
        e.preventDefault();
      }, { signal });
      this.svg.addEventListener("pointermove", e => {
        if (this.drag) return this.drawSelection(this.svgPoint(e));
        setHover(this, this.pointerX(e));
      }, { signal });
      this.svg.addEventListener("pointerup", e => {
        if (!this.drag) return;
        const a = this.drag, b = this.clampPoint(this.svgPoint(e));
        this.drag = null;
        this.svg.querySelector(".sel").innerHTML = "";
        const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
        if (dx < 6) return;
        const g = this.geom;
        const z = { x0: g.xInv(Math.min(a.x, b.x)), x1: g.xInv(Math.max(a.x, b.x)) };
        if (dy >= 12) { z.y0 = g.yInv(Math.max(a.y, b.y)); z.y1 = g.yInv(Math.min(a.y, b.y)); }
        const minSpan = state.xaxis === "tokens" ? 0.02 : 10;
        if (z.x1 - z.x0 < minSpan) { const c = (z.x0 + z.x1) / 2; z.x0 = c - minSpan / 2; z.x1 = c + minSpan / 2; }
        this.setZoom(z);
      }, { signal });
      this.svg.addEventListener("pointerleave", () => { if (!this.drag) setHover(this, null); }, { signal });
    }

    svgPoint(e) {
      const rect = this.svg.getBoundingClientRect(), g = this.geom;
      return { x: (e.clientX - rect.left) * (g.W / rect.width), y: (e.clientY - rect.top) * (g.H / rect.height) };
    }

    clampPoint(p) {
      const { P, iw, ih } = this.geom;
      return { x: Math.min(Math.max(p.x, P.l), P.l + iw), y: Math.min(Math.max(p.y, P.t), P.t + ih) };
    }

    drawSelection(p) {
      const a = this.drag, b = this.clampPoint(p), { P, ih } = this.geom;
      const boxY = Math.abs(b.y - a.y) >= 12;
      const x = Math.min(a.x, b.x), w = Math.abs(b.x - a.x);
      const y = boxY ? Math.min(a.y, b.y) : P.t, h = boxY ? Math.abs(b.y - a.y) : ih;
      this.svg.querySelector(".hover").innerHTML = "";
      this.svg.querySelector(".sel").innerHTML =
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--ink)" fill-opacity=".06" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="3 3"/>`;
    }

    setZoom(z) {
      this.zoom = z;
      this.render();
      hoverX = null;
      updateSide();
    }

    pointerX(e) {
      const g = this.geom; if (!g) return null;
      const rect = this.svg.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (g.W / rect.width);
      if (px < g.P.l || px > g.P.l + g.iw) return null;
      return g.x0 + (px - g.P.l) / g.iw * (g.x1 - g.x0);
    }

    render() {
      const m = this.m, mk = this.mk;
      const useDelta = this.useDelta = state.delta && m.delta;
      const logY = this.logY = state.log && !useDelta;
      this.el.querySelector(".slide-hd em").textContent = useDelta ? "Δ vs QK norm" : "";
      const series = this.series = buildSeries(mk);
      const W = Math.max(280, this.svg.clientWidth || 900), H = Math.max(200, this.svg.clientHeight || 480);

      const z = this.zoom;
      this.resetBtn.hidden = !z;
      const [x0, x1] = z ? [z.x0, z.x1] : xDomain();
      let y0 = Infinity, y1 = -Infinity;
      for (const se of series) {
        if (!se.visible) continue;
        for (let i = 0; i < se.xs.length; i++) {
          const x = se.xs[i], y = se.ys[i];
          if (x < x0 || x > x1 || y == null || (logY && y <= 0)) continue;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      const empty = !isFinite(y0);
      if (empty) { y0 = logY ? 0.1 : 0; y1 = 1; }
      // A single selected/zoomed value also needs a nonzero log domain.
      if (logY && y0 === y1) { y0 /= 1.1; y1 *= 1.1; }
      const yZoomed = z && z.y0 != null;
      if (yZoomed) { y0 = z.y0; y1 = z.y1; }
      if (useDelta && !yZoomed) { const a = Math.max(Math.abs(y0), Math.abs(y1)) || 0.01; y0 = Math.min(y0, -a * 0.15); y1 = Math.max(y1, a * 0.15); }
      let yt, ystep = null;
      if (logY) {
        yt = logTicks(y0, y1);
      } else if (yZoomed) {
        ({ ticks: yt, step: ystep } = niceTicks(y0, y1, H < 360 ? 4 : 6));
      } else {
        const pad = (y1 - y0) * 0.06 || Math.abs(y1) * 0.05 || 0.01;
        y0 = m.zeroFloor && y0 - pad < 0 ? 0 : y0 - pad;
        y1 += pad;
        ({ ticks: yt, step: ystep } = niceTicks(y0, y1, H < 360 ? 4 : 6));
      }

      const yLabel = v => useDelta
        ? (v === 0 ? "0" : (v > 0 ? "+" : "−") + (+Math.abs(v).toPrecision(3)))
        : String(+v.toPrecision(4));
      const P = { l: Math.max(40, Math.max(...yt.map(v => yLabel(v).length)) * 6.8 + 14), r: 6, t: 14, b: 40 };
      const iw = W - P.l - P.r, ih = H - P.t - P.b;
      const X = x => P.l + (x - x0) / (x1 - x0) * iw;
      const ly0 = Math.log(y0), ly1 = Math.log(y1);
      const Y = logY ? y => P.t + ih - (Math.log(y) - ly0) / (ly1 - ly0) * ih : y => P.t + ih - (y - y0) / (y1 - y0) * ih;
      const xInv = px => x0 + (px - P.l) / iw * (x1 - x0);
      const yInv = logY ? py => Math.exp(ly0 + (P.t + ih - py) / ih * (ly1 - ly0)) : py => y0 + (P.t + ih - py) / ih * (y1 - y0);
      this.geom = { X, Y, xInv, yInv, x0, x1, P, iw, ih, W, H };

      const { ticks: xt, step: xstep } = niceTicks(x0, x1, W < 560 ? 4 : 8);
      const xLabel = v => state.xaxis === "tokens" ? (+v.toPrecision(6)) + "B" : v.toLocaleString("en-US");
      let g = "";
      if (ystep) for (let v = Math.ceil(y0 / (ystep / 5)) * (ystep / 5); v <= y1; v += ystep / 5) {
        const y = Y(v).toFixed(1); g += `<line x1="${P.l}" x2="${P.l + iw}" y1="${y}" y2="${y}" stroke="var(--grid-minor)"/>`;
      }
      for (let v = Math.ceil(x0 / (xstep / 5)) * (xstep / 5); v <= x1; v += xstep / 5) {
        const x = X(v).toFixed(1); g += `<line x1="${x}" x2="${x}" y1="${P.t}" y2="${P.t + ih}" stroke="var(--grid-minor)"/>`;
      }
      for (const v of xt) {
        const x = X(v);
        g += `<line x1="${x}" x2="${x}" y1="${P.t}" y2="${P.t + ih}" stroke="var(--grid-major)"/>`;
        const lbl = xLabel(v), half = lbl.length * 3.4;
        const anchor = x - half < P.l - 8 ? "start" : x + half > W ? "end" : "middle";
        g += `<text x="${anchor === "start" ? Math.max(x, P.l - 8) : anchor === "end" ? W : x}" y="${P.t + ih + 18}" text-anchor="${anchor}">${lbl}</text>`;
      }
      for (const v of yt) {
        const y = Y(v);
        if (y < P.t - 1 || y > P.t + ih + 1) continue;
        const zero = useDelta && v === 0;
        g += `<line x1="${P.l}" x2="${P.l + iw}" y1="${y}" y2="${y}" stroke="var(${zero ? "--axis" : "--grid-major"})" stroke-width="${zero ? 1.5 : 1}"/>`;
        g += `<text x="${P.l - 10}" y="${y + 3.5}" text-anchor="end"${useDelta ? ` style="fill:${deltaColor(v, "lower")}"` : ""}>${yLabel(v)}</text>`;
      }
      g += `<rect x="${P.l}" y="${P.t}" width="${iw}" height="${ih}" fill="none" stroke="var(--axis)"/>`;
      g += `<text class="xt" x="${P.l + iw}" y="${H - 4}" text-anchor="end">${state.xaxis === "tokens" ? "tokens seen" : "step"}</text>`;

      let paths = "", dots = "";
      const isEval = mk === "eval";
      const order = series.map((_, i) => i).sort((a, b) => (series[a].run.key === REF) - (series[b].run.key === REF));
      for (const idx of order) {
        const se = series[idx];
        if (!se.visible) continue;
        let d = "", pen = false, last = null;
        for (let i = 0; i < se.xs.length; i++) {
          const x = se.xs[i], y = se.ys[i];
          if (y == null || x < x0 || x > x1 || (logY && y <= 0)) { pen = false; continue; }
          const px = X(x).toFixed(1), py = Y(y).toFixed(1);
          d += (pen ? "L" : "M") + px + " " + py;
          pen = true; last = [px, py];
          if (isEval) dots += `<circle cx="${px}" cy="${py}" r="3.5" fill="${se.color}" stroke="var(--panel)" stroke-width="2"/>`;
        }
        paths += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${isEval ? 2 : 1.75}" stroke-linejoin="round" stroke-linecap="round"/>`;
        if (last && !isEval) dots += `<circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="${se.color}" stroke="var(--panel)" stroke-width="2"/>`;
      }
      const cid = root.id + "-clip-" + mk;
      this.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      this.svg.setAttribute("aria-label", `${m.title}${useDelta ? ", difference from QK norm," : ""} by ${state.xaxis}`);
      this.svg.innerHTML = `<defs><clipPath id="${cid}"><rect x="${P.l}" y="${P.t - 6}" width="${iw + 6}" height="${ih + 12}"/></clipPath></defs>
        ${g}<g clip-path="url(#${cid})">${paths}${dots}</g>
        ${empty ? `<text x="${P.l + iw / 2}" y="${P.t + ih / 2}" text-anchor="middle">No runs selected</text>` : ""}
        <g class="hover" style="pointer-events:none"></g><g class="sel" style="pointer-events:none"></g>`;
    }

    valFmt(v) {
      if (v == null) return "—";
      if (this.useDelta) return fmt.delta(v);
      return this.mk === "grad" ? fmt.grad(v) : fmt.loss(v);
    }

    /* values of every run at data-x xv (null = end of run) */
    sample(xv) {
      return this.series.map(se => {
        const i = xv == null ? se.xs.length - 1 : bisect(se.xs, xv);
        return { se, x: se.xs[i], y: se.ys[i], step: se.steps[i] };
      });
    }

    drawHover(xv) {
      const hg = this.svg.querySelector(".hover");
      if (!hg) return;
      if (xv == null) { hg.innerHTML = ""; return; }
      const { X, Y, P, ih, iw, x0, x1 } = this.geom;
      const pts = this.sample(xv);
      const anchor = pts.find(p => p.se.visible) || pts[0];
      if (anchor.x < x0 || anchor.x > x1) { hg.innerHTML = ""; return; }
      const hx = X(anchor.x);
      let s = `<line x1="${hx}" x2="${hx}" y1="${P.t}" y2="${P.t + ih}" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="3 3"/>`;
      for (const p of pts) {
        if (!p.se.visible || p.y == null || (this.logY && p.y <= 0)) continue;
        const y = Y(p.y), x = X(p.x);
        if (y >= P.t && y <= P.t + ih && x >= P.l - 1) s += `<circle cx="${x}" cy="${y}" r="4.5" fill="${p.se.color}" stroke="var(--panel)" stroke-width="2"/>`;
      }
      const r0 = anchor.se.run, i0 = bisect(r0.step, anchor.step);
      const label = state.xaxis === "tokens" ? r0.tokens[i0].toFixed(2) + "B" : anchor.step.toLocaleString("en-US");
      const lw = label.length * 6.8 + 14, lx = Math.min(Math.max(hx - lw / 2, P.l), P.l + iw - lw);
      s += `<rect x="${lx}" y="${P.t + ih + 5}" width="${lw}" height="18" rx="4" fill="var(--on)"/>`;
      s += `<text class="pill" x="${lx + lw / 2}" y="${P.t + ih + 17.5}" text-anchor="middle">${label}</text>`;
      hg.innerHTML = s;
    }
  }

  /* ---------- controller ---------- */
  const carousel = find("carousel");
  const plots = MKEYS.map(k => new Plot(k, carousel));
  let active = 0, hoverX = null;

  function setHover(plot, xv) {
    hoverX = xv;
    plot.drawHover(xv);
    updateSide();
  }

  function updateSide() {
    const p = plots[active];
    if (!p.series) return;
    const pts = p.sample(hoverX ?? (p.zoom ? p.zoom.x1 : null));
    pts.forEach(q => {
      const row = root.querySelector(`.run[data-k="${q.se.run.key}"] .val`);
      const tone = p.useDelta && q.y != null && q.y !== 0
        ? (q.y < 0 ? "delta-better" : "delta-worse") : "";
      row.innerHTML = `<b class="${tone}">${p.valFmt(q.y)}</b>`;
    });
  }

  function renderRuns() {
    find("runs").innerHTML = RUN_DATA.runs.map((r, i) => `
      <button type="button" class="run" data-k="${r.key}" aria-pressed="${!state.hidden.has(r.key)}" style="--c:var(${COLORS[i]})" title="${r.desc}">
        <span class="box"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 5.2 4.1 7.3 8 3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <span class="name">${r.key === REF ? "QK norm" : r.label}</span><span class="val"></span>
      </button>`).join("");
  }

  function renderControls() {
    root.querySelectorAll(".seg").forEach(seg => seg.querySelectorAll("button").forEach(b =>
      b.setAttribute("aria-pressed", String(state[seg.dataset.k] === b.dataset.v))));
    const sm = find("smooth");
    sm.value = state.smooth; sm.disabled = !plots[active].m.smooth;
    find("smooth-v").textContent = state.smooth.toFixed(2);
    find("log").checked = state.log;
    const dl = find("delta");
    dl.checked = state.delta; dl.disabled = !plots[active].m.delta;
    root.querySelectorAll(".run").forEach(b => b.setAttribute("aria-pressed", String(!state.hidden.has(b.dataset.k))));
    root.querySelectorAll(".tab").forEach((t, i) => t.setAttribute("aria-selected", String(i === active)));
    root.querySelectorAll(".pager button").forEach((b, i) => b.setAttribute("aria-current", String(i === active)));
  }

  function renderAll() {
    renderControls();
    plots.forEach(p => { p.render(); p.drawHover(null); });
    hoverX = null;
    updateSide();
  }

  function set(k, v) {
    if (["xaxis", "range", "log", "delta"].includes(k)) plots.forEach(p => { p.zoom = null; });
    state[k] = v; savePref(k, v instanceof Set ? [...v] : v); renderAll(); }

  function goTo(i) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    carousel.scrollTo({ top: i * carousel.clientHeight, behavior: reduce ? "auto" : "smooth" });
  }

  function setActive(i) {
    if (i === active) return;
    active = i; hoverX = null;
    renderControls(); updateSide();
    const tab = root.querySelectorAll(".tab")[i];
    const tabs = find("tabs");
    tabs.scrollTo({ left: tab.offsetLeft - tabs.offsetLeft, behavior: "auto" });
  }

  /* ---------- boot ---------- */
  find("tabs").innerHTML = MKEYS.map((k, i) =>
    `<button type="button" class="tab" role="tab" aria-controls="${root.id}-plot-${k}" data-i="${i}">${METRICS[k].title}</button>`).join("");
  find("pager").innerHTML = MKEYS.map((k, i) =>
    `<button type="button" data-i="${i}" aria-label="${METRICS[k].title}"></button>`).join("");
  find("tabs").addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) goTo(+b.dataset.i); }, { signal });
  find("pager").addEventListener("click", e => { const b = e.target.closest("button"); if (b) goTo(+b.dataset.i); }, { signal });
  carousel.addEventListener("scroll", () => { setActive(Math.round(carousel.scrollTop / Math.max(1, carousel.clientHeight))); }, { passive: true, signal });

  renderRuns();
  find("runs").addEventListener("click", e => {
    const b = e.target.closest(".run"); if (!b) return;
    const h = new Set(state.hidden);
    h.has(b.dataset.k) ? h.delete(b.dataset.k) : h.add(b.dataset.k);
    set("hidden", h);
  }, { signal });
  root.querySelectorAll(".seg").forEach(seg => seg.addEventListener("click", e => {
    const b = e.target.closest("button"); if (b) set(seg.dataset.k, b.dataset.v);
  }, { signal }));
  find("smooth").addEventListener("input", e => set("smooth", +e.target.value), { signal });
  find("log").addEventListener("change", e => set("log", e.target.checked), { signal });
  find("delta").addEventListener("change", e => set("delta", e.target.checked), { signal });

  let lastSize = "";
  const resizeObserver = new ResizeObserver(() => {
    const size = carousel.clientWidth + "x" + carousel.clientHeight;
    if (size === lastSize) return;
    lastSize = size;
    renderAll();
    carousel.scrollTop = active * carousel.clientHeight;
  });
  resizeObserver.observe(carousel);
  signal.addEventListener("abort", () => resizeObserver.disconnect(), { once: true });
  renderAll();

}
