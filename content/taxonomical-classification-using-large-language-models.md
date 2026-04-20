---
title: Taxonomical Classification Using Large Language Models
slug: taxonomical-classification-using-large-language-models
publishedAt: '2026-04-19'
summary: >-
  A practical guide to taxonomical classification with LLMs — covering zero-shot
  and few-shot prompting, embedding-based retrieval, and fine-tuned transformer
  approaches, plus system design patterns for flat vs hierarchical vs level-wise
  vs joint training. Grounded in a large-scale product categorization experiment
  with BERT that shows which design choices actually improve accuracy on
  long-tail leaf categories at scale.
authors:
  - name: Maithili Badhan
tags:
  - Classification
  - Hierarchical Classification
category: Research
isTopPick: false
image: >-
  https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/intro.jpg
---

Modern digital systems generate large volumes of unstructured and semi-structured text, including product data, support tickets, documents, queries, and logs. Although this data contains useful signals, machines struggle to organize, retrieve, and reason over it without a semantic structure. As scale increases, this limitation degrades search, analytics, personalization, and automation efficiency. To impose structure, organizations use taxonomies, hierarchical category systems that organize information at increasing levels of specificity. Taxonomies enable conceptual understanding beyond raw text, supporting consistent organization, aggregation, and scalable decision-making across large and evolving datasets.

Large Language Models (LLMs) provide richer semantic representations of text by capturing context, synonymy, and abstract relationships. This makes them well-suited for taxonomical classification, where semantic alignment and hierarchical consistency matter more than exact keyword matching. Compared to rule-based or shallow feature-based systems, LLM-based classifiers scale more effectively with both data volume and taxonomy size. This blog examines how taxonomical classification is implemented using LLMs, with an emphasis on practical system design. The discussion is grounded in a large-scale product categorization experiment, highlighting which design choices improve performance.

# What is Taxonomical Classification?

Taxonomical classification is the task of assigning an item, such as a product, document, or query, to a hierarchical set of labels rather than a single flat category. A taxonomy organizes concepts into multiple levels, moving from broad groupings to increasingly specific ones. Each level adds semantic depth, allowing systems to reason about data at different granularities depending on the use case. For example, instead of labeling a product simply as Headphones, a taxonomy-aware system may classify it as Electronics → Audio → Headphones. This hierarchy encodes relationships between categories, enabling systems to understand that all headphones are audio devices, and all audio devices belong to electronics. The structure itself carries meaning beyond individual labels.

![                                                          Fig. 1 Taxonomical classification](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/intro.jpg)

                                                          Fig. 1 Taxonomical classification

It is useful to distinguish taxonomies from ontologies. A taxonomy focuses on hierarchical *is-a* relationships, defining how categories are organized from coarse to fine levels for classification and organization. An ontology extends beyond this by modeling richer semantic relationships, such as attributes, constraints, and non-hierarchical links between concepts. While ontologies enable more expressive reasoning, taxonomies are typically preferred for classification systems because they are simpler to construct, easier to supervise at scale, and sufficient for most practical tasks involving categorization, navigation, and retrieval.

## Why is Taxonomical Classification Hard in Practice?

Even with strong models, taxonomical classification remains challenging because the difficulty lies not in defining a hierarchy, but in learning and predicting across it reliably at scale. Real-world taxonomies show extreme class imbalance. A few high-level categories dominate the data, while thousands of fine-grained leaf categories have very limited examples. Naively trained models tend to overfit frequent classes and underperform on the long tail, even though these leaf categories are often the most business-critical. Distinguishing between them requires subtle semantic cues that are difficult to learn reliably, even with large transformer models.

Ambiguity further complicates the task. Many inputs can belong to multiple branches depending on context or intended use, leading to noisy or inconsistent labels. In practice, datasets may also contain partial annotations or missing levels, forcing models to operate under incomplete supervision. Errors at higher levels can constrain or propagate to downstream predictions, amplifying their impact. Evaluation adds another layer of complexity, as predictions may be correct at coarse levels but incorrect at finer ones. Thus, these challenges explain why taxonomical classification systems often struggle in production and why effective solutions require careful system design, training objectives, and evaluation strategies rather than stronger models alone.

# What is the Need for Taxonomical Classification?

Taxonomy is a practical requirement with an increasing need as text-driven systems operate at scale. As businesses grow their catalogs, content repositories, and user-facing services, structuring information becomes crucial for both business outcomes and system reliability.

## Business and System-Level Needs

An important aspect of taxonomical classification is search relevance because users do not always search using the exact terms found in product titles or documents. Taxonomy helps search systems to reason at a conceptual level, improving recall and ranking by grouping semantically related items under shared categories. Thus, even when queries are vague or incomplete, the hierarchical structure helps surface relevant results. 

In e-commerce or content platforms, taxonomies provide a stable backbone for navigation and discovery. In analytics and reporting, business metrics are rarely analyzed at the level of individual SKUs or documents, but are aggregated across meaningful category groupings. A well-defined taxonomy enables consistent roll-ups, trend analysis, and performance tracking without constant manual intervention. The below figure shows an example of the taxonomical structure of Shopify.

![                                                                     Fig.2 Shopify product taxonomy](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/shopify.jpg)

                                                                     Fig.2 Shopify product taxonomy

For personalization and recommendation systems, hierarchical labels help infer preferences at higher levels of taxonomy, allowing systems to adapt even when user interaction data is sparse. In governance and compliance, regulatory reporting, content moderation, and access control often require items to be classified into well-defined categories. Taxonomies provide the consistency and auditability needed to support these requirements at scale.

## Why Flat Classification is Not Enough

Flat classification suffers from label explosion, where hundreds or thousands of categories must be treated as independent targets. This increases model complexity and makes supervision and evaluation more brittle. Maintenance costs also become a major issue as flat label spaces are tightly coupled to downstream systems, meaning small taxonomy changes can require retraining models, updating rules, and reprocessing historical data. Thus, it creates significant operational overhead. 

Flat schemes also lead to semantic inconsistency. Closely related labels are treated as unrelated classes, making it difficult to generalize and reason about predictions. Errors become harder to interpret as all mistakes are treated equally, no matter how semantically close the prediction was to the ground truth. Thus, flat classifiers generalize poorly in dynamic environments where categories evolve, data distribution shifts, and long-tail classes dominate.

## Why LLMs Changed the Equation

Large Language Models changed the feasibility of taxonomical classification by enabling semantic understanding rather than surface-level matching. Semantic grounding helps models to generalize across variations in language, reducing sensitivity to synonyms, formatting differences, and noisy input. Categories can be inferred from intent and context rather than exact string matches, which is necessary in real-world data.

Zero-shot and few-shot capabilities of LLMs help in bootstrapping classification systems when labelled data is limited. While these approaches are not sufficient on their own for large taxonomies, they significantly reduce the upfront effort required to build and iterate on classification pipelines. Most importantly, LLMs reduce the manual taxonomy engineering needed to maintain classification systems. Rather than encoding the domain knowledge through rules, they use learned representations that adapt as language and categories evolve. This makes hierarchical classification more accurate and sustainable over time.

# Techniques for Taxonomical Classification with LLMs

Taxonomical classification systems leverage LLMs in several ways, each reflecting different trade-offs between flexibility, scalability, accuracy, and operational cost. Practitioners adopt a spectrum of techniques ranging from prompt-based zero-shot inference to fully fine-tuned hierarchical models. This section surveys the most commonly used LLM-driven techniques for taxonomical classification today, examining how they work, where they succeed, and why they fail at scale. By understanding them, we can better reason about which designs are suitable for large, evolving taxonomies and which are better for rapid prototyping or low-maintenance deployments.

## Zero-shot and Few-shot LLM Classification

### Zero-shot

LLMs can serve as zero-shot classifiers by leveraging their massive pre-training and prompting mechanisms rather than traditional task-specific training. For example, an LLM such as a GPT-4 can be prompted with natural language instructions that define the classification task, without providing any labelled examples beforehand. A sample prompt might instruct the model to classify a piece of text into one of several categories and even specify output formatting such as JSON, to structure responses. This prompt-based architecture simplifies the traditional classification pipeline to a single generative step, where LLMs generate the classification label directly in response to the prompt.

![                                                Fig.3 Zero-shot classifier pipeline](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/zero-shot.jpg)

                                                Fig.3 Zero-shot classifier pipeline

Empirical results on zero-shot classification show that while LLMs are capable, the effectiveness varies by task and domain. In experiments conducted by [***Wang et al.***](https://arxiv.org/pdf/2312.01044), GPT-style models achieved performance competitive with state-of-the-art methods on several benchmark datasets, highlighting the potential for generalization to unseen labels without training on labeled examples. This makes zero-shot classification highly flexible and immediately applicable without the cost of labeled data or training. However, this flexibility comes with limitations. Performance can lag behind fine-tuned models on more complex or domain-specific tasks. Accuracy often degrades as the label set grows and becomes semantically fine-grained. Because model outputs depend on prompt quality and token constraints, zero-shot methods exhibit high sensitivity to prompt design and may struggle with controlled or systematic taxonomy outputs.

![Table.1 Accuracy of different models for zero-shot classification](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/zero-shot-results.jpg)

Table.1 Accuracy of different models for zero-shot classification

### Few-shot

Few-shot learning augments zero-shot learning by providing a small number of labeled examples within the prompt itself to guide the model’s classification behavior. The prompt includes support examples, around 1-5 labelled instances, that illustrate the mapping between the input text and its corresponding label. The model then conditions on these examples before generating a prediction for a new query. The pipeline of few-shot classification uses the same underlying LLM but relies on in-context learning, where the examples in the prompt serve to implicitly tune the model’s behavior for the specific task without gradient updates or fine-tuning. The figure below illustrates the few-shot classification and segmentation architecture. In an N-way K-shot setup, a small support set with masks guides an LLM that coordinates tools for object understanding, localization, segmentation, and quality evaluation. The model identifies the target object from support examples, finds it in query images, and generates refined segmentation masks through iterative reasoning.

![                                                         Fig.4 Few-shot text classification and segmentation pipeline](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/few-shot-pipeline.jpg)

                                                         Fig.4 Few-shot text classification and segmentation pipeline

The figure below presents the detailed prompt design used to operationalize this architecture using GPT-4. The prompt encodes task instructions, tool usage guidelines, chain-of-thought reasoning structure, and self-reflection mechanisms in a unified format. It instructs the model to observe support examples, summarize object characteristics, query bounding boxes, perform segmentation, and iteratively improve mask quality if necessary. 

![         Fig.5 GPT-4 prompt for few-shot classification & segmentation](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/gpt-example.jpg)

         Fig.5 GPT-4 prompt for few-shot classification & segmentation

In the experiments conducted by [***Meng et al.***](https://arxiv.org/pdf/2311.12065), the proposed LLM-agent–based framework demonstrates strong performance on standard few-shot benchmarks, as summarized in the results table. Across 1-shot and 5-shot settings on Pascal-5i, the method consistently outperforms or matches existing few-shot classification and segmentation approaches, achieving higher classification accuracy and competitive segmentation mIoU without any task-specific training. Nevertheless, limitations remain, such as prompt length restrictions limit how many examples can be shown, and models may still hallucinate or misinterpret task boundaries if examples are poorly chosen. Moreover, latency and cost are higher for few-shot prompting compared to zero-shot, since each query requires a more complex prompt and larger context processing.

![                                                                                       Table.2 Few-shot results](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/few-shot-results.jpg)

                                                                                       Table.2 Few-shot results

Thus, zero-shot and few-shot learning enabled by LLMs reduces or eliminates the need for task-specific labeled data and training. Zero-shot classification is highly flexible and immediately deployable, though it may underperform in fine-grained or domain-specific contexts. Few-shot prompting improves accuracy and pattern recognition with minimal examples, offering a practical middle ground between unsupervised generality and supervised performance.

## Embedding-Based Taxonomy Classification

Unlike zero-shot or few-shot LLM classification, which relies on prompt-based generation and implicit reasoning, [**embedding-based taxonomy**](https://aclanthology.org/2020.coling-main.110.pdf) matching performs retrieval-style classification using similarity search rather than text generation. It assigns inputs to taxonomy nodes by embedding both texts and labels into a shared vector or geometric space and performing nearest-neighbor or hierarchy-aware matching. The architecture consists of a text encoder, taxonomy node embeddings, and a matching mechanism based on distance or containment. Some models use asymmetric geometric embeddings, such as a [**box or hyperbolic spaces**](https://arxiv.org/pdf/2408.15050v1), to encode hierarchical relations. This allows taxonomy structure to be preserved during classification without prompting or gradient updates. The diagram below, shows embedding-based taxonomy classification pipeline with offline label embedding and online retrieval-based inference in a shared embedding space.

![                                                                       Fig.6 Embedding-based model pipeline](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/embedding_based.jpg)

                                                                       Fig.6 Embedding-based model pipeline

Strengths of this method include scalability via nearest-neighbor search, structural interpretability, and stability across large label spaces. While it still has some existing limitations, including sensitivity to embedding quality, reduced performance for very fine-grained labels, and the inability to generate novel categories. This method works best when the taxonomy is fixed, well-defined, and central to the task, such as semantic indexing, ontology alignment, and topic hierarchy discovery.

## Fine-Tuned Transformer Classification

Contrary to embedding-based methods that represent texts and taxonomy nodes in a vector space and perform nearest-neighbor matching without supervised label fitting, fine-tuned transformer classifiers use a shared encoder, for example, a BERT-style transformer, followed by task-specific multi-head classification layers fine-tuned on labeled data to directly predict class labels. This architecture leverages self-attention to contextualize input text and produce representations for each category. The shared transformer backbone encodes text into high-dimensional embeddings, and the classification head outputs softmax scores over labels, enabling models to learn both general structure and task-specific distinctions.  If you want to know more about BERT and how to classify long documents and texts using it, [**check out our blog**](https://www.mercity.ai/blog-post/classify-long-texts-with-bert) on it.

![                                                               Fig.7 Fine-tuned transformer classifier pipeline ](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/fine_tuned_model.jpg)

                                                               Fig.7 Fine-tuned transformer classifier pipeline 

The advantages of this approach include strong performance on domain-specific vocabularies, robust handling of context through attention, and effective learning when sufficient labeled data exists. Nevertheless, their limitations include reliance on labeled training data, higher computational cost for fine-tuning, and potential overfitting on imbalanced classes. Despite these, fine-tuned transformer classifiers remain dominant in practical classification because they combine a powerful shared encoder with supervised optimization that directly aligns model outputs with target labels.

The table below summarizes the tradeoffs between zero/few-shot prompting, embedding-based matching, and fine-tuned transformers, highlighting how hybrid designs balance data efficiency and scalability at the cost of increased system complexity.

| **Aspect** | **Zero-/Few-shot LLM** | **Embedding-based Matching** | **Fine-tuned Transformer** |
| --- | --- | --- | --- |
| **Core Idea** | Prompt LLM to directly generate labels without training | Match text to taxonomy nodes via embedding similarity | Supervised encoder + classification heads |
| **Data Requirement** | None (zero-shot) or very small (few-shot) | No labeled data, but fixed taxonomy embeddings | Requires labeled data per class |
| **Scalability to Large Taxonomies** | Poor–moderate (prompt length & label explosion) | High (ANN search over embeddings) | Moderate (large output heads, retraining needed) |
| **Hierarchy Awareness** | Implicit, prompt-dependent | Structural (via geometric embeddings or constraints) | Explicit if trained hierarchically |
| **Best Use Cases** | Rapid prototyping, unseen labels | Stable, fixed taxonomies; semantic indexing | Shallow, stable domains with sufficient data |
| **Key Limitations** | Prompt sensitivity, latency, cost | Embedding quality limits fine-grain accuracy | Expensive retraining, brittle to taxonomy change |

                         Table.4 A comparison of the four LLM-classification techniques

# System Design Patterns

Hierarchical classification systems can be designed in multiple ways depending on how labels are structured, learned, and decoded. This section covers core system design patterns for taxonomy classification. It highlights the tradeoff between flat prediction and hierarchy-aware designs, examines level-wise and joint training strategies, and emphasizes inference-time mechanisms as first-class design components that can enforce hierarchical constraints and impact performance.

## Hierarchical Classification

A basic design choice in taxonomical systems is whether to treat label space as flat or to model the hierarchical structure during prediction. Flat classification treats hierarchical labels as independent categories, predicting only the final class and ignoring the parent-child relationship in the taxonomy. It simplifies design and optimization. However, prior research shows that it fails to exploit the semantic structure in real-world taxonomies. Experiments conducted by [***Ke et al.***](https://arxiv.org/pdf/2512.06613v1) demonstrate that flat baselines do achieve reasonable leaf accuracy but suffer from poor error locality, meaning the misclassifications may jump across distant branches of the hierarchy rather than remaining within semantically related groups. This behavior is reflected in the taxonomic distance analysis table below, where H-COFGS is a hierarchical model, and F-S is a flat model. It shows that flat models produce a substantially higher proportion of long-distance errors across the hierarchy, confirming their poor error locality despite comparable leaf-level accuracy.

![     Table.5 Taxonomical distance analysis on species level errors](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/Table_flat_vs_hierarchical_design.jpg)

     Table.5 Taxonomical distance analysis on species level errors

In contrast, hierarchical classification models the taxonomy during training or inference and constrains predictions on parent-child dependencies. Empirical comparisons in the above study highlight that hierarchy-aware models improve robustness under class imbalance and long-tail label distributions by leveraging shared structure across levels. Although hierarchical designs require additional modeling and decoding complexity, they provide better interpretability and graceful degradation when predictions are uncertain. Thus, they are better suited for large, structured label spaces where semantic consistency is critical.  

## Level-wise Classification

Unlike hierarchical models that enforce parent-child dependencies during decoding or inference, level-wise classification predicts each taxonomy level independently from shared encoder representations without structural constraints. Level-wise classification decomposes hierarchical prediction into a sequence of decisions made at each level of the taxonomy by using a shared encoder with independent classification heads per level. Recent work by [***Chen et al.***](https://aclanthology.org/2025.coling-main.417.pdf), adopts it by predicting labels at multiple hierarchy depths while sharing a common representation. This design allows each head to specialize in the granularity of its level. It reduces confusion between coarse and fine labels and makes training more stable under deep or imbalanced hierarchies. 

![              Fig.8 Level-wise classifier architecture](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/level-wise.jpg)

              Fig.8 Level-wise classifier architecture

Experiments by [***P´erez et al.***](https://arxiv.org/pdf/2405.00184) on local classifier per level (LCL) and multi-task hierarchical classification show that level-wise models benefit from decomposing prediction across hierarchy levels. This often improves coarse-level accuracy and training stability compared to flat classifiers. Because each level is optimized with its own objective while sharing a common encoder, these models scale well to deep taxonomies and allow error analysis at different granularities. However, a key limitation consistently reported is error propagation. Since predictions at each level are made independently, mistakes at higher levels can misguide downstream decisions, and cross-level consistency is not guaranteed without additional constraints. Consequently, level-wise classification is best viewed as a modular design pattern that prioritizes simplicity, scalability, and ease of optimization over strict hierarchical correctness.

## Joint Hierarchical Training

While level-wise classification predicts each hierarchy level independently using a shared encoder, joint hierarchical training optimizes all levels together using a unified loss to couple learning across the taxonomy. It treats taxonomy classification as a single learning problem with shared representations. In this design, similar to level-wise, a common encoder feeds multiple classification heads with different hierarchy levels. However, rather than training each level independently, these models optimize a combined objective, that is, the sum or weighted combination of level-specific losses. Hence, supervision from coarse and fine labels jointly shapes the learned representation. In the work by [***Jiang et al.***](https://www.arxiv.org/abs/2508.13452), the results show that auxiliary hierarchical losses improve convergence stability and representation reuse. This effect is illustrated in the figure below, where losses from upper and lower hierarchy levels ($L_{high}$ and $L_{low}$) are adaptively reweighted via the parameters $\alpha$and $\beta$ before being combined into a unified objective $L_{total}$, showing how joint optimization stabilizes training while promoting shared representation learning across levels.

![                      Fig.9 Loss flow in joint hierarchical classifiers](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/joint_hierarchical_losses.jpg)

                      Fig.9 Loss flow in joint hierarchical classifiers

Evidences from auxiliary-loss frameworks like [**HCAN**](https://ojs.aaai.org/index.php/AAAI/article/view/34286) show that joint training reduces semantic drift between hierarchy levels by encouraging internal consistency during optimization. Because all levels are trained jointly, gradients from higher levels regularize fine-grained predictions. This improves generalization without increasing inference complexity. Hence, joint hierarchical training scales better than fully sequential designs. It becomes a preferred design for large-scale taxonomies where retraining or complex decoding is undesirable.

## Inference-Time Techniques

Unlike joint hierarchical classification that enforces hierarchical consistency during training through shared representations and auxiliary losses, inference-time techniques impose hierarchical constraints only at prediction time without modifying the learned model. One such technique is parent-aware decoding. It restricts predictions to valid paths in the taxonomy, ensuring that a child label can only be selected if its parents are active. Works on this technique, including the paper by [***Plaud et al.***](https://arxiv.org/pdf/2506.01552), formalize this idea by showing that optimal hierarchical decisions depend not only on model scores but also on the evaluation metric. It motivates structured decoding strategies over argmax selection. This is quantified in table below, which shows that parent-aware and metric-optimal decoding strategies substantially reduce hierarchical mistake severity compared to argmax decoding, despite operating on identical model outputs.

![                             Table.6  Performance on mistake severity metric of different decoding strategy](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/inference_time.jpg)

                             Table.6  Performance on mistake severity metric of different decoding strategy

Confidence-based stopping extends this by allowing the model to abstain from deeper predictions when uncertainty is high. Experiments by [***Hengst et al.](https://arxiv.org/pdf/2508.13288)*** show that uncertainty-aware inference can produce valid, hierarchy-aligned prediction sets with statistical guarantees. It is useful in cases of distribution shift or long-tail labels. These works highlight that inference logic is not just an implementation detail but a critical design component that can improve robustness, interpretability, and reliability without retaining the model. 

The table below shows hierarchical system designs tradeoffs for simplicity, consistency, and scalability, with structure enforced either during training, inference, or both.

| **Aspect** | **Flat Classification** | **Level-wise Classification** | **Joint Hierarchical Training** | **Inference-Time Techniques** |
| --- | --- | --- | --- | --- |
| **Hierarchy Usage** | Ignored | Implicit (per-level heads) | Explicit during training | Explicit during decoding |
| **Training Strategy** | Single classifier | Independent losses per level | Unified auxiliary loss across levels | No change to training |
| **Consistency Guarantee** | None | Weak (error propagation) | Strong (shared optimization) | Strong (path constraints) |
| **Scalability** | High, but brittle | High and modular | High with careful loss design | High, model-agnostic |
| **Best Use Case** | Shallow, stable labels | Deep taxonomies with analysis needs | Large-scale structured taxonomies | Improving robustness without retraining |

                               Table.7 A comparison of the four system design patterns

# Large-Scale Taxonomical Classification with BERT

We now present an experimental study on large-scale taxonomical classification to ground the previously discussed design patterns in practice. The objective of our experiment is to examine how hierarchical modeling choices, supervision strategies, and data coverage interact in real-world taxonomies. Using BERT as a strong and widely adopted baseline, we analyze how deep hierarchical structure, class imbalance, and variable path lengths affect learning dynamics and final performance. 

## Setup and Architecture

We designed this study to reflect realistic industrial taxonomies, where label hierarchies are deep, unevenly populated, and only partially observed for many samples. Rather than treating taxonomical classification as a flat prediction problem, we model its hierarchical structure and study the resulting system-level behavior.

### Dataset

In the experiment, we use the [**Shopify Product Catalogue dataset**](https://huggingface.co/datasets/Shopify/product-catalogue) obtained from the Hugging Face datasets library. The underlying taxonomy of this dataset spans up to eight levels, with substantial imbalance across levels and categories. While higher-level nodes are well represented, deeper levels contain many low-frequency classes, and not all samples reach the maximum depth. The figure below shows the distribution of hierarchy depths in the dataset. A large fraction of samples terminate at shallow levels, resulting in sparse supervision for deeper taxonomy levels.

![                                                Fig.10 Dataset distribution across levels](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/dataset.jpg)

                                                Fig.10 Dataset distribution across levels

This setting makes the task particularly sensitive to error propagation, missing supervision, and uneven gradient flow. To address these challenges, we adopt a shared-encoder, multi-head hierarchical architecture described below.

### BERT Pipeline

A single BERT encoder produces a contextualized representation of the input text that is shared across all hierarchy levels. Separate classification heads are attached for each depth of the taxonomy, with each head predicting a distribution over the corresponding level’s categories and an additional *none* class to support variable hierarchy lengths. Although the heads are arranged to reflect the taxonomical structure, predictions at each level are computed independently from the shared encoder representation rather than being conditioned on parent-level outputs, avoiding hard error propagation from incorrect higher-level predictions. Hierarchical consistency is instead learned implicitly through joint supervision over aligned label paths during training.

![                                                                   Fig.11 BERT experimental architecture](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/experiment_Setup.jpg)

                                                                   Fig.11 BERT experimental architecture

Auxiliary supervision is applied at all hierarchy levels by aggregating level-wise cross-entropy losses into a single training objective. This ensures stable gradient flow even when supervision at deeper levels is sparse, enabling the model to learn both coarse and fine-grained distinctions. The *none* class allows samples with shorter label paths to participate in training without introducing artificial labels at deeper levels, which is essential in large-scale taxonomies with uneven depth coverage, as in the code below.

- *Code for the model*
    
    ```python
    # ============================================================================
    # ARCHITECTURE COMPONENTS
    # ============================================================================
    
    class HierarchicalClassifier(nn.Module):
        """
        Hierarchical classification model with BERT backbone and multiple classification heads.
    
        Architecture follows the transcript design:
        - BERT backbone for feature extraction
        - Multiple linear layers for each hierarchy level
        - Skip connections from BERT to each level
        - Separate classification heads attached to each level
        """
    
        def __init__(self, num_classes_per_level: List[int], bert_model: str = 'bert-base-uncased',
                     hidden_size: int = 768, dropout: float = 0.3):
            super(HierarchicalClassifier, self).__init__()
    
            self.num_levels = len(num_classes_per_level)
            self.num_classes_per_level = num_classes_per_level
    
            # BERT Backbone
            self.bert = BertModel.from_pretrained(bert_model)
            self.dropout = nn.Dropout(dropout)
    
            # Feature propagation layers (without classification responsibility)
            # These layers only propagate information to next level
            self.propagation_layers = nn.ModuleList()
            for i in range(self.num_levels):
                self.propagation_layers.append(
                    nn.Sequential(
                        nn.Linear(hidden_size, hidden_size),
                        nn.ReLU(),  # ReLU instead of Softmax to preserve information
                        nn.Dropout(dropout)
                    )
                )
    
            # Skip connections from BERT to each level
            # These are separate classification heads detached from propagation
            self.classification_heads = nn.ModuleList()
            for i in range(self.num_levels):
                self.classification_heads.append(
                    nn.Sequential(
                        nn.Linear(hidden_size, hidden_size // 2),
                        nn.ReLU(),
                        nn.Dropout(dropout),
                        nn.Linear(hidden_size // 2, num_classes_per_level[i] + 1)  # +1 for "none" class
                    )
                )
    
        def forward(self, input_ids, attention_mask, return_all_levels=True):
            """
            Forward pass through the hierarchical classifier.
    
            Returns predictions for all hierarchy levels.
            """
            # Get BERT embeddings
            outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
            bert_output = outputs.pooler_output  # [batch_size, hidden_size]
            bert_output = self.dropout(bert_output)
    
            level_outputs = []
            current_features = bert_output
    
            for i in range(self.num_levels):
                # Classification head with skip connection from BERT
                classification_output = self.classification_heads[i](bert_output)
                level_outputs.append(classification_output)
    
                # Propagate features to next level (if not last level)
                if i < self.num_levels - 1:
                    current_features = self.propagation_layers[i](current_features)
    
            if return_all_levels:
                return level_outputs
            else:
                return level_outputs[-1]
    ```
    

## Training and Evaluation

We trained BERT using an 85:15 train-validation split of the dataset, with ~40K samples for training and the remaining ~8K for validation. The training used joint hierarchical supervision with auxiliary losses applied at each taxonomy level, where the total loss is the sum of level-wise cross-entropy terms. The split provides broad coverage across hierarchy depths and categories, which is critical for stabilizing learning in deep taxonomies by ensuring consistent gradient updates across all classification heads during training, as in the code below.

- *Code for training the model*
    
    ```python
    #===========================================================
    # TRAINING
    # ==========================================================
    
    def train_model(model, train_loader, val_loader, num_epochs=10, learning_rate=2e-5,
                    device='cuda', warmup_steps=500):
    
        model.to(device)
        optimizer = AdamW(model.parameters(), lr=learning_rate)
    
        total_steps = len(train_loader) * num_epochs
        scheduler = get_linear_schedule_with_warmup(
            optimizer,
            num_warmup_steps=warmup_steps,
            num_training_steps=total_steps
        )
    
        criterion = nn.CrossEntropyLoss()
    
        for epoch in range(num_epochs):
            model.train()
            total_loss = 0
    
            for batch_idx, batch in enumerate(train_loader):
                input_ids = batch['input_ids'].to(device)
                attention_mask = batch['attention_mask'].to(device)
                labels = batch['labels'].to(device)  # [batch_size, num_levels]
    
                optimizer.zero_grad()
    
                # Forward pass
                level_outputs = model(input_ids, attention_mask)
    
                # Auxiliary loss: sum of losses from all levels
                # As mentioned in transcript: loss = loss1 + loss2 + loss3 + ...
                loss = 0
                for level_idx, level_output in enumerate(level_outputs):
                    level_labels = labels[:, level_idx]
                    level_loss = criterion(level_output, level_labels)
                    loss += level_loss
    
                # Backward pass
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
    
                total_loss += loss.item()
    
                if (batch_idx + 1) % 100 == 0:
                    print(f"Epoch {epoch+1}/{num_epochs}, Batch {batch_idx+1}/{len(train_loader)}, Loss: {loss.item():.4f}")
    
            avg_loss = total_loss / len(train_loader)
            print(f"Epoch {epoch+1} completed. Average Loss: {avg_loss:.4f}")
    
            # Validation
            val_loss, val_acc = evaluate_model(model, val_loader, device)
            print(f"Validation Loss: {val_loss:.4f}, Validation Accuracy: {val_acc:.4f}")
    ```
    

Model performance is evaluated on the validation set using level-wise accuracy and macro-averaged metrics to account for class imbalance. In addition to aggregate accuracy, we track performance at intermediate hierarchy levels. This multi-level evaluation is essential, as flat or leaf-only metrics fail to capture structural correctness and cannot distinguish between shallow misclassifications and deeper semantic errors. Level-wise analysis instead reveals how errors emerge and stabilize across the hierarchy during training.

## Results and Observations

The results show clear patterns in how the model learns across hierarchy levels. Upper levels converge quickly and achieve relatively high accuracy, with Level 1 reaching 0.71 and Level 2 reaching 0.50. These levels correspond to broad semantic categories, benefit from dense supervision, and involve fewer classes, allowing the model to learn stable decision boundaries early in training.

Accuracy drops sharply at intermediate levels as categories become more fine-grained and supervision becomes sparser. This is reflected in much lower performance at Levels 3 and 4, which act as a transition between coarse-grained grouping and highly specific categorization. Errors at these levels are impactful, as they affect the interpretability and usefulness of deeper predictions. At deeper levels, performance improves again despite limited supervision, with accuracy increasing from 0.53 at Level 5 to 1.00 at Level 8. Although learning at these depths is slower due to extreme class imbalance, auxiliary losses ensure that deeper heads continue to receive gradient updates, leading to stable performance once sufficient signal is accumulated. This recovery is partly due to the reduced number of active classes at deeper levels once higher-level context is established.

![                             Fig.12 BERT per-level accuracies ](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/bert_accuracy.jpg)

                             Fig.12 BERT per-level accuracies 

Qualitative examples of model predictions further illustrate these patterns. As shown below, the model consistently predicts correct high-level and mid-level categories, even when predictions do not extend to the deepest levels. This indicates strong semantic understanding at higher levels of the taxonomy, despite ambiguity in finer-grained categorization. There are occasional misclassifications at intermediate levels, for example, furniture-related items being grouped under “Cabinets & Storage”. It reflects the difficulty of fine-grained classification under limited supervision rather than a lack of semantic understanding.

![                                          Fig.13 Qualitative taxonomical samples](https://blog-cdn.mercity.ai/blog/taxonomical-classification-using-large-language-models/sample_qualitative.jpg)

                                          Fig.13 Qualitative taxonomical samples

Overall, the results indicate that hierarchical supervision and its distribution across levels are the dominant factor governing performance in large-scale taxonomical classification. Even with a strong baseline encoder such as BERT, model accuracy and stability are tightly coupled to supervision coverage, hierarchy depth, and gradient flow. These findings reinforce the view that taxonomical classification is a system design problem. Architectural choices governing hierarchy modeling, loss allocation, and supervision strategy have a greater impact than incremental encoder improvements alone.

# Practical Considerations and Challenges

Practical considerations in building taxonomy classifiers focus on aligning model complexity with data availability, taxonomy depth, and operational constraints. Zero-shot and prompt-based LLM approaches are effective when labeled data is limited, or taxonomies evolve frequently, while fine-tuning becomes beneficial once sufficient, stable supervision is available. Hierarchical models are worth the added cost primarily for deep, imbalanced label spaces where semantic consistency and error locality matter more than raw leaf accuracy. Metric selection should reflect this structure, favoring hierarchy-aware or level-wise evaluations over flat accuracy to capture partial correctness.

However, current models struggle to condition predictions explicitly on parent decisions during training without introducing error propagation or optimization instability. Enforcing ontology-aware constraints that generalize beyond a fixed taxonomy remains difficult, particularly when label definitions shift. Finally, continual taxonomy evolution involving adding, merging, or redefining classes without full retraining remains an open problem. It highlights the gap between practical system needs and existing hierarchical learning frameworks.

# Want to Integrate a Taxonomy Classifier in Your Business?

If you want to apply taxonomical classification to your business requirements, we can help you build a classifier for your specific needs. We are a team of researchers who have been working with classification models and LLMs for a long time. [**Contact us**](https://www.mercity.ai/contacts) today, and let us collaborate to create an effective taxonomical classifier that delivers measurable results.
