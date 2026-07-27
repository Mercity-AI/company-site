---
title: Classifying Figure Skating Elements from Pose Estimation
slug: classifying-figure-skating-elements-from-pose-estimation
publishedAt: '2026-07-27'
summary: >-
  We trained five architectures — recurrent, attention-based, and
  graph-convolutional — to name figure skating elements from pose estimation
  alone, and all five hit the same ceiling. Spins and step sequences classify
  almost perfectly; jumps that differ only by blade edge do not, because COCO-17
  has no keypoint below the ankle. Which class you predict matters roughly three
  times more than which model predicts it.
authors:
  - name: Rishikesh
  - name: Pranav Patel
tags:
  - Computer Vision
  - Pose Estimation
  - Action Recognition
category: Computer Vision
isTopPick: false
image: >-
  https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig03_data_diagram.jpeg
---

When a model stalls, the reflex is to reach for a bigger or newer one. This is a case study in a problem where that would have been the wrong move: the performance ceiling sat in how the data was represented, not in the model, and no architecture we tried could push past it. The example is figure skating, but the underlying question, whether to spend the next dollar on the model or on the inputs, is one most teams face.

A figure skating routine is a sequence of named technical elements (jumps, spins, step sequences) performed in rapid succession. Judges identify each one in real time, but the process is manual, slow, and entirely dependent on expert availability. We wanted to know whether a model could watch a skating clip and correctly name the element.

All our models can be found in this [HuggingFace collection](https://huggingface.co/collections/Mercity/figure-skating-classification), and all the code is present here in the [Github repo](https://github.com/Mercity-AI/figure-skating-analysis). - Explore and feel free to use!!

The short answer is that it depends entirely on which element. 

Pose-based features classify spins and step sequences almost perfectly, and they separate jump *families* well. What they cannot do is distinguish jumps that differ by which edge of the blade the skater takes off from. A Flip and a Lutz are the same jump to a skeleton. We trained five architectures against this problem (recurrent, attention-based, graph-convolutional), and every one converged on the same failure surface. Which class you are predicting turns out to matter about three times more than which model is predicting it, and that ratio is the most useful result we got: the ceiling is in the input representation, not in the modeling.

We also ran a first pass at temporal action localization, finding *where* elements happen inside an untrimmed routine. There the interesting result was negative. CTC loss, the method most people suggest for learning alignment without frame-level labels, structurally cannot recover timestamps for this problem. Ordinary per-frame supervision on the same encoder worked as soon as we found data with frame-level annotations.

## The problem, and how we split it

If you have worked on action recognition before (given a video, classify sitting, walking, waving), you might reasonably assume figure skating is more of the same. It is not, and the gap is worth being specific about.

The actions are fast and visually subtle. A jump completes in one to three seconds. Consider the two hardest classes in the dataset. A Flip and a Lutz look nearly identical: the skater glides backward, plants the toe pick of one blade into the ice, and rotates. The only difference is which edge of the gliding blade is in contact with the ice at the moment of takeoff: inside edge for a Flip, outside edge for a Lutz. That is a distinction measured in the tilt of one ankle, for a few frames, on a skater moving across the rink at speed. Trained judges dispute these calls regularly enough that the sport has a dedicated notation for a wrong-edge takeoff. A model that lumps all jumps together is not useful to anyone; the entire value of the task sits in correctly separating *which* jump it is.

The public data situation is also thin. Annotation offsets of several seconds have been documented in existing skating datasets. Pose estimation degrades badly during fast rotation, which is exactly when the skeleton would be most informative. And the class imbalance is structural rather than accidental: step sequences make up roughly a third of every dataset we looked at, while individual quad-jump classes can have single-digit sample counts. That imbalance is not something more scraping fixes, because it reflects how often these elements actually occur in competition.

Given all of that, we split the work into two phases.

**Phase 1 is single-element classification.** The model receives a trimmed clip containing exactly one element and outputs a label: which jump, which spin, or step sequence. Boundaries are given. The difficulty is entirely in fine-grained discrimination and in data quality. This is where most of our experimental work went, and it is the bulk of this post.

**Phase 2 is temporal action localization.** The model receives a full untrimmed competition program and has to find where each element starts and ends *and* classify it. It has to solve detection and classification jointly, without being handed boundaries. Phase 2 depends on Phase 1 producing a reliable per-element signal, so we treated it as a follow-on and ran only initial experiments, covered at the end.

## Data

Two datasets carry the whole project, and they split cleanly along the two phases.

**SkatingVerse** [[1]](https://doi.org/10.1049/cvi2.12287) is the Phase 1 training source. It ships 19,993 labeled video clips across 28 fine-grained classes: six jump types (Axel, Salchow, Toeloop, Loop, Flip, Lutz) crossed with rotation counts from single through quadruple, three spin types (CamelSpin, SitSpin, UprightSpin), a step Sequence class, and a NoBasic catch-all. Every clip is trimmed to exactly one element, which is what makes it usable for classification and useless for localization. There are another 8,586 test clips, but their labels were never publicly released, so everything reported here was trained and evaluated on the training split alone, divided internally into train, validation, and test. Not ideal, but it was the only way forward.

**FS-Jump3D** [[2]](https://arxiv.org/abs/2408.16638) is the Phase 2 dataset. It provides 3D motion capture recordings of jumps, including multi-action clips where a skater performs a combination: two jumps in sequence, less than a second apart. That multi-action structure is what makes it the right starting point for localization work, where the whole question is finding boundaries between elements rather than labeling a clip that has already been cut. It is far too small to train a classifier on and we do not use it as a Phase 1 source.

### What the class distribution looks like

There is one more thing to know about the data before we turn it into features: how often each class appears. Figure skating is imbalanced in a way that no amount of collection fixes.

![fig01_dist_fine.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig01_dist_fine.jpg)

*Figure 1. Clip counts for all 28 fine-grained classes, sorted from most to least common. The long tail is the point: everything below 3Axel is a rounding error against Sequence.*

4Loop has seven clips in the entire dataset. 1Salchow has eleven. Eight classes have fewer than thirty. Any per-class metric computed on those is noise, because a single correct or incorrect prediction swings F1 by anywhere from 0.3 to 1.0.

This is not a sampling artifact that more collection would fix. It reflects how often these elements occur in competition. Quad Loops are rare because they are extraordinarily difficult: only a handful of skaters have ever landed one. Single Salchows are rare for the opposite reason: they are too easy to be worth a place in a competitive program. The distribution is a property of the sport, and it has the same shape in every figure skating dataset we looked at.

To make the problem tractable we defined a **coarse 11-class taxonomy** that strips the rotation count off jumps. Every Axel becomes "Axel," every Toeloop becomes "Toeloop," and so on; spins, Sequence, and NoBasic keep their own labels.

![fig_class_sankey.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig_class_sankey.jpg)

*Figure 2. How the 28 fine-grained classes collapse into the 11 coarse ones. Each jump keeps its type but loses its rotation count, so its single-through-quad variants merge into one label; the three spins, Sequence, and NoBasic pass through unchanged.*

![fig02_dist_coarse.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig02_dist_coarse.jpg)

*Figure 3. Clip counts for the 11 coarse classes, after rotation counts are stripped off the jumps. Collapsing them fixes the tail but not the skew: Sequence alone is 30.5% of the data, and every jump type sits under 10%.*

Collapsing rotation counts removes the single-digit classes, but the imbalance survives: Sequence is still nearly a third of the data, and Salchow, the rarest jump, has 613 clips against Sequence's 6,099. Every model in this post is trained with class-weighted cross-entropy to compensate, weights capped at 5× so the rarest classes cannot dominate the gradient outright.

Both label spaces run through the rest of this post. The coarse space measures whether the pipeline can identify *what kind* of element happened; the fine space adds the requirement to count rotations, which turns out to be a substantially harder and largely separate problem.

## From video to features

Everything in this project is bounded by one pipeline. A video goes in, a fixed-width numeric tensor comes out, and no model downstream can recover information that these stages fail to capture. It is worth understanding in full before looking at any result, because the most important finding in this post is about this pipeline rather than about any of the models.

![fig03_data_diagram.jpeg](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig03_data_diagram.jpeg)

*Figure 4. The feature pipeline as a block diagram: a raw clip goes in on the left, a fixed-width numeric tensor comes out on the right, through three stages that capture a skeleton, clean it, and turn it into numbers. The rest of this section walks through each one.*

### Stage 1: Capturing the skeleton

Each clip is decoded frame by frame, and a pose estimator locates the skater's body in every frame. We use YOLO11n-pose [[3]](https://docs.ultralytics.com/tasks/pose/) on GPU as the primary backend, with MediaPipe Pose [[4]](https://arxiv.org/abs/2006.10204) as a CPU fallback. Both return the same thing: a **COCO-17 skeleton** [[5]](https://arxiv.org/abs/1405.0312), a standard 17-point layout covering the major joints and landmarks of the human body. Each point carries an (x, y) position in the frame and a confidence score saying how sure the estimator is.

![fig05_skeleton_overlay.gif](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig05_skeleton_overlay.gif)

*Figure 5. Stage 1 in action: a broadcast skating clip with the COCO-17 skeleton drawn on top by the pose estimator, one fresh estimate per frame. This is the raw material every later stage works from. Two properties of the layout matter later in the post: the skeleton is seventeen points joined by ten bones, and its lowest points are the ankles, with nothing tracking the foot or blade below them.*

That layout deserves a close look, because two of its properties turn up repeatedly later. The first is where it stops: **the ankle is the most distal keypoint there is.** There is no point for the foot, none for the blade, and nothing that encodes which edge of the blade is touching the ice. The second is what connects to what: the ten bones form an upper-body group and a lower-body group with no edge between them, and the five head points have no bone edges at all. A model that reasons over this skeleton as a graph cannot pass information from a wrist to an ankle, no matter how deep it is.

One dataset skips this stage entirely. FS-Jump3D is optical motion capture rather than broadcast video, so it ships joint coordinates directly, with no estimator in the loop and no estimation error to clean up afterwards. Everything below applies to SkatingVerse; FS-Jump3D enters at stage 2 with exact skeletons.

For everything that does go through an estimator, the input resolution matters more than any choice made downstream of it. At 256 pixels the estimator finds a usable skeleton on roughly 90% of element frames; at 640 that rises to about 98%. The frames it drops are not random: they cluster on fast-motion frames, takeoff and landing, precisely the frames that separate one jump from another. Results in this post were extracted at 384 pixels, an intermediate setting, and moving up to it from 256 lifted the jump classes by 8 to 17 points of F1. That is a larger effect than any architectural change reported here, and it means the jump numbers below should still be read as a floor.

### Stage 2: Cleaning the skeleton

Raw pose estimates are noisy in specific, correctable ways. A keypoint jitters frame to frame because the estimator re-detects it independently on every frame. It disappears entirely during fast rotation. In a crowded broadcast shot it can snap onto a coach or a judge instead of the skater. Six steps run in sequence to deal with this, and the order matters: each one assumes the previous has already run.

Each step below is shown on the same real broadcast clip, using the video's own colour-coded skeleton.

**Aspect ratio correction.** Multiply x-coordinates by `width/height` so horizontal and vertical distances are geometrically comparable. Broadcast frames are wider than they are tall, so without this a pixel of sideways movement means something different from a pixel of vertical movement, and every angle and distance computed later is quietly wrong.

![step1_aspect.gif](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/step1_aspect.gif)

*Figure 6a. The same moving skeleton drawn two ways: straight from the detector, normalized to a square so the skater looks too narrow (left), and after scaling x by width/height = 1.78 (right). The shoulder-width readout grows by that factor while torso height never moves.*

**Confidence filtering.** Any joint whose confidence falls below 0.3 has its coordinates replaced with NaN, marked missing rather than trusted. A low-confidence keypoint is not a slightly-wrong position; it is often a guess in the wrong part of the frame entirely, and averaging it into a trajectory is worse than having no value at all.

![step2_confidence.gif](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/step2_confidence.gif)

*Figure 6b. Each joint's confidence is shown as a bar beside the skeleton on the frame. As the skater rotates through the jump, the leg joints fall below the 0.3 line and are dropped to NaN rather than trusted.*

**Temporal interpolation.** The gaps opened by step 2 get filled by linear interpolation across time. If the left wrist was detected at frame 10 and again at frame 14 but was missing in between, its position across frames 11 to 13 is estimated along a straight line between the two known points. A joint missing for an entire clip is filled with zeros, since there is nothing to interpolate between.

![step3_interpolation.gif](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/step3_interpolation.gif)

*Figure 6c. The left ankle is tracked; it disappears for the entire airborne phase, and a straight line bridges the gap (gold). The clip freezes the instant the ankle drops out — a reminder that the filled values through the jump are a guess, over exactly the frames that separate one jump from another.*

**Smoothing.** A Savitzky-Golay filter [[6]](https://doi.org/10.1021/ac60214a047) runs over each joint's x and y trajectory. It fits a low-order polynomial to a sliding window, which strips high-frequency detection jitter while preserving the shape of the underlying motion. That matters here because the sharp velocity changes at a jump takeoff are signal, not noise, and a blunter filter would flatten them.

![step4_smoothing.gif](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/step4_smoothing.gif)

*Figure 6d. The right wrist tracked on the video, its height drawing in alongside. Grey is the raw per-frame estimate, trembling as the detector re-finds the joint each frame; green is the Savitzky-Golay result, which removes the tremble without flattening the real motion.*

**Hip centering.** On each frame we compute the midpoint of the two hips and subtract it from every joint. A skater in the top-left corner of the frame and the same skater in the same pose in the bottom-right now produce identical numbers. What survives is body shape and limb extension relative to the torso, not position on the rink. This matters enormously for broadcast footage, where the camera pans constantly to follow the skater and would otherwise dominate the signal.

![step5_hipcenter.gif](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/step5_hipcenter.gif)

*Figure 6e. The raw skeleton drifting around the frame as the camera pans and the skater travels, a gold trail tracing the hips (left), versus the same skeleton with the hip midpoint pinned to the origin every frame (right). Only the pose survives.*

**Scale normalization.** All coordinates are divided by torso length. A skater filmed from the boards and the same skater filmed from the upper deck now produce the same normalized skeleton, which removes sensitivity to camera zoom and distance.

![step6_scale.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/step6_scale.jpg)

*Figure 6f. Torso length (nose to hip) swings about 3.7× across the clip as the skater crouches, launches and nears the camera; dividing every coordinate by it flattens that to a constant 1.0. The filmstrip below shows ten frames going from varied raw sizes (top) to one normalized size (bottom).*

After these six steps the skeleton is body-centred, scale-invariant, and temporally smooth: a 2D pose sequence of shape `(F, 17, 2)`, where F is the frame count. What it encodes is how the body is arranged, with the camera's contribution removed. None of this is glamorous, but it is where most of the usable signal is either kept or thrown away, and we came to treat cleaning as part of the model rather than as preprocessing beneath it.

### Stage 3: Turning poses into features

Joint positions alone are a weak learning signal, and our earliest experiments confirmed it. Positions describe where the body is but say nothing explicit about how it is moving, and motion is what separates these actions. A jump takeoff, for instance, is a sharp discontinuity in ankle velocity: the ankle tracks smoothly with the glide, and then over two or three frames it does not. A position-only model has to infer that from a sequence of coordinates. A velocity feature hands it over directly.

So each frame's skeleton is expanded into five blocks of derived quantities, concatenated into a single vector. Coordinates give body shape. Joint angles capture articulation independent of which way the skater is facing. Bone vectors describe limb direction and proportion. Velocities and angular velocities carry the dynamics: how fast joints are moving and how fast they are bending.

**Temporal resampling** closes the pipeline. Clip lengths vary enormously: a Toeloop averages 44 frames, a step sequence 364. Every clip is linearly resampled to a fixed 128 timesteps, so the 44-frame jump is stretched and the 364-frame sequence compressed into the same window. The motion pattern survives in both cases, though the compression is a real cost on the longest clips.

### What each clip becomes

The output of all three stages, for a single clip, is a **94-number vector per frame across 128 frames**. Here is where those 94 numbers come from:

| Feature block | Dims | What it captures |
| --- | --- | --- |
| **Joint coordinates** | 34 | Body-centred, scale-normalized (x, y) for all 17 joints, the underlying body shape |
| **Joint angles** | 12 | Cosine of the angle at 12 anatomical joint triplets. Articulation, independent of which way the skater faces |
| **Bone vectors** | 20 | Parent-to-child displacement for the 10 bone pairs, limb direction and relative proportion |
| **Velocities** | 16 | Speed and direction of 8 key joints, scaled by frame rate. A jump takeoff is a velocity discontinuity |
| **Angular velocities** | 12 | Rate of change of the 12 joint angles, how fast joints bend and extend |
| **Total** | **94** | Shape, articulation, limb geometry, and both linear and rotational dynamics, per timestep |

Stacked across a dataset this gives a float32 tensor of shape `(N, 128, 94)` (N clips, 128 timesteps each, 94 features per timestep), plus a label array. That tensor is the only thing any model in this post ever sees.

The bone-vector block carries no information beyond the coordinates. The correlation between each stored bone vector and the corresponding `coords[child] − coords[parent]` difference is exactly 1.0000 for all ten bones in both axes: a deterministic linear re-derivation of numbers already present, so 20 of the 94 dimensions are redundant. We only caught this while analysing feature importance, and since every result in this post already includes the block, we flag the redundancy here rather than quietly dropping it.

## Model architectures

![fig_architectures.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig_architectures.jpg)

We chose architectures that are simple, well understood, and each motivated by a specific hypothesis about what this data needs. All five went through identical treatment: the same 94-dimensional input, the same data and split, the same training recipe (class-weighted cross-entropy with weights capped at 5×, batch 64, early stopping on validation macro-F1 with patience 20), the same seed, and the same evaluation protocol. 

The only variable is the design decision each one embodies. 

Three of them share a convolutional backbone and a dense head, and differ only in how they mix information across time. Together they form a controlled test of one question: what is the right way to model temporal structure in a skating element?

- **CNN + BiLSTM**, 3.77M parameters. The backbone's output passes through a two-layer bidirectional LSTM [[7]](https://doi.org/10.1162/neco.1997.9.8.1735), [[8]](https://doi.org/10.1016/j.neunet.2005.06.042). Recurrence carries a built-in sense of order: the model reads frames in sequence and carries state forward, which matches how a skating element unfolds. This is our reference model.
- **Transformer**, 7.31M parameters. The LSTM is replaced by three Transformer encoder layers with sinusoidal positional encoding [[9]](https://arxiv.org/abs/1706.03762). Attention sees every frame simultaneously and weighs them against each other directly, which should suit an element whose defining moment sits anywhere in the clip.
- **Continuous Thought Machine (CTM)**, 2.18M parameters. A recurrent thinking loop in place of the temporal stage. More on this below.

Two further architectures test assumptions further up the stack.

- **Transformer + BiLSTM**, 8.20M parameters. Projects the raw 94-dimensional features straight into a Transformer encoder and then a BiLSTM, with no convolutional backbone. This isolates what the convolutional stage contributes: if local temporal feature extraction can be replaced by a linear projection into an encoder, this model should match the others.
- **Graph Convolutional Network (GCN)**, 7.24M parameters. Every architecture above treats the 94-dimensional vector as a flat bag of channels, with no knowledge that 34 of those numbers are the positions of 17 physically connected joints. The GCN makes that topology explicit [[10]](https://arxiv.org/abs/1609.02907): joints become nodes, anatomical bones become fixed edges, and information propagates along the skeleton's own structure before reaching the temporal stage. Given that we are classifying human movement, a model that knows a wrist is attached to an elbow should have an advantage.

### Why we tried a Continuous Thought Machine

The CTM [[11]](https://arxiv.org/abs/2505.05522) is the one architecture here that is genuinely new, and we included it because the way it processes information resembles how a person actually watches a jump.

![fig_ctm_thinking_steps.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig_ctm_thinking_steps.jpg)

A human judge does not extract a verdict from a clip in a single pass. They watch the entry, form a provisional read, watch the takeoff, revise it, and settle on an answer after several passes over the same few seconds of footage. Ordinary feedforward networks have no equivalent of that: information flows through the layers exactly once, and the amount of computation spent is fixed by the architecture rather than by the difficulty of the input.

The CTM restores that missing dimension. Rather than treating a forward pass as a single event, it unrolls an internal sequence of **thinking steps** over a fixed set of inputs. In our setup the convolutional backbone's temporal tokens become fixed key-value pairs, and at each thinking step the CTM cross-attends over them, updates its internal state, and produces a prediction. The clip does not change between steps; what changes is the model's own representation of it.

Two mechanisms distinguish it from simply running a recurrent network in place. First, **each neuron keeps its own short history** and uses private weights to process that history, so a neuron's activation depends on its own recent trajectory rather than only on the current input. Second, the model's working representation is **neural synchronization** (how neurons' activity correlates with each other over the thinking steps) instead of a snapshot of activations at one instant. Timing between neurons becomes the thing that carries meaning, which is a deliberate borrowing from biological neural dynamics that most modern architectures discard.

We also ran a variant with **Adaptive Computation Time** [[12]](https://arxiv.org/abs/1603.08983), a learned halting head that lets the model stop early on inputs it finds easy. The appeal for skating is obvious: a camel spin is unmistakable within a few frames, while a Flip-versus-Lutz call is exactly the kind of judgment that should earn more deliberation. Whether it delivered that is covered in the results.

## Results

### The leaderboard

Each model is scored three ways. Accuracy is the fraction of clips it gets right. Weighted-F1 tracks accuracy closely, because it counts each class in proportion to how often it appears. Macro-F1 averages the classes evenly, so a rare quad jump counts exactly as much as Sequence, which makes it the number to watch: it is the one that punishes a model for failing on the hard, rare jump classes.

**Coarse: 11 classes.** Identifying what kind of element happened, without counting rotations.

| Model | Params | Test Acc | Test F1 (macro) | Test F1 (weighted) |
| --- | --- | --- | --- | --- |
| **CNN + BiLSTM** | **3.77M** | **90.89%** | **0.851** | **0.909** |
| GCN | 7.24M | 90.40% | 0.839 | 0.904 |
| CTM-10 + adaptive | 2.18M | 89.79% | 0.826 | 0.899 |
| Transformer | 7.31M | 89.89% | 0.823 | 0.897 |
| CTM-10 | 2.18M | 89.29% | 0.816 | 0.893 |
| Transformer + BiLSTM | 8.20M | 86.79% | 0.800 | 0.868 |

**Fine-grained: 28 classes.** The same task with a rotation count attached to every jump.

| Model | Params | Test Acc | Test F1 (macro) | Test F1 (weighted) |
| --- | --- | --- | --- | --- |
| **CNN + BiLSTM** | **3.77M** | 86.89% | **0.505** | **0.870** |
| CTM-10 | 2.18M | **87.99%** | 0.495 | 0.875 |
| CTM-10 + adaptive | 2.18M | 85.59% | 0.477 | 0.857 |
| Transformer | 7.31M | 83.48% | 0.464 | 0.829 |
| Transformer + BiLSTM | 8.20M | 72.97% | 0.361 | 0.734 |

![fig06_leaderboard.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig06_leaderboard.jpg)

*Figure 7. Macro-F1 for all five architectures across both label spaces, coarse and fine. CNN + BiLSTM wins both, and the two largest models finish last in both.*

Three things stand out in these tables.

**Recurrence beats attention, with half the capacity.** CNN + BiLSTM and the Transformer share a backbone and a head and differ only in the temporal block. The Transformer has nearly twice the parameters and loses in both label spaces, by 2.8 points of coarse macro-F1 and 4.1 points of fine. Whatever a skating element's temporal structure is, an LSTM's built-in sense of order captures it better than learned positional attention does at this data scale.

**The convolutional backbone is what separates the strong models from the weak one.** Transformer + BiLSTM is the only model without one, and it is the worst model in the study by a wide margin: 0.361 fine macro-F1 against CNN + BiLSTM's 0.505, with the largest parameter count of anything we ran. Projecting raw features straight into an encoder does not replace local temporal feature extraction; it just costs more.

**Model size predicts nothing.** Parameter counts span 2.18M to 8.20M, a 3.8× range, while coarse macro-F1 spans only five points, from 0.800 to 0.851, ordered such that the two largest models sit at the bottom. Capacity is not the binding constraint here.

The CTM is worth its own paragraph, since it was the architecture we had the highest hopes for. At 2.18M parameters it is 42% smaller than CNN + BiLSTM and it competes closely, taking the best fine-grained accuracy of anything we ran at 87.99%, while giving up a point of macro-F1 in each label space. That specific combination is informative: strong accuracy with weaker macro-F1 means the model is doing well on the frequent classes and less well on the rare ones. So the thinking loop gets competitive accuracy out of 42% fewer parameters, and the ground it gives up is on the rarest classes, where the data is thinnest.

The adaptive-halting variant cannot be read as an adaptive-computation result at the setting we ran. With the iteration cap at 10 and the halting bias initialized to favour a longer budget, every sample used all ten steps: mean thinking steps on test came out at exactly 10.0 in both label spaces. The comparison between CTM-10 and CTM-10 + adaptive therefore measures the ponder-cost regularizer at fixed depth rather than learned depth. Testing whether halting behaviour emerges needs a higher cap, and we give these numbers without drawing a conclusion about adaptive computation from them.

### Per-class results: coarse

The aggregate numbers hide a sharp divide between element types, and that divide is what the rest of this section is about.

| Class | Support | CNN+BiLSTM | CTM-10 | CTM+adaptive | Transformer | Tfm+BiLSTM |
| --- | --- | --- | --- | --- | --- | --- |
| Sequence | 307 | **0.985** | 0.984 | 0.987 | 0.981 | 0.955 |
| CamelSpin | 125 | **0.984** | 0.976 | 0.972 | 0.976 | 0.963 |
| SitSpin | 132 | **0.969** | 0.937 | 0.957 | 0.945 | 0.944 |
| UprightSpin | 108 | 0.945 | **0.958** | 0.925 | 0.902 | 0.869 |
| Axel | 61 | 0.868 | **0.950** | 0.909 | 0.913 | 0.902 |
| NoBasic | 31 | **0.885** | 0.811 | 0.812 | 0.800 | 0.776 |
| Salchow | 30 | **0.833** | 0.654 | 0.656 | 0.571 | 0.690 |
| Loop | 31 | 0.814 | 0.753 | 0.783 | 0.767 | **0.818** |
| Toeloop | 77 | 0.746 | 0.688 | 0.742 | **0.793** | 0.676 |
| Lutz | 50 | 0.673 | 0.630 | 0.688 | **0.735** | 0.634 |
| Flip | 47 | 0.653 | 0.636 | 0.659 | **0.674** | 0.568 |

![fig07_perclass_coarse.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig07_perclass_coarse.jpg)

*Figure 8. Per-class F1 on the 11 coarse classes, one grouped bar per model. Spins and Sequence are solved for every model; the jump family is where all five lose points, and it is the same jumps every time.*

Read the rows, not the columns. Sequence and the three spins sit between 0.87 and 0.99 for **every** architecture: the spread across five very different models is smaller than the spread across classes within any one of them. Axel is close behind at 0.87 to 0.95. Then the floor drops: Flip, Lutz, and Toeloop sit between 0.57 and 0.79 no matter what you train.

### Per-class results: fine-grained

Adding a rotation count to every jump says the same thing more sharply. We split the 28 classes by how much test support they have, because below about twenty samples the numbers stop meaning anything.

**Classes with 20 or more test samples**

| Class | Support | CNN+BiLSTM | CTM-10 | CTM+adaptive | Transformer | Tfm+BiLSTM |
| --- | --- | --- | --- | --- | --- | --- |
| Sequence | 307 | 0.977 | **0.982** | 0.977 | 0.964 | 0.905 |
| SitSpin | 132 | 0.966 | **0.978** | 0.958 | 0.962 | 0.950 |
| CamelSpin | 125 | 0.960 | **0.972** | 0.972 | 0.950 | 0.849 |
| UprightSpin | 108 | 0.923 | **0.949** | 0.919 | 0.925 | 0.811 |
| 2Axel | 43 | 0.835 | 0.813 | 0.810 | **0.850** | 0.629 |
| 3Toeloop | 38 | **0.712** | 0.701 | 0.675 | 0.507 | 0.300 |
| 3Lutz | 41 | 0.525 | **0.667** | 0.651 | 0.357 | 0.175 |
| 3Flip | 36 | **0.612** | 0.552 | 0.587 | 0.452 | 0.384 |
| 2Toeloop | 32 | **0.825** | 0.806 | 0.679 | 0.714 | 0.571 |
| NoBasic | 31 | 0.794 | **0.877** | 0.844 | 0.824 | 0.588 |
| 3Loop | 21 | **0.870** | 0.773 | 0.634 | 0.694 | 0.606 |
| 3Salchow | 21 | 0.564 | **0.636** | 0.591 | 0.381 | 0.308 |

![fig08_perclass_fine_high.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig08_perclass_fine_high.jpg)

*Figure 9. Per-class F1 on the fine-grained classes with 20 or more test clips. Spins and Sequence hold above 0.81 for every model; once a rotation count is attached to a jump, nothing clears 0.87 and most sit far below.*

The spins barely notice the switch from 11 classes to 28: a spin is a spin regardless of how many revolutions get counted, so those classes are essentially unchanged. Every jump class drops. 3Salchow at 0.56 and 3Lutz at 0.53 are the same physical elements that scored 0.83 and 0.67 at coarse granularity; the only thing added was the requirement to count rotations.

**Classes with fewer than 20 test samples**

| Class | Support | CNN+BiLSTM | CTM-10 | CTM+adaptive | Transformer | Tfm+BiLSTM |
| --- | --- | --- | --- | --- | --- | --- |
| 3Axel | 15 | 0.857 | 0.690 | 0.595 | **0.867** | 0.688 |
| 2Flip | 8 | **0.625** | 0.364 | 0.615 | 0.400 | 0.167 |
| 2Loop | 8 | 0.609 | **0.706** | 0.444 | 0.600 | 0.462 |
| 2Lutz | 7 | 0.571 | 0.588 | **0.615** | 0.286 | 0.308 |
| 4Toeloop | 6 | 0.250 | 0.000 | **0.333** | 0.182 | 0.000 |
| 2Salchow | 5 | 0.400 | **0.800** | 0.571 | 0.333 | 0.400 |
| 1Axel | 3 | **0.857** | 0.000 | 0.000 | 0.333 | 0.000 |
| 4Salchow | 3 | **0.400** | 0.000 | 0.000 | 0.250 | 0.400 |
| 1Flip | 2 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| 1Loop | 1 | 0.000 | **1.000** | 0.500 | 0.667 | 0.400 |
| 1Toeloop | 1 | 0.000 | 0.000 | 0.400 | **0.500** | 0.000 |
| 1Lutz | 1 | 0.000 | 0.000 | 0.000 | 0.000 | **0.222** |
| 4Flip | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| 4Lutz | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| 4Loop | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |
| 1Salchow | 1 | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |

![fig09_perclass_fine_low.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig09_perclass_fine_low.jpg)

*Figure 10. Per-class F1 on the fine-grained classes with fewer than 20 test clips. Five classes score zero on every model and are omitted from the chart entirely: 1Flip, 4Flip, 4Lutz, 4Loop, and 1Salchow. What remains mostly shows why these numbers should not be read as a comparison.*

That second table is shown for completeness, not for conclusions. Seven of those classes have a single test clip, so one prediction moves F1 the whole way between 0 and 1: CTM-10's perfect 1.000 on 1Loop is one correct guess on one sample, and CNN + BiLSTM's 0.000 on the same class is one wrong guess. No architecture claim should rest on these rows. They are also most of why macro-F1 sits so far below accuracy in the 28-class space: macro-F1 weights a class with one clip exactly as heavily as Sequence with 307.

### The jump bottleneck does not depend on the architecture

Five architectures, spanning recurrence, attention, graph convolution, and a recurrent thinking loop, across a 3.8× range in parameter count. The error surface has the same shape in all of them. Sequence and the three spins sit at 0.87 to 0.99. Axel follows at 0.87 to 0.95. Then Flip, Lutz, and Toeloop sit between 0.57 and 0.79, and no model escapes that band.

The most informative way to read the per-class table is to compare its two axes. Across five architectures, Flip moves by only 0.11, from 0.568 to 0.674. Within any single architecture, the gap between Flip and Sequence is around 0.33. **The choice of class matters roughly three times more than the choice of architecture.** If the class you pick swings the score three times as much as the model you pick, then whatever is holding performance back is not in the model.

The reason is anatomical. Flip and Lutz differ by which blade edge is on the ice at takeoff. Toeloop and Loop differ by whether the toe pick assists the launch. Salchow and Loop differ by subtle body orientation on entry. Every one of those distinctions lives in the ankle and the blade, over a handful of frames, and the COCO-17 skeleton's most distal keypoint is the ankle itself. There is no keypoint for the foot, none for the blade, and no representation of edge at all. The information is not in the input, so no amount of modeling recovers it.

Two pieces of supporting evidence point the same way. Extraction resolution is one: moving from 256 to 384 pixels lifted the whole jump family by roughly 8 to 17 points of F1, a change to the input that no architecture swap came close to matching. Augmentation is the other: adding Gaussian noise to the GCN's input bought more than the gap between the best and worst architecture in this study. Both interventions act on what the model sees, not on how it reasons.

Class imbalance compounds it. Even at coarse granularity, Salchow has 613 total samples against Sequence's 6,099. Class-weighted loss keeps a model from ignoring rare classes outright, but it cannot manufacture discriminative signal that was never captured. The jump classes are simultaneously the hardest to tell apart and the least represented, which is the worst combination available.

## Temporal action localization

Everything above assumes clips are already trimmed to a single action. Phase 2 removes that assumption: given a full untrimmed program, find where each element starts and ends, then classify it. We ran initial experiments here, and the result was clean enough to be worth reporting even at this stage.

### Data is the bottleneck here too

SkatingVerse ships pre-trimmed clips and contains no temporal boundaries to learn from, because each clip *is* one action. For localization we needed footage where elements sit inside a longer timeline, along with ground truth for where they start and end. That came from two places: FS-Jump3D's multi-action combination clips, and a public corpus of 371 untrimmed competition programs with frame-precise takeoff and landing annotations covering 1,464 jumps and 373 spins. The corpus ships no video, since the footage is copyrighted competition broadcast, but it publishes video identifiers and frame numbers, so we reconstructed the footage from eleven YouTube broadcasts and aligned it against the annotations.

One detail from that reconstruction would have silently destroyed the experiment. Every annotation in the corpus is a frame number at 25 fps, so we verified all eleven broadcasts were genuinely 25 fps before using them. A 30 fps download would have shifted every label in the corpus, by a growing amount as the program went on, with nothing about the training run looking obviously broken. Checking frame rates before trusting reconstructed footage is exactly the kind of step that never shows up in a paper and quietly decides whether the whole experiment means anything.

The corpus also settled an open question from earlier work. It includes 338 labeled jump combinations, and their distribution is lopsided: the second jump is a Toeloop 92% of the time, and Loop-plus-Loop occurs exactly once in 338. An earlier exploratory classifier of ours had labeled nine of thirteen combination clips as Loop-plus-Loop. Against the real distribution, that was a classifier collapsing onto one class, not a finding.

### The setup

We compared two ways of teaching a model where elements are, and it is worth being clear about how differently they treat the problem, because the second is not a refinement of the first. They are opposite answers to the question of what the model gets told.

**CTC (Connectionist Temporal Classification)** [[13]](https://doi.org/10.1145/1143844.1143891) is weak supervision. Borrowed from speech recognition, it is given only an ordered transcript of what happened in a clip (Axel, then Lutz, then Toeloop) and never a single frame number. It recovers the alignment itself by summing over every possible way that transcript could map onto the timeline. Background is not even a class in this setup; CTC's blank symbol covers the 98% of frames between elements. The appeal is obvious when your datasets have no boundary annotations, which is where we started.

**Per-frame supervision** is full supervision. Every frame carries a label, derived from the annotated takeoff and landing frames, and the model is simply asked to classify each one. There is no alignment to recover because the alignment is the input. This is the ordinary approach, and it is only available once someone has done the expensive work of annotating boundaries.

That difference in what the model is told drives everything else. Per-frame supervision has two problems CTC does not, both consequences of background being a real class it has to predict. The 48-to-1 imbalance means an unweighted model predicts background everywhere and reports 97.9% frame accuracy while finding nothing, so it needs class weights. And classifying frames independently has no notion of a contiguous segment, so it produces speckle. A smoothing term [[14]](https://arxiv.org/abs/1903.01945) penalizes abrupt frame-to-frame changes in the prediction, truncated so that genuine boundaries are not penalized into oblivion. CTC needs neither, because it never predicts background and never emits frame-wise.

Everything else is held constant. Both models share the same encoder (three convolutional layers feeding a two-layer bidirectional recurrent network), the same features, the same 152 clips, and the same split, so any difference between them is the loss and not the model.

Splitting was done by broadcast rather than at random. Clips from one broadcast share a camera operator, a rink, and a lighting setup, and a random split would have leaked all of that across the boundary.

The class balance defines the difficulty:

| Class | Frames | Share |
| --- | --- | --- |
| Background | 636,928 | 97.9% |
| Toeloop | 3,894 | 0.60% |
| Axel | 3,061 | 0.47% |
| Lutz | 2,226 | 0.34% |
| Spin | 1,900 | 0.29% |
| Flip | 1,460 | 0.23% |
| Salchow | 520 | 0.08% |
| Loop | 311 | 0.05% |

![fig10_frame_balance.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig10_frame_balance.jpg)

*Figure 11. Frame-level class balance in the localization corpus, shown twice. The left panel includes background, which swamps everything at 97.9% of frames; the right panel drops background so the element classes become visible at all.*

Roughly 2% of the timeline contains an action. A model that predicts background everywhere scores 97.9% frame accuracy while finding precisely nothing.

### Per-frame supervision works, CTC does not

The gap between the two is not a matter of degree.

| Loss | Elements found | Of those, fraction correct | Timestamp error |
| --- | --- | --- | --- |
| CTC | **0.7%** | 1.2% | — |
| Per-frame supervision | **80.5%** | 82% | **0.08 s** (2 frames) |

![fig11_ctc_vs_dense.png](https://blog-cdn.mercity.ai/blog/classifying-figure-skating-elements-from-pose-estimation/fig11_ctc_vs_dense.jpg)

*Figure 12. Recall and precision for CTC versus per-frame supervision, trained on the same encoder and the same data. The two sit two orders of magnitude apart; the only thing that changed is what the model was told during training.*

Per-frame supervision worked, and worked quickly. On a broadcast it had never seen, the model found roughly three quarters of the elements at around 82% precision and placed them within two frames of where they actually happened. The smoothing term does most of the work in getting there. Early in training the model fires on individual frames and fragments a single jump into a dozen separate detections: it proposes 841 elements where 149 exist. As training continues those fragments merge into coherent segments, the count converges to 138 against 149 true elements, and precision climbs from 10% to 82% while timestamp error tightens from 0.46 seconds to 0.08.

CTC, the approach we tried first, found almost nothing. That is not underfitting. CTC's loss fell from 2.07 to 0.34, so it optimized its objective perfectly well. Looking at the predictions makes the failure obvious: CTC frequently recovered the *correct order* of elements in a program (Axel, then Lutz, then Toeloop) and then placed all of them inside the first 5% of the clip regardless of when they actually occurred. Across the validation clips, 73% of predicted elements land in the opening moments of a three-minute program.

This is CTC working exactly as designed. Its objective sums over every possible alignment of a transcript to a timeline, and there is no term in that sum that prefers one alignment over another. Emitting everything at frame zero contributes to the loss identically to emitting everything at the right time. The model has no reason to prefer the correct answer, so it does not. CTC was attractive precisely because it needs no timestamps. But the blocker was data access, not modeling approach, and the method designed to route around missing annotations could not deliver the thing we needed from it.

This remains a proof of concept, and the limits matter. The validation set is a single broadcast of 30 clips. The pose extraction ran at the low-resolution setting discussed earlier. Loop has 311 labeled frames in the entire corpus. None of that affects the comparison between the two losses, since both models saw identical data, but it does bound how far the absolute numbers should be trusted.

---

## Conclusion

Pose-based skeleton features carry a figure skating clip a long way, but not all the way. Spins, step sequences, and Axel jumps land between 0.87 and 0.99 F1 on every architecture we tested; Flip, Lutz, and Toeloop sit between 0.57 and 0.79 across five architectures spanning a 3.8x parameter range, and the class being predicted matters roughly three times more than the model predicting it. The smallest sensible architecture won: CNN + BiLSTM at 3.77M parameters, ahead of a Transformer with twice the capacity and an identical backbone and head. The CTM, meanwhile, took the best fine-grained accuracy of anything we ran at 42% fewer parameters. Adding a rotation count is a separate problem again: every jump class drops between the 11- and 28-class spaces while the spins barely move. On localization, per-frame supervision reached 80.5% recall at 82% precision with 0.08-second timestamp accuracy, while CTC recovered almost nothing: its objective sums over every alignment equally, so it has no reason to prefer the correct one.

Future work follows from where the ceiling actually sits, which is in the input. Raising pose extraction from 256 to 384 pixels moved the jump family by 8 to 17 points of F1, more than any architectural change here, and 640 recovers most of the takeoff and landing frames still being dropped. Past resolution, a Flip differs from a Lutz by which blade edge is on the ice, and COCO-17 has no keypoint below the ankle, so complementary non-skeleton features, optical flow or raw RGB around takeoff, are what would put that information in front of a model, with 3D pose lifting a second avenue. Rotation counting deserves a dedicated attempt, and the per-frame localization recipe extends directly to jump combinations. But the most persistent obstacle throughout was simply finding usable data: public skating datasets are scarce and not interchangeable: some ship trimmed clips with no boundaries, some publish frame numbers but no video, and label schemes differ enough that combining sources means reconciling taxonomies by hand. The class imbalance, meanwhile, is structural rather than fixable. Any team starting here should budget for data acquisition and verification as the main cost of the project, because that is what it turned out to be.

## References

1. M. Gan, et al. "SkatingVerse: A Large-Scale Benchmark for Comprehensive Evaluation on Human Action Understanding." *IET Computer Vision*, vol. 18, no. 7, 2024. [doi:10.1049/cvi2.12287](https://doi.org/10.1049/cvi2.12287)
2. R. Tanaka, et al. "3D Pose-Based Temporal Action Segmentation for Figure Skating: A Fine-Grained and Jump Procedure-Aware Annotation Approach." In *Proc. ACM Int. Workshop on Multimedia Content Analysis in Sports (MMSports '24)*, 2024. [arXiv:2408.16638](https://arxiv.org/abs/2408.16638) · [doi:10.1145/3689061.3689077](https://doi.org/10.1145/3689061.3689077) · [code](https://github.com/ryota-skating/FS-Jump3D)
3. Ultralytics. "YOLO11 Pose Estimation." Documentation, 2024. [docs.ultralytics.com/tasks/pose](https://docs.ultralytics.com/tasks/pose/)
4. V. Bazarevsky, I. Grishchenko, K. Raveendran, et al. "BlazePose: On-Device Real-Time Body Pose Tracking." arXiv preprint, 2020. The model behind MediaPipe Pose. [arXiv:2006.10204](https://arxiv.org/abs/2006.10204)
5. T.-Y. Lin, M. Maire, S. Belongie, et al. "Microsoft COCO: Common Objects in Context." In *Proc. European Conf. on Computer Vision (ECCV)*, 2014. Source of the 17-keypoint pose layout. [arXiv:1405.0312](https://arxiv.org/abs/1405.0312)
6. A. Savitzky and M. J. E. Golay. "Smoothing and Differentiation of Data by Simplified Least Squares Procedures." *Analytical Chemistry*, vol. 36, no. 8, pp. 1627–1639, 1964. [doi:10.1021/ac60214a047](https://doi.org/10.1021/ac60214a047)
7. S. Hochreiter and J. Schmidhuber. "Long Short-Term Memory." *Neural Computation*, vol. 9, no. 8, pp. 1735–1780, 1997. [doi:10.1162/neco.1997.9.8.1735](https://doi.org/10.1162/neco.1997.9.8.1735)
8. A. Graves and J. Schmidhuber. "Framewise Phoneme Classification with Bidirectional LSTM and Other Neural Network Architectures." *Neural Networks*, vol. 18, no. 5–6, pp. 602–610, 2005. [doi:10.1016/j.neunet.2005.06.042](https://doi.org/10.1016/j.neunet.2005.06.042)
9. A. Vaswani, N. Shazeer, N. Parmar, et al. "Attention Is All You Need." In *Advances in Neural Information Processing Systems (NeurIPS)*, 2017. [arXiv:1706.03762](https://arxiv.org/abs/1706.03762)
10. T. N. Kipf and M. Welling. "Semi-Supervised Classification with Graph Convolutional Networks." In *Proc. Int. Conf. on Learning Representations (ICLR)*, 2017. [arXiv:1609.02907](https://arxiv.org/abs/1609.02907)
11. L. Darlow, C. Regan, S. Risi, J. Seely, and L. Jones. "Continuous Thought Machines." Sakana AI, 2025. [arXiv:2505.05522](https://arxiv.org/abs/2505.05522) · [project page](https://pub.sakana.ai/ctm/) · [code](https://github.com/SakanaAI/continuous-thought-machines)
12. A. Graves. "Adaptive Computation Time for Recurrent Neural Networks." arXiv preprint, 2016. [arXiv:1603.08983](https://arxiv.org/abs/1603.08983)
13. A. Graves, S. Fernández, F. Gomez, and J. Schmidhuber. "Connectionist Temporal Classification: Labelling Unsegmented Sequence Data with Recurrent Neural Networks." In *Proc. Int. Conf. on Machine Learning (ICML)*, 2006. [doi:10.1145/1143844.1143891](https://doi.org/10.1145/1143844.1143891)
14. Y. Abu Farha and J. Gall. "MS-TCN: Multi-Stage Temporal Convolutional Network for Action Segmentation." In *Proc. IEEE/CVF Conf. on Computer Vision and Pattern Recognition (CVPR)*, 2019. Source of the truncated-MSE smoothing loss. [arXiv:1903.01945](https://arxiv.org/abs/1903.01945)
