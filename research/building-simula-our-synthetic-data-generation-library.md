---
title: 'Building Simula: Our Synthetic Data Generation Library'
slug: building-simula-our-synthetic-data-generation-library
publishedAt: '2026-07-07'
summary: >-
  Why we built simula, a compact CLI-first Python library for schema-shaped and
  free-text synthetic data generation — taxonomies as coverage maps, weighted
  sampling strategies, generator–critic loops, and the lessons from generating
  tens of millions of tokens across client projects.
authors:
  - name: Pranav Patel
tags:
  - Synthetic Data
  - LLMs
category: Research
isTopPick: false
image: >-
  https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.36.36.jpg
---

This is a project we ***HAD*** to do simply because we kept running into the same wall, just at different places. Almost every single one of our client projects would contain this long and extended step of generating or sourcing data for them. After doing this step over 10 times now, generating tens of millions of tokens while controlling for diversity, complexity, domain coverage, etc. We decided to abstract out the principles we follow into a separate library.

And then, after doing some research, we found there is a paper from Google which extends most of our principles to make them scale past the 100M-token generation goals. 

We take our own learnings, put them neatly together with the paper, and distill everything down into `simula`, a compact, CLI-first Python library for schema-shaped and free-text synthetic data generation.

- Paper: [https://arxiv.org/abs/2603.29791](https://arxiv.org/abs/2603.29791)
- Library: [https://github.com/Mercity-AI/Simula](https://github.com/Mercity-AI/Simula)

*(The simula name was coined in the paper btw, which we took…)*

# Planning Coverage Before Generating Anything

Suppose you want "a dataset of natural-language shopping queries paired with structured extractions." That one sentence describes an effectively infinite space of possible datasets. The naive approach — prompt a model repeatedly, collect outputs — samples whatever region of that space the model finds most probable: random sampling clusters around semantic modes and systematically misses the edges. You get four hundred variations of "cheap wireless earbuds" and zero queries about warranty transfers, regional sizing, or comparative multi-constraint searches.

![Screenshot 2026-07-06 at 02.36.36.png](https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.36.36.jpg)

The fix is to make the space explicit before sampling from it. Three ideas do the work:

**1. Taxonomies as coverage maps.** Decompose the dataset description into its prime *factors of variation* — for shopping queries, things like product vertical, shopper intent, and query complexity. Expand each factor into a hierarchical tree of a chosen depth. The nodes of these trees define a discrete, enumerable approximation of the concept space. This gives strict, computable control over coverage: node combinations covered, divided by node combinations that exist.

**2. Generation as sampling over the map.** Every data point starts as a *sampled mix* of taxonomy nodes — one per factor — chosen under weighted *strategies* that encode which combinations make sense together and how common each should be. The mix becomes that point's requirements, so the sampler fixes the dataset's diversity before the model sees a single prompt.

**3. Quality through generator–critic loops.** Models are meaningfully better at judging outputs than producing perfect ones on the first try. We lean on this gap at two levels: refining taxonomy nodes during expansion, and critiquing generated records before acceptance. Google's controlled experiments corroborate what we saw on client work — critic-based rejection sampling delivers a consistent accuracy lift, with the cost (rejection rate) rising as task complexity rises.

Two terms we will use throughout, because they are different problems with different fixes:

- **Global diversity** — how much of the concept space the dataset spans end to end. Driven by the taxonomy and the sampler.
- **Local diversity** — how different nearby records are from each other; whether "similar" points are actually distinct instead of near-duplicates. Driven by the meta-prompt step in Stage 3.

Both our runs and the paper's experiments land on the same result: **the full system — global taxonomic diversity, local meta-prompt diversity, complexification, and critique combined — was the dominant configuration across every dataset and data scale tested.**

Individual components helped on some datasets and plateaued on others; the combination never lost.

# The Fundamentals of the Library

A paper describes a workflow, whereas a library has to commit to interfaces, defaults, and failure behavior.

Our first commitment was philosophical: the project is intentionally small — prefer clear, boring code over architectural ceremony.

`simula` is a single Python package of about ten modules, driven entirely by one YAML config per run, with all defaults and validation living in one place (Pydantic models) so a bad `target_size` or an unknown task name fails loudly at load time instead of as a silent zero-row run.

![Screenshot 2026-07-06 at 02.44.19.png](https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.44.19.jpg)

The pipeline decomposes into stages, each producing a human-inspectable JSON/JSONL artifact:

| Stage | What it does | Artifact |
| --- | --- | --- |
| Factor discovery | Propose 3–6 prime factors of variation from the description | `taxonomy.json` |
| Taxonomy expansion | Breadth-first expand each factor to a configured depth | `taxonomy.json` |
| Strategy generation | Weighted sampling strategies over taxonomy roots | `strategies.json` |
| Point generation | Sample mix → meta-prompt → (complexify) → generate → repair → critique → refine | `dataset.raw.jsonl`, `dataset.accepted.jsonl` |
| Trim | Dedupe + coverage-aware trim to target size | `dataset.final.jsonl` |
| Evaluation | Dedupe/decontaminate, coverage, diversity, complexity | `dataset.evaluated.jsonl`, `eval_report.json` |

Model calls are organized into three **roles**, each independently configurable with its own model and decoding parameters:

- **`strategic`** — the thinker: factor discovery, taxonomy expansion, strategy generation. Called rarely, so it can afford to be an expensive reasoning model.
- **`bulk`** — the workhorse: meta-prompts, complexification, record generation, JSON repair, refinement. Called thousands of times, so it should be fast and cheap.
- **`critic`** — the judge: semantic critique, optional complexity scoring, optional coverage reassignment.

The role split is how the library does fine-grained resource allocation. 

In our 10K e-commerce run, `strategic` was a heavyweight reasoning model that built the depth-4 taxonomy once, while `bulk` and `critic` ran on a fast, cheap variant for the tens of thousands of per-point calls. Expensive intelligence goes where its decisions amortize across the whole dataset; cheap throughput goes where volume lives.

## Core Library Features

- **Two output modes:**
    - **JSON mode** — records are generated against a JSON Schema (practical subset: objects, arrays, enums, `required`, nesting), validated with a precompiled validator before any further model call, with one tightly-scoped repair attempt on failure.
    - **Free-text mode** (`schema: null`) — records are plain text (stories, QA pairs, prose); schema validation and repair are skipped, but the same critic → refine loop runs and still returns structured verdicts.
- **Taxonomy-driven coverage with weighted strategies** — factors of variation are discovered by the model or pinned in config, expanded breadth-first into trees with best-of-N proposals and critic refinement, then sampled through 2–5 weighted strategies that decide which branches combine and how often; `strategy.guidance` steers this in plain English, and both `taxonomy.json` and `strategies.json` are human-editable artifacts that survive resumes.
- **A quality loop on every record** — each sampled mix fans out into multiple meta-prompt scenarios (one picked at random, which is what prevents near-identical records), optionally complexified at a configurable ratio, then generated, schema-checked, repaired once if needed, and judged by a semantic critic whose rejections feed up to `max_refine_attempts` revisions.
- **Full lineage on every row** — taxonomy mix, strategy, meta-prompt, complexified flag, critic verdicts, and rejection reason travel with each record, so every row can answer where it came from and who approved it; coverage math, the coverage-aware trimmer, and per-row debugging all read from this one field.
- **A separate evaluation suite** — dedupe and test-set decontamination (13-gram Jaccard), coverage computed from lineage or via independent LLM reassignment (which also works on datasets you didn't generate), global + local embedding diversity, and batch-calibrated Elo complexity ranking — all writing to their own artifacts, never mutating the dataset.

Beyond these, the library carries the operational layer that real runs demand — three independently configured model roles with per-task decoding control, semaphore-bounded concurrency with point-level failure isolation, fingerprinted resumable runs, and other interesting things! *Just check claude.md* 😉

## The Running Example

For the rest of this log, our example is the dataset we actually generated at 10K scale: natural-language shopper searches paired with atomic, database-queryable extractions.

```yaml
project:
  output_dir: "runs/ecommerce_search_extraction"  # taxonomy, datasets, and logs all land here
  seed: 31                                        # drives deterministic per-attempt sampling

description: >
  E-commerce search-query extraction. Each example pairs a realistic English
  shopper search with its parsed structured form: narrow, atomic fields
  (price_max: 80, never price_range: "under $80"), only what the query states,
  key sets varying per row, 3-20 fields scaling with query length.

# Envelope only: `query` is the NL search, `extraction` is an open object whose
# keys vary per row. The real task rules (atomicity, faithfulness, the 3-20 field
# spread) cannot be expressed in JSON Schema — they live in the prompt module.
schema:
  type: object
  required: ["query", "extraction"]
  properties:
    query: { type: string }
    extraction: { type: object }

prompts:
  module: "ecommerce_search_extraction_prompts.py"  # overrides generate / critique / complexify

provider:
  base_url: "https://openrouter.ai/api/v1"
  api_key_env: "OPENROUTER_API_KEY"  # key name read from the project-root .env — the only source
  timeout_seconds: 240               # hung calls die fast and checkpoint as rejected rows

# Reasoning is excluded EXPLICITLY per role — there is no model-id auto-detection.
# Effort stays low rather than off: fully disabling reasoning measurably degraded field quality.
models:
  strategic:                                   # taxonomy + strategies: one-time, reused, so
    model: "deepseek/deepseek-v4-pro"          # the strong model is affordable here
    temperature: 0.5
    extra_body: {reasoning: {effort: low, exclude: true}}
  bulk:                                        # meta-prompts, records, repairs, refinements:
    model: "deepseek/deepseek-v4-flash:nitro"  # thousands of calls, so fast and cheap
    temperature: 0.75
    extra_body: {reasoning: {effort: low, exclude: true}}
  critic:                                      # low temperature for consistent, strict verdicts
    model: "deepseek/deepseek-v4-flash:nitro"
    temperature: 0.1
    extra_body: {reasoning: {effort: low, exclude: true}}

generation:
  target_size: 10000       # smoke-test at ~20 first, then bump — resume reuses everything
  overgenerate_ratio: 1.3  # the surplus absorbs parse failures, rejections, and hung calls
  scenarios_per_mix: 3     # meta-prompts drafted per sampled mix (local diversity)
  complexity_ratio: 0.3    # fraction of meta-prompts complexified toward the 12-20 field end
  concurrency: 48          # the only pacing knob; lower it if the provider rate-limits
```

A finished row: query *"waterproof trail running shoes size 9 under $80, nothing neon"* → extraction `{"category": "trail running shoes", "waterproof": true, "size": "9", "price_max": 80, "color_excluded": ["neon"]}`. The rest of this log covers what it takes to make ten thousand of these diverse, correct, and traceable.

# Stage 1: Building the Domain Taxonomy

Given the description, the `strategic` model proposes 3–6 factors of variation. For our example we pinned four in config — `product_vertical`, `shopper_intent`, `attribute_focus`, `query_complexity` — but the model can also discover them, or improve partial factors you supply. Domain experts usually know two of the factors and are blind to the other three.

![Screenshot 2026-07-06 at 02.38.00.png](https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.38.00.jpg)

Each factor then expands breadth-first into a tree. Expanding one node is not one call, it is a small procedure — one we had converged on in client work before finding that the paper's ablations validate each step:

1. **Best-of-N proposal.** The model is asked N times (default 2) for candidate children, given the node, its ancestors' path, its siblings, and the current level plan. Independent samples widen the proposal distribution and surface edge-case children a single greedy completion misses.
2. **Critic refinement.** A separate call reviews the pooled proposals and merges, dedupes, edits, and prunes them into a coherent child set — completeness, soundness, specificity, low duplication. This is the generator-critic gap applied to the taxonomy itself; in the paper's measurements this procedure covers ~74–78% of expert-written taxonomies versus ~50% for a 0-shot "write me a taxonomy" prompt.
3. **Level planning.** After a whole level completes across all factors, one call writes a compact plan for the next level: what granularity children should have, what to avoid. The plan is deliberately abstract — our prompt forbids branch-specific examples — because the same plan text is injected into *every* node expansion at the next level, and siblings from different domains must all be able to follow it.

![Screenshot 2026-07-06 at 02.38.48.png](https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.38.48.jpg)

Without a shared plan, concurrent expansions drift — one branch sprouts hyper-specific children ("men's Gore-Tex trail runners") while a sibling stays vague ("clothes") — and the leaf grid your coverage math depends on goes lopsided. The level plan is a cheap coordination primitive: one call per level buys consistent granularity across dozens of concurrent calls.

The output is `taxonomy.json`. For the running example, the branch our finished row came from looks like this (abridged):

```json
{
  "description": "E-commerce search-query extraction. ...",
  "factors": [
    {
      "name": "product_vertical",
      "description": "What kind of product the shopper is searching for.",
      "level": 0,
      "children": [
        {
          "name": "footwear",
          "description": "Shoes and boots across use cases.",
          "level": 1,
          "children": [
            {
              "name": "athletic",
              "description": "Performance footwear for sport and training.",
              "level": 2,
              "children": [
                { "name": "trail_running", "level": 3, "children": [] },
                { "name": "road_running",  "level": 3, "children": [] },
                { "name": "gym_training",  "level": 3, "children": [] }
              ]
            },
            { "name": "casual", "level": 2, "children": [ "..." ] }
          ]
        },
        { "name": "electronics", "level": 1, "children": [ "..." ] },
        { "name": "apparel",     "level": 1, "children": [ "..." ] }
      ]
    },
    { "name": "shopper_intent",   "level": 0, "children": [ "..." ] },
    { "name": "attribute_focus",  "level": 0, "children": [ "..." ] },
    { "name": "query_complexity", "level": 0, "children": [ "..." ] }
  ]
}
```

Taxonomy size is itself a budget decision. 

Depth 4 with the default 4 children per node yields ~256 leaves per factor; we ran depth 4 with `children_per_node: 3` for ~81 — rich enough for a 10K dataset without the expansion-call blowup of the wider tree. Leaves per factor multiply across factors into your combination space; size the tree to the dataset you intend to sample from it.

The finished tree hits a human gate with three review modes: `auto_accept` (default), `write_then_edit` (write the file, *halt the process*, let the user edit, rerun), and `interactive_confirm` (ask in the terminal). 

The taxonomy is the highest-leverage artifact in the pipeline: small, human-readable, and every downstream row conditions on it. Thirty seconds of expert eyeballing ("merge these two nodes, add refurbished-goods queries") is worth more than any downstream filtering. Because `taxonomy.json` on disk is always reused rather than rebuilt, human edits survive resumes.

Cost note: our 4-factor tree took roughly 65 calls (~16–20 minutes on a slow reasoning model) and about $0.40 — a one-time cost amortized over every generation run against the same tree.

# Stage 2: Sampling Strategies Over the Taxonomy

With trees in hand you could sample uniformly: one node per factor, generate, repeat. Uniform sampling fails for two reasons: not all combinations are semantically valid, and real distributions are not uniform. For our example, a voice-transcript-style grocery query carrying twenty legalistic constraints is a valid draw from the grid and a thing no shopper has ever said.

![Screenshot 2026-07-06 at 02.39.51.png](https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.39.51.jpg)

So the `strategic` model writes 2–5 **strategies**: each names compatible taxonomy roots — whole factors like `product_vertical` or deeper paths like `product_vertical.electronics` — plus a sampling weight. Each data point weighted-randomly picks a strategy, then samples one node per factor within that strategy's subtrees. The weights encode the intended distribution: mostly mainstream purchases, a deliberate sliver of hard negation-heavy cases.

From `strategies.json` for the running example (abridged):

```json
{
  "strategies": [
    {
      "id": "mainstream_purchase",
      "description": "Common shopping searches with clear buying intent across all verticals.",
      "taxonomy_roots": ["product_vertical", "shopper_intent.purchase",
                         "attribute_focus", "query_complexity.simple",
                         "query_complexity.moderate"],
      "weight": 3.0
    },
    {
      "id": "hard_cases",
      "description": "Negation-heavy, ambiguous, or many-constraint searches.",
      "taxonomy_roots": ["product_vertical", "shopper_intent",
                         "attribute_focus.exclusions", "query_complexity.dense"],
      "weight": 0.5
    },
    "..."
  ]
}
```

Two pieces here are our own additions, not in the paper:

**Prompt-level steering (`strategy.guidance`).** The paper leaves strategy construction entirely to the model's judgment, and that works until the model's judgment and your dataset's needs diverge. The model will quietly under-weight combinations it considers unlikely or undesirable — but a content-moderation classifier needs exactly the hostile, borderline queries a model self-censors away, and our extraction dataset needed far more exclusion-heavy queries than the model considered natural. `strategy.guidance` is a free-text block woven into the strategy prompt; ours asks for broad vertical coverage rather than over-weighting apparel and electronics, a wide spread of query sizes, and a healthy fraction of exclusions and ambiguity. Guidance is a nudge, not a constraint; for hard guarantees you edit `strategies.json` directly, which the pipeline reuses verbatim on the next run.

**Fallbacks over emptiness.** Strategy roots are matched against taxonomy paths with strict normalization, and models occasionally emit roots matching nothing. The sampler then falls back to sampling across all factors rather than returning an empty mix. Silent lineage loss is the bug you discover three weeks later when your coverage report claims 40% of the dataset came from nowhere.

![Screenshot 2026-07-06 at 02.40.43.png](https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.40.43.jpg)

One sampled mix for our example: `{product_vertical: footwear → athletic → trail_running, shopper_intent: known_item_hunt, attribute_focus: price_and_availability, query_complexity: terse_multi_constraint_with_negation}`. That mix — four nodes with full paths — is the requirements document for exactly one data point. It is stored on the row as `taxonomy_mix`, and this per-row record of origins — mix, strategy, meta-prompt, critic verdicts — is what we call **lineage**. The trim, the coverage math, and the debugging tooling all read from it.

# Stage 3: Meta-Prompts and Complexification

Given a sampled mix, the obvious move is to prompt the bulk model directly: "generate a record satisfying these four requirements." The pipeline deliberately does not. It first asks the bulk model to write `scenarios_per_mix` (default 3) **meta-prompts** — short natural-language briefs describing a *specific* record to create — and randomly picks one to hand to the generator.

![Screenshot 2026-07-06 at 02.41.09.png](https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.41.09.jpg)

For the mix above, one real-shaped round of this looks like:

```
scenarios (3 drafted, 1 picked):
  1. "A runner hunting a specific shoe model they already know, with a hard
      price cap and one excluded color. Terse keyword phrasing."
  2. "Race-week replacement search: brand + waterproof + size, under $80,
      typed as bare keywords with a negation."          <- picked (rng)
  3. "A bargain-hunter comparing two named brands on waterproofing and
      grip, budget-capped."

complexified (this point drew heads at p = 0.3):
  "Race-week replacement search combining brand, waterproofing, size 9,
   sub-$80 price cap, minimum rating, delivery-by date, and two excluded
   colors — 12+ atomic constraints, still terse keyword style."
```

The extra call buys local diversity — the second of the two diversity terms defined earlier. Fixed requirements handed straight to a generator collapse toward the modal interpretation: every "footwear + known-item + negation" point becomes the same shoes query with a brand swapped. The meta-prompt step forces an intermediate act of scenario invention, sampled from multiple candidates, so identical taxonomy mixes still fan out into genuinely different records. 

Then **complexification**: with probability `complexity_ratio`, a further call rewrites the meta-prompt to be harder while preserving all requirements. The ratio is sampled per point, so the final dataset interleaves simple and difficult items rather than segregating them.

This knob exists because of the most actionable downstream finding in the paper: **complexity is a lever, not a virtue.** 

- On grade-school math, the high-complexity split beat the low-complexity split by ~10 accuracy points at 64k examples.
- On a legal-exam dataset where the teacher model itself was weak (57% accuracy), the relationship inverted — only the *low*-complexity split improved with scale, because complex synthetic labels from a struggling teacher are noise with confidence.

## Prompt Modules: Where the Task Rules Live

The single most consequential pattern to emerge from our real runs was not in the paper at all, because it only appears when you try to serve arbitrary domains with one pipeline. We call it the **loose envelope, strict prompts** pattern.

Look back at the running example's schema: two keys, `query` and `extraction`, with `extraction` a completely open object. That looseness is the point — real shoppers search for different things, so the extraction's key set must vary per row, which a rigid schema cannot express. But the actual task rules — atomic fields only, split every range into `price_min`/`price_max`, never hallucinate a constraint the query didn't state, size the extraction from 3 to 20 fields to match the query's length, allow exactly one level of nesting — are far richer than any JSON Schema can encode. Those rules live in a **prompt module**: a plain Python file referenced from config that overrides any subset of the built-in prompt builders.

The mechanics are deliberately unexciting. Built-in prompts live in one module; the overridable set is derived automatically (every public function ending in `_prompt`, plus the two system prompts). A user module overrides only what it needs; missing functions fall back to built-ins. And `simula validate` imports the module *before any model call*, rejecting missing files, import failures, and — crucially — overrides whose parameter names don't match the built-in they replace. A subtly wrong signature would otherwise fail thousands of calls into a paid run.

Our example e-commerce module ships an *attribute menu* — a catalog of ~60 canonical atomic field names spanning verticals (`price_max`, `rating_min`, `color_excluded`, `storage_gb`, `delivery_by`…) — embedded in the generation prompt to anchor the model toward DB-queryable keys and away from compound junk.

 Its critique override replaces the built-in's gentle "does the record satisfy the meta-prompt?" with a seven-point rejection checklist: compound values, wrong types, deep nesting, hallucinated constraints, *omitted* constraints, unnatural queries, and the specific trap of inventing a price number when the shopper only said "cheap." Its complexify override redefines "more complex" for this domain — not vaguer, but *longer queries carrying more atomic constraints*, pushing toward the 12–20-field end of the spread.

The division of labor that emerged: the JSON Schema validates structure mechanically and for free; the prompt module states the semantics; the critic enforces them. Once we saw it, we stopped fighting to encode task rules in schema at all.

# Stage 4: Generate, Repair, Critique, Refine

The chosen meta-prompt, description, and schema go to the `bulk` model, which returns one record. What follows is cheap validation before expensive validation:

**Schema validation first.** Every record validates against a practical JSON Schema subset (objects, arrays, strings, numbers, booleans, enums, `required`, nesting) using a precompiled validator — free and deterministic, so it runs before any further model call. On a parse or validation failure the model gets exactly **one repair attempt**: a tightly scoped prompt with the schema, the bad output, and the specific error.

**Then the semantic critic.** This is the important one, we kinda debated whether to keep this or not, after running the experiments, we knew that we should.

A separate `critic`-role call receives description, schema, meta-prompt, and record, and must return `accept` or `reject` with an explanation. On reject, the explanation feeds a refinement call, looping up to `max_refine_attempts`. A refinement that breaks the schema rejects the point outright — a "fix" that damages structure is not a fix. (Free-text mode — `schema: null` — runs the same critic loop; the record is a string, repair is skipped, the critic still returns a JSON verdict. One pipeline, two output shapes.)

The critic earns its cost, in Google's ablations and in our runs. 

Their experiments show critic rejection sampling never hurt downstream performance and sometimes helped significantly — notably a clear gain on multilingual MMLU despite rejecting only 3% of data — with rejection rates ranging from 2% on easy domains to 61% where the teacher model was weak. 

That rate is itself diagnostic: a soaring rejection rate is your generator telling you it is out of its depth. In our own runs, even at modest scale, the critic flagged well over 400 rows across the 10K e-commerce generation. 

The catches that matter are the subtle ones: in the job-postings run it caught the generator inferring `location_state: "Texas"` from an ad that only mentioned Austin — plausible, but a hallucination relative to source text, precisely the failure mode that poisons extraction training data. It also consistently killed compound fields our rules forbade. Steady-state accept rates ran 90–97%, so the critic's work is catching the last few percent of subtle failures in an otherwise healthy stream.

What it *missed*: ~2% of accepted rows still carried prose-y compound fields (`benefits_summary`, `schedule_details`) violating atomicity in spirit — a single-pass binary critic drifts lenient on soft constraints. We handled it with a post-hoc filter and backfill; the paper's double-critic — independently asking "is this correct?" and "is this incorrect?" to counter sycophancy — is the principled fix, on our roadmap for verifiable-answer cases.

Every attempt, accepted or rejected, is materialized as a full row:

![Screenshot 2026-07-06 at 02.43.22.png](https://blog-cdn.mercity.ai/blog/building-simula-our-synthetic-data-generation-library/Screenshot_2026-07-06_at_02.43.22.jpg)

```json
{
  "id": "item-4821-3f9a1c2e",
  "attempt_index": 4821,
  "record": { "query": "...", "extraction": { "...": "..." } },
  "taxonomy_mix": [ {"factor": "product_vertical", "path": ["product_vertical", "footwear", "athletic", "trail_running"], "...": "..."} ],
  "strategy_id": "mainstream_purchase",
  "meta_prompt": "Terse keyword search for trail shoes under a price cap...",
  "complexified": true,
  "generator_model": "deepseek/deepseek-v4-flash:nitro",
  "critic_verdicts": [ {"verdict": "accept", "explanation": "..."} ],
  "schema_valid": true,
  "accepted": true,
  "rejection_reason": null
}
```

All told, one point costs roughly 3–6 calls: meta-prompt (1) + complexify (~ratio) + generate (1) + repair (maybe) + critique (1) + refine (maybe). The paper reports its full system needing up to 5× more calls per point than a naive baseline and defends the economics: training costs dwarf inference costs, so a smaller dataset that trains better wins. Our runs put a number on it — about $2.60 for a pristine 1,000-row dataset — which makes the 5× call multiplier irrelevant in practice.

## Engineering for Scale

This is some of our additions, after falling flat on our face a few too many times tbh.

- **Concurrency and failure isolation.** Generation runs in an `asyncio.TaskGroup` with an `asyncio.Semaphore(concurrency)` bounding in-flight attempts — a fix we earned, because our first version documented the knob but silently ignored it in generation, which was invisible at 20 smoke attempts and one run away from launching 1,400 simultaneous reasoning calls, a 429 storm, and a cost spike (a regression test now asserts the bound is real; a documented knob that isn't enforced is worse than no knob). And since one unhandled exception in a `TaskGroup` cancels every sibling task, each attempt is wrapped in a boundary that converts any failure into a checkpointable rejected row — exception stored as `rejection_reason`, strategy and mix sampled up front so even the failure path keeps its lineage.
- **Retries, timeouts, and the long tail.** Transient failures (transport errors, 5xx, 408/409/429) retry with capped exponential backoff honoring `Retry-After`, while everything else — 401s, malformed requests — fails fast, because retrying a bad key twelve times is how a pipeline hangs ten minutes before telling you what's wrong. Every call also carries a 180-second timeout replacing the SDK's ~600s default: in our run's rate-limited tail, calls hung 800+ seconds on connections that would never produce a row, and a hung call should die fast, checkpoint as a rejected row, and let overgeneration absorb it.
- **Resumable runs and determinism.** Every completed attempt appends immediately to `dataset.raw.jsonl` (read tolerantly — a crash mid-append leaves a torn last line), and `-resume`, the default, skips finished attempt indexes — but resume is guarded by a SHA-256 fingerprint over everything that determines a row's content (description, schema, seed, model IDs, the prompt module's *file contents*, sampling config, taxonomy, strategies), refusing to continue if any of it changed, so rows from two distributions never blend silently.
- **Per-task decoding control. (This is very important!)** Roles pick the model, but within a role different tasks want different decoding, so every call site carries one of 13 task tags (`generate`, `repair`, `semantic_critic`, `meta_prompt`…) and parameters resolve through three layers — built-in defaults ← per-role config ← per-task overrides — in a pure function safe under concurrent workers, letting `generate` run hot (`temperature: 1.1, min_p: 0.05`) while `repair` runs frozen on the same model; known OpenAI-compatible params travel as typed kwargs and everything else (`min_p`, `top_k`, provider reasoning controls) rides `extra_body` untyped, so provider innovations work without lock-in. This mattered most for reasoning models, which quietly change both economics and quality: the same generation prompt with low-effort hidden reasoning produced ~1,150 hidden tokens and good atomic fields, with reasoning disabled produced zero tokens and visibly worse records, and at default ~530 tokens and good fields.
- **The audit log.** Every successful response appends immediately to `llm_calls.jsonl` — timestamp, role, task, model, resolved sampling, duration, full prompt and response, token counts — with cost computed once in one place so `cost_summary.json` and the log always agree, writes flushed before exit, and a failed write warning on stderr rather than vanishing. It's the first stop when quality drifts (our debugging guide opens with "inspect `llm_calls.jsonl` before touching code"), and it resurrected our cost accounting after a SIGKILL skipped the summary write: append-on-arrival logging means a killed run explains itself.

# The Evaluation Suite

Generation ends by deduping accepted rows and trimming to `target_size` — and the trim is smarter than "take the first N." Because every row carries its taxonomy paths, the trimmer runs a greedy set-cover: repeatedly select the row adding the most not-yet-seen paths. Overgeneration plus coverage-aware trimming turns the surplus into a pool from which the most coverage-dense subset is distilled — the same lineage field that explains a row also decides whether it survives the trim.

Everything else lives in a separate `evaluate` command with a hard boundary: it reads `dataset.final.jsonl` and writes to a *different* file, `dataset.evaluated.jsonl`, never rewriting the generator's artifact. Generation must not produce eval reports; evaluation must not mutate datasets. The separation exists because an evaluation bug that rewrites a shipped dataset is unrecoverable.

## Dedupe and Decontamination

Both use the same recipe as the paper: 13-gram sets over record text, Jaccard overlap, 0.8 threshold. Dedupe compares candidates against kept rows; decontamination compares against user-supplied reference files — your test set — and drops overlaps. If your domain has a benchmark, decontamination is not optional; the paper applied exactly this filter to its own 512k-point datasets before any experiment, because a train set that leaks the test set invalidates every number you report. One guard we added after review: records whose text yields *no* n-grams (empty or symbol-only) must not be treated as duplicates of each other — the Jaccard of two empty sets is 1.0, and without the guard every degenerate record silently collapses into one.

## Coverage, Two Ways

The default mode trusts lineage: walk every row's `taxonomy_mix`, count covered node paths per factor per level — a sampled leaf also covers its ancestors, so path prefixes count too — and divide by totals from the tree. This is the paper's Level Ratio Coverage, computed for free from bookkeeping we were doing anyway. The report looks like this (abridged, level 3 = leaves):

```json
{
  "count": 1000,
  "dedupe": { "removed_count": 0 },
  "coverage": {
    "product_vertical": {
      "1": { "covered": 3,  "total": 3,  "ratio": 1.0 },
      "2": { "covered": 9,  "total": 9,  "ratio": 1.0 },
      "3": { "covered": 27, "total": 27, "ratio": 1.0 }
    },
    "shopper_intent":   { "...": "..." },
    "attribute_focus":  { "...": "..." },
    "query_complexity": { "...": "..." }
  }
}
```

The optional `reassign` mode does what the paper does for *external* datasets: for every row × every factor, the critic gets the full taxonomy tree as text and must name the single most appropriate node; assigned paths and their ancestors are counted identically. Reassignment both audits the generator's own lineage (do independent judgments agree with what the sampler claims?) and points the same coverage lens at data you didn't generate — including real datasets you want to compare against. Lineage is free but trusts the generator; reassignment costs a call per row per factor and trusts nothing. Run `both` when the disagreement itself is the finding.

## Embedding Diversity

Embed every record, compute cosine distances, and report the two metrics defined at the top of this log: **global diversity** is the mean pairwise distance across the dataset (did we span the space?), **local diversity** is the mean distance to each point's k=10 nearest neighbors (are nearby points actually different, or is the dataset a few dense clumps?). The two disagree in instructive ways — in the paper's ablations, global diversity responds to taxonomy depth while local diversity responds to meta-prompting, and the effects are additive.

Engineering around the metric: the heavy dependencies (sentence-transformers, sklearn, torch) live behind an optional `[diversity]` extra imported only when enabled, so the base install stays light; embeddings are cached to disk keyed by (model, text-hash), so re-evaluation after a config tweak embeds only cache misses; and since pairwise distance is O(n²), past a cap (default 1,000) we sample deterministically and the report records the sample size. In JSON mode you can point `text_field` at a dotted path (`query`, or `extraction.intent`) to embed the field you actually care about instead of the whole JSON blob, whose punctuation would otherwise dominate the geometry.

## Complexity via Calibrated Elo

Asking a model "rate this record's complexity from 1 to 10" in isolation produces noise, and the reason has nothing to do with model quality: the model has no anchor. Rated one at a time, nearly everything comes back a 7 or an 8, and a 6 from one call is not comparable to a 6 from another.

Models are far better at comparing than at scoring. "Which of these five is hardest?" gets a reliable answer; "how hard is this on a universal scale?" does not. So the evaluation only ever asks for comparisons, then uses Elo — the chess rating system — to stitch thousands of local comparisons into one global ranking. The chess property is exactly what we need: Magnus Carlsen has never played 99.99% of rated players, yet his rating is comparable to all of theirs, because rating points flow through matches — beat someone, take some of their points — and enough matches sort the entire population.

Concretely: the critic gets a batch of ~5 records in one prompt and scores them relative to each other — say A=7, B=3, C=9, D=5, E=6. Those numbers are then discarded as magnitudes and kept only as verdicts about who beat whom. A 9-vs-7 gap in one batch and a 6-vs-4 gap in another are not comparable, because different peer groups stretch the scale differently; win/loss is the only signal that survives across batches. Five records give ten pairs, so one model call yields ten match results.

Every record starts at 1000. For each match, Elo computes the winner's expected win probability from the rating gap and transfers `16 × (actual − expected)` points from loser to winner. C beating A at equal ratings transfers 16 × (1 − 0.5) = 8 points: C rises to 1008, A drops to 992. The rule pays out for surprises: when a 950-rated record later beats a 1040-rated one, the underdog was expected to win only ~37% of the time, so the upset moves ~10 points. A record that got a lucky read in one batch keeps meeting new opponents in its other appearances, keeps producing surprising results, and gets pulled toward its true level. Each record appears in K=2 differently shuffled batches, so it is judged against two independent peer groups.

The paper validates the method two ways: the Elo scores track human complexity labels on MATH, and critic-rejected samples score consistently harder than accepted ones. Implementation details that mattered: batches are scored concurrently, but Elo updates apply in fixed schedule order — Elo is order-sensitive, and async completion order would make rankings unreproducible run to run. A trailing batch of one merges into its neighbor, since a lone record has no opponents and would silently forfeit an appearance. A failed batch call defaults its records to the neutral score, so a provider hiccup neither crowns nor buries anyone. Scoring is off by default because it costs real calls — and one gap our own review flagged: the ranking is currently reported, not consumed. It earns its cost fully the day the trimmer or a curriculum exporter reads it; until then it is measurement only.

# Results and Lessons from Production Runs

The library's first production test was a ~1,000-row job-posting extraction dataset (varying-key schema, atomic fields), followed by the 10K e-commerce run that validated the pipeline end to end after a major refactor. Numbers from the 1K run, logged most completely:

| Metric | Value |
| --- | --- |
| Attempts generated | 1,206 (of 1,400 planned; tail killed during a rate-limit storm) |
| Accept rate | 96% (1,157 accepted) |
| After post-hoc atomicity filter + backfill | 1,135 pristine → trimmed to 1,000 |
| Distinct extraction key-sets | 841 / 1,000 rows (avg 6.7 fields) |
| Duplicates / empty lineage | 0 / 0 |
| Taxonomy leaf coverage | 100% on all four factors (16/16, 28/28, 29/29, 20/20) |
| Total model calls | ~4,440 (3.43M tokens in, 5.57M out) |
| Wall time | ~84 minutes |
| Total cost | ≈ $2.60 (incl. taxonomy build on the expensive model) |

Observations that changed how we operate:

**The smoke test is the highest-ROI stage of the whole process.** Twenty attempts, thirty cents — and it caught the unbounded-concurrency bug, calibrated latency, confirmed the critic was enforcing atomicity, and exposed the reasoning-token economics, all *before* the four-digit run. Our rule is now mechanical: never scale a config that hasn't smoked at 15–20 attempts.

**Overgeneration is the shock absorber for everything.** Parse failures, critic rejections, hung calls, a provider melting down — all survivable because attempts exceed target by a ratio. When rate limiting jammed our final ~194 attempts, we killed the process: 1,157 accepted already exceeded the 1,000 target, and the trimmer finished the job with zero additional calls. The sharp edge, flagged in review and still open: a genuinely low accept rate can currently finish *below* target with a clean exit code. The pipeline should scream when that happens.

**Throughput is bursty and the tail is where runs die.** Steady-state, ~39 accepted rows/minute at concurrency 25; in rate-limit windows this collapsed under 4, with 14% of calls exceeding 40 seconds. The per-request timeout, classified retries, and checkpoint-every-N all exist because of what that tail looked like. Concurrency is the *only* pacing control we ship — no proactive client-side limiter — on the theory that one honest knob plus principled backoff beats a second speculative subsystem.

**Humans need to look at the data, so make looking free.** We ship standalone single-file HTML tools — open in a browser, drag artifacts on, no server, no build step. The data viewer pages through `dataset.final.jsonl` with search, strategy filters, and per-row provenance: taxonomy mix, meta-prompt, critic verdicts, and model timing behind every record, one click deep. The cleanup that took us from 1,157 to 1,135 pristine rows happened because scrolling real records is how you notice what metrics don't show.

**Coverage claims became checkable.** "100% leaf coverage on all four factors" is a sentence no prompt-in-a-loop pipeline can utter, because it has no denominator. The taxonomy is the denominator. That, more than any single quality metric, is what this approach buys.

# Limitations and What's Next

The current library is deliberately pilot-scale: single-process concurrency rather than distributed workers, a single-pass binary critic rather than the paper's double-critic, lineage coverage by default rather than independent reassignment, and no fine-tuning harness or production queue. Complexity Elo is measured but not yet consumed by any shaping step.

The roadmap follows friction from real runs. **Batched and multi-turn generation modes** are the big one — today every call is a fresh single-turn chat, but at very large N per node-set, independent generation mode-collapses; letting the model see its previous outputs with an instruction to diverge is the fix, and it touches parsing, lineage, and dedupe accounting in ways worth designing deliberately. Beyond that: a loud warning when a run finishes under target, small normalizers for model-output shapes that can currently crash a taxonomy build (a nameless factor, a non-numeric strategy weight), leaf-preferring sampling if meta-prompts from abstract internal nodes prove too vague, and the double-critic for verifiable-answer datasets.

---

Building this library convinced us that *how* you generate synthetic data is a first-class engineering discipline, separable from the debate about what good data is. The recipe we converged on — taxonomy, strategies, meta-prompt indirection, critic loops, lineage everywhere — fits in a few thousand lines of boring Python, and it produces datasets whose coverage you can state as a fraction, whose every row can explain itself, and whose cost is measured in single-digit dollars per thousand rows.

The code is open at github.com/Mercity-AI/Simula — MIT-licensed, with runnable offline examples and the real configs from the runs described here. The paper that scales the same ideas past the 100M-token mark is arXiv:2603.29791.

If you're building fine-tuning or evaluation datasets and want this pipeline applied to your domain, reach out — this is exactly the work we do.
