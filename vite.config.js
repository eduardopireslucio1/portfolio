import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = (file) => fileURLToPath(new URL(file, import.meta.url));

// Relative base so the build works on GitHub Pages under any repo path
export default defineConfig({
  base: './',
  build: {
    rolldownOptions: {
      input: { main: page('./index.html'), projects: page('./projects.html') },
    },
  },
});
