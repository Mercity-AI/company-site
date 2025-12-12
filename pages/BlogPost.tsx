import React, { useEffect } from 'react';
import { useParams, Link, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { posts } from '@/.velite';

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const post = posts.find((p) => p.slug === slug);

  // Handle post not found
  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  // Handle hash navigation on mount and hash change
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const element = document.getElementById(id);
      
      if (element) {
        // Delay to ensure content is fully rendered
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }, [location.hash]);

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
