import { defineConfig } from 'vite'

export default defineConfig({
    base: '/Milos-Archives/',
  server: {
    host: true // Cela expose le serveur sur ton réseau local
  }
})
