import { defineConfig } from 'vite';
export default defineConfig({
  build: { rollupOptions: { input: { expedition: 'index.html', forest: 'forest.html' } } }
});
