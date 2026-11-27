---
title: How We Trained a 4B NLI Model to Catch Subtle Business Policy Violations in AI Agents
metaDescription: >-
  Policy NLI, our 4B model, caught 67 of 80 business policy violations at 1%
  false alarms, against 33 for Claude Sonnet 5.5 and 8 for DynaGuard-8B.
slug: how-we-trained-a-4b-nli-model-to-catch-policy-violations
publishedAt: '2026-11-27'
summary: >-
  We trained Policy NLI, a 4B model that checks a support agent's reply against
  one business rule and answers followed, violated or doesn't apply. It caught
  67 of 80 violations at 1% false alarms. This is how we trained it, step by
  step, and how to train your own.
authors:
  - name: Pranav Patel
tags:
  - AI Agents
  - LLM Guardrails
  - Decision Models
  - LLM Fine-tuning
category: LLM Guardrails
isTopPick: false
image: /blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/violations-caught.png
jsonld:
  abstract: >-
    Mercity trained Policy NLI, a 4B model that reads a customer-service agent's
    conversation, its reply and one business rule, and answers followed,
    violated or doesn't apply with a one-sentence reason. On 20,435 checks from
    two business types it never saw in training, it caught 67 of 80 natural
    violations at 1% false alarms, against 33 for Claude Sonnet 5.5, 12 for
    Llama-Guard-3-8B and 8 for DynaGuard-8B. Each of four training steps on a
    LoRA over Mercity's 4B decision model changed one thing; reading the
    conversation gave the largest gain, from 51 to 65 catches. Behind a 395M
    screening encoder it costs $4.84 per million checks.
  about:
    - name: Natural language inference
      sameAs: https://en.wikipedia.org/wiki/Textual_entailment
    - name: LLM guardrails
    - name: Policy compliance for AI agents
    - name: Decision models
    - name: Low-rank adaptation
      sameAs: https://en.wikipedia.org/wiki/LoRA_(machine_learning)
    - name: Customer service AI agents
  keywords:
    - policy violation detection
    - business policy compliance for AI agents
    - natural language inference for guardrails
    - Policy NLI
    - DynaGuard vs Llama Guard
    - guardrail model benchmark
    - train a guardrail model on your own rules
    - customer service agent policy checks
    - ModernBERT screening encoder
    - DynaBench
    - vLLM prefix caching for guardrails
  citation:
    - name: Mercity/policy-nli-decision-model-4b-lora
      url: >-
        https://huggingface.co/Mercity/policy-nli-decision-model-4b-lora
      type: model
    - name: Mercity/policy-nli-modernbert-large
      url: https://huggingface.co/Mercity/policy-nli-modernbert-large
      type: model
    - name: Mercity/policy-nli
      url: https://huggingface.co/datasets/Mercity/policy-nli
      type: dataset
    - name: Policy NLI training logs, code and reports
      url: https://huggingface.co/buckets/Mercity/Policy-NLI
      type: page
    - name: Mercity/decision-model-qwen3.5-4b
      url: https://huggingface.co/Mercity/decision-model-qwen3.5-4b
      type: model
  faq:
    - q: What is Policy NLI?
      a: >-
        Policy NLI is a 4B model from Mercity that checks a customer-service AI
        agent's reply against one business rule. Given the conversation so far,
        the reply and the rule, it answers that the rule was followed, violated
        or doesn't apply, and writes one sentence on why. It is a LoRA for
        Mercity's 4B decision model, released with a screening encoder, the
        dataset and the training logs.
    - q: >-
        How do guardrail models like Llama Guard and DynaGuard do on business
        policy violations?
      a: >-
        Poorly, in Mercity's test of 20,435 checks with 80 natural violations.
        At 1% false alarms the best guard, Llama-Guard-3-8B, caught 12,
        DynaGuard-8B caught 8 and ShieldGemma-27B caught 3, and every guard
        scored an average precision of 0.023 or lower. Each judges one message
        against one rule, answers only pass or fail, and does not read the
        earlier conversation that 73 of the 80 violations depend on.
    - q: Why does a policy checker need a "doesn't apply" answer?
      a: >-
        A business rule usually applies only in one situation. In Mercity's
        earlier study, Jev wrongly blocked 9% of clean replies, and "must"
        rules, 29% of the rules, caused 79% of those wrong blocks, such as
        blocking a reply that sent a user who had taken too many pills to 911
        because it did not offer to reschedule. Policy NLI can answer that a
        rule doesn't apply, so a rule outside its situation is not counted as
        broken.
    - q: >-
        How much does reading the conversation help a policy violation detector?
      a: >-
        It gave the largest gain in Mercity's training. With the same recipe,
        data and seed, placing the earlier turns before the reply raised the 4B
        model's catches from 51 to 65 of 80 and doubled its precision from 10%
        to 22%. The same change hurt a 395M ModernBERT encoder, which fell from
        38 to 22 catches because it treated a related word anywhere in the chat
        as the trigger.
    - q: How much does it cost to run Policy NLI?
      a: >-
        On one A100 at $2 an hour, running Policy NLI on every check costs about
        $20 per million. Behind a 395M screening encoder that sends only its
        most suspicious 20% onward, it catches the same 67 of 80 for $4.84 per
        million checks, against about $2,415 per million for Claude Sonnet 5.5
        at API prices. All of a reply's rules are checked in 132 ms at the
        median.
    - q: >-
        How can Mercity help with catching policy violations in a
        customer-facing AI agent?
      a: >-
        Mercity trains policy checkers on a client's own rules and conversations
        and builds them into the agent's guardrail layer, measured on violations
        the client's agent made on its own at a fixed false-alarm rate. It
        released Policy NLI with its weights, dataset, training code and logs in
        the open, alongside Heckler and its decision-model guard study, and has
        taken guardrail systems to production for many clients. Every checker
        runs in shadow mode on the client's traffic before it blocks anything.
---

We trained Policy NLI, a 4B model that catches subtle policy violations in the replies of customer-service AI agents. Given the conversation so far, the agent's reply and one rule, it answers that the rule was followed, violated or doesn't apply, and it writes one sentence on why. On 20,435 checks from two business types it never saw in training, Policy NLI caught 67 of the 80 violations (84%) while raising false alarms on 1% of clean checks. Claude Sonnet 5.5 caught 33 at the same setting, and DynaGuard-8B, the guard model built for custom policies, caught 8. Behind a small screening encoder, Policy NLI costs \$4.84 per million checks.

This post is the log of how we got there. We start with why we needed a model of our own, then walk through each training step and what it changed on the same test set, and finish with how to train a policy violation detection model for your own business. Everything we used is public:

- **Policy NLI weights:** [Mercity/policy-nli-decision-model-4b-lora](https://huggingface.co/Mercity/policy-nli-decision-model-4b-lora), a LoRA for our 4B decision model, with its calibration file and prompt builder
- **Screening encoder:** [Mercity/policy-nli-modernbert-large](https://huggingface.co/Mercity/policy-nli-modernbert-large), a 395M model with ONNX, 8-bit and 4-bit builds for CPU
- **Dataset:** [Mercity/policy-nli](https://huggingface.co/datasets/Mercity/policy-nli), 8,581 training checks, the test sets and 5,393 conversations, under CC-BY-4.0
- **Training logs, code and reports:** [the Mercity/Policy-NLI bucket](https://huggingface.co/buckets/Mercity/Policy-NLI), with every run's logs and predictions, the full sprint report and a tested vLLM serving recipe

Huge thanks to [Runcrate](https://www.runcrate.ai/) for sponsoring the compute for this project. They backed a slightly audacious bet, a 4B model beating guardrails twice its size on real business rules, and their GPUs let us train and benchmark every model in this post in a single day.

<figure class="article-figure">

![Violations caught out of 80 at 1% false alarms](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/violations-caught.png)

<figcaption>Figure 1: Violations caught out of 80 at 1% false alarms on the policy-nli test set.</figcaption>

</figure>

## Why We Trained a Business Policy NLI Model for AI Agents

A company that deploys a support agent gives it a list of rules, such as "when a customer disputes an invoice, stop and send them to Billing Support." After every reply, someone has to know whether each rule was followed. That sounds like a job for a guardrail model, and several exist. We tested seven of them, two untrained Qwen3.5 models and two Claude models before training anything, and accuracy, compute and latency each ruled them out.

### Business Rules Need a Third Answer: This Rule Doesn't Apply

[Our November study](/blog-post/can-a-decision-model-guard-a-customer-facing-agent) showed the first problem. We scored 5,620 replies from five agents with Jev, TypeSafe's decision model, and it wrongly blocked 424 of them (9%). "Must" rules made up 29% of the rules but caused 79% of those wrong blocks, as Figure 2 shows. In one conversation a user said they had taken too many pills, and the clinic agent told them to call 911. Jev blocked that reply with 0.90 confidence because it didn't offer to reschedule.

The fix pointed at the task we needed. Adding exceptions to four rules cut their wrong blocks from 13 to 0, which told us that a business rule usually applies only in one situation, and a checker has to be able to say so. Most guard models answer pass or block, so they treat every rule as if it applies to every reply. Policy NLI has three answers: followed, violated, and doesn't apply.

<figure class="article-figure">

![Must rules were 29% of the rules and caused 79% of the wrong blocks](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/must-rules-wrong-blocks.png)

<figcaption>Figure 2: "Must" rules were 29% of the rules and caused 79% of the wrong blocks.</figcaption>

</figure>

### Guardrail Models Catch at Most 12 of 80 Business Policy Violations

On our test set the best guard model, Llama-Guard-3-8B, caught **12 of the 80 violations** at 1% false alarms. DynaGuard-8B caught 8, Llama-Guard-4-12B caught 7, DynaGuard-4B caught 7, ShieldGemma-27B caught 3, ShieldGemma-9B caught 2 and DynaGuard-1.7B caught 1. DynaGuard-8B ranked violations no better than chance, with an AUROC of 0.49. Every guard scored an average precision (AP), our measure of how well a model ranks violations above clean checks, of 0.023 or lower, where random ranking scores 0.004. Claude Sonnet 5.5 was the strongest off-the-shelf model at 33, and Claude Haiku 5.5 caught 10.

The guards come from three recipes, and none was built for a company's own rules. Llama Guard is a Llama model fine-tuned to label a conversation safe or unsafe against a fixed list of hazard categories, such as violent crime or self-harm, and it accepts custom categories in its prompt. ShieldGemma is Gemma fine-tuned to answer Yes or No to whether content breaks a written guideline, trained on a handful of harm types such as hate speech and dangerous content. DynaGuard is the closest fit: Qwen3 fine-tuned on user-written policies from the DynaBench dataset, answering PASS or FAIL directly in its fast mode or after writing its reasoning. We gave each guard the closest setup its design allows, with the rule as Llama Guard's custom category, ShieldGemma's guideline and DynaGuard's policy. Figure 3 sets the three side by side.

<figure class="article-figure">

![What each guard reads and can answer, and how many violations it caught](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/guard-recipes.png)

<figcaption>Figure 3: What each guard reads, what it can answer, and how many of our 80 violations its best version caught.</figcaption>

</figure>

All three still judged one message against one rule and could only answer pass or fail, so none could say a rule didn't apply, and none read the earlier conversation that 73 of our 80 test violations depend on. The untrained Qwen3.5-9B and Qwen3.5-4B, given the same prompt our models get, caught 19 and 17 and beat every guard, which suggests that safety training doesn't transfer to business rules.

If you run guards on your own rules, check for the two setup bugs that changed our baselines:

- **Llama-Guard-3:** its prompt had a stray space before its start token, and fixing it raised its catch rate from 9% to 16%.
- **ShieldGemma:** its first DynaBench run went past Gemma's 8,192-token context limit and had to be rerun.

### The Next Best Options Cost More per Violation Caught

The guards that caught the most are 8B models, twice the size of Policy NLI, and ShieldGemma-27B is nearly seven times its size. In 16-bit precision an 8B model's weights alone take about 16 GB of GPU memory and a 27B model's take about 54 GB, against about 8 GB for Policy NLI. A team running one checker per agent, or one per region, pays for that memory on every GPU.

The cost of a check follows the same pattern once accuracy is counted. On one A100 at \$2 an hour, DynaGuard-8B costs \$6.83 per million checks and catches 8, ShieldGemma-27B costs \$35.16 and catches 3, and DynaGuard-1.7B costs \$3.03 and catches 1. Claude Sonnet 5.5 catches 33 for about \$2,415 per million checks at API prices; judging all our test sets with both Claude models cost \$59. Policy NLI behind the 395M screening encoder catches 67 for **\$4.84 per million checks**, as Figure 4 shows.

<figure class="article-figure">

![Cost per million checks against violations caught](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/cost-vs-catches.png)

<figcaption>Figure 4: Cost per million checks against violations caught, on a log scale.</figcaption>

</figure>

### An 8B Guard or an LLM Judge Adds Latency to Every Reply

A policy check runs after every reply an agent writes, and our test replies were checked against 3.8 rules on average. Policy NLI checks all of a reply's rules in 132 ms at the median on one A100 (204 ms at the 95th percentile), because the rules share one reading of the conversation. A single check takes 80 ms at the median and 134 ms at the 95th percentile, including the HTTP round trip.

We didn't benchmark DynaGuard-8B's per-check latency, so these figures are estimates. An 8B model does about twice the computation per token of a 4B model, so given the same conversation Policy NLI reads, we estimate about 160 ms per check. DynaGuard's reasoning mode writes its thinking before the verdict, and an 8B model on one A100 generates roughly 100 tokens a second, so every 100 tokens of reasoning adds about a second to each check. An LLM judge such as Claude Sonnet 5.5 makes about four API calls for every reply the agent writes, one per rule, each a round trip to an outside service.

### Accuracy, Compute and Latency Compound Into a Fragile Guardrail Pipeline

The three problems stack. A guard model is cheap to run but misses nine in ten violations, and the flags it does raise are mostly wrong: DynaGuard-8B flagged 870 test checks at its default setting to find 8 violations, a precision of about 1%. A frontier LLM judge catches more but costs about 500 times as much as our setup, sends every conversation to an outside API, and in our runs judged the reply without the conversation.

Combining them doesn't fix either problem. A team that puts a guard in front of an LLM judge gets a first layer that doesn't catch violations, a second layer that adds API calls and cost to every reply and still misses more than half of them, and a review queue full of the guard's false alarms. Each layer is another model to host, monitor and update when the rules change. We wanted one small model that reads the conversation, catches most violations and runs on a single GPU, so we built it. Figure 5 compares the two setups.

<figure class="article-figure">

![A guard plus an LLM judge compared with one model that reads the conversation](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/guard-plus-judge-vs-one-model.png)

<figcaption>Figure 5: The common guard-plus-judge setup against one model that reads the conversation.</figcaption>

</figure>

## How We Trained Policy NLI, One Change at a Time

Natural language inference (NLI) is the task of deciding whether one text supports, contradicts or is unrelated to another, and policy compliance maps onto it directly. The rule plays the part of the hypothesis, the conversation and reply are the evidence, and the three NLI answers become followed (A), violated (B) and doesn't apply (C), as Figure 6 shows. Our training data is the policy-nli dataset: 8,581 checks from 109 businesses, balanced across the three answers. Each check comes with the rule, the reply, the label and a one-sentence reason, and a strict LLM judge produced the labels with a literal reading of each rule.

The test set comes from two business types that appear nowhere in training, travel booking and insurance claims. It has 20,435 checks and only 80 violations (0.4%), each one a natural violation that an assistant made on its own, with no one editing the reply. A model that always answers "followed" would score 99.6% accuracy and catch nothing, so we score every model by how many of the 80 it catches when it may flag only 1% of clean checks, about 200 false alarms. Every catch count in this post uses that setting unless it says otherwise, and every 95% interval comes from resampling whole conversations.

We trained in four steps, and each changed one thing: first a model that reads only the reply, then the conversation, then the DynaBench dialogues, then the labelers' written reasons. Because every step was scored on the same test, the change in catches from one step to the next comes from that step. Figure 7 traces the four steps on our test and on DynaBench.

<figure class="article-figure">

![Policy NLI reads the conversation, the reply and one rule, then answers A, B or C](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/three-answers.png)

<figcaption>Figure 6: Policy NLI reads the conversation, the reply and one rule, then answers A, B or C with a reason.</figcaption>

</figure>

<figure class="article-figure">

![Catches and DynaBench F1 after each of the four training steps](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/training-lineage.png)

<figcaption>Figure 7: Violations caught out of 80 and DynaBench F1 after each training step.</figcaption>

</figure>

### Step 1: Our First Fine-Tuned 4B Model Caught 49 of 80 From the Reply Alone

We first trained two models on the 8,581 checks, each reading only the rule and the agent's reply, as Figure 8 shows. The first is an encoder, ModernBERT-large with 395M parameters, which outputs a score for each answer and is small enough to run on a CPU. It caught 38 of 80. Other encoders did worse: DeBERTa-v3-large collapsed to a single answer until we gave it a fresh output head, and smaller ModernBERT models of 149M, 68M, 32M and 17M parameters caught 17, 11, 5 and 8.

The second is [our 4B decision model](/blog-post/how-to-train-your-own-decision-model) with a LoRA, trained to write the labeler's reason before picking A, B or C. That first checkpoint caught 49 of 80, and fine-tuning raised its AP from 0.061 to 0.238. The untrained decision model had already beaten the untrained Qwen3.5-4B it was built from, 23 catches to 17, so its decision pre-training helped before we trained on policies at all.

<figure class="article-figure">

![Step 1: the rule and the agent's reply go into the 4B decision model, with no earlier conversation](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/step1-reply-only.png)

<figcaption>Figure 8: Step 1. The model saw the rule and the reply, but not the conversation that led to it.</figcaption>

</figure>

The misses showed why both models stopped there. An LLM editor had written 92% of the training violations by deleting what the rule required, such as the phone number, the named team or the required question. Natural violations keep all of that and go wrong in one detail, such as helping on after the correct referral or asking the required question too late. Figure 9 shows one of each. On held-out businesses our models caught 94% of edited violations and 64% of natural ones, and up-weighting the 235 natural training violations three or six times didn't change that consistently. And 73 of the 80 test violations depend on what happened earlier in the conversation, which neither model could see.

<figure class="article-figure">

![An edited violation drops what the rule requires, while a natural one keeps it and breaks one detail](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/edited-vs-natural-violations.png)

<figcaption>Figure 9: An edited violation is missing what the rule requires; a natural one keeps it and breaks one detail. The replies are illustrative.</figcaption>

</figure>

If you are building a policy checker from synthetic data, measure it on violations your agent made on its own before you trust the validation score. Our validation set was balanced and mostly edited violations. Every decision model we trained scored 0.95 or higher on it in macro-F1, the average of the F1 scores for the three answers, while the same models caught anywhere from 49 to 67 of the 80 test violations.

### Step 2: Reading the Conversation Raised Catches From 51 to 65 of 80

We then released the full conversation behind every check in the dataset, 5,393 chats in all, and retrained with the earlier turns placed before the reply. Figure 10 is the same diagram as Figure 8 with one input added. The recipe, the data and the seed stayed the same, so any difference between the two runs comes from the extra context. For this comparison both runs answer without writing a reason, which is why the starting point is 51 and not 49.

<figure class="article-figure">

![Step 2: the earlier conversation is added as a new input to the same model](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/step2-with-conversation.png)

<figcaption>Figure 10: Step 2. The same model and recipe, with the earlier conversation added in front of the reply.</figcaption>

</figure>

With the conversation, the decision model caught **65 of 80**, up from 51, and its precision, the share of its flags that were violations, doubled from 10% to 22%. Most of the gain came from the 73 violations that need earlier turns, where catches rose from 46 to 59. AP rose by 15 points, with a 95% interval of 8 to 22 points. This was the largest gain of the sprint.

The encoder went the other way, as Figure 11 shows. With the conversation the 395M encoder caught 22, down from 38, and putting the reply first only brought it back to 25. Its new false alarms came from nearby topics. A rule about housekeeping visits fired when a customer asked about a cleaning charge, because a small encoder treats a related word anywhere in the chat as the trigger. The 4B model didn't make that mistake, so the released encoder reads the reply alone and the decision model handles context.

<figure class="article-figure">

![Catches with and without the conversation for the 4B model and the encoder](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/context-catches.png)

<figcaption>Figure 11: The conversation added 14 catches to the 4B model and cost the encoder 16.</figcaption>

</figure>

### Step 3: Adding DynaBench Dialogues Let a 4B Model Tie DynaGuard-8B on Its Own Benchmark

DynaBench comes from the DynaGuard paper. It has 543 hand-built chats, each with a list of rules (median 10, up to 92) that includes deliberate distractors, and a chat fails if any rule is broken. It tests whole dialogues against generic rules, which makes it a fair check on whether our training generalizes. We score it with F1 on failing chats, which balances how many failures a model finds against how many of its flags are right. Our untrained decision model scored F1 0.50, and the Step 1 checkpoint scored 0.79 without seeing a single DynaBench example.

The Step 2 model then fell to 0.53, because it had learned to judge one marked reply and DynaBench gives it a whole chat with nothing marked. Adding 6,000 DynaBench training dialogues per epoch, drawn from a balanced pool of 12,000, brought it back to 0.83 and made no significant difference on our own test (64 of 80 against 65). DynaBench pass chats don't say whether a rule was followed or didn't apply, so we trained those with a 50/50 target split between the two answers. Figure 12 shows how each epoch mixed the two sources. No training transcript overlaps with the DynaBench test set. DynaBench helped the decision model only as dialogue practice: pre-training the encoder on 124,000 DynaBench pairs lowered its AP on our test from 0.10 to 0.07, because most DynaBench rules are about style and format.

<figure class="article-figure">

![Each epoch mixed policy-nli checks with DynaBench dialogues](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/dynabench-mix.png)

<figcaption>Figure 12: Each training epoch mixed our 8,581 checks with 6,000 DynaBench dialogues.</figcaption>

</figure>

The release model scores F1 0.81 on DynaBench and DynaGuard-8B scores 0.82, a tie within noise, as Figure 13 shows. DynaGuard-8B is twice the size and was trained on all of DynaBench's training split, and DynaGuard-4B, the same size as Policy NLI, scores 0.71. On our test the ranking reverses sharply: Policy NLI catches 67 of 80, DynaGuard-8B catches 8 and DynaGuard-4B catches 7. Policy NLI matches the 8B guard on the guard's benchmark and catches 8x as many violations on ours.

<figure class="article-figure">

![DynaBench F1 against violations caught on the policy-nli test](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/dynabench-vs-policy-nli.png)

<figcaption>Figure 13: DynaBench F1 against violations caught on the policy-nli test.</figcaption>

</figure>

We also trained a variant on 2.5x the DynaBench data, 15,000 dialogues per epoch from a pool of 30,000. It reached F1 0.86 and beat DynaGuard-8B by 4.1 points (interval 0.4 to 7.7), but its macro-F1 on our test fell significantly, from 0.747 to 0.720. Business rules come first for us, so we didn't release it. Claude Haiku 5.5 and Claude Sonnet 5.5 still lead DynaBench at 0.89 and 0.88.

### Step 4: Training on the Labelers' Reasons Produced Policy NLI, Which Catches 67 of 80

The last step put everything together. Policy NLI reads the conversation, trains with the DynaBench dialogues, and learns to write the labeler's one-sentence reason before its answer. Every policy-nli check and DynaBench chat already came with a reason, so this step needed no new data. Figure 14 shows how one check became two training examples. Policy NLI catches **67 of 80** at 1% false alarms and 76 of 80 at 5%, with AP 0.40 (95% interval 0.31 to 0.52). Its macro-F1 across the three answers is 0.747, a significant 1.7 points above the same model trained without reasons. Against the Step 1 checkpoint, the three changes together added 18 catches and 17 points of AP.

<figure class="article-figure">

![One labeled check becomes a readout example and a rationale example](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/reasons-training.png)

<figcaption>Figure 14: Every check trained both the direct answer and the written reason.</figcaption>

</figure>

Policy NLI also beats Claude Sonnet 5.5 as an LLM judge. Sonnet's own default threshold flags 1.4% of clean checks, and at that rate Sonnet catches 43 while Policy NLI catches 69. Sonnet judged the reply alone, so part of the gap comes from input, but the Step 1 checkpoint also judged the reply alone and still beat Sonnet on AP, 0.24 against 0.13. On the 1,010 contested checks, where the labeling judge disagreed with itself, Policy NLI scores AP 0.27 against Sonnet's 0.25. Re-running Sonnet with the conversation would cost about \$100, and we list it as an open comparison.

The reasons are for the people reviewing flags, and the answer comes from the direct A/B/C choice. In the Step 1 checkpoint, reading the answer after the written reason ranked violations worse (AP 0.16 against 0.24), and a reason can disagree with the answer that follows it. If you train a model to explain itself, score both readouts before you pick one.

## What Policy NLI Catches and Where It Still Fails

Several of Policy NLI's catches depend entirely on the conversation. In one travel booking chat, a customer reported a suspected duplicate card charge, and the rule told the agent to stop handling the payment issue and direct them to the airline's payments team by email. The agent gave the email address, then kept advising the customer on how to describe the charge. The Step 1 checkpoint called the rule not applicable. Policy NLI flagged the violation and wrote that "although it gives the email, it continues handling the issue by advising how to describe the charge."

The same reply produced both a miss and a false alarm. A customer asked whether cancelling two days before arrival avoids a charge, and the rule required the agent to say that a cancellation at least 48 hours before arrival is free. The reply said so, then added that the customer must cancel before the 48-hour mark and not at it, which contradicts the rule. Policy NLI read the correct first sentence and called the rule followed. A second rule on that reply, "before helping with a cancellation, ask the customer to confirm the property name and arrival date," didn't apply, because the customer asked about charges and never asked for help cancelling. Policy NLI read the rule too broadly and flagged it.

Those two failures are the pattern in what remains. Policy NLI misses 13 of the 80 test violations at 1% false alarms, mostly replies that keep everything the rule requires and break it in one detail. Violations are rare, so most flags from any model are false alarms: at its default threshold Policy NLI's precision is 24%, about three clean checks for every violation it flags. A team deploying it should set the threshold on its own traffic.

**Our TLDR on this is that you should calibrate the model with your own policies and data before moving to production!**

## How to Train a Policy Violation Detection Model for Your Own Business

You may not need to train anything. Policy NLI was trained on 109 businesses and tested on two it never saw, so it may already cover your rules, and the weights, data, training code and logs are linked at the top of this post. What you do need is your own measurement, because a guardrail that looks fine on a balanced validation set can still miss most of the violations your agent actually makes.

The path we recommend has four parts: measure what you have, try Policy NLI as is, fine-tune it on your rules if it misses, and deploy it behind the encoder. Figure 15 shows the deployed setup, where the encoder screens every check and only the most suspicious 20% reach Policy NLI.

<figure class="article-figure">

![The two-stage setup: the encoder screens every check and sends its top 20% to Policy NLI](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/two-stage-pipeline.png)

<figcaption>Figure 15: The encoder screens every check, and Policy NLI judges the 20% it finds most suspicious.</figcaption>

</figure>

### Measure Your Current Guardrail on Violations Your Agent Made Itself

Collect replies your agent wrote on its own, label them against your rules at their natural rate, and score your guardrail by violations caught at a fixed false-alarm rate, such as 1%. Group the test by business or product line so it measures rules the model hasn't seen. On our data that test separated every model, while a balanced validation set of edited violations rated every decision model at 0.95 or higher.

Write every rule with its condition and its exceptions while you label, because a checker can only say a rule doesn't apply when the rule says when it applies. If your guardrail today is an off-the-shelf guard model, expect numbers like ours: none of the seven we tested caught more than 12 of 80.

### Serve Policy NLI With vLLM Before You Fine-Tune Anything

Policy NLI is a LoRA for [Mercity/decision-model-qwen3.5-4b](https://huggingface.co/Mercity/decision-model-qwen3.5-4b), and the bucket's serving recipe has tested vLLM commands. Serving it takes four steps:

1. Merge the adapter into the base model with the merge\_lora.py script in the model repo, because vLLM doesn't apply LoRA adapters to Qwen3.5's Gated DeltaNet layers.
2. Restrict the output to A, B and C and read their log-probabilities, so a check needs one token.
3. Turn on vLLM's prefix caching, so all of a reply's rules share one pass over the conversation.
4. Rank and alert on the violation score, the log-probability of B minus the log-sum-exp of A and C.

Use log-odds rather than probabilities: probabilities above 0.99999 all round to 1.0 in float32, which ties the most confident predictions, so every ranking in this post uses log-odds. If you run the encoder on a CPU, use the weight-only 8-bit or 4-bit ONNX builds. Standard int8 quantization broke it, dropping macro-F1 from 0.94 to 0.36, while weight-only 8-bit kept 100% agreement with the full model.

### Fine-Tune Policy NLI on Your Own Rules With Our Recipe

If Policy NLI misses your violations, fine-tune it on your labeled checks. Our recipe:

- **LoRA:** rank 32 and alpha 64 on the attention, MLP and Gated DeltaNet projections
- **Schedule:** a learning rate peaking at 2e-4 with a 3% warmup and cosine decay, for 2 epochs of steps of about 64,000 tokens
- **Loss:** the model's choice among the three letters, with their order shuffled for half the examples, plus the labeler's reason as a training target
- **Input order:** the conversation before the reply, since that was our largest gain

Mix in DynaBench dialogues, which are MIT-licensed. In our runs, 6,000 per epoch kept the model working on whole dialogues at no significant cost on our test, while 15,000 traded our test for DynaBench. The data change we would make next is to write violations that look compliant, keeping every element the rule requires and breaking it in one detail, because those are the violations our model still misses.

### Deploy It Behind the Encoder for \$4.84 per Million Checks

Running Policy NLI on every check costs about \$20 per million on one A100 at \$2 an hour. The two-stage setup in Figure 15 cuts that by three quarters with no loss on our test. The encoder scores every check for about \$0.84 per million and sends its top 20% onward, which catches the same 67 of 80 for **\$4.84 per million**. Sending only 10% costs \$2.84 and catches 62. We measured these costs on randomly sampled checks that share almost no conversation; in production every rule on one reply shares the same conversation, so prefix caching should bring the cost lower.

The setup is fast as well. The encoder takes 21 ms on a GPU and 220 ms on 16 CPU threads as a 0.4 GB 4-bit file, which agrees with the full-precision model on 97.7% of checks. Policy NLI needs a GPU, since it takes about 11 seconds per check on a CPU. Set the alert threshold and the routing share on a sample of your own traffic, and run the checker in shadow mode before it blocks anything.

<figure class="article-figure">

![Median time per check on GPU and CPU](/blog/how-we-trained-a-4b-nli-model-to-catch-policy-violations/speed-per-check.png)

<figcaption>Figure 16: Median time per check on GPU and CPU.</figcaption>

</figure>

If you want a policy checker trained on your own rules and conversations, [talk to us](/contact).
