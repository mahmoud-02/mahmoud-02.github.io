import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from the root of mahmoud-abia.com, not a /repo-name/ subpath.
  base: '/',

  build: {
    // Vite's own hashed JS/CSS bundles default to dist/assets/, which would
    // land in the same folder as our hand-managed public/assets/ (images, CV,
    // logos). Keeping them apart makes it obvious which files are ours.
    assetsDir: 'static',

    // The one chunk over Vite's 500 kB default is Three.js (~540 kB, 135 kB
    // gzipped), and it's lazy-loaded after the page is idle — see
    // src/scene/main.ts. The limit sits just above it, so anything else
    // growing large, especially in the initial bundle, still gets flagged.
    chunkSizeWarningLimit: 600,
  },
})
