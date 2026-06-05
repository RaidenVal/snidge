import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/settings/src'),
        '@overlay': resolve('src/renderer/overlay/src'),
        '@palette': resolve('src/renderer/palette/src')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/settings/index.html'),
          overlay: resolve('src/renderer/overlay/index.html'),
          palette: resolve('src/renderer/palette/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
