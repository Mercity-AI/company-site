import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
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
  BauhausGeometry
} from '../components/BackgroundVariations';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
};

const AnimationShowcase: React.FC = () => {
  const [activeVariant, setActiveVariant] = useState<number>(0);

  const variants = [
    { name: 'Circuit Lattice (New)', component: <CircuitLattice /> },
    { name: 'Liquid Chrome (New)', component: <LiquidChrome /> },
    { name: 'Digital Rain (New)', component: <DigitalRain /> },
    { name: 'Bauhaus Geo (New)', component: <BauhausGeometry /> },
    { name: 'Gradient Mesh', component: <GradientMesh /> },
    { name: 'Architectural Grid', component: <ArchitecturalGrid /> },
    { name: 'Interactive Neural', component: <InteractiveNeuralGrid /> },
    { name: 'Ethereal Aurora', component: <EtherealAurora /> },
    { name: 'Rugged Flux', component: <RuggedFlux /> },
    { name: 'Silk Waves', component: <SilkWaves /> },
    { name: 'Focus Drift', component: <FocusDrift /> },
    { name: 'Cognitive Pulse', component: <CognitivePulse /> },
  ];

  return (
    <div className="min-h-screen relative w-full overflow-hidden font-sans">
      
      {/* Background Layer */}
      <div className="fixed inset-0 z-0">
        {variants[activeVariant].component}
      </div>

      {/* Control Panel (Floating) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-full px-6 py-4 shadow-2xl flex items-center gap-3 max-w-[95vw] overflow-x-auto scrollbar-hide">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden lg:block mr-2">
          Select Background:
        </span>
        {variants.map((v, index) => (
          <button
            key={v.name}
            onClick={() => setActiveVariant(index)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
              activeVariant === index 
                ? 'bg-slate-900 text-white shadow-lg scale-105' 
                : 'bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      {/* Hero Content Overlay (Mock of Home) */}
      <section className="min-h-screen flex flex-col justify-center px-6 relative z-10 pointer-events-none">
        <div className="max-w-7xl mx-auto w-full pointer-events-auto">
          <motion.div 
            key={activeVariant} // Re-trigger animation on switch
            initial="initial"
            animate="animate"
            variants={fadeIn}
            className="max-w-4xl"
          >
             <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-slate-200 bg-white/40 backdrop-blur-md text-xs font-bold tracking-wider uppercase text-slate-600 shadow-sm">
               Design Showcase Preview
             </div>
            <h1 className="text-5xl md:text-8xl font-light tracking-tighter text-slate-900 mb-8 leading-[1.1]">
              Intelligence, <span className="font-serif italic text-slate-700">refined</span>.
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 font-light leading-relaxed max-w-2xl mb-12 mix-blend-multiply">
              We are decoding the fundamental principles of intelligence to build systems that reason, learn, and create alongside humanity.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <button className="group flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full font-medium transition-all hover:bg-slate-800 hover:scale-105 shadow-xl shadow-slate-200/50">
                Our Mission <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-2 text-sm font-semibold uppercase tracking-widest backdrop-blur-sm px-4 py-2 rounded-lg bg-white/20 hover:bg-white/40 border border-transparent hover:border-slate-200">
                Read the Journal
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default AnimationShowcase;