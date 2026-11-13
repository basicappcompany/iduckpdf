// Shapes shared by the landing-page content files.
export type LandingFaq = { q: string; a: string };
export type LandingTable = { caption: string; head: string[]; rows: string[][]; note?: string };
export type Landing = {
  slug: string; // URL path segment, e.g. 'how-it-works'
  kind: 'info' | 'compare' | 'size' | 'job';
  title: string; // <title> without the site name
  description: string; // meta description, under 155 characters
  h1: string;
  answer: string; // 40 to 60 words, answer first
  steps?: string[]; // numbered steps (also emitted as HowTo)
  sections: { h: string; p: string[] }[]; // the "Good to know" body and other text
  table?: LandingTable;
  faq: LandingFaq[];
  tool?: string; // tool id shown (and runnable) on the page
  preset?: Record<string, string>; // option values the embedded tool starts with
  related: string[]; // tool ids
  reviewed: string; // ISO date, shown as "Last reviewed"
  sources?: { label: string; url: string }[];
};

export const REVIEWED = '2026-11-14';
