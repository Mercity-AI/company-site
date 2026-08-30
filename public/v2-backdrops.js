/* ══════════════════════════════════════════════════════════════════
   V2 BACKDROP GENERATORS
   Ported from /design.html. Every generator is deterministic on a
   seed, draws once when it first comes into view, and redraws on
   resize -- so a backdrop can be re-rendered at any size anywhere.

   Usage:  <canvas data-backdrop="facets" data-seed="12"></canvas>
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Colour ─────────────────────────────────────────────────────── */
  function hsl2rgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function ramp(stops, t) {
    t = Math.max(0, Math.min(1, t));
    const n = stops.length - 1;
    const i = Math.min(n - 1, Math.floor(t * n));
    return mix(stops[i], stops[i + 1], t * n - i);
  }
  const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

  const TRIO = [hsl2rgb(243, 66, 32), hsl2rgb(243, 75, 59), hsl2rgb(178, 62, 42), hsl2rgb(34, 84, 53)];
  const WARM = [hsl2rgb(34, 84, 58), hsl2rgb(243, 60, 52), hsl2rgb(240, 14, 10)];
  const COOL = [hsl2rgb(240, 14, 10), hsl2rgb(243, 69, 50), hsl2rgb(178, 57, 55)];
  const PAPER = hsl2rgb(240, 24, 99);
  const INK = hsl2rgb(240, 14, 10);

  /* ── Randomness, noise, grain ───────────────────────────────────── */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  function makeNoise(seed) {
    const r = rng(seed);
    const p = new Uint8Array(256);
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (r() * (i + 1)) | 0;
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const g = (ix, iy) => perm[(ix + perm[iy & 255]) & 255] / 255;
    function noise(x, y) {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const a = g(ix, iy);
      const b = g(ix + 1, iy);
      const c = g(ix, iy + 1);
      const d = g(ix + 1, iy + 1);
      const top = a + (b - a) * ux;
      return top + (c + (d - c) * ux - top) * uy;
    }
    return function fbm(x, y, oct) {
      let v = 0;
      let amp = 0.5;
      let f = 1;
      for (let i = 0; i < (oct || 5); i++) {
        v += amp * noise(x * f, y * f);
        f *= 2.03;
        amp *= 0.5;
      }
      return v;
    };
  }

  function grain(ctx, w, h, amount, mono) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      if (mono) {
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      } else {
        d[i] += n;
        d[i + 1] += n * 0.92;
        d[i + 2] += n * 1.06;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const BAYER8 = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20,
    62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ];

  // Marching squares for one threshold. Line segments only -- enough to
  // stroke contours, and no dependency to keep alive.
  function marchingSquares(values, gw, gh, threshold, out) {
    const at = (x, y) => values[y * gw + x];
    const cut = (a, b) => (threshold - a) / (b - a);
    for (let y = 0; y < gh - 1; y++) {
      for (let x = 0; x < gw - 1; x++) {
        const tl = at(x, y);
        const tr = at(x + 1, y);
        const br = at(x + 1, y + 1);
        const bl = at(x, y + 1);
        let idx = 0;
        if (tl > threshold) idx |= 8;
        if (tr > threshold) idx |= 4;
        if (br > threshold) idx |= 2;
        if (bl > threshold) idx |= 1;
        if (idx === 0 || idx === 15) continue;
        const T = [x + cut(tl, tr), y];
        const R = [x + 1, y + cut(tr, br)];
        const B = [x + cut(bl, br), y + 1];
        const L = [x, y + cut(tl, bl)];
        const seg = (a, b) => out.push(a[0], a[1], b[0], b[1]);
        switch (idx) {
          case 1: case 14: seg(L, B); break;
          case 2: case 13: seg(B, R); break;
          case 3: case 12: seg(L, R); break;
          case 4: case 11: seg(T, R); break;
          case 6: case 9:  seg(T, B); break;
          case 7: case 8:  seg(L, T); break;
          case 5:  seg(L, T); seg(B, R); break;
          case 10: seg(T, R); seg(L, B); break;
        }
      }
    }
    return out;
  }

  /* ── Generators ─────────────────────────────────────────────────── */
  const GEN = {
    // The hero ground. Blurred sources, quantised, grained.
    blurfield(ctx, w, h, seed) {
      const r = rng(seed);
      ctx.fillStyle = css(ramp(TRIO, 0.12));
      ctx.fillRect(0, 0, w, h);
      ctx.filter = `blur(${Math.round(Math.min(w, h) * 0.19)}px)`;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = css(ramp(TRIO, r() * 0.9));
        ctx.beginPath();
        ctx.ellipse(r() * w, r() * h, w * (0.11 + r() * 0.2), h * (0.2 + r() * 0.4), r() * 3.14, 0, 6.29);
        ctx.fill();
      }
      ctx.filter = 'none';

      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const L = 8;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const bump = (BAYER8[(y & 7) * 8 + (x & 7)] / 64 - 0.5) * (255 / L);
          for (let k = 0; k < 3; k++) {
            const v = Math.max(0, Math.min(255, d[i + k] + bump));
            d[i + k] = (Math.round((v / 255) * (L - 1)) / (L - 1)) * 255;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      grain(ctx, w, h, 24, true);
    },

    // Light wash for the hero. Same construction as blurfield, but the
    // sources are tints rather than saturated hues, so ink sits on top.
    blurlight(ctx, w, h, seed) {
      const r = rng(seed);
      const LIGHT = [
        hsl2rgb(240, 41, 96),
        hsl2rgb(243, 72, 83),
        hsl2rgb(178, 55, 82),
        hsl2rgb(34, 74, 87),
        hsl2rgb(243, 58, 89),
      ];
      ctx.fillStyle = css(hsl2rgb(243, 41, 94));
      ctx.fillRect(0, 0, w, h);
      ctx.filter = `blur(${Math.round(Math.min(w, h) * 0.17)}px)`;
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = css(ramp(LIGHT, r()));
        ctx.beginPath();
        ctx.ellipse(r() * w, r() * h, w * (0.18 + r() * 0.26), h * (0.3 + r() * 0.45), r() * 3.14, 0, 6.29);
        ctx.fill();
      }
      ctx.filter = 'none';

      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const L = 10;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const bump = (BAYER8[(y & 7) * 8 + (x & 7)] / 64 - 0.5) * (255 / L);
          for (let k = 0; k < 3; k++) {
            const v = Math.max(0, Math.min(255, d[i + k] + bump));
            d[i + k] = (Math.round((v / 255) * (L - 1)) / (L - 1)) * 255;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      grain(ctx, w, h, 15, true);
    },

    // DIVERGENCE — the market converges, one line leaves.
    // Streamlines share a flow field and are pulled toward the centre
    // line, so the bundle tightens left to right. A single line starts
    // inside it and picks up an increasing counter-force past mid-width.
    divergence(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);

      const mid = h * 0.54;
      const step = Math.max(2.2, w / 260);

      function trace(y0, breakout) {
        const pts = [];
        let x = -w * 0.06;
        let y = y0;
        while (x < w * 1.07) {
          const p = Math.max(0, Math.min(1, x / w));
          // shared field
          const a = (fbm(x / (w * 0.62), y / (h * 0.9), 3) - 0.5) * 1.15;
          // consensus: everything is drawn toward the centre line
          const pull = (mid - y) * 0.014 * (0.35 + p * 1.5);
          let dy = Math.sin(a) * step * 0.85 + pull;
          if (breakout) {
            const t = Math.max(0, (p - 0.36) / 0.64);
            dy -= t * t * step * 0.92; // departure, easing in
          }
          x += Math.cos(a) * step + step * 0.72;
          y += dy;
          pts.push(x, y);
        }
        return pts;
      }

      const N = 44;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const pts = trace(h * (0.06 + t * 0.9), false);
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
        ctx.lineWidth = Math.max(0.8, w / 1500);
        ctx.strokeStyle = `hsl(243 34% 62% / ${0.16 + Math.abs(0.5 - t) * 0.1})`;
        ctx.stroke();
      }

      // the one that leaves
      const lead = trace(h * 0.47, true);
      ctx.beginPath();
      ctx.moveTo(lead[0], lead[1]);
      for (let k = 2; k < lead.length; k += 2) ctx.lineTo(lead[k], lead[k + 1]);
      ctx.lineWidth = Math.max(1.8, w / 460);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = css(hsl2rgb(34, 84, 53));
      ctx.stroke();

      const ex = lead[lead.length - 2];
      const ey = lead[lead.length - 1];
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(3, w / 160), 0, 6.29);
      ctx.fillStyle = css(hsl2rgb(34, 84, 53));
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex, ey, Math.max(7, w / 74), 0, 6.29);
      ctx.strokeStyle = 'hsl(34 84% 53% / .34)';
      ctx.lineWidth = Math.max(1, w / 900);
      ctx.stroke();

      grain(ctx, w, h, 11, true);
    },

    // CONVERGENCE — loose on the outside, structured at the centre.
    // Curves enter from every edge and terminate on the nodes of a
    // regular lattice: many things brought in and given an order.
    convergence(ctx, w, h, seed) {
      const r = rng(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);

      const cols = 5;
      const rows = 4;
      const gw = w * 0.34;
      const gh = h * 0.42;
      const ox = (w - gw) / 2;
      const oy = (h - gh) / 2;
      const nodes = [];
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++)
          nodes.push([ox + (i / (cols - 1)) * gw, oy + (j / (rows - 1)) * gh]);

      // incoming, from all four edges
      const N = 34;
      ctx.lineWidth = Math.max(0.9, w / 1300);
      for (let i = 0; i < N; i++) {
        const node = nodes[(r() * nodes.length) | 0];
        const side = (r() * 4) | 0;
        const q = r();
        let sx;
        let sy;
        if (side === 0) { sx = -w * 0.05; sy = h * q; }
        else if (side === 1) { sx = w * 1.05; sy = h * q; }
        else if (side === 2) { sx = w * q; sy = -h * 0.05; }
        else { sx = w * q; sy = h * 1.05; }

        const cx = sx + (node[0] - sx) * (0.28 + r() * 0.3) + (r() - 0.5) * w * 0.3;
        const cy = sy + (node[1] - sy) * (0.28 + r() * 0.3) + (r() - 0.5) * h * 0.3;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, node[0], node[1]);
        ctx.strokeStyle = `hsl(243 40% 60% / ${0.14 + r() * 0.16})`;
        ctx.stroke();
      }

      // the lattice they resolve onto
      ctx.strokeStyle = 'hsl(178 62% 38% / .38)';
      ctx.lineWidth = Math.max(0.9, w / 1400);
      for (let j = 0; j < rows; j++) {
        ctx.beginPath();
        ctx.moveTo(ox, oy + (j / (rows - 1)) * gh);
        ctx.lineTo(ox + gw, oy + (j / (rows - 1)) * gh);
        ctx.stroke();
      }
      for (let i = 0; i < cols; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + (i / (cols - 1)) * gw, oy);
        ctx.lineTo(ox + (i / (cols - 1)) * gw, oy + gh);
        ctx.stroke();
      }
      nodes.forEach(([nx, ny]) => {
        ctx.beginPath();
        ctx.arc(nx, ny, Math.max(2, w / 300), 0, 6.29);
        ctx.fillStyle = css(hsl2rgb(178, 66, 34));
        ctx.fill();
      });

      grain(ctx, w, h, 11, true);
    },

    // STRUCTURE — integration read as load-bearing, not surface.
    // Warped horizontal strata are the systems the business already runs
    // on; straight columns pass through every one of them and joint at
    // each crossing. Something driven through the levels, not laid on top.
    structure(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);

      const layers = 6;
      const top = h * 0.12;
      const gap = (h * 0.78) / (layers - 1);
      const yAt = (i, x) => top + i * gap + (fbm(x / (w * 0.5), i * 1.7, 3) - 0.5) * gap * 0.42;

      // the existing layers: irregular, organic, already there
      for (let i = 0; i < layers; i++) {
        ctx.beginPath();
        for (let x = -4; x <= w + 4; x += 4) {
          const y = yAt(i, x);
          x === -4 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineWidth = Math.max(1.1, w / 780);
        ctx.strokeStyle = `hsl(243 34% ${72 - i * 3}% / .5)`;
        ctx.stroke();

        // a soft band under each, so they read as strata not wires
        ctx.lineTo(w + 4, yAt(i, w + 4) + gap * 0.3);
        for (let x = w + 4; x >= -4; x -= 4) ctx.lineTo(x, yAt(i, x) + gap * 0.3);
        ctx.closePath();
        ctx.fillStyle = `hsl(243 46% 62% / .05)`;
        ctx.fill();
      }

      // the columns: straight, deliberate, all the way through
      const cols = 5;
      const cx0 = w * 0.17;
      const span = w * 0.66;
      for (let c = 0; c < cols; c++) {
        const x = cx0 + (c / (cols - 1)) * span;
        ctx.beginPath();
        ctx.moveTo(x, top - gap * 0.5);
        ctx.lineTo(x, top + (layers - 1) * gap + gap * 0.5);
        ctx.lineWidth = Math.max(1.6, w / 340);
        ctx.strokeStyle = 'hsl(178 66% 32% / .82)';
        ctx.lineCap = 'round';
        ctx.stroke();

        // joints where a column meets a layer
        for (let i = 0; i < layers; i++) {
          ctx.beginPath();
          ctx.arc(x, yAt(i, x), Math.max(2.4, w / 250), 0, 6.29);
          ctx.fillStyle = css(hsl2rgb(178, 68, 30));
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, yAt(i, x), Math.max(5, w / 130), 0, 6.29);
          ctx.strokeStyle = 'hsl(178 66% 32% / .22)';
          ctx.lineWidth = Math.max(1, w / 1100);
          ctx.stroke();
        }
      }

      grain(ctx, w, h, 11, true);
    },

    /* ══════════════════════════════════════════════════════════════
       CANDIDATES — three capability cards, four expressions each.
       Concept first: each one has to say something specific about the
       work, the way divergence and structure do.
       ══════════════════════════════════════════════════════════════ */

    /* ── 1. Synthetic data generation ───────────────────────────── */

    // The distribution you are missing, filled precisely.
    sdGap(ctx, w, h, seed) {
      const r = rng(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.52, rx = w * 0.36, ry = h * 0.38;
      const hx = w * 0.6, hy = h * 0.44, hr = Math.min(w, h) * 0.19;
      const inHole = (x, y) => Math.hypot((x - hx) / 1.25, y - hy) < hr;

      let placed = 0;
      while (placed < 620) {
        const a = r() * 6.2832, d = Math.sqrt(r());
        const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
        placed++;
        if (inHole(x, y)) continue;
        ctx.fillStyle = `hsl(243 40% 56% / ${0.2 + r() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, w / 320), 0, 6.29);
        ctx.fill();
      }
      // what we generate: same shape, different mark
      ctx.strokeStyle = css(hsl2rgb(34, 84, 48));
      ctx.lineWidth = Math.max(1, w / 500);
      for (let i = 0; i < 150; i++) {
        const a = r() * 6.2832, d = Math.sqrt(r());
        const x = hx + Math.cos(a) * hr * 1.25 * d, y = hy + Math.sin(a) * hr * d;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1.6, w / 210), 0, 6.29);
        ctx.stroke();
      }
      ctx.setLineDash([Math.max(2, w / 160), Math.max(3, w / 110)]);
      ctx.strokeStyle = 'hsl(34 84% 48% / .55)';
      ctx.beginPath();
      ctx.ellipse(hx, hy, hr * 1.25, hr, 0, 0, 6.29);
      ctx.stroke();
      ctx.setLineDash([]);
      grain(ctx, w, h, 10, true);
    },

    // Curriculum: density and difficulty ramp together.
    sdCurriculum(ctx, w, h, seed) {
      const r = rng(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const rows = 7, pad = h * 0.13;
      const step = (h - pad * 2) / (rows - 1);
      for (let i = 0; i < rows; i++) {
        const y = pad + i * step;
        for (let k = 0; k < 130; k++) {
          const t = k / 129;
          if (r() > 0.12 + t * t * 0.95) continue;
          const x = w * 0.08 + t * w * 0.84;
          const hue = 243 - t * 62;
          ctx.fillStyle = `hsl(${hue} ${44 + t * 22}% ${58 - t * 14}% / ${0.3 + t * 0.55})`;
          ctx.beginPath();
          ctx.arc(x, y + (r() - 0.5) * step * 0.5, Math.max(1.1, (w / 300) * (0.6 + t * 0.9)), 0, 6.29);
          ctx.fill();
        }
      }
      grain(ctx, w, h, 10, true);
    },

    // A handful of seeds, millions of samples.
    sdFanout(ctx, w, h, seed) {
      const r = rng(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const seeds = 4;
      for (let s = 0; s < seeds; s++) {
        const sy = h * (0.2 + (s / (seeds - 1)) * 0.6);
        const sx = w * 0.1;
        for (let b = 0; b < 26; b++) {
          const ty = sy + (r() - 0.5) * h * 0.5;
          const tx = w * (0.55 + r() * 0.4);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(w * 0.34, sy + (ty - sy) * 0.25, tx, ty);
          ctx.strokeStyle = `hsl(243 44% 62% / ${0.07 + r() * 0.1})`;
          ctx.lineWidth = Math.max(0.8, w / 1400);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(tx, ty, Math.max(1.2, w / 300), 0, 6.29);
          ctx.fillStyle = `hsl(178 58% 42% / ${0.3 + r() * 0.45})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(3.4, w / 110), 0, 6.29);
        ctx.fillStyle = css(hsl2rgb(243, 66, 44));
        ctx.fill();
      }
      grain(ctx, w, h, 10, true);
    },

    // Generated to a spec, then checked against it.
    sdTarget(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const n = 26;
      const pad = w * 0.02;
      const base = h * 0.97;
      const peak = h * 0.86;
      const bw = (w - pad * 2) / n;
      const target = (t) => Math.exp(-Math.pow((t - 0.46) * 2.5, 2)) * peak;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const hgt = target(t) * (0.86 + fbm(i / 3.5, 1.2, 2) * 0.3);
        ctx.fillStyle = `hsl(178 60% 40% / ${0.3 + (hgt / peak) * 0.5})`;
        ctx.fillRect(pad + i * bw + bw * 0.16, base - hgt, bw * 0.68, hgt);
      }
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const x = pad + t * (w - pad * 2);
        const y = base - target(t);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.setLineDash([Math.max(3, w / 130), Math.max(3, w / 130)]);
      ctx.strokeStyle = css(hsl2rgb(243, 66, 44));
      ctx.lineWidth = Math.max(1.4, w / 420);
      ctx.stroke();
      ctx.setLineDash([]);
      grain(ctx, w, h, 10, true);
    },

    /* ── 2. Custom architecture & training ──────────────────────── */

    // Off the shelf is uniform. Ours is cut to the task.
    archReshape(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const n = 16, pad = w * 0.07, cw = (w - pad * 2) / n, mid = h * 0.5;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const uniform = h * 0.3;
        const shaped = h * (0.12 + Math.abs(fbm(i / 2.6, 3.1, 3) - 0.42) * 1.5);
        const hgt = uniform + (shaped - uniform) * Math.max(0, (t - 0.34) / 0.66);
        const custom = t > 0.34;
        ctx.fillStyle = custom
          ? `hsl(178 60% 40% / ${0.34 + (t - 0.34) * 0.75})`
          : 'hsl(243 30% 62% / .22)';
        ctx.fillRect(pad + i * cw + cw * 0.14, mid - hgt / 2, cw * 0.72, hgt);
      }
      ctx.setLineDash([Math.max(2, w / 200), Math.max(3, w / 150)]);
      ctx.strokeStyle = 'hsl(240 10% 55% / .5)';
      ctx.lineWidth = Math.max(1, w / 900);
      ctx.beginPath();
      ctx.moveTo(pad + n * cw * 0.34, h * 0.08);
      ctx.lineTo(pad + n * cw * 0.34, h * 0.92);
      ctx.stroke();
      ctx.setLineDash([]);
      grain(ctx, w, h, 10, true);
    },

    // The stack, with the layers we replaced called out.
    archStack(ctx, w, h, seed) {
      const r = rng(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const rows = 9, pad = h * 0.08;
      const rh = (h - pad * 2) / rows;
      const swapped = new Set([2, 3, 6]);
      for (let i = 0; i < rows; i++) {
        const y = pad + i * rh;
        const ww = w * (0.42 + r() * 0.3);
        const x = (w - ww) / 2;
        if (swapped.has(i)) {
          ctx.fillStyle = 'hsl(178 60% 40% / .8)';
          ctx.fillRect(x - w * 0.05, y + rh * 0.16, ww + w * 0.1, rh * 0.62);
          ctx.fillStyle = css(hsl2rgb(34, 84, 50));
          ctx.beginPath();
          ctx.arc(x - w * 0.09, y + rh * 0.47, Math.max(2.2, w / 260), 0, 6.29);
          ctx.fill();
        } else {
          ctx.fillStyle = 'hsl(243 28% 60% / .2)';
          ctx.fillRect(x, y + rh * 0.2, ww, rh * 0.54);
        }
      }
      grain(ctx, w, h, 10, true);
    },

    // A training run, with the checkpoints we kept.
    archLoss(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const x0 = w * 0.02;
      const span = w * 0.96;
      ctx.strokeStyle = 'hsl(240 12% 74% / .5)';
      ctx.lineWidth = Math.max(0.8, w / 1600);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x0, h * (0.08 + i * 0.23));
        ctx.lineTo(x0 + span, h * (0.08 + i * 0.23));
        ctx.stroke();
      }
      const yAt = (t) =>
        h * 0.07 + Math.exp(-t * 3.1) * h * 0.84 + (fbm(t * 22, 2, 2) - 0.5) * h * 0.07;
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const x = x0 + t * span;
        i ? ctx.lineTo(x, yAt(t)) : ctx.moveTo(x, yAt(t));
      }
      ctx.strokeStyle = css(hsl2rgb(243, 66, 46));
      ctx.lineWidth = Math.max(1.5, w / 420);
      ctx.lineJoin = 'round';
      ctx.stroke();
      [0.22, 0.48, 0.74, 0.95].forEach((t, i) => {
        ctx.beginPath();
        ctx.arc(x0 + t * span, yAt(t), Math.max(3.15, w / 157), 0, 6.29);
        ctx.fillStyle = i === 3 ? css(hsl2rgb(34, 84, 50)) : css(hsl2rgb(178, 64, 36));
        ctx.fill();
      });
      grain(ctx, w, h, 10, true);
    },

    // Dense attention on the left, the mask we designed on the right.
    archWiring(ctx, w, h, seed) {
      const r = rng(seed);
      const band = 2 + ((r() * 3) | 0);
      const stride = 3 + ((r() * 3) | 0);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const n = 12, size = Math.min(w * 0.38, h * 0.76);
      const cell = size / n;
      const draw = (ox, oy, keep, hue, alpha) => {
        for (let j = 0; j < n; j++) {
          for (let i = 0; i < n; i++) {
            if (!keep(i, j)) continue;
            ctx.fillStyle = `hsl(${hue} 58% 44% / ${alpha})`;
            ctx.fillRect(ox + i * cell + 0.6, oy + j * cell + 0.6, cell - 1.2, cell - 1.2);
          }
        }
      };
      const oy = (h - size) / 2;
      draw(w * 0.08, oy, (i, j) => i <= j, 243, 0.2);
      // banded + strided: a mask that was chosen, not inherited
      draw(w * 0.54, oy, (i, j) => i <= j && (j - i < band || i % stride === 0 || j === n - 1), 178, 0.72);
      ctx.strokeStyle = 'hsl(240 10% 60% / .45)';
      ctx.lineWidth = Math.max(1, w / 1100);
      ctx.strokeRect(w * 0.08, oy, size, size);
      ctx.strokeRect(w * 0.54, oy, size, size);
      grain(ctx, w, h, 10, true);
    },

    /* ── 3. Evaluation & benchmarking ───────────────────────────── */

    // Including the number that argues against us.
    evalBars(ctx, w, h, seed) {
      const r = rng(seed);
      const vary = 0.06;
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const rows = 6, pad = h * 0.04;
      const rh = (h - pad * 2) / rows;
      const vals = [0.92, 0.78, 0.85, 0.34, 0.71, 0.63].map((v) => v + (r() - 0.5) * vary);
      vals.forEach((v, i) => {
        const y = pad + i * rh;
        ctx.fillStyle = 'hsl(240 12% 88% / .8)';
        ctx.fillRect(w * 0.04, y + rh * 0.24, w * 0.92, rh * 0.46);
        const bad = i === 3;
        ctx.fillStyle = bad ? css(hsl2rgb(34, 84, 52)) : css(hsl2rgb(178, 62, 40));
        ctx.fillRect(w * 0.04, y + rh * 0.24, w * 0.92 * v, rh * 0.46);
        if (bad) {
          ctx.strokeStyle = css(hsl2rgb(34, 74, 40));
          ctx.lineWidth = Math.max(1.2, w / 600);
          ctx.beginPath();
          ctx.moveTo(w * 0.04 + w * 0.92 * v, y + rh * 0.1);
          ctx.lineTo(w * 0.04 + w * 0.92 * v, y + rh * 0.84);
          ctx.stroke();
        }
      });
      grain(ctx, w, h, 10, true);
    },

    // A gate, and the runs that did not clear it.
    evalThreshold(ctx, w, h, seed) {
      const r = rng(seed);
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const gate = h * 0.46;
      ctx.setLineDash([Math.max(3, w / 130), Math.max(3, w / 130)]);
      ctx.strokeStyle = css(hsl2rgb(243, 60, 50));
      ctx.lineWidth = Math.max(1.3, w / 500);
      ctx.beginPath();
      ctx.moveTo(w * 0.05, gate);
      ctx.lineTo(w * 0.95, gate);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 62; i++) {
        const t = i / 61;
        const x = w * 0.08 + t * w * 0.84;
        const y = h * 0.2 + (fbm(t * 7, 4, 3) * 0.9 + (r() - 0.5) * 0.3) * h * 0.58;
        const pass = y < gate;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, w / 230), 0, 6.29);
        ctx.fillStyle = pass ? 'hsl(178 62% 38% / .78)' : 'hsl(34 84% 50% / .85)';
        ctx.fill();
      }
      grain(ctx, w, h, 10, true);
    },

    // Measurement, with the uncertainty left in.
    evalScatter(ctx, w, h, seed) {
      const r = rng(seed);
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const n = 15;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = w * 0.1 + t * w * 0.82;
        const y = h * 0.76 - Math.pow(t, 0.7) * h * 0.5 + (fbm(t * 9, 5, 2) - 0.5) * h * 0.12;
        const err = h * (0.04 + r() * 0.07);
        ctx.strokeStyle = 'hsl(243 40% 58% / .45)';
        ctx.lineWidth = Math.max(1, w / 900);
        ctx.beginPath();
        ctx.moveTo(x, y - err);
        ctx.lineTo(x, y + err);
        ctx.moveTo(x - w * 0.008, y - err);
        ctx.lineTo(x + w * 0.008, y - err);
        ctx.moveTo(x - w * 0.008, y + err);
        ctx.lineTo(x + w * 0.008, y + err);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2.2, w / 210), 0, 6.29);
        ctx.fillStyle = css(hsl2rgb(178, 64, 36));
        ctx.fill();
      }
      grain(ctx, w, h, 10, true);
    },

    // The harness catching drift before your users do.
    evalRegression(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(hsl2rgb(240, 26, 98));
      ctx.fillRect(0, 0, w, h);
      const dip = 0.72;
      const yAt = (t) =>
        h * 0.4 - (fbm(t * 6, 6, 3) - 0.5) * h * 0.16 +
        (t > dip ? Math.min(1, (t - dip) / 0.1) * h * 0.34 : 0);
      ctx.beginPath();
      for (let i = 0; i <= 200; i++) {
        const t = i / 200, x = w * 0.07 + t * w * 0.86;
        i ? ctx.lineTo(x, yAt(t)) : ctx.moveTo(x, yAt(t));
      }
      ctx.strokeStyle = css(hsl2rgb(178, 64, 36));
      ctx.lineWidth = Math.max(1.6, w / 400);
      ctx.lineJoin = 'round';
      ctx.stroke();
      const dx = w * 0.07 + (dip + 0.1) * w * 0.86, dy = yAt(dip + 0.1);
      ctx.beginPath();
      ctx.arc(dx, dy, Math.max(7, w / 68), 0, 6.29);
      ctx.strokeStyle = css(hsl2rgb(34, 84, 50));
      ctx.lineWidth = Math.max(1.4, w / 520);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dx, dy, Math.max(2.4, w / 220), 0, 6.29);
      ctx.fillStyle = css(hsl2rgb(34, 84, 50));
      ctx.fill();
      grain(ctx, w, h, 10, true);
    },

    facets(ctx, w, h, seed) {
      const r = rng(seed);
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(INK);
      ctx.fillRect(0, 0, w, h);
      const s = Math.max(22, w / 11);
      for (let y = -1; y < h / (s * 0.5) + 2; y++) {
        for (let x = -1; x < w / s + 2; x++) {
          const cx = x * s + (y % 2 ? s * 0.5 : 0);
          const cy = y * s * 0.5;
          let t = (cx / w) * 0.55 + (cy / h) * 0.6;
          t += (fbm(cx / 220, cy / 220, 3) - 0.5) * 0.24;
          ctx.fillStyle = css(ramp(WARM, t));
          ctx.beginPath();
          ctx.moveTo(cx, cy - s * 0.52);
          ctx.lineTo(cx + s * 0.52, cy);
          ctx.lineTo(cx, cy + s * 0.52);
          ctx.lineTo(cx - s * 0.52, cy);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.07})`;
          ctx.fill();
        }
      }
      grain(ctx, w, h, 20, true);
    },

    curves(ctx, w, h, seed) {
      const r = rng(seed);
      ctx.fillStyle = css(ramp(TRIO, 0.3));
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = Math.max(1, w / 1000);
      ctx.strokeStyle = 'hsl(243 62% 22% / .78)';
      const ax = w * (0.78 + r() * 0.5);
      const ay = h * (0.08 + r() * 0.3);
      for (let i = 0; i < 13; i++) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.05, h * (-0.15 + i * 0.115));
        ctx.quadraticCurveTo(ax, ay + i * h * 0.075, w * 1.1, h * (0.55 + i * 0.06));
        ctx.stroke();
      }
      grain(ctx, w, h, 16, true);
    },

    // Hero curves. Transparent, no ground, no grain -- five lines that
    // enter at the left edge and leave at the right, rising as they go.
    // Sparse on purpose; the point is the sweep, not the texture.
    heroCurves(ctx, w, h, seed) {
      const r = rng(seed);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      const N = 5;
      const drift = 0.12 + r() * 0.1;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        // The plate is the full hero now, so these are fractions of the
        // hero's own height. The lowest lines bleed past the bottom and
        // get clipped, which reads as the family continuing.
        // 20% tighter than before, anchored at the bottom line, so the
        // family closes up and its top edge drops with it.
        const y0 = h * (0.88 + t * 0.24);
        const y1 = h * (0.692 + t * 0.208);
        ctx.beginPath();
        ctx.moveTo(-w * 0.04, y0);
        ctx.bezierCurveTo(
          w * 0.3,
          y0 + h * drift,
          w * 0.68,
          y1 - h * (drift * 0.4),
          w * 1.04,
          y1
        );
        ctx.lineWidth = Math.max(1, (w / 1500) * (1.5 - t * 0.5));
        ctx.strokeStyle = `hsl(243 58% 46% / ${0.3 - t * 0.09})`;
        ctx.stroke();
      }
    },

    contour(ctx, w, h, seed) {
      ctx.fillStyle = css(PAPER);
      ctx.fillRect(0, 0, w, h);
      const fbm = makeNoise(seed);
      const gw = 150;
      const gh = Math.max(40, Math.round((150 * h) / w));
      const values = new Array(gw * gh);
      let lo = Infinity;
      let hi = -Infinity;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const v = fbm(x / 19, y / 19, 4);
          values[y * gw + x] = v;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      const sx = w / gw;
      const sy = h / gh;
      ctx.lineWidth = Math.max(1, w / 900);
      ctx.lineCap = 'round';
      const BANDS = 15;
      for (let k = 1; k < BANDS; k++) {
        const segs = marchingSquares(values, gw, gh, lo + (hi - lo) * (k / BANDS), []);
        if (!segs.length) continue;
        ctx.strokeStyle = `hsl(243 62% ${70 - k * 1.7}% / ${0.34 + k * 0.032})`;
        ctx.beginPath();
        for (let i = 0; i < segs.length; i += 4) {
          ctx.moveTo(segs[i] * sx, segs[i + 1] * sy);
          ctx.lineTo(segs[i + 2] * sx, segs[i + 3] * sy);
        }
        ctx.stroke();
      }
      grain(ctx, w, h, 9, true);
    },

    ridgeline(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(ramp(COOL, 0.08));
      ctx.fillRect(0, 0, w, h);
      const rows = 26;
      const step = h / (rows + 6);
      ctx.lineWidth = Math.max(1, w / 1000);
      for (let i = rows; i >= 0; i--) {
        const base = h * 0.22 + i * step;
        ctx.beginPath();
        ctx.moveTo(-2, h + 2);
        for (let x = -2; x <= w + 2; x += 3) {
          const amp = step * 3.4 * (0.35 + fbm(x / 700, i / 9, 2));
          ctx.lineTo(x, base - amp * (fbm(x / 190, i / 5.5, 4) - 0.42));
        }
        ctx.lineTo(w + 2, h + 2);
        ctx.closePath();
        ctx.fillStyle = css(ramp(COOL, 0.05 + (i / rows) * 0.1));
        ctx.fill();
        ctx.strokeStyle = `hsl(178 55% ${58 - i * 0.7}% / .85)`;
        ctx.stroke();
      }
      grain(ctx, w, h, 12, true);
    },

    halftone(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(PAPER);
      ctx.fillRect(0, 0, w, h);
      const gap = Math.max(6, w / 88);
      ctx.fillStyle = css(hsl2rgb(243, 69, 50));
      for (let y = gap * 0.5; y < h; y += gap) {
        for (let x = gap * 0.5; x < w; x += gap) {
          const dd = Math.hypot(x - w * 0.62, y - h * 0.44) / (w * 0.6);
          const v = Math.max(0, Math.min(1, fbm(x / 190, y / 190, 4) * 1.25 - dd * 0.85));
          if (v < 0.04) continue;
          ctx.globalAlpha = 0.35 + v * 0.55;
          ctx.beginPath();
          ctx.arc(x, y, v * gap * 0.56, 0, 6.29);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      grain(ctx, w, h, 8, true);
    },

    isoline(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      ctx.fillStyle = css(ramp(TRIO, 0.02));
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = Math.max(1, w / 1100);
      const cx = w * 0.42;
      const cy = h * 0.5;
      for (let k = 1; k <= 34; k++) {
        ctx.beginPath();
        const base = k * (Math.min(w, h) / 26);
        for (let i = 0; i <= 130; i++) {
          const a = (i / 130) * 6.2832;
          const warp = fbm(Math.cos(a) * 1.1 + k * 0.09, Math.sin(a) * 1.1 + k * 0.09, 4) - 0.5;
          const rad = base * (1 + warp * 0.55);
          const x = cx + Math.cos(a) * rad * 1.5;
          const y = cy + Math.sin(a) * rad;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `hsl(${178 + k * 1.6} 60% ${72 - k * 0.9}% / .55)`;
        ctx.stroke();
      }
      grain(ctx, w, h, 10, true);
    },

    strata(ctx, w, h, seed) {
      const fbm = makeNoise(seed);
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const L = 9;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const warp = (fbm(x / 260, y / 90, 3) - 0.5) * 0.5;
          const bump = (BAYER8[(y & 7) * 8 + (x & 7)] / 64 - 0.5) * (1.4 / L);
          const t = Math.max(0, Math.min(1, y / h + warp + bump));
          const c = ramp(WARM, Math.round(t * (L - 1)) / (L - 1));
          const i = (y * w + x) * 4;
          d[i] = c[0];
          d[i + 1] = c[1];
          d[i + 2] = c[2];
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      grain(ctx, w, h, 22, true);
    },
  };

  /* ── Wiring ─────────────────────────────────────────────────────── */
  const canvases = Array.from(document.querySelectorAll('[data-backdrop]'));
  if (!canvases.length) return;

  function draw(cv) {
    const gen = GEN[cv.dataset.backdrop];
    if (!gen) return;
    const dpr = Math.min(window.devicePixelRatio || 1, Number(cv.dataset.dpr) || 1.5);
    const w = Math.max(1, Math.round(cv.clientWidth * dpr));
    const h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    gen(ctx, w, h, Number(cv.dataset.seed) || 1);
    cv.dataset.drawn = 'true';
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          draw(e.target);
          io.unobserve(e.target);
        });
      },
      { rootMargin: '250px' }
    );
    canvases.forEach((cv) => io.observe(cv));
  } else {
    canvases.forEach(draw);
  }

  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => canvases.forEach((cv) => cv.dataset.drawn === 'true' && draw(cv)), 200);
  });

  /* ── Variant switchers ──────────────────────────────────────────
     <div data-backdrop-switch="#someCanvas">
       <button data-variant="evalBars">Bad number</button> ...
     Swaps the generator on the target canvas and redraws in place. */
  document.querySelectorAll('[data-backdrop-switch]').forEach((group) => {
    const target = document.querySelector(group.dataset.backdropSwitch);
    if (!target) return;
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-variant]');
      if (!btn || !GEN[btn.dataset.variant]) return;
      group.querySelectorAll('button[data-variant]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      target.dataset.backdrop = btn.dataset.variant;
      draw(target);
    });
  });
})();
