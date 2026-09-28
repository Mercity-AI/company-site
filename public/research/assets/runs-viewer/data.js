/* Loads the run histories from data/*.csv into the shape the viewer draws from:
   { runs: [{ key, label, desc, url, step, tokens, loss, grad, eval: { step, tokens, loss } }] } */

// CSV rows as objects keyed by the header. Handles quoted fields (descriptions contain commas).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const num = v => (v === "" || v == null ? null : +v);

async function fetchCSV(name) {
  const res = await fetch(new URL(`data/${name}`, import.meta.url));
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return parseCSV(await res.text());
}

export async function loadRuns() {
  const [runs, train, evals] = await Promise.all(["runs.csv", "train.csv", "eval.csv"].map(fetchCSV));
  const byKey = new Map(runs.map(r => [r.key, {
    key: r.key, label: r.label, desc: r.description, url: r.wandb_url,
    step: [], tokens: [], loss: [], grad: [],
    eval: { step: [], tokens: [], loss: [] },
  }]));
  for (const r of train) {
    const run = byKey.get(r.run);
    run.step.push(num(r.step)); run.tokens.push(num(r.tokens_b));
    run.loss.push(num(r.loss)); run.grad.push(num(r.grad_norm));
  }
  for (const r of evals) {
    const ev = byKey.get(r.run).eval;
    ev.step.push(num(r.step)); ev.tokens.push(num(r.tokens_b)); ev.loss.push(num(r.loss));
  }
  return { runs: [...byKey.values()] };
}
