import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    nitro({
      externals: {
        noTrace: true,
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  // Exclude server-only dependencies from client bundle
  optimizeDeps: {
    exclude: ['@prisma/client', '@prisma/adapter-pg'],
  },
  // Keep pdfkit and its font data external (loads from node_modules at
  // runtime) so the production image can resolve its bundled .afm/.ttf data.
  resolve: {
    external: ['pdfkit', '@fontpkg/unifont'],
    alias: {
      // Prevent Node.js built-ins from being bundled
      'node:': 'null',
    },
  },
})

export default config
