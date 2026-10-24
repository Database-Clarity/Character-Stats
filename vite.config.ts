import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    root: 'src/editor',
    base: '/Character-Stats/editor/',
    build: { outDir: '../../dist', emptyOutDir: true },
});
