import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, Network, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { posts } from '@/.velite';
import SEO from '../components/SEO';
import BentoGrid from '../components/BentoGrid';
import BlurBackground from '../components/BlurBackground';
import {
  EtherealAurora,
  RuggedFlux,
  InteractiveNeuralGrid,
  SilkWaves,
  FocusDrift,
  GradientMesh,
  ArchitecturalGrid,
  CognitivePulse,
  CircuitLattice,
  LiquidChrome,
  DigitalRain,
  BauhausGeometry,
} from '../components/BackgroundVariations';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
};

const Home: React.FC = () => {
  const heroBackgroundVariants = [
    CircuitLattice,
    GradientMesh,
    ArchitecturalGrid,
    InteractiveNeuralGrid,
    EtherealAurora,
    RuggedFlux,
    SilkWaves,
    FocusDrift,
    CognitivePulse,
    LiquidChrome,
    DigitalRain,
    BauhausGeometry,
  ];
  const [heroBackgroundIndex] = useState<number | null>(() => {
    if (Math.random() < 0.7) return null;
    return Math.floor(Math.random() * heroBackgroundVariants.length);
  });
  const HeroBackground = heroBackgroundIndex !== null ? heroBackgroundVariants[heroBackgroundIndex] : null;

  const sortedPosts = [...posts]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 4);

  const gradients = [
    'bg-gradient-to-br from-orange-50 to-amber-100',
    'bg-gradient-to-br from-indigo-50 to-blue-100',
    'bg-gradient-to-br from-emerald-50 to-teal-100',
    'bg-gradient-to-br from-slate-100 to-stone-200',
  ];
  const featuredContent = sortedPosts.length > 0
    ? sortedPosts.map((post, index) => ({
        type: post.category || 'Research',
        title: post.title,
        date: new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        summary: post.summary,
        link: post.permalink,
        image: post.image,
        gradient: gradients[index % gradients.length],
      }))
    : [
        {
          type: 'Research',
          title: 'Mercity Research Updates',
          date: 'Jan 1, 2026',
          summary: 'New writing from the lab will appear here shortly.',
          link: '/blog',
          image: undefined,
          gradient: gradients[0],
        },
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
      <section className="min-h-[90vh] flex flex-col justify-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          {HeroBackground ? <HeroBackground /> : <BlurBackground className="!absolute !inset-0" />}
          <div className="absolute inset-0 bg-gradient-to-b from-white/45 via-white/30 to-white/75" />
        </div>
        <div className="max-w-7xl mx-auto w-full z-10 relative">
          <motion.div 
            initial="initial"
            animate="animate"
            variants={fadeIn}
          >
            <h1 className="text-5xl md:text-8xl font-light tracking-tighter text-slate-900 mb-7 leading-[1.1]">
               <span className="font-serif italic text-slate-700">Building research led capabilities <br/> for product and enterprise teams.</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-500 font-light leading-relaxed max-w-2xl mb-12">
              We do custom training, grunt optimization, built-from-scratch architecture. Anything and everything to give you an edge over the market.
            </p>
            <div>
              <Link to="/blog" className="group inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full font-medium transition-all hover:bg-slate-800 hover:scale-105">
                Read Our Research <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
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

      <BentoGrid />

      {/* Bridge Section */}
      <section className="py-24 border-t border-slate-100 bg-white/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 mb-6">Research to Enterprise</p>
          <h2 className="text-3xl md:text-4xl font-light text-slate-900 mb-6 leading-tight">
            We are a research lab that builds production-ready AI capabilities for enterprise teams.
          </h2>
          <p className="text-lg text-slate-500 font-light leading-relaxed mb-8">
            From model evaluation and adaptation to deployment architecture, we help teams turn frontier research into durable business systems.
          </p>
          <Link to="/contact" className="text-sm font-semibold uppercase tracking-widest text-slate-900 hover:text-slate-600 transition-colors">
            Start a Conversation
          </Link>
        </div>
      </section>

      {/* Featured Work Section */}
      <section className="py-32 border-b border-slate-100">
        <div className="max-w-[80rem] mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-3xl font-light text-slate-900 mb-4">Latest Publications</h2>
            <div className="h-0.5 w-12 bg-slate-900" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredContent.map((item, index) => (
              <Link 
                key={index}
                to={item.link} 
                className="group block bg-white border border-slate-200 hover:border-slate-300 transition-all duration-300 overflow-hidden"
              >
                {item.image ? (
                  <div className="h-44 w-full relative overflow-hidden bg-slate-100">
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className={`h-44 w-full ${item.gradient} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors duration-300" />
                  </div>
                )}
                
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
            "Research only matters when it improves the systems people rely on every day."
          </motion.blockquote>
          <div className="mt-8 text-sm font-semibold uppercase tracking-widest text-slate-400">
            Mercity Research Team
          </div>
        </div>
      </section>
    </div>
    </>
  );
};

export default Home;
