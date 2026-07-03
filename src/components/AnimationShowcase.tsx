import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { SHOWCASE_VARIANTS } from './BackgroundVariations';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
};

export default function AnimationShowcase() {
  const [activeVariant, setActiveVariant] = useState(0);
  const variants = useMemo(() => SHOWCASE_VARIANTS, []);
  const ActiveBackground = variants[activeVariant]?.component ?? variants[0].component;

  return (
    <div className="min-h-screen relative w-full overflow-hidden font-sans">
      <div className="fixed inset-0 z-0">
        <ActiveBackground />
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-full px-6 py-4 shadow-2xl flex items-center gap-3 max-w-[95vw] overflow-x-auto scrollbar-hide">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden lg:block mr-2">
          Select Background:
        </span>
        {variants.map((variant, index) => (
          <button
            key={variant.name}
            onClick={() => setActiveVariant(index)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
              activeVariant === index
                ? 'bg-slate-900 text-white shadow-lg scale-105'
                : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            {variant.name}
          </button>
        ))}
      </div>

      <section className="min-h-screen flex flex-col justify-center px-6 relative z-10 pointer-events-none">
        <div className="max-w-7xl mx-auto w-full pointer-events-auto">
          <motion.div key={activeVariant} initial="initial" animate="animate" variants={fadeIn} className="max-w-4xl">
            <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-slate-200 bg-white/40 backdrop-blur-md text-xs font-bold tracking-wider uppercase text-slate-600 shadow-sm">
              Design Showcase Preview
            </div>
            <h1 className="text-5xl md:text-8xl font-light tracking-tighter text-slate-900 mb-8 leading-[1.1]">
              Intelligence, <span className="font-serif italic text-slate-700">refined</span>.
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 font-light leading-relaxed max-w-2xl mb-12 mix-blend-multiply">
              We are decoding the fundamental principles of intelligence to build systems that reason, learn, and
              create alongside humanity.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <a
                href="/research"
                className="text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-2 text-sm font-semibold uppercase tracking-widest backdrop-blur-sm px-4 py-2 rounded-lg bg-white/20 hover:bg-white/40 border border-transparent hover:border-slate-200"
              >
                Read Our Research
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
