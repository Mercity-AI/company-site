import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GradientMesh, USED_HERO_BACKGROUNDS } from './BackgroundVariations';

const fallbackBackground = (
  <div className="absolute inset-0 bg-slate-50">
    <div className="absolute -top-[10%] -right-[10%] w-[50vw] h-[50vw] bg-slate-200/40 rounded-full blur-[120px] mix-blend-multiply motion-safe:animate-[pulse_14s_ease-in-out_infinite]" />
    <div className="absolute -bottom-[10%] -left-[10%] w-[40vw] h-[40vw] bg-indigo-100/50 rounded-full blur-[100px] mix-blend-multiply motion-safe:animate-[pulse_17s_ease-in-out_infinite]" />
  </div>
);

type HeroBackgroundComponent = (typeof USED_HERO_BACKGROUNDS)[number] | null;
const DYNAMIC_BACKGROUND_THRESHOLD = 0.7;

function createPageSeed() {
  if (typeof window === 'undefined') {
    return Math.random();
  }

  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] / 4294967296;
  }

  return Math.random();
}

function selectBackgroundForPageLoad(): HeroBackgroundComponent {
  if (createPageSeed() < DYNAMIC_BACKGROUND_THRESHOLD) {
    return null;
  }

  const index = Math.min(USED_HERO_BACKGROUNDS.length - 1, Math.floor(createPageSeed() * USED_HERO_BACKGROUNDS.length));
  return USED_HERO_BACKGROUNDS[index];
}

export default function HeroSection() {
  const [HeroBackground, setHeroBackground] = useState<HeroBackgroundComponent>(null);

  useEffect(() => {
    const nextBackground = selectBackgroundForPageLoad();
    // Background variants are function components; wrap to store as state value.
    setHeroBackground(() => nextBackground);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('hero-gradient-mesh-soft-header', HeroBackground === GradientMesh);
    return () => {
      document.body.classList.remove('hero-gradient-mesh-soft-header');
    };
  }, [HeroBackground]);

  return (
    <section className="min-h-[90vh] flex flex-col justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        {HeroBackground ? <HeroBackground /> : fallbackBackground}
        <div className="absolute inset-0 bg-gradient-to-b from-white/45 via-white/30 to-white/75" />
      </div>
      <div className="max-w-7xl mx-auto w-full z-10 relative">
        <div className="hero-copy-enter">
          <h1 className="text-5xl md:text-8xl font-light tracking-tighter text-slate-900 mb-7 leading-[1.1]">
            <span className="font-serif italic text-slate-700">
              Building research led capabilities <br /> for product and enterprise teams.
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-slate-500 font-light leading-relaxed max-w-2xl mb-12">
            We do custom training, grunt optimization, built-from-scratch architecture. Anything and everything to
            give you an edge over the market.
          </p>
          <div>
            <a
              href="/research"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full font-medium transition-all hover:bg-slate-800 hover:scale-105"
            >
              Read Our Research <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>

      <div className="hero-orbit-enter absolute right-0 bottom-0 md:right-[10%] md:bottom-[20%] w-64 h-64 border border-slate-200 rounded-full flex items-center justify-center">
        <div className="w-48 h-48 border border-slate-100 rounded-full motion-safe:animate-[spin_10s_linear_infinite]" />
      </div>
    </section>
  );
}
