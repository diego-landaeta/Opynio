/**
 * Fetch sitemap from Supabase Edge Function and save to public/sitemap.xml
 * Run with: node scripts/fetch-sitemap.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL de tu Edge Function
const SUPABASE_FUNCTION_URL = 'https://hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/generate-sitemap';

console.log('🚀 Fetching sitemap from Supabase Edge Function...');

https.get(SUPABASE_FUNCTION_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
      fs.writeFileSync(sitemapPath, data, 'utf-8');
      console.log(`✅ Sitemap saved to: ${sitemapPath}`);
      console.log(`📊 Sitemap size: ${(data.length / 1024).toFixed(2)} KB`);
    } else {
      console.error(`❌ Error: HTTP ${res.statusCode}`);
      console.error(data);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('❌ Error fetching sitemap:', err.message);
  process.exit(1);
});
