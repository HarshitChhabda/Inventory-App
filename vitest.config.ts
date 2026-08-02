/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@tests': path.resolve(__dirname, './tests/ui'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/ui/setup.ts'],
    include: ['tests/ui/**/*.test.tsx', 'tests/ui/**/*.test.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/renderer/**/*.{ts,tsx}'],
    },
  },
});
