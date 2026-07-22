import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'baseline') {
    throw new Error('Baseline mode is development-only. Run a normal production build instead.');
  }
  const baselineMode = mode === 'baseline';
  const lazyEntries = {
    plan: resolve('src/components/AuthorizedApp.jsx'),
    settings: resolve('src/components/Settings.jsx'),
    workout: resolve('src/components/WorkoutView.jsx'),
  };
  return {
  build: {
    manifest: true,
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      preserveEntrySignatures: 'allow-extension',
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [{
            name: 'firestore-sdk',
            test: id => id.replaceAll('\\', '/').includes('/node_modules/@firebase/firestore/'),
            includeDependenciesRecursively: false,
          }],
        },
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'lazy-entry-urls',
      resolveId(id) { if (id === 'virtual:lazy-entry-urls') return '\0virtual:lazy-entry-urls'; },
      load(id) {
        if (id !== '\0virtual:lazy-entry-urls') return null;
        if (command !== 'build') return `export default ${JSON.stringify(Object.fromEntries(Object.keys(lazyEntries).map(key => [key, `/src/components/${key === 'plan' ? 'AuthorizedApp' : key === 'settings' ? 'Settings' : 'WorkoutView'}.jsx`])))};`;
        const references = Object.fromEntries(Object.entries(lazyEntries).map(([key, entry]) => [key, this.emitFile({ type: 'chunk', id: entry, implicitlyLoadedAfterOneOf: [resolve('src/App.jsx')] })]));
        return `export default {${Object.entries(references).map(([key, reference]) => `${key}: import.meta.ROLLUP_FILE_URL_${reference}`).join(',')}};`;
      },
    },
    {
      name: 'chunk-provenance',
      generateBundle(_, bundle) {
        const provenance = Object.values(bundle).filter(asset => asset.type === 'chunk').map(chunk => ({
          file: chunk.fileName,
          modules: Object.keys(chunk.modules).map(id => id.replaceAll('\\', '/')),
        }));
        mkdirSync(resolve('dist/.vite'), { recursive: true });
        writeFileSync(resolve('dist/.vite/chunk-provenance.json'), JSON.stringify(provenance, null, 2));
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: !baselineMode
      },
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        manifestTransforms: [async entries => {
          writeFileSync(resolve('dist/.vite/pwa-precache.json'), JSON.stringify(entries, null, 2))
          return { manifest: entries, warnings: [] }
        }],
      },
      manifest: {
        name: 'Adaptive Workouts',
        short_name: 'Workouts',
        description: 'Adaptive Hypertrophy Programming App',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    }),
    {
      name: 'lazy-entry-manifest-semantics',
      enforce: 'post',
      generateBundle: {
        order: 'post',
        handler(_, bundle) {
          const asset = bundle['.vite/manifest.json'];
          if (!asset || asset.type !== 'asset') return;
          const manifest = JSON.parse(String(asset.source));
          for (const key of ['src/components/AuthorizedApp.jsx', 'src/components/Settings.jsx', 'src/components/WorkoutView.jsx']) {
            if (manifest[key]?.isEntry) {
              delete manifest[key].isEntry;
              manifest[key].isDynamicEntry = true;
            }
          }
          asset.source = JSON.stringify(manifest, null, 2);
        },
      },
    }
  ],
  test: {
    environment: 'jsdom',
  },
  };
})
