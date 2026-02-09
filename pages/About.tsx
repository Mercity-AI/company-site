import React from 'react';
import { motion } from 'framer-motion';
import SEO from '../components/SEO';

const About: React.FC = () => {
  return (
    <>
      <SEO
        title="About Us"
        description="We are a collective of scientists, engineers, and dreamers. Founded in 2023, Mercity emerged from a simple question: How do we build intelligence that is robust, transparent, and aligned with human values?"
        url="/about"
      />
      <div className="max-w-7xl mx-auto px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="mb-32 max-w-3xl"
      >
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">About Mercity</span>
        <h1 className="text-5xl md:text-6xl font-light tracking-tight text-slate-900 mb-8">
          We are a collective of scientists, engineers, and dreamers.
        </h1>
        <p className="text-xl text-slate-500 font-light leading-relaxed">
          Founded in 2023, Mercity emerged from a simple question: How do we build intelligence that is robust, transparent, and aligned with human values? We believe the answer lies in a multidisciplinary approach, blending computer science, neuroscience, and philosophy.
        </p>
      </motion.div>

      <section className="mt-40 bg-slate-50 p-12 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-light text-slate-900 mb-6">Join our research</h2>
          <p className="text-slate-500 font-light mb-8">
            We are always looking for exceptional talent to join our team. 
            If you are obsessed with solving intelligence, we want to hear from you.
          </p>
          <a
            href="https://www.linkedin.com/company/mercity-ai/jobs/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex px-8 py-3 bg-white border border-slate-200 text-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all duration-300 shadow-sm hover:shadow-md"
          >
            View Open Positions
          </a>
        </div>
        {/* Decorative blur inside the card */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-100/50 rounded-full blur-[80px]" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-100/50 rounded-full blur-[80px]" />
      </section>
    </div>
    </>
  );
};

export default About;
