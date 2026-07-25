import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Everything under test is a pure module — no DOM, so no jsdom needed.
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})