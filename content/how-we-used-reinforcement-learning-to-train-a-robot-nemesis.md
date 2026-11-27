---
title: How We Used Reinforcement Learning to Train a Robot Nemesis
metaDescription: >-
  We trained a game enemy with RL. It went from refusing to move to finding a
  hidden, fixed target in 96.5% of rounds. Then we built a game around it.
slug: how-we-used-reinforcement-learning-to-train-a-robot-nemesis
publishedAt: '2026-11-26'
summary: >-
  We used reinforcement learning to train a six-legged enemy robot inspired by
  the Leaper from Arc Raiders, then built a game around it. Along the way it
  learned that standing still was safest, walked backwards 80% of the time, and
  farmed points by re-spotting its target. The brain that shipped finds a hidden
  target that stays in place in 96.5% of rounds.
authors:
  - name: Sneha
tags:
  - Reinforcement Learning
  - PPO
  - Game AI
category: Reinforcement Learning
isTopPick: false
image: >-
  https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/leaper-title-screen.jpg
jsonld:
  abstract: >-
    Mercity used PPO in Stable-Baselines3, with a Gymnasium environment and a
    Three.js prototype, to train the brain of a six-legged enemy robot inspired
    by the Leaper from Arc Raiders, then built a playable game around it. The
    policy chooses only throttle and turn on a flat plane while the legs are
    animated. Along the way it learned that standing still was safest, walked
    backwards 80% of the time and farmed points by re-spotting its target. Eight
    distance rays lifted success from 5% to 69%, and the shipped brain, a
    network with an LSTM, 34 inputs and 72,517 parameters, finds a hidden target
    that stays in place in 96.5% of rounds.
  about:
    - name: Reinforcement learning
      sameAs: https://en.wikipedia.org/wiki/Reinforcement_learning
    - name: Proximal policy optimization
      sameAs: https://en.wikipedia.org/wiki/Proximal_policy_optimization
    - name: Reward hacking
      sameAs: https://en.wikipedia.org/wiki/Reward_hacking
    - name: Reward shaping
    - name: Artificial intelligence in video games
      sameAs: >-
        https://en.wikipedia.org/wiki/Artificial_intelligence_in_video_games
    - name: Behavior trees
      sameAs: >-
        https://en.wikipedia.org/wiki/Behavior_tree_(artificial_intelligence,_robotics_and_control)
  keywords:
    - train a game enemy with reinforcement learning
    - reward hacking examples
    - reward design for RL navigation
    - Stable-Baselines3 PPO
    - Gymnasium custom environment
    - distance ray observations for RL agents
    - sparse vs dense rewards
    - RL agent learns to stand still
    - recurrent PPO policy with LSTM
    - behavior trees with a trained policy
    - Arc Raiders Leaper
  citation:
    - name: Leaper Jr. (playable game)
      url: https://leaper.mercity.ai
      type: page
  faq:
    - q: >-
        Why did the reinforcement learning robot learn to stand still?
      a: >-
        By the eighth run, after more than 300,000 steps, the Leaper, Mercity's
        RL-trained game enemy, chose zero forward throttle on 98.85% of steps,
        because moving risked bump penalties while standing still cost only the
        small time penalty. Letting throttle run from -1 to 1 instead of 0 to 1
        took stopped steps to zero: the raw output was clipped to the allowed
        range, so every negative output had become exactly 0, which meant stop.
    - q: How much did giving the RL agent sight improve it?
      a: >-
        Adding 8 distance rays, one every 45 degrees and reading up to 12 units,
        lifted the success rate of the Leaper, Mercity's RL-trained game enemy,
        in deterministic evaluation from 5% to 69%, cut bumping from 38.9% to
        24.5% of steps and shortened rounds from 382 to 164 steps. Retrained
        twice from different random starts it scored 54% and 39%, all well over
        the blind 5%, though Mercity never told it to avoid anything.
    - q: Does a bigger penalty stop an RL agent from getting stuck?
      a: >-
        In Mercity's runs with the Leaper, its RL-trained game enemy, raising
        the bump penalty from 0.18 to 0.5 made it timid: forward movement fell
        from 74% to 46% and deep jams stayed. A stuck rule that ended the round
        with a penalty of 10 after 40 steps without progress worked instead, and
        with 16 rays and a small charge for standing still the Leaper reached
        the target, whose position it was given, in 91.3% of 1,000 unseen mazes.
    - q: What reward hacking did the RL robot find?
      a: >-
        Besides learning that standing still was safest, the Leaper, Mercity's
        RL-trained game enemy, found a loophole once the target was hidden. Paid
        0.5 for spotting the target, it circled at the edge of its sight to spot
        it again and again, 15 times in one round while moving 1 unit closer.
        Mercity fixed it by paying only for the first sighting.
    - q: How does the trained RL brain work inside the game?
      a: >-
        The RL policy drives the Leaper, Mercity's game enemy, only in Search
        and Chase; hand-written modes such as Engage, Stomp, Leap, Stagger and
        Downed pause it, while its memory of where it last saw the player keeps
        updating. The shipped brain finds a player crouching behind nearby cover
        about 4 times in 10, so a hand-written Track mode walks to the last
        known position, which raised re-finding within 30 seconds from 85% to
        96% in 80 hiding tests.
    - q: >-
        How can Mercity help with training custom reinforcement learning agents?
      a: >-
        Mercity designs and trains custom models for problems that off-the-shelf
        model APIs cannot solve, including reinforcement learning agents trained
        in purpose-built simulated environments with careful reward design and
        testing on unseen cases. The Leaper is open work of this kind, published
        as a playable game and a run-by-run training log, and Mercity has a lot
        of experience training custom models for many clients and taking them to
        production. Every project starts with an evaluation built for the task,
        so each change is measured against a baseline.
---

You turn around and a big red eye is peering right through your soul. It is the six-legged Leaper from Arc Raiders scaring you out of your wits. And naturally we thought: we want one of our own. Embark Studios’ BTS gave us a glimpse into RL trained robots. We had never trained a model or designed a game, so everything here was learned along the way. <br />Looking back, we thought it was crazy that a robot can just be handed a task (goal) and it somehow figures it out like a human brain learns to walk. But we rather had a lot to unfold. Tag along, This is the rise of our Leaper Jr..

Leaper Jr. now hunts players in a game we built around it, and you can play it here: [leaper.mercity.ai](https://leaper.mercity.ai).

## Our Aim: Train an Enemy That Decides for Itself

The goal was an enemy built on Reinforcement learning that actually navigates with a brain, knows how to move, and hunts down the player. The OG Leaper in Arc Raiders stays our inspiration. We wanted to find out how something like that could be made.

We wanted a real environment, real obstacles to get stuck on and, at the end of it, a real game where a player could fight it. This is the log of how our leaper learned its way into that game.

![Our Leaper, a six-legged robot with a single red eye, standing in the junkyard level among containers, wrecked cars and scrap.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/leaper-in-the-junkyard.jpg)

## The Jargon We'll Use Often

- **The Policy (the brain)**: the thing that is being trained. This brain is making the decisions like "where it is", "where's the target" for the six-legged body. We can very well give it to another body and the brain should work fine.
- **Neural network**: the very neurons that the brain is made of. We are using MLP, the Multi-Layer Perceptron. We give it the info from one side, it does its "layered analysis" and we get a decision on the other side. The final brain is a plain network with an LSTM (Long Short Term Memory) beside it.

> 💡 The most simplified and goated explanation of the neural network: [https://youtu.be/ER2It2mIagI](https://youtu.be/ER2It2mIagI?si=LwAK8n4kPCk5lMKd)

- **PPO**: Proximal Policy Optimization, the algorithm that trains the brain. PPO actually runs two networks: the **actor** (the brain that picks every move) and the **critic**, which only watches and predicts how many points the Leaper is about to earn. After each round, PPO checks every move: better or worse than the critic expected? Good moves get pushed up, bad ones down, but only a little at a time: once a move's chance has shifted about 20%, PPO stops pushing. That's the "proximal" part. It's our coach: strict, steady, never lets the brain get ahead of itself.
- **Reward and Penalty**: The brain needs numbers. Bigger number = good. A reward is a number that goes up. A penalty is a number that goes down. The goal is ours; the brain just wants to collect the numbers, and it is we who bribe the brain into it.
- **A Step**: as the name suggests, it's very much like a human step. We look, decide, move. The Leaper does the same, and at every step it finds out if that step went well. When we say we trained it at 100k steps, the Leaper is doing this loop 100k times.
- **Round**: This is our one full attempt towards reaching the target. It can end in a win or run out of the clock. One episode allows 400 steps. PPO collects these multiple rollouts and updates the brain on what is "right".
- **Entropy Coefficient**: The higher the Entropy Coefficient, the higher the brain's tendency to try weird, chaotic and new tricks. Low means playing it safe, which means a reliable path but it can get stuck in a tussle. This is our Mountain Dew level.

## We Started the Training with a Simple Blockout

In 3D work, we would not begin a scene with eyelashes and fingernails. We would begin with a blockout that gives us a good and malleable silhouette to work with. Similarly, we needed a blockout of the achievability of the project. We kept it simple; as more obstacles and a bigger arena means much slower training. We wanted to keep an close eye on which changes helped us and what made it poor. We built a proof of concept using Three.js.

This included:

- **A bounded world**: irregularly spread out obstacles, the pyramids and spheres
- **A procedural six-legged Robo**: the concept is obviously straight from THE LEAPER
- **Cameras**: three different views, a top-down camera (behind the Leaper), a static camera looking over the ground, and the Leaper's vision
- **Controls**: simple game commands for moving left, right, front and back
- **A bright pink cuboid**: our goal, our target.

![The Three.js proof of concept from above: a procedural six-legged robot, scattered rounded obstacles and the pink target.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/threejs-blockout.jpg)

There we had a 3D hexapod walking across the field. The learning itself lived in Python: Gymnasium to build the practice world, Stable-Baselines3 for PPO and TensorBoard for the graphs.

### What it was really learning

There is one thing we should be honest about. On screen, the Leaper was a 3D hexapod walking across a field. It was easy to look at that and say we were training a six-legged robot to walk. We were not. The brain only chose two things, throttle (forward or back) and turn, on a flat plane. The legs were animated over that path. No joints, no balance, no falling. A little embarrassing, but it is what made the project achievable.

## We Rewarded Progress, Not Just the Finish Line

Our first instinct was to reward the Leaper only when it touched the pink target; something we call **sparse rewards**. it does work when we are training our our model to say - win a chess game. The problem was that a distant reward did not tell a randomly moving robot which of its thousands of bad actions were slightly less bad. It could wander for a long time without ever experiencing success. But we needed results faster.

So we added a progress signal. If the Leaper got closer to the target during a step, it got a small positive number. If it got farther away, a small negative one. The scorecard we eventually settled on:

- **+0.2 × (distance before − distance after)**, every step
- **−0.01** for every step, so time always costs something
- **−0.18** for every bump
- **+25** for reaching the target

### Exploring in training, exploiting in the exam

The early runs looked promising. One important distinction to make note of is that while training, it does not always choose the action it considers best. Sometimes it tries a less likely action so it can discover something new. This deliberate experimentation is called stochastic behavior. “Stochastic” simply means that some randomness is involved. Because of that randomness, a training replay may occasionally look brilliant. Leaper might reverse away from a rock, turn perfectly, and reach the target. But that could be a lucky combination of exploratory actions rather than something its policy has reliably learned. Deterministic evaluation removes that deliberate randomness. Deterministic evaluation removes that randomness: the Leaper picks its best-known move every single step. We call this the exam, and every success rate from here on is an exam score, not a lucky replay.

Our second training run reached **60% success** when only the body could collide. It was one of our strongest earlier runs. Moving ahead, we made collision more realistic: the body plus 'three points along each of the six legs', 19 points in total. Alas, Our performance collapsed to 4–7%. Frustrating, but useful. The 60% did not disappear mysteriously. We had changed the problem.

![The robot as the brain sees it: one large circle for the body plus three points along each of the six legs, 19 collision points in all.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/nineteen-collision-points.jpg)

## Why Did the Robot Think That Standing Still Was the Best Option

By the eighth run, after more than 300,000 steps, the Leaper barely moved. In the exam its forward throttle was zero on 98.85% of steps, and 100 out of 100 rounds ran out of time.

It meant the brain had learned that movement was dangerous. Moving could lead to bump penalties. Standing still only cost the small time penalty. From the Leaper's perspective, doing nothing was not laziness. It was the safest available strategy. This was our first taste of **Reward Hacking**: the brain finds a way to score well that we never meant. Leaper basically went, “If i don’t try, i don’t lose.” A bigger reward at the target would not have changed anything either; the target was only about 40 straight steps away. It wasn't lost. It was scared of the negative numbers.

We tried memory first. The ninth run let the Leaper remember its last bump and its last move, and nothing else changed. It still chose zero throttle on every single step.

### Reverse to the Rescue

Then the tenth run changed one thing. Until then, throttle only went from 0 to 1. Now it went from −1 to 1: negative meant reverse, zero meant stop and positive meant forward. Stopped steps fell from almost** 100% to zero**. The Leaper used both directions, about 55% forward and 45% reverse, and succeeded in **5%** of exam rounds. Small, but it was finally moving.

We only understood why much later. The brain gives out a raw number, which is then clipped to the allowed range. With throttle allowed only from 0 to 1, every negative thought it had became exactly 0, which meant stop. Allowing reverse moved "stop" away from the edge.

![TensorBoard charts for runs 7 to 10: mean episode length, mean episode reward and success rate over training steps.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/tensorboard-runs-7-to-10.jpg)

![PPO training reward per episode with a 20-episode mean, above the deterministic evaluation's mean reward and success rate over 100,000 training steps.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/ppo-training-reward.jpg)

## Giving the Robot Sight Was Our Best Decision

Up to this point the Leaper knew where the target was, but it was blind to everything around it. The eleventh run gave it eyes: 8 distance rays, one every 45° around the body, each telling it how far away the nearest obstacle or wall was, up to 12 units. Think of them as little rangefinders.

We never told it to avoid anything. It only got the readings and the same −0.18 for a bump. That was enough. Success jumped from **5% to 69%**, bumping fell from 38.9% to 24.5% of steps, and rounds got much shorter, 164 steps instead of 382. It even beat the old 60% from the easier body-only world.

To make sure this wasn't luck, we trained it two more times from different random starts: 69%, 54% and 39%. Every one of them was far above the blind 5%. The eyes were the cause.

There was one funny side effect. The Leaper walked backwards 80% of the time. Backing towards the target scored exactly as well as facing it, so why bother turning around? Fair enough, honestly.

![Run 11 in an exam round: eight blue distance rays around the Leaper as it backs its way to the pink target.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/run-11-eight-rays.gif)

## A Lot More Changes in the Reward System

Now that it could see, we made its world harder: bigger maps with 10 obstacles in a new random layout every round, and later dense maps with 51 obstacles. In the dense maps it started getting stuck again.

The usual fix is to punish bumps harder, so in the fifteenth run we raised the bump penalty from 0.18 to 0.5. It became timid. Forward movement fell from 74% to 46%, and the deep jams stayed. A bigger punishment bought fear, not skill.

### The stuck rule

What worked instead was a stuck rule. If the Leaper pushed into something for 40 steps without progress, the round ended with −10. Jams were now capped at 43 steps, and it learned to avoid dead ends instead of sitting in them.

### Human eyes

Then came the eyesight. We made its sight more human: a 270° cone in front, blind only to a wedge behind it, and forward-only walking so it turns to face where it goes. That got us to 75%. We also tested a memory network and a much bigger brain, and at this stage neither did better. That told us thinking power was not the problem. So we sharpened its eyes instead: 16 rays instead of 8.

The last piece was a clock. If the Leaper stood still for more than 3 steps in a row, it paid −0.04 for every extra step, while quick turns on the spot stayed free. That cost sits between the step cost and the bump cost, so ramming a wall is never better than standing still. It was enough. Across four training runs it scored 89, 92, 93 and 92%, and on 1,000 brand-new mazes it had never seen, **91.3%**. It had learned the skill, not the test.

Curiously, letting it see further made it worse (82%). In a dense map, almost every long ray hits clutter far away, so open doorways stop looking open.

![How often the robot reached the target, run by run, from 60% in the body-only run to 91.5% in run 25.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/success-rate-by-run.jpg)

![Exam success with 8 rays versus 16 rays: the 8-ray runs average 77%, the 16-ray runs 81.5%, with the best at 87%.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/eight-vs-sixteen-rays.jpg)

![Run 25 in an exam round: 16 rays in a 270° cone, walking forward through a maze of 51 random rocks it has never seen.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/run-25-unseen-maze.gif)

## Major Turn of Events

This is something we only realised after hitting 91%. From the very first run, the Leaper had been given the target's direction and distance as one of its inputs. At every step, it knew exactly where the pink box was. Its only job was to get there.

That is not what an enemy does. An enemy has to find you first. Our whole mission was a Leaper that seeks, and what we had trained so far was a Leaper that reaches. The 91% was real, but it was **91% at reaching, not at seeking**.

So the cheat had to go. From the 27th run onwards, the target stayed hidden until the Leaper actually saw it inside its cone, and after that it only remembered where it had last seen it.

### Reward hacking Pt. 2

God forbid the Leaper abides by any of your instructions. Turns out, it found a loophole straight away. We gave it +0.5 for spotting the target, and it learned to circle at the edge of its sight, spotting the target again and again for points. In one round it spotted the target 15 times and moved 1 unit towards it. NGL, Impressive. We fixed it by paying only for the first sighting.

### Learning to search

Searching was the hard part. We gave it points for exploring new ground, and it turned into a professional wanderer, collecting new ground and nothing else. A small note telling it the direction of the biggest unexplored area worked better. Success settled around 70–72%. keep in mind this is a much harder test than before, so it is not a step back.

![Four rounds on a cleared map: green marks ground the Leaper has checked and amber the blind spots, with its path to the target in orange.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/explored-ground-map.jpg)

![The unexplored-area note: an arrow from the Leaper points to the largest unchecked region, before and after 120 steps of following it.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/unexplored-area-note.jpg)

## Then Ten Million Steps of Practice on a Hidden Target as Its Final Test

Once the Leaper could search, we gave it one last, long round of practice: 8 different designs, each trained for about 10 million steps. But the one most worth mentioning here is Run 6, **"reverse + urgency"**, because that is the brain that went into the game.

The tenth run had already given the Leaper a reverse gear. But when we made its sight human, we also made it walk forward only, so it would always turn and face where it was going. We had taken reverse away so it wouldn't walk into its own blind spot. In the long runs we tested bringing it back, and the version with reverse won. A Leaper that can back up has one more way out of a tight corner instead of pivoting on the spot.

The "urgency" part changed how we priced time. In the other designs, once the Leaper had spotted the target, each step cost only 0.002. In Run 6, it cost 0.01, five times more. Searching could stay patient, but the moment it saw the target, dawdling got expensive. It had a reason to hurry.

### The brain that shipped

Run 6 was saved at **7,757,824 steps**: a brain with 34 inputs and 72,517 numbers inside it. On a target that stays in place, it succeeds in **96.5%** of rounds. This is the brain that went into the game, locked and fingerprinted so it can't be changed by accident.

And yes, this brain has memory. Back when the Leaper always knew where the target was, a memory network didn't help. Once the target was hidden and the Leaper had to search, we brought memory back: the final brain is an <br />a plain network with an LSTM beside it, a network that carries a little of what it saw from one step into the next.

Those 34 inputs are everything the Leaper knows about the world at each step:

| What it reads | What it tells the Leaper |
| --- | --- |
| Where it last saw the target, and how long ago | Its memory of the target, since it can't see it all the time |
| Which way it is facing | Its own direction in the world |
| 16 wall-distance rays | How far the nearest obstacle or wall is in each direction of its sight cone |
| The unexplored-area note (5 numbers) | The direction, distance and size of the biggest area it hasn't checked yet |
| Its last move | The throttle and turn it chose on the step before |
| Its own actual motion | How it really moved, since a bump can stop it from doing what it asked |
| Whether it can see the target right now | On or off, every step |
| Whether it bumped into something last step | So it knows when it's pressed against a wall |

![How rounds end on the same 200 development mazes for each brain design: arrived, stuck, frozen or timed out, before and after finding the target.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/how-rounds-end.jpg)

## The Final Scorecard

Our first scorecard had four lines. By the time the Leaper had to find the target on its own, it had grown into this. These are the exact rewards and penalties the brain in the game was trained on:

| What happens | Points | Why it's there |
| --- | --- | --- |
| Reaches the target | **+25**, round ends | The whole point |
| Sees the target for the first time | **+0.5**, once per round | Rewards finding it. Paid only once, because it learned to circle and re-spot the target for points |
| Before first sight: steps onto a new 3 × 3 patch of ground | **+0.01** | Nudges it to cover new ground |
| Before first sight: looks at a place from a new angle | **+0.002** | A small push to look around, not just walk |
| Before first sight: faces a direction it hasn't faced yet | **+0.01**, up to one full spin | "Just one spin" to look around when it's lost |
| Before first sight: gets closer than it has ever been | **+0.1** per unit | Only ever positive, so it is never punished for searching the wrong way |
| After first sight: gets closer / further | **+0.2 / −0.2** per unit | The same both ways, so circling around can't farm points |
| Every step before seeing the target | **−0.002** | Searching can take its time |
| Every step after seeing the target | **−0.01** | The urgency: once it sees you, dawdling gets expensive |
| Bumps into a wall or obstacle | **−0.18** | Learn to avoid bumping |
| Stands still looking at nothing new for more than 15 steps | **−0.04** per step | Worse than a normal step but cheaper than a bump, so it never rams a wall just to keep moving |
| Stuck: pushes into something for 40 steps without moving | **−10**, round ends | Ending a round is never an easy way out |
| Frozen: doesn't move for 60 steps (turning on the spot still counts) | **−10**, round ends | Looking around is fine, going nowhere isn't |
| Runs out of time | Round ends at **1,000 steps** | No extra penalty |

### Training settings

A few training settings sat behind this scorecard too. The entropy coefficient, our Mountain Dew level, stayed at **0.01**: enough for the Leaper to keep trying new things without turning chaotic. The discount (gamma) was **0.995**, which means a reward 100 steps away is still worth about 60% of one right now, so the Leaper plans ahead instead of only chasing what is right in front of it.

## The Leaper Now Has a Junkyard to Hunt

A brain like this needed a real place to hunt, so we built it one. The Leaper's new home is a junkyard: shipping containers, wrecked cars, corners, dead ends and scattered debris, all modelled and textured in Blender. Our first layout felt too mushed together, so we spread the scrap out to leave room for proper routes for our Leaper to walk in, cover to hide behind and long sight lines to get caught in. The finished yard is about 78 × 73 units and closed on all four sides, so there is no running off the map.

### How the brain sees the yard

The thing is, the Leaper doesn't see the yard the way we do. It has never learned what a container or a car looks like. All it knows are its rays and its bumps. So the 3D yard is flattened into a fine collision grid, 0.1 units per square, where every square is either free or blocked. To the brain, the junkyard reads exactly like its old practice arena, just bigger and a lot messier. The first time we let it loose, it walked and searched a level it had never seen before.

A few things were tuned for the yard. Some scrap is simply too low to matter for something with six long legs, so 36 pieces of low junk were left out of its walking map, and it just steps over them. Its sight range was also stretched to suit a yard this size.

![Inside the junkyard: a crane, a camouflage container and a pile of scrap.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/junkyard-yard.jpg)

## Designing the Fight Around a Trained Brain

As much as this was our first time with reinforcement learning, it was also our first time designing a game. So everything you see in the game is something we learned while making it. Here is how it came together.

### Lola and her M416

Now the Leaper needed someone to hunt. Lola is our player character. She can run, crouch, jump and shoot, and sprint.

<div style="display: flex; gap: 12px; align-items: flex-start; margin: 1.9em 0;">
  <img src="https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/lola-sketch.jpg" alt="Concept sketch of Lola, the player character, with short blue hair." loading="lazy" style="flex: 1 1 0; min-width: 0; margin: 0;" />
  <img src="https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/lola-rig.jpg" alt="Lola's 3D model in Blender with her skeleton rig showing." loading="lazy" style="flex: 1 1 0; min-width: 0; margin: 0;" />
</div>

She has her vey own \* *cough cough \* M416*. Her gun has a 20-shot spray pattern in the style of CS2, so holding the trigger, you can expect slight irregularities in the shots as in real life. She can sprint for 10 seconds, and then she is winded for 4, so running away is a decision, not a free escape.

### Ammo and health pickups

Then came the question of Ammo. With unlimited bullets, the fight would be boring: stand in one spot, hold the trigger, kill the Leaper, done. So instead of unlimited ammo, we gave Lola limited magazines and scattered collectibles around the yard. Blue pills give back 10% of her health, and yellow bullets give her 2 more magazines. Now the fight is not only about killing the Leaper, but about moving through the yard to stay alive and stocked up, right where the Leaper is hunting you. Both pickups were modelled in Blender.

<div style="display: flex; gap: 12px; align-items: flex-start; margin: 1.9em 0;">
  <img src="https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/health-pill.jpg" alt="The health pickup: a red and blue pill." loading="lazy" style="flex: 1 1 0; min-width: 0; margin: 0;" />
  <img src="https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/ammo-pickup.jpg" alt="The ammo pickup: a single red bullet with a gold tip." loading="lazy" style="flex: 1 1 0; min-width: 0; margin: 0;" />
</div>

### How the Leaper sees her

In training, "seeing" the target was a simple check on a flat map. In the game, the Leaper's sight moved up to eye level. Three lines go out from its red eye to Lola's head, upper body and lower body, and each one is checked against the real 3D yard. If a container blocks all three, she is hidden. So crouching behind cover actually works.

### Who decides what

This is where behaviour trees come in. The trained brain has exactly one job: getting around the yard, searching for Lola and chasing her. Everything to do with fighting is written by hand.

On top of the brain we wrote a set of modes the Leaper switches between: Search, Chase, Engage, Stomp, Leap, Stagger and Downed. The brain only drives the body in Search and Chase. The moment the Leaper decides to fight, the brain is paused and the hand-written part takes over. The brain stops steering, but it keeps watching: its memory of where it last saw Lola keeps updating through the whole fight. When the fight is over, the brain picks up where it left off. The hand-written part can pause the brain, wake it up, or tell it where it landed after a leap, but it never feeds the brain anything false about what it sees.

Shooting itself is a small behaviour tree: see her, line up, warn her with a bright eye, lock on, fire. That warning glow and the noise is Lola's cue to move.

![How the Leaper switches modes: the RL brain drives Search and Chase, and a hand-written game layer drives Investigate, Engage, Stomp, Leap, Stagger and Downed.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/leaper-mode-switching.jpg)

For instance, if Lola hides and shoots the Leaper from cover, the brain has no idea. It never learned what a gunshot is. Player expects an enemy to come for them when they shoot it. So the game layer pauses the brain, walks the Leaper to the nearest spot it can see the shot’s origin from, and hands control back. Teaching the brain to “hear” would mean new inputs, a new brain and millions of new training steps. A few inputs were more viable to give players a better feel of the game.

### How the Leaper takes a hit

The Leaper's weak point is its legs. Shoot a knee enough and that leg breaks, curls up and hangs off the body. Every lost leg slows it down. Lose four, and it falls for about 6 seconds and takes 1.5× damage while it is down, which is the moment to unload everything. And if it loses every standing leg on one side, it tips over for good.

### Getting the game to 60 FPS

A frame took 50–58 ms (about 17–20 frames a second). Baking the ground and wall detail into textures once, plus switching to FXAA (Fast Approximate Anti-Aliasing), which smooths jagged edges in one quick pass over the finished image instead of drawing everything at extra detail, brought it down to 16–18 ms (60 fps)

For the soundscape, we used a lot of free sounds to build a proper fight ambience. When we couldn't find the sounds we needed for our characters, we recorded our own.

## Where it Stands

The shipped brain navigates the yard well, but it's weak at finding a player who's hiding. When Lola crouches behind nearby cover, the Leaper finds her about 4 times in 10.We tried brains trained on a moving, hiding target, extra inputs for her direction and speed, a bonus for re-finding her, and millions more training steps. They got stuck less, but none were better at finding her behind cover.

Track mode does that job instead, and it's written by hand. When Lola breaks line of sight, the Leaper walks to her last known position and fires as soon as it sees her again. In 80 fixed hiding tests, re-finding her within 30 seconds went from 85% to 96%.

![How the Leaper switches modes after adding Track: when Lola breaks line of sight, it walks to where it last saw her.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/leaper-mode-switching-with-track.jpg)

At last, our game was readyyy. The Leaper finally had someone to hunt - YOU

![The Leaper game's title screen, with Play, Settings and Credits, beside the Leaper in the junkyard.](https://blog-cdn.mercity.ai/blog/how-we-used-reinforcement-learning-to-train-a-robot-nemesis/leaper-title-screen.jpg)

TRYYYY it out >>>>>>

[https://leaper.mercity.ai/](https://leaper.mercity.ai/)
