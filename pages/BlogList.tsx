import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { posts } from '@/.velite';
import SEO from '../components/SEO';

const BlogList: React.FC = () => {
  // Sort posts by date (newest first)
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  // In production, use static HTML files. In dev, use SPA routing
  const isDev = import.meta.env.DEV;

  return (
    <>
      <SEO
        title="Research Journal"
        description="Deep dives into our research, engineering challenges, and the future of artificial intelligence."
        url="/blog"
      />
      <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-24 pt-12">
        <h1 className="text-6xl md:text-8xl font-serif italic text-slate-900 mb-6 opacity-90">Journal</h1>
        <p className="text-slate-500 max-w-xl text-lg font-light">
          Deep dives into our research, engineering challenges, and the future of artificial intelligence.
        </p>
      </div>

      <div className="space-y-20">
        {sortedPosts.map((post) => (
          <motion.article 
            key={post.slug}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
            className="group block border-t border-slate-200 pt-12"
          >
            {isDev ? (
              <Link to={`/blog-post/${post.slug}`} className="grid grid-cols-1 md:grid-cols-12 gap-6">
            ) : (
              <a href={`/blog-post/${post.slug}.html`} className="grid grid-cols-1 md:grid-cols-12 gap-6">
            )}
              <div className="md:col-span-3 text-sm text-slate-400 font-mono flex flex-col gap-2">
                <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span className="text-slate-800 font-medium">{post.category}</span>
              </div>
              <div className="md:col-span-9">
                <h2 className="text-2xl md:text-4xl font-light text-slate-900 mb-4 group-hover:text-indigo-900 transition-colors leading-tight">
                  {post.title}
                </h2>
                <p className="text-slate-500 font-light text-lg leading-relaxed max-w-3xl mb-6">
                  {post.summary}
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>{post.authors[0]?.name}</span>
                  <span>·</span>
                  <span>{post.readingTime}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-widest text-slate-900 opacity-0 transform -translate-x-4 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 mt-4">
                  Read Article <span className="text-lg">→</span>
                </div>
              </div>
            {isDev ? </Link> : </a>}
          </motion.article>
        ))}
      </div>
    </div>
    </>
  );
};

export default BlogList;
