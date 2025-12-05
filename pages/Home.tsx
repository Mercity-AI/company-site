import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, Network, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
};

const Home: React.FC = () => {
  return (
    <div className="w-full overflow-hidden">
      {/* Hero Section */}
      <section className="min-h-[90vh] flex flex-col justify-center px-6 relative">
        <div className="max-w-7xl mx-auto w-full z-10">
          <motion.div 
            initial="initial"
            animate="animate"
            variants={fadeIn}
            className="max-w-4xl"
          >
            <h1 className="text-5xl md:text-8xl font-light tracking-tighter text-slate-900 mb-7 leading-[1.1]">
              Research-grade, <span className="font-serif italic text-slate-700"><br/> reality-ready</span>.
            </h1>
            <p className="text-xl md:text-2xl text-slate-500 font-light leading-relaxed max-w-2xl mb-12">
              {/* We are decoding the fundamental principles of intelligence to build systems that reason, learn, and create alongside humanity. */}
               <i>Shipping the research to production. <br/>
               Custom training, real optimization, genuine architecture. <br/></i>
               {/* <i><u>We do the deep work so your AI simply works.</u></i> */}
            </p>
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <Link to="/about" className="group flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full font-medium transition-all hover:bg-slate-800 hover:scale-105">
                Our Mission <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/blog" className="text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-2 text-sm font-semibold uppercase tracking-widest">
                Read the Journal
              </Link>
            </div>
          </motion.div>
        </div>
        
        {/* Subtle Decorative Element */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 2, delay: 0.5 }}
          className="absolute right-0 bottom-0 md:right-[10%] md:bottom-[20%] w-64 h-64 border border-slate-200 rounded-full flex items-center justify-center"
        >
             <div className="w-48 h-48 border border-slate-100 rounded-full animate-[spin_10s_linear_infinite]" />
        </motion.div>
      </section>

      {/* Philosophy / Research Areas */}
      <section id="research" className="py-32 bg-white/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-16"
          >
            <div className="group">
              <div className="w-12 h-12 mb-8 text-slate-800 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors duration-500">
                <Brain strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-medium mb-4 text-slate-900">Cognitive Architectures</h3>
              <p className="text-slate-500 leading-relaxed font-light">
                Moving beyond statistical pattern matching to structured reasoning and causal understanding.
              </p>
            </div>

            <div className="group">
              <div className="w-12 h-12 mb-8 text-slate-800 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors duration-500">
                <Network strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-medium mb-4 text-slate-900">Sparse Modeling</h3>
              <p className="text-slate-500 leading-relaxed font-light">
                Efficiency is intelligence. Developing models that achieve more with significantly less compute.
              </p>
            </div>

            <div className="group">
              <div className="w-12 h-12 mb-8 text-slate-800 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors duration-500">
                <Cpu strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-medium mb-4 text-slate-900">Scaffolding Agents</h3>
              <p className="text-slate-500 leading-relaxed font-light">
                Building harnesses for the real world to bridge the gap between modeling and reality.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-40 border-t border-slate-100 relative">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.blockquote 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="font-serif text-3xl md:text-5xl text-slate-800 italic leading-tight"
          >
            "The goal is not just to mimic human thought, but to extend the horizon of what is thinkable."
          </motion.blockquote>
          <div className="mt-8 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Dr. Elena Vora, Chief Scientist
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;