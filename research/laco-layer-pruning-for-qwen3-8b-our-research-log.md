---
title: 'LaCo Layer Pruning for Qwen3-8B: Our Research Log'
slug: laco-layer-pruning-for-qwen3-8b-our-research-log
publishedAt: '2026-03-11'
summary: >-
  How we implemented LaCo layer pruning on Qwen3-8B-Base, compressing 36 layers
  to 30 with 16.7% size reduction while retaining 78–94% of reasoning
  capabilities — covering the paper-vs-implementation discrepancy,
  hyperparameter tuning, a critical "knowledge cliff" at 22% compression, and
  full benchmark results without post-training.
authors:
  - name: Juhi
tags:
  - Distillation
  - Model Compression
category: Research
isTopPick: false
image: >-
  https://blog-cdn.mercity.ai/blog/laco-layer-pruning-for-qwen3-8b-our-research-log/image.jpg
---


Large language models continue to grow in capability and size. Models like [Qwen3-8B](https://huggingface.co/Qwen/Qwen3-8B-Base), [Llama-3](https://huggingface.co/meta-llama), [Mistral](https://huggingface.co/mistralai), and others deliver impressive performance across reasoning and knowledge benchmarks, but their billions of parameters create significant deployment challenges. These models demand substantial memory, introduce inference latency, and drive up infrastructure costs. The challenge is universal across the industry: how do we make these powerful models more accessible without sacrificing their capabilities? Structured pruning offers a promising path to smaller, faster models, if we can preserve the capabilities that matter.

[LaCo (Layer Collapse)](https://arxiv.org/abs/2402.11187) presents a compelling approach to structured pruning that caught our attention. Rather than removing individual weights or attention heads, LaCo removes entire transformer layers by identifying and merging layers with similar representations. The method promises significant compression with minimal quality degradation, achieving up to 27% layer reduction on Llama models while maintaining benchmark performance. We set out to implement LaCo for Qwen3-8B-Base and document everything we learned along the way.

This guide documents our complete implementation journey. With surprising and interesting findings.

We cover the surprising gap between the paper's description and the official implementation, the hyperparameter decisions that determined success or failure, and the benchmark results that reveal what layer pruning actually preserves and what it destroys. **All results presented here reflect raw pruning performance without any post-training.** This establishes a baseline for future fine-tuning work and gives an honest picture of what layer pruning alone can achieve.

![**Qwen3-8B Layer Compression Architecture.** LaCo identifies layers with similar hidden state representations and merges them iteratively. Starting from layer 25, three merge operations collapse layers L21-L27 into a single layer, removing 6 layers total. Early layers (L0-L3) and upper layers (L28-L35) are protected from pruning. The final 30-layer model achieves 16.7% compression with a perplexity ratio of 1.68x, retaining 78-94% of reasoning capabilities.](https://blog-cdn.mercity.ai/blog/laco-layer-pruning-for-qwen3-8b-our-research-log/image.jpg)

**Qwen3-8B Layer Compression Architecture.** LaCo identifies layers with similar hidden state representations and merges them iteratively. Starting from layer 25, three merge operations collapse layers L21-L27 into a single layer, removing 6 layers total. Early layers (L0-L3) and upper layers (L28-L35) are protected from pruning. The final 30-layer model achieves 16.7% compression with a perplexity ratio of 1.68x, retaining 78-94% of reasoning capabilities.

We have released both our [implementation code](https://github.com/Mercity-AI/LACO-Compression) and the [pruned model weights on Hugging Face](https://huggingface.co/Mercity/Qwen3-8B-LaCo-30L) for the community to build upon, experiment with, and extend.

## Understanding LaCo: The Paper's Approach

Transformer models stack multiple layers that process representations sequentially. Each layer receives hidden states from the previous layer, applies attention and feed-forward transformations, and passes the result to the next layer. The fundamental insight behind LaCo is that not all of these layers contribute equally. Adjacent transformer layers often learn surprisingly similar representations. When two consecutive layers produce nearly identical outputs for a given input, one of them may be redundant. LaCo identifies these redundant layers through hidden state similarity analysis and merges them into a single layer, reducing the total layer count without dramatically altering the model's behavior.

The paper introduces **RDSC (Reserving-Differences-while-Seeking-Common)** as the core merging strategy. The name captures the intended behavior: when merging multiple layers, we want to preserve what they have in common while retaining their aggregate differences from the base layer. Given a base layer and several subsequent layers to merge, RDSC theoretically computes a weighted combination that averages the weight differences across all layers being merged:

```
merged_weight = base_weight + mean(layer_i_weight - base_weight for i in layers_to_merge)
```

![**RDSC Layer Merge Mechanism.** (a) Parameter differencing (Reserving-Differences) computes the delta between consecutive layers. (b) Parameter merging (Seeking-Common) combines these differences into a single merged layer. *Source: [LaCo: Large Language Model Pruning via Layer Collapse](https://arxiv.org/abs/2402.11187) (Yang et al., 2024)*](https://blog-cdn.mercity.ai/blog/laco-layer-pruning-for-qwen3-8b-our-research-log/image-1.jpg)

**RDSC Layer Merge Mechanism.** (a) Parameter differencing (Reserving-Differences) computes the delta between consecutive layers. (b) Parameter merging (Seeking-Common) combines these differences into a single merged layer. *Source: [LaCo: Large Language Model Pruning via Layer Collapse](https://arxiv.org/abs/2402.11187) (Yang et al., 2024)*

The intuition behind this formula is that each layer's weights can be decomposed into a "common" component (shared across similar layers) and a "difference" component (unique to that layer). By averaging the differences, RDSC aims to produce a merged layer that captures the essential transformation performed by the entire sequence of layers. The merged layer should behave similarly to the original sequence, producing comparable hidden states for the same inputs while using only a single set of weights.

The algorithm proceeds iteratively through the model:

1. Start from a high layer index (near the output)
2. Attempt to merge C consecutive layers into one
3. Compute hidden state similarity between the original model and the merged candidate
4. If similarity exceeds threshold T, accept the merge; otherwise, move down one layer
5. Repeat until reaching the minimum layer index or the compression target

![**Layer Collapse Illustration.** The iterative pruning process identifies and merges layers with similar hidden state representations, progressively reducing the total layer count while preserving model functionality. *Source: [LaCo: Large Language Model Pruning via Layer Collapse](https://arxiv.org/abs/2402.11187) (Yang et al., 2024)*](https://blog-cdn.mercity.ai/blog/laco-layer-pruning-for-qwen3-8b-our-research-log/image-2.jpg)

**Layer Collapse Illustration.** The iterative pruning process identifies and merges layers with similar hidden state representations, progressively reducing the total layer count while preserving model functionality. *Source: [LaCo: Large Language Model Pruning via Layer Collapse](https://arxiv.org/abs/2402.11187) (Yang et al., 2024)*

The paper reports results on Llama2-7B and Llama2-13B, achieving roughly 25% layer reduction with perplexity ratios around 1.5-2x. Benchmark retention varies by task type, with reasoning tasks generally preserving better than knowledge-intensive tasks. These promising results motivated us to adapt the method for Qwen3-8B.

## Paper vs. Implementation: The Averaging Discrepancy

When we examined the official LaCo implementation, we found a significant deviation from the paper's description. The code does not average weights across merged layers. Instead, it performs what we call "telescoping"—the base layer simply absorbs the weights of the final layer in the merge sequence.

Here is the relevant section from the official implementation:

```python
for diff_lay in range(merge_base_lay+1, merge_base_lay+1+merge_layer_num):
    # gate_proj
    model_copy.model.layers[merge_base_lay].mlp.gate_proj.weight.data.add_(
        model.model.layers[diff_lay].mlp.gate_proj.weight.data -
        model_copy.model.layers[merge_base_lay].mlp.gate_proj.weight.data
    )

```

This operation adds `(diff_weight - base_weight)` to the base weight. When applied iteratively across multiple layers, the mathematics work out such that `base_weight` simply becomes equal to the last `diff_weight` in the sequence. There is no averaging whatsoever. The base layer ends up with exactly the weights of the final merged layer, and the intermediate layers' weights are effectively discarded.

**We tested both approaches.** The averaging approach described in the paper consistently produced gibberish outputs. The model would generate incoherent text, sometimes mixing languages randomly, with no semantic consistency. Perplexity measurements confirmed what we observed qualitatively: the averaged models were fundamentally broken.

The telescoping approach works because it preserves trained weights. Neural network weights exist in a complex, high-dimensional space where linear interpolation does not preserve functionality. Averaging the weights of layers 10, 11, and 12 produces a weight matrix that the model has never encountered during training. These averaged weights may fall completely outside the manifold of "valid" layer behaviors, producing unpredictable outputs. The telescoping approach avoids this problem entirely. The merged layer uses weights that actually existed in the original model, specifically the weights from the last layer in the merge sequence. These weights were trained together with the rest of the network. The model knows how to process representations produced by these weights because it already did so during training.

![](https://blog-cdn.mercity.ai/blog/laco-layer-pruning-for-qwen3-8b-our-research-log/image-3.jpg)

![](https://blog-cdn.mercity.ai/blog/laco-layer-pruning-for-qwen3-8b-our-research-log/image-4.jpg)

***Weight Merging: Averaging vs Telescoping.** The paper describes averaging weight differences (left), but the official implementation uses telescoping (right), where the merged layer simply inherits the final layer's weights. We tested both: averaging produced gibberish, telescoping preserved coherent output*s.

There is also a theoretical justification for why telescoping makes sense in the context of LaCo. The entire premise of LaCo is that we are merging layers whose hidden state representations are *similar*. If layers 10, 11, and 12 produce nearly identical hidden states for the same input, then replacing all three with just layer 12's weights should preserve the model's behavior. The similarity threshold ensures we only merge layers that truly are redundant. The information is retained because the layers being compressed were producing similar hidden states in the first place.

We adopted the official implementation's telescoping approach after our testing confirmed it was the only viable option. The averaging formula in the paper, while theoretically motivated, does not produce usable models in practice.

## Adapting LaCo for Qwen3-8B

The original LaCo implementation targets the Llama model family. Adapting it for Qwen3-8B required understanding the architectural differences between these model families and modifying our implementation accordingly. While both are decoder-only transformers following similar design principles, the details matter significantly when manipulating model internals.

[Qwen3-8B-Base](https://huggingface.co/Qwen/Qwen3-8B-Base) differs from Llama2 in several architectural details. The model has 36 transformer layers compared to Llama2-7B's 32. It uses Grouped Query Attention (GQA) with 32 query heads and 8 key-value heads, reducing memory bandwidth requirements during inference. The vocabulary size is substantially larger at 151,669 tokens, reflecting Qwen's multilingual capabilities. These differences required careful adaptation of our pruning logic.

**Layer Access Patterns**: Qwen3 uses `model.model.layers` for the transformer stack, matching Llama's structure. The attention projections (`q_proj`, `k_proj`, `v_proj`, `o_proj`) and MLP components (`gate_proj`, `up_proj`, `down_proj`) follow the same naming conventions. This fortunate consistency made the core merging logic directly portable without major restructuring.

**LayerNorm Handling**: We initially attempted to merge LayerNorm parameters (`input_layernorm`, `post_attention_layernorm`) alongside the attention and MLP weights. This produced catastrophic results. The merged models generated complete gibberish, often switching between languages mid-sentence or producing entirely nonsensical token sequences. LayerNorms have far fewer parameters than attention or MLP weights, but their learned statistics are closely tied to each specific layer's activation distribution. When we stopped merging LayerNorms and left them unchanged during the layer collapse, the outputs became coherent again. The official implementation also skips LayerNorm merging, validating our finding.

**Configuration Updates**: After pruning, we update `model.config.num_hidden_layers` to reflect the actual layer count. Qwen3 also has a `layer_types` configuration attribute that must be truncated to match the pruned architecture. Failing to update these configuration values causes inference errors when the model tries to access layers that no longer exist.

**Memory Management with state_dict**: The official LaCo implementation uses deep copying to create candidate models for testing potential merges. For an 8B parameter model, this approach is prohibitively expensive in terms of memory and time. We developed a more efficient approach using `state_dict` operations.

We maintain three model instances during pruning:

- **Original model** (on CPU): Stays completely untouched throughout pruning. Used as the reference for similarity comparisons.
- **Working model** (on GPU): Accumulates accepted merges. Represents the current best pruned state.
- **Candidate model** (on GPU): Tests potential merges before they are accepted.

Rather than deep copying entire models, we sync weights between models using `state_dict`:

```python
# Sync candidate model to working model state before testing a new merge
candidate_model.load_state_dict(working_model.state_dict())

# Apply the proposed merge to candidate model
apply_merge(candidate_model, merge_layers)

# Test similarity against original
similarity = compute_similarity(original_model, candidate_model, calibration_data)

if similarity >= threshold:
    # Accept: sync working model to candidate state
    working_model.load_state_dict(candidate_model.state_dict())
    # Remove the merged layers from working model
    remove_layers(working_model, merged_layer_indices)
else:
    # Reject: candidate model will be reset on next iteration
    pass

```

This approach dramatically reduces memory usage since we never need to allocate memory for additional full model copies. The `state_dict` operations are fast tensor copies rather than full object instantiation. When a merge is accepted, we sync the working model to the candidate's state and then physically remove the merged layers from the working model's layer list. When a merge is rejected, the candidate model simply gets overwritten with the working model's state on the next iteration.

## Hyperparameter Exploration

LaCo's behavior depends critically on several hyperparameters. We systematically explored each one, often learning through failure what the paper's recommendations did not convey. The interaction between these parameters determines both the compression achieved and the quality retained.

### HIGHEST_LAY (H): Where Pruning Begins

The paper sets H equal to the total layer count minus one. For Llama2-7B with 32 layers, H=31. Following this pattern, we initially set H=35 for Qwen3-8B's 36 layers.

This produced poor results. Merges near the output layers consistently failed the similarity threshold, and the few that passed degraded model quality significantly. The upper layers of a transformer perform different functions than middle layers. They aggregate and refine representations for the final prediction, transforming internal representations into output token probabilities. Disturbing these layers disrupts the model's ability to produce coherent outputs.

We progressively lowered H and found that **H=28** provided the best tradeoff. Layers 29-35 remain untouched, preserving the output transformation pipeline. Pruning focuses on the middle layers (4-28) where representations are more uniform and redundancy is higher.

### THRESHOLD (T): Quality vs. Compression

The paper uses T=0.65 for Llama2-7B. We started with this value and achieved high compression, but benchmark results were catastrophic. The pruned model performed near random chance on knowledge-intensive tasks.

The threshold controls the minimum acceptable cosine similarity between the original model's hidden states and the pruned candidate's hidden states. A lower threshold accepts more merges (higher compression) but permits greater representation drift. A higher threshold rejects more merges (lower compression) but maintains fidelity to the original model.

We incrementally raised the threshold:

- **T=0.65**: High compression, severe quality loss. MMLU collapsed to random chance.
- **T=0.75**: Moderate compression, significant quality loss. Still unusable for knowledge tasks.
- **T=0.85**: Conservative compression, acceptable quality retention. This became our final choice.

At **T=0.85**, the pruning algorithm becomes selective. Only layer sequences with genuinely similar representations pass the threshold. This reduces compression from the paper's ~27% to more conservative levels, but the retained model capabilities justify the tradeoff.

### MERGE_LAYERS (C): Merge Granularity

C controls how many layers are merged in each operation. Higher C means more aggressive pruning per step but coarser control. Lower C means more iterations but finer-grained decisions about which specific layers to merge.

We tested C=2, C=3, and C=4:

- **C=2**: Merges pairs of layers. More iterations required, but finer control over which layers get merged.
- **C=3**: Merges triplets. Good balance between speed and control. This became our final choice.
- **C=4**: Paper's recommendation for Llama. Too aggressive for our threshold; most merges were rejected, making progress very slow.

Our final configuration uses **C=3** as the best balance between compression efficiency and quality preservation.

### MAX_COMPRESSION_PERCENT: The Primary Control

While the paper emphasizes LOWEST_LAY (L) as a hyperparameter, we found that **MAX_COMPRESSION_PERCENT** was the more practical control for tuning the pruning outcome. LOWEST_LAY sets the minimum layer index for merging (we used L=4 to protect embedding-adjacent layers), but it functions more as a safety boundary than a tuning parameter.

The real tuning happens through the maximum compression percentage. By testing different compression targets, we discovered the optimal balance:

| Max Compression | Resulting Layers | Actual Compression | MMLU | Reasoning Retention |
| --- | --- | --- | --- | --- |
| 30% | 26 | 27.8% | 25.12% (random) | 62-83% |
| 25% | 28 | 22.2% | 25.89% (random) | 70-87% |
| 20% | 30 | 16.7% | 31.30% (above random) | 79-94% |

This systematic exploration revealed the critical finding: **there is a "knowledge cliff" between 16.7% and 22.2% compression.** Beyond 22% compression, factual knowledge (measured by MMLU) collapses to random chance. At 16.7% compression, partial knowledge retention survives. This led us to our final 30-layer configuration.

### INTERVAL (I): Merge Spacing

After a successful merge, I controls how many layers to skip before attempting the next merge. The paper uses I=2, meaning after merging at layer L, the next attempt starts at layer L-2.

We kept **I=2**. Lower values (I=1) risk overlapping merge regions that compound representation errors. Higher values (I=3+) leave potential redundancy on the table. The paper's recommendation proved appropriate for our use case.

### Perplexity as a Sanity Check

Throughout our hyperparameter exploration, we monitored perplexity as a quick sanity check. Perplexity measures how well the model predicts held-out text, with lower values indicating better predictions. We computed perplexity using a set of 503 sentences, comparable to the paper's calibration set of 500 sentences. For pruned models, we track the **perplexity ratio** relative to the original model.

Our configurations achieved the following perplexity ratios:

| Configuration | Layers | Compression | Perplexity Ratio |
| --- | --- | --- | --- |
| 26 layers | 26 | 27.8% | 2.73x |
| 28 layers | 28 | 22.2% | 2.01x |
| 30 layers | 30 | 16.7% | 1.68x |

## Similarity Calculation: The Core Metric

LaCo's merge decisions depend entirely on hidden state similarity between the original and candidate models. The fundamental question: does the pruned model produce internal representations similar to the original for identical inputs? Similar representations imply preserved downstream behavior; significant divergence indicates damaged computation. This metric determines merge acceptance and explains why threshold selection is critical.

For each calibration sentence, we perform the following comparison:

1. Run the original model on the input, extract the final layer's hidden state
2. Run the candidate (pruned) model on the same input, extract the final layer's hidden state
3. Flatten both tensors into vectors and compute cosine similarity
4. Average similarity across all calibration sentences

```python
def cal_last_hidden_sim(original_model, candidate_model, tokenizer, sents):
    sim_ls = []
    for s in sents:
        inputs = tokenizer(s, return_tensors="pt").to(original_model.device)

        # Get hidden states from both models
        with torch.no_grad():
            hidden_original = original_model(**inputs, output_hidden_states=True).hidden_states[-1]
            hidden_candidate = candidate_model(**inputs, output_hidden_states=True).hidden_states[-1]

        # Flatten and compute cosine similarity
        h1 = hidden_original.squeeze(0).flatten().unsqueeze(0)
        h2 = hidden_candidate.squeeze(0).flatten().unsqueeze(0)
        sim = torch.cosine_similarity(h1, h2, dim=1)
        sim_ls.append(sim.item())

    return np.mean(sim_ls), sim_ls

```

The flattening step deserves attention. Rather than computing per-token similarities and aggregating, we flatten the entire sequence into a single vector. This captures global representation alignment: whether the pruned model produces a similar "summary" of the input, even if individual token representations shift slightly. 

Our calibration set consists of 10 diverse sentences covering factual knowledge, scientific concepts, and general information. The paper recommends 10 sentences as sufficient for stable similarity estimates. Larger calibration sets increase computation time for each merge decision without substantially improving decision quality. 

## Results: What Layer Pruning Preserves and Destroys

We evaluated three configurations with progressively conservative settings. The results reveal both a striking pattern in what layer pruning preserves and a critical "knowledge cliff" between compression levels.

**Note:** All benchmarks below are evaluated **without any post-training or fine-tuning**. These results represent raw performance after pruning only. Post-training is expected to improve these scores, particularly on knowledge-intensive tasks like MMLU.

### Configuration Comparison

We evaluated three configurations with progressively conservative settings:

| Configuration | Layers | Compression | Threshold | Merge Layers (C) |
| --- | --- | --- | --- | --- |
| Aggressive | 26 | 27.8% | 0.85 | 3 |
| Moderate | 28 | 22.2% | 0.85 | 3 |
| **Conservative (Final)** | **30** | **16.7%** | **0.85** | **3** |

### Full Benchmark Results Across All Configurations

| Benchmark | Original | 30L (16.7%) | 28L (22.2%) | 26L (27.8%) |
| --- | --- | --- | --- | --- |
| **PIQA** (acc_norm) | 79.54% | 71.38% | 69.21% | 65.67% |
| **WinoGrande** | 67.0% | 62.83% | 55.64% | 52.41% |
| **ARC-Challenge** (acc_norm) | 42.0% | 36.09% | 32.00% | 29.18% |
| **ARC-Easy** (acc_norm) | 72.0% | 58.04% | 52.65% | 49.33% |
| **HellaSwag** (acc_norm) | 78.55% | 61.98% | 55.52% | 48.52% |
| **BoolQ** | 83.09% | 64.95% | 62.23% | 61.77% |
| **MMLU** (5-shot) | 76.89% | 31.30% | 25.89% | 25.12% |

*Original scores from [Qwen3 Technical Report](https://arxiv.org/abs/2505.09388)*

![**Benchmark Comparison Across Compression Levels.** The 30-layer model (16.7% compression) retains 78-94% of reasoning capabilities. MMLU collapses to random chance (~25%) beyond 16.7% compression, revealing a critical "knowledge cliff" where factual knowledge is catastrophically lost.](https://blog-cdn.mercity.ai/blog/laco-layer-pruning-for-qwen3-8b-our-research-log/image-5.jpg)

**Benchmark Comparison Across Compression Levels.** The 30-layer model (16.7% compression) retains 78-94% of reasoning capabilities. MMLU collapses to random chance (~25%) beyond 16.7% compression, revealing a critical "knowledge cliff" where factual knowledge is catastrophically lost.

### Retention Rates: The 30-Layer Advantage

| Benchmark | 30L (16.7%) | 28L (22.2%) | 26L (27.8%) | 30L Improvement over 28L |
| --- | --- | --- | --- | --- |
| **PIQA** | 89.7% | 87.0% | 82.6% | +2.7% |
| **WinoGrande** | 93.8% | 83.0% | 78.2% | **+10.8%** |
| **ARC-Challenge** | 85.9% | 76.2% | 69.5% | +9.7% |
| **ARC-Easy** | 80.6% | 73.1% | 68.5% | +7.5% |
| **HellaSwag** | 78.9% | 70.7% | 61.8% | +8.2% |
| **BoolQ** | 78.2% | 74.9% | 74.3% | +3.3% |
| **MMLU** | 40.7% | 33.7% | 32.7% | +7.0% |

The 30-layer model shows consistent improvements across every single benchmark compared to more aggressive pruning. **WinoGrande retention jumps from 83% to 93.8%**, a remarkable 10.8 percentage point improvement for just 5.5% less compression. This demonstrates that the relationship between compression and quality is highly non-linear. Small reductions in compression can yield disproportionately large quality improvements.

### The Knowledge Cliff

The most significant finding from our experiments is the behavior of MMLU across compression levels:

| Compression | Layers | MMLU Score | Above Random (25%) | Status |
| --- | --- | --- | --- | --- |
| **16.7%** | 30 | 31.30% | **+6.30%** | Partial retention |
| 22.2% | 28 | 25.89% | +0.89% | Random chance |
| 27.8% | 26 | 25.12% | +0.12% | Random chance |

![**MMLU Performance vs Compression Level.** MMLU accuracy remains meaningfully above random chance at 16.7% compression (31.3%), but collapses sharply to near-random performance (~25%) beyond 22.2% compression. ](https://blog-cdn.mercity.ai/blog/laco-layer-pruning-for-qwen3-8b-our-research-log/image-6.jpg)

**MMLU Performance vs Compression Level.** MMLU accuracy remains meaningfully above random chance at 16.7% compression (31.3%), but collapses sharply to near-random performance (~25%) beyond 22.2% compression. 

Between 16.7% and 22.2% compression, **MMLU collapses from partial retention (31.30%) to random chance (25.89%).** This is not gradual degradation. It is a cliff. The additional 2 layers removed when going from 30 to 28 layers eliminate whatever factual knowledge encoding survived the initial pruning. 

This pattern does not appear in reasoning benchmarks. PIQA drops smoothly from 89.7% to 87.0% to 82.6% as compression increases. HellaSwag similarly degrades gradually. The knowledge cliff is specific to factual recall capabilities.

### Perplexity vs. Benchmarks: A Cautionary Tale

Our perplexity measurements told a misleading story:

| Configuration | Perplexity Ratio | MMLU Score |
| --- | --- | --- |
| 28 layers | 2.01x | 25.89% (random) |
| 26 layers | 2.73x | 25.12% (random) |

A 2.01x perplexity ratio for the 28-layer model looks acceptable. The model still predicts common tokens reasonably well. But MMLU collapsed to random chance. **Perplexity is dominated by easy, frequent tokens like "the", "is", and "and".** Benchmarks specifically target the hard predictions that require actual understanding or knowledge. This reinforces why task-specific evaluation is essential when assessing pruned models.

### Why Reasoning Survives and Knowledge Dies

Transformer layers serve different functions at different depths. Early layers extract features and build initial representations from the raw token embeddings. Middle layers perform reasoning operations: combining information, drawing inferences, and processing relationships between concepts. Upper layers aggregate and prepare outputs for the final prediction, transforming internal representations into token probabilities.

Our pruning targets middle layers (4-28). These layers apparently contain much of the model's factual knowledge: the weights that encode information like "Paris is the capital of France" or "mitochondria generate ATP." Removing these layers removes the knowledge.

Reasoning capabilities appear more distributed across the network. The ability to understand physical relationships (PIQA) or complete sentences coherently (HellaSwag) relies on patterns spread across many layers. Removing some middle layers degrades these capabilities but does not eliminate them. The remaining layers can still perform approximate versions of these reasoning operations.

The 30-layer configuration finds the boundary. Enough layers remain to preserve some factual knowledge, while still achieving meaningful compression. Push beyond this point, and knowledge collapses entirely while reasoning degrades only modestly.

## Lessons Learned

Several insights emerged from this implementation that the paper does not emphasize. These lessons may save others significant time when implementing layer pruning for their own models.

- **Perplexity is necessary but not sufficient.** A reasonable perplexity ratio (< 3x) indicates the model still produces fluent text. It does not indicate the model retains specific capabilities. Our 28-layer model had a reasonable 2.01x perplexity ratio but completely failed MMLU. Always evaluate on task-specific benchmarks that matter for your use case.
- **Upper layers are sacred, but the specific layers differ by architecture.** The paper treats all layers as roughly equivalent candidates for pruning. In practice, layers near the output perform critical functions that do not survive merging. For Qwen3-8B, we found that protecting layers 29-35 (the top 20% of layers) prevented severe degradation. Other architectures may have different critical regions. Llama models may tolerate pruning closer to the output, while other architectures may require protecting even more layers. This requires empirical testing for each model family.
- **Threshold determines quality, not compression.** It is tempting to lower the threshold to achieve a compression target. This produces unusable models. The threshold is not a tuning parameter for compression targets. It is a quality floor. Set it high enough to preserve functionality (we used T=0.85), then accept whatever compression results. Use MAX_COMPRESSION_PERCENT to control the stopping point if needed.
- **The paper describes averaging; the implementation does telescoping.** This discrepancy matters enormously. We wasted significant time trying to make averaging work before discovering it simply does not. Weight averaging produces novel weight combinations that degrade performance catastrophically. Telescoping preserves trained weights. Follow the implementation, not the paper's mathematical description.
- **LayerNorm merging breaks everything.** The official implementation does not merge LayerNorm parameters, and neither should you. Our attempts to merge LayerNorms produced gibberish outputs, sometimes in multiple languages simultaneously. LayerNorm statistics are tightly coupled to each layer's activation distribution. Leave them alone.
- **There is a knowledge cliff.** Factual knowledge does not degrade linearly with compression. It survives until a critical threshold, then collapses entirely. For Qwen3-8B, this cliff lies between 16.7% and 22.2% compression. Finding this boundary requires empirical testing because similarity metrics do not predict it. The merged layers may have high hidden state similarity while encoding completely different factual information.
- **Conservative pruning pays dividends.** The jump from 28 to 30 layers (only 5.5% less compression) improved WinoGrande retention by 10.8 percentage points and kept MMLU above random chance. The marginal additional compression from aggressive pruning is rarely worth the capability loss. Err on the side of less compression.

---

## Future Work: Recovery Through Post-Training

All results presented in this guide reflect raw pruning performance. We have not performed any post-training on the pruned model. This establishes a baseline but likely underestimates the method's practical utility for production deployments. The pruned model serves as an excellent starting point for further optimization.

Post-training can recover lost capabilities through several mechanisms, each with different tradeoffs in terms of compute requirements, data needs, and expected recovery:

- **LoRA Fine-tuning** is our recommended first approach. Low-rank adaptation adds small trainable adapters without modifying base weights, requiring only a single GPU for a few hours. Training on knowledge-rich datasets like [OpenOrca](https://huggingface.co/datasets/Open-Orca/OpenOrca) or [Alpaca](https://huggingface.co/datasets/tatsu-lab/alpaca) can restore factual knowledge lost during pruning. Literature suggests LoRA typically recovers 30-50% of lost performance on knowledge benchmark

```python
from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=32,
    lora_alpha=64,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_dropout=0.05,
)
model = get_peft_model(pruned_model, lora_config)
# Fine-tune on knowledge-rich dataset

```

- **Knowledge Distillation** uses the original Qwen3-8B-Base as a teacher, with the pruned model learning to mimic teacher outputs across a large corpus. The student learns full probability distributions over tokens, capturing nuanced concept relationships without requiring labeled data. More compute-intensive than LoRA, but achieves stronger recovery for severely degraded capabilities.
- **Continued Pre-training** takes the most resources but achieves the deepest recovery. Additional pretraining on general text corpora helps the model relearn statistical patterns disrupted by layer removal. Requires significant compute (potentially GPU-weeks) but can recover capabilities that fine-tuning alone cannot. Best suited when the pruned model will be deployed at scale, amortizing pretraining cost across many inference requests.

Based on the literature on post-training for compressed models, we expect our pruned model at 31.30% MMLU could reach 45-55% after LoRA fine-tuning. Reasoning benchmarks, already at 78-94% retention, would likely improve to near-original levels with minimal fine-tuning. The pruned architecture is sound; it simply needs to relearn some of the specific knowledge that was encoded in the removed layers.

---

## Final Configuration and Model Release

Based on our extensive experiments, we release the 30-layer model as the optimal tradeoff between compression and capability retention. This configuration preserves strong reasoning capabilities while achieving meaningful size reduction.

### Pruning Configuration

| Parameter | Value | Description |
| --- | --- | --- |
| MERGE_LAYERS (C) | 3 | Layers merged per operation |
| LOWEST_LAY (L) | 4 | Minimum layer index for merging |
| HIGHEST_LAY (H) | 28 | Maximum layer index for merging |
| INTERVAL (I) | 2 | Minimum gap between merge points |
| THRESHOLD (T) | 0.85 | Cosine similarity threshold |
| MAX_COMPRESSION | 20% | Maximum allowed compression |

### Pruning Results

| Metric | Value |
| --- | --- |
| Original Layers | 36 |
| Final Layers | 30 |
| Layers Removed | 6 |
| Compression | 16.7% |
| Successful Merges | 3 |
| Rejected Merges | 0 |

### Model Availability

The pruned model is available on Hugging Face: [Mercity/Qwen3-8B-LaCo-30L](https://huggingface.co/Mercity/Qwen3-8B-LaCo-30L)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained(
    "Mercity/Qwen3-8B-LaCo-30L",
    torch_dtype="auto",
    device_map="auto",
    trust_remote_code=True
)
tokenizer = AutoTokenizer.from_pretrained(
    "Mercity/Qwen3-8B-LaCo-30L",
    trust_remote_code=True
)

```

## Conclusion

LaCo layer pruning offers a viable path to compressing large language models, but the tradeoffs are more nuanced than the original paper suggests. Our implementation achieves **16.7% compression** on Qwen3-8B-Base while retaining **78-94% of reasoning capabilities**. Factual knowledge degrades to 40.7% of original performance, which is damaged but notably still above random chance.

The critical finding is the **knowledge cliff** between 16.7% and 22.2% compression. More aggressive pruning (22%+) causes MMLU to collapse to random chance, while the 30-layer configuration preserves partial knowledge retention. This boundary would not be apparent from perplexity metrics or hidden state similarity alone. It requires task-specific benchmark evaluation to discover.

The method is best understood as a **pre-processing step before fine-tuning**, not a standalone compression technique. A pruned model benefits significantly from post-training to recover lost capabilities before deployment. For applications prioritizing inference efficiency over knowledge-intensive tasks, or applications that will fine-tune on domain-specific data anyway, LaCo provides meaningful compression with acceptable quality tradeoffs.

Our [implementation code](https://github.com/Mercity-AI/LACO-Compression) and [pruned model weights](https://huggingface.co/Mercity/Qwen3-8B-LaCo-30L) are available for further experimentation and post-training research. We encourage the community to build on this work, particularly exploring post-training strategies to recover the lost factual knowledge while maintaining the efficiency gains from layer pruning.
