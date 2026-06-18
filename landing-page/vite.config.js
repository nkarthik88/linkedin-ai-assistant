import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

function copyStaticFiles() {
  return {
    name: 'copy-static-files',
    closeBundle() {
      const files = ['privacy.html', 'terms.html', 'styles.css', 'favicon.svg']
      files.forEach(f => {
        try { copyFileSync(resolve(__dirname, f), resolve(__dirname, 'dist', f)) } catch {}
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
})
