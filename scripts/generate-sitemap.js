#!/usr/bin/env node
/**
 * Asendify Realty — regenerate sitemap.xml from data/properties.json.
 * Run directly with `node scripts/generate-sitemap.js`, or it's called
 * automatically at the end of add-property.js and update-status.js.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'properties.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const BASE_URL = 'https://realty.asendify.co';

const STATIC_PAGES = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/listings.html', priority: '0.9', changefreq: 'daily' },
  { loc: '/koregaon-park.html', priority: '0.9', changefreq: 'daily' },
  { loc: '/kalyani-nagar.html', priority: '0.9', changefreq: 'daily' },
  { loc: '/viman-nagar.html', priority: '0.9', changefreq: 'daily' },
  { loc: '/pune-rent-affordability-calculator/', priority: '0.8', changefreq: 'monthly' }, // 2026-10-20: free tool
];

function generate() {
  const properties = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);

  const staticEntries = STATIC_PAGES.map(p => `  <url>
    <loc>${BASE_URL}${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const propertyEntries = properties
    .filter(p => p.status === 'available')
    .map(p => `  <url>
    <loc>${BASE_URL}/property.html?id=${encodeURIComponent(p.id)}</loc>
    <lastmod>${p.postedDate || today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');

  // 2026-10-24: keep the blog URLs that scripts/build_realty_blog.py adds (nightly Realty blog workflow).
  let blogEntries = '';
  try {
    const old = fs.readFileSync(SITEMAP_PATH, 'utf8');
    blogEntries = (old.match(/[ \t]*<url>\s*<loc>https:\/\/realty\.asendify\.co\/blog\/[\s\S]*?<\/url>/g) || []).join('\n');
  } catch (e) { /* no old sitemap */ }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${propertyEntries}${blogEntries ? '\n' + blogEntries : ''}
</urlset>
`;

  fs.writeFileSync(SITEMAP_PATH, xml);
  console.log(`✔  sitemap.xml regenerated (${STATIC_PAGES.length} static pages + ${properties.filter(p => p.status === 'available').length} listings).`);
}

generate();
