

import { defineConfig } from 'vite'

export default defineConfig(({ command, mode }) => {
  return {
    // Si on build pour GitHub Pages, on utilise le nom du repo
    // Sinon (Vercel, Local), on utilise la racine '/'
    base: process.env.GITHUB_ACTIONS ? '/Milos-Archives/' : '/',
    server: {
    host: true // Cela expose le serveur sur ton réseau local
  }
  }
})