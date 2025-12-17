import React from 'react';
import { motion, Variants } from 'framer-motion';
import { TeamMember } from '../types';
import SEO from '../components/SEO';

const teamMembers: TeamMember[] = [
  {
    id: '1',
    name: 'Dr. Elena Vora',
    role: 'Chief Scientist',
    bio: 'Former lead at DeepMind. Focused on neuro-symbolic reasoning.',
    image: 'https://picsum.photos/400/500?random=1'
  },
  {
    id: '2',
    name: 'James Chen',
    role: 'Head of Engineering',
    bio: 'Architect of scalable distributed systems for training large models.',
    image: 'https://picsum.photos/400/500?random=2'
  },
  {
    id: '3',
    name: 'Sarah Al-Fayed',
    role: 'Research Scientist',
    bio: 'Specializing in alignment and interpretability of black-box models.',
    image: 'https://picsum.photos/400/500?random=3'
  },
  {
    id: '4',
    name: 'David Thorne',
    role: 'Product Strategy',
    bio: 'Bridging the gap between theoretical research and practical application.',
    image: 'https://picsum.photos/400/500?random=4'
  }
];

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

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

      <div className="mb-16 border-b border-slate-200 pb-4 flex justify-between items-end">
        <h2 className="text-3xl font-serif italic text-slate-800">The Team</h2>
        <span className="text-sm text-slate-400 font-light">San Francisco / London / Remote</span>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16"
      >
        {teamMembers.map((member) => (
          <motion.div key={member.id} variants={item} className="group cursor-pointer">
            <div className="relative overflow-hidden mb-6 rounded-sm bg-slate-100 aspect-[4/5]">
               <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/5 transition-colors duration-500 z-10" />
              <img 
                src={member.image} 
                alt={member.name} 
                className="object-cover w-full h-full filter grayscale contrast-[0.9] brightness-[1.1] group-hover:scale-105 transition-transform duration-700 ease-in-out"
              />
            </div>
            <h3 className="text-lg font-medium text-slate-900">{member.name}</h3>
            <p className="text-xs uppercase tracking-wider text-slate-400 mt-1 mb-3">{member.role}</p>
            <p className="text-sm text-slate-500 font-light leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              {member.bio}
            </p>
          </motion.div>
        ))}
      </motion.div>

      <section className="mt-40 bg-slate-50 p-12 rounded-3xl relative overflow-hidden">
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-light text-slate-900 mb-6">Join our research</h2>
          <p className="text-slate-500 font-light mb-8">
            We are always looking for exceptional talent to join our team. 
            If you are obsessed with solving intelligence, we want to hear from you.
          </p>
          <button className="px-8 py-3 bg-white border border-slate-200 text-slate-900 rounded-full hover:bg-slate-900 hover:text-white transition-all duration-300 shadow-sm hover:shadow-md">
            View Open Positions
          </button>
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