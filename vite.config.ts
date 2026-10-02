import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plugin para inyectar modulepreload de páginas públicas críticas
// Modo docker = pruebas contra el Supabase local. Si por lo que sea (variables
// de entorno del proceso, recarga tras editar .env) la URL resuelta no es
// local, se para en seco: pasó dos veces que el servidor de pruebas acabó
// sirviendo la URL de produccion.
function guardDockerEnv(): Plugin {
  return {
    name: 'guard-docker-env',
    configResolved(config) {
      if (config.mode !== 'docker') return;
      const url = config.env.VITE_SUPABASE_URL || '';
      if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
        throw new Error(`[guard-docker-env] --mode docker pero VITE_SUPABASE_URL no es local (${url.replace(/^https?:\/\//, '').split('.')[0]}...). Revisa .env.docker.local y las variables de entorno del proceso.`);
      }
    },
  };
}

// Las rutas de todos los idiomas viven copiadas en
// contexts/localePaths.generated.ts (para no descargar los 31 locales). Si un
// locale cambia sus `paths` y nadie regenera, el build se para aqui (en dev
// solo avisa al arrancar, para no tumbar el servidor a medio trabajo).
function checkLocalePaths(): Plugin {
  let isBuild = false;
  return {
    name: 'check-locale-paths',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    async buildStart() {
      const { comprobar } = await import('./scripts/gen-locale-paths.mjs');
      if (await comprobar()) return;
      const msg = '[check-locale-paths] contexts/localePaths.generated.ts no coincide con locales/*.ts. Ejecuta: npm run gen:locale-paths';
      if (isBuild) throw new Error(msg);
      console.warn(`⚠️  ${msg}`);
    },
  };
}

function injectPublicPagePreloads(): Plugin {
  // outDir real del build: antes estaba fijo a dist/ y un build con --outDir
  // a otra carpeta modificaba igualmente el dist/ del repo.
  let outDir = path.join(__dirname, 'dist');
  return {
    name: 'inject-public-page-preloads',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      // Hook para inyectar modulepreload después del build con los hashes reales
      try {
        const distPath = outDir;
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
  plugins: [guardDockerEnv(), checkLocalePaths(), react(), injectPublicPagePreloads()],
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
        // Mantener console.* en el bundle para poder debugear el flujo de signup en
        // producción. Cambia a `true` cuando termines de diagnosticar para no ensuciar
        // la consola de los visitantes.
        drop_console: false,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Helpers de @rollup/plugin-commonjs (getDefaultExportFromCjs...). Sin
          // asignar, Rollup los metia en el chunk de leaflet y react-core y
          // supabase importaban leaflet: el mapa (43 KB gzip) en cada visita.
          if (id.includes('commonjsHelpers')) {
            return 'react-core';
          }
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
          // Traducciones: un chunk por idioma. i18nContext importa es de forma
          // estatica (fallback de t()) y el resto con import() al elegirlo.
          // Antes iban todas juntas en un chunk `locales` de ~1 MB gzip que se
          // bajaba en cada visita. Nombre fijo por idioma para reconocerlos en
          // la red; un cambio de codigo no invalida su cache.
          const locale = id.match(/[\\/]locales[\\/]([a-z]+)\.ts$/);
          if (locale) {
            return `locale-${locale[1]}`;
          }
          // OJO: nada de agrupar paginas por carpeta (/pages/admin/,
          // /pages/business/, auth pages). Rollup metia en esos chunks manuales
          // los modulos compartidos (contexts, services, componentes...) y la
          // entrada acababa importando estaticamente admin-pages y
          // business-pages: todo visitante descargaba el panel de admin. Las
          // paginas son lazy() en App.tsx y Rollup las separa solas.
        },
      },
    },
    chunkSizeWarningLimit: 500, // Lower limit to catch large chunks
    cssCodeSplit: true, // Split CSS per chunk
    assetsInlineLimit: 4096, // Inline small assets
    // Sin lista blanca de preload. Antes habia un resolveDependencies que solo
    // dejaba precargar react-core/react-router/supabase/index/paginas publicas,
    // pero no ahorraba nada: los chunks "bloqueados" eran imports estaticos de
    // la entrada (admin-pages, business-pages...) y el navegador los bajaba
    // igual, solo que mas tarde (en cascada). Ahora que la entrada ya no
    // arrastra chunks de paginas, lo que Vite quiere precargar es exactamente
    // lo que se va a ejecutar: en el HTML, las dependencias estaticas de la
    // entrada; en cada import() lazy, las de esa pagina. Filtrarlo solo
    // anadiria viajes de red (y con nombres de chunk generados por Rollup la
    // lista blanca ya no casaria con nada util).
    modulePreload: {
      polyfill: false,
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'leaflet'],
  },
});
