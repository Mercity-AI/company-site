---
title: 'LCM-LoRA Distillation: Training Fast Diffusion Models'
slug: lcm-lora-distillation-training-fast-diffusion-models
publishedAt: '2026-02-07'
summary: >-
  A practical report on training LCM-LoRA adapters for Stable Diffusion 1.5 to
  reduce generation from 25-50 denoising steps to 4-6 steps, leading to massive
  cost and time savings  with quality trade-offs, setup details, and evaluation
  results.
authors:
  - name: Juhi Singh
tags: []
category: Diffusion Models
image: >-
  https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/Screenshot_2025-12-03_at_2.00.16_PM.jpg

---

If you've worked with Stable Diffusion, you've experienced the waiting game. Generating a high-quality image with SD1.5 requires 25–50 denoising steps—15–25 seconds on consumer hardware. That's too slow for iterating on prompts or building applications that need real-time responsiveness.

Faster generation matters across many use cases. Designers iterating on concepts can't wait 20 seconds per variation—at 4 steps, you can explore 10 ideas in the time one used to take. Real-time applications like chatbots with image generation, live streaming overlays, and game asset generation during gameplay all need sub-5-second latency. And for batch generation at scale, the economics are compelling: 10,000 images at 50 steps costs roughly 70 GPU hours; at 4 steps, about 6 GPU hours—a 10× reduction in compute costs.

We trained a family of Latent Consistency Model (LCM) LoRA adapters that generate comparable quality in just 4–6 steps—approximately 10× faster. The key insight behind LCMs: instead of learning the entire diffusion process from scratch, we distill knowledge from a teacher model into a lightweight adapter that learns to "skip ahead" in the denoising trajectory. The LoRA parameterization keeps our adapters around 100MB rather than multi-gigabyte checkpoint files—easy to distribute, quick to load, simple to swap between applications.

This report is written for ML practitioners who want to train their own LCM adapters—whether for custom base models, specialized domains, or simply to understand the process deeply. We assume familiarity with diffusion models and PyTorch, but explain LCM-specific concepts as they arise. Hobbyists looking to use (rather than train) LCM-LoRA can skip to the Results section. We share not just what worked, but the decisions and trade-offs we encountered along the way.

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image.jpg)

---

## Training Data: LAION-Aesthetics

When training a model to generate aesthetically pleasing images quickly, the quality of training data matters enormously. We chose [**LAION-Aesthetics V2 6.5+**](https://dagshub.com/datasets/laion-aesthetics-v2-6-5/) for several compelling reasons.

First, the dataset has been pre-filtered for visual quality. Every image in this subset has an aesthetic score of 6.5 or higher, meaning the neural network that scored these images consistently rated them as visually appealing. Training on aesthetically curated data means our model learns to reproduce the characteristics of high-quality images from the start, rather than averaging across a mixed-quality distribution.

Second, this dataset was used in the original Stable Diffusion training, which creates an interesting alignment property. Our teacher model (SD1.5) was trained on data from this distribution, so when we distill from it, we're working within a domain the teacher already understands well. This alignment tends to produce more stable training dynamics.

We downloaded 25,000 image-caption pairs from the LAION-Aesthetics V2 6.5+ dataset via the DagsHub repository (DagsHub-Datasets/LAION-Aesthetics-V2-6.5plus). This is a direct subset with no additional cleaning or post-processing on our part—the filtering (aesthetic score ≥6.5, minimum resolution, valid captions) was already applied by the LAION team.

**Dataset Characteristics**

The subset consists of 25,000 image-caption pairs with the following properties:

- **Aesthetic quality**: All images scored ≥6.5 on the LAION aesthetic classifier, ensuring visually appealing training examples
- **Resolution**: Minimum 512×512 pixels, matching SD1.5's native training resolution
- **Caption quality**: Valid image-caption pairs with non-empty, sanitized captions
- **Diversity**: Broad coverage of artistic styles, subjects, and compositions typical of high-aesthetic web imagery

We've made our specific subset available at `Mercity/laion-subset` on HuggingFace Hub for reproducibility.

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-1.jpg)

> *Photo pour Japanese pagoda and old house in Kyoto at twilight - image libre de droit*
> 

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-2.jpg)

> *Portrait - Anush, by Artur Mkhitaryan*
> 

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-3.jpg)

> *Emerald Lake, Yoho National Park, British Columbia*
> 

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-4.jpg)

> *Aztec City by 7leipnir on DeviantArt*
> 

### WebDataset: Streaming for Scale

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-5.jpg)

When we first attempted to load our dataset naively—reading 25,000 images into memory with multiple data loading workers—we quickly hit memory limits. With 16 workers (standard for saturating GPU utilization), the memory footprint exploded to roughly 288GB. Our training machine had 80GB of VRAM and reasonable system RAM, but this approach was simply not feasible.

**WebDataset** solved this problem elegantly. Rather than loading all images into memory, WebDataset stores data as sequential TAR archives that can be streamed on-demand. Each worker reads data sequentially from disk (or even directly from remote storage like S3), processes it, and discards it once the batch is assembled. Peak memory usage dropped to approximately 2GB regardless of dataset size.

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-6.jpg)

The format also has natural properties that benefit distributed training. We split our dataset into 25 TAR shards (~1000 samples each), and different workers can read different shards simultaneously without coordination overhead. The buffer-based shuffling (we used a buffer of 1000 samples) provides sufficient randomization while maintaining streaming efficiency.

Our WebDataset structure:

```
data/laion-subset_webdataset/
├── 00000.tar  (~100MB, samples 0-999)
├── 00001.tar  (~100MB, samples 1000-1999)
├── ...
└── 00024.tar  (samples 24000-24999)

```

Each TAR archive contains matched pairs of `.jpg` (image, JPEG quality=95) and `.txt` (caption, UTF-8 encoded) files with consistent naming.

### How Training Works with WebDataset

A key thing to understand: WebDataset doesn't do traditional epochs. Training doesn't iterate through all 25,000 images in a strict cycle. Each step loads a random batch from a shuffled buffer, and samples can repeat, skip, or appear in different orders.

This is intentional. Diffusion models train by continuous sampling with replacement, not strict epoch cycles. The controlled randomness improves generalization—you don't want the model memorizing a fixed sample order. Even SDXL, trained on hundreds of millions of images, uses random sampling with repetition.

For intuition, we can translate steps to approximate epochs: 196 steps ≈ 1 epoch, 588 steps ≈ 3 epochs, 980 steps ≈ 5 epochs, 1,600 steps ≈ 8 epochs. Literature suggests 3-5 epochs as a starting point for LCM distillation. We trained to ~8 epochs because validation metrics were still improving at the 5-epoch mark, stopping when they plateaued.

---

## Training

### Hardware: Why the A100 80GB

We ran our training on RunPod's GPU Cloud using an NVIDIA A100 with 80GB of VRAM. This wasn't an arbitrary choice—the memory requirements of LCM distillation are substantial.
LCM training is particularly memory-intensive because it requires holding both the teacher and student models in memory simultaneously. The teacher model performs inference (without gradients) to generate targets, while the student model performs forward and backward passes. With LoRA rank 96 applied to extensive target modules, and a batch size of 128 to ensure stable gradient estimates, we needed roughly 70GB of the available 80GB.

We experimented with smaller GPUs initially. On an RTX 4090 (24GB), we could only fit batch size 8-16, which produced noticeably noisier gradients. Training was possible but required more careful learning rate tuning, more gradient accumulation steps, and roughly 3× longer wall-clock time to reach comparable quality. On an A100 40GB, batch size 48-64 was achievable—workable, but still suboptimal for stable convergence.

The A100 80GB gave us the headroom to train efficiently without constantly fighting out-of-memory errors. Our complete training run (1,600 steps) took approximately 4 hours and cost around $8-10 at typical cloud rates. For practitioners on tighter budgets, the 40GB variant or even consumer GPUs can work—just expect to trade batch size for gradient accumulation and extend training time accordingly.

### Finding the Right Batch Size

We started conservatively at batch size 64, but quickly noticed we weren't utilizing the A100 fully—GPU memory sat under 50%. Even at batch size 72, utilization was only 44.7%. We pushed to 128 and increased the learning rate by 20% to compensate, following the standard heuristic that larger batches can tolerate higher learning rates due to more stable gradient estimates.

We tried disabling gradient checkpointing to squeeze out more speed, but hit immediate OOM errors. The ~30% compute overhead was the price of admission for batch size 128. We also increased dataloader workers from 8 to 16—with WebDataset streaming from disk, insufficient workers can bottleneck the GPU. At 8 workers, we observed occasional micro-stalls where the GPU waited for the next batch; at 16, the pipeline stayed saturated.

With gradient accumulation set to 1 (unnecessary at this batch size), our final config gave us stable training with ~70GB utilization out of 80GB available. The remaining 10GB headroom proved useful—it absorbed occasional memory spikes during validation without triggering OOM.

### Base Model: Stable Diffusion v1.5

We chose Stable Diffusion v1.5 as our base model for practical reasons. While newer models like SDXL offer improved quality, SD1.5 remains the most widely deployed diffusion model in the open-source community. Tools like ComfyUI, Automatic1111, and countless applications are built around it. By training LCM-LoRA adapters for SD1.5, we're creating acceleration tools that plug directly into existing workflows.
SD1.5 also has a well-understood architecture and behavior. The community has accumulated extensive knowledge about its strengths, limitations, and quirks. This made debugging easier and gave us confidence that issues we encountered were training-related rather than model-related. When validation images looked wrong, we could rule out "base model weirdness" as a cause.
There's also a dataset alignment benefit: SD1.5 was trained on LAION data, and we're distilling using a LAION-Aesthetics subset. Teacher and training data come from the same distribution, which tends to produce more stable distillation dynamics than cross-domain setups.

### Understanding LoRA for Distillation

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-7.jpg)

**Low-Rank Adaptation (LoRA)** is a technique that lets us modify a large model's behavior by training only a small number of additional parameters. Instead of updating the full weight matrices in attention and other layers, LoRA adds pairs of low-rank matrices that capture the desired modifications.

The key insight is that model adaptations often lie in a low-dimensional subspace—you don't need to modify every parameter to change behavior meaningfully. For a weight matrix W, LoRA learns two smaller matrices A and B such that the effective weight becomes W + BA. If W is 1024×1024 and rank is 96, then B is 1024×96 and A is 96×1024—a 10× parameter reduction.

For LCM distillation, this is particularly valuable. We're not trying to change *what* the model can generate—we're trying to change *how* it generates. Specifically, we want the model to produce comparable outputs in fewer denoising steps. LoRA gives us a lightweight way to inject this new behavior without creating a full model copy.

### Choosing LoRA Rank 96

We tested ranks 32, 64, 96, and 128. Rank 32 consistently underfit, producing blurry outputs with visible artifacts in fine details like hair and textures. Rank 64 improved sharpness but fine details remained soft—faces looked slightly plastic, fabric folds lacked definition. Rank 96 hit our quality ceiling—generated images at 4-6 steps matched teacher quality across validation prompts.
Why not 128? Quality gains were marginal (we couldn't reliably distinguish 96 vs 128 in blind comparisons), but adapter size increased by ~30%. For a technique whose appeal is lightweight deployment, that trade-off didn't make sense. Rank 96 delivers the quality we need while keeping adapters around 100MB.
The underlying intuition: LCM distillation isn't teaching the model a new style—it's teaching an entirely new sampling strategy. The adapter needs to encode "what would the teacher produce after N additional denoising steps?" This is fundamentally more complex than stylistic fine-tuning (where rank 16-32 often suffices), hence the higher rank requirement. We're compressing 44 steps of learned behavior into 6.

### Target Modules: What We Modified

We applied LoRA to a comprehensive set of UNet modules:

| Module Type | Specific Layers |
| --- | --- |
| **Attention** | `to_q`, `to_k`, `to_v`, `to_out.0` |
| **Projections** | `proj_in`, `proj_out` |
| **Feed-forward** | `ff.net.0.proj`, `ff.net.2` |
| **Convolutions** | `conv1`, `conv2`, `conv_shortcut` |
| **Sampling** | `downsamplers.0.conv`, `upsamplers.0.conv` |
| **Time embedding** | `time_emb_proj` |

This extensive coverage was intentional. Early experiments with LoRA applied only to attention layers produced models that could generate recognizable images in few steps, but with noticeable artifacts—particularly in fine details and color consistency. By including projections, convolutions, and time embeddings, we gave the adapter enough capacity to learn the complete few-step generation behavior.

There's a trade-off here: more target modules means larger adapters and longer training. If you're adapting this pipeline for your own use and need smaller adapters, we'd suggest starting with attention layers plus `proj_in`/`proj_out`, then adding modules only if quality is insufficient.

### Training Configuration

Our core training parameters:

| Parameter | Value | Rationale |
| --- | --- | --- |
| **Batch Size** | 128 | Maximizes A100 utilization; stable gradients |
| **Max Steps** | 1,600 | ~8 epochs; balance of quality vs. overfitting |
| **Resolution** | 512×512 | Native SD1.5 resolution |
| **Mixed Precision** | FP16 | Memory efficiency without quality loss |
| **Learning Rate** | 2.16e-4 | Scaled up 20% from base when increasing batch size |
| **LR Scheduler** | Cosine with warmup | Smooth convergence, 100-step warmup |
| **Min LR Ratio** | 0.50 | Maintains meaningful updates throughout training |

We stopped at 1,600 steps (approximately 8 epochs) after observing validation metrics plateau and early signs of overfitting on specific caption patterns. The checkpoints at 400, 800, 1,200, and 1,600 steps represent distinct points along the training trajectory, each with slightly different characteristics that we'll discuss in the results section.

### Learning Rate Strategy

We set the minimum LR ratio to 50%, higher than the typical 10-15%. The reasoning: with batch size 128, our gradient signal is already stable and reliable. We don't need the learning rate crawling toward zero—the model learns consistently throughout training.

We also avoided cosine restarts. When you restart, the learning rate jumps back up suddenly. For distillation, where we're carefully teaching the student to match teacher behavior, sudden gradient spikes can undo learned representations. We wanted smooth, predictable learning rate decay—no surprises.

## The LCM Distillation Process

### The Core Idea

Standard diffusion models learn to denoise images one small step at a time—each step removes a little noise, and quality emerges gradually over 25-50 iterations. LCM distillation takes a different approach: instead of learning the step-by-step process, we teach the model to predict the *final result* directly from any point along the denoising trajectory.

Think of it like this: if standard diffusion is learning to walk a path one step at a time, LCM is learning to look at any point on that path and predict where it ends. The key insight from consistency models is that every point along a denoising trajectory maps to the same clean image—so if we can learn that mapping directly, we can skip most of the steps.

[image](cid:2C74400D-A9DC-441F-8F10-C08D40DBEB49)

![Screenshot 2025-12-03 at 2.00.16 PM.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/Screenshot_2025-12-03_at_2.00.16_PM.jpg)

### The Training Loop

LCM distillation works by teaching the student model to predict what the teacher would produce after multiple denoising steps—but to do so in a single step. Here's the conceptual flow:

1. **Sample a random timestep** and add the corresponding amount of noise to a training image's latent representation
2. **The student predicts** the denoised output at this timestep—essentially guessing what the final clean image should be
3. **The teacher generates a target** by applying classifier-free guidance and taking a DDIM solver step to get a "ground truth" for where the trajectory leads
4. **We minimize the difference** between student prediction and teacher target using Huber loss

The student learns to match the teacher's multi-step behavior in a single forward pass. Over thousands of iterations, this compresses the teacher's 50-step knowledge into the student's few-step capability.

![Screenshot 2025-12-03 at 2.36.53 PM.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/Screenshot_2025-12-03_at_2.36.53_PM.jpg)

### Why This Works

The teacher model already "knows" how to generate good images—it just does so slowly. By using the teacher's outputs as training targets, we're not teaching the student what good images look like (it inherits that from the shared base model). We're teaching it a shortcut: given a noisy latent at timestep t, predict where the teacher would eventually arrive.

This is fundamentally different from training a diffusion model from scratch. We're leveraging the teacher's existing knowledge rather than learning image statistics from raw data. That's why distillation can work with relatively small datasets (25k images) and short training runs (1,600 steps)—we're transferring knowledge, not building it from scratch.

### Loss Function: Huber Loss

**Huber loss** (with c=0.001 in our case) was chosen over standard L2 (MSE) loss because it's more robust to outliers. The `c` parameter controls the transition between L2 behavior (for small errors) and L1 behavior (for large errors).

$$
L(x) = \begin{cases} 0.5 \cdot x^2 & \text{if } |x| \leq c \\ c \cdot (|x| - 0.5 \cdot c) & \text{if } |x| > c \end{cases}
$$


This helps training stability when occasional difficult samples—unusual compositions, extreme colors, or edge cases in the dataset—would otherwise create gradient spikes. L2 loss squares the error, so a single bad sample can dominate a batch's gradient. Huber loss caps this influence.

### Teacher Configuration

**DDIM timesteps** (50 in our config) determines how many steps the teacher's internal ODE solver uses when generating targets. More steps means more accurate teacher targets but slower training. We found 50 to be a reasonable balance—accurate enough that the student learns correct behavior, fast enough that training completes in hours rather than days.

**The guidance scale range** (w_min=5.0, w_max=15.0) is sampled uniformly during training. Standard SD1.5 inference uses guidance scales of 7-12 to balance prompt adherence against image quality. By training across a range, we teach the student to handle varying levels of prompt adherence—important because the final model should work well whether users want literal prompt matching or more creative interpretation.

This is also why LCM models use low guidance at inference time (1.0-2.0): the guidance is already baked into the learned behavior. The student has internalized "what guided generation looks like" and reproduces it without needing explicit guidance at runtime.

---


### Optimizer and Memory

We use **32-bit AdamW** with standard momentum parameters (β₁=0.9, β₂=0.999). We abandoned 8-bit Adam for speed, not just stability. On A100 with FP16 training, standard AdamW runs 20–35% faster than bitsandbytes' 8-bit implementation. The quantization and dequantization overhead outweighs memory savings, especially when gradient checkpointing already gives us the headroom we need.

We saved memory through **gradient checkpointing**, which trades compute for memory by recomputing intermediate activations during the backward pass rather than storing them. This allowed us to increase batch size from ~42 to 128 while staying within 80GB—a worthwhile trade-off given how much training stability improved with larger batches. The ~30% slowdown was acceptable.

The **VAE always runs in FP32**. We learned this the hard way: FP16 VAE encoding caused periodic NaN losses due to underflow in certain image regions. The extra ~1GB of memory is a small price for training stability.

### Checkpoint Management and Format Conversion

We saved checkpoints every 400 steps, keeping the last 5 to manage disk space. After training, we identified four key checkpoints representing different points on the quality-overfitting curve.

**An important detail**: training produces checkpoints in **PEFT format**, but the community tools (ComfyUI, Automatic1111, Civitai) expect **Diffusers format** (and sometimes Kohya format). The conversion requires:

- Remapping keys: `lora_A` → `lora_down`, `lora_B` → `lora_up`
- Injecting the alpha parameter correctly
- Ensuring weight scaling is applied properly

We wrote custom conversion scripts that we applied to all released checkpoints. If you're building your own pipeline, expect to spend some time on format compatibility—it's a common pain point.

---

## Validation

### Measuring Quality During Training

Every 400 steps, our training pipeline automatically evaluates the current model's generation quality. We designed this system to answer two questions: "How good are the images?" and "How well do they match the prompts?"

**FID (Fréchet Inception Distance)** measures how statistically similar our generated images are to real images from the training distribution. We precomputed reference statistics from 10,000 training images using Inception-v3 features. Lower FID means the generated image distribution more closely matches the real image distribution. We only compute FID for in-distribution prompts since it requires a reference distribution.

**CLIP Score** (using SigLIP) measures text-image alignment—how well the generated image matches its prompt semantically. We chose SigLIP over the original CLIP because it handles compositional prompts more robustly and generalizes better to out-of-distribution concepts. Higher CLIP scores mean better prompt adherence.

### Single-Pass Validation (Our Efficiency Trick)

Rather than generating separate images for each step count (1 through 6), we capture latents at each intermediate step during a single 6-step generation. This is standard practice in diffusion validation—since step 4 is just the intermediate state on the way to step 6, there's no need to run separate passes. This approach reduces validation time by roughly 4×.

We also reduced in-distribution validation by 25% to balance thoroughness against training time. Full validation was adding ~2 extra minutes per checkpoint. The reduced set still provides statistically meaningful metrics while keeping each validation pass under 5 minutes.

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-8.jpg)

### Prompt Strategy

We evaluate on two prompt sets to understand both reproduction quality and generalization:

**In-distribution prompts**: Randomly sampled from training captions (75% of the dataset). These test whether the model can reproduce the characteristics it was trained on.

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-9.jpg)

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-10.jpg)

**Out-of-distribution prompts**: 50 manually curated prompts covering artistic styles, complex compositions, named landmarks, abstract concepts, and technical specifications. These test whether the model generalizes beyond training caption patterns.

For each validation run, we sample 4 prompts from each set and generate 4 images per prompt across all 6 step counts.

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-11.jpg)

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-12.jpg)

# How to Use These Models

## Quick Start with Diffusers

Here's a complete working example based on our validation pipeline:

```python
import torch
from diffusers import StableDiffusionPipeline, LCMScheduler

# Device setup
device = "cuda" if torch.cuda.is_available() else "cpu"
dtype = torch.float16 if device == "cuda" else torch.float32

# Load SD1.5 base model
pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=dtype,
    safety_checker=None
).to(device)

# Load LCM-LoRA adapter
pipe.load_lora_weights("Mercity/lcm-lora-sd15-step-800")

# Switch to LCM scheduler
pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

# Optional: Fuse LoRA weights for faster inference
pipe.fuse_lora(lora_scale=1.0)

# Generate
with torch.inference_mode():
    image = pipe(
        prompt="underwater coral reef with colorful fish, crystal clear water, natural sunlight",
        num_inference_steps=6,
        guidance_scale=1.0,
        generator=torch.Generator(device=device).manual_seed(42),
        height=512,
        width=512
    ).images[0]

image.save("output.png")

```

## Recommended Settings

### Inference Steps

We recommend 4-6 steps based on our validation results.

| Steps | Quality | Best For |
| --- | --- | --- |
| 4 | Good | Real-time apps, rapid iteration |
| 5 | Better | Balanced speed/quality |
| 6 | Best | Final outputs, quality-critical |

> Important: Steps 1-3 produce low-quality outputs regardless of checkpoint (see our FID results). Going beyond 6 steps provides minimal improvement—the model converges by step 6.
> 

---

## Which Checkpoint?

| Checkpoint | Strength | Use When |
| --- | --- | --- |
| step-800 | Best FID (249.1) | Aesthetic quality matters most |
| step-1600 | Best CLIP (-13.25) | Prompt adherence matters most |
| step-400 | Earliest checkpoint | Testing, experimentation |
| step-1200 | Balanced | General purpose |

---

## Performance Optimization

For inference, two optimizations provide noticeable speedups. First, fusing the LoRA weights into the base model eliminates the adapter computation overhead during generation:

python

```python
pipe.fuse_lora(lora_scale=1.0)
```

This merges the low-rank matrices directly into the UNet weights, so forward passes run at native speed rather than computing the LoRA additions on every step. The trade-off is flexibility—once fused, you can't easily swap adapters or adjust the LoRA scale. Use this when you're deploying a fixed configuration rather than experimenting.

Second, wrapping generation in `torch.inference_mode()` disables gradient tracking entirely:

python

```python
with torch.inference_mode():
    image = pipe(...).images[0]
```

This is slightly faster than `torch.no_grad()` and uses less memory since PyTorch doesn't need to record operations for potential backward passes.

During training, we enabled [xF**ormers memory-efficient attention**](https://huggingface.co/docs/diffusers/en/optimization/xformers) which reduced VRAM usage and improved throughput. xFormers replaces the standard attention computation with an optimized kernel that avoids materializing the full attention matrix—particularly beneficial for SD1.5's 512×512 resolution where attention maps can be large. This gave us roughly 15-20% faster training iterations and freed enough memory to push our batch size higher. If you're adapting our pipeline, ensure xformers is installed (`pip install xformers`) and enable it with `--enable_xformers_memory_efficient_attention`.

```python
from diffusers import DiffusionPipeline
import torch

pipe = DiffusionPipeline.from_pretrained(
	"runwayml/stable-diffusion-v1-5",
	torch_dtype=torch.float16,
	use_safetensors=True,
).to("cuda")
pipe.enable_xformers_memory_efficient_attention()
with torch.inference_mode():
sample = pipe("a small cat")
```

For consumer GPUs with limited VRAM, our LCM-LoRA adapters add minimal overhead to the base SD1.5 model. In fp16, expect ~4GB VRAM usage; in fp32, around 8GB. For anything under 6GB, stick with fp16 and consider enabling attention slicing (`pipe.enable_attention_slicing()`) if you're still hitting memory limits.

---

## Memory Requirements

| Setup | VRAM Required |
| --- | --- |
| SD1.5 + LCM-LoRA (fp16) | ~4 GB |
| SD1.5 + LCM-LoRA (fp32) | ~8 GB |

---

## Results and Analysis

### Quality Progression by Inference Steps

**FID Scores (In-Distribution)**

**FID Scores (In-Distribution)**

| Checkpoint | 1 Step | 2 Steps | 3 Steps | 4 Steps | 5 Steps | 6 Steps |
| --- | --- | --- | --- | --- | --- | --- |
| **Step 400** | 479.5 | 448.5 | 451.7 | 423.9 | 335.1 | **261.5** |
| **Step 800** | 475.2 | 466.8 | 431.7 | 439.5 | 330.6 | **249.1** |
| **Step 1200** | 477.8 | 457.1 | 444.6 | 430.9 | 337.2 | **254.2** |
| **Step 1600** | 476.7 | 451.0 | 439.3 | 421.2 | 333.3 | **250.5** |

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-13.jpg)

**In-Distribution CLIP Scores (Higher / Less Negative is Better)**

| Checkpoint | 1 Step | 2 Steps | 3 Steps | 4 Steps | 5 Steps | 6 Steps |
| --- | --- | --- | --- | --- | --- | --- |
| Step 400 | -16.99 | -16.95 | -16.24 | -14.77 | -14.17 | -14.15 |
| Step 800 | -16.86 | -16.73 | -16.01 | -14.48 | -13.37 | **-13.76** |
| Step 1200 | -16.90 | -16.85 | -15.91 | -14.51 | -14.13 | -13.68 |
| Step 1600 | -16.85 | -16.83 | -15.89 | -14.64 | -14.15 | **-13.25** |

> CLIP scores measure text-image alignment. Higher values (less negative) indicate better prompt adherence. Step 1600 achieves the best CLIP score at 6 steps (-13.25), while Step 800 shows strong performance at 5-6 steps.
> 

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-14.jpg)

---

**Out-of-Distribution CLIP Scores (Higher / Less Negative is Better)**

| Checkpoint | 1 Step | 2 Steps | 3 Steps | 4 Steps | 5 Steps | 6 Steps |
| --- | --- | --- | --- | --- | --- | --- |
| Step 400 | -16.18 | -16.47 | -16.20 | -16.08 | -17.20 | -18.37 |
| Step 800 | -16.37 | -16.36 | -16.05 | -15.87 | -17.05 | -18.43 |
| Step 1200 | -16.28 | -16.22 | -16.09 | -15.98 | -17.30 | -18.93 |
| Step 1600 | -16.28 | -16.36 | -16.04 | -16.11 | -17.22 | -18.91 |

> Out-of-distribution performance shows degradation at 5-6 steps across all checkpoints (scores worsen from ~-16 to ~-18), suggesting the model optimizes for in-distribution aesthetics at the cost of generalization.
> 

![image.png](https://blog-cdn.mercity.ai/blog/lcm-lora-distillation-training-fast-diffusion-modelsls/image-15.jpg)

---

### Key Findings

### The 4-6 Step Sweet Spot

Steps 1-3 produce low-quality outputs regardless of checkpoint. The dramatic improvement happens at step 5, with optimal quality at step 6. For most applications, we recommend **4 steps for speed-critical uses** (12.5× faster than baseline) and **6 steps when quality matters most** (8× faster with near-baseline quality).

### Checkpoint 800 vs 1600

Checkpoint 800 achieves the best FID (249.1), suggesting it best captures the training distribution. Checkpoint 1600 achieves the best CLIP score (-13.25), indicating stronger text alignment. Depending on whether you prioritize fidelity to the aesthetic style or prompt adherence, either could be the right choice.

### Generalization Limits

All checkpoints show degraded CLIP scores on out-of-distribution prompts at step 6 (scores worsen to around -18.4 to -18.9). This indicates some overfitting to LAION-Aesthetics caption structures. For prompts with unusual compositions or technical specifications, results may be less reliable.

---

## When to Use This Model

### Good Use Cases

Our LCM-LoRA adapters work well for:

- **Interactive applications** where generation latency matters (2-4 seconds vs 15-25 seconds)
- **Iterative prompt exploration** where you want to quickly test many variations
- **Aesthetic image generation** matching the LAION-Aesthetics style distribution
- **Resource-constrained deployment** where loading a 100MB adapter is preferable to maintaining separate fast/slow models

### Limitations

These adapters may underperform for:

- **Technical diagrams or text rendering** where SD1.5 already struggles
- **Novel compositional prompts** significantly outside LAION-Aesthetics patterns
- **Maximum quality applications** where the slight quality gap vs. 50-step SD1.5 matters
- **SDXL or newer base models** (these adapters are SD1.5-specific)

---

## Alternative Approaches to Fast Diffusion

Our LCM-LoRA approach is one of several methods for accelerating diffusion models. Here's how it compares to alternatives:

**Flash Diffusion** takes a different distillation approach, using adversarial training to produce single-step generators. It can achieve even faster inference (1-2 steps) but typically with more noticeable quality degradation and more complex training requirements.

**SDXL Turbo and SD Turbo** from Stability AI use a related but distinct distillation technique (Adversarial Diffusion Distillation). They achieve excellent few-step quality but require full model checkpoints rather than lightweight adapters.

**Progressive Distillation** methods iteratively train models to halve their step counts. While theoretically elegant, they require multiple training rounds and careful scheduling.

**Consistency Models** (the original approach our LCM builds on) can be trained from scratch or distilled from existing models. LCM-LoRA's contribution is making this accessible via lightweight adapters.

For most practitioners, LCM-LoRA offers the best balance of quality, ease of use, and practical deployment. The adapter approach means you can accelerate existing SD1.5 workflows without replacing your base model.

---

## References

### Core Methods

**Latent Consistency Models (LCM)**

Luo, S., et al. (2023). *Latent Consistency Models: Synthesizing High-Resolution Images with Few-Step Inference*. arXiv:2310.04378.

[GitHub](https://github.com/luosiallen/latent-consistency-model)

**LCM-LoRA**

Luo, S., et al. (2023). *LCM-LoRA: A Universal Stable-Diffusion Acceleration Module*. arXiv:2311.05556.

[HuggingFace Documentation](https://huggingface.co/docs/diffusers/using-diffusers/lcm_lora)

**LoRA (Low-Rank Adaptation)**

Hu, E. J., et al. (2021). *LoRA: Low-Rank Adaptation of Large Language Models*. arXiv:2106.09685.

### Base Models and Datasets

**Stable Diffusion v1.5**

Rombach, R., et al. (2022). *High-Resolution Image Synthesis with Latent Diffusion Models*. CVPR 2022.

[Model](https://huggingface.co/runwayml/stable-diffusion-v1-5)

**LAION-Aesthetics V2**

Schuhmann, C., et al. (2022). *LAION-5B: An Open Large-Scale Dataset for Training Next Generation Image-Text Models*. NeurIPS 2022.

### Evaluation

**Fréchet Inception Distance (FID)**

Heusel, M., et al. (2017). *GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium*. NeurIPS 2017.

**SigLIP**

Zhai, X., et al. (2023). *Sigmoid Loss for Language Image Pre-Training*. ICCV 2023.

[Model](https://huggingface.co/google/siglip-base-patch16-224)

### Released Models

Our trained checkpoints are available on HuggingFace Hub:

- [Mercity/lcm-lora-sd15-step-400](https://huggingface.co/Mercity/lcm-lora-sd15-step-400)
- [Mercity/lcm-lora-sd15-step-800](https://huggingface.co/Mercity/lcm-lora-sd15-step-800)
- [Mercity/lcm-lora-sd15-step-1200](https://huggingface.co/Mercity/lcm-lora-sd15-step-1200)
- [Mercity/lcm-lora-sd15-step-1600](https://huggingface.co/Mercity/lcm-lora-sd15-step-1600)

**Training Dataset**: [Mercity/laion-subset](https://huggingface.co/datasets/Mercity/laion-subset)
