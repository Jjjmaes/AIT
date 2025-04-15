import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { // Add this 'server' block
    port: 5174, // Optional: If you want to specify the frontend port
    proxy: {
      // Proxy requests starting with /api to your backend
      '/api': {
        target: 'http://localhost:5000', // Make sure this is your backend server address!
        changeOrigin: true, // Needed for virtual hosted sites
        secure: false, // Set to true if backend is HTTPS with valid cert
        // ws: true, // Uncomment if you need WebSocket proxying
      }
    }
  }
})