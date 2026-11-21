import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Three.js se cachea aparte del código del juego; cada juego es su propio chunk diferido.
        manualChunks: { three: ['three'] }
      }
    }
  }
});
