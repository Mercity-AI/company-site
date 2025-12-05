import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// --- Shared Noise Texture for "Rugged" feel ---
// Increased opacity of noise for better texture visibility
const NoiseOverlay = ({ opacity = 0.03 }: { opacity?: number }) => (
  <div 
    className="absolute inset-0 z-[10] pointer-events-none"
    style={{ 
      opacity,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
    }} 
  />
);

// --- Variant 1: Ethereal Aurora (Fixed) ---
// Increased color weight (Slate-50 -> Indigo-200/Purple-200) to ensure visibility on white.
export const EtherealAurora: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-50">
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
          opacity: [0.4, 0.6, 0.4], // Increased opacity
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        // Changed to lavender/indigo tones that are visible against white
        className="absolute -top-[30%] -left-[10%] w-[80vw] h-[80vw] bg-indigo-200/40 rounded-full blur-[100px] mix-blend-multiply"
      />
      <motion.div
        animate={{
          scale: [1, 1.5, 1],
          x: [0, -100, 0],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        // Changed to teal/cyan tones
        className="absolute top-[10%] -right-[20%] w-[70vw] h-[70vw] bg-cyan-100/60 rounded-full blur-[120px] mix-blend-multiply"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          y: [0, -100, 0],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        // Changed to purple tones
        className="absolute -bottom-[20%] left-[20%] w-[60vw] h-[60vw] bg-purple-200/40 rounded-full blur-[90px] mix-blend-multiply"
      />
      <NoiseOverlay opacity={0.05} />
    </div>
  );
};

// --- Variant 2: Rugged Flux (Fixed) ---
// Removed blend modes that hid content. Used visible gray gradients.
export const RuggedFlux: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-100">
      <NoiseOverlay opacity={0.08} /> {/* Heavier noise for "Rugged" feel */}
      
      {/* Moving gradient blob 1 */}
      <motion.div
        animate={{ 
          x: ["-20%", "20%", "-20%"],
          y: ["-10%", "10%", "-10%"],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-0 w-[80%] h-[80%] bg-gradient-to-br from-slate-300/40 to-transparent blur-3xl rounded-full"
      />

       {/* Moving gradient blob 2 */}
       <motion.div
        animate={{ 
          x: ["20%", "-20%", "20%"],
          y: ["10%", "-10%", "10%"],
          scale: [1.1, 1, 1.1]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-0 right-0 w-[70%] h-[70%] bg-gradient-to-tl from-slate-300/40 to-transparent blur-3xl rounded-full"
      />
    </div>
  );
};

// --- Variant 3: Interactive Neural Grid (Original - Kept as is) ---
export const InteractiveNeuralGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let mouse = { x: -1000, y: -1000 };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    const gap = 40;
    const rows = Math.ceil(height / gap);
    const cols = Math.ceil(width / gap);
    let particles: { x: number; y: number; originX: number; originY: number }[] = [];

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * gap + gap / 2;
          const y = j * gap + gap / 2;
          particles.push({ x, y, originX: x, originY: y });
        }
      }
    };

    initParticles();

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const forceDist = 200;
        const force = Math.max(0, (forceDist - dist) / forceDist); 
        const angle = Math.atan2(dy, dx);
        const targetX = p.originX - Math.cos(angle) * force * 50;
        const targetY = p.originY - Math.sin(angle) * force * 50;
        p.x += (targetX - p.x) * 0.1;
        p.y += (targetY - p.y) * 0.1;

        ctx.fillStyle = '#94a3b8'; // Darker slate (400) for visibility
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(animate);
    };
    const animationId = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-slate-50">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-transparent to-white/90 pointer-events-none" />
    </div>
  );
};

// --- Variant 4: Silk Waves (Fixed) ---
// Increased stroke width and contrast.
export const SilkWaves: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden">
      <svg className="absolute w-full h-full" viewBox="0 0 1440 800" preserveAspectRatio="none">
        {/* Wave 1 */}
        <motion.path
          d="M0,200 C300,150 600,250 900,200 C1200,150 1440,200 1440,200 V800 H0 V200 Z"
          fill="none"
          stroke="#94a3b8" // Slate-400
          strokeWidth="1.5" // Thicker
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: 0.4,
            d: [
              "M0,200 C300,150 600,250 900,200 C1200,150 1440,200 1440,200 V800 H0 V200 Z",
              "M0,200 C300,250 600,150 900,250 C1200,200 1440,200 1440,200 V800 H0 V200 Z",
              "M0,200 C300,150 600,250 900,200 C1200,150 1440,200 1440,200 V800 H0 V200 Z",
            ]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* Wave 2 */}
        <motion.path
          d="M0,400 C300,350 600,450 900,400 C1200,350 1440,400 1440,400 V800 H0 V400 Z"
          fill="none"
          stroke="#64748b" // Slate-500 (Darker)
          strokeWidth="1.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: 0.3,
            d: [
              "M0,400 C300,450 600,350 900,450 C1200,400 1440,400 1440,400 V800 H0 V400 Z",
              "M0,400 C300,350 600,450 900,400 C1200,350 1440,400 1440,400 V800 H0 V400 Z",
            ]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      <NoiseOverlay />
    </div>
  );
};

// --- Variant 5: Focus Drift (Fixed) ---
// Added fills and darker borders.
export const FocusDrift: React.FC = () => {
  const shapes = Array.from({ length: 6 });
  
  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden">
      {shapes.map((_, i) => (
        <motion.div
          key={i}
          // Changed to visible background and border
          className="absolute rounded-full border border-slate-300 bg-slate-200/30 backdrop-blur-sm"
          initial={{ 
            width: Math.random() * 300 + 100, 
            height: Math.random() * 300 + 100,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            opacity: 0,
          }}
          animate={{
            y: [0, -60, 0],
            x: [0, 40, 0],
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.6, 0.3], // Higher opacity
          }}
          transition={{
            duration: 10 + Math.random() * 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 2
          }}
        />
      ))}
      <NoiseOverlay />
    </div>
  );
};

// --- Variant 6: Gradient Mesh (New) ---
// High-end, colorful but subtle mesh gradient.
export const GradientMesh: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-white overflow-hidden">
      {/* Top Left - Indigo */}
      <motion.div
        animate={{ 
          scale: [1, 1.4, 1],
          rotate: [0, 45, 0]
        }}
        transition={{ duration: 20, repeat: Infinity }}
        className="absolute -top-[20%] -left-[10%] w-[80vw] h-[80vw] bg-indigo-200/30 rounded-full blur-[100px]"
      />
      
      {/* Bottom Right - Pink/Purple */}
      <motion.div
        animate={{ 
          scale: [1, 1.3, 1],
          x: [0, -50, 0]
        }}
        transition={{ duration: 15, repeat: Infinity }}
        className="absolute -bottom-[20%] -right-[10%] w-[80vw] h-[80vw] bg-fuchsia-200/30 rounded-full blur-[100px]"
      />
      
      {/* Center - Blue */}
      <motion.div
        animate={{ 
          opacity: [0.2, 0.5, 0.2],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] bg-blue-200/30 rounded-full blur-[120px]"
      />
      
      <div className="absolute inset-0 bg-white/40 backdrop-blur-[100px]" />
      <NoiseOverlay opacity={0.04} />
    </div>
  );
};

// --- Variant 7: Architectural Grid (New) ---
// Perspective grid moving slowly.
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
        animate={{
          opacity: 0.4,
          y: [0, -64], // Move exactly one grid unit to loop perfectly
        }}
        transition={{
          opacity: { duration: 1 },
          y: {
            duration: 4,
            repeat: Infinity,
            ease: "linear"
          }
        }}
      />
      
      {/* Fade out horizon */}
      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-slate-50/20 to-slate-50 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-50 pointer-events-none" />
    </div>
  );
};

// --- Variant 8: Cognitive Pulse (Fixed) ---
// Enhanced contrast and range.
export const CognitivePulse: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-white flex items-center justify-center overflow-hidden">
      {/* Outer Pulse */}
      <motion.div
        animate={{
          scale: [1, 1.8, 1],
          opacity: [0.3, 0.0, 0.3],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[40vw] h-[40vw] rounded-full border border-slate-300/50"
      />
      
      {/* Middle Pulse */}
      <motion.div
        animate={{
          scale: [0.8, 1.4, 0.8],
          opacity: [0.1, 0.4, 0.1],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute w-[30vw] h-[30vw] bg-indigo-100/40 rounded-full blur-[60px]"
      />

      {/* Center Core */}
      <motion.div
        animate={{
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[15vw] h-[15vw] bg-gradient-to-tr from-slate-100 to-white rounded-full shadow-[0_0_80px_rgba(200,200,255,0.4)]"
      />
      
       <NoiseOverlay />
    </div>
  );
};

// --- Variant 9: Circuit Lattice (Refined) ---
// Visible, tech-focused lines connecting nodes.
// Adjustments: Opacity 0.35, Stroke Width 1.2, Color #64748b, Slower Speed, Extra Path.
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
        
        {/* Animated circuit paths - Reverted color, thinner stroke, slower speed */}
        <motion.path
          d="M 100,100 H 300 V 300 H 600"
          fill="none"
          stroke="#64748b" // Slate-500
          strokeWidth="1.2" // Thinner
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "linear", repeatDelay: 1.0 }}
        />
        <motion.path
          d="M 800,500 V 200 H 500"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "linear", delay: 2.0, repeatDelay: 2.0 }}
        />
         <motion.path
          d="M 200,600 H 400 V 800"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "linear", delay: 0.8, repeatDelay: 1.5 }}
        />
         {/* Path 4 */}
         <motion.path
          d="M 500,0 V 200 H 800"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "linear", delay: 1.5, repeatDelay: 1.2 }} 
        />
         {/* New Path 5 - Rising from bottom right */}
         <motion.path
          d="M 900,900 V 700 H 600"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 0] }}
          transition={{ duration: 4.0, repeat: Infinity, ease: "linear", delay: 0.2, repeatDelay: 1.8 }} 
        />
      </svg>
      {/* Soft gradient overlay to fade edges */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,white_90%)]" />
      <NoiseOverlay opacity={0.05} />
    </div>
  );
};

// --- Variant 10: Liquid Chrome (New) ---
// Metaball effect using SVG filters for organic "gooey" look.
export const LiquidChrome: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-slate-100 overflow-hidden">
      {/* SVG Filter Definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </svg>

      <div style={{ filter: 'url(#goo)' }} className="absolute inset-0 w-full h-full">
         <motion.div 
            animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[30%] left-[30%] w-64 h-64 bg-slate-300 rounded-full mix-blend-multiply opacity-60"
         />
         <motion.div 
            animate={{ x: [0, -80, 0], y: [0, 100, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-[30%] left-[40%] w-56 h-56 bg-indigo-200 rounded-full mix-blend-multiply opacity-60"
         />
         <motion.div 
            animate={{ x: [0, 60, 0], y: [0, -60, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-[40%] left-[35%] w-48 h-48 bg-blue-200 rounded-full mix-blend-multiply opacity-60"
         />
      </div>
      <NoiseOverlay />
    </div>
  );
};

// --- Variant 11: Digital Rain (New) ---
// Elegant falling lines, like a minimalist matrix.
export const DigitalRain: React.FC = () => {
  const drops = Array.from({ length: 20 });
  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden flex justify-around">
      {drops.map((_, i) => (
        <motion.div
          key={i}
          className="w-[1px] bg-gradient-to-b from-transparent via-slate-400 to-transparent opacity-40"
          initial={{ y: -200, height: Math.random() * 100 + 50 }}
          animate={{ y: window.innerHeight + 200 }}
          transition={{
            duration: Math.random() * 5 + 5, // Random speed between 5-10s
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 5
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-transparent to-slate-50 pointer-events-none" />
      <NoiseOverlay />
    </div>
  );
};

// --- Variant 12: Bauhaus Geometry (New) ---
// Strong, simple shapes rotating slowly.
export const BauhausGeometry: React.FC = () => {
  return (
    <div className="absolute inset-0 bg-slate-50 overflow-hidden flex items-center justify-center">
      {/* Large Circle */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute -left-[10%] top-[20%] w-[50vh] h-[50vh] border border-slate-300 rounded-full opacity-40"
      />
      
      {/* Square */}
      <motion.div
        animate={{ rotate: -360, scale: [1, 1.1, 1] }}
        transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        className="absolute -right-[5%] bottom-[10%] w-[40vh] h-[40vh] border border-slate-300 opacity-40"
      />
      
      {/* Triangle (using clip-path) */}
      <motion.div
        animate={{ rotate: 180, y: [0, -50, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute left-[30%] -top-[10%] w-[30vh] h-[30vh] bg-indigo-100 opacity-30"
        style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}
      />
      
      <div className="absolute inset-0 backdrop-blur-[50px]" />
      <NoiseOverlay />
    </div>
  );
};