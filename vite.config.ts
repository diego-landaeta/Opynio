import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plugin para inyectar modulepreload de páginas públicas críticas
function injectPublicPagePreloads(): Plugin {
  return {
    name: 'inject-public-page-preloads',
    closeBundle() {
      // Hook para inyectar modulepreload después del build con los hashes reales
      try {
        const distPath = path.join(__dirname, 'dist');
        const indexPath = path.join(distPath, 'index.html');

        if (!fs.existsSync(indexPath)) return;

        let html = fs.readFileSync(indexPath, 'utf-8');

        // Buscar los archivos reales en dist/assets
        const assetsPath = path.join(distPath, 'assets');
        if (!fs.existsSync(assetsPath)) return;

        const files = fs.readdirSync(assetsPath);
        const publicPages = ['HomePage', 'BusinessPage', 'BusinessesPage', 'ExplorePage'];

        // Buscar el punto de inserción (después de supabase modulepreload)
        const supabasePreloadRegex = /<link rel="modulepreload"[^>]*href="\/assets\/supabase-[^"]+\.js"[^>]*>/;
        const match = html.match(supabasePreloadRegex);

        if (!match) {
          console.warn('⚠️  No se encontró el punto de inserción para modulepreload de páginas públicas');
          return;
        }

        const insertIndex = match.index! + match[0].length;

        // Para cada página pública, encontrar su archivo real con hash
        const preloadTags: string[] = [];
        const notFound: string[] = [];

        publicPages.forEach(page => {
          // Verificar si ya está precargado por Vite
          if (html.includes(`${page}-`)) {
            console.log(`ℹ️  ${page} ya está precargado por Vite`);
            return;
          }

          const regex = new RegExp(`^${page}-[a-zA-Z0-9_-]+\\.js$`);
          const file = files.find((f: string) => regex.test(f));

          if (file) {
            preloadTags.push(`  <link rel="modulepreload" crossorigin href="/assets/${file}">`);
            console.log(`✅ ${page} → ${file}`);
          } else {
            notFound.push(page);
            console.warn(`⚠️  ${page} no encontrado (regex: ${regex})`);
          }
        });

        if (preloadTags.length > 0) {
          html = html.slice(0, insertIndex) + '\n' + preloadTags.join('\n') + html.slice(insertIndex);
          fs.writeFileSync(indexPath, html, 'utf-8');
          console.log(`✅ Inyectados ${preloadTags.length} modulepreload de páginas públicas`);
        }

        if (notFound.length > 0) {
          console.warn(`⚠️  Páginas no encontradas: ${notFound.join(', ')}`);
        }
      } catch (err) {
        console.warn('⚠️  No se pudieron inyectar modulepreload de páginas públicas:', err);
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), injectPublicPagePreloads()],
  server: {
    port: 3000,
    open: true,
    allowedHosts: ['.trycloudflare.com', '.loca.lt', '.ngrok.io', '.ngrok-free.app'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React bundle - load first
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core';
          }
          // Router separate for better caching
          if (id.includes('node_modules/react-router')) {
            return 'react-router';
          }
          // Supabase - only loaded when needed
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase';
          }
          // Map library - lazy loaded
          if (id.includes('node_modules/leaflet')) {
            return 'leaflet';
          }
          // Stripe - lazy loaded for payment pages
          if (id.includes('node_modules/@stripe/')) {
            return 'stripe';
          }
          // Google AI - lazy loaded for AI features
          if (id.includes('node_modules/@google/genai')) {
            return 'google-ai';
          }
          // Admin pages bundle
          if (id.includes('/pages/admin/')) {
            return 'admin-pages';
          }
          // Business dashboard pages bundle
          if (id.includes('/pages/business/')) {
            return 'business-pages';
          }
          // Auth pages bundle
          if (id.includes('LoginPage') || id.includes('RegisterPage') || id.includes('ForgotPassword') || id.includes('ResetPassword')) {
            return 'auth-pages';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500, // Lower limit to catch large chunks
    cssCodeSplit: true, // Split CSS per chunk
    assetsInlineLimit: 4096, // Inline small assets
    // OPTIMIZACIÓN CRÍTICA: Bloquear preload automático de Vite
    // Solo permitir chunks críticos + páginas públicas (inyectadas por plugin)
    // BLOQUEADOS: admin-pages (986KB), google-ai (213KB), leaflet (149KB), business-pages (137KB)
    modulePreload: {
      polyfill: false,
      resolveDependencies: (filename, deps) => {
        // Lista blanca de chunks permitidos para preload
        const allowedChunks = [
          'react-core',
          'react-router',
          'supabase',
          'index',
          // Páginas públicas (inyectadas por plugin después)
          'HomePage',
          'BusinessPage',
          'BusinessesPage',
          'ExplorePage',
        ];

        // Filtrar: solo permitir los chunks en la lista blanca
        return deps.filter(dep => {
          // Verificar si el dep contiene alguno de los chunks permitidos
          return allowedChunks.some(chunk => dep.includes(chunk));
        });
      }
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'leaflet'],
  },
});
