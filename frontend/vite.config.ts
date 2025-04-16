import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'; // Import path module

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { 
    alias: {
      // Removed the specific alias for ../api/api
      // Keeping the general '@' alias
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: { // Add this 'server' block
    port: 5174, // Optional: If you want to specify the frontend port
    proxy: {
      // Proxy requests starting with /api to your backend
      '/api': {
        target: 'http://localhost:5000', // Set back to 5000 based on user info
        changeOrigin: true, // Needed for virtual hosted sites
        secure: false, // Set to true if backend is HTTPS with valid cert
        // ws: true, // Uncomment if you need WebSocket proxying
      }
    }
  }
})