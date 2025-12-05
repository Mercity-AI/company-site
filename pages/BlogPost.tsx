import React, { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { posts } from '@/.velite';
import { summarizeText } from '../services/geminiService';

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = posts.find((p) => p.slug === slug);
  
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle post not found
  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const handleGenerateSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use raw content for summary (strip any HTML)
      const plainText = post.raw.replace(/<[^>]+>/g, '');
      const result = await summarizeText(plainText);
      setSummary(result);
    } catch (err) {
      setError("Unable to generate summary at this time. Please check API configuration.");
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-900 transition-colors mb-12 group">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Journal
      </Link>

      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <header className="mb-12">
          <div className="flex items-center gap-4 text-sm text-slate-500 font-mono mb-6">
            <span className="bg-slate-100 px-3 py-1 rounded-full text-slate-900">{post.category}</span>
            <span>{post.readingTime}</span>
            <span>{formattedDate}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-light text-slate-900 leading-tight mb-8">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 border-t border-b border-slate-100 py-6">
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
              {post.authors[0]?.image ? (
                <img src={post.authors[0].image} alt={post.authors[0].name} className="w-full h-full object-cover" />
              ) : (
                <img src={`https://picsum.photos/200?random=${post.slug}`} alt={post.authors[0]?.name} className="w-full h-full object-cover" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{post.authors[0]?.name}</p>
              {post.authors[0]?.role && (
                <p className="text-xs text-slate-500">{post.authors[0].role}</p>
              )}
            </div>
          </div>
        </header>

        {/* AI Summary Feature */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 mb-12 backdrop-blur-sm">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-900 flex items-center gap-2">
              <Sparkles size={14} /> AI Research Abstract
            </h3>
            {!summary && !loading && (
              <button 
                onClick={handleGenerateSummary}
                className="text-xs bg-white border border-indigo-200 text-indigo-900 px-3 py-1 rounded-full hover:bg-indigo-50 transition-colors"
              >
                Generate Summary
              </button>
            )}
          </div>
          
          {loading && (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
              <Loader2 className="animate-spin" size={16} /> Analysis in progress...
            </div>
          )}

          {error && (
             <div className="text-red-400 text-sm py-2">
               {error}
             </div>
          )}

          {summary && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="text-slate-700 text-sm leading-relaxed font-light font-serif italic"
            >
              {summary}
            </motion.div>
          )}

          {!summary && !loading && !error && (
            <p className="text-slate-400 text-sm italic">
              Tap the button to generate a real-time summary of this research paper using our Mercity-Lite model (Gemini).
            </p>
          )}
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div 
          className="prose prose-lg prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </motion.article>
    </div>
  );
};

export default BlogPostPage;
