import React from 'react';
import { motion } from 'framer-motion';

interface BlurBackgroundProps {
  className?: string;
}

const BlurBackground: React.FC<BlurBackgroundProps> = ({ className = "" }) => {
  return (
    <div className={`fixed inset-0 z-[-1] overflow-hidden pointer-events-none ${className}`}>
      {/* Top Right Subtle Blue/Grey */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 20, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[10%] -right-[10%] w-[50vw] h-[50vw] bg-slate-200/40 rounded-full blur-[120px] mix-blend-multiply"
      />
      
      {/* Bottom Left Subtle Indigo */}
      <motion.div 
         animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
          y: [0, -30, 0]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute -bottom-[10%] -left-[10%] w-[40vw] h-[40vw] bg-indigo-50/60 rounded-full blur-[100px] mix-blend-multiply"
      />

      {/* Center Floater - "Rugged" noise overlay could be added here via SVG, but sticking to pure CSS blur for performance */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none" />
    </div>
  );
};

export default BlurBackground;