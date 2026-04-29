import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 2428,
        proxy: {
            '/api': {
                target: 'http://localhost:6428',
                changeOrigin: true,
            },
        },
    },
});
