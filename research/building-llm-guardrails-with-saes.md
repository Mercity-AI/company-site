---
title: Building LLM Guardrails with SAEs
slug: building-llm-guardrails-with-saes
publishedAt: '2026-07-07'
summary: >-
  We wanted to test whether sparse autoencoders can replace a dedicated topic
  classifier in an LLM guardrail stack, reading the topic directly from the
  model's internal activations instead of running a second model over its output
  text.
authors:
  - name: Mercity Research Team
tags:
  - Interpretability
  - Guardrails
  - SAEs
category: Research
isTopPick: false
image: >-
  https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig_architecture_v2.jpg
---

We wanted to test whether sparse autoencoders can replace a dedicated topic classifier in an LLM guardrail stack, reading the topic directly from the model's internal activations instead of running a second model over its output text. 

They can: a logistic regression over 100 SAE features reaches **99.0% accuracy across seven business domains**, with the model and SAE fully frozen and only 115 labeled prompts per topic. 

Our pipeline hooks Gemma 3's residual stream during generation, encodes the hidden states through Gemma Scope's pretrained SAEs, and aggregates the fired features across the answer into a single vector — no fine-tuning, no output text read, negligible added serving cost. 

This log documents the full build across Gemma 3 1B and 4B, including the result that initially misled us: a single-position prefill probe scored 19 points below decode, which looked like proof that topic signal only emerges during generation — until pooling over the whole prompt closed the gap and showed the probe, not the prompt, was the problem.

LETS START! 🙂

---

# What Are Topical Guardrails?

A topical guardrail is a check on what a model is actually generating, not on the question it was asked: does the answer stay inside the domain the deployment is scoped to, or has it drifted somewhere it shouldn’t be? The standard way to build one is to run a classifier over the model’s output text after generation finishes — the classifier reads the same text a user would read, and has no view into how the model arrived at it.

![fig_basic_pipeline_v2.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig_basic_pipeline_v2.jpg)

*The baseline setup: a scoped assistant generates its complete response, and only then does a separate classifier read that finished text and decide whether to deliver or block it. Two costs are built into this shape — the user waits for generation plus the classifier verdict on every turn, and the classifier never sees the model’s internal activations, only the same finished text the user would.*

That is not what we built. Rather than classifying the text the model produced, we classify the model’s own internal activations while it writes that text — reading the topic directly out of the generation process instead of out of its finished output.

---

# Shortcomings of Current Topical Classification Systems

Deployed LLM assistants are almost always scoped to a domain. A clinical documentation assistant is meant to answer questions about patient records, not dispense legal opinions. A financial reporting tool should handle SEC filings and earnings analysis, not employee onboarding. A contract reviewer should stay inside contract law and not wander into HR policy. Each of these systems needs a continuous read on whether the answer it is producing is still inside its lane.

The cost of a misclassification is not abstract. In healthcare, for example, an out-of-scope answer from a clinical assistant can amount to unauthorized medical advice — and the liability for that mistake does not stay with the model, it lands on the company that deployed it.

Existing tooling has blind spots that leave exactly this kind of failure unguarded:

- **Classifiers read the prompt, or the finished generation — never the generation as it happens.** Most topic classification in production runs on the user’s query before the model answers, or on the full text afterward. Neither captures what the model is doing while it generates. A short, ambiguous prompt can produce a long answer that drifts somewhere unexpected, and a prompt-level classifier never sees it coming.
- **Classifying after the fact means waiting for the whole answer.** Because the classifier can only score a finished generation. This rules out serving a time-to-first-token: the user-facing latency is not the time to generate the answer, it is that time *plus* however long the classifier takes to score it, every single turn. **Agentic workloads multiply the bottleneck.** An agent does not produce one generation per turn, it produces one per tool call. If every tool call needs to be checked for topic drift the way a final response does, the classifier sits in the loop at every step of the agent’s trajectory, not just at the end of it — turning a single per-turn delay into a delay compounded across however many tool calls the agent makes.
- **Fine-tuning overhead compounds with category drift.** Domain taxonomies are not stable. A healthcare platform adds a mental-health subtopic; a legal tool splits contract analysis from regulatory compliance. Every change forces another round of labeling, retraining, and re-validation, a standing operational tax.
- **Classifying from text misses the model’s own resolution.** The phrase “risk management” could be insurance, financial strategy, or factory-floor safety. A classifier reading the text has to disambiguate from surface words. The model that wrote the text already resolved that ambiguity internally, and that resolution sits in its activations, not in the words it happened to pick.

![fig_guardrail_roundtrip.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig_guardrail_roundtrip.jpg)

*One guarded turn, end to end. The user’s message passes through the guardrail model once on the way in (input check) and the core LLM’s full response passes through it again on the way out (output check) before anything reaches the user. Both passes are extra model calls sitting directly on the user’s wait — and an agentic workload pays this round trip on every tool call.*

---

# A Quick Primer on Sparse Autoencoders

## What a sparse autoencoder does

A language model has to store far more concepts than it has neurons, so it packs several unrelated ideas into the same directions in its activation space. This crowding is called **superposition**, and it is why a single neuron tends to light up for a confusing mix of things (**polysemanticity**) — you cannot just look at one neuron and know what the model is thinking.

A sparse autoencoder (SAE) is a small network attached to a frozen model that untangles this. Think of it as a translator: it takes the model’s crowded internal vector and rewrites it as a very long checklist of single-meaning features — *is this about medicine?*, *is this a legal clause?*, *is this a dollar amount?* — where almost every box is left unticked and only a handful are ticked at any moment. Because each feature stands for one thing and most stay off, you can finally read what the model is doing.

![fig_sae_schematic_v2.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig_sae_schematic_v2.jpg)

*An SAE’s architecture: the dense input activation x from a model layer is mapped by the encoder into a much wider hidden layer of features — 16,384 of them, of which only a handful fire, each standing for one readable concept (medical vocabulary, legal clauses, dollar amounts). The decoder reconstructs x′ from just those active features, and training minimises the reconstruction error between x and x′, which forces the sparse layer to faithfully represent what the model encoded. The JumpReLU gate is what keeps each feature cleanly on or off — one concept per direction.*

The “sparse” part is the whole point: out of tens of thousands of features, only about 20 fire for any given token. That sparsity is what makes the features interpretable and, as it turns out, topic-discriminative. The approach was introduced and scaled by Bricken et al. ([*Towards Monosemanticity*](https://transformer-circuits.pub/2023/monosemantic-features), Anthropic 2023) and Cunningham et al. ([*Sparse Autoencoders Find Highly Interpretable Features in Language Models*](https://arxiv.org/abs/2309.08600), ICLR 2024).

---

# How Did We Build This?

# Data Generation

There is no off-the-shelf dataset of chatbot queries that spans the domains we care about, so we built a small synthetic data pipeline to generate the prompts ourselves. The taxonomy is not arbitrary: it follows the kind of business domains that established topic classifiers already model, organized into **7 domains**, each split into **4 subtopics**.

- **HR & people operations** — the employee lifecycle: hiring and recruiting, onboarding and training, performance reviews, and compensation, benefits, and leave.
- **Customer service** — front-line support interactions: billing disputes, account access, technical troubleshooting, and shipping, returns, and refunds.
- **Financial** — money and markets: investor communications, personal banking and credit, insurance and risk, and tax and accounting.
- **Healthcare** — clinical and population health: patient documentation, public health and epidemiology, medical research and trials, and mental and behavioral care.
- **Enterprise documents** — internal business artifacts: records and memos, operational procedures, project and planning docs, and commercial transaction records.
- **General news & content** — journalism and commentary: current affairs and geopolitics, science and tech news, culture and sports, and environment and society.
- **Legal** — the law as practiced: contract clause analysis, regulatory and data compliance, employment and labor law, and IP and licensing.

As noted above, each of the seven topics is split into four subtopics. The subtopics are never classification targets — the classifier only ever sees the seven top-level labels — but they shape how the data is generated. A domain like Financial is broad, and a generator asked for 144 “financial” questions directly would drift toward the same few obvious ones. Anchoring each request to a specific subtopic (investor communications, personal banking, insurance, tax) forces even coverage across the full breadth of the domain and gives every prompt a concrete scenario to build on. The subtopics exist to add nuance and spread at generation time, not to be predicted.

We then classify on the seven parent topics rather than the 28 subtopics, for two reasons. First, it keeps the problem tractable: seven classes need far less signal to separate than 28, where neighbouring subtopics — personal banking versus tax, say — share most of their vocabulary and would demand far more from the features to tell apart. Second, it keeps the system general: production routing happens at the domain level, and a seven-way classifier transfers across deployments more readily than one pinned to a specific 28-way taxonomy.

The generator runs on the OpenAI Responses API (`gpt-5.4-mini`, medium reasoning effort). The system prompt hands the model the full taxonomy with a short description of each subtopic, then asks for one natural user question targeting a given subtopic, varying the phrasing, register, and persona so the prompts read like real people rather than templates. The output comes back as a JSON array, one question per spec, tagged with its topic and subtopic.

With that pipeline, we generated just over 1,000 prompts across the 7 topics, roughly 144 per topic (1,008 total). A representative example from each of a few domains:

> **HR:** “Can you explain our compensation, benefits and leave setup, including how bonuses are calculated, when payroll runs, and how employees request paid or unpaid leave?”
> 

> **Healthcare:** “What’s the difference between clinical trial protocols, trial results, adverse event reports, and research abstracts in medical research & clinical trials?”
> 

> **Financial:** “Can you give me advice on personal banking and credit, like choosing between checking and savings accounts, improving a credit score, and managing a credit card?”
> 

> **Legal:** “Can you explain what obligations organizations have under regulatory and data compliance rules like GDPR and CCPA, and what a solid compliance program should include?”
> 

> **Customer service:** “My package arrived damaged and I want to request a return and refund — what steps should I take?”
> 

Each prompt carries its topic and subtopic as a label, assigned at generation time. There is no separate annotation pass and no label ambiguity to clean up. The spec that produced the prompt is its ground truth.

# The Classification Pipeline

![fig_architecture_v2.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig_architecture_v2.jpg)

*The pipeline in three stages. Stage 1 captures residual-stream hidden states from a frozen Gemma 3 via forward hooks — one 1,152-dim vector per token. Stage 2 encodes them through the frozen Gemma Scope SAE into per-token binary masks, collapses the time dimension with a logical OR, and keeps the top 100 features by cross-topic variance. Stage 3 is the only trained component: a tiny classifier that maps the 100-dim vector to one of seven topics.*

The pipeline has three jobs: generate from the model and capture its activations, turn those activations into a compact feature vector, and train a light classifier on top. The shape follows [Qwen-Scope](https://arxiv.org/abs/2605.11887)’s recipe (Deng et al., 2026) — pretrained SAE features feeding a small classifier — with two deliberate departures: we read activations from the model’s *generation* rather than its prompt, and we classify into seven topics rather than a binary toxicity label. Qwen-Scope demonstrated multilingual toxicity classification across 13 languages on Qwen3 and Qwen3.5 using SAE features; we adapt the same feature-selection-then-classify pattern for multi-class topic routing on Gemma 3. Each stage below pairs what we do with why we do it.

# Stage 1 — Generation and Capture

We classify from what the model *writes*, not from the prompt it reads. A prompt is short and often noncommittal — “help me put this together” barely signals a topic — whereas the answer commits fully to one. So we apply the chat template, let Gemma 3 generate up to 512 tokens, and capture hidden states along the way.

- **Hooks on every layer.** A forward hook on each transformer layer records the residual-stream hidden state at every position. We grab all layers in one pass, so choosing the best layer later is a cheap offline decision rather than another generation run.
- **Prefill and decode are captured separately.** The prompt first runs through the model once to build the KV cache (prefill), then tokens are produced one at a time (decode). We keep both because they answer different questions: prefill activations are the model *reading*, decode activations are the model *writing*. Separating them lets us prove where the topic signal lives instead of assuming it.

![fig_demo_prefill_v2.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig_demo_prefill_v2.jpg)

*Prefill vs. decode in practice. During prefill the model processes the entire chat-templated prompt (blue tokens — the model reading) in a single forward pass, building the KV cache. During decode it produces one new token per step (orange — the model writing), reusing that cache. Our forward hooks capture the residual-stream hidden state at every position in both phases, keeping them in separate buffers so we can compare where topic signal lives.*

- **Three capture modes** fall out of that split, and we compare all three:
    - `decode` — one hidden-state vector per generated token (up to 512).
    - `prefill` — only the last prompt-token vector, with no generation.
    - `prefill+decode` — the prefill vector prepended to the decode sequence.

# Stage 2 — Feature Discovery

This stage turns dense activations into a compact, discriminative feature vector.

- **SAE encoding.** Each hidden state passes through the frozen Gemma Scope SAE for its layer. The JumpReLU activation gates each feature cleanly on or off — a dense 1,152-dim vector becomes a sparse binary mask over 16,384 features, roughly 20 active.
- **Temporal aggregation (logical OR).** We OR the per-token masks across the full generation: a feature counts as fired if it fired at any step. This collapses a variable-length answer into one fixed-size vector. The cost is that it is offline — it needs the whole generation first. A streaming variant that updates the accumulator token by token is future work.
- **Cross-topic variance selection.** We rank all 16,384 features by how unevenly they fire across topics. For each feature: compute the mean firing rate per topic, then the variance of those seven rates. High variance = discriminative (fires for one or two topics, quiet elsewhere). We keep the top 100 features from the single best-scoring layer. Labels are used only to group firing rates; neither the model nor the SAE is touched.

# Stage 3 — Classification

The classifier is a two-layer MLP — 64 hidden units, ReLU — trained on the 100-dim binary vectors with AdamW and cross-entropy for 30 epochs. It is small on purpose: the features already carry the signal, and a linear probe on the same vectors gets within a couple of points (the ablations push this further). Feature selection runs on the training split only; the test set is untouched until evaluation.

# Putting It Together

The whole loop for a single prompt, start to finish:

1. **Generate** — apply the chat template and let Gemma 3 produce up to 512 tokens.
2. **Capture** — at every generated token, grab the residual-stream hidden state from the chosen layer.
3. **Encode** — push each hidden state through the frozen SAE to get a binary “which features fired” mask.
4. **Aggregate** — OR those masks across all tokens into one 16,384-dim fired-feature vector.
5. **Select** — keep the 100 feature columns picked by cross-topic variance, giving a 100-dim vector.
6. **Classify** — feed that vector to the MLP and read off the topic.

Training runs steps 1–5 over the train split, uses the variance scan to lock in the layer and the 100 features, then fits the MLP on the resulting vectors. Inference is the identical path with the layer and features already fixed, so the only added cost at serve time is one SAE forward pass and a small matrix multiply.

# Configuration

**TL;DR:** We run Gemma 3 (1B and 4B IT) with the matching Gemma Scope JumpReLU SAEs, residual-stream, 16k-wide, about 20 active features per token. Each of 1,008 GPT-generated prompts is generated for up to 512 tokens, encoded through the SAE, and OR-aggregated into a 16,384-dim firing vector. The top 100 features by cross-topic variance (train split only, seed 42, 115 train / 29 test per topic) feed a 2-layer 64-unit MLP. The best decode layer sits deep in the network (L25 of 26 for 1B); the best prefill layer sits halfway (L13).

| Parameter | Value | Why this choice |
| --- | --- | --- |
| Models | Gemma 3 1B IT, Gemma 3 4B IT | Gemma Scope ships pretrained SAEs for exactly these instruction-tuned models; two sizes let us test how the signal scales. |
| SAE repositories | `google/gemma-scope-2-1b-it`, `google/gemma-scope-2-4b-it` | The official Gemma Scope v2 releases matched to each base model — no training on our side. |
| SAE type | JumpReLU, residual stream post-layer, width 16k, L0 ≈ 20 active/token | Residual-stream SAEs see the full layer output; the hard JumpReLU threshold gives clean on/off firing, and ~20 active features keeps each token sparse and interpretable. |
| Total dataset | 1,008 prompts — 28 subtopics × 36, generated by GPT-5.4-mini | Enough coverage per topic to train a small classifier while staying cheap to generate. |
| Train / test split | 115 train / 29 test per topic (seed=42) | A standard 80/20 split per topic; the fixed seed keeps runs reproducible. |
| Generation | up to 512 new tokens, max 2,048 input tokens, batch size 64, bf16 | 512 tokens captures a full answer where the topic signal accumulates; batch 64 / bf16 fits the run on a single GPU. |
| Aggregation | logical OR of fired features across all decode steps | Collapses a variable-length answer into one fixed-size vector and matches the question we care about: did this feature fire at all during the answer. |
| Feature selection | Top-100 by cross-topic variance, best SAE layer, train split only | Variance surfaces the features that actually separate topics; restricting it to the train split keeps the test set honest. |
| Classifier | 2-layer MLP, 64 hidden units, 30 epochs, AdamW lr=1e-3, batch 512 | Deliberately small. If the selected features are good, a light classifier is all the task needs. |

---

# What Did We Find?

# Evaluation Setup

All numbers are on 203 held-out test samples, 29 per topic. Because the classes are balanced, accuracy and micro-F1 coincide, but we report macro-F1 (the unweighted mean of the per-class F1 scores) alongside it so a single dominant class cannot flatter the result. The first question we wanted to settle was where in the model the topic signal lives, so we compared four capture-mode variants head to head on the 1B model — two readings of the prompt (a single last-token vector, and every prompt token pooled), plus decode and prefill+decode.

| Mode | What is captured | Best Layer | Accuracy | Macro-F1 |
| --- | --- | --- | --- | --- |
| Prefill (last token) | Hidden state at the last prompt token only — no generation | L13 | 75.4% | 0.751 |
| Prefill (pooled, all prompt tokens) | Every prompt-content token OR-pooled — no generation | L19 | **96.55%** | **0.965** |
| **Decode** | Hidden state at every generated token (up to 512 steps) | L25 | **94.1%** | **0.941** |
| Prefill+Decode | Last prompt token prepended to all decode-step vectors | L25 | 94.6% | 0.946 |

![fig_capture_mode_accuracy.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig_capture_mode_accuracy.jpg)

*Prefill collapses to 75.4% when read from a single last-token position, but pooling over the whole prompt — the same logical-OR aggregation decode uses — brings it to 96.55%, ahead of both decode and prefill+decode. The Ablation section below unpacks why the single-position probe was so misleading.*

19%. That is the gap between reading the prompt at a single position and reading the generation. Read from that one last-token vector, instruction-tuned models look like they barely commit to a topic while reading a question and only commit while answering it — but pooling the prompt over all of its tokens closes almost all of that gap, which says the single position was the problem, not the prompt itself. Ask Gemma 3 “How do public health agencies track disease outbreaks?” and the clinical features barely stir at that one last-token position. They light up once it starts generating “monitoring & detection,” “real-time surveillance,” “early warning signs” — and, as it turns out, they were already present earlier in the prompt too, just spread across positions a single-vector probe can’t see. Prefill+decode is statistically indistinguishable from decode alone, because that single prefill vector is one vote among 513 in the OR. From here on, every result uses decode mode unless stated otherwise; the pooled-prefill result is unpacked fully in its own ablation below.

# Main Results: The 1B Classifier

On the 1B model, decode mode gets 191 of 203 test samples right. **94.1% accuracy, 12 errors.** No fine-tuning, no output text read. The per-topic breakdown shows where that accuracy is even and where it frays:

| Topic | Precision | Recall | F1 |
| --- | --- | --- | --- |
| HR & people operations | 0.903 | 0.966 | 0.933 |
| Customer service | 0.966 | 0.966 | 0.966 |
| Financial | 0.862 | 0.862 | **0.862** ← weakest |
| Healthcare | 1.000 | 1.000 | **1.000** |
| Enterprise documents | 0.929 | 0.897 | 0.912 |
| General news & content | 0.966 | 0.966 | 0.966 |
| Legal | 0.964 | 0.931 | 0.947 |
| **Overall** |  |  | **94.1%** |

![fig_1b_per_topic_prf1.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig_1b_per_topic_prf1.jpg)

*Per-topic Precision, Recall, and F1 on the 1B decode model. Healthcare is perfect across all three metrics. Financial is the weakest class — P, R, and F1 all sit at 0.862. The dashed line marks the overall 94.1% accuracy.*

**Where it works: distinctive vocabulary fires early and the bag fills with one topic’s features.** Healthcare is perfect (F1 = 1.000), and the model’s own output shows why. A clinical question pulls clinical language from the first token, so the SAE fires unmistakable medical features and little else:

> **Prompt (Healthcare):** “How do public health agencies track disease outbreaks and plan vaccination campaigns during an epidemic?”
**Generated:** “…It’s a complex, multi-layered process… **1. Monitoring & Detection – Early Warning Signs** — **Real-Time Surveillance:** Public health agencies are using a wide range of tools to detect early signs of an outbreak… **Social Media Monitoring**… **Search Engine Data**…”
**Predicted: Healthcare ✓**
> 

The same clean signal shows up across the easy classes. A damaged-package complaint generates step-by-step return instructions saturated with support vocabulary — order number, tracking number, proof of damage, return policy:

> **Prompt (Customer service):** “My package arrived damaged and I want to request a return and refund—what steps should I take?”
**Generated:** “…**1. Gather Your Information:** — **Order Number:** You’ll need your order number… **Tracking Number:** This is essential for initiating the return. **Proof of Damage:** Take photos or videos of the damage *immediately*… Keep the original packaging…”
**Predicted: Customer service ✓**
> 

Customer service, General news, and Healthcare all clear F1 = 0.966 or better for the same reason: their vocabulary is theirs alone. When the generated content lives squarely inside one domain, the OR-aggregated feature bag is dominated by that domain’s features and the classifier has an easy call.

**Where it frays: the 12 errors trace one semantic neighbourhood, and Financial sits at its center.** The errors are not scattered uniformly across the confusion matrix — they concentrate in the business-document cluster where Financial, Enterprise documents, HR, and Legal genuinely overlap. Two patterns account for almost all of them.

The first is a clean **Enterprise documents → HR** cluster (3 errors): a project-and-planning-doc question, a product-roadmap-and-OKR request, and an internal remote-work memo. Each is a document an HR team would plausibly own, and the model writes it in people-and-process language, so the SAE fires HR features:

> **Prompt (Enterprise documents):** “Can you draft an internal memo announcing the new remote-work policy to employees?”
**Generated:** “…**MEMORANDUM** — **TO:** All Employees **FROM:** [Your CEO/Leadership Team Name]… This memo announces the implementation of a new, more flexible remote-work policy… We recognize the evolving needs of our employees and are committed to fostering a productive and supportive work environment…”
**Predicted: HR & people operations ✗**
> 

The second, larger pattern is **Financial as a confusion hub.** Financial is the weakest class (F1 = 0.862), and it is weak on both sides of the ledger: four other-topic samples are misread *as* Financial (one each from HR, Customer service, General news, and Legal), and four true-Financial samples leak *out* (twice to Enterprise documents, once each to Legal and General news). The thread tying these together is that “financial” content rarely has vocabulary of its own — it borrows the language of whatever document it happens to live in. An investor-communications question generates the structure of a corporate document, so it fires enterprise-document features:

> **Prompt (Financial):** “Can you explain what usually belongs in an investor & market communications package, such as an earnings call script, shareholder letter, analyst note, or IPO prospectus?”
**Generated:** “…**1. Earnings Call Script (For Management & Investor Relations)** — **Purpose:** This is the core communication tool for management to present the company’s performance and outlook. **Typical Elements:** — **Executive Summary:** A concise overview of the key takeaways…”
**Predicted: Enterprise documents ✗**
> 

And a tax-and-accounting question about GAAP versus IFRS generates a response dense with standards, rules, and compliance framing — which is exactly what fires the Legal features:

> **Prompt (Financial):** “What are the key differences between GAAP and IFRS in tax & accounting, and when would each one matter?”
**Generated:** “…the key differences between Generally Accepted Accounting Principles (GAAP) and International Financial Reporting Standards (IFRS)… | **Focus** | U.S. businesses | Global businesses | | **Rules** | Primarily U.S. GAAP | More flexible, broad |…”
**Predicted: Legal ✗**
> 

This GAAP/IFRS prompt is the single most stubborn item in the study: it is misclassified Financial → Legal not only here but again on the 1k-data 1B model and on the 4B model. The boundary it sits on — accounting standards as financial practice versus as regulatory rule — is real, and more model does not resolve it.

**A distinct, smaller failure mode: prompts that reference an artifact that was never supplied.** A few prompts say “analyze *this* contract clause” or “interpret *this* vendor invoice” without including any clause or invoice. With nothing to work from, the model does not generate domain content at all — it asks for the missing text:

> **Prompt (Legal):** “Can you analyze this contract clause and explain what it means for liability, indemnification, and arbitration rights?”
**Generated:** “Please provide me with the contract clause you’d like me to analyze! I need the text of the clause to be able to explain its meaning… Once you paste the clause, I’ll do my best to provide a thorough analysis. 😊…”
**Predicted: Customer service ✗**
> 

Because the generation carries no legal vocabulary — only an apologetic, helpdesk-style request for more information — the only features that fire are generic service-and-assistance ones, and the sample lands in Customer service. This is the one error type that is genuinely about the *prompt* rather than the topic boundary: when the model has nothing to write about, there is no generation to read, and the method has nothing to classify. (The same failure recurs on the 1k-data model for an “interpret this vendor invoice” prompt.)

A quality screen over the decode generations puts a number on how rare this is. Scoring every answer for collapse (type-token ratio, longest repeated 6-gram, word count) flags just 8 of 203 samples (3.9%), and every one of them traces to the same cause — a prompt asking the model to analyze a document that was never attached. Setting those aside, generation quality is strong even for a 1B model (mean ~320 words, type-token ratio 0.62); the model does not drift or repeat on answerable prompts. The empty-artifact failures are a property of the dataset, not of the model or the method, and a generation-side guardrail would catch them before they ever reach the classifier.

In none of these cases is the classifier mislabeling a clean signal. It is reading the generation faithfully every time; the generation itself either sits on a real boundary between two business categories (Financial / Enterprise / HR / Legal) or, in the empty-artifact case, never commits to a topic at all.

# Ablation: Scaling the Base Model

The 1B errors concentrate on one axis (Financial, Enterprise, Legal), which raises an obvious question: does a bigger model with finer-grained features clear them up? We ran the full pipeline on Gemma 3 4B, and for completeness also retrained the 1B decode model on the full 1,008-prompt dataset. The picture across all five configurations:

![fig1_overall_accuracy.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig1_overall_accuracy.jpg)

*Figure 1 — Overall accuracy across all five configurations. Decode improves with both data and scale (94.1% → 97.0% → 98.0%). Prefill is weaker and, unlike decode, regresses with scale (75.4% at 1B → 62.1% at 4B).*

| Configuration | Capture | Accuracy | Best layer (relative depth) |
| --- | --- | --- | --- |
| Gemma 3 4B | Decode | **98.0%** | L24 (71%) |
| Gemma 3 1B (1k data) | Decode | 97.0% | L21 (81%) |
| Gemma 3 1B | Decode | 94.1% | L25 (96%) |
| Gemma 3 1B | Prefill | 75.4% | L13 (50%) |
| Gemma 3 4B | Prefill | **62.1%** | L10 (29%) |

Two opposite trends sit in that table. **First, decode scales cleanly.** Moving to 4B lifts decode to 98.0%, and it climbs exactly where the 1B model struggled: Financial F1 goes from 0.862 to 0.982, Legal from 0.947 to 0.983, Enterprise documents from 0.912 to 0.966. The larger model develops features sharp enough to separate investor-speak from document-speak even when the surface words overlap, so the Financial hub that produced most of the 1B errors largely dissolves. Only four errors remain, and each is a genuine boundary case rather than a systematic confusion: the GAAP-vs-IFRS prompt once more (Financial → Legal), a compensation-and-leave overview the model frames as a formal policy document (HR → Enterprise documents), an “internal records and memos” question (Enterprise documents → HR), and a “summarize a news article about climate change or immigration” prompt (General news → Healthcare). No structural pattern is left — these are the irreducible label-boundary cases of the taxonomy itself.

![fig2_f1_heatmap.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig2_f1_heatmap.jpg)

*Figure 2 — Per-topic F1 across all five configurations. The separator line splits decode (top three rows) from prefill (bottom two). Decode rows are uniformly strong; on 1B prefill the weakest classes are Enterprise (0.654), Legal (0.667), Healthcare (0.702), and Financial (0.710), and 4B prefill collapses furthest.*

**Second, prefill does the opposite: it gets worse with scale.** The 4B prefill model lands at 62.1%. That is 13 points below the 1B model — a bigger network, a worse result. This is counter-intuitive until you look at where the best prefill layer sits. On 1B it is at 50% relative depth; on 4B it has moved to 29%, much earlier in the network. The extra depth does not add prompt-reading topic signal, it relocates that signal into an earlier, less linearly separable part of the model. The collapse is uneven: Financial (0.400 F1) and Healthcare (0.409 F1) fall hardest, because both are nearly invisible from prompt text and only declare themselves once the model generates domain content. HR, meanwhile, becomes a global attractor, absorbing 33 of the 77 4B-prefill errors as generic employee-and-process vocabulary bleeds in from every business topic.

![fig3_confusion_matrices.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig3_confusion_matrices.jpg)

*Figure 3 — Confusion matrices for all four runs (true topic by row, prediction by column). Decode tightens onto the diagonal as data and scale increase, dropping to four isolated errors at 4B. 4B prefill (bottom-right) is the scattered outlier, with HR acting as a global attractor.*

The takeaway is that capacity helps only the mode that reads the generation. Where the topic signal lives depends on the task: late layers during generation, mid-early layers while reading the prompt, and scaling the model does not rescue a *single-position* prefill probe — though, as the next ablation shows, that probe badly undersells how much topic signal the prompt actually carries.

# Ablation: How Big Should the Classifier Be?

We trained every MLP variant for 50 epochs across 5 seeds and averaged, to avoid reading noise. **Width beats depth.** Going from 64 to 512 hidden units buys about 1.6 points on decode, while adding a third layer hurts slightly at this data scale, since the extra nonlinearity adds more variance than signal.

![fig4_mlp_width.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig4_mlp_width.jpg)

*Figure 4 — Test accuracy vs. MLP hidden-layer width for decode and prefill (5 seeds, 50 epochs). The amber dashed line marks the original 64-unit baseline. Decode reaches near-ceiling above 32 units; prefill keeps benefiting from added width.*

| Hidden Units | Decode Accuracy | Prefill Accuracy |
| --- | --- | --- |
| Linear probe | 92.9% | 74.1% |
| 16 | 92.9% | 72.3% |
| 32 | 95.4% | 76.5% |
| **64 (baseline)** | **96.1%** | **80.3%** |
| 128 | 96.7% | 83.9% |
| 256 | 97.2% | 86.0% |
| 512 | 97.7% | 85.9% |

Prefill is the more interesting column. There, the jump from a linear probe (74.1%) to the best MLP (86.3%, reached by a wider two-layer net) is over 12 points — more than double the decode gain of roughly 5. The prefill signal has genuinely tangled decision boundaries that reward nonlinearity. The decode signal, by contrast, is clean enough that almost any reasonable MLP lands near the ceiling and the architecture stops mattering.

# Ablation: Can we use other classifiers?

The MLP was a default, not a considered choice, so we swapped in a battery of classical classifiers on the same top-100 features. On decode it barely matters which one you pick: logistic regression, linear and RBF SVMs, random forests, and gradient boosting all land in a narrow 97–99% band (only the most heavily regularized logistic regression dips, to 95.6%). That spread is itself the finding — the features are clean enough that the classifier is almost incidental.

![fig5_classifier_comparison.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig5_classifier_comparison.jpg)

*Figure 5 — Accuracy across classifier types on the top-100 features. Logistic regression (C=10) is best on decode at 99.0%; an RBF-kernel SVM is best on prefill at 88.2%.*

The standout is **logistic regression at 99.0% on decode** — two errors out of 203, beating every MLP we tried. A plain linear model topping the table means the 100 SAE features are essentially linearly separable by topic, so the MLP’s nonlinearity buys nothing. Tuning the remaining knobs (activation function, dropout, weight decay, batch norm) moves decode by less than a point in any direction, which says the same thing another way.

Prefill is the exception that proves the rule. There the best classifier is an RBF-kernel SVM at 88.2%, clearly ahead of any linear model — the prefill features carry nonlinear structure that a straight line cannot exploit. It is the one regime where the choice of classifier actually earns its keep.

# Ablation: How Many Features Do You Need?

**You do not need all 100.** The top 5 features alone reach about 56%, well clear of the 14% chance line for seven classes, and the top 30 already hit 94.1% — matching the original 100-feature decode baseline. On decode the curve flattens after roughly 50 features; a 50-feature classifier (95.5%) sits within a couple of points of the full set, and the rest is marginal. On prefill it keeps climbing all the way to 100 without leveling off, which again fits a more diffuse signal spread thinly across many weak features rather than concentrated in a few strong ones.

![fig6_feature_count.png](https://blog-cdn.mercity.ai/blog/building-llm-guardrails-with-saes/fig6_feature_count.jpg)

*Figure 6 — Accuracy vs. number of selected SAE features (log scale). Decode’s gains flatten after about 50 features. Prefill keeps climbing to 100 without flattening, consistent with a more diffuse signal.*

---

# Conclusion

SAE features read off Gemma 3 during generation carry a clean, strongly separable topic signal. 94.1% with a two-layer MLP over 100 features. 99.0% with a logistic regression on the same features. 98.0% when we scale the base model to 4B. All of it with the model and SAE frozen, no output text read, and 115 labeled samples per topic. The signal is easiest to read off the generation: a single-position prefill probe trails decode by ~19 points on the 1B model and, unlike decode, gets worse as the model scales. But that gap is mostly about sparsity, not the prompt — pool prefill over the whole prompt and it climbs to 96.55%, so the topic signal lives in both the reading and the writing; the generation is just the part a live system can always read.

This is a proof of concept, and the next steps are about hardening it rather than repairing anything. (1) **Scale the evaluation set** — at 29 test samples per topic a single miss moves a class F1 by more than three points, so the per-class numbers are best read as directional, and a larger, harder test set is first on the list. (2) **Decode the selected features** — each of the 100 features maps back to a human-readable concept, and reading them off would explain directly why healthcare separates cleanly while financial leans on legal. (3) **Move it on the fly** — the OR accumulator can be updated token by token during streaming, turning this offline analysis into a live routing signal that can flag an off-topic generation before it finishes.

---

# References

1. Bricken, T., Templeton, A., Batson, J., Chen, B., Jermyn, A., Conerly, T., Turner, N., Anil, C., Denison, C., Askell, A., Lasenby, R., Wu, Y., Kravec, S., Schiefer, N., Maxwell, T., Joseph, N., Hatfield-Dodds, Z., Tamkin, A., Nguyen, K., McLean, B., Burke, J. E., Hume, T., Carter, S., Henighan, T., & Olah, C. (2023). *Towards Monosemanticity: Decomposing Language Models With Dictionary Learning.* Anthropic. [transformer-circuits.pub/2023/monosemantic-features](https://transformer-circuits.pub/2023/monosemantic-features)
2. Cunningham, H., Ewart, A., Riggs, L., Huben, R., & Sharkey, L. (2024). *Sparse Autoencoders Find Highly Interpretable Features in Language Models.* ICLR 2024. [arxiv.org/abs/2309.08600](https://arxiv.org/abs/2309.08600)
3. Lieberum, T., Rajamanoharan, S., Conmy, A., Smith, L., Sonnerat, N., Varma, V., Kramár, J., Dragan, A., Shah, R., & Neel, N. (2024). *Gemma Scope: Open Sparse Autoencoders Everywhere All At Once on Gemma 2.* [arxiv.org/abs/2408.05147](https://arxiv.org/abs/2408.05147)
4. Deng, Y., et al. (2026). *Qwen-Scope: Turning Sparse Features into Development Tools for Large Language Models.* [arxiv.org/abs/2605.11887](https://arxiv.org/abs/2605.11887)
5. Google. *Gemma Scope v2 SAE Repositories.* Hugging Face. [huggingface.co/google/gemma-scope-2-1b-it](https://huggingface.co/google/gemma-scope-2-1b-it), [huggingface.co/google/gemma-scope-2-4b-it](https://huggingface.co/google/gemma-scope-2-4b-it)
