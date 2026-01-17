import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import BlurBackground from './BlurBackground';
import logo from '../no-background-logo.png';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  // Don't show standard background on showcase page as it has its own
  const isShowcase = location.pathname === '/showcase';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { name: 'Research', path: '/#research' },
    { name: 'About', path: '/about' },
    { name: 'Journal', path: '/blog' },
  ];

  return (
    <div className={`min-h-screen flex flex-col relative text-text-main font-sans selection:bg-slate-200 selection:text-slate-900 ${isShowcase ? 'bg-transparent' : 'bg-background'}`}>
      {!isShowcase && <BlurBackground />}

      {/* Navigation */}
      <header 
        className={`fixed top-0 w-full z-50 transition-all duration-500 border-b ${
          isScrolled 
            ? 'bg-white/70 backdrop-blur-xl border-slate-200/50 py-4' 
            : 'bg-transparent border-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center group">
            <img
              src={logo}
              alt="Mercity"
              className="h-[42px] w-auto transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                to={link.path}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors duration-300 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-slate-900 transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
            <button className="px-5 py-2 text-xs font-semibold uppercase tracking-wider border border-slate-200 rounded-full hover:bg-slate-900 hover:text-white transition-all duration-300">
              Join Waitlist
            </button>
          </nav>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden text-slate-900"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white/95 backdrop-blur-2xl pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-8 text-2xl font-light">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  to={link.path}
                  className="border-b border-slate-100 pb-4"
                >
                  {link.name}
                </Link>
              ))}
              <Link to="/showcase" className="border-b border-slate-100 pb-4 text-indigo-600">Animation Showcase</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`flex-grow ${isShowcase ? '' : 'pt-24'}`}>
        {children}
      </main>

      {/* Footer */}
      {!isShowcase && (
        <footer className="border-t border-slate-200 mt-20 bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              <div className="col-span-1 md:col-span-2">
                <h3 className="font-serif italic text-xl mb-6">Mercity</h3>
                <p className="text-slate-500 max-w-sm font-light leading-relaxed">
                  Building the cognitive architecture for the next century. 
                  We are a research laboratory dedicated to safe, general intelligence.
                </p>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 mb-6">Sitemap</h4>
                <ul className="space-y-4 text-sm text-slate-500 font-light">
                  <li><Link to="/" className="hover:text-slate-900 transition-colors">Home</Link></li>
                  <li><Link to="/about" className="hover:text-slate-900 transition-colors">About Us</Link></li>
                  <li><Link to="/blog" className="hover:text-slate-900 transition-colors">Research Journal</Link></li>
                  <li><Link to="/showcase" className="hover:text-slate-900 transition-colors text-indigo-500">Design Showcase</Link></li>
                  <li><a href="#" className="hover:text-slate-900 transition-colors">Careers</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900 mb-6">Connect</h4>
                <ul className="space-y-4 text-sm text-slate-500 font-light">
                  <li><a href="#" className="hover:text-slate-900 transition-colors">Twitter / X</a></li>
                  <li><a href="#" className="hover:text-slate-900 transition-colors">LinkedIn</a></li>
                  <li><a href="#" className="hover:text-slate-900 transition-colors">GitHub</a></li>
                  <li className="flex items-center gap-2 cursor-pointer group">
                    <span className="group-hover:underline">hello@Mercity.ai</span>
                    <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between text-xs text-slate-400 font-light">
              <p>&copy; {new Date().getFullYear()} Mercity Research Labs. All rights reserved.</p>
              <div className="flex gap-6 mt-4 md:mt-0">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;