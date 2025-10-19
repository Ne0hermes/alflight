import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      // DÉSACTIVER PWA en mode développement pour éviter le cache
      disable: mode === 'development',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Système de Gestion de Vol',
        short_name: 'SGV',
        description: 'Application de gestion de vol avec cartes VAC',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,pdf}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 an
              }
            }
          }
        ]
      },
      // Options de développement
      devOptions: {
        enabled: false, // Désactiver complètement en dev
        type: 'module'
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@core': path.resolve(__dirname, './src/core'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@data': path.resolve(__dirname, './src/data'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@context': path.resolve(__dirname, './src/old/context'),
      '@modules': path.resolve(__dirname, './src/old/modules')
    }
  },
  server: {
    port: 4001,
    host: '0.0.0.0',
    strictPort: false,
    hmr: {
      clientPort: 4001,
      port: 4001,
      protocol: 'ws',
      host: 'localhost'
    },
    // DÉSACTIVÉ: Ces headers bloquent les requêtes Supabase
    // headers: {
    //   'Cross-Origin-Embedder-Policy': 'require-corp',
    //   'Cross-Origin-Opener-Policy': 'same-origin'
    // },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4001/',
        changeOrigin: true,
      },
      '/api/vac-proxy': {
        target: 'https://www.sia.aviation-civile.gouv.fr',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const targetPath = url.searchParams.get('url');
          return targetPath.replace('https://www.sia.aviation-civile.gouv.fr', '');
        },
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Ajouter des headers si nécessaire pour contourner CORS
            proxyReq.setHeader('Origin', 'https://www.sia.aviation-civile.gouv.fr');
            proxyReq.setHeader('Referer', 'https://www.sia.aviation-civile.gouv.fr/');
          });
        }
      }
    }
  },
  optimizeDeps: {
    include: ['pdfjs-dist'],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  worker: {
    format: 'es'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          pdf: ['pdfjs-dist']
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Augmenter la limite pour les PDFs
  }
}));