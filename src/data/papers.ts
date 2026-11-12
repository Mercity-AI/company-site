export type PaperGraphic = 'chat-monitor';

export interface Paper {
  title: string;
  summary: string;
  authors: string;
  date: string;
  venue: string;
  href: string;
  code?: string;
  log?: string;
  /** A drawn graphic for the wide block; takes priority over `image`. */
  graphic?: PaperGraphic;
  image?: string;
  imageAlt?: string;
}

// Published papers, newest first. Typed in by hand: add one here when it
// goes up on arXiv. `log` is the research log that tells the same work.
// A paper left alone on its row spans the full width and shows its
// `graphic` (or `image`) beside the copy, so the grid never has an empty half.
export const papers: Paper[] = [
  {
    title: 'Train on prefill, monitor at decode: Using sparse autoencoders for topic monitoring',
    summary:
      'Small causal detectors on sparse autoencoder features label every token a model writes with a topic, so the label can change partway through a response. Trained on prefill, they carry over to decoding on Gemma 3 1B and 4B.',
    authors: 'Rishikesh Mallagundla, Pranav Patel',
    date: 'Nov 2026',
    venue: 'arXiv · cs.AI',
    href: 'https://arxiv.org/abs/2611.12935',
    code: 'https://github.com/Mercity-AI/SAE-Guardrails',
    log: '/research/online-topic-guardrails-with-saes',
    graphic: 'chat-monitor',
  },
];

