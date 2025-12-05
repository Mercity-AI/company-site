import React from 'react';

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string; // Typically markdown or HTML string
  date: string;
  author: string;
  readTime: string;
  category: string;
  coverImage?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
}

export interface ResearchArea {
  title: string;
  description: string;
  icon: React.ReactNode;
}