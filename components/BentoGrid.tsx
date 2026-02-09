import React from 'react';
import { motion } from 'framer-motion';

interface BentoItem {
  title: string;
  description: string;
  tags: string[];
  className: string;
}

const items: BentoItem[] = [
  {
    title: 'LLM Evaluation Tooling',
    description: 'Reusable evaluation workflows for enterprise model selection, ranking, and guardrail testing.',
    tags: ['Open Source', 'Evals', 'Reliability'],
    className: 'md:col-span-2',
  },
  {
    title: 'RAG Performance Stack',
    description: 'Retrieval and reranking pipelines tuned for latency-sensitive production environments.',
    tags: ['RAG', 'Infra'],
    className: 'md:col-span-1',
  },
  {
    title: 'Agent Harnesses',
    description: 'Task-specific agent scaffolds with tool control, observability, and failure analysis built in.',
    tags: ['Agents', 'Tool Use'],
    className: 'md:col-span-1',
  },
  {
    title: 'Custom Data Engines',
    description: 'Domain data pipelines and curation loops for adaptation, finetuning, and evaluation at scale.',
    tags: ['Datasets', 'Training'],
    className: 'md:col-span-2',
  },
];

const BentoGrid: React.FC = () => {
  return (
    <section className="py-24 border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <h2 className="text-3xl font-light text-slate-900 mb-3">Open Workbench</h2>
          <p className="text-slate-500 font-light max-w-2xl">
            A live snapshot of what we are building across models, datasets, and deployment systems.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((item) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -0.8 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className={`rounded-2xl border border-slate-200 bg-white/85 p-8 backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_10px_20px_-22px_rgba(15,23,42,0.35)] ${item.className}`}
            >
              <h3 className="text-xl font-medium text-slate-900 mb-3">{item.title}</h3>
              <p className="text-slate-500 font-light leading-relaxed mb-6">{item.description}</p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] uppercase tracking-widest px-2 py-1 border border-slate-200 rounded text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BentoGrid;
