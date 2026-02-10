import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const NoiseOverlay = ({ opacity = 0.03 }: { opacity?: number }) => (
  <div
    className="absolute inset-0 z-[10] pointer-events-none"
    style={{
      opacity,
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
    }}
  />
);

export const InteractiveNeuralGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let mouse = { x: -1000, y: -1000 };
    let animationId = 0;

    const gap = 40;
    let particles: { x: number; y: number; originX: number; originY: number }[] = [];

    const initParticles = () => {
      const rows = Math.ceil(height / gap);
      const cols = Math.ceil(width / gap);
      particles = [];
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const x = i * gap + gap / 2;
          const y = j * gap + gap / 2;
          particles.push({ x, y, originX: x, originY: y });
        }
      }
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse = { x: event.clientX, y: event.clientY };
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((particle) => {
        const dx = mouse.x - particle.x;
        const dy = mouse.y - particle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const forceDist = 200;
        const force = Math.max(0, (forceDist - dist) / forceDist);
        const angle = Math.atan2(dy, dx);
        const targetX = particle.originX - Math.cos(angle) * force * 50;
        const targetY = particle.originY - Math.sin(angle) * force * 50;

        particle.x += (targetX - particle.x) * 0.1;
        particle.y += (targetY - particle.y) * 0.1;

        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = window.requestAnimationFrame(animate);
    };

    initParticles();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    animationId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-slate-50">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-transparent to-white/90 pointer-events-none" />
    </div>
  );
};

export const GradientMesh: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-white overflow-hidden">
      <motion.div
        animate={{ scale: [1, 1.4, 1], rotate: [0, 45, 0] }}
        transition={{ duration: 20, repeat: Infinity }}
        className="absolute -top-[20%] -left-[10%] w-[80vw] h-[80vw] bg-indigo-200/30 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{ scale: [1, 1.3, 1], x: [0, -50, 0] }}
        transition={{ duration: 15, repeat: Infinity }}
        className="absolute -bottom-[20%] -right-[10%] w-[80vw] h-[80vw] bg-fuchsia-200/30 rounded-full blur-[100px]"
      />
      <motion.div
        animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] bg-blue-200/30 rounded-full blur-[120px]"
      />
      <div className="absolute inset-0 bg-white/40 backdrop-blur-[100px]" />
      <NoiseOverlay opacity={0.04} />
    </div>
  );
};

export const ArchitecturalGrid: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden perspective-[1000px]">
      <motion.div
        initial={{ opacity: 0 }}
        className="absolute inset-[-100%] w-[300%] h-[300%] bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] bg-[size:4rem_4rem]"
        style={{
          transform: 'rotateX(60deg) translateZ(-100px)',
          transformOrigin: '50% 50%',
        }}
        animate={{ opacity: 0.4, y: [0, -64] }}
        transition={{
          opacity: { duration: 1 },
          y: {
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
          },
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-slate-50/20 to-slate-50 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-50 pointer-events-none" />
    </div>
  );
};

export const CircuitLattice: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden">
      <svg className="absolute w-full h-full opacity-35" width="100%" height="100%">
        <defs>
          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#cbd5e1" strokeWidth="0.5" />
            <rect x="0" y="0" width="2" height="2" fill="#64748b" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <motion.path
          d="M 100,100 H 300 V 300 H 600"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
        />
        <motion.path
          d="M 800,500 V 200 H 500"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', delay: 2, repeatDelay: 2 }}
        />
        <motion.path
          d="M 900,900 V 700 H 600"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear', delay: 0.2, repeatDelay: 1.8 }}
        />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,white_90%)]" />
      <NoiseOverlay opacity={0.05} />
    </div>
  );
};

export const LiquidChrome: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-slate-100 overflow-hidden">
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </svg>

      <div style={{ filter: 'url(#goo)' }} className="absolute inset-0 w-full h-full">
        <motion.div
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[30%] left-[30%] w-64 h-64 bg-slate-300 rounded-full mix-blend-multiply opacity-60"
        />
        <motion.div
          animate={{ x: [0, -80, 0], y: [0, 100, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-[30%] left-[40%] w-56 h-56 bg-indigo-200 rounded-full mix-blend-multiply opacity-60"
        />
        <motion.div
          animate={{ x: [0, 60, 0], y: [0, -60, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute top-[40%] left-[35%] w-48 h-48 bg-blue-200 rounded-full mix-blend-multiply opacity-60"
        />
      </div>
      <NoiseOverlay />
    </div>
  );
};

export const DigitalRain: React.FC = () => {
  const [height, setHeight] = useState(1200);
  const drops = useMemo(
    () =>
      Array.from({ length: 20 }, () => ({
        dropHeight: Math.random() * 100 + 50,
        duration: Math.random() * 5 + 5,
        delay: Math.random() * 5,
      })),
    [],
  );

  useEffect(() => {
    setHeight(window.innerHeight);
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden flex justify-around">
      {drops.map((drop, index) => (
        <motion.div
          key={index}
          className="w-[1px] bg-gradient-to-b from-transparent via-slate-400 to-transparent opacity-40"
          initial={{ y: -200, height: drop.dropHeight }}
          animate={{ y: height + 200 }}
          transition={{ duration: drop.duration, repeat: Infinity, ease: 'linear', delay: drop.delay }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-transparent to-slate-50 pointer-events-none" />
      <NoiseOverlay />
    </div>
  );
};

export const USED_HERO_BACKGROUNDS = [
  CircuitLattice,
  GradientMesh,
  ArchitecturalGrid,
  InteractiveNeuralGrid,
  LiquidChrome,
  DigitalRain,
];

export const SHOWCASE_VARIANTS = [
  { name: 'Circuit Lattice', component: CircuitLattice },
  { name: 'Liquid Chrome', component: LiquidChrome },
  { name: 'Digital Rain', component: DigitalRain },
  { name: 'Gradient Mesh', component: GradientMesh },
  { name: 'Architectural Grid', component: ArchitecturalGrid },
  { name: 'Interactive Neural', component: InteractiveNeuralGrid },
];
