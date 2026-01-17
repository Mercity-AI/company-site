import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, Network, Cpu, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { posts } from '@/.velite';
import SEO from '../components/SEO';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
};

const Home: React.FC = () => {
  // Get latest 2 posts
  const recentPosts = [...posts]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 2);

  const featuredContent = [
    {
      type: 'Research',
      title: recentPosts[0]?.title || 'Towards Causal Reasoning in LLMs',
      date: recentPosts[0] ? new Date(recentPosts[0].publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Oct 12, 2024',
      summary: recentPosts[0]?.summary || 'Exploring how to induce causal structure in transformer representations through targeted interventions.',
      link: recentPosts[0]?.permalink || '/blog',
      gradient: 'bg-gradient-to-br from-orange-50 to-amber-100',
      tags: ['Alignment', 'Theory']
    },
    {
      type: 'Dataset',
      title: 'Mercity-CoT-100k',
      date: 'Nov 04, 2024',
      summary: 'A high-quality, manually verified dataset of 100,000 complex chain-of-thought reasoning traces across mathematics and logic domains.',
      link: '/datasets/cot-100k',
      gradient: 'bg-gradient-to-br from-indigo-50 to-blue-100',
      tags: ['Dataset', 'Open Source']
    },
    {
      type: 'Research',
      title: recentPosts[1]?.title || 'Sparse Attention Patterns at Scale',
      date: recentPosts[1] ? new Date(recentPosts[1].publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Sep 28, 2024',
      summary: recentPosts[1]?.summary || 'Analyzing the emergence of sparsity in large-scale transformer models during training.',
      link: recentPosts[1]?.permalink || '/blog',
      gradient: 'bg-gradient-to-br from-emerald-50 to-teal-100',
      tags: ['Efficiency', 'Architecture']
    },
    {
      type: 'Model',
      title: 'Aether-7B-Reason',
      date: 'Oct 20, 2024',
      summary: 'Our flagship parameter-efficient model, fine-tuned for multi-step reasoning and verifiable outputs. Available on Hugging Face.',
      link: '/models/aether-7b',
      gradient: 'bg-gradient-to-br from-slate-100 to-stone-200',
      tags: ['Model', 'Weights']
    }
  ];

  return (
    <>
      <SEO
        title="Mercity Research"
        description="Research-grade, reality-ready. Shipping the research to production. Custom training, real optimization, genuine architecture."
        url="/"
      />
      <div className="w-full overflow-hidden">
      {/* Hero Section */}
      <section className="min-h-[90vh] flex flex-col justify-center px-6 relative">
        <div className="max-w-7xl mx-auto w-full z-10">
          <motion.div 
            initial="initial"
            animate="animate"
            variants={fadeIn}
            // className="max-w-6xl"
          >
            {/* <h1 className="text-5xl md:text-8xl font-light tracking-tighter text-slate-900 mb-7 leading-[1.1]">
              Research-grade, <span className="font-serif italic text-slate-700"><br/> reality-ready</span>.
            </h1> */}
            <h1 className="text-5xl md:text-8xl font-light tracking-tighter text-slate-900 mb-7 leading-[1.1]">
               <span className="font-serif italic text-slate-700">Building research led capabilities <br/> for product and enterprise teams.</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-500 font-light leading-relaxed max-w-2xl mb-12">
              {/* We build research-grade and reality-ready capabilities and integrations ready to scale. */}
              <br/>
              {/* We are decoding the fundamental principles of intelligence to build systems that reason, learn, and create alongside humanity. */}
              We do custom training, grunt optimization, built-from-scratch architecture. Anything and everything to give you an edge over the market.
               {/* <i>Shipping the research to production. <br/>
               Custom training, real optimization, genuine architecture. <br/></i> */}
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

      {/* Featured Work Section */}
      <section className="py-32 border-b border-slate-100">
        <div className="max-w-[80rem] mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-3xl font-light text-slate-900 mb-4">Latest from the Lab</h2>
            <div className="h-0.5 w-12 bg-slate-900" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredContent.map((item, index) => (
              <Link 
                key={index}
                to={item.link} 
                className="group block bg-white border border-slate-200 hover:border-slate-300 transition-all duration-300 overflow-hidden"
              >
                {/* Image Placeholder Area */}
                <div className={`h-44 w-full ${item.gradient} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors duration-300" />
                  {/* Optional: Add subtle pattern or noise here if needed */}
                </div>
                
                {/* Content Area */}
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider border border-slate-200 rounded text-slate-500">
                        {item.type}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {item.date}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-medium text-slate-900 mb-3 leading-tight group-hover:text-indigo-900 transition-colors">
                    {item.title}
                  </h3>
                  
                  <p className="text-slate-500 text-sm font-light leading-relaxed line-clamp-3">
                    {item.summary}
                  </p>

                  <div className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-900 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    Read More <ArrowRight size={12} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
    </>
  );
};

export default Home;