import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Three.js is cached separately from game code; each game is its own lazy chunk.
        manualChunks: { three: ['three'] }
      }
    }
  }
});
