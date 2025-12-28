import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'leaflet'],
  },
});
