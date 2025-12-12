import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import BlogList from './pages/BlogList';
import BlogPostPage from './pages/BlogPost';
import AnimationShowcase from './pages/AnimationShowcase';
import ScrollToTop from './components/ScrollToTop';

// Helper component to scroll to top on route change
const ScrollToTopHelper = () => {
    return <ScrollToTop />;
}

const App: React.FC = () => {
  return (
    <Router>
      <ScrollToTopHelper />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/showcase" element={<AnimationShowcase />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
